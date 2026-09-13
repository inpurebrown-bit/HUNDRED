'use client'

import { useState, useMemo } from 'react'

interface CalendarEvent {
  date: string
  time?: string
  type: 'recall' | 'meeting' | 'dig_callback'
  company: string
  memo?: string
  customerId?: string
  digProspectId?: string
  ceoName?: string
  phone?: string
  preferredCallTime?: string  // ISO datetime (full) for dig_callback events
}

const TYPE_STYLE = {
  recall:       { chip: 'bg-blue-100 text-blue-700',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400',   label: '재통화' },
  meeting:      { chip: 'bg-violet-100 text-violet-700', badge: 'bg-violet-100 text-violet-700', dot: 'bg-violet-400', label: '미팅' },
  dig_callback: { chip: 'bg-emerald-100 text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400', label: '발굴배정' },
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

// ISO datetime → "2026-09-14" + "14:30"
function parseIsoToDateAndTime(iso: string): { date: string; time: string } | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    const kst = d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
    const date = kst.slice(0, 10)
    const time = kst.slice(11, 16)
    return { date, time }
  } catch { return null }
}

// Google Calendar 이벤트 URL 생성
function makeGCalUrl(event: CalendarEvent): string {
  const isoStr = event.preferredCallTime || ''
  const dt = parseIsoToDateAndTime(isoStr)
  if (!dt) return ''
  // Google Calendar는 UTC 기준 YYYYMMDDTHHmmssZ 포맷
  const start = new Date(isoStr)
  const end   = new Date(start.getTime() + 60 * 60 * 1000) // +1시간
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const title = encodeURIComponent(`[발굴배정] ${event.company} ${event.ceoName ? '(' + event.ceoName + ')' : ''} 재통화`)
  const detail = encodeURIComponent(`연락처: ${event.phone || '-'}\n${event.memo || ''}`)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${detail}`
}

export default function SalesScheduleTab({ customers, digProspects = [] }: { customers: any[]; digProspects?: any[] }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = []

    // 기존 영업 고객 이벤트
    for (const c of customers) {
      const d = c.details || {}
      const company = d.company || c.name || '—'
      const recallDate = d.callback_date || d.follow_up_date
      const recallTime = d.callback_time || d.follow_up_time
      if (recallDate) {
        list.push({ date: recallDate, time: recallTime || undefined, type: 'recall', company, customerId: c.id })
      }
      if (d.meeting_date) {
        list.push({ date: d.meeting_date, time: d.meeting_time || undefined, type: 'meeting', company, memo: d.meeting_memo || undefined, customerId: c.id })
      }
    }

    // 발굴팀 배정 건 (preferred_call_time이 ISO datetime인 경우)
    for (const p of digProspects) {
      if (!p.preferred_call_time) continue
      const parsed = parseIsoToDateAndTime(p.preferred_call_time)
      if (!parsed) continue
      list.push({
        date: parsed.date,
        time: parsed.time,
        type: 'dig_callback',
        company: p.company || '—',
        ceoName: p.ceo_name,
        phone: p.phone_010,
        memo: `발굴팀 배정 재통화`,
        digProspectId: p.id,
        preferredCallTime: p.preferred_call_time,
      })
    }

    return list.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  }, [customers, digProspects])

  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const e of events) {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    return map
  }, [events])

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDow = getFirstDayOfWeek(viewYear, viewMonth)
  const todayStr = today.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10)
  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthEvents = events.filter(e => e.date.startsWith(monthKey))
  const digCallbackCount = monthEvents.filter(e => e.type === 'dig_callback').length

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedDate(null)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelectedDate(null)
  }

  const selectedEvents = selectedDate ? (eventMap[selectedDate] || []) : []

  return (
    <div className="space-y-3 pb-8">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-sky-700 rounded-xl px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">일정 캘린더</h2>
          <p className="text-white/50 text-[11px] mt-0.5">
            재통화 {monthEvents.filter(e => e.type === 'recall').length}건 · 미팅 {monthEvents.filter(e => e.type === 'meeting').length}건
            {digCallbackCount > 0 && ` · 발굴배정 ${digCallbackCount}건`}
          </p>
        </div>
        <button onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelectedDate(todayStr) }}
          className="text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors">오늘</button>
      </div>

      {/* 캘린더 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">‹</button>
          <span className="font-bold text-[#1B2A45] text-sm">{viewYear}년 {viewMonth + 1}월</span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500">›</button>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-100">
          {['일','월','화','수','목','금','토'].map((d, i) => (
            <div key={d} className={`text-center text-[11px] font-bold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`e${i}`} className="border-b border-r border-gray-50 min-h-[60px]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dow = (firstDow + i) % 7
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const dayEvents = (eventMap[dateStr] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
            const shown = dayEvents.slice(0, 3)
            const extra = dayEvents.length - shown.length

            return (
              <div
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`border-b border-r border-gray-50 p-1 cursor-pointer transition-colors min-h-[60px] ${
                  isSelected ? 'bg-violet-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-5 h-5 flex items-center justify-center rounded-full text-[11px] font-bold mb-0.5 ${
                  isToday ? 'bg-[#1B2A45] text-white' :
                  dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-700'
                }`}>{day}</div>

                <div className="space-y-0.5">
                  {shown.map((e, ei) => {
                    const s = TYPE_STYLE[e.type]
                    return (
                      <div key={ei} className={`rounded px-1 py-0.5 ${s.chip} leading-tight`}>
                        <p className="text-[9px] font-bold truncate">{e.company}</p>
                        {e.time && <p className="text-[8px] opacity-70">{e.time}</p>}
                      </div>
                    )
                  })}
                  {extra > 0 && (
                    <p className="text-[8px] text-gray-400 pl-1">+{extra}건</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 선택 날짜 상세 */}
      {selectedDate && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-bold text-[#1B2A45]">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </p>
            <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>
          {selectedEvents.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">이 날 일정이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {[...selectedEvents].sort((a, b) => (a.time || '').localeCompare(b.time || '')).map((e, i) => {
                const s = TYPE_STYLE[e.type]
                const gcalUrl = e.type === 'dig_callback' ? makeGCalUrl(e) : ''
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{e.company}</p>
                        {e.ceoName && <p className="text-[11px] text-gray-500">{e.ceoName} · {e.phone || '-'}</p>}
                        {e.memo && !e.ceoName && <p className="text-[11px] text-gray-400 truncate">{e.memo}</p>}
                      </div>
                      {e.time && <span className="text-[11px] font-bold text-gray-500 shrink-0">{e.time}</span>}
                    </div>
                    {gcalUrl && (
                      <a href={gcalUrl} target="_blank" rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold hover:underline">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>
                        구글 캘린더에 추가
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 이번달 전체 목록 */}
      {monthEvents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500">{viewMonth + 1}월 전체 일정</p>
          </div>
          <div className="divide-y divide-gray-50">
            {monthEvents.map((e, i) => {
              const s = TYPE_STYLE[e.type]
              return (
                <div key={i} onClick={() => setSelectedDate(e.date)}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                  <span className="text-[11px] font-bold text-gray-400 w-10 shrink-0">{e.date.slice(5).replace('-', '/')}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${s.badge}`}>{s.label}</span>
                  <p className="flex-1 text-sm text-gray-700 truncate">{e.company}</p>
                  {e.time && <span className="text-[11px] text-gray-400 shrink-0">{e.time}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
