// 대표 플래너 계산 — 엑셀(123.xlsx)의 계산식을 그대로 옮긴 것
//  남은돈      = 영업매출 + 관리매출 − (영업 인건비 + 관리 인건비 + 관리 기본급 + 발굴 기본급) − 세금
//  뺄거 다빼고 = 남은돈 − (사무실 임대료 + 대출 + 기타이자 + 카드값 + 월세)
//  이러면 남은돈 = 뺄거 다빼고 − (결혼 모을돈 + 사무실 확장 모을돈)

export interface Assumptions {
  unit: number          // 계약 1건당 매출
  salesRate: number     // 영업팀 인건비율 (매출 대비)
  opsRate: number       // 관리팀 인건비율 (수수료 매출 대비)
  taxRate: number       // 세금 (매출 대비)
  opsBase: number       // 관리팀 기본급
  digBase: number       // 발굴팀 기본급
  rent: number          // 사무실 임대료
  extraInterest: number // 대출 현황에 없는 기타 이자·할부
  card: number          // 카드값
  living: number        // 월세
  marry: number         // 결혼 모을돈
  expand: number        // 사무실 확장 모을돈
}

export const DEFAULT_ASM: Assumptions = {
  unit: 500000, salesRate: 0.35, opsRate: 0.10, taxRate: 0.10,
  opsBase: 2000000, digBase: 2100000,
  rent: 1050000, extraInterest: 217000, card: 3000000, living: 650000,
  marry: 3000000, expand: 4000000,
}

export interface PlanResult {
  salesN: number; salesRev: number; opsRev: number; rev: number
  salesPay: number; opsPay: number; baseSalary: number; pay: number
  tax: number
  left: number          // 남은돈 (최종 매출에서 남은돈)
  loan: number; fixed: number
  afterFixed: number    // 뺄거 다빼고
  goals: number
  final: number         // 이러면 남은돈
  ok: boolean
  needSelf: number      // 부족분을 내가 직접 계약으로 메우려면 필요한 건수
  needTeam: number      // 팀 계약으로 메우려면 필요한 건수
  breakEvenN: number    // 이 관리팀 매출 기준, 최종이 0 이상이 되는 최소 영업 건수
}

export function calcPlan(a: Assumptions, salesN: number, opsRev: number, loanMonthly: number): PlanResult {
  const salesRev = salesN * a.unit
  const rev = salesRev + opsRev
  const salesPay = salesRev * a.salesRate
  const opsPay = opsRev * a.opsRate
  const baseSalary = a.opsBase + a.digBase
  const pay = salesPay + opsPay + baseSalary
  const tax = rev * a.taxRate
  const left = rev - pay - tax
  const fixed = a.rent + loanMonthly + a.extraInterest + a.card + a.living
  const afterFixed = left - fixed
  const goals = a.marry + a.expand
  const final = afterFixed - goals
  const perSales = a.unit * (1 - a.salesRate - a.taxRate)      // 팀 계약 1건이 남기는 돈
  const perSelf = a.unit * (1 - a.taxRate)                     // 내가 직접 하면 인건비가 없다
  const needSelf = final < 0 && perSelf > 0 ? Math.ceil(-final / perSelf) : 0
  const needTeam = final < 0 && perSales > 0 ? Math.ceil(-final / perSales) : 0
  // 영업 건수 0 일 때의 최종값에서 건당 남는 돈으로 나눠 손익분기 건수를 구한다
  const at0 = calcPlanRaw(a, 0, opsRev, loanMonthly)
  const breakEvenN = perSales > 0 ? Math.max(0, Math.ceil(-at0 / perSales)) : 0
  return { salesN, salesRev, opsRev, rev, salesPay, opsPay, baseSalary, pay, tax, left, loan: loanMonthly, fixed, afterFixed, goals, final, ok: final > 0, needSelf, needTeam, breakEvenN }
}
function calcPlanRaw(a: Assumptions, n: number, opsRev: number, loan: number) {
  const salesRev = n * a.unit, rev = salesRev + opsRev
  return rev - (salesRev * a.salesRate + opsRev * a.opsRate + a.opsBase + a.digBase) - rev * a.taxRate
    - (a.rent + loan + a.extraInterest + a.card + a.living) - (a.marry + a.expand)
}

// ── 대출 상환 시뮬레이션 ──
export interface PlanLoan {
  id: string; institution: string; bank: string
  balance: number; rate: number                    // 현재 잔액, 연 이율(%)
  p1Principal: number; p2Principal: number         // 거치 기간 / 이후 매월 원금 상환액
}
export interface LoanSim {
  months: number                // 시뮬레이션 개월 수
  payoffMonth: number | null    // 전부 갚는 데 걸리는 개월 (미완납이면 null)
  totalInterest: number
  balances: number[]            // 0..months 시점의 총 잔액
  rows: { t: number; label: string; scheduled: number; extra: number; balance: number }[]
  perLoan: { id: string; payoffMonth: number | null; endBalance: number }[]
}

// phase1End: 거치(1단계) 마지막 달 = year*12+month (없으면 null → 계속 1단계)
export function simulateLoans(loans: PlanLoan[], extraPerMonth: number, phase1End: number | null, startYM: { y: number; m: number }, months = 72): LoanSim {
  const bal = loans.map(l => Math.max(0, l.balance))
  const payoff: (number | null)[] = bal.map(b => (b <= 0 ? 0 : null))
  const balances = [bal.reduce((s, b) => s + b, 0)]
  const rows: LoanSim['rows'] = []
  let totalInterest = 0
  for (let t = 1; t <= months; t++) {
    const cal = startYM.y * 12 + (startYM.m - 1) + (t - 1)   // t=1 이 이번 달 (year*12 + month-1)
    const inPhase1 = phase1End == null || cal <= phase1End - 1
    let scheduled = 0
    loans.forEach((l, i) => {
      if (bal[i] <= 0) return
      const interest = bal[i] * l.rate / 1200
      const prin = Math.min(bal[i], inPhase1 ? l.p1Principal : l.p2Principal)
      bal[i] -= prin
      scheduled += prin + interest
      totalInterest += interest
    })
    // 남는 돈은 금리가 높은 대출부터 갚는다
    let extra = extraPerMonth, extraUsed = 0
    const order = loans.map((l, i) => i).sort((x, y) => loans[y].rate - loans[x].rate)
    for (const i of order) {
      if (extra <= 0) break
      if (bal[i] <= 0) continue
      const use = Math.min(bal[i], extra)
      bal[i] -= use; extra -= use; extraUsed += use
    }
    bal.forEach((b, i) => { if (payoff[i] == null && b <= 0.5) { payoff[i] = t; bal[i] = 0 } })
    const total = bal.reduce((s, b) => s + b, 0)
    balances.push(total)
    const y = Math.floor(cal / 12), m = (cal % 12) + 1
    rows.push({ t, label: `${y}.${String(m).padStart(2, '0')}`, scheduled: Math.round(scheduled), extra: Math.round(extraUsed), balance: Math.round(total) })
    if (total <= 0.5 && payoff.every(p => p != null)) { break }
  }
  const done = payoff.every(p => p != null)
  return {
    months, totalInterest: Math.round(totalInterest),
    payoffMonth: done ? Math.max(0, ...payoff.map(p => p || 0)) : null,
    balances, rows,
    perLoan: loans.map((l, i) => ({ id: l.id, payoffMonth: payoff[i], endBalance: Math.round(bal[i]) })),
  }
}

// "28년 1월까지" 같은 글에서 거치 마지막 달(year*12+month)을 뽑는다
export function parsePhaseEnd(label: string): number | null {
  const m = String(label || '').match(/(\d{2,4})\s*년\s*(\d{1,2})\s*월/)
  if (!m) return null
  let y = parseInt(m[1], 10); if (y < 100) y += 2000
  return y * 12 + parseInt(m[2], 10)
}
