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
  gcal_label?: string
}

interface GcalEntry {
  id: string
  color: string
  label: string
}

const COLORS = [
  { key: 'blue',   bg: 'bg-blue-500',    light: 'bg-blue-100 text-blue-700' },
  { key: 'red',    bg: 'bg-red-500',     light: 'bg-red-100 text-red-700' },
  { key: 'green',  bg: 'bg-emerald-500', light: 'bg-emerald-100 text-emerald-700' },
  { key: 'amber',  bg: 'bg-amber-400',   light: 'bg-amber-100 text-amber-700' },
  { key: 'violet', bg: 'bg-violet-500',  light: 'bg-violet-100 text-violet-700' },
  { key: 'pink',   bg: 'bg-pink-500',    light: 'bg-pink-100 text-pink-700' },
  { key: 'gray',   bg: 'bg-gray-400',    light: 'bg-gray-100 text-gray-700' },
]

const KO_DAYS = ['월', '화', '수', '목', '금', '토', '일']
const KO_MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function dot(color: string) { return COLORS.find(c => c.key === color)?.bg || 'bg-blue-500' }
function chip(color: string) { return COLORS.find(c => c.key === color)?.light || 'bg-blue-100 text-blue-700' }

export default function CalendarTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showGcal, setShowGcal] = useState(false)
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [autoSyncing, setAutoSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  // 이벤트 추가 폼
  const [form, setForm] = useState({
    title: '', start_date: '', end_date: '',
    start_time: '', end_time: '',
    description: '', color: 'blue', is_allday: true,
  })

  // Google 캘린더 설정 (여러 개)
  const [apiKey, setApiKey] = useState('')
  const [gcalList, setGcalList] = useState<GcalEntry[]>([
    { id: '', color: 'green', label: '회사 캘린더' },
  ])
  const [gcalSaved, setGcalSaved] = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/events?year=${year}&month=${month}`)
    const data = await res.json()
    setEvents(data.events || [])
    setLoading(false)
  }

  // 마운트 시 저장된 설정 불러오고 자동 동기화
  useEffect(() => {
    async function init() {
      const res = await fetch('/api/settings')
      const data = await res.json()
      if (data.settings?.api_key) {
        setApiKey(data.settings.api_key)
        setGcalList(data.settings.calendars || [{ id: '', color: 'green', label: '회사 캘린더' }])
        setGcalSaved(true)
        // 자동 동기화
        setAutoSyncing(true)
        await fetch('/api/events/gcal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendars: data.settings.calendars, api_key: data.settings.api_key }),
        })
        setAutoSyncing(false)
      }
    }
    init()
  }, [])

  useEffect(() => { load() }, [year, month])

  // 자동 동기화 끝나면 다시 로드
  useEffect(() => {
    if (!autoSyncing) load()
  }, [autoSyncing])

  async function submitEvent(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm({ title: '', start_date: '', end_date: '', start_time: '', end_time: '', description: '', color: 'blue', is_allday: true })
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
    const validCals = gcalList.filter(c => c.id.trim())
    if (!apiKey || validCals.length === 0) return alert('API 키와 캘린더 ID를 입력하세요')
    setSyncing(true)
    setSyncMsg('')

    // 설정 저장
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, calendars: gcalList }),
    })
    setGcalSaved(true)

    const res = await fetch('/api/events/gcal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendars: gcalList, api_key: apiKey }),
    })
    const data = await res.json()
    if (res.ok) {
      setSyncMsg(`✅ ${data.synced}개 동기화 완료${data.errors ? ' (일부 오류: ' + data.errors.join(', ') + ')' : ''}`)
      load()
    } else {
      setSyncMsg(`❌ ${data.error}`)
    }
    setSyncing(false)
  }

  // ── 캘린더 그리드 (월요일 시작) ──────────────────────
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const totalDays = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const todayStr = new Date().toISOString().slice(0, 10)
  function ds(day: number) {
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }
  function eventsForDay(day: number) {
    const d = ds(day)
    return events.filter(e => e.start_date <= d && e.end_date >= d)
  }

  function prevMonth() { month === 1 ? (setYear(y=>y-1), setMonth(12)) : setMonth(m=>m-1) }
  function nextMonth() { month === 12 ? (setYear(y=>y+1), setMonth(1)) : setMonth(m=>m+1) }

  const upcoming = events
    .filter(e => e.start_date >= todayStr)
    .sort((a,b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 8)

  return (
    <div className="space-y-4 pb-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 text-lg">‹</button>
          <h2 className="text-lg font-black text-gray-900">{year}년 {KO_MONTHS[month-1]}</h2>
          <button onClick={nextMonth} className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-gray-600 text-lg">›</button>
          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()+1) }}
            className="text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">오늘</button>
          {autoSyncing && (
            <span className="text-xs text-emerald-600 flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
              구글 캘린더 동기화 중...
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowGcal(!showGcal)}
            className={`flex items-center gap-1.5 text-xs border px-3 py-2 rounded-lg transition-colors ${
              gcalSaved ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600'
            }`}>
            🗓 {gcalSaved ? 'Google 연동됨 ✓' : 'Google 캘린더 연동'}
          </button>
          <button onClick={() => { setForm(f=>({...f, start_date:todayStr, end_date:todayStr})); setShowForm(true) }}
            className="flex items-center gap-1.5 text-xs bg-gray-900 text-white px-3 py-2 rounded-lg hover:bg-gray-700">
            + 일정 추가
          </button>
        </div>
      </div>

      {/* Google 캘린더 연동 패널 */}
      {showGcal && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">🗓 Google 캘린더 설정</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">여러 캘린더 동시 연동 가능</span>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Google Calendar API Key</label>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="AIza..." />
          </div>

          {/* 캘린더 목록 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-medium">캘린더 목록</label>
              <button type="button"
                onClick={() => setGcalList(p => [...p, { id: '', color: 'pink', label: '개인 캘린더' }])}
                className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-lg hover:bg-blue-100">
                + 캘린더 추가
              </button>
            </div>
            {gcalList.map((cal, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                <input value={cal.label} onChange={e => setGcalList(p => p.map((c,j)=>j===i?{...c,label:e.target.value}:c))}
                  className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="이름" />
                <input value={cal.id} onChange={e => setGcalList(p => p.map((c,j)=>j===i?{...c,id:e.target.value}:c))}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="캘린더 ID (예: name@gmail.com)" />
                <div className="flex gap-1">
                  {COLORS.map(c => (
                    <button key={c.key} type="button" onClick={() => setGcalList(p => p.map((ci,j)=>j===i?{...ci,color:c.key}:ci))}
                      className={`w-5 h-5 rounded-full ${c.bg} transition-transform ${cal.color===c.key?'scale-125 ring-2 ring-offset-1 ring-gray-400':'hover:scale-110'}`} />
                  ))}
                </div>
                {gcalList.length > 1 && (
                  <button onClick={() => setGcalList(p => p.filter((_,j)=>j!==i))}
                    className="text-red-400 hover:text-red-600 text-xs">✕</button>
                )}
              </div>
            ))}
          </div>

          {syncMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${syncMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {syncMsg}
            </p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              캘린더는 <span className="text-gray-600 font-medium">공개로 설정</span>되어 있어야 동기화됩니다
            </p>
            <button onClick={syncGcal} disabled={syncing}
              className="bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
              {syncing ? '동기화 중...' : '동기화 저장'}
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
            <input required value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="일정 제목" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">시작일 *</label>
              <input type="date" required value={form.start_date}
                onChange={e => setForm(p=>({...p,start_date:e.target.value,end_date:e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">종료일</label>
              <input type="date" value={form.end_date} onChange={e => setForm(p=>({...p,end_date:e.target.value}))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setForm(p=>({...p,is_allday:!p.is_allday}))}
              className={`w-10 h-5 rounded-full transition-colors relative ${form.is_allday?'bg-blue-500':'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${form.is_allday?'left-5':'left-0.5'}`} />
            </button>
            <span className="text-xs text-gray-600">종일 일정</span>
          </div>
          {!form.is_allday && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">시작 시간</label>
                <input type="time" value={form.start_time} onChange={e => setForm(p=>({...p,start_time:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">종료 시간</label>
                <input type="time" value={form.end_time} onChange={e => setForm(p=>({...p,end_time:e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">메모</label>
            <textarea value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))}
              rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">색상</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c.key} type="button" onClick={() => setForm(p=>({...p,color:c.key}))}
                  className={`w-7 h-7 rounded-full ${c.bg} transition-transform ${form.color===c.key?'scale-125 ring-2 ring-offset-1 ring-gray-400':'hover:scale-110'}`} />
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

      {/* 캘린더 그리드 + 사이드 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-gray-100">
            {KO_DAYS.map((d,i) => (
              <div key={d} className={`py-2.5 text-center text-xs font-semibold ${
                i===5?'text-blue-500':i===6?'text-red-500':'text-gray-500'
              }`}>{d}</div>
            ))}
          </div>
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">불러오는 중...</div>
          ) : (
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} className="min-h-[90px] border-b border-r border-gray-50 bg-gray-50/30" />
                const d = ds(day)
                const dayEvs = eventsForDay(day)
                const isToday = d === todayStr
                const dow = idx % 7
                return (
                  <div key={idx}
                    onClick={() => { setForm(f=>({...f,start_date:d,end_date:d})); setShowForm(true) }}
                    className="min-h-[90px] border-b border-r border-gray-50 p-1.5 cursor-pointer hover:bg-blue-50/20 transition-colors">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold mb-1 ${
                      isToday?'bg-gray-900 text-white':
                      dow===5?'text-blue-500':dow===6?'text-red-500':'text-gray-700'
                    }`}>{day}</div>
                    <div className="space-y-0.5">
                      {dayEvs.slice(0,3).map(ev => (
                        <div key={ev.id}
                          onClick={e => { e.stopPropagation(); setDetailEvent(ev) }}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium truncate cursor-pointer hover:opacity-80 ${chip(ev.color)}`}>
                          {!ev.is_allday && ev.start_time && <span className="opacity-50 mr-0.5">{ev.start_time.slice(0,5)}</span>}
                          {ev.source==='google' && <span className="opacity-40 mr-0.5">G</span>}
                          {ev.title}
                        </div>
                      ))}
                      {dayEvs.length > 3 && <p className="text-[10px] text-gray-400 pl-1">+{dayEvs.length-3}개</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 사이드 패널 */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500">다가오는 일정</p>
            </div>
            {upcoming.length === 0 ? (
              <div className="p-5 text-center text-gray-400 text-xs">예정된 일정 없음</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcoming.map(ev => (
                  <button key={ev.id} onClick={() => setDetailEvent(ev)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dot(ev.color)}`} />
                      <span className="text-xs font-medium text-gray-800 truncate">{ev.title}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 pl-4">
                      {ev.start_date}{!ev.is_allday && ev.start_time && ` ${ev.start_time.slice(0,5)}`}
                      {ev.source==='google' && ' 🗓'}
                      {ev.gcal_label && <span className="ml-1 opacity-60">({ev.gcal_label})</span>}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 범례 */}
          {gcalSaved && gcalList.filter(c=>c.id).length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">연동된 캘린더</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />직접 추가 일정
                </div>
                {gcalList.filter(c=>c.id).map((c,i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className={`w-2 h-2 rounded-full ${dot(c.color)}`} />{c.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상세 모달 */}
      {detailEvent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={() => setDetailEvent(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${dot(detailEvent.color)}`} />
                <h3 className="font-bold text-gray-900">{detailEvent.title}</h3>
              </div>
              <button onClick={() => setDetailEvent(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">📅</span>
                <span>{detailEvent.start_date}{detailEvent.end_date!==detailEvent.start_date&&` ~ ${detailEvent.end_date}`}</span>
              </div>
              {!detailEvent.is_allday && detailEvent.start_time && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">⏰</span>
                  <span>{detailEvent.start_time.slice(0,5)}{detailEvent.end_time&&` ~ ${detailEvent.end_time.slice(0,5)}`}</span>
                </div>
              )}
              {detailEvent.source==='google' && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">🗓</span>
                  <span className="text-emerald-600 text-xs font-medium">
                    Google 캘린더{detailEvent.gcal_label&&` · ${detailEvent.gcal_label}`}
                  </span>
                </div>
              )}
              {detailEvent.description && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs leading-relaxed">{detailEvent.description}</div>
              )}
            </div>
            {detailEvent.source==='local' && (
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
