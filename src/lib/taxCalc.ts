import type { HometaxData, MonthAmt } from './hometaxData'

// 세금 계산(홈택스 신고 기준) — 대표가 엑셀로 관리하던 "26년 부가세" 시트를 CRM으로 옮긴 것
// 금액 단위: 원. 총액은 부가세 포함, 공급가액은 총액 ÷ 1.1 (입력하면 입력값 사용), 세액 = 총액 − 공급가액
// 엑셀과 같이 중간 계산은 소수 그대로 두고 표시·최종 합계에서만 반올림한다

export interface TaxCell { total: number | null; supply: number | null }   // supply가 비어 있으면 총액 ÷ 1.1
export interface TaxQuarter {
  key: 'q1' | 'q2' | 'q3' | 'q4'
  label: string        // 1기 / 2기 / 3기 / 4기
  months: string      // 1~3월
  note: string        // 1기 예정 / 1기 확정 …
  salesCash: TaxCell; salesCard: TaxCell
  buyCash: TaxCell;   buyCard: TaxCell
}
export interface TaxData {
  year: number
  asOf: string                      // 기준일 (엑셀 날짜 칸)
  quarters: TaxQuarter[]
  // q1/q3: 1기·2기 예정(고지)에 낸 금액 · h1Final: 1기 확정(7/25)에 실제 낸 금액(기록용) · interim: 11월 종소세 중간예납에 낸 금액
  paid: { q1: number | null; q3: number | null; h1Final?: number | null; interim?: number | null }
  incomeTaxRate: number            // 종소세 적립률 (기본 10%, 1년 매출 공급가 기준)
  source: '수동' | '홈택스'
  v?: number                        // 2: 엑셀 입력값을 비우고 홈택스 값 기준으로 바꾼 버전
  syncedAt?: string
  // 카드 매출은 홈택스로 못 읽어서 월별 총액(부가세 포함)을 직접 입력한다. 입력한 달이 있으면 그 분기의 카드 매출은 월별 합계를 쓴다.
  cardMonthly?: Record<string, number | null>   // 'YYYYMM' → 총액
  cardThrough?: string                          // 카드 입력을 어디(날짜)까지 했는지 — 정산일 기준
  // 홈택스 부가세과세표준증명으로 확인된 반기별 신고 매출(공급가·세액). 있으면 해당 반기의 매출은 이 값을 따른다.
  reported?: { h1?: ReportedHalf; h2?: ReportedHalf }
}
export interface ReportedHalf { supply: number; tax: number; issuedAt?: string; period?: string }

const c = (total: number | null, supply: number | null = null): TaxCell => ({ total, supply })

// 분기 칸은 비워 둔다 — 홈택스에서 읽은 값(HometaxData)이 자동으로 채우고, 칸에 직접 적으면 그 값이 우선한다
export const DEFAULT_TAX_2026: TaxData = {
  year: 2026,
  asOf: '',
  incomeTaxRate: 0.1,
  paid: { q1: null, q3: null },
  source: '홈택스',
  v: 2,
  quarters: [
    { key: 'q1', label: '1기', months: '1~3월',  note: '1기 예정', salesCash: c(null), salesCard: c(null), buyCash: c(null), buyCard: c(null) },
    { key: 'q2', label: '2기', months: '4~6월',  note: '1기 확정', salesCash: c(null), salesCard: c(null), buyCash: c(null), buyCard: c(null) },
    { key: 'q3', label: '3기', months: '7~9월',  note: '2기 예정', salesCash: c(null), salesCard: c(null), buyCash: c(null), buyCard: c(null) },
    { key: 'q4', label: '4기', months: '10~12월', note: '2기 확정', salesCash: c(null), salesCard: c(null), buyCash: c(null), buyCard: c(null) },
  ],
}

export interface Amt { total: number; supply: number; tax: number }
const ZERO: Amt = { total: 0, supply: 0, tax: 0 }
export const cellAmt = (x: TaxCell): Amt => {
  const total = Number(x?.total) || 0
  const supply = x?.supply != null && x.supply !== ('' as any) ? Number(x.supply) || 0 : total / 1.1
  return { total, supply, tax: total - supply }
}
export const addAmt = (...a: Amt[]): Amt => a.reduce((s, v) => ({ total: s.total + v.total, supply: s.supply + v.supply, tax: s.tax + v.tax }), ZERO)

export interface TaxSummary {
  quarters: { key: string; sales: Amt; buy: Amt; salesCash: Amt; salesCard: Amt; buyCash: Amt; buyCard: Amt }[]
  h1: { sales: Amt; buy: Amt; salesCash: Amt; salesCard: Amt; buyCash: Amt; buyCard: Amt; vatDue: number }
  h2: { sales: Amt; buy: Amt; salesCash: Amt; salesCard: Amt; buyCash: Amt; buyCard: Amt; vatDue: number }
  year: { sales: Amt; buy: Amt }
  incomeTax: number      // 지금 가지고 있어야 되는 종소세 (올해 귀속분, 내년 5/31 납부 · 중간예납 낸 만큼 뺌)
  vat: number            // 지금 가지고 있어야 되는 부가세 (아직 안 낸 기간만)
  parking: number        // 파킹통장에 있어야 되는 금액 = 종소세 + 부가세
  paidTotal: number      // 예정(고지)으로 이미 낸 금액
  actual: number         // = parking (이미 낸 금액은 각 항목에서 뺀 뒤의 값)
  // ── 세무 일정 기준 정리 ──
  today: string
  h1Info: { settled: boolean; net: number; paidFinal: number; due: string }
  h2Net: number
  h2Settled: boolean
  h2Due: string
  nextVat: { label: string; due: string; amount: number } | null   // 다음에 내야 하는 부가세
  alreadyPaidVat: number   // 올해 이미 낸 부가세 (1기 확정 납부 + 예정 납부)
  interimPaid: number
  incomeTaxGross: number   // 중간예납 빼기 전 종소세
  incomeTaxDue: string
}

const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

// 홈택스에서 읽은 월별 합계를 분기 칸 값으로. 읽힌 달이 하나도 없으면 null
const sumHd = (maps: (Record<string, MonthAmt> | undefined)[], yms: string[]): TaxCell | null => {
  let any = false, total = 0, supply = 0
  for (const m of maps) for (const ym of yms) { const x = m?.[ym]; if (x) { any = true; total += x.total; supply += x.supply } }
  return any ? { total, supply } : null
}
// 칸에 직접 적은 값이 있으면 그 값, 없으면 홈택스 값
const pick = (manual: TaxCell, auto: TaxCell | null): TaxCell => (manual?.total != null || manual?.supply != null ? manual : auto || manual)

export function computeTax(d: TaxData, now?: string, hd?: HometaxData | null): TaxSummary {
  const qs = d.quarters.map((q, qi) => {
    const ms = [0, 1, 2].map(i => `${d.year}${String(qi * 3 + 1 + i).padStart(2, '0')}`)
    // 카드 매출은 홈택스로 못 읽어서 월별로 직접 적은 값을 쓴다 (없으면 분기 칸)
    const cardMonths = ms.map(m => (d.cardMonthly?.[m] != null && d.cardMonthly[m] !== ('' as any) ? Number(d.cardMonthly[m]) || 0 : null))
    const cardCell: TaxCell = cardMonths.some(v => v != null) ? { total: cardMonths.reduce((s: number, v) => s + (v || 0), 0), supply: null } : q.salesCard
    const salesCash = cellAmt(pick(q.salesCash, sumHd([hd?.taxInvoiceSales, hd?.cashSales], ms))), salesCard = cellAmt(cardCell)
    const buyCash = cellAmt(pick(q.buyCash, sumHd([hd?.taxInvoiceBuy, hd?.cashBuy], ms))), buyCard = cellAmt(q.buyCard)
    return { key: q.key, sales: addAmt(salesCash, salesCard), buy: addAmt(buyCash, buyCard), salesCash, salesCard, buyCash, buyCard }
  })
  const half = (a: typeof qs[number], b: typeof qs[number]) => {
    const sales = addAmt(a.sales, b.sales), buy = addAmt(a.buy, b.buy)
    return { sales, buy, salesCash: addAmt(a.salesCash, b.salesCash), salesCard: addAmt(a.salesCard, b.salesCard), buyCash: addAmt(a.buyCash, b.buyCash), buyCard: addAmt(a.buyCard, b.buyCard), vatDue: Math.round(sales.tax - buy.tax) }
  }
  const h1 = half(qs[0], qs[1]), h2 = half(qs[2], qs[3])
  // 홈택스 신고 값이 있으면 그 반기 매출 합계를 신고 값으로 바꾼다 (카드·현금 구분은 엑셀 입력 그대로 둠)
  for (const [h, r] of [[h1, d.reported?.h1], [h2, d.reported?.h2]] as const) {
    if (r && (r.supply || r.tax)) { h.sales = { total: r.supply + r.tax, supply: r.supply, tax: r.tax }; h.vatDue = Math.round(r.tax - h.buy.tax) }
  }
  const year = { sales: addAmt(h1.sales, h2.sales), buy: addAmt(h1.buy, h2.buy) }
  // ── 세무 일정 ──
  // 부가세: 1기(1~6월)는 7/25, 2기(7~12월)는 다음 해 1/25에 신고·납부. 기한이 지난 기간은 이미 냈으니 들고 있을 필요가 없다.
  //        예정(고지) 때 낸 금액은 확정 신고에서 빼준다.
  // 종소세: 올해 귀속분은 다음 해 5/31 신고·납부. 11월 중간예납으로 낸 금액은 빼준다.
  const today = now || kstToday()
  const q1Paid = Number(d.paid?.q1) || 0, q3Paid = Number(d.paid?.q3) || 0, interim = Number(d.paid?.interim) || 0
  const h1Due = `${d.year}-07-25`, h2Due = `${d.year + 1}-01-25`, itDue = `${d.year + 1}-05-31`
  const h1Settled = today > h1Due, h2Settled = today > h2Due, itSettled = today > itDue
  const h1Net = Math.round(h1.vatDue - q1Paid)      // 1기 확정 때 내는 세액
  const h2Net = Math.round(h2.vatDue - q3Paid)      // 2기 확정 때 내는 세액
  const hold = (n: number, settled: boolean) => (settled ? 0 : Math.max(0, n))
  const vat = hold(h1Net, h1Settled) + hold(h2Net, h2Settled)
  const incomeTaxRaw = year.sales.supply * (d.incomeTaxRate ?? 0.1)
  const incomeTaxGross = Math.round(incomeTaxRaw)
  const incomeTax = itSettled ? 0 : Math.max(0, incomeTaxGross - interim)
  const parking = incomeTax + vat
  const paidTotal = q1Paid + q3Paid
  const h1PaidFinal = Number(d.paid?.h1Final) || (h1Settled ? Math.max(0, h1Net) : 0)
  const nextVat = !h1Settled ? { label: '1기(1~6월) 부가세', due: h1Due, amount: Math.max(0, h1Net) }
    : !h2Settled ? { label: '2기(7~12월) 부가세', due: h2Due, amount: Math.max(0, h2Net) } : null
  const alreadyPaidVat = q1Paid + q3Paid + (h1Settled ? h1PaidFinal : 0)
  return {
    quarters: qs, h1, h2, year, h1Info: { settled: h1Settled, net: h1Net, paidFinal: h1PaidFinal, due: h1Due },
    incomeTax, vat, parking, paidTotal, actual: parking,
    today, h2Net, h2Settled, h2Due, nextVat, alreadyPaidVat, interimPaid: interim, incomeTaxGross, incomeTaxDue: itDue,
  }
}
