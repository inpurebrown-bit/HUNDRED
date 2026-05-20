'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── 타입 ─────────────────────────────────────────────────

interface OpsEmployee {
  name: string
  base_salary: number       // 기본급
  fee_revenue: number       // 수수료매출 (VAT제외)
  puto_revenue: number      // 뿌토매출 (VAT제외)
  performance_bonus: number // 성과급
}

interface AwardItem {
  reason: string
  amount: number
}

interface SalesEmployee {
  name: string
  contract_revenue: number  // 계약금매출 (VAT제외)
  contract_count: number    // 계약수 (프로모션 계산용)
  performance_bonus: number // 성과급 (수동)
  awards: AwardItem[]       // 시상금 목록
}

interface OtherCostItem {
  label: string
  amount: number
}

interface OtherCosts {
  db_count: number
  db_unit_price: number
  rent: number
  mgmt: number
  sales_fixed: number
  sales_other_items: OtherCostItem[]
}

// ─── 계산 함수 ────────────────────────────────────────────

function calcOps(emp: OpsEmployee) {
  const feeIncentive   = Math.round(Number(emp.fee_revenue)  * 0.10)
  const putoIncentive  = Math.round(Number(emp.puto_revenue) * 0.35)
  const beforeDeduction = Number(emp.base_salary) + feeIncentive + putoIncentive + Number(emp.performance_bonus)
  const afterDeduction  = Math.round(beforeDeduction * (1 - 0.033))
  return { feeIncentive, putoIncentive, beforeDeduction, afterDeduction }
}

function getPromotion(count: number): number {
  if (count >= 40) return 1_500_000
  if (count >= 30) return 1_000_000
  if (count >= 25) return   700_000
  if (count >= 20) return   500_000
  return 0
}

function promotionLabel(count: number): string {
  if (count >= 40) return '150만 (40개↑)'
  if (count >= 30) return '100만 (30개↑)'
  if (count >= 25) return '70만 (25개↑)'
  if (count >= 20) return '50만 (20개↑)'
  return '-'
}

function calcSales(emp: SalesEmployee) {
  const rate             = 0.25 + (emp.contract_count >= 12 ? 0.05 : 0)
  const contractIncentive = Math.round(Number(emp.contract_revenue) * rate)
  const extraRate        = emp.contract_count >= 12 ? 0.05 : 0
  const promotion        = getPromotion(emp.contract_count)
  const awardsTotal      = (emp.awards || []).reduce((s, a) => s + Number(a.amount || 0), 0)
  const beforeDeduction  = contractIncentive + promotion + Number(emp.performance_bonus) + awardsTotal
  const afterDeduction   = Math.round(beforeDeduction * (1 - 0.033))
  return { contractIncentive, extraRate, promotion, awardsTotal, beforeDeduction, afterDeduction }
}

// ─── 유틸 ─────────────────────────────────────────────────

const INPUT_CLS = 'border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full'
const CALC_CLS  = 'bg-gray-50 text-gray-600 text-sm px-2 py-1 text-right whitespace-nowrap'

function thisMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtW(n: number) {
  if (!n || n === 0) return '-'
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
  if (n >= 10_000) return Math.round(n / 10_000) + '만원'
  return n.toLocaleString() + '원'
}

function defaultOps(): OpsEmployee {
  return { name: '', base_salary: 0, fee_revenue: 0, puto_revenue: 0, performance_bonus: 0 }
}
function defaultSales(): SalesEmployee {
  return { name: '', contract_revenue: 0, contract_count: 0, performance_bonus: 0, awards: [] }
}
function defaultOtherCosts(): OtherCosts {
  return {
    db_count: 0,
    db_unit_price: 40000,
    rent: 650000,
    mgmt: 400000,
    sales_fixed: 820000,
    sales_other_items: [],
  }
}

// ─── 컴포넌트 ─────────────────────────────────────────────

export default function PayrollTab() {
  const [yearMonth, setYearMonth] = useState<string>(thisMonth())
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)
  const [msg, setMsg]             = useState('')

  const [opsEmployees, setOpsEmployees] = useState<OpsEmployee[]>([
    { ...defaultOps(), name: '관리팀장', base_salary: 2_000_000 },
    defaultOps(), defaultOps(),
  ])

  const [salesEmployees, setSalesEmployees] = useState<SalesEmployee[]>([
    { ...defaultSales(), name: '손제후' },
    { ...defaultSales(), name: '김윤지' },
    defaultSales(),
    defaultSales(),
  ])

  const [otherCosts, setOtherCosts] = useState<OtherCosts>(defaultOtherCosts())

  // 총매출 (revenue API에서 이번달 자동)
  const [revenueTotals, setRevenueTotals] = useState<{ sales: number; ops: number; opsContract: number } | null>(null)

  // ── Revenue 자동 로드 (이번달) ───────────────────────────
  const autoLoadRevenue = useCallback(async () => {
    setAutoLoading(true)
    try {
      const res = await fetch('/api/revenue')
      const data = await res.json()

      const thisM = thisMonth()
      const salesEntries: any[]   = (data.thisMonthSales || [])
      const opsEntries: any[]     = (data.thisMonthOps || [])
      const contractEntries: any[] = (data.thisMonthOpsContracts || [])

      // 총매출 저장
      setRevenueTotals({
        sales:       salesEntries.reduce((s: number, e: any) => s + (e.amount || 0), 0),
        ops:         opsEntries.reduce((s: number, e: any) => s + (e.amount || 0), 0),
        opsContract: contractEntries.reduce((s: number, e: any) => s + (e.amount || 0), 0),
      })

      // 영업팀 per-user 집계
      const salesByName: Record<string, { amount: number; count: number }> = {}
      for (const e of salesEntries) {
        const name = (e.sales_user_name || '').trim()
        if (!name) continue
        if (!salesByName[name]) salesByName[name] = { amount: 0, count: 0 }
        salesByName[name].amount += e.amount || 0
        salesByName[name].count++
      }

      // 관리팀 per-user 집계
      const opsFeeByName: Record<string, number> = {}
      for (const e of opsEntries) {
        const name = (e.ops_user_name || '').trim()
        if (!name) continue
        opsFeeByName[name] = (opsFeeByName[name] || 0) + (e.amount || 0)
      }
      const opsContractByName: Record<string, number> = {}
      for (const e of contractEntries) {
        const name = (e.ops_user_name || '').trim()
        if (!name) continue
        opsContractByName[name] = (opsContractByName[name] || 0) + (e.amount || 0)
      }

      // 영업팀 자동 채우기
      setSalesEmployees(prev => prev.map(emp => {
        if (!emp.name) return emp
        const rev = salesByName[emp.name]
        if (!rev) return emp
        return { ...emp, contract_revenue: rev.amount, contract_count: rev.count }
      }))

      // 관리팀 자동 채우기
      setOpsEmployees(prev => prev.map(emp => {
        if (!emp.name) return emp
        const fee  = opsFeeByName[emp.name] || 0
        const puto = opsContractByName[emp.name] || 0
        return { ...emp, fee_revenue: fee, puto_revenue: puto }
      }))

      setMsg('✅ 이달 매출 자동 반영 완료')
    } catch {
      setMsg('자동 로드 실패')
    } finally {
      setAutoLoading(false)
    }
  }, [])

  // ── 저장된 데이터 불러오기 ────────────────────────────────
  async function handleLoad() {
    setLoading(true)
    setMsg('')
    const res  = await fetch(`/api/payroll?year_month=${yearMonth}`)
    const json = await res.json()
    if (json.record?.employees) {
      const emps = json.record.employees
      if (emps.ops_employees)  setOpsEmployees(emps.ops_employees)
      if (emps.sales_employees) setSalesEmployees(emps.sales_employees)
      if (emps.other_costs)    setOtherCosts({ ...defaultOtherCosts(), ...emps.other_costs })
      if (emps.revenue_totals) setRevenueTotals(emps.revenue_totals)
      setMsg('불러오기 완료')
    } else {
      setMsg('저장 데이터 없음 — 이달 매출 자동 반영 중...')
      if (yearMonth === thisMonth()) await autoLoadRevenue()
    }
    setLoading(false)
  }

  useEffect(() => { handleLoad() }, [yearMonth])

  // ── 저장 ─────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year_month: yearMonth,
        employees: {
          ops_employees: opsEmployees,
          sales_employees: salesEmployees,
          other_costs: otherCosts,
          revenue_totals: revenueTotals,
        },
        memo: '',
      }),
    })
    const json = await res.json()
    setMsg(json.record ? '저장 완료' : '저장 실패: ' + json.error)
    setSaving(false)
  }

  // ── 관리팀 집계 ───────────────────────────────────────────
  const opsCalcs              = opsEmployees.map(calcOps)
  const opsTotalBase          = opsEmployees.reduce((s, e) => s + Number(e.base_salary), 0)
  const opsTotalFeeRevenue    = opsEmployees.reduce((s, e) => s + Number(e.fee_revenue), 0)
  const opsTotalPutoRevenue   = opsEmployees.reduce((s, e) => s + Number(e.puto_revenue), 0)
  const opsTotalFeeIncentive  = opsCalcs.reduce((s, c) => s + c.feeIncentive, 0)
  const opsTotalPutoIncentive = opsCalcs.reduce((s, c) => s + c.putoIncentive, 0)
  const opsTotalPerformance   = opsEmployees.reduce((s, e) => s + Number(e.performance_bonus), 0)
  const opsTotalBefore        = opsCalcs.reduce((s, c) => s + c.beforeDeduction, 0)
  const opsTotalAfter         = opsCalcs.reduce((s, c) => s + c.afterDeduction, 0)

  // ── 영업팀 집계 ───────────────────────────────────────────
  const salesCalcs               = salesEmployees.map(calcSales)
  const salesTotalContractRevenue = salesEmployees.reduce((s, e) => s + Number(e.contract_revenue), 0)
  const salesTotalContractIncentive = salesCalcs.reduce((s, c) => s + c.contractIncentive, 0)
  const salesTotalPromotion       = salesCalcs.reduce((s, c) => s + c.promotion, 0)
  const salesTotalPerformance     = salesEmployees.reduce((s, e) => s + Number(e.performance_bonus), 0)
  const salesTotalAwards          = salesCalcs.reduce((s, c) => s + c.awardsTotal, 0)
  const salesTotalBefore          = salesCalcs.reduce((s, c) => s + c.beforeDeduction, 0)
  const salesTotalAfter           = salesCalcs.reduce((s, c) => s + c.afterDeduction, 0)

  // ── 회사 손익 ─────────────────────────────────────────────
  const totalRevenue  = (revenueTotals?.sales || 0) + (revenueTotals?.ops || 0) + (revenueTotals?.opsContract || 0)
  const tax           = Math.round(totalRevenue * 0.10)
  const laborCost     = opsTotalBefore + salesTotalBefore
  const dbCost        = Number(otherCosts.db_count) * Number(otherCosts.db_unit_price)
  const otherItemsTotal = (otherCosts.sales_other_items || []).reduce((s, i) => s + Number(i.amount || 0), 0)
  const otherTotal    = dbCost + Number(otherCosts.rent) + Number(otherCosts.mgmt) + Number(otherCosts.sales_fixed) + otherItemsTotal
  const totalCost     = tax + laborCost + otherTotal
  const netProfit     = totalRevenue - totalCost

  // ── 헬퍼 ─────────────────────────────────────────────────
  function updateOps(i: number, field: keyof OpsEmployee, value: string) {
    setOpsEmployees(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: field === 'name' ? value : Number(value) }
      return next
    })
  }
  function updateSales(i: number, field: keyof Omit<SalesEmployee, 'awards'>, value: string) {
    setSalesEmployees(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: field === 'name' ? value : Number(value) }
      return next
    })
  }
  function addAward(empIdx: number) {
    setSalesEmployees(prev => {
      const next = [...prev]
      next[empIdx] = { ...next[empIdx], awards: [...(next[empIdx].awards || []), { reason: '', amount: 0 }] }
      return next
    })
  }
  function updateAward(empIdx: number, awardIdx: number, field: keyof AwardItem, value: string) {
    setSalesEmployees(prev => {
      const next = [...prev]
      const awards = [...(next[empIdx].awards || [])]
      awards[awardIdx] = { ...awards[awardIdx], [field]: field === 'amount' ? Number(value) : value }
      next[empIdx] = { ...next[empIdx], awards }
      return next
    })
  }
  function removeAward(empIdx: number, awardIdx: number) {
    setSalesEmployees(prev => {
      const next = [...prev]
      next[empIdx] = { ...next[empIdx], awards: next[empIdx].awards.filter((_, j) => j !== awardIdx) }
      return next
    })
  }
  function addOtherItem() {
    setOtherCosts(prev => ({ ...prev, sales_other_items: [...(prev.sales_other_items || []), { label: '', amount: 0 }] }))
  }
  function updateOtherItem(i: number, field: keyof OtherCostItem, value: string) {
    setOtherCosts(prev => {
      const items = [...(prev.sales_other_items || [])]
      items[i] = { ...items[i], [field]: field === 'amount' ? Number(value) : value }
      return { ...prev, sales_other_items: items }
    })
  }
  function removeOtherItem(i: number) {
    setOtherCosts(prev => ({ ...prev, sales_other_items: prev.sales_other_items.filter((_, j) => j !== i) }))
  }

  const isCurrentMonth = yearMonth === thisMonth()

  return (
    <div className="space-y-6 pb-8">

      {/* 헤더 */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />

        {isCurrentMonth && (
          <button onClick={autoLoadRevenue} disabled={autoLoading}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-700 border border-blue-200 px-3 py-1.5 rounded text-xs font-medium">
            {autoLoading ? '⏳ 불러오는 중...' : '🔄 이달 매출 자동 반영'}
          </button>
        )}

        <button onClick={handleSave} disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-1.5 rounded text-sm font-medium">
          {saving ? '저장 중...' : '저장'}
        </button>

        {loading && <span className="text-xs text-blue-500">불러오는 중...</span>}
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>

      {/* ── 2열 테이블 ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 관리팀 */}
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2">관리팀</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-xs text-gray-500 text-left whitespace-nowrap border-r border-gray-100">항목</th>
                  {opsEmployees.map((_, i) => (
                    <th key={i} className="px-3 py-2 text-xs text-gray-500 text-center whitespace-nowrap border-r border-gray-100">
                      <input type="text" value={opsEmployees[i].name}
                        onChange={e => updateOps(i, 'name', e.target.value)}
                        className="border border-gray-200 rounded px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 w-20"
                        placeholder={`직원${i + 1}`} />
                    </th>
                  ))}
                  <th className="px-3 py-2 text-xs text-gray-500 text-center whitespace-nowrap">소계</th>
                </tr>
              </thead>
              <tbody>
                <OpsRow label="기본급" values={opsEmployees.map(e => e.base_salary)} total={opsTotalBase}
                  isEditable onChange={(i, v) => updateOps(i, 'base_salary', v)} />
                <OpsRow label="수수료매출(VAT제외)" values={opsEmployees.map(e => e.fee_revenue)} total={opsTotalFeeRevenue}
                  isEditable onChange={(i, v) => updateOps(i, 'fee_revenue', v)} autoHint />
                <OpsRow label="수수료인센(10%)" values={opsCalcs.map(c => c.feeIncentive)} total={opsTotalFeeIncentive} />
                <OpsRow label="뿌토매출(VAT제외)" values={opsEmployees.map(e => e.puto_revenue)} total={opsTotalPutoRevenue}
                  isEditable onChange={(i, v) => updateOps(i, 'puto_revenue', v)} autoHint />
                <OpsRow label="뿌토인센(35%)" values={opsCalcs.map(c => c.putoIncentive)} total={opsTotalPutoIncentive} />
                <OpsRow label="성과급" values={opsEmployees.map(e => e.performance_bonus)} total={opsTotalPerformance}
                  isEditable onChange={(i, v) => updateOps(i, 'performance_bonus', v)} />
                <OpsRow label="공제전급여" values={opsCalcs.map(c => c.beforeDeduction)} total={opsTotalBefore}
                  highlight="blue" bold />
                <OpsRow label="공제후급여(3.3%)" values={opsCalcs.map(c => c.afterDeduction)} total={opsTotalAfter}
                  highlight="emerald" bold />
              </tbody>
            </table>
          </div>
          <button onClick={() => setOpsEmployees(prev => [...prev, defaultOps()])}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1">
            + 직원 추가
          </button>
        </div>

        {/* 영업팀 */}
        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2">영업팀</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-max w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-xs text-gray-500 text-left whitespace-nowrap border-r border-gray-100">항목</th>
                  {salesEmployees.map((_, i) => (
                    <th key={i} className="px-3 py-2 text-xs text-gray-500 text-center whitespace-nowrap border-r border-gray-100">
                      <input type="text" value={salesEmployees[i].name}
                        onChange={e => updateSales(i, 'name', e.target.value)}
                        className="border border-gray-200 rounded px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500 w-20"
                        placeholder={`사원${i + 1}`} />
                    </th>
                  ))}
                  <th className="px-3 py-2 text-xs text-gray-500 text-center whitespace-nowrap">소계</th>
                </tr>
              </thead>
              <tbody>
                {/* 계약금 매출 */}
                <SalesRow label="계약금매출(VAT제외)"
                  values={salesEmployees.map(e => e.contract_revenue)} total={salesTotalContractRevenue}
                  isEditable onChange={(i, v) => updateSales(i, 'contract_revenue', v)} autoHint />
                {/* 계약수 */}
                <SalesRow label="계약수"
                  values={salesEmployees.map(e => e.contract_count)} total={salesEmployees.reduce((s, e) => s + Number(e.contract_count), 0)}
                  isEditable onChange={(i, v) => updateSales(i, 'contract_count', v)} autoHint />
                {/* 계약금 인센 */}
                <SalesRow label="계약금인센(25%+)"
                  values={salesCalcs.map(c => c.contractIncentive)} total={salesTotalContractIncentive}
                  subValues={salesEmployees.map((e, i) => salesCalcs[i].extraRate > 0 ? '+5%(12개↑)' : '')} />
                {/* 프로모션 */}
                <SalesRow label="프로모션"
                  values={salesCalcs.map(c => c.promotion)} total={salesTotalPromotion}
                  subValues={salesEmployees.map(e => promotionLabel(e.contract_count))} />
                {/* 성과급 */}
                <SalesRow label="성과급"
                  values={salesEmployees.map(e => e.performance_bonus)} total={salesTotalPerformance}
                  isEditable onChange={(i, v) => updateSales(i, 'performance_bonus', v)} />
                {/* 시상금 */}
                <SalesRow label="시상금"
                  values={salesCalcs.map(c => c.awardsTotal)} total={salesTotalAwards}
                  highlight="violet" />
                {/* 공제전급여 */}
                <SalesRow label="공제전급여"
                  values={salesCalcs.map(c => c.beforeDeduction)} total={salesTotalBefore}
                  highlight="blue" bold />
                {/* 공제후급여 */}
                <SalesRow label="공제후급여(3.3%)"
                  values={salesCalcs.map(c => c.afterDeduction)} total={salesTotalAfter}
                  highlight="emerald" bold />
              </tbody>
            </table>
          </div>
          <button onClick={() => setSalesEmployees(prev => [...prev, defaultSales()])}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1">
            + 직원 추가
          </button>

          {/* 시상금 상세 */}
          {salesEmployees.some(e => e.name) && (
            <div className="mt-4 bg-violet-50 border border-violet-100 rounded-xl p-3">
              <p className="text-xs font-bold text-violet-700 mb-2">🏆 시상금 상세</p>
              <div className="space-y-3">
                {salesEmployees.map((emp, empIdx) => emp.name ? (
                  <div key={empIdx}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-violet-800">{emp.name}</span>
                      <button onClick={() => addAward(empIdx)}
                        className="text-[10px] text-violet-600 border border-violet-200 rounded px-2 py-0.5 hover:bg-violet-100">
                        + 추가
                      </button>
                    </div>
                    {(emp.awards || []).length === 0 ? (
                      <p className="text-[11px] text-gray-400 pl-2">없음</p>
                    ) : (
                      <div className="space-y-1.5">
                        {emp.awards.map((award, ai) => (
                          <div key={ai} className="flex items-center gap-2">
                            <input type="text" value={award.reason} placeholder="사유"
                              onChange={e => updateAward(empIdx, ai, 'reason', e.target.value)}
                              className="border border-gray-200 rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                            <input type="number" value={award.amount || ''} placeholder="금액"
                              onChange={e => updateAward(empIdx, ai, 'amount', e.target.value)}
                              className="border border-gray-200 rounded px-2 py-1 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-violet-400" />
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                              {award.amount > 0 ? (award.amount / 10000).toFixed(0) + '만' : ''}
                            </span>
                            <button onClick={() => removeAward(empIdx, ai)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 회사 손익 요약 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-700">회사 손익 요약</h3>
          {revenueTotals && (
            <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
              📡 매출 자동 반영됨
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 좌측: 수치 */}
          <div className="space-y-2">
            {/* 매출 내역 */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
              <SummaryRow label="영업팀 매출" value={revenueTotals?.sales || 0} />
              <SummaryRow label="관리팀 수수료 매출" value={revenueTotals?.ops || 0} />
              <SummaryRow label="관리팀 계약(뿌토) 매출" value={revenueTotals?.opsContract || 0} />
              <div className="border-t border-gray-200 pt-1.5">
                <SummaryRow label="총 매출" value={totalRevenue} bold />
              </div>
            </div>
            <SummaryRow label="세금 (10%)" value={tax} />
            <SummaryRow label="인건비 (세전)" value={laborCost} />

            {/* 운영비 */}
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs font-semibold text-gray-500 mb-2">운영비</p>

              {/* DB 비용 */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 w-28 shrink-0">DB 공급</span>
                <div className="flex items-center gap-1">
                  <input type="number" value={otherCosts.db_count}
                    onChange={e => setOtherCosts(prev => ({ ...prev, db_count: Number(e.target.value) }))}
                    className="border border-gray-200 rounded px-2 py-1 text-xs w-16 focus:outline-none"
                    placeholder="갯수" min="0" />
                  <span className="text-[10px] text-gray-400">개</span>
                  <span className="text-[10px] text-gray-400 mx-1">×</span>
                  <input type="number" value={otherCosts.db_unit_price}
                    onChange={e => setOtherCosts(prev => ({ ...prev, db_unit_price: Number(e.target.value) }))}
                    className="border border-gray-200 rounded px-2 py-1 text-xs w-20 focus:outline-none"
                    placeholder="단가" min="0" />
                  <span className="text-[10px] text-gray-400">원</span>
                  <span className="text-xs text-gray-500 ml-1">= {dbCost > 0 ? (dbCost / 10000).toFixed(0) + '만원' : '-'}</span>
                </div>
              </div>

              {[
                { key: 'rent' as keyof OtherCosts, label: '임대료' },
                { key: 'mgmt' as keyof OtherCosts, label: '관리비' },
                { key: 'sales_fixed' as keyof OtherCosts, label: '영업 고정비용' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
                  <input type="number" value={otherCosts[key] as number}
                    onChange={e => setOtherCosts(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="border border-gray-200 rounded px-2 py-1 text-xs w-32 focus:outline-none" min="0" />
                  <span className="text-xs text-gray-400">
                    {((otherCosts[key] as number) / 10000).toFixed(0)}만원
                  </span>
                </div>
              ))}

              {/* 영업 기타비용 */}
              <div className="mt-2">
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-xs text-gray-500">영업 기타비용</span>
                  <button onClick={addOtherItem}
                    className="text-[10px] text-blue-600 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50">
                    + 추가
                  </button>
                </div>
                {(otherCosts.sales_other_items || []).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <input type="text" value={item.label} placeholder="품목명"
                      onChange={e => updateOtherItem(i, 'label', e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs flex-1 focus:outline-none" />
                    <input type="number" value={item.amount || ''} placeholder="금액"
                      onChange={e => updateOtherItem(i, 'amount', e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1 text-xs w-28 focus:outline-none" min="0" />
                    <span className="text-[10px] text-gray-400 w-10 text-right">
                      {item.amount > 0 ? (item.amount / 10000).toFixed(0) + '만' : ''}
                    </span>
                    <button onClick={() => removeOtherItem(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                ))}
                {(otherCosts.sales_other_items || []).length === 0 && (
                  <p className="text-[11px] text-gray-300">없음</p>
                )}
              </div>
            </div>
          </div>

          {/* 우측: 요약 */}
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">DB 비용</span>
                <span>{dbCost > 0 ? fmtW(dbCost) : '-'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">임대료</span>
                <span>{fmtW(otherCosts.rent)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">관리비</span>
                <span>{fmtW(otherCosts.mgmt)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">영업 고정비용</span>
                <span>{fmtW(otherCosts.sales_fixed)}</span>
              </div>
              {(otherCosts.sales_other_items || []).map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-500">{item.label || '기타'}</span>
                  <span>{fmtW(item.amount)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-gray-600">총 운영비</span>
                  <span>{fmtW(otherTotal)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">총 매출</span>
                <span className="font-semibold text-blue-700">{totalRevenue > 0 ? fmtW(totalRevenue) : '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">세금 (10%)</span>
                <span className="text-orange-600">-{tax > 0 ? fmtW(tax) : '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">인건비</span>
                <span className="text-amber-600">-{laborCost > 0 ? fmtW(laborCost) : '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">운영비</span>
                <span className="text-violet-600">-{otherTotal > 0 ? fmtW(otherTotal) : '-'}</span>
              </div>
            </div>

            <div className={`rounded-xl p-4 ${netProfit >= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
              <p className="text-xs text-gray-500 mb-1">순이익</p>
              <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalRevenue > 0 ? fmtW(netProfit) : '—'}
              </p>
              {totalRevenue > 0 && (
                <p className="text-[10px] text-gray-400 mt-1">
                  이익률 {((netProfit / totalRevenue) * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 헬퍼 행 컴포넌트 ────────────────────────────────────

function OpsRow({
  label, values, total, isEditable, onChange, highlight, bold, autoHint,
}: {
  label: string; values: number[]; total: number
  isEditable?: boolean; onChange?: (i: number, v: string) => void
  highlight?: 'blue' | 'emerald'; bold?: boolean; autoHint?: boolean
}) {
  const colorMap = { blue: 'text-blue-600', emerald: 'text-emerald-600' }
  const textColor = highlight ? colorMap[highlight] : 'text-gray-800'

  return (
    <tr className="border-t border-gray-100">
      <td className={`px-3 py-1.5 text-xs whitespace-nowrap border-r border-gray-100 ${bold ? 'font-semibold ' + textColor : 'text-gray-500'}`}>
        {label}
        {autoHint && <span className="ml-1 text-[9px] text-blue-400">자동</span>}
      </td>
      {values.map((v, i) => (
        <td key={i} className="px-2 py-1 border-r border-gray-100">
          {isEditable && onChange ? (
            <input type="number" value={v || ''} onChange={e => onChange(i, e.target.value)}
              className={INPUT_CLS} min="0" placeholder="0" />
          ) : (
            <span className={`${CALC_CLS} block ${bold ? 'font-semibold ' + textColor : ''}`}>
              {v > 0 ? v.toLocaleString('ko-KR') : '-'}
            </span>
          )}
        </td>
      ))}
      <td className={`${CALC_CLS} ${bold ? 'font-bold ' + textColor : ''}`}>
        {total > 0 ? total.toLocaleString('ko-KR') : '-'}
      </td>
    </tr>
  )
}

function SalesRow({
  label, values, total, isEditable, onChange, highlight, bold, autoHint, subValues,
}: {
  label: string; values: number[]; total: number
  isEditable?: boolean; onChange?: (i: number, v: string) => void
  highlight?: 'blue' | 'emerald' | 'violet'; bold?: boolean; autoHint?: boolean
  subValues?: string[]
}) {
  const colorMap = { blue: 'text-blue-600', emerald: 'text-emerald-600', violet: 'text-violet-600' }
  const textColor = highlight ? colorMap[highlight] : 'text-gray-800'

  return (
    <tr className="border-t border-gray-100">
      <td className={`px-3 py-1.5 text-xs whitespace-nowrap border-r border-gray-100 ${bold ? 'font-semibold ' + textColor : 'text-gray-500'}`}>
        {label}
        {autoHint && <span className="ml-1 text-[9px] text-blue-400">자동</span>}
      </td>
      {values.map((v, i) => (
        <td key={i} className="px-2 py-1 border-r border-gray-100">
          {isEditable && onChange ? (
            <input type="number" value={v || ''} onChange={e => onChange(i, e.target.value)}
              className={INPUT_CLS} min="0" placeholder="0" />
          ) : (
            <div>
              <span className={`${CALC_CLS} block ${bold ? 'font-semibold ' + textColor : ''}`}>
                {v > 0 ? v.toLocaleString('ko-KR') : '-'}
              </span>
              {subValues?.[i] && subValues[i] !== '-' && (
                <span className="block text-[9px] text-gray-400 text-right pr-2">{subValues[i]}</span>
              )}
            </div>
          )}
        </td>
      ))}
      <td className={`${CALC_CLS} ${bold ? 'font-bold ' + textColor : ''}`}>
        {total > 0 ? total.toLocaleString('ko-KR') : '-'}
      </td>
    </tr>
  )
}

function SummaryRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-sm font-bold' : 'text-sm'}`}>
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'text-[#1B2A45]' : 'font-semibold'}>
        {value > 0 ? value.toLocaleString('ko-KR') + '원' : '-'}
      </span>
    </div>
  )
}
