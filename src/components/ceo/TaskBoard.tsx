'use client'
import { useEffect, useState } from 'react'

type Task = { kind?: string; ask?: string; key: string; title: string; stage: string; note?: string; from?: string; history?: { stage: string; at: string }[]; created_at: string; updated_at: string }
const LABEL: Record<string, string> = { sent: '주황이 PC로 전달 중', taken: '주황이가 받았음', running: '작업 중', done: '작업 끝 · 나다방 보고 대기', reported: '끝남 · 나다방에 보고됨', failed: '실패' }
const hhmm = (iso: string) => { const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const dur = (ms: number) => { const m = Math.floor(ms / 60000); return m < 1 ? '1분 미만' : m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간 ${m % 60}분` }
const isEnd = (s: string) => s === 'reported' || s === 'failed' || s === 'done'

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [now, setNow] = useState(Date.now())
  const load = async () => { try { const r = await fetch('/api/agent/tasks', { cache: 'no-store' }); if (r.ok) setTasks((await r.json()).tasks || []) } catch {} setNow(Date.now()) }
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t) }, [])
  const ack = async (keys: string[]) => {
    setTasks(p => (p || []).filter(t => !keys.includes(t.key)))
    try { await fetch('/api/agent/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keys }) }) } catch {}
  }
  const list = tasks || []
  const blockers = list.filter(t => t.kind === 'blocker')
  const rest = list.filter(t => t.kind !== 'blocker')
  const going = rest.filter(t => !isEnd(t.stage))
  const ended = rest.filter(t => isEnd(t.stage))

  const Card = ({ t }: { t: Task }) => {
    const failed = t.stage === 'failed', end = isEnd(t.stage)
    const since = now - new Date(t.updated_at).getTime()
    const stuck = !end && ((t.stage === 'sent' && since > 3 * 60000) || (t.stage === 'taken' && since > 3 * 60000) || (t.stage === 'running' && since > 10 * 60000))
    const total = (end ? new Date(t.updated_at).getTime() : now) - new Date(t.created_at).getTime()
    const tone = failed ? '#ef4444' : stuck ? '#f59e0b' : end ? '#22c55e' : '#60a5fa'
    return (
      <div className="rounded-lg px-3 py-2 flex items-start gap-3" style={{ background: '#0e1a40', border: `1px solid ${tone}88` }}>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-black text-white leading-snug">{t.title}</p>
          <p className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-black rounded px-2 py-0.5 text-white" style={{ background: tone }}>{LABEL[t.stage] || t.stage}</span>
            {stuck && <span className="text-[11px] font-black text-amber-300">⚠ {dur(since)} 동안 변화 없음</span>}
            <span className="text-[11px] font-bold text-white/50">{hhmm(t.created_at)} 지시 · {end ? `${dur(total)} 걸림` : `${dur(total)} 경과`}</span>
          </p>
          {t.note && <p className="text-[12px] text-white/85 mt-1 leading-snug">{t.note}</p>}
        </div>
        {end && <button onClick={() => ack([t.key])} className="shrink-0 text-[12px] font-black text-white rounded-md px-3 py-1.5" style={{ background: '#16a34a' }}>확인</button>}
      </div>
    )
  }

  return (
    <div className="px-3 pb-3 pt-2" style={{ background: '#0a1230', borderTop: '1px solid #1b2a55' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[14px] font-black text-[#fde68a]">📋 주황이 지시 현황</span>
        <span className="text-[11px] font-bold text-white/55">8초마다 자동 갱신</span>
        {ended.length > 1 && <button onClick={() => ack(ended.map(t => t.key))} className="ml-auto text-[11px] font-bold text-white/80 border border-white/25 rounded px-2 py-0.5">끝난 것 전부 확인</button>}
      </div>
      {blockers.map(b => (
        <div key={b.key} className="rounded-lg px-3 py-2 mb-2 flex items-start gap-3" style={{ background: '#3b1d0a', border: '2px solid #f59e0b' }}>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-amber-300">⛔ 지금 멈춰 있는 것: {b.title}</p>
            {b.note && <p className="text-[12px] text-white/90 mt-1 leading-snug">{b.note}</p>}
            {b.ask && <p className="text-[13px] font-black text-white mt-1.5 rounded px-2 py-1 inline-block" style={{ background: '#b45309' }}>👉 나다방에 이렇게 써 주세요: {b.ask}</p>}
            <p className="text-[11px] font-bold text-white/50 mt-1">{hhmm(b.updated_at)} 기준 · 풀리면 주황이가 이 칸을 치웁니다</p>
          </div>
          <button onClick={() => ack([b.key])} className="shrink-0 text-[12px] font-black text-white rounded-md px-3 py-1.5" style={{ background: '#78350f' }}>치우기</button>
        </div>
      ))}
      {tasks === null && <p className="text-[12px] text-white/50">불러오는 중…</p>}
      {tasks && rest.length === 0 && blockers.length === 0 && <p className="text-[12px] text-white/60">진행 중이거나 확인할 지시가 없습니다.</p>}
      {going.length > 0 && <>
        <p className="text-[12px] font-black text-sky-300 mb-1">🔵 지금 진행 중 ({going.length})</p>
        <div className="grid gap-1.5 mb-3">{going.map(t => <Card key={t.key} t={t} />)}</div>
      </>}
      {ended.length > 0 && <>
        <p className="text-[12px] font-black text-green-300 mb-1">✅ 끝난 것 — 확인 누르면 치워집니다 ({ended.length})</p>
        <div className="grid gap-1.5">{ended.map(t => <Card key={t.key} t={t} />)}</div>
      </>}
    </div>
  )
}
