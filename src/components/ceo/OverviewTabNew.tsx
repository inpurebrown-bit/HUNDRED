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
  관리팀계약?: number
  합계: number
}

interface RevenueData {
  monthly: MonthlyRevenue[]
  salesByUser: { name: string; amount: number; count: number }[]
  opsByUser: { name: string; amount: number; count: number }[]
  totalSales: number
  totalOps: number
  total: number
  thisMonthOps?: { ops_user_name: string; amount: number }[]
  thisMonthOpsContracts?: { ops_user_name: string; amount: number }[]
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
  title?: string
  start_date?: string
  end_date?: string
  date?: string
  color?: string
  start_time?: string
  is_allday?: boolean
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
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="bg-[#1B2A45]/[0.04] rounded-xl p-3">
          {/* 이름 + 일필요수 */}
          <div className="flex items-center justify-between mb-2.5">
            <span className="font-bold text-[#1B2A45] text-sm">{row.name}</span>
            {row.dailyNeeded !== null ? (
              <span className="text-xs font-bold text-[#C5A258] bg-[#C5A258]/10 px-2.5 py-0.5 rounded-full whitespace-nowrap">
                {row.dailyNeeded}건/일
              </span>
            ) : (
              <span className="text-[#1B2A45]/30 text-xs">—</span>
            )}
          </div>
          {/* 목표 · 결제수 · 예상마감 */}
          <div className="grid grid-cols-3 gap-1 text-center">
            <div className="bg-white/60 rounded-lg py-1.5 px-1">
              <p className="text-[9px] text-[#1B2A45]/40 mb-0.5 font-medium">목표</p>
              <p className="text-xs font-semibold text-[#1B2A45]/70">
                {row.goal === null
                  ? <span className="text-[9px] text-[#C5A258]">미설정</span>
                  : row.goal + '건'}
              </p>
            </div>
            <div className="bg-white/60 rounded-lg py-1.5 px-1">
              <p className="text-[9px] text-[#1B2A45]/40 mb-0.5 font-medium">결제수</p>
              <p className="text-sm font-black text-[#1B2A45] leading-none">
                {row.contracted % 1 === 0 ? row.contracted : row.contracted.toFixed(1)}
                <span className="text-[9px] font-normal text-[#1B2A45]/40 ml-0.5">건</span>
              </p>
            </div>
            <div className="bg-white/60 rounded-lg py-1.5 px-1">
              <p className="text-[9px] text-[#1B2A45]/40 mb-0.5 font-medium">예상마감</p>
              <p className="text-xs font-semibold text-[#1B2A45]/70">
                {row.projected !== null
                  ? (row.projected % 1 === 0 ? row.projected : row.projected.toFixed(1)) + '건'
                  : '-'}
              </p>
            </div>
          </div>
        </div>
      ))}
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
  opsUserRows?: { name: string; feeAmount: number; contractAmount: number; contractCount: number }[]
}

function fmtKrw(n: number): string {
  if (n <= 0) return '-'
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '억원'
  if (n >= 10000) return (n / 10000).toFixed(0) + '만원'
  return n.toLocaleString('ko-KR') + '원'
}

function rateGrade(rate: number | null, top: number) {
  if (rate === null || rate === undefined) return { label: '—', cls: 'text-gray-400' }
  if (rate >= top)        return { label: '최상', cls: 'text-blue-600 font-bold' }
  if (rate >= top - 5)    return { label: '우수', cls: 'text-cyan-600 font-bold' }
  if (rate >= top - 10)   return { label: '양호', cls: 'text-emerald-600 font-bold' }
  if (rate >= top - 15)   return { label: '보통', cls: 'text-amber-500 font-bold' }
  if (rate >= top - 20)   return { label: '미흡', cls: 'text-orange-400 font-bold' }
  if (rate >= top - 25)   return { label: '부진', cls: 'text-orange-600 font-bold' }
  return                         { label: '위험', cls: 'text-red-500 font-bold' }
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
  opsUserRows = [],
}: MonthSectionProps) {

  return (
    <section className="bg-white rounded-2xl border border-[#E8E2D4] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E8E2D4] flex items-center justify-between bg-gradient-to-r from-[#1B2A45]/3 to-transparent">
        <h2 className="font-bold text-[#1B2A45] text-base">{title}</h2>
        <span className="text-[11px] text-[#1B2A45]/40 bg-[#1B2A45]/5 px-2 py-1 rounded-lg">
          계약 {(contractCount % 1 === 0 ? contractCount : contractCount.toFixed(1))}건
        </span>
      </div>

      {/* 직원별 현황 — 영업팀(좌) / 관리팀(우) */}
      <div className="px-5 py-4 border-b border-[#E8E2D4]/60">
        <p className="text-[11px] font-bold text-[#1B2A45]/40 uppercase tracking-widest mb-3">직원별 현황</p>
        {loading ? <Skeleton className="h-32 w-full" /> : (
          <div className="flex flex-col md:flex-row gap-4 md:gap-5">
            {/* 영업팀 */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-[#1B2A45] bg-[#1B2A45]/8 inline-block px-2 py-0.5 rounded mb-2">영업팀</p>
              <EmployeeTable rows={employeeRows} loading={loading} />
            </div>
            {/* 구분선 */}
            <div className="hidden md:block w-px bg-[#E8E2D4] self-stretch shrink-0" />
            <div className="block md:hidden h-px bg-[#E8E2D4] w-full" />
            {/* 관리팀 */}
            <div className="md:shrink-0 md:w-64 w-full">
              <p className="text-[10px] font-bold text-emerald-700 bg-emerald-50 inline-block px-2 py-0.5 rounded mb-2">관리팀</p>
              {opsUserRows.length > 0 ? (
                <div className="space-y-2">
                  {opsUserRows.map(r => (
                    <div key={r.name} className="bg-emerald-50/60 rounded-xl p-3">
                      {/* 이름 + 건수 */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-[#1B2A45]/80 text-sm">{r.name}</span>
                        {r.contractCount > 0 && (
                          <span className="text-[10px] text-gray-500 bg-white/70 px-2 py-0.5 rounded-full">
                            {r.contractCount}건
                          </span>
                        )}
                      </div>
                      {/* 수수료 + 계약 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/60 rounded-lg py-1.5 px-2">
                          <p className="text-[9px] text-[#1B2A45]/40 mb-0.5 font-medium">수수료</p>
                          <p className="text-sm font-black text-emerald-600 leading-none">
                            {r.feeAmount > 0 ? fmtKrw(r.feeAmount) : '-'}
                          </p>
                        </div>
                        <div className="bg-white/60 rounded-lg py-1.5 px-2">
                          <p className="text-[9px] text-[#1B2A45]/40 mb-0.5 font-medium">계약매출</p>
                          <p className="text-sm font-black text-sky-600 leading-none">
                            {r.contractAmount > 0 ? fmtKrw(r.contractAmount) : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-[#1B2A45]/30 py-4">매출 없음</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 이달 집계 */}
      <div className="px-5 py-4">
        <p className="text-[11px] font-bold text-[#1B2A45]/40 uppercase tracking-widest mb-3">이달 집계</p>
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* 영업팀 총매출 */}
            <div className="bg-[#1B2A45] rounded-xl p-3">
              <p className="text-[9px] font-bold text-white/50 mb-1.5">영업팀 총매출</p>
              <p className="text-sm font-black text-white leading-none">{fmtKrw(salesRevenueAmount)}</p>
            </div>
            {/* 관리팀 총매출 */}
            <div className="bg-emerald-700 rounded-xl p-3">
              <p className="text-[9px] font-bold text-white/50 mb-1.5">관리팀 총매출</p>
              <p className="text-sm font-black text-white leading-none">{opsRevenueAmount > 0 ? fmtKrw(opsRevenueAmount) : '-'}</p>
            </div>
            {/* 발생 부가세 */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
              <p className="text-[9px] font-bold text-orange-400 mb-1.5">발생 부가세</p>
              <p className="text-sm font-black text-orange-500 leading-none">
                {(salesRevenueAmount + opsRevenueAmount) > 0
                  ? fmtKrw(Math.round((salesRevenueAmount + opsRevenueAmount) / 11))
                  : '-'}
              </p>
            </div>
            {/* 발생 세금 */}
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-[9px] font-bold text-red-400 mb-1.5">발생 세금</p>
              <p className="text-sm font-black text-red-500 leading-none">{taxAmount > 0 ? fmtKrw(taxAmount) : '-'}</p>
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
  const [monthlyExpenses, setMonthlyExpenses] = useState<{ day: number; label: string; amount: number | null }[]>([])
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
  // 타임존 안전 오늘 날짜 문자열 (한국 등 UTC+N에서 toISOString()이 전날 반환하는 버그 방지)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`

  const lastMonthDate = new Date(thisYear, thisMonth - 2, 1)
  const lastYear = lastMonthDate.getFullYear()
  const lastMonth = lastMonthDate.getMonth() + 1
  const lastMonthStr = `${lastYear}-${String(lastMonth).padStart(2, '0')}`

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // ① 구글 캘린더 자동 동기화 (저장된 설정으로 백그라운드 갱신)
        //    이벤트 로드 전에 먼저 동기화해서 최신 데이터 보장
        await fetch('/api/events/gcal').catch(() => null)

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
          expensesRes,
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
          fetch('/api/settings?key=monthly_expenses').catch(() => null),
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
          expensesData,
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
          expensesRes?.json().catch(() => ({})) ?? {},
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = (d: unknown) => (d as any)
        setRevenueData(revData as RevenueData)
        setAssignContracts(a(assignData).contracts ?? [])
        setReports(a(reportsData).reports ?? [])
        setEvents(a(eventsData).events ?? [])
        setMonthlyExpenses(a(expensesData).settings?.expenses ?? [])
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
  // 관리팀 = 수수료(관리팀) + 계약매출(관리팀계약) 합산
  const thisMonthOpsRaw = (thisMonthRevEntry?.관리팀 ?? 0) + (thisMonthRevEntry?.관리팀계약 ?? 0)
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
  // 관리팀 = 수수료 + 계약매출 합산
  const lastMonthOpsRaw   = (lastMonthRevEntry?.관리팀 ?? 0) + (lastMonthRevEntry?.관리팀계약 ?? 0)
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

  // ── 관리팀 이달 직원별 집계 ───────────────────────────────
  function buildOpsUserRows(
    opsEntries: { ops_user_name: string; amount: number }[],
    contractEntries: { ops_user_name: string; amount: number }[]
  ): { name: string; feeAmount: number; contractAmount: number; contractCount: number }[] {
    const map: Record<string, { name: string; feeAmount: number; contractAmount: number; contractCount: number }> = {}
    for (const e of (opsEntries ?? [])) {
      const name = e.ops_user_name?.trim() || '관리팀'
      if (!map[name]) map[name] = { name, feeAmount: 0, contractAmount: 0, contractCount: 0 }
      map[name].feeAmount += e.amount
    }
    for (const e of (contractEntries ?? [])) {
      const name = e.ops_user_name?.trim() || '관리팀'
      if (!map[name]) map[name] = { name, feeAmount: 0, contractAmount: 0, contractCount: 0 }
      map[name].contractAmount += e.amount
      map[name].contractCount++
    }
    return Object.values(map)
  }
  const thisMonthOpsUserRows = buildOpsUserRows(
    revenueData?.thisMonthOps ?? [],
    revenueData?.thisMonthOpsContracts ?? []
  )

  // ── Scroll helpers ───────────────────────────────────────

  function scrollTo(ref: RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Y-axis formatter ─────────────────────────────────────

  const fmtY = (v: number) => v.toLocaleString() + '만'

  // ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-10">

      {/* ══ 퀵 액션 + 매출 요약 ══ */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { label: '오늘 보고', count: todayReports.length,   nav: () => onNavigate?.('minutesreports'), base: 'border-[#E8E2D4] text-[#1B2A45]',   num: 'text-[#1B2A45]',    hover: 'hover:bg-[#1B2A45] hover:border-[#1B2A45] hover:text-white' },
          { label: '오늘 일정', count: todayEvents.length,    nav: () => onNavigate?.('calendar'),       base: 'border-[#E8E2D4] text-[#1B2A45]',   num: 'text-[#1B2A45]',    hover: 'hover:bg-[#1B2A45] hover:border-[#1B2A45] hover:text-white' },
          { label: '심사요청',  count: allCustomers.filter((c: any) => c.details?.inspection_status === 'pending').length, nav: () => onNavigate?.('sales', 'inspection'), base: 'border-amber-200 text-amber-700', num: 'text-amber-600', hover: 'hover:bg-amber-500 hover:border-amber-500 hover:text-white' },
          { label: 'A/S요청',   count: allCustomers.filter((c: any) => c.details?.as_requested === true && !c.details?.as_resolved).length, nav: () => onNavigate?.('sales', 'as'), base: 'border-orange-200 text-orange-700', num: 'text-orange-500', hover: 'hover:bg-orange-500 hover:border-orange-500 hover:text-white' },
          { label: '직가DB',    count: allCustomers.filter((c: any) => c.status === 'db010').length, nav: () => onNavigate?.('sales', 'db010'), base: 'border-violet-200 text-violet-700', num: 'text-violet-600', hover: 'hover:bg-violet-500 hover:border-violet-500 hover:text-white' },
        ].map(item => (
          <button key={item.label} onClick={item.nav}
            className={`group flex items-center gap-2 bg-white border rounded-xl px-3 py-2 transition-all duration-150 ${item.base} ${item.hover}`}>
            <span className="text-[11px] font-medium group-hover:text-white/80">{item.label}</span>
            {loading ? <Skeleton className="h-4 w-6" /> : (
              <span className={`text-sm font-black group-hover:text-white ${item.num}`}>
                {item.count}<span className="text-[10px] font-medium ml-0.5">건</span>
              </span>
            )}
          </button>
        ))}

        <div className="flex-1" />

        {/* 이달 매출 요약 칩 */}
        <div className="flex items-center gap-2">
          <div className="bg-[#1B2A45] rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-[10px] text-white/50 font-medium">영업</span>
            {loading ? <Skeleton className="h-4 w-12 bg-white/20" /> : (
              <span className="text-sm font-black text-white">
                {(() => { const r = thisMonthSalesRaw; return r >= 10000 ? (r/10000).toFixed(0)+'만' : r > 0 ? r.toLocaleString() : '-' })()}
              </span>
            )}
          </div>
          <div className="bg-emerald-700 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-[10px] text-white/50 font-medium">관리</span>
            {loading ? <Skeleton className="h-4 w-12 bg-white/20" /> : (
              <span className="text-sm font-black text-white">{thisMonthOpsDisplay}</span>
            )}
          </div>
        </div>
      </div>

      {/* ══ 2주 일정 캘린더 ══ */}
      <TwoWeekCalendar events={events} monthlyExpenses={monthlyExpenses} onNavigate={onNavigate} />

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
          opsUserRows={thisMonthOpsUserRows}
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

// ─── 2주 일정 캘린더 ─────────────────────────────────────────

const CAL_COLORS: Record<string, string> = {
  blue:   'bg-blue-100 text-blue-700',
  red:    'bg-red-100 text-red-600',
  green:  'bg-emerald-100 text-emerald-700',
  amber:  'bg-amber-100 text-amber-700',   // CalendarTab 기본 색상 키
  yellow: 'bg-amber-100 text-amber-700',   // 혹시 yellow로 저장된 경우 대비
  violet: 'bg-violet-100 text-violet-700',
  pink:   'bg-pink-100 text-pink-700',
  gray:   'bg-gray-100 text-gray-600',
}

function TwoWeekCalendar({
  events,
  monthlyExpenses = [],
  onNavigate,
}: {
  events: CalEvent[]
  monthlyExpenses?: { day: number; label: string; amount: number | null }[]
  onNavigate?: (...a: any[]) => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 이번 주 일요일 기준으로 14일
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())  // 이번 주 일요일

  const days: Date[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const KO = ['일', '월', '화', '수', '목', '금', '토']

  // ★ 타임존 안전: UTC 변환 없이 로컬 날짜 문자열 생성
  const toStr = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  const todayStr = toStr(today)

  // 지출 이벤트를 CalEvent 형태로 변환 (이번 주 ~ 다음 주 기간)
  const expenseEvents: CalEvent[] = days.flatMap(d => {
    const dayNum = d.getDate()
    return monthlyExpenses
      .filter(exp => exp.day === dayNum)
      .map(exp => ({
        id: `__exp__${toStr(d)}_${exp.day}`,
        title: `${exp.label}${exp.amount !== null ? ` (${Math.abs(exp.amount).toLocaleString()}원)` : ''}`,
        start_date: toStr(d),
        end_date: toStr(d),
        color: 'red',
        is_allday: true,
      }))
  })

  const allEvents = [...events, ...expenseEvents]

  function eventsOn(d: Date) {
    const ds = toStr(d)
    return allEvents.filter(e => {
      const s = e.start_date ?? e.date ?? ''
      const en = e.end_date ?? s
      return s <= ds && en >= ds
    })
  }

  const week1 = days.slice(0, 7)
  const week2 = days.slice(7, 14)

  const renderWeek = (week: Date[], weekLabel: string) => (
    <div>
      <p className="text-[10px] font-bold text-[#1B2A45]/40 uppercase tracking-widest mb-2">{weekLabel}</p>
      <div className="grid grid-cols-7 gap-1">
        {week.map(d => {
          const ds = toStr(d)
          const isToday = ds === todayStr
          const isPast  = d < today && !isToday
          const dow     = d.getDay()
          const isSun   = dow === 0
          const isSat   = dow === 6
          const evs     = eventsOn(d)
          return (
            <button key={ds}
              onClick={() => onNavigate?.('calendar')}
              className={`rounded-lg p-1.5 text-left transition-colors min-h-[56px] border ${
                isToday
                  ? 'border-[#1B2A45] bg-[#1B2A45]/5'
                  : isSun
                  ? 'border-transparent bg-red-50/50 hover:bg-red-50/80'
                  : isSat
                  ? 'border-transparent bg-blue-50/50 hover:bg-blue-50/80'
                  : 'border-transparent hover:border-[#E8E2D4] hover:bg-gray-50'
              }`}
            >
              <div className={`text-xs font-bold mb-1 ${
                isToday ? 'text-[#1B2A45]' :
                isPast  ? 'text-gray-300' :
                isSun   ? 'text-red-400' :
                isSat   ? 'text-blue-400' : 'text-gray-600'
              }`}>
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-[#1B2A45] text-white rounded-full text-[10px] font-black">
                    {d.getDate()}
                  </span>
                ) : d.getDate()}
              </div>
              <div className="space-y-0.5">
                {evs.slice(0, 2).map(ev => (
                  <div key={ev.id}
                    className={`text-[9px] px-1 py-0.5 rounded truncate leading-tight font-medium ${CAL_COLORS[ev.color ?? 'blue'] ?? 'bg-blue-100 text-blue-700'}`}>
                    {ev.start_time && !ev.is_allday && (
                      <span className="opacity-60 mr-0.5">{ev.start_time.slice(0,5)}</span>
                    )}
                    {ev.title}
                  </div>
                ))}
                {evs.length > 2 && (
                  <div className="text-[9px] text-gray-400 pl-0.5">+{evs.length - 2}</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-[#E8E2D4] bg-gray-50/50 px-3 pt-3">
        {KO.map((d, i) => (
          <div key={d} className={`text-center text-[11px] font-bold pb-2 ${
            i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'
          }`}>{d}</div>
        ))}
      </div>
      <div className="p-3 space-y-3">
        {renderWeek(week1, '이번 주')}
        {renderWeek(week2, '다음 주')}
      </div>
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
  const [editingId, setEditingId]   = useState<string|null>(null)
  const [editTitle, setEditTitle]   = useState('')
  const [editContent, setEditContent] = useState('')
  const [editTarget, setEditTarget] = useState<'all'|'sales'|'ops'>('all')
  const [editImportant, setEditImportant] = useState(false)
  const [updating, setUpdating]     = useState(false)

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
      toast_('공지 등록 완료!')
      load()
    } else toast_('등록 실패')
    setPosting(false)
  }

  async function del(id: string) {
    if (!confirm('이 공지를 삭제할까요?')) return
    const r = await fetch(`/api/notices?id=${id}`, { method: 'DELETE' })
    if (r.ok) { await load(); setExpandedId(null) }
    else toast_('삭제 실패')
  }

  function startEdit(n: any) {
    setEditingId(n.id)
    setEditTitle(n.title || '')
    setEditContent(n.content || '')
    setEditTarget(n.target_team || 'all')
    setEditImportant(n.notice_type === 'important')
  }

  async function handleUpdate(id: string) {
    if (!editTitle.trim()) return
    setUpdating(true)
    const r = await fetch(`/api/notices?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle.trim(),
        content: editContent.trim(),
        target_team: editTarget,
        notice_type: editImportant ? 'important' : 'general',
      }),
    })
    if (r.ok) { await load(); setEditingId(null); toast_('공지 수정 완료!') }
    else toast_('수정 실패')
    setUpdating(false)
  }

  async function toggleImportant(n: any) {
    const newType = n.notice_type === 'important' ? 'general' : 'important'
    const r = await fetch(`/api/notices?id=${n.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice_type: newType }),
    })
    if (r.ok) { await load(); toast_(newType === 'important' ? '중요 공지로 설정됐습니다' : '중요 해제됐습니다') }
    else toast_('변경 실패')
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
        <h2 className="font-bold text-[#1B2A45] text-base">공지사항</h2>
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
              {isImportant ? '중요' : '중요'}
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
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400 text-white shrink-0">중요</span>
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
                    {editingId === n.id ? (
                      /* ── 인라인 수정 폼 ── */
                      <div className="mt-3 space-y-2">
                        <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                          placeholder="제목 *" required
                          className="w-full border border-[#C5A258] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258]/50" />
                        <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                          placeholder="내용 (선택)" rows={4}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258]/50 resize-none" />
                        <div className="flex gap-2 items-center flex-wrap">
                          <div className="flex gap-1 flex-1 min-w-0">
                            {(['all','sales','ops'] as const).map(t => (
                              <button key={t} type="button" onClick={() => setEditTarget(t)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${editTarget===t ? 'bg-[#1B2A45] text-white border-[#1B2A45]' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                                {t==='all'?'전체':t==='sales'?'영업팀':'관리팀'}
                              </button>
                            ))}
                          </div>
                          <button type="button" onClick={() => setEditImportant(v => !v)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors shrink-0 ${editImportant ? 'bg-amber-400 text-white border-amber-400' : 'border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-500'}`}>
                            {editImportant ? '중요' : '중요'}
                          </button>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingId(null)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                            취소
                          </button>
                          <button type="button" onClick={() => handleUpdate(n.id)}
                            disabled={updating || !editTitle.trim()}
                            className="text-xs px-4 py-1.5 rounded-lg bg-[#C5A258] hover:bg-[#C5A258]/80 disabled:opacity-40 text-white font-bold transition-colors">
                            {updating ? '저장 중...' : '저장'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── 읽기 모드 ── */
                      <>
                        {n.content ? (
                          <div className={`mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed rounded-xl p-4 border ${imp ? 'bg-white border-amber-100' : 'bg-[#FAFAF8] border-gray-100'}`}>
                            {n.content}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-gray-400 italic">내용 없음</p>
                        )}
                        {/* 액션 버튼 */}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleImportant(n)}
                              className={`text-xs px-3 py-1 rounded-lg font-semibold border transition-colors ${
                                imp
                                  ? 'border-amber-300 text-amber-700 bg-amber-100 hover:bg-amber-200'
                                  : 'border-gray-200 text-gray-400 hover:text-amber-500 hover:border-amber-300 hover:bg-amber-50'
                              }`}>
                              {imp ? '중요 해제' : '중요로 설정'}
                            </button>
                            <button onClick={() => startEdit(n)}
                              className="text-xs px-3 py-1 rounded-lg font-semibold border border-gray-200 text-gray-500 hover:text-[#1B2A45] hover:border-[#1B2A45]/30 hover:bg-gray-50 transition-colors">
                              수정
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-300 sm:hidden">{fmtDate(n.created_at)}</span>
                            <button onClick={() => del(n.id)}
                              className="text-xs text-gray-300 hover:text-red-400 transition-colors px-2 py-1 rounded">
                              삭제
                            </button>
                          </div>
                        </div>
                      </>
                    )}
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

