/**
 * 공급기준표 (결제율 기준)
 */
export const SUPPLY_RATE_TABLE = [
  { condition: '영업일 2일차까지',  supply: 5, minRate: null  as number | null, maxRate: null  as number | null },
  { condition: '결제율 20% 이상',   supply: 6, minRate: 20,   maxRate: null  as number | null },
  { condition: '결제율 17% 이상',   supply: 5, minRate: 17,   maxRate: 19.99 },
  { condition: '결제율 15% 이상',   supply: 4, minRate: 15,   maxRate: 16.99 },
  { condition: '결제율 13% 이상',   supply: 2, minRate: 13,   maxRate: 14.99 },
  { condition: '결제율 13% 미만',   supply: 0, minRate: null  as number | null, maxRate: 12.99 },
]

/** 결제율 + 경과 영업일 → 내일 공급 권장 */
export function calcRecommendedSupply(rate: number, bizElapsed: number): number {
  if (bizElapsed <= 2) return 5
  if (rate >= 20) return 6
  if (rate >= 17) return 5
  if (rate >= 15) return 4
  if (rate >= 13) return 2
  return 0
}

/** 해당 행이 현재 상태에서 활성 기준인지 */
export function isActiveRow(
  row: (typeof SUPPLY_RATE_TABLE)[number],
  rate: number,
  bizElapsed: number
): boolean {
  if (row.minRate === null && row.maxRate === null) return bizElapsed <= 2
  if (row.maxRate === null) return rate >= row.minRate!
  if (row.minRate === null) return rate < row.maxRate
  return rate >= row.minRate && rate <= row.maxRate
}
