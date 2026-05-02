'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import MinutesTab from './MinutesTab'
import CalendarTab from './CalendarTab'
import PayRateTab from './PayRateTab'
import PayrollTab from './PayrollTab'
import PayslipTab from './PayslipTab'

interface Message {
  role: 'user' | 'model'
  parts: { text: string }[]
}

interface Contract {
  id: string
  customer_id: string
  sales_user_name: string
  contract_amount: number
  memo: string
  created_at: string
  customers: { name: string; phone: string; company: string }
}

interface OpsUser {
  id: string
  name: string
}

export default function CeoDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'ops' | 'assign' | 'revenue' | 'payrate' | 'payroll' | 'payslip' | 'reports' | 'minutes' | 'calendar' | 'ai'>('overview')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">대표 대시보드</h1>
          <p className="text-sm text-gray-500">헌드레드 지원센터</p>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-gray-500 hover:text-gray-700">
          로그아웃
        </button>
      </header>

      <div className="px-4 md:px-6 pt-4">
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'overview', label: '전체 현황' },
            { key: 'assign', label: '계약 배정' },
            { key: 'sales', label: '영업팀' },
            { key: 'ops', label: '관리팀' },
            { key: 'revenue', label: '💰 매출 관리' },
            { key: 'payrate', label: '📊 결제율' },
            { key: 'payroll', label: '💼 급여·손익' },
            { key: 'payslip', label: '📋 급여명세서' },
            { key: 'reports', label: '📝 보고함' },
            { key: 'minutes', label: '📒 회의록' },
            { key: 'calendar', label: '📅 일정관리' },
            { key: 'ai', label: '✦ AI 비서' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? tab.key === 'ai' ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'assign' && <AssignTab />}
        {activeTab === 'sales' && <SalesTab />}
        {activeTab === 'ops' && <OpsTab />}
        {activeTab === 'revenue' && <RevenueTab />}
        {activeTab === 'payrate' && <PayRateTab />}
        {activeTab === 'payroll' && <PayrollTab />}
        {activeTab === 'payslip' && <PayslipTab />}
        {activeTab === 'reports' && <ReportsTab />}
        {activeTab === 'minutes' && <MinutesTab />}
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'ai' && <AiTab />}
      </div>
    </div>
  )
}

// ─── 전체 현황 ───────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState({ customers: 0, contracts: 0, opsCases: 0, revenue: 0 })

  useEffect(() => {
    async function load() {
      const [cRes, conRes, opsRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/contracts'),
        fetch('/api/ops-cases'),
      ])
      const [cData, conData, opsData] = await Promise.all([cRes.json(), conRes.json(), opsRes.json()])
      const revenue = (opsData.cases || []).reduce((s: number, c: any) => s + (c.revenue || 0), 0)
      const inProgress = (opsData.cases || []).filter((c: any) => !['completed', 'rejected'].includes(c.progress_stage)).length
      setStats({
        customers: cData.customers?.length || 0,
        contracts: conData.contracts?.length || 0,
        opsCases: inProgress,
        revenue,
      })
    }
    load()
  }, [])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[
        { label: '전체 고객', value: stats.customers + '명' },
        { label: '총 계약', value: stats.contracts + '건' },
        { label: '관리팀 진행 중', value: stats.opsCases + '건' },
        { label: '누적 매출', value: stats.revenue > 0 ? (stats.revenue / 10000).toFixed(0) + '만원' : '-' },
      ].map((s) => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">{s.label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── 계약 배정 ───────────────────────────────────────────
function AssignTab() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [opsUsers, setOpsUsers] = useState<OpsUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOps, setSelectedOps] = useState<Record<string, string>>({})
  const [assigning, setAssigning] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [cRes, uRes] = await Promise.all([
      fetch('/api/assign'),
      fetch('/api/users?role=ops'),
    ])
    const [cData, uData] = await Promise.all([cRes.json(), uRes.json()])
    setContracts(cData.contracts || [])
    setOpsUsers(uData.users || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function assign(contractId: string) {
    const opsUserId = selectedOps[contractId]
    if (!opsUserId) return alert('관리팀 담당자를 선택해주세요')
    const opsUser = opsUsers.find(u => u.id === opsUserId)
    setAssigning(contractId)
    await fetch('/api/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract_id: contractId, ops_user_id: opsUserId, ops_user_name: opsUser?.name }),
    })
    setAssigning(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">미배정 계약 목록</h2>
        <span className="text-xs text-gray-400">{contracts.length}건 대기 중</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">불러오는 중...</div>
      ) : contracts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          배정 대기 중인 계약이 없습니다.
        </div>
      ) : (
        contracts.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{c.customers?.name}</span>
                  {c.customers?.company && <span className="text-gray-400 text-xs">{c.customers.company}</span>}
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">배정 대기</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>📞 {c.customers?.phone}</span>
                  {c.contract_amount > 0 && <span>💰 {c.contract_amount.toLocaleString()}원</span>}
                  <span>영업: {c.sales_user_name}</span>
                  <span>📅 {new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                {c.memo && <p className="text-xs text-gray-500 mt-2 bg-gray-50 px-3 py-2 rounded-lg">{c.memo}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={selectedOps[c.id] || ''}
                  onChange={e => setSelectedOps(prev => ({ ...prev, [c.id]: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">담당자 선택</option>
                  {opsUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => assign(c.id)}
                  disabled={assigning === c.id || !selectedOps[c.id]}
                  className="bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  {assigning === c.id ? '배정 중...' : '배정'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── 영업팀 현황 ─────────────────────────────────────────
function SalesTab() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => {
      setCustomers(d.customers || [])
      setLoading(false)
    })
  }, [])

  const byStatus = {
    lead: customers.filter(c => c.status === 'lead').length,
    consulting: customers.filter(c => c.status === 'consulting').length,
    contracted: customers.filter(c => c.status === 'contracted').length,
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 mb-2">
        {[
          { label: '신규 리드', count: byStatus.lead, color: 'text-sky-600' },
          { label: '상담 중', count: byStatus.consulting, color: 'text-amber-600' },
          { label: '계약 완료', count: byStatus.contracted, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">전체 고객 목록 ({customers.length})</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">등록된 고객이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {customers.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">{c.name}</span>
                  {c.company && <span className="text-xs text-gray-400 ml-2">{c.company}</span>}
                  <p className="text-xs text-gray-400">{c.phone} · {c.sales_user_name}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.status === 'lead' ? 'bg-sky-100 text-sky-700' :
                  c.status === 'consulting' ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {c.status === 'lead' ? '신규 리드' : c.status === 'consulting' ? '상담 중' : '계약 완료'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 관리팀 현황 ─────────────────────────────────────────
function OpsTab() {
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ops-cases').then(r => r.json()).then(d => {
      setCases(d.cases || [])
      setLoading(false)
    })
  }, [])

  const STAGE_LABEL: Record<string, string> = {
    assigned: '배정 완료', doc_collect: '서류 수집', reviewing: '심사 중',
    approved: '승인 완료', executing: '자금 집행', completed: '완료', rejected: '거절/보류',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">전체 케이스 ({cases.length})</h3>
      </div>
      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">불러오는 중...</div>
      ) : cases.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">배정된 케이스가 없습니다.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {cases.map(c => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900">{c.customers?.name}</span>
                {c.customers?.company && <span className="text-xs text-gray-400 ml-2">{c.customers.company}</span>}
                <p className="text-xs text-gray-400">{c.ops_user_name} · {c.institution || '기관 미정'}</p>
              </div>
              <div className="flex items-center gap-2">
                {c.revenue > 0 && <span className="text-xs text-emerald-600 font-medium">{c.revenue.toLocaleString()}원</span>}
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {STAGE_LABEL[c.progress_stage] || c.progress_stage}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 매출 관리 ───────────────────────────────────────────
function RevenueTab() {
  const [data, setData] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pnlMonth, setPnlMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [pnlData, setPnlData] = useState<any>(null)
  const [pnlLoading, setPnlLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/revenue').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
    ]).then(([revData, custData]) => {
      setData(revData)
      setCustomers(custData.customers || [])
      setLoading(false)
    })
  }, [])

  // Load P&L when month changes
  useEffect(() => {
    setPnlLoading(true)
    fetch(`/api/payroll?year_month=${pnlMonth}`).then(r => r.json()).then(json => {
      setPnlData(json.record || null)
      setPnlLoading(false)
    }).catch(() => { setPnlLoading(false) })
  }, [pnlMonth])

  const fmt = (n: number) => {
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '억'
    if (n >= 10000) return (n / 10000).toFixed(0) + '만'
    return n.toLocaleString()
  }

  // 이번 달 성과 계산
  const now = new Date()
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

  const thisMonthRevenue = data?.monthly?.find((m: any) => m.month === thisMonthStr)?.합계 ?? 0
  const lastMonthRevenue = data?.monthly?.find((m: any) => m.month === lastMonthStr)?.합계 ?? 0
  const revenueChange = lastMonthRevenue > 0
    ? (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
    : null

  const totalCustomers = customers.length
  const contractedCustomers = customers.filter((c: any) => c.status === 'contracted').length
  const conversionRate = totalCustomers > 0
    ? ((contractedCustomers / totalCustomers) * 100).toFixed(1)
    : '0.0'

  const totalContractCount = data?.salesByUser?.reduce((s: number, u: any) => s + (u.count || 0), 0) || 0
  const totalSalesAmt = data?.salesByUser?.reduce((s: number, u: any) => s + (u.amount || 0), 0) || 0
  const avgContractValue = totalContractCount > 0 ? Math.round(totalSalesAmt / totalContractCount) : 0

  // P&L 계산
  let pnl: { totalRevenue: number; laborCost: number; otherTotal: number; netProfit: number } | null = null
  if (pnlData?.employees) {
    const emps = pnlData.employees
    const opsEmps: any[] = emps.ops_employees || []
    const salesEmps: any[] = emps.sales_employees || []
    const otherCosts: Record<string, number> = emps.other_costs || {}

    const calcOpsLocal = (emp: any) => {
      const contractIncentive = Math.round(Number(emp.contract_revenue || 0) * 0.5)
      const feeIncentive = Math.round(Number(emp.fee_revenue || 0) * 0.1)
      const beforeDeduction = Number(emp.base_salary || 0) + contractIncentive + feeIncentive + Number(emp.performance_bonus || 0) - Number(emp.deduction || 0)
      return beforeDeduction
    }
    const calcSalesLocal = (emp: any) => {
      const contractIncentiveAmt = Math.round(Number(emp.contract_revenue || 0) * Number(emp.contract_incentive_rate || 0) / 100)
      return contractIncentiveAmt + Number(emp.fee_incentive || 0) + Number(emp.performance_bonus || 0) - Number(emp.deduction || 0)
    }

    const totalRevenue =
      opsEmps.reduce((s: number, e: any) => s + Number(e.contract_revenue || 0) + Number(e.fee_revenue || 0), 0) +
      salesEmps.reduce((s: number, e: any) => s + Number(e.contract_revenue || 0), 0)
    const tax = Math.round(totalRevenue * 0.10)
    const laborCost =
      opsEmps.reduce((s: number, e: any) => s + calcOpsLocal(e), 0) +
      salesEmps.reduce((s: number, e: any) => s + calcSalesLocal(e), 0)
    const otherTotal = Object.values(otherCosts).reduce((s: number, v: unknown) => s + Number(v), 0)
    const netProfit = totalRevenue - tax - laborCost - otherTotal
    pnl = { totalRevenue, laborCost, otherTotal, netProfit }
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
  if (!data) return null

  return (
    <div className="space-y-6 pb-8">
      {/* 이번 달 성과 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">이번 달 성과</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">이번 달 총 매출</p>
            <p className="text-xl font-black text-gray-900">{fmt(thisMonthRevenue)}원</p>
            {revenueChange !== null && (
              <p className={`text-xs mt-1 font-medium ${Number(revenueChange) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {Number(revenueChange) >= 0 ? '▲' : '▼'} {Math.abs(Number(revenueChange))}% 전월 대비
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">리드→계약 전환율</p>
            <p className="text-xl font-black text-gray-900">{conversionRate}%</p>
            <p className="text-xs text-gray-400 mt-1">{contractedCustomers}명 / 전체 {totalCustomers}명</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">평균 계약 금액</p>
            <p className="text-xl font-black text-gray-900">{fmt(avgContractValue)}원</p>
            <p className="text-xs text-gray-400 mt-1">총 {totalContractCount}건 계약</p>
          </div>
        </div>
      </div>

      {/* 총계 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '영업팀 총 매출', value: data.totalSales, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '관리팀 총 매출', value: data.totalOps, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: '통합 총 매출', value: data.total, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5 text-center`}>
            <p className={`text-2xl font-black ${s.color}`}>{fmt(s.value)}원</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 월별 차트 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">월별 매출 추이 (최근 6개월)</h3>
        {data.monthly.every((m: any) => m.합계 === 0) ? (
          <p className="text-center text-gray-400 text-sm py-8">아직 매출 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 11 }} width={55} />
              <Tooltip formatter={(v: number) => v.toLocaleString() + '원'} />
              <Legend />
              <Bar dataKey="영업팀" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="관리팀" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 월별 손익 연동 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold text-gray-800">월별 손익 연동</h3>
          <input
            type="month"
            value={pnlMonth}
            onChange={e => setPnlMonth(e.target.value)}
            className="border border-gray-200 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {pnlLoading && <span className="text-xs text-gray-400">불러오는 중...</span>}
        </div>
        {!pnlData ? (
          <p className="text-center text-gray-400 text-sm py-6">
            {pnlLoading ? '불러오는 중...' : `${pnlMonth} 급여 데이터가 없습니다.`}
          </p>
        ) : pnl && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '총매출', value: pnl.totalRevenue, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: '인건비', value: pnl.laborCost, color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: '운영비', value: pnl.otherTotal, color: 'text-violet-700', bg: 'bg-violet-50' },
              {
                label: '순이익',
                value: pnl.netProfit,
                color: pnl.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700',
                bg: pnl.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50',
              },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-lg p-4 text-center`}>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-lg font-black ${s.color}`}>{fmt(s.value)}원</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 직원별 실적 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 영업팀 직원별 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">영업팀 직원별 실적</h3>
          {data.salesByUser.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-4">데이터 없음</p>
          ) : (
            <div className="space-y-2">
              {data.salesByUser
                .sort((a: any, b: any) => b.amount - a.amount)
                .map((u: any) => (
                  <div key={u.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                        {u.name?.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.count}건</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">{fmt(u.amount)}원</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* 관리팀 직원별 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">관리팀 직원별 실적</h3>
          {data.opsByUser.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-4">데이터 없음</p>
          ) : (
            <div className="space-y-2">
              {data.opsByUser
                .sort((a: any, b: any) => b.amount - a.amount)
                .map((u: any) => (
                  <div key={u.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                        {u.name?.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.count}건</span>
                    </div>
                    <span className="text-sm font-semibold text-violet-600">{fmt(u.amount)}원</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 보고함 ──────────────────────────────────────────────
function ReportsTab() {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'morning' | 'daily'>('all')
  const [viewReport, setViewReport] = useState<any | null>(null)

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => {
      setReports(d.reports || [])
      setLoading(false)
    })
  }, [])

  const filtered = filter === 'all' ? reports : reports.filter(r => r.report_type === filter)

  // 오늘 보고 현황
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayMorning = reports.filter(r => r.report_type === 'morning' && r.report_date === todayStr)
  const todayDaily = reports.filter(r => r.report_type === 'daily' && r.report_date === todayStr)

  return (
    <div className="space-y-5 pb-8">
      {/* 오늘 보고 현황 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-semibold mb-1">☀️ 오늘 오전보고</p>
          {todayMorning.length === 0 ? (
            <p className="text-sm text-amber-400">아직 제출 없음</p>
          ) : (
            <div className="space-y-1">
              {todayMorning.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-800">{r.user_name}</span>
                  <button onClick={() => setViewReport(r)} className="text-xs text-amber-600 hover:text-amber-800">보기</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-semibold mb-1">📋 오늘 마감보고</p>
          {todayDaily.length === 0 ? (
            <p className="text-sm text-blue-400">아직 제출 없음</p>
          ) : (
            <div className="space-y-1">
              {todayDaily.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">{r.user_name}</span>
                  <button onClick={() => setViewReport(r)} className="text-xs text-blue-600 hover:text-blue-800">보기</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: `전체 (${reports.length})` },
          { key: 'morning', label: `오전보고 (${reports.filter(r => r.report_type === 'morning').length})` },
          { key: 'daily', label: `마감보고 (${reports.filter(r => r.report_type === 'daily').length})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* 보고 목록 */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          제출된 보고가 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filtered.map(r => (
              <div key={r.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    r.report_type === 'morning' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {r.report_type === 'morning' ? '☀️ 오전' : '📋 마감'}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-gray-900">{r.user_name}</span>
                    <span className="text-xs text-gray-400 ml-2">{r.report_date}</span>
                  </div>
                  {r.report_type === 'morning' && (
                    <span className="text-xs text-gray-400 hidden md:block">
                      총콜 {r.data?.total_calls || 0} · 연결 {r.data?.connected || 0} · DB확보 {r.data?.db_secured || 0} · 계약 {r.data?.outbound_contracts || 0}
                    </span>
                  )}
                  {r.report_type === 'daily' && (
                    <span className="text-xs text-gray-400 hidden md:block">
                      당일계약 {r.data?.today_contracts || 0}건 · 월누적 {r.data?.month_contracts || 0}건 · 목표 {r.data?.goal || 0}건
                    </span>
                  )}
                </div>
                <button onClick={() => setViewReport(r)}
                  className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                  상세보기
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 상세보기 모달 */}
      {viewReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">
                  {viewReport.report_type === 'morning' ? '☀️ 오전보고' : '📋 마감보고'}
                </h3>
                <p className="text-xs text-gray-400">{viewReport.user_name} · {viewReport.report_date}</p>
              </div>
              <button onClick={() => setViewReport(null)} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
            </div>
            <div className="p-6">
              {viewReport.report_type === 'morning' ? (
                <MorningDetail data={viewReport.data} />
              ) : (
                <DailyDetail data={viewReport.data} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MorningDetail({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: '총 콜 수', value: data?.total_calls },
        { label: '연결안됨', value: data?.no_connect },
        { label: '연결됨', value: data?.connected },
        { label: 'DB확보 (결정업체)', value: data?.db_secured },
        { label: '아웃바운딩 계약', value: data?.outbound_contracts },
      ].map(f => (
        <div key={f.label} className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400">{f.label}</p>
          <p className="text-xl font-black text-gray-900">{f.value || '0'}</p>
        </div>
      ))}
    </div>
  )
}

function DailyDetail({ data }: { data: any }) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-4">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</h4>
      {children}
    </div>
  )

  return (
    <div className="space-y-4 text-sm">
      <Section title="계약 현황">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '당일 계약', value: data?.today_contracts + '건' },
            { label: '이번달 누적', value: data?.month_contracts + '건' },
            { label: '월 목표', value: data?.goal + '건' },
            { label: '남은 목표', value: data?.goal && data?.month_contracts ? Math.max(0, Number(data.goal) - Number(data.month_contracts)) + '건' : '-' },
          ].map(f => (
            <div key={f.label} className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-xs text-gray-400">{f.label}</p>
              <p className="text-lg font-black text-gray-900">{f.value}</p>
            </div>
          ))}
        </div>
      </Section>

      {[
        { key: 'supply_db', title: '공급DB 상담결과' },
        { key: 'outbound', title: '아웃바운딩 상담결과' },
      ].map(s => (
        <Section key={s.key} title={s.title}>
          {data?.[s.key] === null ? (
            <p className="text-gray-400 text-xs">해당 없음</p>
          ) : (data?.[s.key] || []).length === 0 ? (
            <p className="text-gray-400 text-xs">항목 없음</p>
          ) : (
            (data[s.key] as any[]).map((item: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">{item.company}</span>
                  {item.is_decided && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">결정</span>}
                </div>
                <p className="text-xs text-gray-500">{item.content}</p>
              </div>
            ))
          )}
        </Section>
      ))}

      <Section title="고민관리업체">
        {data?.worried === null ? <p className="text-gray-400 text-xs">해당 없음</p>
          : (data?.worried || []).length === 0 ? <p className="text-gray-400 text-xs">항목 없음</p>
          : (data.worried as any[]).map((item: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-800">{item.company}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                  item.probability === '상' ? 'bg-emerald-100 text-emerald-700' :
                  item.probability === '중' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                }`}>{item.probability}</span>
              </div>
              <p className="text-xs text-gray-500">{item.content}</p>
              <p className="text-xs text-gray-400 mt-1">고민사유: {item.reason}</p>
            </div>
          ))
        }
      </Section>

      <Section title="결정업체">
        {data?.decided === null ? <p className="text-gray-400 text-xs">해당 없음</p>
          : (data?.decided || []).length === 0 ? <p className="text-gray-400 text-xs">항목 없음</p>
          : (data.decided as any[]).map((item: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2">
              <span className="font-semibold text-gray-800 block mb-1">{item.company}</span>
              <p className="text-xs text-gray-500">{item.content}</p>
              <p className="text-xs text-blue-600 mt-1">현재: {item.current_progress}</p>
              <p className="text-xs text-emerald-600">다음: {item.next_action}</p>
            </div>
          ))
        }
      </Section>

      <Section title="미팅업체">
        {data?.meetings === null ? <p className="text-gray-400 text-xs">해당 없음</p>
          : (data?.meetings || []).length === 0 ? <p className="text-gray-400 text-xs">항목 없음</p>
          : (data.meetings as any[]).map((item: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2 grid grid-cols-2 gap-1 text-xs">
              <span className="font-semibold text-gray-800 col-span-2">{item.company}</span>
              <span className="text-gray-500">📅 {item.date}</span>
              <span className="text-gray-500">⏰ {item.time}</span>
              <span className="text-gray-500 col-span-2">📍 {item.location}</span>
            </div>
          ))
        }
      </Section>

      <Section title="입금대기 업체">
        {data?.payment_waiting === null ? <p className="text-gray-400 text-xs">해당 없음</p>
          : (data?.payment_waiting || []).length === 0 ? <p className="text-gray-400 text-xs">항목 없음</p>
          : (data.payment_waiting as any[]).map((item: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2 grid grid-cols-2 gap-1 text-xs">
              <span className="font-semibold text-gray-800 col-span-2">{item.company}</span>
              <span className="text-gray-500">대표: {item.ceo_name}</span>
              <span className="text-gray-500">📞 {item.phone}</span>
              <span className="text-gray-500 col-span-2">첫콜: {item.first_call_date}</span>
            </div>
          ))
        }
      </Section>
    </div>
  )
}

// ─── AI 비서 ────────────────────────────────────────────
function AiTab() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMessage: Message = { role: 'user', parts: [{ text: input }] }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, history: messages }),
      })
      const data = await res.json()
      setMessages([...newMessages, {
        role: 'model',
        parts: [{ text: data.reply || ('오류: ' + (data.error || '알 수 없는 오류')) }],
      }])
    } catch {
      setMessages([...newMessages, { role: 'model', parts: [{ text: '서버 연결 오류가 발생했습니다.' }] }])
    } finally {
      setLoading(false)
    }
  }

  const suggestions = ['2024년 소상공인 정책자금 종류 알려줘', '정책자금 신청 시 필요한 서류는?', '기술보증기금과 신용보증기금 차이점']

  return (
    <div className="bg-white rounded-xl border border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">AI</span>
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">헌드레드 AI 비서</p>
          <p className="text-xs text-gray-400">정책자금 전문 · Gemini 3.1 Flash</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-8">
            <p className="text-gray-400 text-sm mb-6">무엇이든 물어보세요</p>
            <div className="flex flex-col gap-2 items-center">
              {suggestions.map((s) => (
                <button key={s} onClick={() => setInput(s)}
                  className="text-sm text-indigo-600 border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-colors max-w-xs">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
              msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {msg.parts[0].text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} className="px-4 py-4 border-t border-gray-100">
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="정책자금, 고객 분석, 업무 관련 무엇이든..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading} />
          <button type="submit" disabled={loading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            전송
          </button>
        </div>
      </form>
    </div>
  )
}
