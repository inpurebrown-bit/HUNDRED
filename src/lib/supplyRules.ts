/**
 * 공급기준표
 */
export const SUPPLY_RATE_TABLE = [
  { condition: '영업일 2일차까지',  supply: 5, minRate: null as number | null, maxRate: null as number | null },
  { condition: '이후 (대표 재량)', supply: 2, minRate: null as number | null, maxRate: null as number | null },
]

/** 경과 영업일 → 공급 수 */
export function calcRecommendedSupply(_rate: number, bizElapsed: number): number {
  if (bizElapsed <= 2) return 5
  return 2
}

/** 해당 행이 현재 상태에서 활성 기준인지 */
export function isActiveRow(
  row: (typeof SUPPLY_RATE_TABLE)[number],
  _rate: number,
  bizElapsed: number
): boolean {
  if (row.condition === '영업일 2일차까지') return bizElapsed <= 2
  return bizElapsed > 2
}

/**
 * 입금액 → 계약 가중치 (부가세미포함 기준)
 *
 * 10만원당 0.2개 (선형 계산)
 * 예) 50만 → 1개, 100만 → 2개, 150만 → 3개, 500만 → 10개
 *
 * @param paymentAmount  실입금액(payment_amount) — 부가세 포함 또는 제외
 * @param vatIncluded    true: 부가세 포함 금액(÷1.1), false: 이미 부가세 제외, undefined: 부가세 포함으로 간주
 */
export function contractWeight(
  paymentAmount: string | number | undefined,
  vatIncluded?: boolean,
): number {
  if (!paymentAmount) return 0
  const amt = parseInt(String(paymentAmount).replace(/[^0-9]/g, ''), 10) || 0
  if (amt <= 0) return 0

  // 부가세미포함 금액 산출
  const vatExcl = vatIncluded === false ? amt : Math.round(amt / 1.1)
  if (vatExcl <= 0) return 0

  // 10만원당 0.2개 (소수점 1자리 반올림)
  return Math.round(vatExcl / 100000 * 0.2 * 10) / 10
}
