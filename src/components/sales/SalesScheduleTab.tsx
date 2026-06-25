'use client'

import { useState, useMemo } from 'react'

interface CalendarEvent {
  date: string        // YYYY-MM-DD
  time?: string       // HH:MM
  type: 'recall' | 'meeting'
  company: string
  memo?: string
  customerId?: string
}

const TYPE_STYLE = {
  recall:  { dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700',   label: '재통화' },
  meeting: { dot: 'bg-violet-400', badge: 'bg-violet-100 text-violet-700', label: '미팅' },
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=일
}

export default function SalesScheduleTab({
  customers,
}: {
  customers: any[]
}) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // 고객 데이터에서 이벤트 추출
  const events = useMemo<CalendarEvent[]>(() => {
    const list: CalendarEvent[] = []
    for (const c of customers) {
      const d = c.details || {}
      const company = d.company || c.name || '—'
      // 재통화
      if (d.callback_date) {
        list.push({
          date: d.callback_date,
          time: d.callback_time || undefined,
          type: 'recall',
          company,
          customerId: c.id,
        })
      }
      // 미팅
      if (d.meeting_date) {
        list.push({
          date: d.meeting_date,
          time: d.meeting_time || undefined,
          type: 'meeting',
          company,
          memo: d.meeting_memo || undefined,
          customerId: c.id,
        })
      }
    }
    return list.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
  }, [customers])

  // 날짜별 이벤트 맵
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
  const todayStr = today.toISOString().slice(0, 10)

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
  function toToday() {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDate(todayStr)
  }

  const selectedEvents = selectedDate ? (eventMap[selectedDate] || []) : []

  // 이번달 이벤트 수
  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthEvents = events.filter(e => e.date.startsWith(monthKey))

  return (
    <div className="space-y-3 pb-8">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-sky-700 rounded-xl px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">일정 캘린더</h2>
            <p className="text-white/50 text-[11px] mt-0.5">
              이번달 재통화 {monthEvents.filter(e => e.type === 'recall').length}건 · 미팅 {monthEvents.filter(e => e.type === 'meeting').length}건
            </p>
          </div>
          <button onClick={toToday} className="text-xs bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-lg transition-colors">오늘</button>
        </div>
      </div>

      {/* 캘린더 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">‹</button>
          <span className="font-bold text-[#1B2A45] text-sm">{viewYear}년 {viewMonth + 1}월</span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">›</button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {['일','월','화','수','목','금','토'].map((d, i) => (
            <div key={d} className={`text-center text-[11px] font-bold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {/* 앞 빈칸 */}
          {Array.from({ length: firstDow }).map((_, i) => (
            <div key={`empty-${i}`} className="h-14 border-b border-r border-gray-50" />
          ))}
          {/* 날짜 셀 */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dow = (firstDow + i) % 7
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate
            const dayEvents = eventMap[dateStr] || []
            const hasRecall = dayEvents.some(e => e.type === 'recall')
            const hasMeeting = dayEvents.some(e => e.type === 'meeting')

            return (
              <div
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`h-14 border-b border-r border-gray-50 p-1 cursor-pointer transition-colors ${
                  isSelected ? 'bg-violet-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-bold mb-0.5 mx-auto ${
                  isToday ? 'bg-[#1B2A45] text-white' :
                  dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-700'
                }`}>{day}</div>
                {/* 이벤트 도트 */}
                <div className="flex justify-center gap-0.5">
                  {hasRecall && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />}
                  {hasMeeting && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 선택된 날짜 이벤트 */}
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
              {selectedEvents
                .sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'))
                .map((e, i) => {
                const s = TYPE_STYLE[e.type]
                return (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${s.badge}`}>{s.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{e.company}</p>
                      {e.memo && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{e.memo}</p>}
                    </div>
                    {e.time && <span className="shrink-0 text-[11px] font-bold text-gray-500">{e.time}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 이번달 전체 일정 목록 */}
      {monthEvents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500">{viewMonth + 1}월 전체 일정</p>
          </div>
          <div className="divide-y divide-gray-50">
            {monthEvents.map((e, i) => {
              const s = TYPE_STYLE[e.type]
              return (
                <div key={i}
                  onClick={() => setSelectedDate(e.date)}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                  <span className="shrink-0 text-[11px] font-bold text-gray-400 w-10">{e.date.slice(5).replace('-', '/')}</span>
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.badge}`}>{s.label}</span>
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
