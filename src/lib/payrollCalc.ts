// 급여 계산 공통 함수 — PayrollTab / PayslipTab / 기타 모두 여기서 import
import { contractWeight } from './supplyRules'

// ── 날짜 헬퍼 ─────────────────────────────────────────────
export function currentYearMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── 프로모션 티어 ──────────────────────────────────────────
export interface PromoTier { minCount: number; label: string; amount: number }

export const PROMO_TIERS: PromoTier[] = [
  { minCount: 15, label: '15건 이상', amount: 250_000 },
  { minCount: 20, label: '20건 이상', amount: 500_000 },
  { minCount: 25, label: '25건 이상', amount: 700_000 },
  { minCount: 30, label: '30건 이상', amount: 1_000_000 },
  { minCount: 35, label: '35건 이상', amount: 1_500_000 },
  { minCount: 40, label: '40건 이상', amount: 2_000_000 },
]

export function getPromo(contractCount: number): number {
  for (let i = PROMO_TIERS.length - 1; i >= 0; i--) {
    if (contractCount >= PROMO_TIERS[i].minCount) return PROMO_TIERS[i].amount
  }
  return 0
}

// ── 성과급 / 세율 / 수수료율 ──────────────────────────────
export const PERF_BONUS_MIN_COUNT = 12   // 건 이상이면 성과급 발생
export const PERF_BONUS_RATE      = 0.05 // 매출의 5%
export const INCOME_TAX_RATE      = 0.03
export const LOCAL_TAX_RATE       = 0.003
export const OPS_FEE_RATE         = 0.10 // 수수료 매출의 10%
export const OPS_PUTO_RATE        = 0.40 // 뿌토 매출의 40%
export const OPS_MONTHLY_SUB_RATE = 0.05 // 월정기권(수수료없음) 계약금의 5% → 관리팀장 보너스
export const NET_RATE             = 0.967 // 원천징수(3.3%) 후 실수령율

// ── 실시간 영업팀 계약 집계 ───────────────────────────────
// PayrollTab / PayslipTab 공통 — 인별 계약 매출·개수 한 번만 계산
export interface ContractEntry {
  company: string
  amount:  number  // my_revenue or payment_amount
  weight:  number
  date:    string
  refund?: boolean
}

// 월정기권 계약 보너스 총액 계산 (contract_type === '월정기권' 이고 해당 월에 들어온 것)
export function calcMonthlySubBonus(customers: any[], yearMonth: string): number {
  const parseMon = (v: any) => parseInt(String(v || '0').replace(/[^0-9]/g, ''), 10) || 0
  let total = 0
  for (const c of customers) {
    if (c.details?.contract_type !== '월정기권') continue
    if (c.status !== 'contracted') continue
    const cm = (c.details?.contract_date || c.created_at || '').slice(0, 7)
    if (cm !== yearMonth) continue
    const amt = parseMon(c.details?.payment_amount)
    total += Math.round(amt * OPS_MONTHLY_SUB_RATE)
  }
  return total
}

export function buildSalesContractMap(
  customers: any[],
  yearMonth: string,
): Record<string, { revenue: number; count: number; details: ContractEntry[] }> {
  const parseMon = (v: any) => parseInt(String(v || '0').replace(/[^0-9]/g, ''), 10) || 0
  const map: Record<string, { revenue: number; count: number; details: ContractEntry[] }> = {}
  for (const c of customers) {
    if (c.status !== 'contracted') continue
    const cm = (c.details?.contract_date || c.created_at || '').slice(0, 7)
    if (cm !== yearMonth) continue
    const name = (c.details?.sales_user_name || c.sales_user_name || '').trim()
    if (!name) continue
    const rev = parseMon(c.details?.my_revenue) || parseMon(c.details?.payment_amount)
    const w   = contractWeight(c.details?.payment_amount, c.details?.vat_included)
    if (!map[name]) map[name] = { revenue: 0, count: 0, details: [] }
    map[name].revenue += rev
    map[name].count   += w > 0 ? w : 1
    map[name].details.push({
      company: c.details?.company || c.company || c.name || '(업체명 없음)',
      amount:  rev,
      weight:  w > 0 ? w : 1,
      date:    c.details?.contract_date || c.created_at || '',
    })
  }
  return map
}
