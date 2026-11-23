import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard } from '@/lib/agentAuth'

// 수신기 명령 대기열 — agent_jobs 테이블을 case_id='cmd' 로 재사용 (company=담당 이름, kind='cmd_<동작>', draft.args=인자)
// 수신기(자동으로 돌아가는 PC)가 10초마다 GET 으로 가져가 실행하고 PATCH 로 결과를 올린다.
// 서버는 "동작 이름 + 글자 인자"만 전달한다. 무엇을 실행할지는 PC 쪽 허용 목록이 정한다.
const AGENTS = ['주황이', '보라']
const HB_CASE = 'cmd-hb'
const now = () => new Date().toISOString()
const strArgs = (a: any) => {
  const out: Record<string, string> = {}
  if (a && typeof a === 'object') for (const [k, v] of Object.entries(a)) if (/^[a-z_]{1,30}$/i.test(k)) out[k] = String(v ?? '').slice(0, 20000)
  return out
}

// GET ?agent=주황이            → 이 담당의 실행 대기 명령 (+ 수신기 생존 신호 기록)
// GET ?agent=주황이&status=…   → 상태별 목록 (결과 확인용)
// GET ?health=1                → 담당별 마지막 수신 시각
export async function GET(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const sp = new URL(req.url).searchParams
  if (sp.get('health')) {
    const { data } = await supabaseAdmin.from('agent_jobs').select('company, updated_at').eq('case_id', HB_CASE)
    return NextResponse.json({ agents: (data || []).map(r => ({ agent: r.company, last_seen: r.updated_at })) })
  }
  const agent = sp.get('agent') || ''
  if (!AGENTS.includes(agent)) return NextResponse.json({ error: `agent 는 ${AGENTS.join(', ')} 중 하나` }, { status: 400 })
  const status = sp.get('status') || 'requested'
  if (status === 'requested') {
    const hb = await supabaseAdmin.from('agent_jobs').select('id').eq('case_id', HB_CASE).eq('company', agent).limit(1)
    if (hb.data?.[0]) await supabaseAdmin.from('agent_jobs').update({ updated_at: now() }).eq('id', hb.data[0].id)
    else await supabaseAdmin.from('agent_jobs').insert({ kind: 'heartbeat', case_id: HB_CASE, company: agent, status: 'sent' })
  }
  const { data, error } = await supabaseAdmin.from('agent_jobs')
    .select('id, kind, status, company, draft, result, error, requested_by, created_at, updated_at')
    .eq('case_id', 'cmd').eq('company', agent).eq('status', status).order('created_at', { ascending: status === 'requested' }).limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ commands: (data || []).map(r => ({ id: r.id, agent: r.company, action: String(r.kind).replace(/^cmd_/, ''), args: r.draft?.args || {}, status: r.status, output: r.result?.output ?? null, error: r.error, created_at: r.created_at, updated_at: r.updated_at })) })
}

// POST { agent, action, args } → 명령 등록
export async function POST(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const b = await req.json().catch(() => ({}))
  if (!AGENTS.includes(b.agent)) return NextResponse.json({ error: `agent 는 ${AGENTS.join(', ')} 중 하나` }, { status: 400 })
  if (!/^[a-z_]{1,40}$/i.test(String(b.action || ''))) return NextResponse.json({ error: 'action 이 올바르지 않습니다' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('agent_jobs')
    .insert({ kind: `cmd_${b.action}`, case_id: 'cmd', company: b.agent, requested_by: '빨강이', draft: { args: strArgs(b.args) } })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}

// PATCH { id, status: 'running' | 'done' | 'failed', output?, error? } → 수신기가 상태·결과 보고 ('running' 은 requested 일 때만 = 중복 실행 방지)
export async function PATCH(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const b = await req.json().catch(() => ({}))
  const map: Record<string, string> = { running: 'drafting', done: 'sent', failed: 'failed' }
  if (!b.id || !map[b.status]) return NextResponse.json({ error: 'id, status(running|done|failed) 필요' }, { status: 400 })
  let q = supabaseAdmin.from('agent_jobs').update({
    status: map[b.status], updated_at: now(),
    ...(b.status !== 'running' ? { result: { output: String(b.output ?? '').slice(0, 20000) } } : {}),
    ...(b.status === 'failed' ? { error: String(b.error || '실패').slice(0, 500) } : {}),
  }).eq('id', b.id).eq('case_id', 'cmd')
  if (b.status === 'running') q = q.eq('status', 'requested')
  const { data, error } = await q.select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: '이미 가져갔거나 없는 명령입니다' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
