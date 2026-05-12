'use client'

import { useState, useEffect } from 'react'

// ─── 타입 정의 ────────────────────────────────────────────

interface OpsEmployee {
  name: string
  base_salary: number
  contract_revenue: number        // 계약금 매출 VAT제외
  fee_revenue: number             // 수수료 매출 VAT제외
  performance_bonus: number       // 성과급
  deduction: number               // 환수금
}

interface SalesEmployee {
  name: string
  contract_revenue: number        // 계약금 매출 VAT제외
  contract_incentive_rate: number // 계약금 인센툴 %
  fee_amount: number              // 수수료 풀린 금액
  fee_incentive: number           // 수수료 인센 (입력)
  performance_bonus: number       // 성과급
  deduction: number               // 환수금
}

interface OtherCosts {
  ad_marketing: number
  db: number
  rent: number
  mgmt: number
  sales_fixed: number
  sales_other: number
}

const INPUT_CLS = 'border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full'
const CALC_CLS = 'bg-gray-50 text-gray-600 text-sm px-2 py-1 text-right whitespace-nowrap'

const thisMonth = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── 관리팀 계산 ─────────────────────────────────────────

function calcOps(emp: OpsEmployee) {
  const contractIncentive = Math.round(Number(emp.contract_revenue) * 0.5)
  const feeIncentive = Math.round(Number(emp.fee_revenue) * 0.1)
  const beforeDeduction = Number(emp.base_salary) + contractIncentive + feeIncentive + Number(emp.performance_bonus) - Number(emp.deduction)
  const afterDeduction = Math.round(beforeDeduction * (1 - 0.033))
  return { contractIncentive, feeIncentive, beforeDeduction, afterDeduction }
}

// ─── 영업팀 계산 ─────────────────────────────────────────

function calcSales(emp: SalesEmployee) {
  const contractIncentiveAmt = Math.round(Number(emp.contract_revenue) * Number(emp.contract_incentive_rate) / 100)
  const beforeDeduction = contractIncentiveAmt + Number(emp.fee_incentive) + Number(emp.performance_bonus) - Number(emp.deduction)
  const afterDeduction = Math.round(beforeDeduction * (1 - 0.033))
  return { contractIncentiveAmt, beforeDeduction, afterDeduction }
}

// ─── 컴포넌트 ─────────────────────────────────────────────

export default function PayrollTab() {
  const [yearMonth, setYearMonth] = useState<string>(thisMonth())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const defaultOps = (): OpsEmployee => ({
    name: '',
    base_salary: 0,
    contract_revenue: 0,
    fee_revenue: 0,
    performance_bonus: 0,
    deduction: 0,
  })

  const defaultSales = (): SalesEmployee => ({
    name: '',
    contract_revenue: 0,
    contract_incentive_rate: 10,
    fee_amount: 0,
    fee_incentive: 0,
    performance_bonus: 0,
    deduction: 0,
  })

  const [opsEmployees, setOpsEmployees] = useState<OpsEmployee[]>([
    defaultOps(), defaultOps(), defaultOps(), defaultOps(),
  ])

  const [salesEmployees, setSalesEmployees] = useState<SalesEmployee[]>([
    { ...defaultSales(), name: '손제후' },
    { ...defaultSales(), name: '김윤지' },
    defaultSales(),
    defaultSales(),
  ])

  const [otherCosts, setOtherCosts] = useState<OtherCosts>({
    ad_marketing: 0,
    db: 1700000,
    rent: 650000,
    mgmt: 400000,
    sales_fixed: 0,
    sales_other: 0,
  })

  // 관리팀 합계
  const opsCalcs = opsEmployees.map(calcOps)
  const opsTotalContractRevenue = opsEmployees.reduce((s, e) => s + Number(e.contract_revenue), 0)
  const opsTotalFeeRevenue = opsEmployees.reduce((s, e) => s + Number(e.fee_revenue), 0)
  const opsTotalContractIncentive = opsCalcs.reduce((s, c) => s + c.contractIncentive, 0)
  const opsTotalFeeIncentive = opsCalcs.reduce((s, c) => s + c.feeIncentive, 0)
  const opsTotalPerformance = opsEmployees.reduce((s, e) => s + Number(e.performance_bonus), 0)
  const opsTotalDeduction = opsEmployees.reduce((s, e) => s + Number(e.deduction), 0)
  const opsTotalBefore = opsCalcs.reduce((s, c) => s + c.beforeDeduction, 0)
  const opsTotalAfter = opsCalcs.reduce((s, c) => s + c.afterDeduction, 0)

  // 영업팀 합계
  const salesCalcs = salesEmployees.map(calcSales)
  const salesTotalContractRevenue = salesEmployees.reduce((s, e) => s + Number(e.contract_revenue), 0)
  const salesTotalContractIncentive = salesCalcs.reduce((s, c) => s + c.contractIncentiveAmt, 0)
  const salesTotalFeeIncentive = salesEmployees.reduce((s, e) => s + Number(e.fee_incentive), 0)
  const salesTotalPerformance = salesEmployees.reduce((s, e) => s + Number(e.performance_bonus), 0)
  const salesTotalDeduction = salesEmployees.reduce((s, e) => s + Number(e.deduction), 0)
  const salesTotalBefore = salesCalcs.reduce((s, c) => s + c.beforeDeduction, 0)
  const salesTotalAfter = salesCalcs.reduce((s, c) => s + c.afterDeduction, 0)

  // 회사 손익 요약
  const totalRevenue = opsTotalContractRevenue + opsTotalFeeRevenue + salesTotalContractRevenue
  const tax = Math.round(totalRevenue * 0.10)
  const laborCost = opsTotalBefore + salesTotalBefore
  const otherTotal = Object.values(otherCosts).reduce((s, v) => s + Number(v), 0)
  const totalCost = tax + laborCost + otherTotal
  const netProfit = totalRevenue - totalCost

  function updateOps(i: number, field: keyof OpsEmployee, value: string) {
    setOpsEmployees(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: field === 'name' ? value : Number(value) }
      return next
    })
  }

  function updateSales(i: number, field: keyof SalesEmployee, value: string) {
    setSalesEmployees(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: field === 'name' ? value : Number(value) }
      return next
    })
  }

  async function handleLoad() {
    setLoading(true)
    setMsg('')
    const res = await fetch(`/api/payroll?year_month=${yearMonth}`)
    const json = await res.json()
    if (json.record?.employees) {
      const emps = json.record.employees
      if (emps.ops_employees) setOpsEmployees(emps.ops_employees)
      if (emps.sales_employees) setSalesEmployees(emps.sales_employees)
      if (emps.other_costs) setOtherCosts(emps.other_costs)
      setMsg('불러오기 완료')
    } else {
      setMsg('저장된 데이터가 없습니다.')
    }
    setLoading(false)
  }

  // yearMonth 변경 시 자동 로드
  useEffect(() => {
    handleLoad()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth])

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
        },
        memo: '',
      }),
    })
    const json = await res.json()
    setMsg(json.record ? '저장 완료' : ('저장 실패: ' + json.error))
    setSaving(false)
  }

  return (
    <div className="space-y-6 pb-8">
      {/* 헤더 */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        {loading && <span className="text-xs text-blue-500">불러오는 중...</span>}
        <button onClick={handleSave} disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-1.5 rounded text-sm font-medium">
          {saving ? '저장 중...' : '저장'}
        </button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>

      {/* 2열 레이아웃 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* 관리팀 테이블 */}
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
                        placeholder={`직원${i+1}`} />
                    </th>
                  ))}
                  <th className="px-3 py-2 text-xs text-gray-500 text-center whitespace-nowrap border-r border-gray-100">소계</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {/* 기본급 */}
                <OpsRow label="기본급" values={opsEmployees.map(e => e.base_salary)} total={opsEmployees.reduce((s,e)=>s+Number(e.base_salary),0)}
                  isEditable onChange={(i,v) => updateOps(i,'base_salary',v)} />
                {/* 계약금 매출 */}
                <OpsRow label="계약금 매출(VAT제외)" values={opsEmployees.map(e => e.contract_revenue)} total={opsTotalContractRevenue}
                  isEditable onChange={(i,v) => updateOps(i,'contract_revenue',v)} />
                {/* 계약 인센 */}
                <OpsRow label="계약 인센(50%)" values={opsCalcs.map(c => c.contractIncentive)} total={opsTotalContractIncentive} />
                {/* 수수료 매출 */}
                <OpsRow label="수수료 매출(VAT제외)" values={opsEmployees.map(e => e.fee_revenue)} total={opsTotalFeeRevenue}
                  isEditable onChange={(i,v) => updateOps(i,'fee_revenue',v)} />
                {/* 수수료 인센 */}
                <OpsRow label="수수료 인센(10%)" values={opsCalcs.map(c => c.feeIncentive)} total={opsTotalFeeIncentive} />
                {/* 성과급 */}
                <OpsRow label="성과급" values={opsEmployees.map(e => e.performance_bonus)} total={opsTotalPerformance}
                  isEditable onChange={(i,v) => updateOps(i,'performance_bonus',v)} />
                {/* 환수금 */}
                <OpsRow label="환수금" values={opsEmployees.map(e => e.deduction)} total={opsTotalDeduction}
                  isEditable onChange={(i,v) => updateOps(i,'deduction',v)} highlight="red" />
                {/* 공제 전 급여 */}
                <OpsRow label="공제 전 급여" values={opsCalcs.map(c => c.beforeDeduction)} total={opsTotalBefore} highlight="blue" bold />
                {/* 공제 후 급여 */}
                <OpsRow label="공제 후 급여(3.3%)" values={opsCalcs.map(c => c.afterDeduction)} total={opsTotalAfter} highlight="emerald" bold />
              </tbody>
            </table>
          </div>
          <button onClick={() => setOpsEmployees(prev => [...prev, defaultOps()])}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1">
            + 직원 추가
          </button>
        </div>

        {/* 영업팀 테이블 */}
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
                        placeholder={`사원${i+1}`} />
                    </th>
                  ))}
                  <th className="px-3 py-2 text-xs text-gray-500 text-center whitespace-nowrap border-r border-gray-100">소계</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {/* 계약금 매출 */}
                <SalesRow label="계약금 매출(VAT제외)" values={salesEmployees.map(e=>e.contract_revenue)} total={salesTotalContractRevenue}
                  isEditable onChange={(i,v)=>updateSales(i,'contract_revenue',v)} />
                {/* 인센툴 */}
                <SalesRow label="인센툴(%)" values={salesEmployees.map(e=>e.contract_incentive_rate)} total={0}
                  isEditable onChange={(i,v)=>updateSales(i,'contract_incentive_rate',v)} isPercent />
                {/* 계약 인센 금액 */}
                <SalesRow label="계약 인센 금액" values={salesCalcs.map(c=>c.contractIncentiveAmt)} total={salesTotalContractIncentive} />
                {/* 수수료 풀린 금액 */}
                <SalesRow label="수수료 풀린 금액" values={salesEmployees.map(e=>e.fee_amount)} total={salesEmployees.reduce((s,e)=>s+Number(e.fee_amount),0)}
                  isEditable onChange={(i,v)=>updateSales(i,'fee_amount',v)} />
                {/* 수수료 인센 */}
                <SalesRow label="수수료 인센" values={salesEmployees.map(e=>e.fee_incentive)} total={salesTotalFeeIncentive}
                  isEditable onChange={(i,v)=>updateSales(i,'fee_incentive',v)} />
                {/* 성과급 */}
                <SalesRow label="성과급(프로모션+시상금)" values={salesEmployees.map(e=>e.performance_bonus)} total={salesTotalPerformance}
                  isEditable onChange={(i,v)=>updateSales(i,'performance_bonus',v)} />
                {/* 환수금 */}
                <SalesRow label="환수금" values={salesEmployees.map(e=>e.deduction)} total={salesTotalDeduction}
                  isEditable onChange={(i,v)=>updateSales(i,'deduction',v)} highlight="red" />
                {/* 공제 전 급여 */}
                <SalesRow label="공제 전 급여" values={salesCalcs.map(c=>c.beforeDeduction)} total={salesTotalBefore} highlight="blue" bold />
                {/* 공제 후 급여 */}
                <SalesRow label="공제 후 급여(3.3%)" values={salesCalcs.map(c=>c.afterDeduction)} total={salesTotalAfter} highlight="emerald" bold />
              </tbody>
            </table>
          </div>
          <button onClick={() => setSalesEmployees(prev => [...prev, defaultSales()])}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1">
            + 직원 추가
          </button>
        </div>
      </div>

      {/* 회사 손익 요약 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-700 mb-4">회사 손익 요약</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 자동 계산 항목 */}
          <div className="space-y-2">
            <SummaryRow label="총 매출" value={totalRevenue} />
            <SummaryRow label="세금 (10%)" value={tax} />
            <SummaryRow label="인건비 (세전)" value={laborCost} />
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs font-semibold text-gray-500 mb-2">운영비</p>
              {([
                ['ad_marketing', '광고/마케팅'],
                ['db', 'DB'],
                ['rent', '임대료'],
                ['mgmt', '관리비(관리,주차)'],
                ['sales_fixed', '영업 고정비용'],
                ['sales_other', '영업 기타비용'],
              ] as [keyof OtherCosts, string][]).map(([field, label]) => (
                <div key={field} className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
                  <input type="number" value={otherCosts[field]}
                    onChange={e => setOtherCosts(prev => ({ ...prev, [field]: Number(e.target.value) }))}
                    className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-32" min="0" />
                  <span className="text-xs text-gray-400">{Number(otherCosts[field]).toLocaleString('ko-KR')}원</span>
                </div>
              ))}
            </div>
          </div>

          {/* 결과 요약 */}
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">총 운영비</span><span>{otherTotal.toLocaleString('ko-KR')}원</span></div>
              <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">총 매입</span><span>{totalCost.toLocaleString('ko-KR')}원</span></div>
            </div>
            <div className={`rounded-lg p-4 ${netProfit >= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
              <p className="text-xs text-gray-500 mb-1">순이익</p>
              <p className={`text-2xl font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {netProfit.toLocaleString('ko-KR')}원
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 헬퍼 행 컴포넌트 ────────────────────────────────────

function OpsRow({
  label, values, total, isEditable, onChange, highlight, bold, isPercent,
}: {
  label: string
  values: number[]
  total: number
  isEditable?: boolean
  onChange?: (i: number, v: string) => void
  highlight?: 'red' | 'blue' | 'emerald'
  bold?: boolean
  isPercent?: boolean
}) {
  const colorMap = {
    red: 'text-red-600',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
  }
  const textColor = highlight ? colorMap[highlight] : 'text-gray-800'

  return (
    <tr className="border-t border-gray-100">
      <td className={`px-3 py-1.5 text-xs whitespace-nowrap border-r border-gray-100 ${bold ? 'font-semibold ' + textColor : 'text-gray-500'}`}>
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className="px-2 py-1 border-r border-gray-100">
          {isEditable && onChange ? (
            <input type="number" value={v} onChange={e => onChange(i, e.target.value)}
              className={INPUT_CLS} min="0" />
          ) : (
            <span className={`${CALC_CLS} block ${bold ? 'font-semibold ' + textColor : ''}`}>
              {isPercent ? v + '%' : v.toLocaleString('ko-KR')}
            </span>
          )}
        </td>
      ))}
      <td className={`${CALC_CLS} border-r border-gray-100 ${bold ? 'font-bold ' + textColor : ''}`}>
        {isPercent ? '-' : total.toLocaleString('ko-KR')}
      </td>
      <td />
    </tr>
  )
}

function SalesRow({
  label, values, total, isEditable, onChange, highlight, bold, isPercent,
}: {
  label: string
  values: number[]
  total: number
  isEditable?: boolean
  onChange?: (i: number, v: string) => void
  highlight?: 'red' | 'blue' | 'emerald'
  bold?: boolean
  isPercent?: boolean
}) {
  const colorMap = {
    red: 'text-red-600',
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
  }
  const textColor = highlight ? colorMap[highlight] : 'text-gray-800'

  return (
    <tr className="border-t border-gray-100">
      <td className={`px-3 py-1.5 text-xs whitespace-nowrap border-r border-gray-100 ${bold ? 'font-semibold ' + textColor : 'text-gray-500'}`}>
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className="px-2 py-1 border-r border-gray-100">
          {isEditable && onChange ? (
            <input type="number" value={v} onChange={e => onChange(i, e.target.value)}
              className={INPUT_CLS} min="0" />
          ) : (
            <span className={`${CALC_CLS} block ${bold ? 'font-semibold ' + textColor : ''}`}>
              {isPercent ? v + '%' : v.toLocaleString('ko-KR')}
            </span>
          )}
        </td>
      ))}
      <td className={`${CALC_CLS} border-r border-gray-100 ${bold ? 'font-bold ' + textColor : ''}`}>
        {isPercent ? '-' : total.toLocaleString('ko-KR')}
      </td>
      <td />
    </tr>
  )
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold">{value.toLocaleString('ko-KR')}원</span>
    </div>
  )
}
