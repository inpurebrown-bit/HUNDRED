'use client'
import { useEffect, useState } from 'react'

type Task = { key: string; title: string; stage: string; note?: string; from?: string; history?: { stage: string; at: string }[]; created_at: string; updated_at: string }
const STEPS = [['sent', '지시함'], ['taken', '접수'], ['running', '작업 중'], ['done', '완료'], ['reported', '보고됨']] as const
const idx = (s: string) => Math.max(0, STEPS.findIndex(x => x[0] === s))
const hhmm = (iso: string) => { const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const dur = (ms: number) => { const m = Math.floor(ms / 60000); return m < 1 ? '1분 미만' : m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간 ${m % 60}분` }

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [now, setNow] = useState(Date.now())
  const [open, setOpen] = useState(true)
  useEffect(() => {
    let live = true
    const load = async () => { try { const r = await fetch('/api/agent/tasks', { cache: 'no-store' }); if (r.ok && live) setTasks((await r.json()).tasks || []) } catch {} setNow(Date.now()) }
    load(); const t = setInterval(load, 8000)
    return () => { live = false; clearInterval(t) }
  }, [])
  const list = tasks || []
  const active = list.filter(t => t.stage !== 'reported' && t.stage !== 'failed' && t.stage !== 'done').length
  const shown = list.slice(0, open ? 12 : 3)

  return (
    <div className="px-3 pb-3 pt-2" style={{ background: '#0a1230', borderTop: '1px solid #1b2a55' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[13px] font-black text-[#fde68a]">📋 지시 현황판</span>
        <span className="text-[11px] font-bold text-white/60">진행 중 {active}건 · 8초마다 자동 갱신</span>
        <button onClick={() => setOpen(v => !v)} className="ml-auto text-[11px] font-bold text-white/70 border border-white/20 rounded px-2 py-0.5">{open ? '접기' : '펼치기'}</button>
      </div>
      {tasks === null && <p className="text-[12px] text-white/50">불러오는 중…</p>}
      {tasks && list.length === 0 && <p className="text-[12px] text-white/50">아직 기록된 지시가 없습니다.</p>}
      <div className="grid gap-1.5">
        {shown.map(t => {
          const failed = t.stage === 'failed', fin = t.stage === 'reported', cur = idx(t.stage)
          const since = now - new Date(t.updated_at).getTime()
          const stuck = !failed && !fin && ((t.stage === 'sent' && since > 3 * 60000) || (t.stage === 'running' && since > 10 * 60000) || (t.stage === 'done' && since > 5 * 60000))
          const total = new Date(failed || fin ? t.updated_at : now).getTime() - new Date(t.created_at).getTime()
          const tone = failed ? '#ef4444' : stuck ? '#f59e0b' : fin ? '#22c55e' : '#60a5fa'
          return (
            <div key={t.key} className="rounded-lg px-3 py-2" style={{ background: '#0e1a40', border: `1px solid ${tone}66` }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12px] font-black text-white">{t.title}</span>
                <span className="text-[10px] font-bold text-white/45">{hhmm(t.created_at)} 지시 · {fin || failed ? `총 ${dur(total)}` : `경과 ${dur(total)}`}</span>
                {failed && <span className="text-[10px] font-black text-white bg-red-600 rounded px-1.5">실패</span>}
                {stuck && <span className="text-[10px] font-black text-black bg-amber-400 rounded px-1.5">오래 걸리는 중 ({dur(since)} 동안 변화 없음)</span>}
              </div>
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {STEPS.map(([k, label], i) => {
                  const at = t.history?.find(h => h.stage === k)?.at
                  const on = !failed && i <= cur, isNow = !failed && i === cur && !fin
                  return (
                    <span key={k} className="text-[10.5px] font-bold rounded px-1.5 py-0.5" style={{ background: on ? (isNow ? tone : '#14532d') : '#1a2250', color: on ? '#fff' : '#6b7bb8', outline: isNow ? '1px solid #fff5' : 'none' }}>
                      {on && !isNow ? '✓ ' : ''}{label}{at ? ` ${hhmm(at)}` : ''}
                    </span>
                  )
                })}
              </div>
              {t.note && <p className="text-[11.5px] text-white/80 mt-1 leading-snug">{t.note}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
