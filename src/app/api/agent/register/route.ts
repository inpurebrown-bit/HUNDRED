import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard } from '@/lib/agentAuth'
import { AGENT_KIND_KEYS, AGENT_KIND_LIST, CUSTOMER_DOC_TYPES } from '@/lib/agentKinds'

// 주황이 전용: 올린 파일을 CRM 에 등록한다.
//  body { case_id, path, file_name, kind: 'customer' | 'output', doc_type, job_id? }
//   customer : 고객이 카톡방에 올린 서류 → 고객서류 탭 분류(doc_type ∈ CUSTOMER_DOC_TYPES)에 추가 (이미 같은 파일명이 있으면 건너뜀)
//   output   : 주황이가 만든 결과물 → 주황이 지시 탭 결과물 목록(doc_type = 작업 종류 키)
export async function POST(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const { case_id, path, file_name, kind, doc_type, job_id } = await req.json().catch(() => ({}))
  if (!case_id || !path || !file_name || !kind || !doc_type) return NextResponse.json({ error: 'case_id, path, file_name, kind, doc_type 필요' }, { status: 400 })
  if (!String(path).startsWith(`cases/${case_id}/`)) return NextResponse.json({ error: 'path 가 올바르지 않습니다' }, { status: 400 })
  const { data: oc } = await supabaseAdmin.from('ops_cases').select('id, details').eq('id', case_id).single()
  if (!oc) return NextResponse.json({ error: '업체(관리팀 카드) 없음' }, { status: 404 })
  const d: any = { ...(oc.details || {}) }

  if (kind === 'customer') {
    if (!(CUSTOMER_DOC_TYPES as readonly string[]).includes(doc_type)) return NextResponse.json({ error: `doc_type 은 ${CUSTOMER_DOC_TYPES.join(', ')} 중 하나` }, { status: 400 })
    const docs = { ...(d.consulting_docs || {}) }
    const cur = docs[doc_type] || {}
    const files = Array.isArray(cur.files) ? cur.files : (cur.path ? [{ path: cur.path, fileName: cur.fileName || '' }] : [])
    if (files.some((f: any) => f.fileName === file_name)) return NextResponse.json({ ok: true, skipped: '같은 이름의 파일이 이미 있습니다' })
    docs[doc_type] = { ...cur, none: false, files: [...files, { path, fileName: file_name, by: '주황이' }] }
    d.consulting_docs = docs
  } else if (kind === 'output') {
    if (!AGENT_KIND_KEYS.includes(doc_type)) return NextResponse.json({ error: '알 수 없는 작업 종류' }, { status: 400 })
    const list = Array.isArray(d.agent_docs) ? d.agent_docs : []
    list.push({ kind: doc_type, label: AGENT_KIND_LIST.find(k => k.key === doc_type)?.label || doc_type, path, fileName: file_name, job_id: job_id || null, at: new Date().toISOString() })
    d.agent_docs = list
  } else return NextResponse.json({ error: 'kind 는 customer 또는 output' }, { status: 400 })

  const { error } = await supabaseAdmin.from('ops_cases').update({ details: d }).eq('id', case_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
