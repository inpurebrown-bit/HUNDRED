import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard, scrub } from '@/lib/agentAuth'
import { AGENT_KIND_LIST } from '@/lib/agentKinds'

const BUCKET = 'consulting-docs'
const now = () => new Date().toISOString()

// 주황이 전용: 작업 1건의 상세 — 업체 정보·인콜일지·여신구분·고객서류(다운로드 주소 포함)·이미 만든 결과물
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const g = agentGuard(req); if (g) return g
  const { id } = await context.params
  const { data: job } = await supabaseAdmin.from('agent_jobs').select('*').eq('id', id).single()
  if (!job) return NextResponse.json({ error: '작업 없음' }, { status: 404 })
  const { data: oc } = await supabaseAdmin.from('ops_cases').select('*').eq('id', job.case_id).single()
  if (!oc) return NextResponse.json({ error: '업체(관리팀 카드) 없음' }, { status: 404 })
  let cu: any = null
  if (oc.customer_id) cu = (await supabaseAdmin.from('customers').select('id, name, phone, details, call_timeline').eq('id', oc.customer_id).single()).data
  if (!cu && oc.phone) {
    const p = String(oc.phone).replace(/[^0-9]/g, '')
    const r = await supabaseAdmin.from('customers').select('id, name, phone, details, call_timeline').or(`phone.eq.${oc.phone},phone.eq.${p}`).limit(1)
    cu = r.data?.[0] || null
  }

  const d: any = oc.details || {}
  // 고객서류: 분류별 파일 + 1시간짜리 다운로드 주소
  const docs: Record<string, any> = {}
  for (const [type, st] of Object.entries<any>(d.consulting_docs || {})) {
    const files = Array.isArray(st?.files) ? st.files : (st?.path ? [{ path: st.path, fileName: st.fileName || '' }] : [])
    const withUrl = []
    for (const f of files) {
      const s = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(f.path, 3600)
      withUrl.push({ fileName: f.fileName, path: f.path, url: s.data?.signedUrl || null })
    }
    docs[type] = { none: !!st?.none, amount: st?.amount, owned: st?.owned, price: st?.price, files: withUrl }
  }
  const outputs = []
  for (const o of (Array.isArray(d.agent_docs) ? d.agent_docs : []).filter((x: any) => x.kind === job.kind)) {
    const s = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(o.path, 3600)
    outputs.push({ ...o, url: s.data?.signedUrl || null })
  }
  const kind = AGENT_KIND_LIST.find(k => k.key === job.kind)
  return NextResponse.json({
    job: { id: job.id, kind: job.kind, label: kind?.label, where: kind?.where, no: kind?.no, fixed: !!kind?.fixed, status: job.status, room: job.room, company: job.company, case_id: job.case_id, draft: job.draft, auto_send: !!job.draft?.auto_send, target: job.draft?.target || null, review: !!job.draft?.review, error: job.error },
    company: {
      name: cu?.details?.company || cu?.name || oc.customer_name || job.company, representative: oc.details?.incall_journal?.representative || cu?.name || '',
      phone: cu?.phone || oc.phone || '', ops_user: oc.ops_user_name || oc.details?.ops_user_name || '', stage: oc.stage || '', kakao_room: d.kakao_room || '',
    },
    customer_details: scrub(cu?.details || {}),
    incall_journal: scrub(d.incall_journal || {}),
    sales_call_timeline: scrub(cu?.call_timeline || []),
    credit_report: scrub(d.credit_report || null),
    customer_docs: docs,
    existing_outputs: outputs,
  })
}

// 주황이 전용: 상태 변경. body { action, message?, files?, missing?, error? }
//  claim   요청됨 → 작성 중
//  ready   작성 중 → 검토 대기 (draft: { message(주황이방에 올릴 안내), files, missing })
//  approve 검토 대기 → 전송 대기 (주황이방에서 "전송" 답을 받았을 때)
//  sent    전송 대기 → 전송 완료
//  fail    실패 (error 필수)
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const g = agentGuard(req); if (g) return g
  const { id } = await context.params
  const body = await req.json().catch(() => ({}))
  const { data: job } = await supabaseAdmin.from('agent_jobs').select('id, status, draft').eq('id', id).single()
  if (!job) return NextResponse.json({ error: '작업 없음' }, { status: 404 })
  const move = (from: string[], to: string, extra: Record<string, any> = {}) => {
    if (!from.includes(job.status)) return NextResponse.json({ error: `현재 상태(${job.status})에서는 할 수 없습니다` }, { status: 409 })
    return supabaseAdmin.from('agent_jobs').update({ status: to, updated_at: now(), ...extra }).eq('id', id).then(r => r.error ? NextResponse.json({ error: r.error.message }, { status: 500 }) : NextResponse.json({ ok: true, status: to }))
  }
  switch (body.action) {
    case 'claim': return move(['requested'], 'drafting', { error: null })
    case 'ready': return move(['drafting'], 'draft_ready', { draft: { ...(job.draft || {}), message: String(body.message || '').slice(0, 2000), files: body.files || [], missing: body.missing || [] }, error: null })
    case 'approve': return move(['draft_ready'], 'approved')
    case 'sent': return move(job.draft?.auto_send ? ['requested', 'drafting', 'draft_ready', 'approved', 'sending'] : ['approved', 'sending'], 'sent', { result: { sent_at: now(), note: String(body.message || '').slice(0, 500) } })
    case 'fail': return move(['requested', 'drafting', 'draft_ready', 'approved', 'sending'], 'failed', { error: String(body.error || '실패').slice(0, 500) })
    default: return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
  }
}
