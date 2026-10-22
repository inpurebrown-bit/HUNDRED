// 홈택스(CODEF)에서 읽어 온 원자료를 월별로 모으고, 분기·반기로 합산하는 도우미
// 금액 단위: 원

export interface MonthAmt { supply: number; tax: number; total: number; count: number }
export const emptyMonth = (): MonthAmt => ({ supply: 0, tax: 0, total: 0, count: 0 })

export interface HometaxData {
  // 월별(YYYYMM) 집계
  taxInvoiceSales?: Record<string, MonthAmt>      // 전자세금계산서 매출
  taxInvoiceBuy?: Record<string, MonthAmt>        // 전자세금계산서 매입
  cashSales?: Record<string, MonthAmt>            // 현금영수증 매출 (취소는 차감)
  cashBuy?: Record<string, MonthAmt>              // 현금영수증 매입 중 공제분
  cashBuyNonDeduct?: Record<string, MonthAmt>     // 현금영수증 매입 중 불공제분 (참고)
  // 반기별 신고 과세표준 (부가세과세표준증명)
  halves?: { start: string; end: string; issuedAt: string; total: number; exempt: number; tax: number }[]
  fetched?: Record<string, string>                // 항목별 마지막으로 불러온 시각
  ranges?: Record<string, string>                 // 항목별 조회 기간 표시
}

const n = (v: any) => { const x = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return isNaN(x) ? 0 : x }
const add = (m: Record<string, MonthAmt>, ym: string, supply: number, tax: number) => {
  const c = (m[ym] ||= emptyMonth())
  c.supply += supply; c.tax += tax; c.total += supply + tax; c.count += 1
}

// 현금영수증 거래 내역 → 월별 합계. 취소 거래는 금액을 뺀다.
export function aggregateCash(rows: any[], deductOnly: 'all' | 'deduct' | 'nondeduct' = 'all'): Record<string, MonthAmt> {
  const out: Record<string, MonthAmt> = {}
  for (const r of rows || []) {
    const d = String(r.resUsedDate || '')
    if (d.length < 6) continue
    const ded = String(r.resDeductDescription || '')
    if (deductOnly === 'deduct' && ded && !ded.includes('공제')) continue
    if (deductOnly === 'deduct' && ded.includes('불공제')) continue
    if (deductOnly === 'nondeduct' && !ded.includes('불공제')) continue
    const sign = String(r.resTransTypeNm || '').includes('취소') ? -1 : 1
    add(out, d.slice(0, 6), sign * n(r.resSupplyValue), sign * n(r.resVAT))
  }
  return out
}

// 세금계산서 기간별 통계(월별) → 매출/매입 월별
export function aggregateTaxInvoice(rows: any[]): { sales: Record<string, MonthAmt>; buy: Record<string, MonthAmt> } {
  const sales: Record<string, MonthAmt> = {}, buy: Record<string, MonthAmt> = {}
  for (const r of rows || []) {
    const ym = String(r.resYearMonth || '').replace(/[^0-9]/g, '').slice(0, 6)
    if (ym.length !== 6) continue
    const target = String(r.resType) === '1' ? buy : sales
    const c = (target[ym] ||= emptyMonth())
    c.supply += n(r.resSupplyValue); c.tax += n(r.resTaxAmt); c.total += n(r.resSupplyValue) + n(r.resTaxAmt); c.count += n(r.resNumber)
  }
  return { sales, buy }
}

export const quarterMonths = (year: number, q: 1 | 2 | 3 | 4) => [0, 1, 2].map(i => `${year}${String((q - 1) * 3 + 1 + i).padStart(2, '0')}`)
export const sumMonths = (m: Record<string, MonthAmt> | undefined, yms: string[]): MonthAmt =>
  yms.reduce((s, ym) => { const c = m?.[ym]; return c ? { supply: s.supply + c.supply, tax: s.tax + c.tax, total: s.total + c.total, count: s.count + c.count } : s }, emptyMonth())
export const hasMonths = (m: Record<string, MonthAmt> | undefined, yms: string[]) => !!m && yms.every(ym => m[ym] !== undefined)
