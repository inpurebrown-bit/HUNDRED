'use client'

import { useState, useEffect, FormEvent, ReactNode } from 'react'

// ── 타입 ────────────────────────────────────────────────
interface MorningData {
  total_calls: string
  no_connect: string
  connected: string
  db_secured: string
  outbound_contracts: string
}

type ConsultStatus =
  | '결정업체'
  | '계약대기'
  | '계약서대기'
  | '입금대기'
  | '고민중'
  | '재통화예정'
  | '감성톡관리'
  | ''

interface ConsultItem {
  company: string
  content: string
  status: ConsultStatus
  callback_date?: string  // 재통화예정일 때만 사용
  /** @deprecated 구버전 호환 */
  is_decided?: boolean
}

interface WorriedItem {
  company: string
  content: string
  reason: string
  probability: '상' | '중' | '하' | ''
}

interface DecidedItem {
  company: string
  content: string
  current_progress: string
  next_action: string
}

interface MeetingItem {
  company: string
  date: string
  time: string
  location: string
}

interface PaymentItem {
  first_call_date: string
  company: string
  ceo_name: string
  phone: string
}

interface DailyData {
  supply_db: ConsultItem[] | null       // null = 없음
  outbound: ConsultItem[] | null
  today_contracts: string
  month_contracts: string
  goal: string
  worried: WorriedItem[] | null
  decided: DecidedItem[] | null
  meetings: MeetingItem[] | null
  payment_waiting: PaymentItem[] | null
  continue_tomorrow: string[] | null    // 내일도 계속 업체명 목록
}

interface Props {
  userId: string
  userName: string
}

const today = () => new Date().toISOString().slice(0, 10)

// ── 공통 입력 스타일 ────────────────────────────────────
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const label = 'text-xs text-gray-500 mb-1 block font-medium'

// ── 제출 전 UI 전용 필드(_*) 제거 ───────────────────────
function stripUIFields(obj: any): any {
  if (Array.isArray(obj)) return obj.map(stripUIFields)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => [k, stripUIFields(v)])
    )
  }
  return obj
}

// ── LockedInput: Enter → 초록 잠금, ✏️ 클릭으로 수정 ───
function LockedInput({ value, onChange, locked, onLock, onUnlock, ...rest }: {
  value: string
  onChange: (v: string) => void
  locked: boolean
  onLock: () => void
  onUnlock: () => void
  [key: string]: any
}) {
  return (
    <div className="relative">
      <input
        {...rest}
        value={value}
        readOnly={locked}
        onChange={e => !locked && onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !locked && String(value).trim()) {
            e.preventDefault()
            onLock()
          }
        }}
        className={`w-full border rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none transition-all duration-200 ${
          locked
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold focus:ring-0'
            : 'border-gray-200 focus:ring-2 focus:ring-blue-500'
        }`}
      />
      {locked ? (
        <button type="button" onClick={onUnlock} title="수정"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-700 text-sm leading-none">
          ✏️
        </button>
      ) : (
        String(value).trim() && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-300 pointer-events-none select-none">
            Enter↵
          </span>
        )
      )}
    </div>
  )
}

export default function ReportTab({ userId, userName }: Props) {
  const [activeReport, setActiveReport] = useState<'morning' | 'daily'>('morning')
  const [submitted, setSubmitted] = useState(false)
  const [submitType, setSubmitType] = useState<'morning' | 'daily'>('morning')
  const [loading, setLoading] = useState(false)
  const [pastReports, setPastReports] = useState<any[]>([])
  const [viewReport, setViewReport] = useState<any | null>(null)
  // 수정 모드
  const [editDate, setEditDate] = useState<string | null>(null)
  // 오전보고 필드 잠금
  const [lockedMorning, setLockedMorning] = useState<Record<string, boolean>>({})
  // 계약 자동집계용 고객 데이터
  const [allCustomers, setAllCustomers] = useState<any[]>([])
  // 목표 개수 (supply_config에서 로드)
  const [supplyGoal, setSupplyGoal] = useState<number | null>(null)

  // 오전보고 상태
  const [morning, setMorning] = useState<MorningData>({
    total_calls: '', no_connect: '', connected: '', db_secured: '', outbound_contracts: '',
  })

  // 마감보고 상태
  const [daily, setDaily] = useState<DailyData>({
    supply_db: [],
    outbound: [],
    today_contracts: '',
    month_contracts: '',
    goal: '',
    worried: [],
    decided: [],
    meetings: [],
    payment_waiting: [],
    continue_tomorrow: [],
  })

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => setPastReports(d.reports || []))
  }, [submitted])

  // 고객 데이터 로드 (계약 자동집계)
  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => setAllCustomers(d.customers || []))
  }, [])

  // supply_config에서 목표 개수 로드
  useEffect(() => {
    fetch('/api/supply-config').then(r => r.json()).then(d => {
      const cfg = d.config
      if (!cfg) return
      // 형식: { month, people: { 이름: { goal, ... } } } 또는 { 이름: { goal } }
      const people = cfg.people || cfg
      const mine = people[userName]
      if (mine?.goal) setSupplyGoal(Number(mine.goal))
    }).catch(() => {})
  }, [userName])

  // ── 이번달/오늘 계약 자동집계 ───────────────────────────
  function contractWeight(paymentAmount: string | number | undefined, vatIncluded?: boolean): number {
    const amt = parseInt(String(paymentAmount || '0').replace(/[^0-9]/g, ''), 10) || 0
    if (amt <= 0) return 0
    const vatExcl = vatIncluded === false ? amt : Math.round(amt / 1.1)
    if (vatExcl <= 300000) return 0.5
    if (vatExcl < 1000000) return 1
    return Math.floor((vatExcl - 1000000) / 500000) + 2
  }

  function cleanNameLocal(s: string): string {
    return s.replace(/\s*(수석팀장|팀장|팀원|대리|과장|부장|차장|이사|수석|매니저|주임|사원).*/g, '').trim()
  }

  const todayStr   = today()
  const monthStr   = todayStr.slice(0, 7)
  const myContracts = allCustomers.filter((c: any) => {
    const owner = (c.details?.sales_user_name || c.sales_user_name || '').trim()
    return c.status === 'contracted' && (
      owner === userName ||
      cleanNameLocal(owner) === cleanNameLocal(userName)
    )
  })
  const autoTodayContracts = myContracts
    .filter((c: any) => (c.details?.contract_date || '').startsWith(todayStr))
    .reduce((sum: number, c: any) => sum + contractWeight(c.details?.payment_amount, c.details?.vat_included), 0)
  const autoMonthContracts = myContracts
    .filter((c: any) => (c.details?.contract_date || '').startsWith(monthStr))
    .reduce((sum: number, c: any) => sum + contractWeight(c.details?.payment_amount, c.details?.vat_included), 0)

  const [showYesterdayPreview, setShowYesterdayPreview] = useState(false)

  // ── 과거 보고 수정하기 ────────────────────────────────
  function loadForEdit(r: any) {
    if (r.report_type === 'morning') {
      setMorning({ total_calls: '', no_connect: '', connected: '', db_secured: '', outbound_contracts: '', ...r.data })
      setLockedMorning({})
      setActiveReport('morning')
    } else {
      setDaily({
        supply_db: [], outbound: [], today_contracts: '', month_contracts: '',
        goal: '', worried: [], decided: [], meetings: [], payment_waiting: [],
        continue_tomorrow: [],
        ...r.data,
      })
      setActiveReport('daily')
    }
    setEditDate(r.report_date)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── 오전보고 제출 ────────────────────────────────────
  async function submitMorning(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_type: 'morning', report_date: editDate || today(), data: morning }),
    })
    if (res.ok) {
      setSubmitType('morning')
      setSubmitted(true)
      setEditDate(null)
      setLockedMorning({})
    }
    setLoading(false)
  }

  // ── 마감보고 제출 ────────────────────────────────────
  async function submitDaily(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_type: 'daily', report_date: editDate || today(), data: stripUIFields(daily) }),
    })
    if (res.ok) {
      setSubmitType('daily')
      setSubmitted(true)
      setEditDate(null)
    }
    setLoading(false)
  }

  // ── 배열 아이템 헬퍼 ─────────────────────────────────
  function addItem<T>(field: keyof DailyData, empty: T) {
    setDaily(p => ({ ...p, [field]: [...((p[field] as any[]) || []), empty] }))
  }
  function removeItem(field: keyof DailyData, idx: number) {
    setDaily(p => ({ ...p, [field]: (p[field] as any[]).filter((_, i) => i !== idx) }))
  }
  function updateItem(field: keyof DailyData, idx: number, key: string, val: any) {
    setDaily(p => ({
      ...p,
      [field]: (p[field] as any[]).map((item, i) => i === idx ? { ...item, [key]: val } : item),
    }))
  }

  // 자동 계산
  const remaining = daily.goal && daily.month_contracts
    ? Math.max(0, Number(daily.goal) - Number(daily.month_contracts))
    : null

  const morningReports = pastReports.filter(r => r.report_type === 'morning')
  const dailyReports = pastReports.filter(r => r.report_type === 'daily')

  // ── 어제 보고 미리보기 ────────────────────────────────
  const yesterdayStr = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()
  const yesterdayMorning = morningReports.find(r => r.report_date === yesterdayStr)
  const yesterdayDaily   = dailyReports.find(r => r.report_date === yesterdayStr)

  // 과거 보고에 등장한 업체명 목록 (자동완성용)
  const allCompanies: string[] = Array.from(new Set(
    pastReports.flatMap(r =>
      ['supply_db', 'outbound', 'worried', 'decided', 'meetings', 'payment_waiting'].flatMap(f =>
        (r.data?.[f] || []).map((c: any) => c.company).filter(Boolean)
      )
    )
  )).sort()

  const pct = (n: number, d: number) => d === 0 ? '—' : (n / d * 100).toFixed(1) + '%'
  const morningStats = {
    total_calls: morningReports.reduce((s, r) => s + Number(r.data?.total_calls || 0), 0),
    no_connect:  morningReports.reduce((s, r) => s + Number(r.data?.no_connect || 0), 0),
    connected:   morningReports.reduce((s, r) => s + Number(r.data?.connected || 0), 0),
    db_secured:  morningReports.reduce((s, r) => s + Number(r.data?.db_secured || 0), 0),
    outbound_contracts: morningReports.reduce((s, r) => s + Number(r.data?.outbound_contracts || 0), 0),
  }
  const dailyStats = {
    today_contracts: dailyReports.reduce((s, r) => s + Number(r.data?.today_contracts || 0), 0),
    month_contracts: dailyReports.filter(r => r.report_date?.slice(0, 7) === todayStr.slice(0, 7))
      .reduce((s, r) => s + Number(r.data?.today_contracts || 0), 0),
    supply_decided: dailyReports.reduce((s, r) => s + (r.data?.supply_db || []).filter((i: any) => i.is_decided || ['결정업체','계약대기','계약서대기','입금대기'].includes(i.status)).length, 0),
    outbound_decided: dailyReports.reduce((s, r) => s + (r.data?.outbound || []).filter((i: any) => i.is_decided || ['결정업체','계약대기','계약서대기','입금대기'].includes(i.status)).length, 0),
  }

  return (
    <div className="space-y-4">
      {/* 탭 선택 */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveReport('morning')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeReport === 'morning' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          ☀️ 오전보고
        </button>
        <button
          onClick={() => setActiveReport('daily')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeReport === 'daily' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          📋 일일마감보고
        </button>
      </div>

      {/* ── 통계 카드 ── */}
      {activeReport === 'morning' && morningReports.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs text-amber-700 font-bold mb-3">☀️ 내 오전보고 누적 통계 ({morningReports.length}건)</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {([
              { label: '총 콜', value: morningStats.total_calls, rate: null, rateLabel: '' },
              { label: '연결안됨', value: morningStats.no_connect, rate: pct(morningStats.no_connect, morningStats.total_calls), rateLabel: '미연결율' },
              { label: '연결됨', value: morningStats.connected, rate: pct(morningStats.connected, morningStats.total_calls), rateLabel: '연결율' },
              { label: 'DB확보', value: morningStats.db_secured, rate: pct(morningStats.db_secured, morningStats.total_calls), rateLabel: '확보율' },
              { label: '아웃계약', value: morningStats.outbound_contracts, rate: pct(morningStats.outbound_contracts, morningStats.total_calls), rateLabel: '계약율' },
            ] as const).map(s => (
              <div key={s.label} className="bg-white rounded-lg p-2.5 text-center border border-amber-100">
                <p className="text-[10px] text-gray-400 mb-0.5">{s.label}</p>
                <p className="text-xl font-black text-amber-700">{s.value}<span className="text-xs font-normal text-gray-400">건</span></p>
                {s.rate !== null && (
                  <p className="text-[11px] font-semibold text-amber-500 mt-0.5">{s.rate} <span className="text-[10px] text-gray-400 font-normal">{s.rateLabel}</span></p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {activeReport === 'daily' && dailyReports.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-700 font-bold mb-3">📋 내 마감보고 누적 통계 ({dailyReports.length}건)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: '누적 계약', value: dailyStats.today_contracts + '건' },
              { label: '이번달 계약', value: dailyStats.month_contracts + '건' },
              { label: '공급DB 결정', value: dailyStats.supply_decided + '건' },
              { label: '아웃바운딩 결정', value: dailyStats.outbound_decided + '건' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg p-2.5 text-center border border-blue-100">
                <p className="text-[10px] text-gray-400 mb-0.5">{s.label}</p>
                <p className="text-xl font-black text-blue-700">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 전송 완료 팝업 모달 ── */}
      {submitted && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] px-6">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center animate-[fadeIn_0.2s_ease]">
            {/* 아이콘 */}
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">✅</span>
            </div>
            {/* 제목 */}
            <h2 className="text-xl font-black text-gray-900 mb-2">
              {submitType === 'morning' ? '오전보고 완료!' : '마감보고 완료!'}
            </h2>
            {/* 설명 */}
            <p className="text-sm text-gray-500 mb-1">
              대표님께 성공적으로 전송되었습니다.
            </p>
            <p className="text-xs text-gray-400 mb-7">
              {today()} · {userName}
            </p>
            {/* 확인 버튼 */}
            <button
              onClick={() => setSubmitted(false)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors">
              확인
            </button>
          </div>
        </div>
      )}

      {/* ── 어제 보고 미리보기 ── */}
      {(yesterdayMorning || yesterdayDaily) && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setShowYesterdayPreview(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors">
            <span>📅 어제({yesterdayStr}) 보고 미리보기</span>
            <span className="text-gray-400 text-xs">{showYesterdayPreview ? '▲ 접기' : '▼ 펼치기'}</span>
          </button>
          {showYesterdayPreview && (
            <div className="px-4 pb-4 space-y-3 text-xs text-gray-600">
              {yesterdayMorning && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <p className="text-[11px] font-bold text-amber-700 mb-2">☀️ 어제 오전보고</p>
                  <MorningDetailView data={yesterdayMorning.data} />
                </div>
              )}
              {yesterdayDaily && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <p className="text-[11px] font-bold text-blue-700 mb-2">📋 어제 마감보고</p>
                  <DailyDetailView data={yesterdayDaily.data} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 오전보고 폼 ── */}
      {activeReport === 'morning' && (
        <div className="space-y-4">
          <form onSubmit={submitMorning} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4"
            onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault() }}>
            {editDate && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-amber-700 font-medium">✏️ 수정 중 — {editDate}</span>
                <button type="button" onClick={() => { setEditDate(null); setLockedMorning({}) }}
                  className="text-xs text-amber-500 hover:text-amber-700">취소</button>
              </div>
            )}
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-800">☀️ 오전보고</h3>
              <span className="text-xs text-gray-400">{editDate || today()} · {userName}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {([
                { key: 'total_calls',        label2: '총 콜 수' },
                { key: 'no_connect',         label2: '연결안됨' },
                { key: 'connected',          label2: '연결됨' },
                { key: 'db_secured',         label2: 'DB확보 (결정업체)' },
                { key: 'outbound_contracts', label2: '아웃바운딩 계약' },
              ] as { key: keyof MorningData; label2: string }[]).map(f => (
                <div key={f.key}>
                  <label className={label}>{f.label2}</label>
                  <LockedInput
                    type="number"
                    placeholder="0"
                    value={morning[f.key]}
                    locked={!!lockedMorning[f.key]}
                    onChange={v => setMorning(p => ({ ...p, [f.key]: v }))}
                    onLock={() => setLockedMorning(p => ({ ...p, [f.key]: true }))}
                    onUnlock={() => setLockedMorning(p => ({ ...p, [f.key]: false }))}
                  />
                </div>
              ))}
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              {loading ? '전송 중...' : editDate ? '✏️ 오전보고 수정 전송 →' : '오전보고 전송 →'}
            </button>
          </form>

          {/* 과거 오전보고 목록 */}
          {morningReports.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">지난 오전보고 누적</h3>
                <span className="text-xs text-gray-400">{morningReports.length}건</span>
              </div>
              <div className="divide-y divide-gray-50">
                {morningReports.slice(0, 50).map(r => {
                  const tc = Number(r.data?.total_calls || 0)
                  const cn = Number(r.data?.connected || 0)
                  const connRate = tc > 0 ? (cn / tc * 100).toFixed(0) + '%' : '—'
                  const dbRate = tc > 0 ? (Number(r.data?.db_secured || 0) / tc * 100).toFixed(0) + '%' : '—'
                  const ctRate = tc > 0 ? (Number(r.data?.outbound_contracts || 0) / tc * 100).toFixed(0) + '%' : '—'
                  return (
                    <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                      <div>
                        <span className="text-sm font-medium text-gray-800">{r.report_date}</span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          총콜 {tc}건 · 연결 {cn}건 <span className="text-amber-500 font-semibold">({connRate} 연결율)</span> · DB {r.data?.db_secured || 0}건 <span className="text-amber-400">({dbRate})</span> · 계약 {r.data?.outbound_contracts || 0}건 <span className="text-green-500 font-semibold">({ctRate})</span>
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0 ml-2">
                        <button onClick={() => setViewReport(r)}
                          className="text-xs text-blue-500 hover:text-blue-700">상세보기</button>
                        <button onClick={() => loadForEdit(r)}
                          className="text-xs text-amber-500 hover:text-amber-700 font-medium">수정하기</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 마감보고 폼 ── */}
      {activeReport === 'daily' && (
        <div className="space-y-4">
          <form onSubmit={submitDaily} className="space-y-5"
            onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault() }}>

            {/* 기본 정보 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              {editDate && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between mb-3">
                  <span className="text-xs text-amber-700 font-medium">✏️ 수정 중 — {editDate}</span>
                  <button type="button" onClick={() => setEditDate(null)}
                    className="text-xs text-amber-500 hover:text-amber-700">취소</button>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">📋 일일업무마감보고서</h3>
                <span className="text-xs text-gray-400">{editDate || today()} · {userName}</span>
              </div>

              {/* 계약 현황 — 자동집계 배너 */}
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl px-4 py-3 mb-3 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-emerald-600 font-bold">🤖 DB 자동집계</span>
                  <span className="text-[10px] text-gray-400">(계약완료 처리된 내 업체 기준)</span>
                </div>
                <div className="flex flex-wrap gap-3 text-[11px]">
                  <span className="bg-white border border-emerald-200 rounded-full px-2.5 py-1 font-semibold text-emerald-700">
                    오늘 계약 {autoTodayContracts % 1 === 0 ? autoTodayContracts : autoTodayContracts.toFixed(1)}건
                  </span>
                  <span className="bg-white border border-blue-200 rounded-full px-2.5 py-1 font-semibold text-blue-700">
                    이번달 {autoMonthContracts % 1 === 0 ? autoMonthContracts : autoMonthContracts.toFixed(1)}건
                  </span>
                </div>
                <button type="button"
                  onClick={() => setDaily(p => ({
                    ...p,
                    today_contracts: String(autoTodayContracts),
                    month_contracts: String(autoMonthContracts),
                    ...(supplyGoal !== null && p.goal === '' ? { goal: String(supplyGoal) } : {}),
                  }))}
                  className="ml-auto shrink-0 text-[11px] bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">
                  ↓ 자동입력
                </button>
              </div>

              {/* 계약 현황 입력 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                <div>
                  <label className={label}>당일 계약 개수</label>
                  <div className="relative">
                    <input type="number" className={inp} placeholder="0"
                      value={daily.today_contracts}
                      onChange={e => setDaily(p => ({ ...p, today_contracts: e.target.value }))} />
                    {daily.today_contracts === '' && autoTodayContracts > 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400 pointer-events-none">{autoTodayContracts % 1 === 0 ? autoTodayContracts : autoTodayContracts.toFixed(1)}</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className={label}>이번달 총 계약</label>
                  <div className="relative">
                    <input type="number" className={inp} placeholder="0"
                      value={daily.month_contracts}
                      onChange={e => setDaily(p => ({ ...p, month_contracts: e.target.value }))} />
                    {daily.month_contracts === '' && autoMonthContracts > 0 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-400 pointer-events-none">{autoMonthContracts % 1 === 0 ? autoMonthContracts : autoMonthContracts.toFixed(1)}</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className={label}>
                    월 목표 개수
                    {supplyGoal !== null && (
                      <span className="ml-1 text-[9px] text-blue-400 font-normal">(설정값: {supplyGoal})</span>
                    )}
                  </label>
                  <div className="relative">
                    <input type="number" className={inp} placeholder="0"
                      value={daily.goal}
                      onChange={e => setDaily(p => ({ ...p, goal: e.target.value }))} />
                    {daily.goal === '' && supplyGoal !== null && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-400 pointer-events-none">{supplyGoal}</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className={label}>목표까지 남은 수</label>
                  <div className={`${inp} bg-gray-50 font-semibold ${remaining !== null && remaining > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                    {remaining !== null
                      ? remaining > 0
                        ? `${remaining}개 남음`
                        : '🎉 목표달성!'
                      : '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* 금일 신규 공급DB 상담결과 */}
            <Section
              title="금일 신규 공급DB 상담결과"
              isEmpty={daily.supply_db === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, supply_db: p.supply_db === null ? [] : null }))}
              onAdd={() => addItem('supply_db', { company: '', content: '', status: '' as ConsultStatus })}
            >
              {(daily.supply_db || []).map((item, i) => (
                <ConsultRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('supply_db', i, k, v)}
                  onRemove={() => removeItem('supply_db', i)}
                  onLock={() => updateItem('supply_db', i, '_locked', true)}
                  onUnlock={() => updateItem('supply_db', i, '_locked', false)}
                  allCompanies={allCompanies} pastReports={dailyReports} />
              ))}
            </Section>

            {/* 금일 신규 아웃바운딩 상담결과 */}
            <Section
              title="금일 신규 아웃바운딩 상담결과"
              isEmpty={daily.outbound === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, outbound: p.outbound === null ? [] : null }))}
              onAdd={() => addItem('outbound', { company: '', content: '', status: '' as ConsultStatus })}
            >
              {(daily.outbound || []).map((item, i) => (
                <ConsultRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('outbound', i, k, v)}
                  onRemove={() => removeItem('outbound', i)}
                  onLock={() => updateItem('outbound', i, '_locked', true)}
                  onUnlock={() => updateItem('outbound', i, '_locked', false)}
                  allCompanies={allCompanies} pastReports={dailyReports} />
              ))}
            </Section>

            {/* 고민관리업체 */}
            <Section
              title="고민관리업체"
              isEmpty={daily.worried === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, worried: p.worried === null ? [] : null }))}
              onAdd={() => addItem('worried', { company: '', content: '', reason: '', probability: '' })}
            >
              {(daily.worried || []).map((item, i) => (
                <WorriedRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('worried', i, k, v)}
                  onRemove={() => removeItem('worried', i)}
                  onLock={() => updateItem('worried', i, '_locked', true)}
                  onUnlock={() => updateItem('worried', i, '_locked', false)} />
              ))}
            </Section>

            {/* 결정업체 */}
            <Section
              title="결정업체"
              isEmpty={daily.decided === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, decided: p.decided === null ? [] : null }))}
              onAdd={() => addItem('decided', { company: '', content: '', current_progress: '', next_action: '' })}
            >
              {(daily.decided || []).map((item, i) => (
                <DecidedRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('decided', i, k, v)}
                  onRemove={() => removeItem('decided', i)}
                  onLock={() => updateItem('decided', i, '_locked', true)}
                  onUnlock={() => updateItem('decided', i, '_locked', false)} />
              ))}
            </Section>

            {/* 미팅업체 */}
            <Section
              title="미팅업체"
              isEmpty={daily.meetings === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, meetings: p.meetings === null ? [] : null }))}
              onAdd={() => addItem('meetings', { company: '', date: '', time: '', location: '' })}
            >
              {(daily.meetings || []).map((item, i) => (
                <MeetingRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('meetings', i, k, v)}
                  onRemove={() => removeItem('meetings', i)}
                  onLock={() => updateItem('meetings', i, '_locked', true)}
                  onUnlock={() => updateItem('meetings', i, '_locked', false)} />
              ))}
            </Section>

            {/* 입금대기 업체 */}
            <Section
              title="입금대기 업체"
              isEmpty={daily.payment_waiting === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, payment_waiting: p.payment_waiting === null ? [] : null }))}
              onAdd={() => addItem('payment_waiting', { first_call_date: '', company: '', ceo_name: '', phone: '' })}
            >
              {(daily.payment_waiting || []).map((item, i) => (
                <PaymentRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('payment_waiting', i, k, v)}
                  onRemove={() => removeItem('payment_waiting', i)}
                  onLock={() => updateItem('payment_waiting', i, '_locked', true)}
                  onUnlock={() => updateItem('payment_waiting', i, '_locked', false)} />
              ))}
            </Section>

            {/* 내일도 계속 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800 text-sm">📅 내일도 계속</h4>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => setDaily(p => ({ ...p, continue_tomorrow: p.continue_tomorrow === null ? [] : null }))}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                      daily.continue_tomorrow === null
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                    }`}>없음</button>
                  {daily.continue_tomorrow !== null && (
                    <button type="button"
                      onClick={() => setDaily(p => ({ ...p, continue_tomorrow: [...(p.continue_tomorrow || []), ''] }))}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors">
                      + 추가
                    </button>
                  )}
                </div>
              </div>
              {daily.continue_tomorrow === null ? (
                <p className="text-xs text-gray-400 text-center py-2">해당 없음으로 표시됩니다</p>
              ) : daily.continue_tomorrow.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">+ 추가를 눌러 업체명을 입력하세요</p>
              ) : (
                <div className="space-y-2">
                  {daily.continue_tomorrow.map((company, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        className={inp}
                        value={company}
                        placeholder="업체명"
                        onChange={e => setDaily(p => ({
                          ...p,
                          continue_tomorrow: (p.continue_tomorrow || []).map((c, j) => j === i ? e.target.value : c),
                        }))}
                      />
                      <button type="button"
                        onClick={() => setDaily(p => ({
                          ...p,
                          continue_tomorrow: (p.continue_tomorrow || []).filter((_, j) => j !== i),
                        }))}
                        className="shrink-0 text-red-400 hover:text-red-600 font-bold text-sm">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
              {loading ? '전송 중...' : editDate ? '✏️ 마감보고 수정 전송 →' : '📋 마감보고 전송 →'}
            </button>
          </form>

          {/* 과거 마감보고 목록 */}
          {dailyReports.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">지난 마감보고 누적</h3>
                <span className="text-xs text-gray-400">{dailyReports.length}건</span>
              </div>
              <div className="divide-y divide-gray-50">
                {dailyReports.slice(0, 50).map(r => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{r.report_date}</span>
                      <p className="text-xs text-gray-400 mt-0.5">
                        당일계약 {r.data?.today_contracts || 0}건 · 월누적 {r.data?.month_contracts || 0}건 · 목표 {r.data?.goal || 0}건
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-2">
                      <button onClick={() => setViewReport(r)}
                        className="text-xs text-blue-500 hover:text-blue-700">상세보기</button>
                      <button onClick={() => loadForEdit(r)}
                        className="text-xs text-amber-500 hover:text-amber-700 font-medium">수정하기</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 상세보기 모달 */}
      {viewReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="font-bold text-gray-900">
                  {viewReport.report_type === 'morning' ? '☀️ 오전보고' : '📋 마감보고'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">{viewReport.report_date} · {userName}</p>
              </div>
              <button onClick={() => setViewReport(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
            </div>
            <div className="p-6">
              {viewReport.report_type === 'morning'
                ? <MorningDetailView data={viewReport.data} />
                : <DailyDetailView data={viewReport.data} />
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 섹션 래퍼 ────────────────────────────────────────────
function Section({ title, isEmpty, onToggleEmpty, onAdd, children }: {
  title: string
  isEmpty: boolean
  onToggleEmpty: () => void
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 text-sm">{title}</h4>
        <div className="flex gap-2">
          <button type="button" onClick={onToggleEmpty}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
              isEmpty ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}>
            없음
          </button>
          {!isEmpty && (
            <button type="button" onClick={onAdd}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors">
              + 추가
            </button>
          )}
        </div>
      </div>
      {isEmpty ? (
        <p className="text-xs text-gray-400 text-center py-2">해당 없음으로 표시됩니다</p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  )
}

// ── 업체명 자동완성 + 타임라인 컴포넌트 ───────────────────
function CompanyInput({ value, onChange, onKeyDown, allCompanies, companyHistory }: {
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  allCompanies: string[]
  companyHistory: { date: string; type: string; status: string; content: string }[]
}) {
  const [open, setOpen] = useState(false)
  const filtered = value.trim()
    ? allCompanies.filter(c => c.includes(value) && c !== value).slice(0, 8)
    : []

  return (
    <div className="relative">
      <input
        className={inp}
        placeholder="업체명 입력 후 Enter"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {/* 자동완성 드롭다운 */}
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.map(c => (
            <button key={c} type="button"
              onMouseDown={() => { onChange(c); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2">
              <span className="text-gray-300 text-xs">🕐</span>{c}
            </button>
          ))}
        </div>
      )}
      {/* 해당 업체 타임라인 */}
      {value.trim() && companyHistory.length > 0 && (
        <div className="mt-2 border border-blue-100 rounded-xl overflow-hidden bg-blue-50/30">
          <div className="px-3 py-1.5 bg-blue-100/60 flex items-center gap-1.5">
            <span className="text-[10px] text-blue-600 font-semibold">📋 {value} 과거 보고 기록</span>
          </div>
          <div className="divide-y divide-blue-100/60 max-h-48 overflow-y-auto">
            {companyHistory.map((h, i) => (
              <div key={i} className="px-3 py-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] text-gray-400">{h.date}</span>
                  {h.status && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                      {h.status}
                    </span>
                  )}
                </div>
                {h.content && <p className="text-xs text-gray-600">{h.content}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 상태 옵션 ─────────────────────────────────────────────
const CONSULT_STATUSES: { value: ConsultStatus; label: string; color: string }[] = [
  { value: '결정업체',   label: '결정업체',   color: 'bg-emerald-500 text-white border-emerald-500' },
  { value: '계약대기',   label: '계약대기',   color: 'bg-blue-500 text-white border-blue-500' },
  { value: '계약서대기', label: '계약서대기', color: 'bg-sky-500 text-white border-sky-500' },
  { value: '입금대기',   label: '입금대기',   color: 'bg-violet-500 text-white border-violet-500' },
  { value: '고민중',     label: '고민중',     color: 'bg-amber-500 text-white border-amber-500' },
  { value: '재통화예정', label: '재통화예정', color: 'bg-orange-500 text-white border-orange-500' },
  { value: '감성톡관리', label: '감성톡관리', color: 'bg-pink-500 text-white border-pink-500' },
]

// ── 공급DB / 아웃바운딩 행 ────────────────────────────────
function ConsultRow({ item, idx, onChange, onRemove, onLock, onUnlock, allCompanies, pastReports }: any) {
  const cur: ConsultStatus = item.status || (item.is_decided ? '결정업체' : '')
  const locked: boolean = !!item._locked
  const statusInfo = CONSULT_STATUSES.find(s => s.value === cur)

  // 해당 업체의 과거 보고 기록 추출
  const companyHistory: { date: string; type: string; status: string; content: string }[] =
    item.company?.trim()
      ? (pastReports as any[]).flatMap(r => {
          const entries: any[] = []
          const fields = ['supply_db', 'outbound'] as const
          fields.forEach(f => {
            ;(r.data?.[f] || []).forEach((c: any) => {
              if (c.company === item.company) {
                entries.push({
                  date: r.report_date + ' ' + (r.created_at ? new Date(r.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''),
                  type: f === 'supply_db' ? '공급DB' : '아웃바운딩',
                  status: c.status || (c.is_decided ? '결정업체' : ''),
                  content: c.content || '',
                })
              }
            })
          })
          return entries
        }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
      : []

  if (locked) {
    return (
      <div className="border-l-4 border-emerald-400 bg-emerald-50/50 rounded-r-lg p-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 text-sm">{item.company || '(업체명 없음)'}</span>
            {statusInfo && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            )}
            {cur === '재통화예정' && item.callback_date && (
              <span className="text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">{item.callback_date}</span>
            )}
          </div>
          {item.content && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.content}</p>}
        </div>
        <button type="button" onClick={onUnlock}
          className="shrink-0 text-xs text-amber-500 hover:text-amber-700 font-medium border border-amber-200 rounded-lg px-2 py-1 bg-white">
          수정
        </button>
      </div>
    )
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">#{idx + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">삭제</button>
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">업체명 <span className="text-gray-300">(Enter로 확정)</span></label>
        <CompanyInput
          value={item.company}
          onChange={v => onChange('company', v)}
          onKeyDown={e => e.key === 'Enter' && item.company.trim() && (e.preventDefault(), onLock())}
          allCompanies={allCompanies || []}
          companyHistory={companyHistory}
        />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-1 block">상태</label>
        <div className="flex flex-wrap gap-1.5">
          {CONSULT_STATUSES.map(s => (
            <button key={s.value} type="button"
              onClick={() => onChange('status', cur === s.value ? '' : s.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                cur === s.value ? s.color : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}>
              {s.label}
            </button>
          ))}
        </div>
        {cur === '재통화예정' && (
          <div className="mt-2">
            <label className="text-xs text-gray-400 mb-0.5 block">재통화 예정일</label>
            <input type="date" className={inp} value={item.callback_date || ''}
              onChange={e => onChange('callback_date', e.target.value)} />
          </div>
        )}
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">상담내용</label>
        <textarea className={inp + ' resize-none'} rows={2} placeholder="상담 내용을 입력하세요"
          value={item.content} onChange={e => onChange('content', e.target.value)} />
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onLock} disabled={!item.company?.trim()}
          className="text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
          ✓ 확정
        </button>
      </div>
    </div>
  )
}

// ── 고민관리업체 행 ──────────────────────────────────────
function WorriedRow({ item, idx, onChange, onRemove, onLock, onUnlock }: any) {
  const locked: boolean = !!item._locked
  const probColor = item.probability === '상' ? 'text-emerald-600' : item.probability === '중' ? 'text-amber-600' : 'text-red-500'

  if (locked) {
    return (
      <div className="border-l-4 border-amber-400 bg-amber-50/40 rounded-r-lg p-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 text-sm">{item.company || '(업체명 없음)'}</span>
            {item.probability && <span className={`text-xs font-bold ${probColor}`}>[{item.probability}]</span>}
          </div>
          {item.content && <p className="text-xs text-gray-500 mt-0.5 truncate">{item.content}</p>}
          {item.reason && <p className="text-xs text-gray-400 truncate">{item.reason}</p>}
        </div>
        <button type="button" onClick={onUnlock}
          className="shrink-0 text-xs text-amber-500 hover:text-amber-700 font-medium border border-amber-200 rounded-lg px-2 py-1 bg-white">
          수정
        </button>
      </div>
    )
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">#{idx + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">삭제</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">업체명</label>
          <input className={inp} placeholder="업체명" value={item.company}
            onChange={e => onChange('company', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && item.company.trim() && (e.preventDefault(), onLock())} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">계약 확률</label>
          <div className="flex gap-1">
            {(['상', '중', '하'] as const).map(p => (
              <button key={p} type="button"
                onClick={() => onChange('probability', p)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                  item.probability === p
                    ? p === '상' ? 'bg-emerald-500 text-white border-emerald-500'
                      : p === '중' ? 'bg-amber-400 text-white border-amber-400'
                      : 'bg-red-400 text-white border-red-400'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">상담내용</label>
        <textarea className={inp + ' resize-none'} rows={2} placeholder="상담 내용"
          value={item.content} onChange={e => onChange('content', e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">고민 사유</label>
        <input className={inp} placeholder="고민하는 이유" value={item.reason}
          onChange={e => onChange('reason', e.target.value)} />
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onLock} disabled={!item.company?.trim()}
          className="text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
          ✓ 확정
        </button>
      </div>
    </div>
  )
}

// ── 결정업체 행 ──────────────────────────────────────────
function DecidedRow({ item, idx, onChange, onRemove, onLock, onUnlock }: any) {
  const locked: boolean = !!item._locked

  if (locked) {
    return (
      <div className="border-l-4 border-blue-400 bg-blue-50/40 rounded-r-lg p-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-gray-800 text-sm">{item.company || '(업체명 없음)'}</span>
          {item.current_progress && <p className="text-xs text-gray-500 mt-0.5 truncate">진행: {item.current_progress}</p>}
          {item.next_action && <p className="text-xs text-gray-400 truncate">다음: {item.next_action}</p>}
        </div>
        <button type="button" onClick={onUnlock}
          className="shrink-0 text-xs text-amber-500 hover:text-amber-700 font-medium border border-amber-200 rounded-lg px-2 py-1 bg-white">
          수정
        </button>
      </div>
    )
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">#{idx + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">삭제</button>
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">업체명</label>
        <input className={inp} placeholder="업체명" value={item.company}
          onChange={e => onChange('company', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && item.company.trim() && (e.preventDefault(), onLock())} />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">상담내용</label>
        <textarea className={inp + ' resize-none'} rows={2} placeholder="상담 내용"
          value={item.content} onChange={e => onChange('content', e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">현재 진행 내용</label>
        <input className={inp} placeholder="현재 진행 상황" value={item.current_progress}
          onChange={e => onChange('current_progress', e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">이후 진행할 내용</label>
        <input className={inp} placeholder="다음 액션" value={item.next_action}
          onChange={e => onChange('next_action', e.target.value)} />
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onLock} disabled={!item.company?.trim()}
          className="text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
          ✓ 확정
        </button>
      </div>
    </div>
  )
}

// ── 미팅업체 행 ──────────────────────────────────────────
function MeetingRow({ item, idx, onChange, onRemove, onLock, onUnlock }: any) {
  const locked: boolean = !!item._locked

  if (locked) {
    return (
      <div className="border-l-4 border-violet-400 bg-violet-50/40 rounded-r-lg p-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-gray-800 text-sm">{item.company || '(업체명 없음)'}</span>
          {(item.date || item.time) && (
            <p className="text-xs text-gray-500 mt-0.5">{item.date} {item.time} {item.location && `· ${item.location}`}</p>
          )}
        </div>
        <button type="button" onClick={onUnlock}
          className="shrink-0 text-xs text-amber-500 hover:text-amber-700 font-medium border border-amber-200 rounded-lg px-2 py-1 bg-white">
          수정
        </button>
      </div>
    )
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">#{idx + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">삭제</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">업체명</label>
          <input className={inp} placeholder="업체명" value={item.company}
            onChange={e => onChange('company', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && item.company.trim() && (e.preventDefault(), onLock())} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">날짜</label>
          <input type="date" className={inp} value={item.date}
            onChange={e => onChange('date', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">시간</label>
          <input type="time" className={inp} value={item.time}
            onChange={e => onChange('time', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">장소</label>
          <input className={inp} placeholder="장소" value={item.location}
            onChange={e => onChange('location', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onLock} disabled={!item.company?.trim()}
          className="text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
          ✓ 확정
        </button>
      </div>
    </div>
  )
}

// ── 입금대기 업체 행 ─────────────────────────────────────
function PaymentRow({ item, idx, onChange, onRemove, onLock, onUnlock }: any) {
  const locked: boolean = !!item._locked

  if (locked) {
    return (
      <div className="border-l-4 border-sky-400 bg-sky-50/40 rounded-r-lg p-3 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-gray-800 text-sm">{item.company || '(업체명 없음)'}</span>
          <p className="text-xs text-gray-500 mt-0.5">
            {item.ceo_name && `${item.ceo_name} · `}{item.phone && `${item.phone}`}
            {item.first_call_date && ` · 첫콜 ${item.first_call_date}`}
          </p>
        </div>
        <button type="button" onClick={onUnlock}
          className="shrink-0 text-xs text-amber-500 hover:text-amber-700 font-medium border border-amber-200 rounded-lg px-2 py-1 bg-white">
          수정
        </button>
      </div>
    )
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">#{idx + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">삭제</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">첫 콜 날짜</label>
          <input type="date" className={inp} value={item.first_call_date}
            onChange={e => onChange('first_call_date', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">업체명</label>
          <input className={inp} placeholder="업체명" value={item.company}
            onChange={e => onChange('company', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && item.company.trim() && (e.preventDefault(), onLock())} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">대표명</label>
          <input className={inp} placeholder="대표명" value={item.ceo_name}
            onChange={e => onChange('ceo_name', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">전화번호</label>
          <input className={inp} placeholder="010-0000-0000" value={item.phone}
            onChange={e => onChange('phone', e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={onLock} disabled={!item.company?.trim()}
          className="text-xs bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
          ✓ 확정
        </button>
      </div>
    </div>
  )
}

// ── 오전보고 상세 뷰 ──────────────────────────────────────
function MorningDetailView({ data }: { data: any }) {
  const tc = Number(data?.total_calls || 0)
  const cn = Number(data?.connected || 0)
  const nc = Number(data?.no_connect || 0)
  const db = Number(data?.db_secured || 0)
  const oc = Number(data?.outbound_contracts || 0)
  const p = (n: number) => tc === 0 ? '—' : (n / tc * 100).toFixed(1) + '%'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: '총 콜 수', value: tc + '건', sub: null, color: 'text-gray-900' },
          { label: '연결안됨', value: nc + '건', sub: p(nc) + ' 미연결율', color: 'text-gray-600' },
          { label: '연결됨', value: cn + '건', sub: p(cn) + ' 연결율', color: 'text-amber-600' },
          { label: 'DB확보', value: db + '건', sub: p(db) + ' 확보율', color: 'text-blue-600' },
          { label: '아웃바운딩 계약', value: oc + '건', sub: p(oc) + ' 계약율', color: 'text-green-600' },
        ].map(f => (
          <div key={f.label} className="bg-gray-50 rounded-xl p-3.5">
            <p className="text-xs text-gray-400 mb-1">{f.label}</p>
            <p className={`text-2xl font-black ${f.color}`}>{f.value}</p>
            {f.sub && <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{f.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 마감보고 상세 뷰 ──────────────────────────────────────
function DailyDetailView({ data }: { data: any }) {
  const goal = Number(data?.goal || 0)
  const month = Number(data?.month_contracts || 0)
  const remaining = goal > 0 ? Math.max(0, goal - month) : null
  const rate = goal > 0 ? Math.round(month / goal * 100) : null

  return (
    <div className="space-y-5">
      {/* 계약 현황 */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">계약 현황</p>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: '당일 계약', value: (data?.today_contracts || 0) + '건', color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: '이번달 누적', value: month + '건', color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: '월 목표', value: goal > 0 ? goal + '건' : '미설정', color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: '남은 목표', value: remaining !== null ? remaining + '건' + (rate !== null ? ` (${rate}%)` : '') : '—', color: 'text-amber-700', bg: 'bg-amber-50' },
          ].map(f => (
            <div key={f.label} className={`${f.bg} rounded-xl p-3`}>
              <p className="text-xs text-gray-400 mb-0.5">{f.label}</p>
              <p className={`text-xl font-black ${f.color}`}>{f.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 공급DB 상담결과 */}
      {data?.supply_db !== null && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">공급DB 상담결과</p>
          {(data?.supply_db || []).length === 0 ? (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">항목 없음</p>
          ) : (
            <div className="space-y-2">
              {(data.supply_db as any[]).map((item: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-800 text-sm">{item.company}</span>
                    {(item.status || (item.is_decided ? '결정업체' : '')) && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">
                        {item.status || '결정업체'}
                      </span>
                    )}
                    {item.status === '재통화예정' && item.callback_date && (
                      <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">{item.callback_date}</span>
                    )}
                  </div>
                  {item.content && <p className="text-xs text-gray-500">{item.content}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 아웃바운딩 상담결과 */}
      {data?.outbound !== null && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">아웃바운딩 상담결과</p>
          {(data?.outbound || []).length === 0 ? (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">항목 없음</p>
          ) : (
            <div className="space-y-2">
              {(data.outbound as any[]).map((item: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-800 text-sm">{item.company}</span>
                    {(item.status || (item.is_decided ? '결정업체' : '')) && (
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-semibold">
                        {item.status || '결정업체'}
                      </span>
                    )}
                    {item.status === '재통화예정' && item.callback_date && (
                      <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">{item.callback_date}</span>
                    )}
                  </div>
                  {item.content && <p className="text-xs text-gray-500">{item.content}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 미팅 일정 */}
      {(data?.meetings || []).length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">미팅 일정</p>
          <div className="space-y-2">
            {(data.meetings as any[]).map((m: any, i: number) => (
              <div key={i} className="flex items-center gap-3 bg-blue-50 rounded-xl p-3 border border-blue-100">
                <div className="text-blue-500 text-lg">📅</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{m.company}</p>
                  <p className="text-xs text-gray-500">{m.date} {m.time} {m.location && `· ${m.location}`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 입금대기 */}
      {(data?.payment_waiting || []).length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">입금대기 업체</p>
          <div className="space-y-2">
            {(data.payment_waiting as any[]).map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-3 bg-amber-50 rounded-xl p-3 border border-amber-100">
                <div className="text-amber-500 text-lg">💰</div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{p.company} ({p.ceo_name})</p>
                  <p className="text-xs text-gray-500">{p.phone} · 최초콜 {p.first_call_date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 걱정되는 업체 */}
      {(data?.worried || []).length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">검토 필요 업체</p>
          <div className="space-y-2">
            {(data.worried as any[]).map((w: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-gray-800">{w.company}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                    w.probability === '상' ? 'bg-green-100 text-green-600'
                    : w.probability === '중' ? 'bg-yellow-100 text-yellow-600'
                    : 'bg-red-100 text-red-500'
                  }`}>{w.probability}</span>
                </div>
                {w.reason && <p className="text-xs text-gray-500">사유: {w.reason}</p>}
                {w.content && <p className="text-xs text-gray-500">내용: {w.content}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
