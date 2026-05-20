'use client'

import { useState, useEffect, useRef, RefObject, FormEvent } from 'react'
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
import { SUPPLY_RATE_TABLE, isActiveRow, contractWeight, calcRecommendedSupply } from '@/lib/supplyRules'
import PayRateTab from './PayRateTab'

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
  customer_id?: string
  created_at: string
  sales_user_id: string
  sales_user_name: string
  contract_amount: number
  vat_included?: boolean
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

interface EmployeeRow {
  name: string
  goal: number | null
  contracted: number
  elapsed: number
  remaining: number
  projected: number | null
  dailyNeeded: number | null
  supplyRate?: number | null   // 공급결제율 (%)
  totalRate?: number | null    // 총결제율 (%)
  supplyCount?: number         // 공급수
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
          <tr className="bg-[#1B2A45]/5">
            {['담당자', '목표', '결제수', '예상마감', '일필요수', '공급결제율', '총결제율'].map(h => (
              <th key={h} className="text-left py-2.5 px-3 text-xs text-[#1B2A45]/50 font-semibold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const supG = rateGrade(row.supplyRate ?? null, 40)
            const totG = rateGrade(row.totalRate ?? null, 30)
            return (
              <tr key={i} className="border-b border-[#E8E2D4]/60 hover:bg-[#FAF8F3] transition-colors">
                <td className="py-3 px-3 font-semibold text-[#1B2A45] whitespace-nowrap">{row.name}</td>
                <td className="py-3 px-3 text-[#1B2A45]/70">
                  {row.goal === null ? (
                    <span className="text-[10px] text-[#C5A258] bg-[#C5A258]/10 px-2 py-0.5 rounded-full">미설정</span>
                  ) : row.goal + '건'}
                </td>
                <td className="py-3 px-3">
                  <span className="font-black text-[#1B2A45] text-base">{row.contracted % 1 === 0 ? row.contracted : row.contracted.toFixed(1)}</span>
                  <span className="text-xs text-[#1B2A45]/40 ml-0.5">건</span>
                </td>
                <td className="py-3 px-3 text-[#1B2A45]/70">
                  {row.projected !== null ? (row.projected % 1 === 0 ? row.projected : row.projected.toFixed(1)) + '건' : '-'}
                </td>
                <td className="py-3 px-3">
                  {row.dailyNeeded !== null ? (
                    <span className="text-xs font-bold text-[#C5A258] bg-[#C5A258]/10 px-2 py-0.5 rounded-full">
                      {row.dailyNeeded}건/일
                    </span>
                  ) : (
                    <span className="text-[#1B2A45]/30 text-xs">—</span>
                  )}
                </td>
                <td className="py-3 px-3">
                  {row.supplyRate != null ? (
                    <div>
                      <span className="text-xs text-[#1B2A45]/50 mr-1">{row.supplyRate.toFixed(1)}%</span>
                      <span className={`text-[11px] ${supG.cls}`}>{supG.label}</span>
                    </div>
                  ) : <span className="text-[#1B2A45]/30 text-xs">—</span>}
                </td>
                <td className="py-3 px-3">
                  {row.totalRate != null ? (
                    <div>
                      <span className="text-xs text-[#1B2A45]/50 mr-1">{row.totalRate.toFixed(1)}%</span>
                      <span className={`text-[11px] ${totG.cls}`}>{totG.label}</span>
                    </div>
                  ) : <span className="text-[#1B2A45]/30 text-xs">—</span>}
                </td>
              </tr>
            )
          })}
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
  salesRevenueAmount?: number
  opsRevenueAmount?: number
}

function fmtKrw(n: number): string {
  if (n <= 0) return '-'
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억원'
  if (n >= 10000) return (n / 10000).toFixed(0) + '만원'
  return n.toLocaleString('ko-KR') + '원'
}

function rateGrade(rate: number | null, top: number) {
  if (rate === null || rate === undefined) return { label: '—', cls: 'text-gray-400' }
  if (rate >= top)        return { label: '🔥 최상', cls: 'text-blue-600 font-bold' }
  if (rate >= top - 5)    return { label: '✨ 우수', cls: 'text-cyan-600 font-bold' }
  if (rate >= top - 10)   return { label: '✅ 양호', cls: 'text-emerald-600 font-bold' }
  if (rate >= top - 15)   return { label: '📊 보통', cls: 'text-amber-500 font-bold' }
  if (rate >= top - 20)   return { label: '⚠️ 미흡', cls: 'text-orange-400 font-bold' }
  if (rate >= top - 25)   return { label: '⚡ 부진', cls: 'text-orange-600 font-bold' }
  return                         { label: '🚨 위험', cls: 'text-red-500 font-bold' }
}

function MonthSection({
  title,
  loading,
  contractCount,
  inProgressCount,
  taxAmount,
  employeeRows,
  salesRevenueAmount = 0,
  opsRevenueAmount = 0,
}: MonthSectionProps) {
  const totalRevenue = salesRevenueAmount + opsRevenueAmount

  return (
    <section className="bg-white rounded-2xl border border-[#E8E2D4] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E8E2D4] flex items-center justify-between bg-gradient-to-r from-[#1B2A45]/3 to-transparent">
        <h2 className="font-bold text-[#1B2A45] text-base">{title}</h2>
        <span className="text-[11px] text-[#1B2A45]/40 bg-[#1B2A45]/5 px-2 py-1 rounded-lg">
          계약 {(contractCount % 1 === 0 ? contractCount : contractCount.toFixed(1))}건
        </span>
      </div>

      {/* 직원별 현황 */}
      <div className="px-5 py-4 border-b border-[#E8E2D4]/60">
        <p className="text-[11px] font-bold text-[#1B2A45]/40 uppercase tracking-widest mb-3">직원별 현황</p>
        {loading ? <Skeleton className="h-32 w-full" /> : (
          <EmployeeTable rows={employeeRows} loading={loading} />
        )}
      </div>

      {/* 이달 집계 */}
      <div className="px-5 py-4">
        <p className="text-[11px] font-bold text-[#1B2A45]/40 uppercase tracking-widest mb-3">이달 집계</p>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#1B2A45] rounded-xl p-3">
              <p className="text-[10px] text-white/50 mb-1">영업팀 발생매출</p>
              <p className="text-lg font-black text-white">{fmtKrw(salesRevenueAmount)}</p>
            </div>
            <div className="bg-emerald-700 rounded-xl p-3">
              <p className="text-[10px] text-white/50 mb-1">관리팀 발생매출</p>
              <p className="text-lg font-black text-white">{fmtKrw(opsRevenueAmount)}</p>
            </div>
            <div className="bg-violet-50 rounded-xl p-3">
              <p className="text-[10px] text-[#1B2A45]/50 mb-1">진행중 건수</p>
              <p className="text-lg font-black text-violet-600">{inProgressCount}건</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-[10px] text-[#1B2A45]/50 mb-1">발생 세금 (10%)</p>
              <p className="text-lg font-black text-red-500">{taxAmount > 0 ? fmtKrw(taxAmount) : '-'}</p>
            </div>
          </div>
        )}
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

export default function OverviewTabNew({ onNavigate }: { onNavigate?: (tab: string, subView?: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null)
  const [assignContracts, setAssignContracts] = useState<Contract[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [events, setEvents] = useState<CalEvent[]>([])
  const [allContracts, setAllContracts] = useState<Contract[]>([])
  const [allCustomers, setAllCustomers] = useState<any[]>([])  // customers 테이블에서 직접
  const [opsCases, setOpsCases] = useState<OpsCase[]>([])
  const [salesGoals, setSalesGoals] = useState<SalesGoal[]>([])
  const [lastMonthGoals, setLastMonthGoals] = useState<SalesGoal[]>([])
  const [supplyConfigMap, setSupplyConfigMap] = useState<Record<string, { base?: number }>>({})
  const [payRateEmps, setPayRateEmps] = useState<{ name: string; target: number }[]>([])

  // Section refs for scroll-to
  const chartRef = useRef<HTMLDivElement>(null)
  const thisMonthRef = useRef<HTMLDivElement>(null)
  const lastMonthRef = useRef<HTMLDivElement>(null)
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
          customersRes,
          opsRes,
          goalsRes,
          lastGoalsRes,
          supplyRes,
          payRateRes,
        ] = await Promise.all([
          fetch('/api/revenue').catch(() => null),
          fetch('/api/assign').catch(() => null),
          fetch('/api/reports').catch(() => null),
          fetch('/api/events').catch(() => null),
          fetch('/api/contracts').catch(() => null),
          fetch('/api/customers').catch(() => null),
          fetch('/api/ops-cases').catch(() => null),
          fetch(`/api/sales-goals?year_month=${thisMonthStr}`).catch(() => null),
          fetch(`/api/sales-goals?year_month=${lastMonthStr}`).catch(() => null),
          fetch('/api/supply-config').catch(() => null),
          fetch(`/api/payrate?year_month=${thisMonthStr}`).catch(() => null),
        ])

        const [
          revData,
          assignData,
          reportsData,
          eventsData,
          contractsData,
          customersData,
          opsData,
          goalsData,
          lastGoalsData,
          supplyData,
          payRateData,
        ] = await Promise.all([
          revRes?.json().catch(() => ({})) ?? {},
          assignRes?.json().catch(() => ({})) ?? {},
          reportsRes?.json().catch(() => ({})) ?? {},
          eventsRes?.json().catch(() => ({})) ?? {},
          contractsRes?.json().catch(() => ({})) ?? {},
          customersRes?.json().catch(() => ({})) ?? {},
          opsRes?.json().catch(() => ({})) ?? {},
          goalsRes?.json().catch(() => ({})) ?? {},
          lastGoalsRes?.json().catch(() => ({})) ?? {},
          supplyRes?.json().catch(() => ({})) ?? {},
          payRateRes?.json().catch(() => ({})) ?? {},
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = (d: unknown) => (d as any)
        setRevenueData(revData as RevenueData)
        setAssignContracts(a(assignData).contracts ?? [])
        setReports(a(reportsData).reports ?? [])
        setEvents(a(eventsData).events ?? [])
        setAllContracts(a(contractsData).contracts ?? [])
        setAllCustomers(a(customersData).customers ?? [])
        setOpsCases(a(opsData).cases ?? [])
        setSalesGoals(a(goalsData).sales_goals ?? a(goalsData).goals ?? [])
        setLastMonthGoals(a(lastGoalsData).sales_goals ?? a(lastGoalsData).goals ?? [])
        // config 형식: { month, people: { 이름: { goal, base, supplied } } }
        setSupplyConfigMap(a(supplyData).config?.people ?? a(supplyData).config ?? {})
        // payrate 직원별 목표 개수
        const empDetails: any[] = a(payRateData).record?.employee_details ?? []
        setPayRateEmps(empDetails.map((e: any) => ({ name: String(e.name || ''), target: Number(e.target || 0) })))
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
  const thisMonthRevEntry = revenueData?.monthly?.find(m => {
    const mmStr = String(thisMonth).padStart(2, '0') + '월'
    return m.month === mmStr || m.month === thisMonthStr
  })
  const thisMonthRevRaw = thisMonthRevEntry?.합계 ?? 0
  const thisMonthOpsRaw = thisMonthRevEntry?.관리팀 ?? 0
  const thisMonthRevDisplay =
    thisMonthRevRaw >= 10000
      ? (thisMonthRevRaw / 10000).toFixed(0) + '만원'
      : thisMonthRevRaw > 0
      ? thisMonthRevRaw.toLocaleString() + '원'
      : '-'
  const thisMonthOpsDisplay =
    thisMonthOpsRaw >= 10000
      ? (thisMonthOpsRaw / 10000).toFixed(0) + '만원'
      : thisMonthOpsRaw > 0
      ? thisMonthOpsRaw.toLocaleString() + '원'
      : '-'

  // Contracts: contracts 테이블 + customers 테이블에서 contracted 상태 업체 모두 포함
  // customers 테이블 기반 계약 목록 (contract_date 기준)
  const contractedCustomers = allCustomers.filter((c: any) => c.status === 'contracted')
  // customers → Contract 형태로 변환 (buildRows 함수와 호환)
  const customersAsContracts: Contract[] = contractedCustomers.map((c: any) => ({
    id: c.id,
    created_at: c.details?.contract_date || c.created_at || '',
    sales_user_id: c.owner_id || c.details?.sales_user_id || '',
    sales_user_name: c.details?.sales_user_name || c.sales_user_name || '',
    contract_amount: parseInt(String(c.details?.payment_amount || '0').replace(/[^0-9]/g, ''), 10) || 0,
    vat_included: c.details?.vat_included,
    status: 'contracted',
  }))
  // 두 소스 합치기 (중복 방지: customer_id 기준)
  const contractIdSet = new Set(allContracts.map((c: Contract) => c.customer_id))
  const mergedContracts = [
    ...allContracts,
    ...customersAsContracts.filter(c => !contractIdSet.has(c.id)),
  ]

  const thisMonthContracts = mergedContracts.filter(
    c => (c.created_at ?? '').slice(0, 7) === thisMonthStr
  )
  const lastMonthContracts = mergedContracts.filter(
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

  // Last month revenue breakdown
  const lastMonthRevEntry = revenueData?.monthly?.find(m => {
    const mmStr = String(lastMonth).padStart(2, '0') + '월'
    return m.month === mmStr || m.month === lastMonthStr
  })
  const lastMonthRevRaw   = lastMonthRevEntry?.합계 ?? 0
  const lastMonthSalesRaw = lastMonthRevEntry?.영업팀 ?? 0
  const lastMonthOpsRaw   = lastMonthRevEntry?.관리팀 ?? 0
  const thisMonthSalesRaw = thisMonthRevEntry?.영업팀 ?? 0
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
    remaining: number,
    addBase = false,
    supplyStatsArg: { name: string; rate: number; supplied: number; totalContracted: number }[] = []
  ): EmployeeRow[] {
    const userMap: Record<string, { name: string; count: number }> = {}
    for (const c of contracts) {
      const uid = c.sales_user_id
      if (!uid) continue
      if (!userMap[uid]) userMap[uid] = { name: c.sales_user_name ?? uid, count: 0 }
      userMap[uid].count += contractWeight(c.contract_amount, c.vat_included)
    }

    // 직책 제거 이름 정규화 (payrate 목표 매칭용)
    const stripTitle = (s: string) =>
      s.replace(/\s*(수석팀장|팀장|팀원|대리|과장|부장|차장|이사|수석|매니저|주임|사원).*/g, '').trim()

    return Object.values(userMap).map(u => {
      const goalEntry = goals.find(g => g.user_name === u.name)
      // payrate employee_details에서 직원별 목표 개수 가져오기 (salesGoals 없을 시 폴백)
      const payRateEntry = payRateEmps.find(
        e => e.name === u.name || stripTitle(e.name) === stripTitle(u.name)
      )
      const goal = goalEntry
        ? Number(goalEntry.goal_count)
        : payRateEntry?.target
        ? payRateEntry.target
        : null
      const base = addBase ? (supplyConfigMap[u.name]?.base ?? 0) : 0
      const contracted = u.count + base
      const projected =
        elapsed > 0 ? Math.round((contracted / elapsed) * (elapsed + remaining) * 10) / 10 : null
      const dailyNeeded =
        remaining > 0 && goal !== null && goal > contracted
          ? Math.ceil((goal - contracted) / remaining)
          : null

      // supplyStats에서 해당 사람의 rate 가져오기
      const supStat = supplyStatsArg.find(s => s.name === u.name)
      const supplyRate = supStat && supStat.supplied > 0 ? supStat.rate : null
      const totalRate = supStat && supStat.supplied > 0
        ? Math.floor(contracted / supStat.supplied * 10000) / 100
        : null

      return {
        name: u.name,
        goal,
        contracted,
        elapsed,
        remaining,
        projected,
        dailyNeeded,
        supplyRate,
        totalRate,
        supplyCount: supStat?.supplied,
      }
    })
  }

  // ── 오늘 인별 공급 배정 ──────────────────────────────────
  const bizElapsed = _bizElapsed(thisYear, thisMonth - 1, now.getDate())
  const supplyStats = Object.entries(supplyConfigMap).map(([name, cfg]: [string, any]) => {
    const supplied = cfg.supplied || 0
    const base = cfg.base || 0
    const dbContracted = mergedContracts
      .filter((c: any) =>
        (c.sales_user_name === name) &&
        (c.created_at ?? '').slice(0, 7) === thisMonthStr
      )
      .reduce((s: number, c: any) => s + contractWeight(c.contract_amount, c.vat_included), 0)
    const totalContracted = base + dbContracted
    const rate = supplied > 0 ? Math.floor(totalContracted / supplied * 10000) / 100 : 0
    const recommended = calcRecommendedSupply(rate, bizElapsed)
    return { name, rate, totalContracted, recommended, supplied }
  })

  const thisMonthRows = buildRows(thisMonthContracts, salesGoals, thisElapsed, thisRemaining, true, supplyStats)
  const lastMonthRows = buildRows(lastMonthContracts, lastMonthGoals, lastElapsed, lastRemaining, false)

  // ── Scroll helpers ───────────────────────────────────────

  function scrollTo(ref: RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Y-axis formatter ─────────────────────────────────────

  const fmtY = (v: number) => v.toLocaleString() + '만'

  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10">

      {/* ══ 퀵 액션 + 매출 카드 통합 행 ══ */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 좌측: 4개 퀵액션 카드 (2×2) */}
        <div className="grid grid-cols-2 gap-2 flex-1">
          {/* 오늘 보고 */}
          <button
            onClick={() => onNavigate?.('minutesreports')}
            className="group bg-white hover:bg-[#1B2A45] border border-[#E8E2D4] hover:border-[#1B2A45] rounded-xl p-3 text-left transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-base">📝</span>
              {!loading && <span className="text-[9px] bg-[#1B2A45]/8 group-hover:bg-white/20 text-[#1B2A45]/40 group-hover:text-white/60 px-1.5 py-0.5 rounded-full">→</span>}
            </div>
            <p className="text-[10px] text-[#1B2A45]/50 group-hover:text-white/50">오늘 보고</p>
            {loading ? <Skeleton className="h-6 w-10 mt-0.5" /> : (
              <p className="text-xl font-black text-[#1B2A45] group-hover:text-white mt-0.5">{todayReports.length}<span className="text-xs font-medium ml-0.5">건</span></p>
            )}
          </button>

          {/* 오늘 일정 */}
          <button
            onClick={() => onNavigate?.('calendar')}
            className="group bg-white hover:bg-[#1B2A45] border border-[#E8E2D4] hover:border-[#1B2A45] rounded-xl p-3 text-left transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-base">📅</span>
              {!loading && <span className="text-[9px] bg-[#1B2A45]/8 group-hover:bg-white/20 text-[#1B2A45]/40 group-hover:text-white/60 px-1.5 py-0.5 rounded-full">→</span>}
            </div>
            <p className="text-[10px] text-[#1B2A45]/50 group-hover:text-white/50">오늘 일정</p>
            {loading ? <Skeleton className="h-6 w-10 mt-0.5" /> : (
              <p className="text-xl font-black text-[#1B2A45] group-hover:text-white mt-0.5">{todayEvents.length}<span className="text-xs font-medium ml-0.5">건</span></p>
            )}
          </button>

          {/* 심사요청 */}
          <button
            onClick={() => onNavigate?.('sales', 'inspection')}
            className="group bg-white hover:bg-amber-500 border border-amber-200 hover:border-amber-500 rounded-xl p-3 text-left transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-base">🔍</span>
              {!loading && <span className="text-[9px] bg-amber-50 group-hover:bg-white/20 text-amber-500 group-hover:text-white/60 px-1.5 py-0.5 rounded-full">→</span>}
            </div>
            <p className="text-[10px] text-amber-600 group-hover:text-white/70">심사요청</p>
            {loading ? <Skeleton className="h-6 w-10 mt-0.5" /> : (
              <p className="text-xl font-black text-amber-600 group-hover:text-white mt-0.5">
                {allCustomers.filter((c: any) => c.details?.inspection_status === 'pending').length}
                <span className="text-xs font-medium ml-0.5">건</span>
              </p>
            )}
          </button>

          {/* A/S요청 */}
          <button
            onClick={() => onNavigate?.('sales', 'as')}
            className="group bg-white hover:bg-orange-500 border border-orange-200 hover:border-orange-500 rounded-xl p-3 text-left transition-all duration-200 hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-base">🔧</span>
              {!loading && <span className="text-[9px] bg-orange-50 group-hover:bg-white/20 text-orange-400 group-hover:text-white/60 px-1.5 py-0.5 rounded-full">→</span>}
            </div>
            <p className="text-[10px] text-orange-500 group-hover:text-white/70">A/S요청</p>
            {loading ? <Skeleton className="h-6 w-10 mt-0.5" /> : (
              <p className="text-xl font-black text-orange-500 group-hover:text-white mt-0.5">
                {allCustomers.filter((c: any) => (c as any).details?.as_requested === true && !(c as any).details?.as_resolved).length}
                <span className="text-xs font-medium ml-0.5">건</span>
              </p>
            )}
          </button>
        </div>

        {/* 우측: 영업팀·관리팀 매출 카드 (세로 스택) */}
        <div className="flex sm:flex-col gap-2 sm:w-40 sm:self-stretch">
          <div className="flex-1 bg-gradient-to-br from-[#1B2A45] to-[#2a3d5c] rounded-xl p-3 text-white flex flex-col justify-center">
            <p className="text-[10px] text-white/50 mb-1">영업팀 이달 매출</p>
            {loading ? <Skeleton className="h-6 w-20 bg-white/20" /> : (
              <p className="text-xl font-black leading-tight">{
                (() => {
                  const r = thisMonthSalesRaw
                  return r >= 10000 ? (r / 10000).toFixed(0) + '만원' : r > 0 ? r.toLocaleString() + '원' : '-'
                })()
              }</p>
            )}
            <p className="text-[9px] text-white/30 mt-0.5">계약 기준</p>
          </div>
          <div className="flex-1 bg-gradient-to-br from-emerald-700 to-emerald-600 rounded-xl p-3 text-white flex flex-col justify-center">
            <p className="text-[10px] text-white/50 mb-1">관리팀 이달 매출</p>
            {loading ? <Skeleton className="h-6 w-20 bg-white/20" /> : (
              <p className="text-xl font-black leading-tight">{thisMonthOpsDisplay}</p>
            )}
            <p className="text-[9px] text-white/30 mt-0.5">진행 기준</p>
          </div>
        </div>
      </div>

      {/* ══ 결제율 대시보드 ══ */}
      <div ref={chartRef}>
        <PayRateTab />
      </div>

      {/* ══ 이번달 현황 ══ */}
      <div ref={thisMonthRef}>
        <MonthSection
          title={`${thisMonth}월 현황`}
          loading={loading}
          contractCount={thisMonthContracts.reduce((s, c) => s + contractWeight(c.contract_amount, c.vat_included), 0)}
          inProgressCount={thisInProgress}
          taxAmount={thisMonthTax}
          employeeRows={thisMonthRows}
          salesRevenueAmount={thisMonthSalesRaw}
          opsRevenueAmount={thisMonthOpsRaw}
        />
      </div>

      {/* ══ 지난달 현황 ══ */}
      <div ref={lastMonthRef}>
        <MonthSection
          title={`${lastMonth}월 현황`}
          loading={loading}
          contractCount={lastMonthContracts.reduce((s, c) => s + contractWeight(c.contract_amount, c.vat_included), 0)}
          inProgressCount={lastInProgress}
          taxAmount={lastMonthTax}
          employeeRows={lastMonthRows}
          salesRevenueAmount={lastMonthSalesRaw}
          opsRevenueAmount={lastMonthOpsRaw}
        />
      </div>

      {/* ══ 공지사항 ══ */}
      <NoticeSection />

    </div>
  )
}

// ─── 공지사항 인라인 섹션 ────────────────────────────────────
function NoticeSection() {
  const [notices, setNotices]       = useState<any[]>([])
  const [title, setTitle]           = useState('')
  const [content, setContent]       = useState('')
  const [target, setTarget]         = useState<'all'|'sales'|'ops'>('all')
  const [isImportant, setIsImportant] = useState(false)
  const [posting, setPosting]       = useState(false)
  const [toast, setToast]           = useState<string|null>(null)
  const [showForm, setShowForm]     = useState(false)
  const [expandedId, setExpandedId] = useState<string|null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const r = await fetch('/api/notices')
      const d = await r.json()
      setNotices((d.notices || []).filter((n: any) => n.notice_type !== 'supply_count').slice(0, 30))
    } catch {}
  }

  function toast_(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function handlePost(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setPosting(true)
    const r = await fetch('/api/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        content: content.trim(),
        notice_type: isImportant ? 'important' : 'general',
        target_team: target,
        is_active: true,
      }),
    })
    if (r.ok) {
      setTitle(''); setContent(''); setIsImportant(false); setShowForm(false)
      toast_('✅ 공지 등록 완료!')
      load()
    } else toast_('❌ 등록 실패')
    setPosting(false)
  }

  async function del(id: string) {
    if (!confirm('이 공지를 삭제할까요?')) return
    const r = await fetch(`/api/notices?id=${id}`, { method: 'DELETE' })
    if (r.ok) { await load(); setExpandedId(null) }
    else toast_('❌ 삭제 실패')
  }

  async function toggleImportant(n: any) {
    const newType = n.notice_type === 'important' ? 'general' : 'important'
    const r = await fetch(`/api/notices?id=${n.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice_type: newType }),
    })
    if (r.ok) { await load(); toast_(newType === 'important' ? '⭐ 중요 공지로 설정됐습니다' : '중요 해제됐습니다') }
    else toast_('❌ 변경 실패')
  }

  const teamLabel = (t: string) => t === 'sales' ? '영업팀' : t === 'ops' ? '관리팀' : '전체'
  const teamColor = (t: string) => t === 'sales' ? 'bg-blue-100 text-blue-700' : t === 'ops' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
  const fmtDate   = (s: string) => {
    const d = new Date(s)
    return `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}. ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  return (
    <div className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white bg-emerald-500">{toast}</div>}

      {/* 헤더 */}
      <div className="px-5 py-3.5 border-b border-[#E8E2D4] flex items-center justify-between bg-[#FAFAF8]">
        <h2 className="font-bold text-[#1B2A45] text-base">📢 공지사항</h2>
        <button onClick={() => setShowForm(v => !v)}
          className="text-xs bg-[#1B2A45] hover:bg-[#1B2A45]/80 text-white px-3.5 py-1.5 rounded-lg font-semibold transition-colors">
          {showForm ? '✕ 취소' : '+ 공지 작성'}
        </button>
      </div>

      {/* 작성 폼 */}
      {showForm && (
        <form onSubmit={handlePost} className="px-5 py-4 border-b border-[#E8E2D4] bg-amber-50/40 space-y-3">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="공지 제목 *" required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258]" />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="내용 (선택) — 줄바꿈 그대로 표시됩니다" rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] resize-none" />
          <div className="flex gap-2 items-center flex-wrap">
            {/* 대상 선택 */}
            <div className="flex gap-1 flex-1 min-w-0">
              {(['all','sales','ops'] as const).map(t => (
                <button key={t} type="button" onClick={() => setTarget(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${target===t ? 'bg-[#1B2A45] text-white border-[#1B2A45]' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                  {t==='all'?'전체':t==='sales'?'영업팀':'관리팀'}
                </button>
              ))}
            </div>
            {/* 중요 토글 */}
            <button type="button" onClick={() => setIsImportant(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 ${isImportant ? 'bg-amber-400 text-white border-amber-400' : 'border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-500'}`}>
              {isImportant ? '⭐ 중요' : '☆ 중요'}
            </button>
            <button type="submit" disabled={posting || !title.trim()}
              className="bg-[#C5A258] hover:bg-[#C5A258]/80 disabled:opacity-40 text-white px-5 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0">
              {posting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      )}

      {/* 목록 */}
      {notices.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400">등록된 공지가 없습니다</div>
      ) : (
        <div className="divide-y divide-[#F0EBE0]">
          {notices.map(n => {
            const imp = n.notice_type === 'important'
            const open = expandedId === n.id
            return (
              <div key={n.id} className={imp ? 'bg-amber-50' : 'bg-white'}>
                {/* 제목 행 */}
                <div
                  onClick={() => setExpandedId(open ? null : n.id)}
                  className="px-5 py-3 flex items-center gap-2 cursor-pointer hover:bg-black/[0.02] transition-colors select-none"
                >
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${teamColor(n.target_team)}`}>
                    {teamLabel(n.target_team)}
                  </span>
                  {imp && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400 text-white shrink-0">⭐ 중요</span>
                  )}
                  <span className={`text-sm font-semibold flex-1 truncate ${imp ? 'text-amber-900' : 'text-[#1B2A45]'}`}>
                    {n.title}
                  </span>
                  <span className="text-[10px] text-gray-300 shrink-0 hidden sm:block">{fmtDate(n.created_at)}</span>
                  <span className={`text-[10px] ml-1 shrink-0 transition-transform ${open ? 'text-gray-500' : 'text-gray-300'}`}>
                    {open ? '▲' : '▼'}
                  </span>
                </div>

                {/* 펼쳐진 내용 */}
                {open && (
                  <div className={`px-5 pb-4 border-t ${imp ? 'border-amber-100' : 'border-gray-50'}`}>
                    {n.content ? (
                      <div className={`mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed rounded-xl p-4 border ${imp ? 'bg-white border-amber-100' : 'bg-[#FAFAF8] border-gray-100'}`}>
                        {n.content}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-gray-400 italic">내용 없음</p>
                    )}
                    {/* 액션 버튼 */}
                    <div className="flex items-center justify-between mt-3">
                      <button onClick={() => toggleImportant(n)}
                        className={`text-xs px-3 py-1 rounded-lg font-semibold border transition-colors ${
                          imp
                            ? 'border-amber-300 text-amber-700 bg-amber-100 hover:bg-amber-200'
                            : 'border-gray-200 text-gray-400 hover:text-amber-500 hover:border-amber-300 hover:bg-amber-50'
                        }`}>
                        {imp ? '⭐ 중요 해제' : '☆ 중요로 설정'}
                      </button>
                      <span className="text-[10px] text-gray-300 sm:hidden">{fmtDate(n.created_at)}</span>
                      <button onClick={() => del(n.id)}
                        className="text-xs text-gray-300 hover:text-red-400 transition-colors px-2 py-1 rounded">
                        🗑 삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

