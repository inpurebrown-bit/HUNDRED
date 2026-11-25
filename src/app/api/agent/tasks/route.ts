import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard } from '@/lib/agentAuth'
import { getSessionOrAgent } from '@/lib/agentSession'

// 지시 현황판 — 대표가 "시킨 일이 지금 어디까지 갔는지" 한눈에 보는 길.
//  POST (토큰) { key, title?, stage, note?, from? } → key(보통 지시 파일 이름)로 한 줄을 만들거나 단계만 갱신(upsert)
//   stage: sent(지시함) → taken(주황이 접수) → running(작업 중) → done(끝남) → reported(나다방 보고됨) / failed(실패)
//  GET  (대표 화면 또는 토큰) → 최근 이틀치 { tasks: [{ key, title, stage, note, from, history, created_at, updated_at }] }
// agent_jobs 테이블을 case_id='task' 로 재사용한다(새 테이블 불필요).
// 같은 주제의 지시는 하나로 묶는다(최신 것만 보이고, 덮어써진 옛 줄은 자동으로 치운다)
const GROUPS: [string, RegExp][] = [
  ['dm', /개인톡|친구 목록|1:1|영업 개인|김윤지|손제후|이기훈/],
  ['reading', /읽기|안 ?읽은|배지|문단|마우스|카톡 마우스/],
  ['speed', /속도|CLAUDE.md|처리 줄/],
  ['board', /현황판|단계 보고|멈춤 배너|마무리 규칙/],
  ['docs', /문서 생성|재무제표·보고서|맨 앞 화면|프로그램 연결|서류 다 받/],
  ['restart', /재시작|로그아웃|승인 전달|인터넷 끊김/],
]
const groupOf = (d: any): string => d.group || (GROUPS.find(([, re]) => re.test(String(d.title || '')))?.[0]) || d.key
const STAGES = ['sent', 'taken', 'running', 'done', 'reported', 'failed']
const KEEP_MS = 4 * 24 * 3600 * 1000

export async function GET() {
  const session = await getSessionOrAgent()
  if (!session || (session.user as any).role !== 'ceo') return NextResponse.json({ tasks: [] })
  const since = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  const { data } = await supabaseAdmin.from('agent_jobs').select('id, draft, created_at, updated_at')
    .eq('case_id', 'task').gte('created_at', since).order('created_at', { ascending: false }).limit(40)
  // 시간 규칙: 오래 변화 없는 지시는 계속 "진행 중"으로 두지 않고 실패로 확정한다(실패는 그 뒤로 시간을 세지 않는다)
  //  전달 중(sent) 10분 / 받음·작업 중(taken·running) 30분 넘게 변화가 없으면 failed
  const live: any[] = []
  for (const r of data || []) {
    const d: any = r.draft || {}
    if (d.acked) continue
    const idle = Date.now() - new Date(r.updated_at).getTime()
    const lim = d.stage === 'sent' ? 10 * 60000 : (d.stage === 'taken' || d.stage === 'running') ? 30 * 60000 : 0
    if (d.kind !== 'blocker' && !String(d.key || '').startsWith('blocker') && lim && idle > lim) {
      const at = new Date().toISOString()
      const note = d.stage === 'sent'
        ? '실패: 주황이가 10분 안에 지시를 받지 않았습니다. 주황이 PC의 수신기·읽기 프로그램이 멈췄을 수 있습니다. 다시 하려면 주황이에게 같은 지시를 새로 보내야 합니다.'
        : '실패: ' + (d.stage === 'taken' ? '받은 뒤' : '작업 중') + ' 30분 넘게 변화가 없어 시간 초과로 처리했습니다. 다시 하려면 주황이에게 새로 지시해야 합니다.'
      d.history = [...(d.history || []), { stage: 'failed', at }].slice(-12)
      d.stage = 'failed'; d.note = note; d.final = true
      await supabaseAdmin.from('agent_jobs').update({ draft: d, status: 'failed', updated_at: at }).eq('id', r.id)
      r.updated_at = at
    }
    live.push({ id: r.id, d, created_at: r.created_at, updated_at: r.updated_at })
  }
  // 같은 주제는 최신 한 줄만 남기고, 덮어써진 옛 줄은 DB에서도 치운다(확인 처리)
  const out: any[] = []
  const seen = new Map<string, number>()
  for (const t of live) {
    if (t.d.kind === 'blocker' || String(t.d.key || '').startsWith('blocker')) { out.push({ ...t.d, created_at: t.created_at, updated_at: t.updated_at }); continue }
    const g = groupOf(t.d)
    if (!seen.has(g)) { seen.set(g, 0); out.push({ ...t.d, group: g, created_at: t.created_at, updated_at: t.updated_at }) }
    else {
      seen.set(g, (seen.get(g) || 0) + 1)
      await supabaseAdmin.from('agent_jobs').update({ draft: { ...t.d, acked: true, superseded: true } }).eq('id', t.id)
    }
  }
  for (const o of out) if (o.group && seen.get(o.group)) o.merged = seen.get(o.group)
  return NextResponse.json({ tasks: out })
}

export async function POST(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const b = await req.json().catch(() => ({}))
  const key = String(b.key || '').trim().slice(0, 120), stage = String(b.stage || '')
  if (!key || !STAGES.includes(stage)) return NextResponse.json({ error: `key 와 stage(${STAGES.join('|')}) 필요` }, { status: 400 })
  const at = new Date().toISOString()
  const ex = await supabaseAdmin.from('agent_jobs').select('id, draft').eq('case_id', 'task').eq('draft->>key', key).limit(1)
  const old = ex.data?.[0]
  const hist = [...(old?.draft?.history || [])]
  if (!old || old.draft?.stage !== stage) hist.push({ stage, at })
  const draft = {
    key, stage, history: hist.slice(-12), ...(old?.draft?.acked ? { acked: true } : {}),
    title: String(b.title || old?.draft?.title || key).slice(0, 120),
    from: String(b.from || old?.draft?.from || '').slice(0, 20),
    note: b.note != null ? String(b.note).slice(0, 400) : (old?.draft?.note || ''),
    ...(b.kind === 'blocker' || key.startsWith('blocker') || old?.draft?.kind === 'blocker' ? { kind: 'blocker' } : {}),
    ...(b.group ? { group: String(b.group).slice(0, 30) } : old?.draft?.group ? { group: old.draft.group } : {}),
    ...(b.attempt != null ? { attempt: Number(b.attempt) || 0 } : old?.draft?.attempt != null ? { attempt: old.draft.attempt } : {}),
    ...(stage === 'failed' && b.final ? { final: true } : {}),
    ask: b.ask != null ? String(b.ask).slice(0, 200) : (old?.draft?.ask || ''),
  }
  const status = stage === 'failed' ? 'failed' : stage === 'sent' ? 'requested' : stage === 'done' || stage === 'reported' ? 'sent' : 'drafting'
  if (old) await supabaseAdmin.from('agent_jobs').update({ draft, status, updated_at: at }).eq('id', old.id)
  else await supabaseAdmin.from('agent_jobs').insert({ kind: 'task', case_id: 'task', company: '주황이', status, requested_by: draft.from || '빨강이', draft })
  await supabaseAdmin.from('agent_jobs').delete().eq('case_id', 'task').lt('created_at', new Date(Date.now() - KEEP_MS).toISOString())
  return NextResponse.json({ ok: true })
}

// PATCH (대표 화면) { key } → 확인 버튼: 끝난 지시를 현황판에서 치운다
export async function PATCH(req: NextRequest) {
  const session = await getSessionOrAgent()
  if (!session || (session.user as any).role !== 'ceo') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const b = await req.json().catch(() => ({}))
  const keys: string[] = (Array.isArray(b.keys) ? b.keys : [b.key]).map((k: any) => String(k || '')).filter(Boolean).slice(0, 50)
  for (const key of keys) {
    const ex = await supabaseAdmin.from('agent_jobs').select('id, draft').eq('case_id', 'task').eq('draft->>key', key).limit(1)
    const old = ex.data?.[0]
    if (old) await supabaseAdmin.from('agent_jobs').update({ draft: { ...old.draft, acked: true } }).eq('id', old.id)
  }
  return NextResponse.json({ ok: true })
}
