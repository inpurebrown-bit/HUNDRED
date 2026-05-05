'use client'

import { useState } from 'react'

// ─── 타입 정의 ────────────────────────────────────────────

interface SummaryRow {
  employee_count: number
  target_count: number
  payment_count: number
  working_days_elapsed: number
  total_working_days: number
}

interface EmployeeRow {
  name: string
  target: number
  supply_count: number
  supply_payment: number
  direct_count: number
  direct_payment: number
}

interface SalesEmployee {
  name: string
  sales_vat_incl: number
}

interface OpsEmployee {
  name: string
  fee_vat_incl: number
  contract_vat_incl: number
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
const GOOD_CLS = 'bg-emerald-500 text-white text-xs px-2 py-0.5 rounded font-bold'
const BAD_CLS = 'bg-red-500 text-white text-xs px-2 py-0.5 rounded font-bold'

const todayStr = (): string => new Date().toISOString().slice(0, 10)

// ─── 결제율 서브뷰 ────────────────────────────────────────

function PayRateSubView() {
  const [date, setDate] = useState<string>(todayStr())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const [summary, setSummary] = useState<SummaryRow>({
    employee_count: 0,
    target_count: 0,
    payment_count: 0,
    working_days_elapsed: 0,
    total_working_days: 0,
  })

  const defaultEmployee = (): EmployeeRow => ({
    name: '',
    target: 0,
    supply_count: 0,
    supply_payment: 0,
    direct_count: 0,
    direct_payment: 0,
  })

  const [employees, setEmployees] = useState<EmployeeRow[]>([
    { ...defaultEmployee(), name: '손제후' },
    { ...defaultEmployee(), name: '김윤지' },
    defaultEmployee(),
    defaultEmployee(),
  ])

  // 자동계산 — 테이블 A
  const ec = Number(summary.employee_count)
  const tc = Number(summary.target_count)
  const pc = Number(summary.payment_count)
  const we = Number(summary.working_days_elapsed)
  const tw = Number(summary.total_working_days)

  const remaining = tw - we
  const expected = we > 0 ? (pc / we) * tw : 0
  const expectedPerPersonMonth = ec > 0 ? expected / ec : 0
  const expectedPerPersonDay = we > 0 && ec > 0 ? pc / we / ec : 0
  const targetPerPersonMonth = ec > 0 ? tc / ec : 0
  const targetPerPersonDay = tw > 0 && ec > 0 ? tc / tw / ec : 0
  const statusA = we > 0 && tw > 0
    ? (pc / we >= tc / tw ? 'GOOD' : 'BAD')
    : '-'

  function fmtNum(n: number): string {
    if (!isFinite(n)) return '-'
    return Number.isInteger(n) ? n.toLocaleString('ko-KR') : n.toFixed(2)
  }

  // 자동계산 — 테이블 B per employee
  function calcEmployee(row: EmployeeRow) {
    const total = Number(row.supply_payment) + Number(row.direct_payment)
    const supplyTotal = Number(row.supply_count) + Number(row.direct_count)
    const supplyRate = Number(row.supply_count) > 0
      ? (total / Number(row.supply_count) * 100).toFixed(2) + '%'
      : '-'
    const directRate = Number(row.direct_count) > 0
      ? (Number(row.direct_payment) / Number(row.direct_count) * 100).toFixed(2) + '%'
      : '-'
    const totalRate = supplyTotal > 0
      ? (total / supplyTotal * 100).toFixed(2) + '%'
      : '-'
    const needed = Number(row.target) - total
    const neededRate = supplyTotal > 0
      ? (needed / supplyTotal * 100).toFixed(2) + '%'
      : '-'
    const st = we > 0 && tw > 0
      ? (total / we >= Number(row.target) / tw ? 'GOOD' : 'BAD')
      : '-'
    return { total, supplyRate, directRate, totalRate, needed, neededRate, status: st }
  }

  // 합계 행
  const totalTarget = employees.reduce((s, r) => s + Number(r.target), 0)
  const totalSupplyCount = employees.reduce((s, r) => s + Number(r.supply_count), 0)
  const totalSupplyPay = employees.reduce((s, r) => s + Number(r.supply_payment), 0)
  const totalDirectCount = employees.reduce((s, r) => s + Number(r.direct_count), 0)
  const totalDirectPay = employees.reduce((s, r) => s + Number(r.direct_payment), 0)
  const totalPayment = totalSupplyPay + totalDirectPay
  const totalAllCount = totalSupplyCount + totalDirectCount
  const totalSupplyRate = totalSupplyCount > 0 ? (totalPayment / totalSupplyCount * 100).toFixed(2) + '%' : '-'
  const totalDirectRate = totalDirectCount > 0 ? (totalDirectPay / totalDirectCount * 100).toFixed(2) + '%' : '-'
  const totalTotalRate = totalAllCount > 0 ? (totalPayment / totalAllCount * 100).toFixed(2) + '%' : '-'
  const totalNeeded = totalTarget - totalPayment
  const totalNeededRate = totalAllCount > 0 ? (totalNeeded / totalAllCount * 100).toFixed(2) + '%' : '-'

  function updateEmployee(i: number, field: keyof EmployeeRow, value: string) {
    setEmployees(prev => {
      const next = [...prev]
      next[i] = {
        ...next[i],
        [field]: field === 'name' ? value : Number(value),
      }
      return next
    })
  }

  async function handleLoad() {
    setLoading(true)
    setMsg('')
    const res = await fetch(`/api/payrate?date=${date}`)
    const json = await res.json()
    if (json.record) {
      const r = json.record
      setSummary({
        employee_count: r.employee_count ?? 0,
        target_count: r.target_count ?? 0,
        payment_count: r.payment_count ?? 0,
        working_days_elapsed: r.working_days_elapsed ?? 0,
        total_working_days: r.total_working_days ?? 0,
      })
      if (Array.isArray(r.employee_details) && r.employee_details.length > 0) {
        setEmployees(r.employee_details)
      }
      setMsg('불러오기 완료')
    } else {
      setMsg('저장된 데이터가 없습니다.')
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/payrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        ...summary,
        employee_details: employees,
      }),
    })
    const json = await res.json()
    setMsg(json.record ? '저장 완료' : ('저장 실패: ' + json.error))
    setSaving(false)
  }

  return (
    <div className="space-y-6 pb-8">
      {/* 날짜 / 버튼 */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button onClick={handleLoad} disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-1.5 rounded text-sm font-medium">
          {loading ? '불러오는 중...' : '불러오기'}
        </button>
        <button onClick={handleSave} disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-1.5 rounded text-sm font-medium">
          {saving ? '저장 중...' : '저장'}
        </button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>

      {/* 테이블 A — 영업일 기준 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">영업일 기준</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-max w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['인원수','목표개수','결제개수','진행된영업일수','이달의영업일','잔여영업일','예상개수','예상인당이번달결제','예상인당하루결제','목표인당이번달결제','목표인당하루결제','진행상태'].map(h => (
                  <th key={h} className="px-3 py-2 text-xs text-gray-500 font-semibold text-center whitespace-nowrap border-r border-gray-100 last:border-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                {(['employee_count','target_count','payment_count','working_days_elapsed','total_working_days'] as (keyof SummaryRow)[]).map(field => (
                  <td key={field} className="px-2 py-1 border-r border-gray-100">
                    <input
                      type="number"
                      value={summary[field]}
                      onChange={e => setSummary(prev => ({ ...prev, [field]: Number(e.target.value) }))}
                      className={INPUT_CLS}
                      min="0"
                    />
                  </td>
                ))}
                <td className={CALC_CLS + ' border-r border-gray-100'}>{fmtNum(remaining)}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{fmtNum(expected)}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{fmtNum(expectedPerPersonMonth)}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{fmtNum(expectedPerPersonDay)}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{fmtNum(targetPerPersonMonth)}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{fmtNum(targetPerPersonDay)}</td>
                <td className="px-2 py-1 text-center">
                  {statusA === '-' ? <span className="text-gray-400 text-xs">-</span> :
                    <span className={statusA === 'GOOD' ? GOOD_CLS : BAD_CLS}>{statusA}</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 테이블 B — 직원별 */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">DB 기준 (직원별)</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-max w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['연번','직원명','목표개수','공급개수','공급결제개수','직접(소개)개수','직접결제개수','총결제개수','공급대비결제율','직접대비결제율','총결제율','목표까지필요개수','목표까지필요결제율','진행상태'].map(h => (
                  <th key={h} className="px-3 py-2 text-xs text-gray-500 font-semibold text-center whitespace-nowrap border-r border-gray-100 last:border-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((row, i) => {
                const calc = calcEmployee(row)
                return (
                  <tr key={i} className="border-t border-gray-100 bg-white hover:bg-gray-50">
                    <td className="px-3 py-1 text-center text-gray-500 border-r border-gray-100">{i + 1}</td>
                    <td className="px-2 py-1 border-r border-gray-100 min-w-[80px]">
                      <input type="text" value={row.name} onChange={e => updateEmployee(i, 'name', e.target.value)} className={INPUT_CLS} placeholder="직원명" />
                    </td>
                    {(['target','supply_count','supply_payment','direct_count','direct_payment'] as (keyof EmployeeRow)[]).map(field => (
                      <td key={field} className="px-2 py-1 border-r border-gray-100 min-w-[70px]">
                        <input type="number" value={row[field] as number} onChange={e => updateEmployee(i, field, e.target.value)} className={INPUT_CLS} min="0" />
                      </td>
                    ))}
                    <td className={CALC_CLS + ' border-r border-gray-100'}>{calc.total.toLocaleString('ko-KR')}</td>
                    <td className={CALC_CLS + ' border-r border-gray-100'}>{calc.supplyRate}</td>
                    <td className={CALC_CLS + ' border-r border-gray-100'}>{calc.directRate}</td>
                    <td className={CALC_CLS + ' border-r border-gray-100'}>{calc.totalRate}</td>
                    <td className={CALC_CLS + ' border-r border-gray-100'}>{calc.needed.toLocaleString('ko-KR')}</td>
                    <td className={CALC_CLS + ' border-r border-gray-100'}>{calc.neededRate}</td>
                    <td className="px-2 py-1 text-center">
                      {calc.status === '-' ? <span className="text-gray-400 text-xs">-</span> :
                        <span className={calc.status === 'GOOD' ? GOOD_CLS : BAD_CLS}>{calc.status}</span>}
                    </td>
                    <td className="px-2 py-1 border-l border-gray-100">
                      <button onClick={() => setEmployees(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600 text-xs px-1">삭제</button>
                    </td>
                  </tr>
                )
              })}

              {/* 합계 행 */}
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-3 py-1 text-center text-gray-500 border-r border-gray-100" colSpan={2}>계</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{totalTarget.toLocaleString('ko-KR')}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{totalSupplyCount.toLocaleString('ko-KR')}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{totalSupplyPay.toLocaleString('ko-KR')}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{totalDirectCount.toLocaleString('ko-KR')}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{totalDirectPay.toLocaleString('ko-KR')}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{totalPayment.toLocaleString('ko-KR')}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{totalSupplyRate}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{totalDirectRate}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{totalTotalRate}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{totalNeeded.toLocaleString('ko-KR')}</td>
                <td className={CALC_CLS + ' border-r border-gray-100'}>{totalNeededRate}</td>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <button
          onClick={() => setEmployees(prev => [...prev, defaultEmployee()])}
          className="mt-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-3 py-1">
          + 직원 추가
        </button>
      </div>
    </div>
  )
}

// ─── 손익계산서 서브뷰 ────────────────────────────────────

interface SalesEmp {
  name: string
  sales_vat_incl: number
}

interface OpsEmp {
  name: string
  fee_vat_incl: number
  contract_vat_incl: number
}

interface OtherCost {
  ad_marketing: number
  db: number
  rent: number
  mgmt: number
  sales_fixed: number
  sales_other: number
}

function PnlSubView() {
  const [date, setDate] = useState<string>(todayStr())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const [salesEmps, setSalesEmps] = useState<SalesEmp[]>([
    { name: '', sales_vat_incl: 0 },
    { name: '', sales_vat_incl: 0 },
  ])
  const [opsEmps, setOpsEmps] = useState<OpsEmp[]>([
    { name: '', fee_vat_incl: 0, contract_vat_incl: 0 },
  ])
  const [otherCosts, setOtherCosts] = useState<OtherCost>({
    ad_marketing: 0,
    db: 0,
    rent: 0,
    mgmt: 0,
    sales_fixed: 0,
    sales_other: 0,
  })
  const [ceoSalary, setCeoSalary] = useState<number>(0)

  // 매출 계산 (직접 부가세 제외 금액 입력)
  // sales_vat_incl 필드를 부가세 제외 금액으로 직접 사용
  const salesTotal = salesEmps.reduce((s, e) => s + Number(e.sales_vat_incl), 0)
  // 관리팀 합계 (fee_vat_incl, contract_vat_incl 도 부가세 제외 금액)
  const opsFeeTotal = opsEmps.reduce((s, e) => s + Number(e.fee_vat_incl), 0)
  const opsContractTotal = opsEmps.reduce((s, e) => s + Number(e.contract_vat_incl), 0)
  // 총 매출
  const totalRevenue = salesTotal + opsFeeTotal + opsContractTotal

  // 매입 — 영업팀
  const salesTax = salesTotal * 0.15
  const salesWage = salesTotal * 0.30
  // 매입 — 관리팀 (고정급은 별도 입력 없이 0 기본)
  // 기타 운영비 합계
  const otherTotal = Object.values(otherCosts).reduce((s, v) => s + Number(v), 0)
  // 총 매입
  const totalCost = salesTax + salesWage + otherTotal
  // 순이익
  const netProfit = totalRevenue - totalCost

  // DB 미니계산기
  const [dbCount, setDbCount] = useState(0)
  const [dbUnitPrice, setDbUnitPrice] = useState(0)
  const [dbPurchaseCost, setDbPurchaseCost] = useState(0)
  const ifRevenue = Number(dbCount) * Number(dbUnitPrice)
  const ifTax = ifRevenue * 0.15
  const ifProfit = ifRevenue - ifTax - Number(dbPurchaseCost) - Number(ceoSalary)
  const personalProfit = netProfit - Number(ceoSalary)

  async function handleLoad() {
    setLoading(true)
    setMsg('')
    const res = await fetch(`/api/pnl?date=${date}`)
    const json = await res.json()
    if (json.record) {
      const r = json.record
      if (Array.isArray(r.sales_employees)) setSalesEmps(r.sales_employees)
      if (Array.isArray(r.ops_employees)) setOpsEmps(r.ops_employees)
      if (r.other_costs) setOtherCosts(r.other_costs)
      if (r.ceo_salary !== undefined) setCeoSalary(r.ceo_salary)
      setMsg('불러오기 완료')
    } else {
      setMsg('저장된 데이터가 없습니다.')
    }
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/pnl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, sales_employees: salesEmps, ops_employees: opsEmps, other_costs: otherCosts, ceo_salary: ceoSalary }),
    })
    const json = await res.json()
    setMsg(json.record ? '저장 완료' : ('저장 실패: ' + json.error))
    setSaving(false)
  }

  function updateSalesEmp(i: number, field: keyof SalesEmp, value: string) {
    setSalesEmps(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: field === 'name' ? value : Number(value) }
      return next
    })
  }

  function updateOpsEmp(i: number, field: keyof OpsEmp, value: string) {
    setOpsEmps(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: field === 'name' ? value : Number(value) }
      return next
    })
  }

  return (
    <div className="space-y-6 pb-8">
      {/* 날짜 / 버튼 */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <button onClick={handleLoad} disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-1.5 rounded text-sm font-medium">
          {loading ? '불러오는 중...' : '불러오기'}
        </button>
        <button onClick={handleSave} disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-1.5 rounded text-sm font-medium">
          {saving ? '저장 중...' : '저장'}
        </button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>

      {/* 2열 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 매출 섹션 */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700">매출</h3>

          {/* 영업팀 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-3">영업팀</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="text-left pb-1">직원명</th>
                  <th className="text-right pb-1">매출 (부가세 제외)</th>
                  <th />
                </tr>
              </thead>
              <tbody className="space-y-1">
                {salesEmps.map((e, i) => (
                  <tr key={i}>
                    <td className="pr-2 py-0.5">
                      <input type="text" value={e.name} onChange={ev => updateSalesEmp(i, 'name', ev.target.value)}
                        className={INPUT_CLS} placeholder="직원명" />
                    </td>
                    <td className="pr-2 py-0.5">
                      <input type="number" value={e.sales_vat_incl} onChange={ev => updateSalesEmp(i, 'sales_vat_incl', ev.target.value)}
                        className={INPUT_CLS} min="0" placeholder="0" />
                    </td>
                    <td>
                      <button onClick={() => setSalesEmps(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600 text-xs ml-1">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setSalesEmps(prev => [...prev, { name: '', sales_vat_incl: 0 }])}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800">+ 영업팀 직원 추가</button>
          </div>

          {/* 관리팀 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-3">관리팀</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="text-left pb-1">직원명</th>
                  <th className="text-right pb-1">수수료 (부가세 제외)</th>
                  <th className="text-right pb-1">계약 (부가세 제외)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {opsEmps.map((e, i) => (
                  <tr key={i}>
                    <td className="pr-2 py-0.5">
                      <input type="text" value={e.name} onChange={ev => updateOpsEmp(i, 'name', ev.target.value)}
                        className={INPUT_CLS} placeholder="직원명" />
                    </td>
                    <td className="pr-2 py-0.5">
                      <input type="number" value={e.fee_vat_incl} onChange={ev => updateOpsEmp(i, 'fee_vat_incl', ev.target.value)}
                        className={INPUT_CLS} min="0" placeholder="0" />
                    </td>
                    <td className="pr-2 py-0.5">
                      <input type="number" value={e.contract_vat_incl} onChange={ev => updateOpsEmp(i, 'contract_vat_incl', ev.target.value)}
                        className={INPUT_CLS} min="0" placeholder="0" />
                    </td>
                    <td>
                      <button onClick={() => setOpsEmps(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400 hover:text-red-600 text-xs ml-1">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setOpsEmps(prev => [...prev, { name: '', fee_vat_incl: 0, contract_vat_incl: 0 }])}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800">+ 관리팀 직원 추가</button>
          </div>
        </div>

        {/* 매입 + 기타 */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700">매입 / 비용</h3>

          {/* 영업팀 매입 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-3">영업팀 매입</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="text-left pb-1">직원명</th>
                  <th className="text-right pb-1">세금 (15%)</th>
                  <th className="text-right pb-1">월급 (30%)</th>
                </tr>
              </thead>
              <tbody>
                {salesEmps.map((e, i) => {
                  const amt = Number(e.sales_vat_incl)
                  return (
                    <tr key={i}>
                      <td className="pr-2 py-0.5 text-gray-600 text-xs">{e.name || `직원${i+1}`}</td>
                      <td className={CALC_CLS}>{Math.round(amt * 0.15).toLocaleString('ko-KR')}</td>
                      <td className={CALC_CLS}>{Math.round(amt * 0.30).toLocaleString('ko-KR')}</td>
                    </tr>
                  )
                })}
                <tr className="border-t border-gray-100 font-semibold">
                  <td className="pr-2 py-1 text-xs text-gray-500">소계</td>
                  <td className={CALC_CLS}>{Math.round(salesTax).toLocaleString('ko-KR')}</td>
                  <td className={CALC_CLS}>{Math.round(salesWage).toLocaleString('ko-KR')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 기타 운영비 */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h4 className="text-xs font-semibold text-gray-500 mb-3">기타 운영비</h4>
            <div className="space-y-2">
              {([
                ['ad_marketing', '광고/마케팅'],
                ['db', 'DB'],
                ['rent', '임대료'],
                ['mgmt', '관리비'],
                ['sales_fixed', '영업고정비용'],
                ['sales_other', '영업기타비용'],
              ] as [keyof OtherCost, string][]).map(([field, label]) => (
                <div key={field} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
                  <input type="number" value={otherCosts[field]}
                    onChange={e => setOtherCosts(prev => ({ ...prev, [field]: Number(e.target.value) }))}
                    className={INPUT_CLS} min="0" />
                  <span className="text-xs text-gray-400 w-28 text-right">
                    {Number(otherCosts[field]).toLocaleString('ko-KR')}원
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 요약 카드 */}
          <div className="bg-gray-900 text-white rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-semibold text-gray-300 mb-3">손익 요약</h4>
            <div className="flex justify-between text-sm">
              <span>총 매출</span>
              <span className="font-bold">{totalRevenue.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>총 매입</span>
              <span className="font-bold">{totalCost.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="border-t border-gray-700 pt-2 flex justify-between text-base font-bold">
              <span>순이익</span>
              <span className={netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {netProfit.toLocaleString('ko-KR')}원
              </span>
            </div>
          </div>

          {/* 개인 고정 생활비 */}
          <div className="mt-3">
            <p className="text-[10px] text-gray-400 font-semibold mb-2 uppercase tracking-wide">개인 고정 생활비</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-rose-600">💳 카드값</span>
                <span className="text-sm font-bold text-rose-700">300만원</span>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-orange-600">🏠 집월세</span>
                <span className="text-sm font-bold text-orange-700">65만원</span>
              </div>
            </div>
            <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">순이익 - 생활비</span>
              <span className={`text-sm font-bold ${(netProfit - 3650000) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {(netProfit - 3650000).toLocaleString('ko-KR')}원
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* DB 미니 계산기 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 max-w-md">
        <h4 className="text-sm font-bold text-gray-700 mb-3">DB 미니 계산기</h4>
        <div className="space-y-2">
          {([
            ['DB개수', dbCount, (v: string) => setDbCount(Number(v))],
            ['DB단가(원/개)', dbUnitPrice, (v: string) => setDbUnitPrice(Number(v))],
            ['DB구매비용', dbPurchaseCost, (v: string) => setDbPurchaseCost(Number(v))],
            ['대표 개인 월급', ceoSalary, (v: string) => setCeoSalary(Number(v))],
          ] as [string, number, (v: string) => void][]).map(([label, val, setter]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
              <input type="number" value={val} onChange={e => setter(e.target.value)}
                className={INPUT_CLS} min="0" />
            </div>
          ))}
          <div className="border-t border-gray-100 pt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">IF 매출</span><span>{ifRevenue.toLocaleString('ko-KR')}원</span></div>
            <div className="flex justify-between"><span className="text-gray-500">세금 (15%)</span><span>{Math.round(ifTax).toLocaleString('ko-KR')}원</span></div>
            <div className="flex justify-between font-semibold"><span>IF 수익</span><span className={ifProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{Math.round(ifProfit).toLocaleString('ko-KR')}원</span></div>
            <div className="flex justify-between font-semibold"><span>개인 수익</span><span className={personalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{Math.round(personalProfit).toLocaleString('ko-KR')}원</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 탭 컴포넌트 ────────────────────────────────────

type SubView = '결제율' | '손익계산'

export default function PayRateTab() {
  const [subView, setSubView] = useState<SubView>('결제율')

  return (
    <div className="space-y-4 pb-8">
      {/* 서브뷰 전환 버튼 */}
      <div className="flex gap-2">
        {(['결제율', '손익계산'] as SubView[]).map(v => (
          <button
            key={v}
            onClick={() => setSubView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              subView === v
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {subView === '결제율' && <PayRateSubView />}
      {subView === '손익계산' && <PnlSubView />}
    </div>
  )
}
