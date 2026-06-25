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
 * 부가세미포함 30만원 이하          → 0.5개
 * 부가세미포함 31만원 ~ 99만원 이하  → 1개
 * 부가세미포함 100만원 ~ 149만원 이하 → 2개
 * 부가세미포함 150만원 ~ 199만원 이하 → 3개
 * 부가세미포함 200만원 ~ 249만원 이하 → 4개
 * 이후 50만원 단위로 1씩 추가
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

  if (vatExcl <= 300000) return 0.5                                        // ≤30만
  if (vatExcl < 1000000) return 1                                          // 31만~99만
  return Math.floor((vatExcl - 1000000) / 500000) + 2                     // 100만~: 2,3,4...
}
