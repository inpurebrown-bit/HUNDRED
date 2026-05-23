'use client'

import { useState, useEffect, FormEvent } from 'react'

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

interface MonthlyExpense {
  day: number
  label: string
  amount: number | null
}

const DEFAULT_EXPENSES: MonthlyExpense[] = [
  { day: 1,  label: '아빠한테 카드값 고지하기', amount: null },
  { day: 10, label: '직원 월급',                amount: null },
  { day: 11, label: '소진공 이자(기업)',          amount: -114000 },
  { day: 16, label: '사무실 임대료 납부',         amount: -1045000 },
  { day: 18, label: '서민금 이자(기업)',          amount: -420000 },
  { day: 19, label: '집월세 납부',               amount: -650000 },
  { day: 20, label: '재단 이자(신한)',            amount: -49000 },
  { day: 22, label: '삼성카드결제',              amount: -2500000 },
]

function fmtAmt(amount: number | null): string {
  if (amount === null || amount === undefined) return ''
  return amount.toLocaleString('ko-KR') + '원'
}

const COLORS = [
  { key: 'blue',   bg: 'bg-blue-500',    light: 'bg-blue-100 text-blue-800',       dot: 'bg-blue-500',    hex: '#3b82f6' },
  { key: 'red',    bg: 'bg-red-500',     light: 'bg-red-100 text-red-800',         dot: 'bg-red-500',     hex: '#ef4444' },
  { key: 'green',  bg: 'bg-emerald-500', light: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500', hex: '#10b981' },
  { key: 'amber',  bg: 'bg-amber-400',   light: 'bg-amber-100 text-amber-800',     dot: 'bg-amber-400',   hex: '#f59e0b' },
  { key: 'violet', bg: 'bg-violet-500',  light: 'bg-violet-100 text-violet-800',   dot: 'bg-violet-500',  hex: '#8b5cf6' },
  { key: 'pink',   bg: 'bg-pink-500',    light: 'bg-pink-100 text-pink-800',       dot: 'bg-pink-500',    hex: '#ec4899' },
  { key: 'gray',   bg: 'bg-gray-400',    light: 'bg-gray-100 text-gray-700',       dot: 'bg-gray-400',    hex: '#9ca3af' },
]
function colorHex(c: string) { return COLORS.find(x => x.key === c)?.hex || '#3b82f6' }

const KO_DAYS = ['일', '월', '화', '수', '목', '금', '토']
const KO_MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

function colorBg(c: string) { return COLORS.find(x => x.key === c)?.bg || 'bg-blue-500' }
function colorLight(c: string) { return COLORS.find(x => x.key === c)?.light || 'bg-blue-100 text-blue-700' }

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}
function formatDate(ds: string) {
  const [y, m, d] = ds.split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}
function getDow(ds: string) {
  return ['일','월','화','수','목','금','토'][new Date(ds).getDay()]
}

export default function CalendarTab() {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string>(todayStr)
  const [showForm, setShowForm] = useState(false)
  const [showGcal, setShowGcal] = useState(false)
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [autoSyncing, setAutoSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const [form, setForm] = useState({
    title: '', start_date: todayStr, end_date: todayStr,
    start_time: '', end_time: '',
    description: '', color: 'blue', is_allday: true,
  })

  const [apiKey, setApiKey] = useState('')
  const [gcalList, setGcalList] = useState<GcalEntry[]>([
    { id: '', color: 'green', label: '회사 캘린더' },
  ])
  const [gcalSaved, setGcalSaved] = useState(false)

  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>(DEFAULT_EXPENSES)
  const [showExpenseMgr, setShowExpenseMgr] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ day: '', label: '', amount: '' })
  const [editingExpIdx, setEditingExpIdx] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/events?year=${year}&month=${month}`)
    const data = await res.json()
    setEvents(data.events || [])
    setLoading(false)
  }

  async function saveExpenses(expenses: MonthlyExpense[]) {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _key: 'monthly_expenses', expenses }),
    })
  }

  useEffect(() => {
    async function init() {
      const [gcalRes, expRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/settings?key=monthly_expenses'),
      ])
      const gcalData = await gcalRes.json()
      const expData = await expRes.json()

      if (gcalData.settings?.api_key) {
        setApiKey(gcalData.settings.api_key)
        setGcalList(gcalData.settings.calendars || [{ id: '', color: 'green', label: '회사 캘린더' }])
        setGcalSaved(true)
        setAutoSyncing(true)
        await fetch('/api/events/gcal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ calendars: gcalData.settings.calendars, api_key: gcalData.settings.api_key }),
        })
        setAutoSyncing(false)
      }

      if (expData.settings?.expenses) {
        setMonthlyExpenses(expData.settings.expenses)
      } else {
        // 첫 로드 시 기본값 저장
        saveExpenses(DEFAULT_EXPENSES)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [year, month])
  useEffect(() => { if (!autoSyncing) load() }, [autoSyncing])

  // ── 브라우저 알림 권한 요청 (최초 1회) ──────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // ── 오늘 일정 요약 알림 (오늘 날짜 최초 1회) ─────────────
  useEffect(() => {
    const todayEvents = events.filter(e => e.start_date <= todayStr && e.end_date >= todayStr)
    if (todayEvents.length === 0) return
    const lsKey = `cal-notif-${todayStr}`
    if (typeof window !== 'undefined' && !localStorage.getItem(lsKey)) {
      localStorage.setItem(lsKey, '1')
      if ('Notification' in window && Notification.permission === 'granted') {
        const titles = todayEvents.slice(0, 3).map(e => {
          const t = e.start_time ? e.start_time.slice(0, 5) + ' ' : ''
          return t + e.title
        }).join(' · ')
        new Notification(`📅 오늘 일정 ${todayEvents.length}건`, { body: titles, tag: 'calendar-today' })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  // ── 이벤트 시작 시간 알림 (1분마다 체크) ────────────────
  useEffect(() => {
    if (!events.length) return
    const interval = setInterval(() => {
      if (typeof window === 'undefined' || !('Notification' in window)) return
      if (Notification.permission !== 'granted') return
      const now = new Date()
      const ds  = now.toISOString().slice(0, 10)
      const hh  = String(now.getHours()).padStart(2, '0')
      const mm  = String(now.getMinutes()).padStart(2, '0')
      const nowTime = `${hh}:${mm}`
      events.filter(e =>
        e.start_date === ds &&
        !e.is_allday &&
        e.start_time?.slice(0, 5) === nowTime
      ).forEach(ev => {
        const key = `cal-notif-ev-${ev.id}-${nowTime}`
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1')
          new Notification(`⏰ 지금 시작: ${ev.title}`, {
            body: ev.description || nowTime,
            tag: `ev-${ev.id}`,
          })
        }
      })
    }, 60_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  async function submitEvent(e: FormEvent) {
    e.preventDefault()
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setShowForm(false)
    setForm(f => ({ ...f, title: '', description: '', start_time: '', end_time: '', is_allday: true }))
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
      setSyncMsg(`✅ ${data.synced}개 동기화 완료`)
      load()
    } else {
      setSyncMsg(`❌ ${data.error}`)
    }
    setSyncing(false)
  }

  // ── 캘린더 계산 (일요일 시작) ──────────────────────────
  const firstDow = new Date(year, month - 1, 1).getDay()  // 일=0
  const totalDays = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function eventsForDay(day: number) {
    const d = toDateStr(year, month, day)
    return events.filter(e => e.start_date <= d && e.end_date >= d)
  }

  function prevMonth() { month === 1 ? (setYear(y => y - 1), setMonth(12)) : setMonth(m => m - 1) }
  function nextMonth() { month === 12 ? (setYear(y => y + 1), setMonth(1)) : setMonth(m => m + 1) }

  // 선택된 날 이벤트
  const selectedEvents = events.filter(e => e.start_date <= selectedDay && e.end_date >= selectedDay)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  const selectedDayNum = parseInt(selectedDay.slice(8), 10)
  const selectedExpenses = monthlyExpenses.filter(e => e.day === selectedDayNum)

  // 이번 달 남은 일정 (오늘 이후) + 고정 지출 합산
  const todayDay = parseInt(todayStr.slice(8), 10)
  const todayMonthStr = todayStr.slice(0, 7)   // 'YYYY-MM'
  const curMonthStr = `${year}-${String(month).padStart(2,'0')}`
  // 고정 지출을 가짜 이벤트로 변환 (이번 보기 달이 오늘 달과 같을 때만 upcoming으로)
  const expenseEvents: CalEvent[] = monthlyExpenses
    .filter(exp => curMonthStr === todayMonthStr ? exp.day >= todayDay : true)
    .map(exp => ({
      id: `__exp__${exp.day}`,
      title: `${exp.label}${exp.amount !== null ? ` (${exp.amount.toLocaleString()}원)` : ''}`,
      start_date: toDateStr(year, month, Math.min(exp.day, new Date(year, month, 0).getDate())),
      end_date:   toDateStr(year, month, Math.min(exp.day, new Date(year, month, 0).getDate())),
      start_time: null, end_time: null,
      description: '',
      color: 'red',
      is_allday: true,
      source: 'local' as const,
    }))

  const upcomingThisMonth = [
    ...events.filter(e => e.start_date >= todayStr),
    ...expenseEvents.filter(e => e.start_date >= todayStr),
  ]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 8)

  function openAddForm(day: string) {
    setForm(f => ({ ...f, title: '', start_date: day, end_date: day, start_time: '', end_time: '', is_allday: true, description: '' }))
    setShowForm(true)
  }

  return (
    <div className="space-y-4 pb-8">
      {/* 헤더 */}
      <div className="bg-[#1B2A45] rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition-colors">
            ‹
          </button>
          <h2 className="text-white font-black text-lg min-w-[100px] text-center">{year}년 {KO_MONTHS[month - 1]}</h2>
          <button onClick={nextMonth}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition-colors">
            ›
          </button>
          <button
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); setSelectedDay(todayStr) }}
            className="text-xs text-white/70 border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
            오늘
          </button>
          {autoSyncing && (
            <span className="text-xs text-emerald-300 flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-emerald-400/50 border-t-emerald-300 rounded-full animate-spin" />
              Google 동기화 중...
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {/* 알림 권한 버튼 — 미허용 시에만 표시 */}
          {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
            <button
              onClick={() => Notification.requestPermission()}
              className="flex items-center gap-1.5 text-xs border border-yellow-400/40 bg-yellow-400/10 text-yellow-300 px-3 py-2 rounded-lg hover:bg-yellow-400/20 transition-colors">
              🔔 알림 켜기
            </button>
          )}
          <button onClick={() => setShowExpenseMgr(!showExpenseMgr)}
            className={`flex items-center gap-1.5 text-xs border px-3 py-2 rounded-lg transition-colors ${
              showExpenseMgr
                ? 'border-red-400/40 bg-red-400/10 text-red-300'
                : 'border-white/20 bg-white/10 text-white/70 hover:bg-white/20'
            }`}>
            💸 고정 지출 관리
          </button>
          <button onClick={() => setShowGcal(!showGcal)}
            className={`flex items-center gap-1.5 text-xs border px-3 py-2 rounded-lg transition-colors ${
              gcalSaved
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                : 'border-white/20 bg-white/10 text-white/70 hover:bg-white/20'
            }`}>
            🗓 {gcalSaved ? 'Google 연동됨 ✓' : 'Google 캘린더 연동'}
          </button>
          <button
            onClick={() => openAddForm(selectedDay)}
            className="flex items-center gap-1.5 text-xs bg-white text-[#1B2A45] font-semibold px-3 py-2 rounded-lg hover:bg-white/90 transition-colors">
            + 일정 추가
          </button>
        </div>
      </div>

      {/* Google 캘린더 연동 패널 */}
      {showGcal && (
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">🗓 Google 캘린더 연동 설정</span>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">설정 방법</p>
            <p>1. <a href="https://console.cloud.google.com" target="_blank" rel="noopener" className="underline">Google Cloud Console</a>에서 API 키 발급</p>
            <p>2. Calendar API 활성화</p>
            <p>3. 연동할 캘린더를 <span className="font-semibold">공개(공개 URL 공유)</span>로 설정</p>
            <p>4. 캘린더 ID 입력 (Gmail 주소 또는 캘린더 설정 → 통합 섹션에서 확인)</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block font-medium">Google Calendar API Key</label>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="AIza..." />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-500 font-medium">연동할 캘린더</label>
              <button type="button"
                onClick={() => setGcalList(p => [...p, { id: '', color: 'pink', label: '캘린더' }])}
                className="text-xs text-blue-600 bg-blue-50 border border-blue-100 px-3 py-1 rounded-lg hover:bg-blue-100">
                + 캘린더 추가
              </button>
            </div>
            {gcalList.map((cal, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                <input value={cal.label}
                  onChange={e => setGcalList(p => p.map((c, j) => j === i ? { ...c, label: e.target.value } : c))}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  placeholder="이름" />
                <input value={cal.id}
                  onChange={e => setGcalList(p => p.map((c, j) => j === i ? { ...c, id: e.target.value } : c))}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  placeholder="캘린더 ID (예: yourname@gmail.com)" />
                <div className="flex gap-1">
                  {COLORS.map(c => (
                    <button key={c.key} type="button"
                      onClick={() => setGcalList(p => p.map((ci, j) => j === i ? { ...ci, color: c.key } : ci))}
                      className={`w-5 h-5 rounded-full ${c.bg} transition-transform ${cal.color === c.key ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`} />
                  ))}
                </div>
                {gcalList.length > 1 && (
                  <button onClick={() => setGcalList(p => p.filter((_, j) => j !== i))}
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
          <div className="flex justify-end">
            <button onClick={syncGcal} disabled={syncing}
              className="bg-[#1B2A45] hover:bg-[#243552] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors">
              {syncing ? '동기화 중...' : '저장 및 동기화'}
            </button>
          </div>
        </div>
      )}

      {/* 매월 고정 지출 관리 패널 */}
      {showExpenseMgr && (
        <div className="bg-white rounded-xl border border-red-100 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">💸 매월 고정 지출 관리</span>
            <span className="text-[11px] text-gray-400">캘린더 각 날짜 하단에 빨간색으로 표시됩니다</span>
          </div>

          {/* 목록 */}
          <div className="space-y-1.5">
            {[...monthlyExpenses].sort((a, b) => a.day - b.day).map((exp, listIdx) => {
              const realIdx = monthlyExpenses.findIndex(e => e === exp)
              return editingExpIdx === realIdx ? (
                <div key={realIdx} className="flex items-center gap-2 bg-red-50 rounded-lg p-2.5">
                  <input
                    type="number" min={1} max={31}
                    value={expenseForm.day}
                    onChange={e => setExpenseForm(p => ({ ...p, day: e.target.value }))}
                    className="w-14 border border-red-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-red-300"
                    placeholder="일" />
                  <input
                    value={expenseForm.label}
                    onChange={e => setExpenseForm(p => ({ ...p, label: e.target.value }))}
                    className="flex-1 border border-red-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
                    placeholder="항목명" />
                  <input
                    type="number"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                    className="w-28 border border-red-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-red-300"
                    placeholder="금액 (없으면 빈칸)" />
                  <button
                    onClick={() => {
                      const d = parseInt(expenseForm.day)
                      if (!expenseForm.label.trim() || isNaN(d) || d < 1 || d > 31) return
                      const updated = monthlyExpenses.map((e, i) =>
                        i === realIdx ? { day: d, label: expenseForm.label.trim(), amount: expenseForm.amount !== '' ? Number(expenseForm.amount) : null } : e
                      )
                      setMonthlyExpenses(updated)
                      saveExpenses(updated)
                      setEditingExpIdx(null)
                    }}
                    className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600">저장</button>
                  <button
                    onClick={() => setEditingExpIdx(null)}
                    className="text-xs text-gray-400 hover:text-gray-600">취소</button>
                </div>
              ) : (
                <div key={realIdx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 group">
                  <span className="text-xs font-bold text-red-500 w-8 text-center">{exp.day}일</span>
                  <span className="flex-1 text-xs text-gray-700">{exp.label}</span>
                  {exp.amount !== null && (
                    <span className="text-xs font-semibold text-red-600">{fmtAmt(exp.amount)}</span>
                  )}
                  <button
                    onClick={() => {
                      setExpenseForm({ day: String(exp.day), label: exp.label, amount: exp.amount !== null ? String(exp.amount) : '' })
                      setEditingExpIdx(realIdx)
                    }}
                    className="text-[10px] text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity px-1">수정</button>
                  <button
                    onClick={() => {
                      const updated = monthlyExpenses.filter((_, i) => i !== realIdx)
                      setMonthlyExpenses(updated)
                      saveExpenses(updated)
                    }}
                    className="text-[10px] text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity px-1">✕</button>
                </div>
              )
            })}
          </div>

          {/* 추가 폼 */}
          {editingExpIdx === null && (
            <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
              <input
                type="number" min={1} max={31}
                value={editingExpIdx === null ? expenseForm.day : ''}
                onChange={e => setExpenseForm(p => ({ ...p, day: e.target.value }))}
                className="w-14 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-red-300"
                placeholder="일" />
              <input
                value={editingExpIdx === null ? expenseForm.label : ''}
                onChange={e => setExpenseForm(p => ({ ...p, label: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
                placeholder="항목명 입력" />
              <input
                type="number"
                value={editingExpIdx === null ? expenseForm.amount : ''}
                onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-red-300"
                placeholder="금액 (선택)" />
              <button
                onClick={() => {
                  const d = parseInt(expenseForm.day)
                  if (!expenseForm.label.trim() || isNaN(d) || d < 1 || d > 31) return
                  const updated = [...monthlyExpenses, {
                    day: d,
                    label: expenseForm.label.trim(),
                    amount: expenseForm.amount !== '' ? Number(expenseForm.amount) : null,
                  }]
                  setMonthlyExpenses(updated)
                  saveExpenses(updated)
                  setExpenseForm({ day: '', label: '', amount: '' })
                }}
                className="text-xs bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-200 font-semibold whitespace-nowrap">
                + 추가
              </button>
            </div>
          )}
        </div>
      )}

      {/* 일정 추가 폼 */}
      {showForm && (
        <form onSubmit={submitEvent} className="bg-white rounded-xl border border-blue-200 p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-800 text-sm">
              ✏️ 새 일정 — {formatDate(form.start_date)} ({getDow(form.start_date)})
            </h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">일정 제목 *</label>
            <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="예: 팀 회의, 고객 미팅" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">시작일 *</label>
              <input type="date" required value={form.start_date}
                onChange={e => setForm(p => ({ ...p, start_date: e.target.value, end_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">종료일</label>
              <input type="date" value={form.end_date}
                onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm(p => ({ ...p, is_allday: !p.is_allday }))}
              className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${form.is_allday ? 'bg-blue-500' : 'bg-gray-200'}`}>
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
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">종료 시간</label>
                <input type="time" value={form.end_time}
                  onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">메모 (선택)</label>
            <textarea value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              placeholder="장소, 참석자 등..." />
          </div>
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
              className="flex-1 bg-[#1B2A45] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#243552]">저장</button>
          </div>
        </form>
      )}

      {/* 메인 레이아웃: 캘린더 + 오른쪽 패널 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">

        {/* ── 캘린더 그리드 ── */}
        <div className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-[#E8E2D4] bg-gray-50/50">
            {KO_DAYS.map((d, i) => (
              <div key={d} className={`py-2.5 text-center text-xs font-bold ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'
              }`}>{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">불러오는 중...</div>
          ) : (
            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                const dow = idx % 7
                const isSunday = dow === 0
                const isSaturday = dow === 6
                if (!day) return (
                  <div key={idx} className={`min-h-[88px] border-b border-r border-gray-100 ${
                    isSunday ? 'bg-red-50/40' : isSaturday ? 'bg-blue-50/40' : 'bg-gray-50/20'
                  }`} />
                )
                const d = toDateStr(year, month, day)
                const dayEvs = eventsForDay(day)
                const isToday = d === todayStr
                const isSelected = d === selectedDay
                const dayExpenses = monthlyExpenses.filter(e => e.day === day)
                return (
                  <div key={idx}
                    onClick={() => setSelectedDay(d)}
                    className={`min-h-[88px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#1B2A45]/8 ring-1 ring-inset ring-[#1B2A45]/20'
                        : isSunday  ? 'bg-red-50/40 hover:bg-red-50/70'
                        : isSaturday ? 'bg-blue-50/40 hover:bg-blue-50/70'
                        : 'hover:bg-gray-50/60'
                    }`}>
                    {/* 날짜 숫자 */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                      isToday
                        ? 'bg-[#1B2A45] text-white'
                        : isSelected
                          ? 'bg-[#1B2A45]/15 text-[#1B2A45]'
                          : isSunday   ? 'text-red-500'
                          : isSaturday ? 'text-blue-500'
                          : 'text-gray-700'
                    }`}>{day}</div>

                    {/* 이벤트 칩 */}
                    <div className="space-y-0.5">
                      {dayEvs.slice(0, 2).map(ev => (
                        <div key={ev.id}
                          onClick={e => { e.stopPropagation(); setDetailEvent(ev) }}
                          className="text-[10px] px-1 py-0.5 rounded font-medium truncate cursor-pointer hover:opacity-80 bg-white border-l-[3px]"
                          style={{ borderLeftColor: colorHex(ev.color), color: colorHex(ev.color) }}>
                          {!ev.is_allday && ev.start_time && (
                            <span className="opacity-60 mr-0.5">{ev.start_time.slice(0, 5)}</span>
                          )}
                          {ev.source === 'google' && <span className="opacity-40 mr-0.5 text-[8px]">G</span>}
                          {ev.title}
                        </div>
                      ))}
                      {/* 매월 고정 지출 칩 */}
                      {dayExpenses.map((exp, ei) => (
                        <div key={`exp-${ei}`}
                          className="text-[9px] px-1 py-0.5 rounded font-semibold truncate leading-tight bg-white border-l-[3px] border-red-400 text-red-600">
                          💸 {exp.label}{exp.amount !== null ? ` ${Math.abs(exp.amount).toLocaleString()}` : ''}
                        </div>
                      ))}
                      {dayEvs.length > 2 && (
                        <p className="text-[9px] text-gray-400 pl-0.5">+{dayEvs.length - 2}개 더</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── 오른쪽 패널 ── */}
        <div className="space-y-3">

          {/* 선택된 날짜 이벤트 */}
          <div className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
            <div className="px-4 py-3 bg-gray-50/50 border-b border-[#E8E2D4] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-700">{formatDate(selectedDay)}</p>
                <p className="text-[10px] text-gray-400">{getDow(selectedDay)}요일{selectedDay === todayStr ? ' · 오늘' : ''}</p>
              </div>
              <button
                onClick={() => openAddForm(selectedDay)}
                className="text-[10px] bg-[#1B2A45] text-white px-2.5 py-1 rounded-lg font-medium hover:bg-[#243552] transition-colors">
                + 추가
              </button>
            </div>

            {/* 매월 고정 지출 (해당 날짜) */}
            {selectedExpenses.length > 0 && (
              <div className="border-b border-gray-50">
                {selectedExpenses.map((exp, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2 bg-red-50/60">
                    <span className="w-2 h-2 rounded-full shrink-0 bg-red-400" />
                    <span className="text-xs font-semibold text-red-700 flex-1">{exp.label}</span>
                    {exp.amount !== null && (
                      <span className="text-xs font-bold text-red-600">{fmtAmt(exp.amount)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedEvents.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-xs text-gray-400">이 날 일정 없음</p>
                <button onClick={() => openAddForm(selectedDay)}
                  className="mt-2 text-xs text-blue-500 hover:text-blue-700 underline">
                  일정 추가하기
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {selectedEvents.map(ev => (
                  <button key={ev.id}
                    onClick={() => setDetailEvent(ev)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colorHex(ev.color) }} />
                      <span className="text-xs font-semibold text-gray-800 flex-1 truncate">{ev.title}</span>
                      {ev.source === 'google' && <span className="text-[10px] text-gray-300">G</span>}
                    </div>
                    {!ev.is_allday && ev.start_time && (
                      <p className="text-[10px] text-gray-400 mt-0.5 pl-4.5">
                        ⏰ {ev.start_time.slice(0, 5)}{ev.end_time && ` ~ ${ev.end_time.slice(0, 5)}`}
                      </p>
                    )}
                    {ev.description && (
                      <p className="text-[10px] text-gray-400 mt-0.5 pl-4.5 truncate">{ev.description}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 다가오는 일정 */}
          {upcomingThisMonth.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E8E2D4]">
                <p className="text-xs font-bold text-gray-500">📅 다가오는 일정</p>
              </div>
              <div className="divide-y divide-gray-50">
                {upcomingThisMonth.map(ev => {
                  const isExpense = ev.id.startsWith('__exp__')
                  return (
                    <button key={ev.id}
                      onClick={() => { setSelectedDay(ev.start_date); if (!isExpense) setDetailEvent(ev) }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2">
                        {isExpense
                          ? <span className="text-[10px] text-red-500 shrink-0">💸</span>
                          : <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colorHex(ev.color) }} />
                        }
                        <span className={`text-xs font-medium flex-1 truncate ${isExpense ? 'text-red-700' : 'text-gray-800'}`}>
                          {ev.title}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5 pl-4">
                        {ev.start_date.slice(5).replace('-', '/')} ({getDow(ev.start_date)})
                        {!ev.is_allday && ev.start_time && ` ${ev.start_time.slice(0, 5)}`}
                        {ev.source === 'google' && !isExpense && ' 🗓'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 연동 캘린더 범례 */}
          {gcalSaved && gcalList.filter(c => c.id).length > 0 && (
            <div className="bg-white rounded-xl border border-[#E8E2D4] p-4">
              <p className="text-xs font-bold text-gray-400 mb-2">연동된 캘린더</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />직접 추가
                </div>
                {gcalList.filter(c => c.id).map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorHex(c.color) }} />{c.label}
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
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorHex(detailEvent.color) }} />
                <h3 className="font-bold text-gray-900 text-base">{detailEvent.title}</h3>
              </div>
              <button onClick={() => setDetailEvent(null)} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">📅</span>
                <span>
                  {formatDate(detailEvent.start_date)} ({getDow(detailEvent.start_date)})
                  {detailEvent.end_date !== detailEvent.start_date && ` ~ ${formatDate(detailEvent.end_date)}`}
                </span>
              </div>
              {!detailEvent.is_allday && detailEvent.start_time && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">⏰</span>
                  <span>{detailEvent.start_time.slice(0, 5)}{detailEvent.end_time && ` ~ ${detailEvent.end_time.slice(0, 5)}`}</span>
                </div>
              )}
              {detailEvent.source === 'google' && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">🗓</span>
                  <span className="text-emerald-600 text-xs font-medium">
                    Google 캘린더{detailEvent.gcal_label && ` · ${detailEvent.gcal_label}`}
                  </span>
                </div>
              )}
              {detailEvent.description && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap">
                  {detailEvent.description}
                </div>
              )}
            </div>
            {detailEvent.source === 'local' && (
              <button onClick={() => deleteEvent(detailEvent.id)}
                className="mt-4 w-full text-red-400 hover:text-red-600 text-sm border border-red-100 hover:border-red-200 py-2 rounded-lg transition-colors">
                🗑 일정 삭제
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
