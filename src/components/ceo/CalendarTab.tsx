'use client'

import { useState, useEffect } from 'react'

interface CalEvent {
  id: string
  title: string
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  description: string
  color: string
  is_allday: boolean
  source: 'local' | 'google'
}

const COLORS = [
  { key: 'blue',   label: '파랑',  bg: 'bg-blue-500',   light: 'bg-blue-100 text-blue-700' },
  { key: 'red',    label: '빨강',  bg: 'bg-red-500',    light: 'bg-red-100 text-red-700' },
  { key: 'green',  label: '초록',  bg: 'bg-emerald-500',light: 'bg-emerald-100 text-emerald-700' },
  { key: 'amber',  label: '노랑',  bg: 'bg-amber-400',  light: 'bg-amber-100 text-amber-700' },
  { key: 'violet', label: '보라',  bg: 'bg-violet-500', light: 'bg-violet-100 text-violet-700' },
  { key: 'gray',   label: '회색',  bg: 'bg-gray-400',   light: 'bg-gray-100 text-gray-700' },
]

const KO_DAYS = ['월', '화', '수', '목', '금', '토', '일']
const KO_MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function getColorClass(color: string, type: 'light' | 'dot') {
  const found = COLORS.find(c => c.key === color)
  if (type === 'dot') return found?.bg || 'bg-blue-500'
  return found?.light || 'bg-blue-100 text-blue-700'
}

export default function CalendarTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showGcal, setShowGcal] = useState(false)
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState('')

  // 폼 상태
  const [form, setForm] = useState({
    title: '', start_date: '', end_date: '', start_time: '', end_time: '',
    description: '', color: 'blue', is_allday: true,
  })

  // Google Calendar 설정
  const [gcalId, setGcalId] = useState('')
  const [gcalKey, setGcalKey] = useState('')
  const [gcalSaved, setGcalSaved] = useState(false)
  const [autoSyncing, setAutoSyncing] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/events?year=${year}&month=${month}`)
    const data = await res.json()
    setEvents(data.events || [])
    setLoading(false)
  }

  // 저장된 구글 캘린더 설정 불러오기 + 자동 동기화
  useEffect(() => {
    async function initGcal() {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.settings?.gcal_id && data.settings?.api_key) {
        setGcalId(data.settings.gcal_id)
        setGcalKey(data.settings.api_key)
        setGcalSaved(true)
        // 탭 열릴 때 자동 동기화
        setAutoSyncing(true)
        await fetch('/api/events/gcal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendar_id: data.settings.gcal_id, api_key: data.settings.api_key }),
        })
        setAutoSyncing(false)
      }
    }
    initGcal()
  }, [])

  useEffect(() => { load() }, [year, month, autoSyncing])

  async function submitEvent(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ title: '', start_date: selectedDate || '', end_date: '', start_time: '', end_time: '', description: '', color: 'blue', is_allday: true })
    load()
  }

  async function deleteEvent(id: string) {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return
    await fetch('/api/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDetailEvent(null)
    load()
  }

  async function syncGcal() {
    if (!gcalId || !gcalKey) return alert('캘린더 ID와 API 키를 입력하세요')
    setSyncing(true)
    setSyncResult('')

    // 설정 저장 (이후 자동 동기화에 사용)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gcal_id: gcalId, api_key: gcalKey }),
    })
    setGcalSaved(true)

    const res = await fetch('/api/events/gcal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendar_id: gcalId, api_key: gcalKey }),
    })
    const data = await res.json()
    if (res.ok) {
      setSyncResult(`✅ ${data.synced}개 동기화 완료 · 이제 탭 열 때마다 자동 동기화됩니다`)
      load()
    } else {
      setSyncResult(`❌ ${data.error}`)
    }
    setSyncing(false)
  }

  // ── 캘린더 그리드 계산 (월요일 시작) ──────────────────
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // 0=월 ~ 6=일
  const totalDays = lastDay.getDate()

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  // 6주 맞추기
  while (cells.length % 7 !== 0) cells.push(null)

  function dateStr(day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function eventsForDay(day: number) {
    const d = dateStr(day)
    return events.filter(e => e.start_date <= d && e.end_date >= d)
  }

  const todayStr = new Date().toISOString().slice(0, 10)

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // 이번달 일정 목록 (날짜순)
  const upcomingEvents = events
    .filter(e => e.start_date >= todayStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 10)

  return (
    <div className="space-y-4 pb-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600">‹</button>
          <h2 className="text-lg font-black text-gray-900">{year}년 {KO_MONTHS[month - 1]}</h2>
          <button onClick={nextMonth} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600">›</button>
          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1) }}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">오늘</button>
          {autoSyncing && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
              Google 캘린더 동기화 중...
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGcal(!showGcal)}
            className={`flex items-center gap-1.5 text-xs border px-3 py-2 rounded-lg transition-colors ${
              gcalSaved
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}>
            <span>🗓</span>
            {gcalSaved ? 'Google 연동됨 ✓' : 'Google 캘린더 연동'}
          </button>
          <button
            onClick={() => {
              setForm(f => ({ ...f, start_date: todayStr, end_date: todayStr }))
              setShowForm(true)
            }}
            className="flex items-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-700">
            + 일정 추가
          </button>
        </div>
      </div>

      {/* Google 캘린더 연동 패널 */}
      {showGcal && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-800">🗓 Google 캘린더 동기화</span>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">읽기 전용</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">캘린더 ID</label>
              <input value={gcalId} onChange={e => setGcalId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="예: yourname@gmail.com" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Google Calendar API Key</label>
              <input value={gcalKey} onChange={e => setGcalKey(e.target.value)} type="password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                placeholder="AIza..." />
            </div>
          </div>
          {syncResult && (
            <p className={`text-sm px-3 py-2 rounded-lg ${syncResult.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {syncResult}
            </p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              API 키 발급: <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-blue-500 underline">Google Cloud Console</a> → API 및 서비스 → 사용자 인증 정보
            </p>
            <button onClick={syncGcal} disabled={syncing}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
              {syncing ? '동기화 중...' : '지금 동기화'}
            </button>
          </div>
        </div>
      )}

      {/* 일정 추가 폼 */}
      {showForm && (
        <form onSubmit={submitEvent} className="bg-white rounded-xl border border-blue-100 p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-800 text-sm">새 일정 추가</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700">✕</button>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">제목 *</label>
            <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="일정 제목" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">시작일 *</label>
              <input type="date" required value={form.start_date}
                onChange={e => setForm(p => ({ ...p, start_date: e.target.value, end_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">종료일</label>
              <input type="date" value={form.end_date}
                onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* 종일 토글 */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setForm(p => ({ ...p, is_allday: !p.is_allday }))}
              className={`w-10 h-5 rounded-full transition-colors relative ${form.is_allday ? 'bg-blue-500' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.is_allday ? 'left-5' : 'left-0.5'}`} />
            </button>
            <span className="text-xs text-gray-600">종일 일정</span>
          </div>

          {!form.is_allday && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">시작 시간</label>
                <input type="time" value={form.start_time}
                  onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">종료 시간</label>
                <input type="time" value={form.end_time}
                  onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 mb-1 block">메모</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="일정 메모" />
          </div>

          {/* 색상 선택 */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">색상</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c.key} type="button" onClick={() => setForm(p => ({ ...p, color: c.key }))}
                  className={`w-7 h-7 rounded-full ${c.bg} transition-transform ${form.color === c.key ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`} />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">취소</button>
            <button type="submit"
              className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700">저장</button>
          </div>
        </form>
      )}

      {/* 캘린더 그리드 + 일정 목록 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 캘린더 */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {KO_DAYS.map((d, i) => (
              <div key={d} className={`py-2.5 text-center text-xs font-semibold ${
                i === 5 ? 'text-blue-500' : i === 6 ? 'text-red-500' : 'text-gray-500'
              }`}>{d}</div>
            ))}
          </div>

          {/* 날짜 셀 */}
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">불러오는 중...</div>
          ) : (
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} className="min-h-[88px] border-b border-r border-gray-50 bg-gray-50/50" />
                const d = dateStr(day)
                const dayEvents = eventsForDay(day)
                const isToday = d === todayStr
                const dow = idx % 7 // 0=월
                const isSat = dow === 5
                const isSun = dow === 6

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedDate(d)
                      setForm(f => ({ ...f, start_date: d, end_date: d }))
                      setShowForm(true)
                    }}
                    className="min-h-[88px] border-b border-r border-gray-50 p-1.5 cursor-pointer hover:bg-blue-50/30 transition-colors group"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 ${
                      isToday ? 'bg-gray-900 text-white' :
                      isSat ? 'text-blue-500' :
                      isSun ? 'text-red-500' :
                      'text-gray-700 group-hover:text-gray-900'
                    }`}>{day}</div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(ev => (
                        <div
                          key={ev.id}
                          onClick={e => { e.stopPropagation(); setDetailEvent(ev) }}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate cursor-pointer hover:opacity-80 ${getColorClass(ev.color, 'light')}`}
                        >
                          {!ev.is_allday && ev.start_time && <span className="opacity-60 mr-0.5">{ev.start_time.slice(0, 5)}</span>}
                          {ev.source === 'google' && <span className="opacity-50 mr-0.5">G</span>}
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-gray-400 pl-1">+{dayEvents.length - 3}개</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 다가오는 일정 */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500">다가오는 일정</p>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="p-5 text-center text-gray-400 text-xs">예정된 일정 없음</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingEvents.map(ev => (
                  <button key={ev.id} onClick={() => setDetailEvent(ev)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getColorClass(ev.color, 'dot')}`} />
                      <span className="text-xs font-medium text-gray-800 truncate">{ev.title}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 pl-4">
                      {ev.start_date}
                      {!ev.is_allday && ev.start_time && ` ${ev.start_time.slice(0,5)}`}
                      {ev.source === 'google' && ' 🗓'}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 범례 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2">범례</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-2 h-2 rounded-full bg-gray-400" />직접 추가 일정
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />Google 캘린더
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 일정 상세 모달 */}
      {detailEvent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => setDetailEvent(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${getColorClass(detailEvent.color, 'dot')}`} />
                <h3 className="font-bold text-gray-900">{detailEvent.title}</h3>
              </div>
              <button onClick={() => setDetailEvent(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">📅</span>
                <span>
                  {detailEvent.start_date}
                  {detailEvent.end_date !== detailEvent.start_date && ` ~ ${detailEvent.end_date}`}
                </span>
              </div>
              {!detailEvent.is_allday && detailEvent.start_time && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">⏰</span>
                  <span>{detailEvent.start_time?.slice(0,5)}{detailEvent.end_time && ` ~ ${detailEvent.end_time.slice(0,5)}`}</span>
                </div>
              )}
              {detailEvent.source === 'google' && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">🗓</span>
                  <span className="text-emerald-600 text-xs font-medium">Google 캘린더</span>
                </div>
              )}
              {detailEvent.description && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
                  {detailEvent.description}
                </div>
              )}
            </div>

            {detailEvent.source === 'local' && (
              <button onClick={() => deleteEvent(detailEvent.id)}
                className="mt-4 w-full text-red-400 hover:text-red-600 text-sm border border-red-100 hover:border-red-200 py-2 rounded-lg transition-colors">
                일정 삭제
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
