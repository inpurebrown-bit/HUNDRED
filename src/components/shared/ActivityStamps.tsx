'use client'

import { useState } from 'react'

// 인콜카드 타임스탬프 — 누가·언제·무엇을 했는지 시간 역순으로 보여준다 (영업팀·관리팀·대표 공통)
export interface StampEntry { at: string; by: string; role: string; action: string; detail?: string; n?: number; src?: string }

const DOT: Record<string, string> = { sales: 'bg-blue-400', ops: 'bg-violet-400', ceo: 'bg-amber-400', dig: 'bg-orange-400' }

const kst = (iso: string) => {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  // "11-03 16:20"
  return { day: parts.slice(0, 5).replace('-', '/'), time: parts.slice(6) }
}

export default function ActivityStamps({ entries, defaultOpen = false }: { entries: StampEntry[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const list = [...(entries || [])].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
  // 날짜별로 묶는다
  const groups: { day: string; items: StampEntry[] }[] = []
  for (const e of list) {
    const k = kst(e.at)
    const day = k?.day || '—'
    const g = groups[groups.length - 1]
    if (g && g.day === day) g.items.push(e)
    else groups.push({ day, items: [e] })
  }
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <span className="text-[10px] font-bold text-blue-700">기록 <span className="font-normal text-gray-400">{list.length}건</span></span>
        <span className="text-[10px] text-gray-400">{open ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>
      {open && (
        list.length === 0 ? (
          <p className="text-[11px] text-gray-300 italic text-center py-3">아직 기록이 없습니다</p>
        ) : (
          <div className="mt-2 max-h-72 overflow-y-auto pr-1 space-y-2">
            {groups.map(g => (
              <div key={g.day}>
                <p className="text-[9px] font-bold text-gray-300 mb-0.5">{g.day}</p>
                <div className="border-l border-gray-100 ml-0.5">
                  {g.items.map((e, i) => {
                    const t = kst(e.at)
                    return (
                      <div key={i} className="relative pl-3 py-[3px] flex items-baseline gap-1.5 flex-wrap leading-snug">
                        <span className={`absolute -left-[2.5px] top-[9px] w-[5px] h-[5px] rounded-full ${DOT[e.role] || 'bg-gray-300'}`} />
                        <span className="font-mono text-[9.5px] text-gray-400 shrink-0">{t?.time || ''}</span>
                        <span className="text-[11px] text-gray-800"><b className="font-semibold">{e.action}</b>{e.n && e.n > 1 ? <span className="text-gray-400"> ×{e.n}</span> : null}</span>
                        {e.detail ? <span className="text-[10.5px] text-gray-500">{e.detail}</span> : null}
                        <span className="text-[9.5px] text-gray-300 ml-auto">{e.by}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
