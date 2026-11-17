// 새 보수 구조(1년 관리비 선금·잔금) — 2026-11-16 이후 체결한 계약에 적용 (정관 v9)
//  · 영업 신입(첫 1개월): 업무정착비 150만원(일할, 30일 기준) + 입금 매출 5%(고정) — 단 기존(인센제) 구조가 더 높으면 높은 쪽
//  · 영업 사원(인센제): 월 선금 매출 × 구간 인센율(선금 매출 전체에 적용), 스타트 멤버만 잔금 매출 10%
//  · 인증사업(종합컨설팅) 금액: 영업팀 고정 20% (구간 계산에서 제외)
//  · 주 프로모션: 월~금 한 주 선금 매출이 400만원 이상이면 10만원
//  · 월 선금 매출 500만원 미만 = 순환(정리) 대상 표시
//  · 영업팀장·주임·관리팀 새 보수는 아직 자동 계산하지 않는다 (팀장·주임은 인원이 생길 때 추가)
// 11월 15일까지 체결한 옛 건은 payrollCalc.ts 의 종전 계산을 그대로 쓴다.

export const V2_START = '2026-12-01'

export const V2 = {
  stipend: 1_500_000,          // 신입 업무정착비 (월)
  stipendDays: 30,             // 일할 기준일수
  newHireRate: 0.05,           // 신입 인센 (입금 매출 전체, 고정 5%)
  balanceRate: 0.10,           // 잔금 매출 인센 — 스타트 멤버만
  rotationUnder: 5_000_000,    // 월 선금 매출이 이 금액 미만이면 순환(정리) 대상
  certRate: 0.20,              // 인증사업 고정 인센
  weeklyPromoMin: 4_000_000,   // 주 프로모션: 이 금액 이상 달성하면
  weeklyPromoAmount: 100_000,  // 추가 지급액
  tiers: [                     // 월 선금 매출 구간 인센율 (구간에 들어가면 선금 매출 전체에 적용)
    { min: 20_000_000, rate: 0.40 },
    { min: 15_000_000, rate: 0.35 },
    { min: 10_000_000, rate: 0.30 },
    { min: 5_000_000, rate: 0.25 },
    { min: 0, rate: 0.20 },
  ],
} as const

/** 영업 구성원의 팀 번호로 스타트 멤버(1팀) 여부 — 지정하지 않았거나 목록에 없으면 1팀으로 본다 */
export function teamOf(teams: { name: string; team_no: number }[], name: string): number {
  const t = (teams || []).find(x => x.name === name || (x.name && name && (x.name.includes(name) || name.includes(x.name))))
  return t?.team_no ?? 1
}
export const isStartMember = (teams: { name: string; team_no: number }[], name: string) => teamOf(teams, name) === 1

// 관리실장 새 보수 — 2026-12 급여부터 (11월은 옛 건과 섞여 있어 종전 그대로)
export const OPS_V2_FROM = '2026-12'
export const OPS_V2 = { certUpsellRate: 0.20, chiefRate: 0.05, introRate: 0.40, upsellPay: 150_000 } as const   // 총 매출 5% · 소개건 선금 30% · 기장료 업셀 1개당 15만원

export const parseMoney = (v: any) => parseInt(String(v ?? '0').replace(/[^0-9]/g, ''), 10) || 0
export const tierRate = (monthlyPrepay: number) => (V2.tiers.find(t => monthlyPrepay >= t.min) || V2.tiers[V2.tiers.length - 1]).rate

export const contractDateOf = (c: any): string => String(c?.details?.contract_date || c?.created_at || '').slice(0, 10)
/** 새 구조(선금·잔금)로 계산하는 계약인가 — 2026-11-16 이후 체결이고, 수수료 계약(fee_model 'old')이 아닌 것 */
export const PAYROLL_V2_MONTH = V2_START.slice(0, 7)
/** 새 모델(1년 관리비 선금·잔금) 계약인가 — 새로 등록한 건(fee_model 'v2') 또는 12/1 이후 체결 건. 매출·잔금 관리·카드 표시 기준 */
export const isNewModel = (c: any): boolean => {
  const m = c?.details?.fee_model
  if (m === 'old' || m === 'sub') return false
  return m === 'v2' || contractDateOf(c) >= V2_START
}
export const isV2Contract = isNewModel
/** 이 날짜(계약일·잔금 입금일·해지 차감월)의 급여를 새 구조로 계산하는가 — 2026-12 급여부터. 그 전(11월)은 선금 매출을 개수로 치환한 종전 방식 */
export const v2PayrollOn = (c: any, date: string): boolean => isNewModel(c) && String(date || '').slice(0, 7) >= PAYROLL_V2_MONTH

// 그 날이 속한 주의 월요일 (YYYY-MM-DD)
const mondayOf = (d: string) => {
  const t = new Date(d + 'T00:00:00Z')
  const dow = (t.getUTCDay() + 6) % 7   // 월=0 … 일=6
  t.setUTCDate(t.getUTCDate() - dow)
  return t.toISOString().slice(0, 10)
}

// 계약 금액 중 인증사업 몫 (입금을 항목 금액 비율대로 나눈다)
export function certShare(c: any): number {
  const cert = parseMoney(c?.details?.cert_amount)
  if (cert <= 0) return 0
  const fee = parseMoney(c?.details?.contract_fee)
  return Math.min(1, cert / Math.max(fee, cert))
}

// 선금 매출(계약 시 입금, 부가세 제외): 입력한 "내 매출"이 있으면 그것, 없으면 입금액(부가세 포함이면 1.1로 나눔)
export function prepayRevenue(c: any): number {
  const my = parseMoney(c?.details?.my_revenue)
  if (my > 0) return my
  const pay = parseMoney(c?.details?.payment_amount)
  return c?.details?.vat_included ? Math.round(pay / 1.1) : pay
}

export interface V2Entry { company: string; date: string; kind: '선금' | '잔금' | '환불차감'; fund: number; cert: number }
export interface V2Bucket {
  prepayFund: number; prepayCert: number; balanceFund: number; balanceCert: number
  weeklyPrepay: Record<string, number>  // 월요일 날짜 → 그 주 선금 매출(자금 자문 + 인증)
  entries: V2Entry[]
}
const emptyBucket = (): V2Bucket => ({ prepayFund: 0, prepayCert: 0, balanceFund: 0, balanceCert: 0, weeklyPrepay: {}, entries: [] })

/** 관리팀이 직접 받은 인증 업셀 금액 — 월별·담당자별 {month: {name: amount}} */
export function opsUpsellByMonth(customers: any[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {}
  for (const c of customers || []) for (const u of (Array.isArray(c?.details?.cert_upsells) ? c.details.cert_upsells : [])) {
    if (u?.by !== 'ops' || !u?.by_name) continue
    const amt = Math.round(parseMoney(u?.amount)); const m = String(u?.date || '').slice(0, 7)
    if (amt <= 0 || !m) continue
    const nm = String(u.by_name).trim()
    const row = (out[m] ||= {})
    row[nm] = (row[nm] || 0) + amt
  }
  return out
}

/** 그 달에 들어온 새 구조(v2) 건의 영업 사원별 매출 집계 */
export function buildSalesV2Map(customers: any[], yearMonth: string): Record<string, V2Bucket> {
  const map: Record<string, V2Bucket> = {}
  const get = (name: string) => (map[name] ||= emptyBucket())
  const ownerOf = (c: any) => String(c?.details?.sales_user_name || c?.sales_user_name || '').trim()
  for (const c of customers || []) {
    // 인증 업셀링: 영업팀이 자금 승인 후 다시 영업해서 받은 건(by 'sales')만 영업 인증 매출(20%)로 잡는다.
    // 관리팀이 직접 친 건(by 'ops')은 영업 인센 없음 — 관리실장 총 매출 5%에만 자동 포함. 옛 계약 업체에도 적용.
    if (Array.isArray(c?.details?.cert_upsells)) {
      const uname = ownerOf(c)
      for (const u of c.details.cert_upsells) {
        if (!uname || u?.by === 'ops' || String(u?.date || '').slice(0, 7) !== yearMonth) continue
        const amt = Math.round(parseMoney(u?.amount))
        if (amt <= 0) continue
        const b = get(uname)
        b.prepayCert += amt
        const wk = mondayOf(String(u.date))
        b.weeklyPrepay[wk] = (b.weeklyPrepay[wk] || 0) + amt
        b.entries.push({ company: `${c.details?.company || c.name || ''} (인증 업셀 ${u.kind || ''})`, date: String(u.date), kind: '선금', fund: 0, cert: amt })
      }
    }
    if (!isNewModel(c)) continue
    const name = ownerOf(c)
    if (!name) continue
    const company = c.details?.company || c.company || c.name || '(업체명 없음)'
    const share = certShare(c)
    // 선금: 계약 시 입금 (계약일이 속한 달)
    if (c.status === 'contracted' && contractDateOf(c).slice(0, 7) === yearMonth && v2PayrollOn(c, contractDateOf(c))) {
      const rev = prepayRevenue(c)
      const cert = Math.round(rev * share), fund = rev - cert
      const b = get(name)
      b.prepayFund += fund; b.prepayCert += cert
      const wk = mondayOf(contractDateOf(c))
      b.weeklyPrepay[wk] = (b.weeklyPrepay[wk] || 0) + fund + cert
      b.entries.push({ company, date: contractDateOf(c), kind: '선금', fund, cert })
    }
    // 잔금: 이후 추가 입금 (입금한 달)
    const extras = c?.details?.extra_counts
    if (Array.isArray(extras)) for (const e of extras) {
      if (String(e?.date || '').slice(0, 7) !== yearMonth || !v2PayrollOn(c, yearMonth)) continue
      const amt = parseFloat(String(e?.amount ?? 0).replace(/[^0-9.-]/g, '')) || 0
      if (amt <= 0) continue
      const cert = Math.round(amt * share), fund = Math.round(amt) - cert
      const b = get(name)
      b.balanceFund += fund; b.balanceCert += cert
      b.entries.push({ company: `${company} (${e?.label || '잔금'})`, date: String(e.date), kind: '잔금', fund, cert })
    }
    // 해지·정산: 그 달 반환액만큼 선금 매출에서 차감
    if (String(c?.details?.refund_deduction_month || '').trim() === yearMonth && v2PayrollOn(c, yearMonth)) {
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
  startMember: boolean; rotation: boolean; prepayTotal: number
  prepayFund: number; rate: number; tierPay: number
  balancePay: number; certPay: number
  promoWeeks: number; weeklyPromo: number
  newHireIncentive: number
  total: number
}

/** 영업 사원 한 사람의 새 구조 급여 (세전).
 *  joinDate: 계약 시작일(YYYY-MM-DD) — 시작한 달이 신입 정착 기간, startMember: 스타트 멤버(잔금 10%) 여부 */
export function calcSalesV2(b: V2Bucket | undefined, yearMonth: string, joinDate?: string | null, startMember = false): V2Pay {
  const x = b || emptyBucket()
  const newHire = !!joinDate && String(joinDate).slice(0, 7) === yearMonth
  const allRevenue = x.prepayFund + x.prepayCert + x.balanceFund + x.balanceCert
  const prepayTotal = x.prepayFund + x.prepayCert
  // 기본(인센제) 구조
  const rate = tierRate(x.prepayFund)
  const tierPay = Math.round(x.prepayFund * rate)
  const balancePay = startMember ? Math.round(x.balanceFund * V2.balanceRate) : 0
  const certPay = Math.round((x.prepayCert + x.balanceCert) * V2.certRate)
  const regular = tierPay + balancePay + certPay
  const promoWeeks = Object.entries(x.weeklyPrepay).filter(([, v]) => v >= V2.weeklyPromoMin).length
  const weeklyPromo = promoWeeks * V2.weeklyPromoAmount
  // 신입: 업무정착비 + 입금 매출 5% 와 기본 구조 중 높은 쪽
  let stipend = 0, newHireIncentive = 0, total = regular + weeklyPromo
  if (newHire) {
    const day = parseInt(String(joinDate).slice(8, 10), 10) || 1
    const days = Math.min(V2.stipendDays, Math.max(1, 31 - day))   // 10월 16일 시작 → 15일분
    stipend = Math.round(V2.stipend * days / V2.stipendDays)
    newHireIncentive = Math.round(allRevenue * V2.newHireRate)
    total = Math.max(stipend + newHireIncentive, regular) + weeklyPromo
  }
  const rotation = !newHire && prepayTotal < V2.rotationUnder
  return { newHire, stipend, startMember, rotation, prepayTotal, prepayFund: x.prepayFund, rate, tierPay, balancePay, certPay, promoWeeks, weeklyPromo, newHireIncentive, total }
}

/** 급여 화면·명세서·손익이 같이 쓰는 한 줄 계산: 고객 목록 + 직원 이름·시작일 → 새 구조 급여 */
export function v2PayFor(customers: any[], yearMonth: string, name: string, joinDate?: string | null, startMember = false): V2Pay & { entries: V2Entry[] } {
  const map = buildSalesV2Map(customers, yearMonth)
  const key = Object.keys(map).find(k => k === name || k.includes(name) || name.includes(k))
  const pay = calcSalesV2(key ? map[key] : undefined, yearMonth, joinDate, startMember)
  return { ...pay, entries: key ? map[key].entries : [] }
}

// ───────── 회사 전체 새 구조 매출 · 받을 잔금 (매출 관리·손익 화면용) ─────────
export interface V2MonthRev { month: string; prepayFund: number; prepayCert: number; balanceFund: number; balanceCert: number; total: number; contracts: number }
export interface V2Receivable { count: number; sum: number; overdueCount: number; overdueSum: number; soonCount: number; soonSum: number; nextDue: string }

const addDaysStr = (d: string, n: number) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
const diffDaysStr = (a: string, b: string) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000)

/** 새 구조 건의 월별 매출(선금·잔금·인증 구분). months: ['2026-11', ...] */
export function v2MonthlyRevenue(customers: any[], months: string[]): V2MonthRev[] {
  const rows: Record<string, V2MonthRev> = Object.fromEntries(months.map(m => [m, { month: m, prepayFund: 0, prepayCert: 0, balanceFund: 0, balanceCert: 0, total: 0, contracts: 0 }]))
  for (const c of customers || []) {
    if (Array.isArray(c?.details?.cert_upsells)) for (const u of c.details.cert_upsells) {
      const m = String(u?.date || '').slice(0, 7)
      const amt = Math.round(parseMoney(u?.amount))
      if (rows[m] && amt > 0) rows[m].prepayCert += amt
    }
    if (!isV2Contract(c)) continue
    const share = certShare(c)
    const cm = contractDateOf(c).slice(0, 7)
    if (rows[cm]) {   // 매출 API 는 계약완료 고객만 넘겨주므로 status 는 보지 않는다
      const rev = prepayRevenue(c), cert = Math.round(rev * share)
      rows[cm].prepayCert += cert; rows[cm].prepayFund += rev - cert; rows[cm].contracts += 1
    }
    const extras = c?.details?.extra_counts
    if (Array.isArray(extras)) for (const e of extras) {
      const m = String(e?.date || '').slice(0, 7)
      const amt = Math.round(parseFloat(String(e?.amount ?? 0).replace(/[^0-9.-]/g, '')) || 0)
      if (!rows[m] || amt <= 0) continue
      const cert = Math.round(amt * share)
      rows[m].balanceCert += cert; rows[m].balanceFund += amt - cert
    }
  }
  for (const r of Object.values(rows)) r.total = r.prepayFund + r.prepayCert + r.balanceFund + r.balanceCert
  return months.map(m => rows[m])
}

/** 받을 잔금(미수) — 선금만 받은 새 구조 계약의 남은 잔금 합계와 기한 */
export function v2Receivables(customers: any[], today: string): V2Receivable {
  const out: V2Receivable = { count: 0, sum: 0, overdueCount: 0, overdueSum: 0, soonCount: 0, soonSum: 0, nextDue: '' }
  for (const c of customers || []) {
    if (!isV2Contract(c)) continue
    const d = c.details || {}
    const total = parseMoney(d.contract_fee)
    if (total <= 0 || d.balance_done === true) continue
    const extraSum = (Array.isArray(d.extra_counts) ? d.extra_counts : []).reduce((s: number, e: any) => s + (parseFloat(String(e?.amount ?? 0).replace(/[^0-9.-]/g, '')) || 0), 0)
    const prepaid = parseMoney(d.net_paid) || (d.vat_included ? Math.round(parseMoney(d.payment_amount) / 1.1) : parseMoney(d.payment_amount))
    const remaining = Math.max(0, total - prepaid - Math.round(extraSum))
    if (remaining <= 0) continue
    const setup = String(d.setup_done_date || d.contract_date || '').slice(0, 10)
    const due = String(d.balance_due_date || (setup ? addDaysStr(setup, 90) : '')).slice(0, 10)
    out.count += 1; out.sum += remaining
    if (due) {
      const dd = diffDaysStr(due, today)
      if (dd < 0) { out.overdueCount += 1; out.overdueSum += remaining }
      else if (dd <= 14) { out.soonCount += 1; out.soonSum += remaining }
      if (dd >= 0 && (!out.nextDue || due < out.nextDue)) out.nextDue = due
    }
  }
  return out
}
