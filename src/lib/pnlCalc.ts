// 월별 손익 계산 — 급여·손익 탭(PayrollTab)과 같은 계산식을 서버/분석 화면에서 공통으로 사용
//  매출      = 영업팀 + 관리팀(수수료·뿌토) + 관리팀 계약
//  세금적립  = 매출의 10% (종소세·부가세 대비 보유 권장액)
//  인건비    = 영업·관리·발굴팀 세전 지급액 (급여명세 기준)
//  운영비    = DB 매입비 + 임대 + 관리비 + 고정비 + 기타(알바·장비 등)
//  순이익    = 매출 − 세금적립 − 인건비 − 운영비
import { calcSalesStructure, getPromo, calcDigSalary, OPS_FEE_RATE, OPS_PUTO_RATE } from './payrollCalc'

export interface MonthPnl {
  ym: string
  hasData: boolean
  quality: "ok" | "partial"   // partial = 급여 입력이 덜 된 달(순이익이 실제보다 크게 보일 수 있음)
  partialReason: string
  salesRev: number
  opsRev: number
  totalRev: number
  tax: number
  labor: { sales: number; ops: number; dig: number; total: number; fixed: number; variable: number; salesFixed: number; opsFixed: number; digFixed: number; salesVar: number; opsVar: number; digVar: number }
  costs: { db: number; rent: number; mgmt: number; fixed: number; extra: number; total: number }
  net: number
  margin: number | null
  personal: { card: number; rent: number }
  takeHome: number
  salesCount: number      // 영업 계약 건수(가중)
  opsFeeCount: number     // 관리팀 수수료 입금 건수
  headcount: { sales: number; ops: number; dig: number }
}

const n = (v: unknown) => Number(v) || 0
const sumAwards = (aw: any[] | undefined) => (aw || []).reduce((s, a) => s + n(a?.amount), 0)

export function calcMonthPnl(ym: string, employees: any | null): MonthPnl {
  const e = employees || {}
  const sales: any[] = (e.sales_employees || []).filter((x: any) => x?.name)
  const ops: any[] = (e.ops_employees || []).filter((x: any) => x?.name)
  const dig: any[] = (e.dig_employees || []).filter((x: any) => x?.name)
  const oc = e.other_costs || {}
  const rt = e.revenue_totals || {}

  // 영업팀
  let salesLabor = 0, salesFixed = 0, salesCount = 0, oldFormat = false
  for (const s of sales) {
    // 예전 형식(인센티브율 방식) 기록 지원
    if (s.contract_incentive_rate != null && s.pay_mode == null && s.awards == null) {
      oldFormat = true
      salesLabor += Math.round(n(s.contract_revenue) * n(s.contract_incentive_rate) / 100) + n(s.fee_incentive) + n(s.performance_bonus) - n(s.deduction)
      salesCount += n(s.contract_count)
      continue
    }
    const st = calcSalesStructure({
      revenue: n(s.contract_revenue), perfBonus: n(s.performance_bonus), promo: getPromo(n(s.contract_count)),
      payMode: s.pay_mode, basePay: s.base_pay, workDays: s.work_days, yearMonth: ym,
    })
    salesLabor += st.main + sumAwards(s.awards)
    if (st.chosen === 'base7') salesFixed += st.baseProrated
    salesCount += n(s.contract_count)
  }

  // 관리팀
  let opsLabor = 0, opsFixed = 0, opsFeeCount = 0
  for (const o of ops) {
    opsLabor += n(o.base_salary) + Math.round(n(o.fee_revenue) * OPS_FEE_RATE) + Math.round(n(o.puto_revenue) * OPS_PUTO_RATE)
      + n(o.performance_bonus) + n(o.monthly_sub_bonus) + sumAwards(o.awards)
    opsFixed += n(o.base_salary)
    opsFeeCount += Array.isArray(o.fee_details) ? o.fee_details.length : 0
  }

  // 발굴팀 (입·퇴사월은 일할)
  let digLabor = 0, digFixed = 0
  const [yr, mo] = ym.split('-').map(Number)
  const daysInMonth = new Date(yr, mo, 0).getDate()
  for (const d of dig) {
    let worked: number | undefined, total: number | undefined
    if (d.join_date && String(d.join_date).slice(0, 7) === ym) { worked = daysInMonth - (parseInt(String(d.join_date).slice(8, 10), 10) || 1) + 1; total = daysInMonth }
    if (d.resign_date && String(d.resign_date).slice(0, 7) === ym) { worked = parseInt(String(d.resign_date).slice(8, 10), 10) || daysInMonth; total = daysInMonth }
    const b = calcDigSalary(n(d.approved_count), worked, total)
    digLabor += b.before + sumAwards(d.awards)
    digFixed += b.base
  }

  const labor = {
    sales: salesLabor, ops: opsLabor, dig: digLabor, total: salesLabor + opsLabor + digLabor,
    salesFixed, opsFixed, digFixed,
    fixed: salesFixed + opsFixed + digFixed,
    variable: salesLabor + opsLabor + digLabor - (salesFixed + opsFixed + digFixed),
    salesVar: salesLabor - salesFixed, opsVar: opsLabor - opsFixed, digVar: digLabor - digFixed,
  }

  // DB 매입비: 개수×단가, 예전 형식은 합계(db)로 저장됨
  const db = n(oc.db_count) * n(oc.db_unit_price) || n(oc.db)
  const extra = (oc.sales_other_items || []).reduce((s: number, i: any) => s + n(i?.amount), 0) + n(oc.sales_other) + n(oc.ad_marketing)
  const costs = { db, rent: n(oc.rent), mgmt: n(oc.mgmt), fixed: n(oc.sales_fixed), extra, total: 0 }
  costs.total = costs.db + costs.rent + costs.mgmt + costs.fixed + costs.extra

  const salesRev = n(rt.sales)
  const opsRev = n(rt.ops) + n(rt.opsContract)
  const totalRev = salesRev + opsRev
  const tax = Math.round(totalRev * 0.10)
  const net = totalRev - tax - labor.total - costs.total
  const personal = { card: n(oc.personal_card), rent: n(oc.personal_rent) }
  const hasData = !!employees && (totalRev > 0 || labor.total > 0 || costs.total > 0)
  // 입력 품질: 매출 대비 인건비가 비정상적으로 낮거나 예전 형식이면 '불완전'
  let quality: 'ok' | 'partial' = 'ok', partialReason = ''
  if (hasData && totalRev > 0 && labor.total / totalRev < 0.12) { quality = 'partial'; partialReason = '매출 대비 인건비가 매우 낮음(급여 입력 누락 가능)' }
  if (oldFormat) { quality = 'partial'; partialReason = '예전 형식 기록(관리팀 급여 미입력)' }

  return {
    ym, hasData, quality, partialReason, salesRev, opsRev, totalRev, tax, labor, costs, net,
    margin: totalRev > 0 ? net / totalRev : null,
    personal, takeHome: net - personal.card - personal.rent,
    salesCount, opsFeeCount,
    headcount: { sales: sales.length, ops: ops.length, dig: dig.length },
  }
}
