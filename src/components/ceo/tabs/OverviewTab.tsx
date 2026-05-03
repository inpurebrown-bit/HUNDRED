'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ─── Business day utilities ───────────────────────────────
function getBusinessDaysInMonth(year: number, month: number): number {
  let count = 0
  const date = new Date(year, month - 1, 1)
  while (date.getMonth() === month - 1) {
    const day = date.getDay()
    if (day !== 0 && day !== 6) count++
    date.setDate(date.getDate() + 1)
  }
  return count
}

function getElapsedBusinessDays(year: number, month: number): number {
  let count = 0
  const today = new Date()
  const date = new Date(year, month - 1, 1)
  while (date <= today && date.getMonth() === month - 1) {
    const day = date.getDay()
    if (day !== 0 && day !== 6) count++
    date.setDate(date.getDate() + 1)
  }
  return count
}

// ─── Loading skeleton ────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#E8E2D4] rounded ${className}`} />
}

// ─── Employee performance table ──────────────────────────
interface EmployeeRow {
  name: string
  goal: number | null
  achieved: number
  elapsedDays: number
  totalDays: number
}

function EmployeeTable({ rows }: { rows: EmployeeRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[#1B2A45]/40 text-center py-4">직원 데이터 없음</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#E8E2D4]">
            {['직원', '목표', '달성', '영업일경과', '잔여일', '예상마감', '일필요건수'].map(h => (
              <th key={h} className="text-left py-2 px-3 text-xs text-[#1B2A45]/50 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const remaining = row.totalDays - row.elapsedDays
            const projected = row.elapsedDays > 0
              ? Math.round((row.achieved / row.elapsedDays) * row.totalDays)
              : null
            const dailyNeeded = remaining > 0 && row.goal !== null && row.goal > row.achieved
              ? Math.ceil((row.goal - row.achieved) / remaining)
              : null

            return (
              <tr key={i} className="border-b border-[#E8E2D4]/60 hover:bg-[#FAF8F3] transition-colors">
                <td className="py-2.5 px-3 font-medium text-[#1B2A45]">{row.name}</td>
                <td className="py-2.5 px-3 text-[#1B2A45]/70">
                  {row.goal === null
                    ? <span className="text-xs text-[#C5A258] bg-[#C5A258]/10 px-2 py-0.5 rounded-full">목표미설정</span>
                    : row.goal + '건'
                  }
                </td>
                <td className="py-2.5 px-3 font-semibold text-[#1B2A45]">{row.achieved}건</td>
                <td className="py-2.5 px-3 text-[#1B2A45]/60">{row.elapsedDays}일</td>
                <td className="py-2.5 px-3 text-[#1B2A45]/60">{remaining}일</td>
                <td className="py-2.5 px-3 text-[#1B2A45]/70">{projected !== null ? projected + '건' : '-'}</td>
                <td className="py-2.5 px-3">
                  {dailyNeeded !== null
                    ? <span className="text-xs font-semibold text-[#C5A258] bg-[#C5A258]/10 px-2 py-0.5 rounded-full">{dailyNeeded}건/일</span>
                    : <span className="text-[#1B2A45]/40">-</span>
                  }
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────
export default function OverviewTab() {
  const [loading, setLoading] = useState(true)
  const [revenueData, setRevenueData] = useState<any>(null)
  const [assignContracts, setAssignContracts] = useState<any[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [allContracts, setAllContracts] = useState<any[]>([])
  const [salesGoals, setSalesGoals] = useState<any[]>([])
  const [lastMonthGoals, setLastMonthGoals] = useState<any[]>([])
  const [asRequests, setAsRequests] = useState<any[]>([])
  const [markingDone, setMarkingDone] = useState<string | null>(null)

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
        const [revRes, assignRes, reportsRes, eventsRes, contractsRes, goalsRes, lastGoalsRes, asRes] = await Promise.all([
          fetch('/api/revenue').catch(() => null),
          fetch('/api/assign').catch(() => null),
          fetch('/api/reports').catch(() => null),
          fetch('/api/events').catch(() => null),
          fetch('/api/contracts').catch(() => null),
          fetch(`/api/sales-goals?year_month=${thisMonthStr}`).catch(() => null),
          fetch(`/api/sales-goals?year_month=${lastMonthStr}`).catch(() => null),
          fetch('/api/as-requests?status=pending').catch(() => null),
        ])

        const [revData, assignData, reportsData, eventsData, contractsData, goalsData, lastGoalsData, asData] = await Promise.all([
          revRes?.json().catch(() => ({})) ?? {},
          assignRes?.json().catch(() => ({})) ?? {},
          reportsRes?.json().catch(() => ({})) ?? {},
          eventsRes?.json().catch(() => ({})) ?? {},
          contractsRes?.json().catch(() => ({})) ?? {},
          goalsRes?.json().catch(() => ({})) ?? {},
          lastGoalsRes?.json().catch(() => ({})) ?? {},
          asRes?.json().catch(() => ({})) ?? {},
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = (d: unknown) => (d as any)
        setRevenueData(revData)
        setAssignContracts(a(assignData).contracts || [])
        setReports(a(reportsData).reports || [])
        setEvents(a(eventsData).events || [])
        setAllContracts(a(contractsData).contracts || [])
        setSalesGoals(a(goalsData).goals || [])
        setLastMonthGoals(a(lastGoalsData).goals || [])
        setAsRequests(a(asData).requests || [])
      } catch {
        // silently handle
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [thisMonthStr, lastMonthStr])

  // ── Derived values ──────────────────────────────────────
  const chartData = revenueData?.monthly?.slice(-3) ?? []

  const todayReports = reports.filter(r => r.report_date === todayStr || r.created_at?.slice(0, 10) === todayStr)
  const todayEvents = events.filter(e => (e.start_date ?? e.date ?? '')?.slice(0, 10) === todayStr)

  const elapsedBizDays = getElapsedBusinessDays(thisYear, thisMonth)
  const thisMonthContracts = allContracts.filter(c =>
    (c.created_at ?? '').slice(0, 7) === thisMonthStr
  )
  const paymentRate = elapsedBizDays > 0
    ? `${thisMonthContracts.length}건/${elapsedBizDays}일`
    : '-'

  const totalBizDays = getBusinessDaysInMonth(thisYear, thisMonth)
  const lastTotalBizDays = getBusinessDaysInMonth(lastYear, lastMonth)
  const lastElapsedBizDays = getBusinessDaysInMonth(lastYear, lastMonth)

  const lastMonthContracts = allContracts.filter(c =>
    (c.created_at ?? '').slice(0, 7) === lastMonthStr
  )

  // Tax calculations
  const thisMonthRevenue = revenueData?.monthly?.find((m: any) => m.month === thisMonthStr)?.합계 ?? 0
  const lastMonthRevenue = revenueData?.monthly?.find((m: any) => m.month === lastMonthStr)?.합계 ?? 0

  const thisMonthTax = Math.round(thisMonthRevenue * 0.1)
  const lastMonthTax = Math.round(lastMonthRevenue * 0.1)

  const thisMonthVat = thisMonthContracts
    .filter(c => c.tax_invoice_requested === true)
    .reduce((sum: number, c: any) => sum + Math.round((c.contract_amount ?? 0) * 0.1), 0)
  const lastMonthVat = lastMonthContracts
    .filter(c => c.tax_invoice_requested === true)
    .reduce((sum: number, c: any) => sum + Math.round((c.contract_amount ?? 0) * 0.1), 0)

  const thisInProgress = allContracts.filter(c =>
    (c.created_at ?? '').slice(0, 7) === thisMonthStr &&
    !['completed', 'rejected'].includes(c.progress_stage ?? '')
  ).length
  const lastInProgress = allContracts.filter(c =>
    (c.created_at ?? '').slice(0, 7) === lastMonthStr &&
    !['completed', 'rejected'].includes(c.progress_stage ?? '')
  ).length

  // Employee rows
  const salesByUser: any[] = revenueData?.salesByUser ?? []

  function buildEmployeeRows(
    goals: any[],
    elapsedDays: number,
    totalDays: number
  ): EmployeeRow[] {
    return salesByUser.map((u: any) => {
      const goalEntry = goals.find(g => g.user_name === u.name)
      return {
        name: u.name,
        goal: goalEntry ? Number(goalEntry.goal_count) : null,
        achieved: u.count ?? 0,
        elapsedDays,
        totalDays,
      }
    })
  }

  const thisMonthRows = buildEmployeeRows(salesGoals, elapsedBizDays, totalBizDays)
  const lastMonthRows = buildEmployeeRows(lastMonthGoals, lastElapsedBizDays, lastTotalBizDays)

  // ── Mark A/S as done ────────────────────────────────────
  async function markAsDone(id: string) {
    setMarkingDone(id)
    try {
      await fetch('/api/as-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'done' }),
      })
      setAsRequests(prev => prev.filter(r => r.id !== id))
    } catch {
      // silently handle
    } finally {
      setMarkingDone(null)
    }
  }

  // ── Y axis formatter ────────────────────────────────────
  const fmtY = (v: number) => {
    if (v >= 10000) return (v / 10000).toFixed(0) + '만'
    return v.toLocaleString()
  }

  // ── Stat card helper ────────────────────────────────────
  const miniCards = [
    { label: '배정 대기', value: loading ? null : assignContracts.length + '건', color: 'text-[#C5A258]' },
    { label: '오늘 보고', value: loading ? null : todayReports.length + '건', color: 'text-[#1B2A45]' },
    { label: '오늘 일정', value: loading ? null : todayEvents.length + '개', color: 'text-[#1B2A45]' },
    { label: '이달 결제율', value: loading ? null : paymentRate, color: 'text-[#C5A258]' },
  ]

  return (
    <div className="space-y-6 pb-8">

      {/* ── Top: chart + mini cards ── */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Bar chart */}
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-4 flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-[#1B2A45] mb-3">최근 3달 매출</h2>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : chartData.length === 0 || chartData.every((m: any) => m.합계 === 0) ? (
            <div className="h-48 flex items-center justify-center text-sm text-[#1B2A45]/40">매출 데이터 없음</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtY} tick={{ fontSize: 10 }} width={50} />
                <Tooltip formatter={(v: number) => v.toLocaleString() + '원'} />
                <Legend />
                <Bar dataKey="영업팀" fill="#1B2A45" radius={[4, 4, 0, 0]} />
                <Bar dataKey="관리팀" fill="#C5A258" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Mini stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-1 gap-3 md:w-48 shrink-0">
          {miniCards.map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-[#E8E2D4] p-4 flex flex-col justify-between">
              <p className="text-xs text-[#1B2A45]/50 mb-1">{card.label}</p>
              {card.value === null
                ? <Skeleton className="h-7 w-16" />
                : <p className={`text-xl font-black ${card.color}`}>{card.value}</p>
              }
            </div>
          ))}
        </div>
      </div>

      {/* ── 이번달 ── */}
      <section className="bg-white rounded-xl border border-[#E8E2D4] p-4 space-y-4">
        <h2 className="font-semibold text-[#1B2A45]">{thisMonth}월 현황</h2>

        {/* Stats row */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '총 계약 수', value: thisMonthContracts.length + '건' },
              { label: '진행중 케이스', value: thisInProgress + '건' },
              { label: '발생세금(10%)', value: thisMonthTax > 0 ? (thisMonthTax / 10000).toFixed(0) + '만원' : '-' },
              { label: '부가세', value: thisMonthVat > 0 ? (thisMonthVat / 10000).toFixed(0) + '만원' : '-' },
            ].map(s => (
              <div key={s.label} className="bg-[#FAF8F3] rounded-lg p-3">
                <p className="text-xs text-[#1B2A45]/50 mb-1">{s.label}</p>
                <p className="text-lg font-bold text-[#1B2A45]">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Employee table */}
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <EmployeeTable rows={thisMonthRows} />
        )}
      </section>

      {/* ── 저번달 ── */}
      <section className="bg-white rounded-xl border border-[#E8E2D4] p-4 space-y-4">
        <h2 className="font-semibold text-[#1B2A45]">{lastMonth}월 현황</h2>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: '총 계약 수', value: lastMonthContracts.length + '건' },
              { label: '진행중 케이스', value: lastInProgress + '건' },
              { label: '발생세금(10%)', value: lastMonthTax > 0 ? (lastMonthTax / 10000).toFixed(0) + '만원' : '-' },
              { label: '부가세', value: lastMonthVat > 0 ? (lastMonthVat / 10000).toFixed(0) + '만원' : '-' },
            ].map(s => (
              <div key={s.label} className="bg-[#FAF8F3] rounded-lg p-3">
                <p className="text-xs text-[#1B2A45]/50 mb-1">{s.label}</p>
                <p className="text-lg font-bold text-[#1B2A45]">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <EmployeeTable rows={lastMonthRows} />
        )}
      </section>

      {/* ── A/S 요청 ── */}
      <section className="bg-white rounded-xl border border-[#E8E2D4] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[#1B2A45]">A/S 요청</h2>
          {!loading && (
            <span className="text-xs bg-[#C5A258]/10 text-[#C5A258] px-2 py-0.5 rounded-full font-medium">
              {asRequests.length}건 대기
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : asRequests.length === 0 ? (
          <p className="text-sm text-[#1B2A45]/40 text-center py-6">A/S 요청 없음</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E2D4]">
                  {['업체명', '유형', '담당자', '날짜', ''].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-xs text-[#1B2A45]/50 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {asRequests.map(req => (
                  <tr key={req.id} className="border-b border-[#E8E2D4]/60 hover:bg-[#FAF8F3] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[#1B2A45]">{req.company_name ?? req.company ?? '-'}</td>
                    <td className="py-2.5 px-3 text-[#1B2A45]/70">{req.type ?? req.request_type ?? '-'}</td>
                    <td className="py-2.5 px-3 text-[#1B2A45]/70">{req.assigned_user_name ?? req.manager ?? '-'}</td>
                    <td className="py-2.5 px-3 text-[#1B2A45]/50 text-xs">
                      {req.created_at ? new Date(req.created_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => markAsDone(req.id)}
                        disabled={markingDone === req.id}
                        className="text-xs bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-50 text-white px-3 py-1 rounded-lg font-medium transition-colors"
                      >
                        {markingDone === req.id ? '처리 중...' : '완료'}
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
  )
}
