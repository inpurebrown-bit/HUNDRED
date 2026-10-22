'use client'

import { useState } from 'react'

// 인콜카드 타임스탬프 — 누가·언제·무엇을 했는지 시간 역순으로 보여준다 (영업팀·관리팀·대표 공통)
export interface StampEntry { at: string; by: string; role: string; action: string; detail?: string; n?: number; src?: string }

const ROLE: Record<string, string> = { sales: '영업', ops: '관리', ceo: '대표', dig: '발굴' }
const ROLE_CLS: Record<string, string> = { sales: 'bg-blue-100 text-blue-700', ops: 'bg-violet-100 text-violet-700', ceo: 'bg-amber-100 text-amber-700', dig: 'bg-orange-100 text-orange-700' }

function fmt(iso: string) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return p.replace(/\. /g, '.').replace(/\.$/, '')
}

export default function ActivityStamps({ entries, defaultOpen = false }: { entries: StampEntry[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const list = [...(entries || [])].sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
  return (
    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between">
        <span className="text-[10px] font-bold text-blue-700">타임스탬프 <span className="font-normal text-gray-400">· 누가 언제 무엇을 했는지 ({list.length})</span></span>
        <span className="text-[10px] text-gray-400">{open ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>
      {open && (
        list.length === 0 ? (
          <p className="text-[11px] text-gray-300 italic text-center py-3">아직 기록이 없습니다 (이 기능이 켜진 뒤의 행위부터 남습니다)</p>
        ) : (
          <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-gray-50">
            {list.map((e, i) => (
              <div key={i} className="py-1.5 flex items-start gap-2">
                <span className="font-mono text-[9.5px] text-gray-400 shrink-0 w-[92px] pt-px">{fmt(e.at)}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${ROLE_CLS[e.role] || 'bg-gray-100 text-gray-600'}`}>{ROLE[e.role] || e.role} {e.by}</span>
                <span className="text-[11px] text-gray-700 min-w-0">
                  <b className="font-semibold">{e.action}</b>{e.n && e.n > 1 ? <span className="text-gray-400"> ×{e.n}</span> : null}
                  {e.detail ? <span className="text-gray-500"> · {e.detail}</span> : null}
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
