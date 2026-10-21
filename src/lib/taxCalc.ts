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
  paid: { q1: number | null; q3: number | null }   // 1기 예정 / 2기 예정에 낸 금액
  incomeTaxRate: number            // 종소세 적립률 (기본 10%, 1년 매출 공급가 기준)
  source: '수동' | '홈택스'
  syncedAt?: string
  // 홈택스 부가세과세표준증명으로 확인된 반기별 신고 매출(공급가·세액). 있으면 해당 반기의 매출은 이 값을 따른다.
  reported?: { h1?: ReportedHalf; h2?: ReportedHalf }
}
export interface ReportedHalf { supply: number; tax: number; issuedAt?: string; period?: string }

const c = (total: number | null, supply: number | null = null): TaxCell => ({ total, supply })

// 2026-10-14 대표가 관리하던 엑셀 값 (홈택스 신고 매출 기준)
export const DEFAULT_TAX_2026: TaxData = {
  year: 2026,
  asOf: '2026-10-14',
  incomeTaxRate: 0.1,
  paid: { q1: null, q3: null },
  source: '수동',
  quarters: [
    { key: 'q1', label: '1기', months: '1~3월',  note: '1기 예정', salesCash: c(28600000), salesCard: c(null), buyCash: c(4018340),  buyCard: c(null) },
    { key: 'q2', label: '2기', months: '4~6월',  note: '1기 확정', salesCash: c(4950000),  salesCard: c(5780100), buyCash: c(12518112), buyCard: c(null) },
    { key: 'q3', label: '3기', months: '7~9월',  note: '2기 예정', salesCash: c(13860000), salesCard: c(20840110), buyCash: c(15246948), buyCard: c(null) },
    { key: 'q4', label: '4기', months: '10~12월', note: '2기 확정', salesCash: c(7205000), salesCard: c(3520000), buyCash: c(1913600),  buyCard: c(null) },
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
  incomeTax: number      // 현재 가지고 있어야 되는 종소세
  vat: number            // 현재 가지고 있어야 되는 부가세
  parking: number        // 파킹통장에 있어야 되는 금액
  paidTotal: number      // 예정 신고로 이미 낸 금액
  actual: number         // 실제 있어야 될 금액
}

export function computeTax(d: TaxData): TaxSummary {
  const qs = d.quarters.map(q => {
    const salesCash = cellAmt(q.salesCash), salesCard = cellAmt(q.salesCard), buyCash = cellAmt(q.buyCash), buyCard = cellAmt(q.buyCard)
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
  const incomeTaxRaw = year.sales.supply * (d.incomeTaxRate ?? 0.1)
  const vatRaw = year.sales.tax - year.buy.tax
  const incomeTax = Math.round(incomeTaxRaw), vat = Math.round(vatRaw)
  const parking = Math.round(incomeTaxRaw + vatRaw)
  const paidTotal = (Number(d.paid?.q1) || 0) + (Number(d.paid?.q3) || 0)
  return { quarters: qs, h1, h2, year, incomeTax, vat, parking, paidTotal, actual: parking - paidTotal }
}
