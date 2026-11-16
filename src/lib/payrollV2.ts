// 새 보수 구조(1년 관리비 선금·잔금) — 2026-11-16 이후 체결한 계약에 적용 (정관 v9)
//  · 영업 신입(첫 1개월): 업무정착비 150만원(일할, 30일 기준) + 입금 매출 7%
//  · 영업 사원(인센제): 월 선금 매출 × 구간 인센율(선금 매출 전체에 적용) + 잔금 매출 5% + 주 프로모션
//  · 인증사업 금액: 영업팀 고정 20% (구간 계산에서 제외)
//  · 주 프로모션: 월~금 한 주 선금 매출이 350만원을 넘으면 10만원
// 11월 15일까지 체결한 옛 건은 payrollCalc.ts 의 종전 계산을 그대로 쓴다.

export const V2_START = '2026-11-16'

export const V2 = {
  stipend: 1_500_000,          // 신입 업무정착비 (월)
  stipendDays: 30,             // 일할 기준일수
  newHireRate: 0.07,           // 신입 인센 (입금 매출 전체)
  balanceRate: 0.05,           // 잔금 매출 인센 (10% 검토 중 — 바꾸려면 이 값만 고치면 된다)
  certRate: 0.20,              // 인증사업 고정 인센
  weeklyPromoOver: 3_500_000,  // 주 프로모션: 이 금액을 넘으면
  weeklyPromoAmount: 100_000,  // 추가 지급액
  tiers: [                     // 월 선금 매출 구간 인센율 (구간에 들어가면 선금 매출 전체에 적용)
    { min: 20_000_000, rate: 0.40 },
    { min: 15_000_000, rate: 0.35 },
    { min: 10_000_000, rate: 0.30 },
    { min: 5_000_000, rate: 0.25 },
    { min: 0, rate: 0.20 },
  ],
} as const

export const parseMoney = (v: any) => parseInt(String(v ?? '0').replace(/[^0-9]/g, ''), 10) || 0
export const tierRate = (monthlyPrepay: number) => (V2.tiers.find(t => monthlyPrepay >= t.min) || V2.tiers[V2.tiers.length - 1]).rate

export const contractDateOf = (c: any): string => String(c?.details?.contract_date || c?.created_at || '').slice(0, 10)
/** 2026-11-16 이후 체결한 계약인가 */
export const isV2Contract = (c: any): boolean => contractDateOf(c) >= V2_START

// 그 날이 속한 주의 월요일 (YYYY-MM-DD)
const mondayOf = (d: string) => {
  const t = new Date(d + 'T00:00:00Z')
  const dow = (t.getUTCDay() + 6) % 7   // 월=0 … 일=6
  t.setUTCDate(t.getUTCDate() - dow)
  return t.toISOString().slice(0, 10)
}

// 계약 금액 중 인증사업 몫 (입금을 항목 금액 비율대로 나눈다)
function certShare(c: any): number {
  const cert = parseMoney(c?.details?.cert_amount)
  if (cert <= 0) return 0
  const fee = parseMoney(c?.details?.contract_fee)
  return Math.min(1, cert / Math.max(fee, cert))
}

// 선금 매출(계약 시 입금, 부가세 제외): 입력한 "내 매출"이 있으면 그것, 없으면 입금액(부가세 포함이면 1.1로 나눔)
function prepayRevenue(c: any): number {
  const my = parseMoney(c?.details?.my_revenue)
  if (my > 0) return my
  const pay = parseMoney(c?.details?.payment_amount)
  return c?.details?.vat_included ? Math.round(pay / 1.1) : pay
}

export interface V2Entry { company: string; date: string; kind: '선금' | '잔금' | '환불차감'; fund: number; cert: number }
export interface V2Bucket {
  prepayFund: number; prepayCert: number; balanceFund: number; balanceCert: number
  weeklyFund: Record<string, number>   // 월요일 날짜 → 그 주 선금 매출(자금 자문 몫)
  entries: V2Entry[]
}
const emptyBucket = (): V2Bucket => ({ prepayFund: 0, prepayCert: 0, balanceFund: 0, balanceCert: 0, weeklyFund: {}, entries: [] })

/** 그 달에 들어온 새 구조(v2) 건의 영업 사원별 매출 집계 */
export function buildSalesV2Map(customers: any[], yearMonth: string): Record<string, V2Bucket> {
  const map: Record<string, V2Bucket> = {}
  const get = (name: string) => (map[name] ||= emptyBucket())
  const ownerOf = (c: any) => String(c?.details?.sales_user_name || c?.sales_user_name || '').trim()
  for (const c of customers || []) {
    if (!isV2Contract(c)) continue
    const name = ownerOf(c)
    if (!name) continue
    const company = c.details?.company || c.company || c.name || '(업체명 없음)'
    const share = certShare(c)
    // 선금: 계약 시 입금 (계약일이 속한 달)
    if (c.status === 'contracted' && contractDateOf(c).slice(0, 7) === yearMonth) {
      const rev = prepayRevenue(c)
      const cert = Math.round(rev * share), fund = rev - cert
      const b = get(name)
      b.prepayFund += fund; b.prepayCert += cert
      const wk = mondayOf(contractDateOf(c))
      b.weeklyFund[wk] = (b.weeklyFund[wk] || 0) + fund
      b.entries.push({ company, date: contractDateOf(c), kind: '선금', fund, cert })
    }
    // 잔금: 이후 추가 입금 (입금한 달)
    const extras = c?.details?.extra_counts
    if (Array.isArray(extras)) for (const e of extras) {
      if (String(e?.date || '').slice(0, 7) !== yearMonth) continue
      const amt = parseFloat(String(e?.amount ?? 0).replace(/[^0-9.-]/g, '')) || 0
      if (amt <= 0) continue
      const cert = Math.round(amt * share), fund = Math.round(amt) - cert
      const b = get(name)
      b.balanceFund += fund; b.balanceCert += cert
      b.entries.push({ company: `${company} (${e?.label || '잔금'})`, date: String(e.date), kind: '잔금', fund, cert })
    }
    // 해지·정산: 그 달 반환액만큼 선금 매출에서 차감
    if (String(c?.details?.refund_deduction_month || '').trim() === yearMonth) {
      const w = parseFloat(String(c.details?.refund_deduction_weight || 0)) || 0
      const amt = parseMoney(c.details?.refund_deduction_amount)
      if (w > 0 || amt > 0) {
        const b = get(name)
        const cut = amt > 0 ? amt : prepayRevenue(c)
        const cert = Math.round(cut * share), fund = cut - cert
        b.prepayFund -= fund; b.prepayCert -= cert
        b.entries.push({ company: `[해지·정산] ${company}`, date: yearMonth, kind: '환불차감', fund: -fund, cert: -cert })
      }
    }
  }
  for (const b of Object.values(map)) { b.prepayFund = Math.max(0, b.prepayFund); b.prepayCert = Math.max(0, b.prepayCert) }
  return map
}

export interface V2Pay {
  newHire: boolean; stipend: number
  prepayFund: number; rate: number; tierPay: number
  balancePay: number; certPay: number
  promoWeeks: number; weeklyPromo: number
  newHireIncentive: number
  total: number
}

/** 영업 사원 한 사람의 새 구조 급여 (세전). joinDate: 계약 시작일(YYYY-MM-DD) — 시작한 달이 신입 정착 기간 */
export function calcSalesV2(b: V2Bucket | undefined, yearMonth: string, joinDate?: string | null): V2Pay {
  const x = b || emptyBucket()
  const newHire = !!joinDate && String(joinDate).slice(0, 7) === yearMonth
  const allRevenue = x.prepayFund + x.prepayCert + x.balanceFund + x.balanceCert
  if (newHire) {
    const day = parseInt(String(joinDate).slice(8, 10), 10) || 1
    const days = Math.min(V2.stipendDays, Math.max(1, 31 - day))   // 10월 16일 시작 → 15일분
    const stipend = Math.round(V2.stipend * days / V2.stipendDays)
    const inc = Math.round(allRevenue * V2.newHireRate)
    return { newHire, stipend, prepayFund: x.prepayFund, rate: V2.newHireRate, tierPay: 0, balancePay: 0, certPay: 0, promoWeeks: 0, weeklyPromo: 0, newHireIncentive: inc, total: stipend + inc }
  }
  const rate = tierRate(x.prepayFund)
  const tierPay = Math.round(x.prepayFund * rate)
  const balancePay = Math.round(x.balanceFund * V2.balanceRate)
  const certPay = Math.round((x.prepayCert + x.balanceCert) * V2.certRate)
  const promoWeeks = Object.entries(x.weeklyFund).filter(([wk, v]) => wk.slice(0, 7) <= yearMonth && v > V2.weeklyPromoOver).length
  const weeklyPromo = promoWeeks * V2.weeklyPromoAmount
  return { newHire, stipend: 0, prepayFund: x.prepayFund, rate, tierPay, balancePay, certPay, promoWeeks, weeklyPromo, newHireIncentive: 0, total: tierPay + balancePay + certPay + weeklyPromo }
}

/** 급여 화면·명세서·손익이 같이 쓰는 한 줄 계산: 고객 목록 + 직원 이름·시작일 → 새 구조 급여 */
export function v2PayFor(customers: any[], yearMonth: string, name: string, joinDate?: string | null): V2Pay & { entries: V2Entry[] } {
  const map = buildSalesV2Map(customers, yearMonth)
  const key = Object.keys(map).find(k => k === name || k.includes(name) || name.includes(k))
  const pay = calcSalesV2(key ? map[key] : undefined, yearMonth, joinDate)
  return { ...pay, entries: key ? map[key].entries : [] }
}
