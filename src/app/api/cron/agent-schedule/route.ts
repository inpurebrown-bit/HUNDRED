import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { AUTO_KINDS, AUTO_COMMENTS } from '@/lib/agentKinds'

export const maxDuration = 60

// 계약 후 2·3·4일차에 고정 자료 3종(재무제표 핵심 가이드 / 절세요령 / 정부지원금·인증 로드맵)을 주황이가 자동으로 보내게 작업을 만든다.
// 매일 아침 9시(KST) 실행(vercel.json crons). 같은 업체·같은 자료는 한 번만 만든다(이미 있으면 건너뜀)라서 몇 번 불러도 안전하다.
const kstDay = (offsetDays = 0) => new Date(Date.now() + 9 * 3600 * 1000 - offsetDays * 86400000).toISOString().slice(0, 10)
const SKIP_STAGE = /absorbed|환불|해지|종료|완료/

export async function GET() {
  const want: Record<string, string> = {}   // 계약일 → 보낼 자료 키
  for (const a of AUTO_KINDS) want[kstDay(a.day - 1)] = a.key   // 2일차 = 계약일 +1, 3일차 = +2, 4일차 = +3
  let cases: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from('ops_cases').select('id, customer_id, customer_name, stage').range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    cases = cases.concat(data || [])
    if (!data || data.length < 1000) break
  }
  const ids = [...new Set(cases.map(c => c.customer_id).filter(Boolean))]
  const contract: Record<string, string> = {}, company: Record<string, string> = {}
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseAdmin.from('customers').select('id, name, details').in('id', ids.slice(i, i + 200))
    for (const c of data || []) { contract[c.id] = String(c.details?.contract_date || '').slice(0, 10); company[c.id] = c.details?.company || c.name || '' }
  }
  const made: string[] = []
  for (const c of cases) {
    if (SKIP_STAGE.test(String(c.stage || ''))) continue
    const kind = want[contract[c.customer_id] || '']
    if (!kind) continue
    const ex = await supabaseAdmin.from('agent_jobs').select('id').eq('case_id', c.id).eq('kind', kind).limit(1)
    if (ex.data?.length) continue
    const { error } = await supabaseAdmin.from('agent_jobs').insert({ kind, case_id: c.id, company: company[c.customer_id] || c.customer_name || '', room: '', requested_by: '자동 발송(계약 후)', draft: { comment: AUTO_COMMENTS[kind], auto_send: true, source: 'schedule' } })
    if (!error) made.push(`${company[c.customer_id] || c.customer_name}:${kind}`)
  }
  return NextResponse.json({ date: kstDay(), made })
}
