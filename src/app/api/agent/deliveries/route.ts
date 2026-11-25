import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard } from '@/lib/agentAuth'

// 주황이 전용: 고객에게 자료를 "교부(전달)"한 사실과 시각을 관리팀 인콜카드(환불·정산 탭)에 남긴다.
//  POST { case_id | company, label, at?(ISO, 없으면 지금), key?, note? }
//   · key 가 같으면 같은 교부로 보고 덮어쓴다(중복 방지). 예: "diag_report", "company_intro", "bizplan_submit"
//  GET  ?case_id=… | ?company=… → 그 업체의 교부 이력
async function findCase(caseId?: string | null, company?: string | null) {
  if (caseId) { const { data } = await supabaseAdmin.from('ops_cases').select('id, customer_name, details').eq('id', caseId).limit(1); return data?.[0] || null }
  if (company) {
    const { data } = await supabaseAdmin.from('ops_cases').select('id, customer_name, details').ilike('customer_name', `%${company}%`).limit(5)
    const exact = (data || []).filter(c => String(c.customer_name || '').replace(/\s/g, '') === company.replace(/\s/g, ''))
    return exact[0] || ((data || []).length === 1 ? data![0] : null)
  }
  return null
}

export async function GET(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const u = new URL(req.url)
  const c = await findCase(u.searchParams.get('case_id'), u.searchParams.get('company'))
  if (!c) return NextResponse.json({ error: '업체를 찾지 못했습니다(여럿이거나 없음)' }, { status: 404 })
  return NextResponse.json({ case_id: c.id, company: c.customer_name, deliveries: (c.details as any)?.deliveries || [] })
}

export async function POST(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const b = await req.json().catch(() => ({}))
  const label = String(b.label || '').trim().slice(0, 100)
  if (!label) return NextResponse.json({ error: 'label 필요' }, { status: 400 })
  const c = await findCase(b.case_id, b.company)
  if (!c) return NextResponse.json({ error: '업체를 찾지 못했습니다(case_id 로 보내 주세요)' }, { status: 404 })
  const at = b.at && !isNaN(new Date(b.at).getTime()) ? new Date(b.at).toISOString() : new Date().toISOString()
  const list: any[] = Array.isArray((c.details as any)?.deliveries) ? [...(c.details as any).deliveries] : []
  const key = String(b.key || '').slice(0, 60)
  const entry = { id: key ? 'k_' + key : 'a' + Date.now(), key: key || undefined, label, at, by: '주황이', note: String(b.note || '').slice(0, 120) || undefined }
  const idx = key ? list.findIndex(d => d.key === key) : -1
  if (idx >= 0) list[idx] = entry; else list.push(entry)
  const { error } = await supabaseAdmin.from('ops_cases').update({ details: { ...(c.details as any), deliveries: list.slice(-80) } }).eq('id', c.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, case_id: c.id, count: list.length })
}
