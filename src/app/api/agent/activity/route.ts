import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard } from '@/lib/agentAuth'
import { getSessionOrAgent } from '@/lib/agentSession'

// 색상 AI(주황이·보라·남색 등)가 한 일("관리팀방에 인사 보냈습니다" 같은)을 대표 사무실 화면에 올리는 길.
//  POST (주황이 PC, AGENT_TOKEN) { agent: '주황이', text: '…' } → 기록
//  GET  (대표 화면 또는 토큰)     → 최근 이틀치 목록 { acts: [{ id, agent, text, at }] }
// agent_jobs 테이블을 case_id='act' 로 재사용한다(새 테이블 불필요).
const KEEP_MS = 3 * 24 * 3600 * 1000

export async function GET() {
  const session = await getSessionOrAgent()
  if (!session || (session.user as any).role !== 'ceo') return NextResponse.json({ acts: [] })
  const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  const { data } = await supabaseAdmin.from('agent_jobs').select('id, company, draft, created_at')
    .eq('case_id', 'act').gte('created_at', since).order('created_at', { ascending: false }).limit(30)
  return NextResponse.json({ acts: (data || []).map(r => ({ id: r.id, agent: r.company, text: r.draft?.text || '', at: r.created_at })) })
}

export async function POST(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const b = await req.json().catch(() => ({}))
  const agent = String(b.agent || '').trim(), text = String(b.text || '').trim()
  if (!agent || !text) return NextResponse.json({ error: 'agent, text 필요' }, { status: 400 })
  const { data, error } = await supabaseAdmin.from('agent_jobs')
    .insert({ kind: 'activity', case_id: 'act', company: agent.slice(0, 20), status: 'sent', requested_by: agent.slice(0, 20), draft: { text: text.slice(0, 200) } })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabaseAdmin.from('agent_jobs').delete().eq('case_id', 'act').lt('created_at', new Date(Date.now() - KEEP_MS).toISOString())
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}
