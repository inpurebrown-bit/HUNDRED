'use client'

import { useState, useEffect, useRef, RefObject } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  getBusinessDaysInMonth as _bizInMonth,
  getElapsedBusinessDays as _bizElapsed,
  getRemainingBusinessDays as _bizRemaining,
} from '@/lib/businessDays'

// ─── Interfaces ───────────────────────────────────────────

interface MonthlyRevenue {
  month: string
  영업팀: number
  관리팀: number
  합계: number
}

interface RevenueData {
  monthly: MonthlyRevenue[]
  salesByUser: { name: string; amount: number; count: number }[]
  opsByUser: { name: string; amount: number; count: number }[]
  totalSales: number
  totalOps: number
  total: number
}

interface Contract {
  id: string
  created_at: string
  sales_user_id: string
  sales_user_name: string
  contract_amount: number
  status: string
  progress_stage?: string
  tax_invoice_requested?: boolean
  memo?: string
}

interface OpsCase {
  id: string
  created_at: string
  progress_stage: string
  revenue?: number
}

interface Report {
  id: string
  report_date?: string
  created_at?: string
}

interface CalEvent {
  id: string
  start_date?: string
  date?: string
}

interface SalesGoal {
  user_name: string
  goal_count: number | string
}

interface AsRequest {
  id: string
  company_name?: string
  company?: string
  request_type?: string
  type?: string
  sales_user_name?: string
  assigned_user_name?: string
  manager?: string
  created_at?: string
}

interface EmployeeRow {
  name: string
  goal: number | null
  contracted: number
  elapsed: number
  remaining: number
  projected: number | null
  dailyNeeded: number | null
}

// ─── Business day utilities (1-indexed month wrappers) ───

function getMonthBusinessDays(year: number, month: number): number {
  return _bizInMonth(year, month - 1)
}

function getElapsedBusinessDays(year: number, month: number): number {
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month - 1
  const dayOfMonth = isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate()
  return _bizElapsed(year, month - 1, dayOfMonth)
}

function getRemainingBusinessDays(year: number, month: number): number {
  const now = new Date()
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month - 1
  if (!isCurrentMonth) return 0
  return _bizRemaining(year, month - 1, now.getDate())
}

// ─── Loading skeleton ─────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#E8E2D4] rounded ${className ?? ''}`} />
}

// ─── Mini stat card ───────────────────────────────────────

interface MiniCardProps {
  icon: string
  label: string
  value: string | null
  loading: boolean
  color?: string
  onClick?: () => void
}

function MiniCard({ icon, label, value, loading, color = 'text-[#1B2A45]', onClick }: MiniCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-[#E8E2D4] p-4 flex items-center gap-3 ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}
    >
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-[#1B2A45]/50 mb-0.5 truncate">{label}</p>
        {loading || value === null ? (
          <Skeleton className="h-6 w-16" />
        ) : (
          <p className={`text-xl font-black ${color} leading-tight`}>{value}</p>
        )}
      </div>
    </div>
  )
}

// ─── Employee table ───────────────────────────────────────

function EmployeeTable({ rows, loading }: { rows: EmployeeRow[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-32 w-full" />
  if (rows.length === 0) {
    return <p className="text-sm text-[#1B2A45]/40 text-center py-4">직원 데이터 없음</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E8E2D4]">
            {['담당자', '목표', '결제수', '경과영업일', '잔여영업일', '예상마감', '일필요수'].map(h => (
              <th
                key={h}
                className="text-left py-2 px-3 text-xs text-[#1B2A45]/50 font-medium whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#E8E2D4]/60 hover:bg-[#FAF8F3] transition-colors">
              <td className="py-2.5 px-3 font-medium text-[#1B2A45] whitespace-nowrap">{row.name}</td>
              <td className="py-2.5 px-3 text-[#1B2A45]/70">
                {row.goal === null ? (
                  <span className="text-xs text-[#C5A258] bg-[#C5A258]/10 px-2 py-0.5 rounded-full">
                    미설정
                  </span>
                ) : (
                  row.goal + '건'
                )}
              </td>
              <td className="py-2.5 px-3 font-semibold text-[#1B2A45]">{row.contracted}건</td>
              <td className="py-2.5 px-3 text-[#1B2A45]/60">{row.elapsed}일</td>
              <td className="py-2.5 px-3 text-[#1B2A45]/60">{row.remaining}일</td>
              <td className="py-2.5 px-3 text-[#1B2A45]/70">
                {row.projected !== null ? row.projected + '건' : '-'}
              </td>
              <td className="py-2.5 px-3">
                {row.dailyNeeded !== null ? (
                  <span className="text-xs font-semibold text-[#C5A258] bg-[#C5A258]/10 px-2 py-0.5 rounded-full">
                    {row.dailyNeeded}건/일
                  </span>
                ) : (
                  <span className="text-[#1B2A45]/40">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Month section ────────────────────────────────────────

interface MonthSectionProps {
  title: string
  loading: boolean
  contractCount: number
  inProgressCount: number
  taxAmount: number
  employeeRows: EmployeeRow[]
}

function MonthSection({
  title,
  loading,
  contractCount,
  inProgressCount,
  taxAmount,
  employeeRows,
}: MonthSectionProps) {
  const stats = [
    { label: '이번달 총 계약 수', value: contractCount + '건' },
    { label: '진행중 건수', value: inProgressCount + '건' },
    { label: '발생 세금 (매출 10%)', value: taxAmount > 0 ? (taxAmount / 10000).toFixed(0) + '만원' : '-' },
  ]

  return (
    <section className="bg-white rounded-xl border border-[#E8E2D4] p-5 space-y-4">
      <h2 className="font-semibold text-[#1B2A45] text-base">{title}</h2>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-[#FAF8F3] rounded-lg p-3">
              <p className="text-xs text-[#1B2A45]/50 mb-1">{s.label}</p>
              <p className="text-lg font-bold text-[#1B2A45]">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-[#1B2A45]/50 uppercase tracking-wide mb-2">
          직원별 결제율 (영업일 기준)
        </p>
        <div className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
          <EmployeeTable rows={employeeRows} loading={loading} />
        </div>
      </div>
    </section>
  )
}

// ─── Custom tooltip ───────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-[#E8E2D4] rounded-lg p-3 text-xs shadow-md">
      <p className="font-semibold text-[#1B2A45] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill }}>
          {p.dataKey}: {p.value.toLocaleString()}만원
        </p>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────

export default function OverviewTabNew() {
  const [loading, setLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null)
  const [assignContracts, setAssignContracts] = useState<Contract[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [events, setEvents] = useState<CalEvent[]>([])
  const [allContracts, setAllContracts] = useState<Contract[]>([])
  const [opsCases, setOpsCases] = useState<OpsCase[]>([])
  const [salesGoals, setSalesGoals] = useState<SalesGoal[]>([])
  const [lastMonthGoals, setLastMonthGoals] = useState<SalesGoal[]>([])
  const [asRequests, setAsRequests] = useState<AsRequest[]>([])
  const [markingId, setMarkingId] = useState<string | null>(null)

  // Section refs for scroll-to
  const chartRef = useRef<HTMLDivElement>(null)
  const thisMonthRef = useRef<HTMLDivElement>(null)
  const lastMonthRef = useRef<HTMLDivElement>(null)
  const asRef = useRef<HTMLDivElement>(null)

  // Date calculations
  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1
  const thisMonthStr = `${thisYear}-${String(thisMonth).padStart(2, '0')}`
  const todayStr = now.toISOString().slice(0, 10)

  const lastMonthDate = new Date(thisYear, thisMonth - 2, 1)
  const lastYear = lastMonthDate.getFullYear()
  const lastMonth = lastMonthDate.getMonth() + 1
  const lastMonthStr = `${lastYear}-${String(lastMonth).padStart(2, '0')}`

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [
          revRes,
          assignRes,
          reportsRes,
          eventsRes,
          contractsRes,
          opsRes,
          goalsRes,
          lastGoalsRes,
          asRes,
        ] = await Promise.all([
          fetch('/api/revenue').catch(() => null),
          fetch('/api/assign').catch(() => null),
          fetch('/api/reports').catch(() => null),
          fetch('/api/events').catch(() => null),
          fetch('/api/contracts').catch(() => null),
          fetch('/api/ops-cases').catch(() => null),
          fetch(`/api/sales-goals?year_month=${thisMonthStr}`).catch(() => null),
          fetch(`/api/sales-goals?year_month=${lastMonthStr}`).catch(() => null),
          fetch('/api/as-requests?status=pending').catch(() => null),
        ])

        const [
          revData,
          assignData,
          reportsData,
          eventsData,
          contractsData,
          opsData,
          goalsData,
          lastGoalsData,
          asData,
        ] = await Promise.all([
          revRes?.json().catch(() => ({})) ?? {},
          assignRes?.json().catch(() => ({})) ?? {},
          reportsRes?.json().catch(() => ({})) ?? {},
          eventsRes?.json().catch(() => ({})) ?? {},
          contractsRes?.json().catch(() => ({})) ?? {},
          opsRes?.json().catch(() => ({})) ?? {},
          goalsRes?.json().catch(() => ({})) ?? {},
          lastGoalsRes?.json().catch(() => ({})) ?? {},
          asRes?.json().catch(() => ({})) ?? {},
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = (d: unknown) => (d as any)
        setRevenueData(revData as RevenueData)
        setAssignContracts(a(assignData).contracts ?? [])
        setReports(a(reportsData).reports ?? [])
        setEvents(a(eventsData).events ?? [])
        setAllContracts(a(contractsData).contracts ?? [])
        setOpsCases(a(opsData).cases ?? [])
        setSalesGoals(a(goalsData).goals ?? [])
        setLastMonthGoals(a(lastGoalsData).goals ?? [])
        setAsRequests(a(asData).requests ?? [])
      } catch {
        // silently ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [thisMonthStr, lastMonthStr])

  // ── Derived values ──────────────────────────────────────

  const todayReports = reports.filter(
    r => r.report_date === todayStr || r.created_at?.slice(0, 10) === todayStr
  )
  const todayEvents = events.filter(
    e => (e.start_date ?? e.date ?? '').slice(0, 10) === todayStr
  )

  // Revenue chart — last 3 months
  const chartData = (revenueData?.monthly ?? []).slice(-3).map(m => ({
    ...m,
    영업팀: Math.round(m.영업팀 / 10000),
    관리팀: Math.round(m.관리팀 / 10000),
    합계: Math.round(m.합계 / 10000),
  }))

  // This month revenue for mini card
  const thisMonthRevRaw =
    revenueData?.monthly?.find(m => {
      // API returns month like "05월"
      const mmStr = String(thisMonth).padStart(2, '0') + '월'
      return m.month === mmStr || m.month === thisMonthStr
    })?.합계 ?? 0
  const thisMonthRevDisplay =
    thisMonthRevRaw >= 10000
      ? (thisMonthRevRaw / 10000).toFixed(0) + '만원'
      : thisMonthRevRaw > 0
      ? thisMonthRevRaw.toLocaleString() + '원'
      : '-'

  // Contracts
  const thisMonthContracts = allContracts.filter(
    c => (c.created_at ?? '').slice(0, 7) === thisMonthStr
  )
  const lastMonthContracts = allContracts.filter(
    c => (c.created_at ?? '').slice(0, 7) === lastMonthStr
  )

  // In-progress ops cases
  const completedStages = ['completed', 'rejected']
  const thisInProgress = opsCases.filter(
    c =>
      (c.created_at ?? '').slice(0, 7) === thisMonthStr &&
      !completedStages.includes(c.progress_stage ?? '')
  ).length
  const lastInProgress = opsCases.filter(
    c =>
      (c.created_at ?? '').slice(0, 7) === lastMonthStr &&
      !completedStages.includes(c.progress_stage ?? '')
  ).length

  // Tax
  const lastMonthRevRaw =
    revenueData?.monthly?.find(m => {
      const mmStr = String(lastMonth).padStart(2, '0') + '월'
      return m.month === mmStr || m.month === lastMonthStr
    })?.합계 ?? 0
  const thisMonthTax = Math.round(thisMonthRevRaw * 0.1)
  const lastMonthTax = Math.round(lastMonthRevRaw * 0.1)

  // Business days — this month
  const thisTotalBiz = getMonthBusinessDays(thisYear, thisMonth)
  const thisElapsed = getElapsedBusinessDays(thisYear, thisMonth)
  const thisRemaining = getRemainingBusinessDays(thisYear, thisMonth)

  // Business days — last month (all elapsed, 0 remaining)
  const lastTotalBiz = getMonthBusinessDays(lastYear, lastMonth)
  const lastElapsed = lastTotalBiz
  const lastRemaining = 0

  // Build per-user rows from contracts + goals
  function buildRows(
    contracts: Contract[],
    goals: SalesGoal[],
    elapsed: number,
    remaining: number
  ): EmployeeRow[] {
    const userMap: Record<string, { name: string; count: number }> = {}
    for (const c of contracts) {
      const uid = c.sales_user_id
      if (!uid) continue
      if (!userMap[uid]) userMap[uid] = { name: c.sales_user_name ?? uid, count: 0 }
      userMap[uid].count++
    }

    return Object.values(userMap).map(u => {
      const goalEntry = goals.find(g => g.user_name === u.name)
      const goal = goalEntry ? Number(goalEntry.goal_count) : null
      const contracted = u.count
      const projected =
        elapsed > 0 ? Math.round((contracted / elapsed) * (elapsed + remaining)) : null
      const dailyNeeded =
        remaining > 0 && goal !== null && goal > contracted
          ? Math.ceil((goal - contracted) / remaining)
          : null

      return {
        name: u.name,
        goal,
        contracted,
        elapsed,
        remaining,
        projected,
        dailyNeeded,
      }
    })
  }

  const thisMonthRows = buildRows(thisMonthContracts, salesGoals, thisElapsed, thisRemaining)
  const lastMonthRows = buildRows(lastMonthContracts, lastMonthGoals, lastElapsed, lastRemaining)

  // ── A/S confirm ─────────────────────────────────────────

  async function handleConfirm(id: string) {
    setMarkingId(id)
    try {
      await fetch('/api/as-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'reviewed' }),
      })
      setAsRequests(prev => prev.filter(r => r.id !== id))
    } catch {
      // silently ignore
    } finally {
      setMarkingId(null)
    }
  }

  // ── Scroll helpers ───────────────────────────────────────

  function scrollTo(ref: RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Y-axis formatter ─────────────────────────────────────

  const fmtY = (v: number) => v.toLocaleString() + '만'

  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-10">

      {/* ═══ 1. TOP MINI-CARDS ROW ══════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniCard
          icon="📋"
          label="배정 대기"
          value={loading ? null : assignContracts.length + '건'}
          loading={loading}
          color="text-[#C5A258]"
          onClick={() => scrollTo(chartRef)}
        />
        <MiniCard
          icon="📝"
          label="오늘 보고"
          value={loading ? null : todayReports.length + '건'}
          loading={loading}
          color="text-[#1B2A45]"
          onClick={() => scrollTo(thisMonthRef)}
        />
        <MiniCard
          icon="📅"
          label="오늘 일정"
          value={loading ? null : todayEvents.length + '건'}
          loading={loading}
          color="text-[#1B2A45]"
          onClick={() => scrollTo(thisMonthRef)}
        />
        <MiniCard
          icon="💰"
          label="이달 매출"
          value={loading ? null : thisMonthRevDisplay}
          loading={loading}
          color="text-[#C5A258]"
          onClick={() => scrollTo(chartRef)}
        />
      </div>

      {/* ═══ 2. 3-MONTH SALES CHART ═════════════════════════ */}
      <div ref={chartRef} className="bg-white rounded-xl border border-[#E8E2D4] p-5">
        <h2 className="font-semibold text-[#1B2A45] text-base mb-4">최근 3개월 매출 추이</h2>
        {loading ? (
          <Skeleton className="h-52 w-full" />
        ) : chartData.length === 0 || chartData.every(m => m.합계 === 0) ? (
          <div className="h-52 flex items-center justify-center text-sm text-[#1B2A45]/40">
            매출 데이터 없음
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#1B2A45' }} />
              <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#1B2A45' }} width={56} />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => <span style={{ color: '#1B2A45' }}>{value}</span>}
              />
              <Bar dataKey="영업팀" fill="#1B2A45" radius={[4, 4, 0, 0]} maxBarSize={48} />
              <Bar dataKey="관리팀" fill="#C5A258" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <p className="text-xs text-[#1B2A45]/40 mt-2 text-right">단위: 만원</p>
      </div>

      {/* ═══ 3. THIS MONTH SECTION ══════════════════════════ */}
      <div ref={thisMonthRef}>
        <MonthSection
          title={`${thisMonth}월 현황`}
          loading={loading}
          contractCount={thisMonthContracts.length}
          inProgressCount={thisInProgress}
          taxAmount={thisMonthTax}
          employeeRows={thisMonthRows}
        />
      </div>

      {/* ═══ 4. LAST MONTH SECTION ══════════════════════════ */}
      <div ref={lastMonthRef}>
        <MonthSection
          title={`${lastMonth}월 현황`}
          loading={loading}
          contractCount={lastMonthContracts.length}
          inProgressCount={lastInProgress}
          taxAmount={lastMonthTax}
          employeeRows={lastMonthRows}
        />
      </div>

      {/* ═══ 5. A/S 요청 섹션 ═══════════════════════════════ */}
      <div ref={asRef}>
        <section className="bg-amber-50 border border-amber-100 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#1B2A45] text-base">A/S 요청</h2>
            {!loading && (
              <span className="text-xs bg-amber-200 text-amber-800 px-2.5 py-0.5 rounded-full font-semibold">
                {asRequests.length}건 대기
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : asRequests.length === 0 ? (
            <p className="text-sm text-[#1B2A45]/40 text-center py-6">대기 중인 A/S 요청 없음</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-200">
                    {['업체명', '요청 유형', '담당 영업', '접수일', ''].map(h => (
                      <th
                        key={h}
                        className="text-left py-2 px-3 text-xs text-[#1B2A45]/50 font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {asRequests.map(req => (
                    <tr
                      key={req.id}
                      className="border-b border-amber-100 hover:bg-amber-100/50 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-medium text-[#1B2A45] whitespace-nowrap">
                        {req.company_name ?? req.company ?? '-'}
                      </td>
                      <td className="py-2.5 px-3 text-[#1B2A45]/70">
                        {req.request_type ?? req.type ?? '-'}
                      </td>
                      <td className="py-2.5 px-3 text-[#1B2A45]/70">
                        {req.sales_user_name ?? req.assigned_user_name ?? req.manager ?? '-'}
                      </td>
                      <td className="py-2.5 px-3 text-[#1B2A45]/50 text-xs whitespace-nowrap">
                        {req.created_at
                          ? new Date(req.created_at).toLocaleDateString('ko-KR')
                          : '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleConfirm(req.id)}
                          disabled={markingId === req.id}
                          className="text-xs bg-[#1B2A45] hover:bg-[#253B5E] disabled:opacity-50 text-white px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap"
                        >
                          {markingId === req.id ? '처리 중...' : '확인완료'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
