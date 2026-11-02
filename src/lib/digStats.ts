import { contractWeight } from '@/lib/supplyRules'
import { DIG_BASE_SALARY, DIG_DAILY_GOAL, DIG_BONUS_PER_EXTRA } from '@/lib/payrollCalc'

/** 한경연 DB 기본 단가 (대표 화면에서 바꿀 수 있음) */
export const DB_UNIT_DEFAULT = 40000
/** 결제 1개(가중치 1.0) = 부가세 제외 50만원 (supplyRules.contractWeight 와 동일 기준) */
export const REVENUE_PER_COUNT = 500000

export const todayKST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

/** 해당 월 영업일(월~금): 전체 / 오늘까지 지난 날 / 오늘 이후 남은 날 */
export function bizDays(ym: string): { total: number; elapsed: number; remaining: number } {
  const [y, m] = ym.split('-').map(Number)
  const today = todayKST()
  let total = 0, elapsed = 0, remaining = 0
  const last = new Date(y, m, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const dow = new Date(y, m - 1, d).getDay()
    if (dow === 0 || dow === 6) continue
    total++
    const ds = `${ym}-${String(d).padStart(2, '0')}`
    if (ds <= today) elapsed++
    else remaining++
  }
  return { total, elapsed, remaining }
}

export const stripTitle = (s: string) =>
  (s || '').replace(/\s*(수석팀장|팀장|팀원|대리|과장|부장|차장|이사|수석|매니저|주임|사원).*/g, '').trim()

const isSelf = (c: any) => c?.details?.supply_source === 'self_supply'
const ownerName = (c: any) => stripTitle(String(c?.details?.sales_user_name || c?.sales_user_name || ''))

export interface SelfStat { supplied: number; paid: number; revenue: number }

/** 발굴팀이 넘겨준 자체공급 건: 영업팀원별 공급 개수 · 결제 개수 · 결제 매출(부가세 제외) */
export function selfSupplyStats(customers: any[], ym: string): Record<string, SelfStat> {
  const out: Record<string, SelfStat> = {}
  for (const c of customers || []) {
    if (!isSelf(c)) continue
    const name = ownerName(c)
    if (!name) continue
    const s = (out[name] ||= { supplied: 0, paid: 0, revenue: 0 })
    if (String(c.details?.reception_date || c.created_at || '').slice(0, 7) === ym) s.supplied += 1
    if (c.status === 'contracted' && String(c.details?.contract_date || c.created_at || '').slice(0, 7) === ym) {
      const w = contractWeight(c.details?.payment_amount, c.details?.vat_included)
      s.paid += w
      s.revenue += Math.round(w * REVENUE_PER_COUNT)
    }
  }
  return out
}

export interface DigPerson {
  name: string
  approvedMonth: number
  approvedToday: number
  pending: number
  rejected: number
  assigned: number
}

/** 발굴팀 가망 목록 → 직원별 이번 달 현황 (승인 = approved + assigned) */
export function digPersonStats(prospects: any[], ym: string, names: string[]): DigPerson[] {
  const today = todayKST()
  const map: Record<string, DigPerson> = {}
  const get = (n: string) => (map[n] ||= { name: n, approvedMonth: 0, approvedToday: 0, pending: 0, rejected: 0, assigned: 0 })
  names.forEach(get)
  for (const p of prospects || []) {
    const n = p.dig_user_name || '(미상)'
    const inMonth = String(p.call_date || p.created_at || '').slice(0, 7) === ym
    if (!inMonth) continue
    const s = get(n)
    if (p.status === 'approved' || p.status === 'assigned') {
      s.approvedMonth++
      if (p.call_date === today) s.approvedToday++
      if (p.status === 'assigned') s.assigned++
    } else if (p.status === 'pending') s.pending++
    else if (p.status === 'rejected') s.rejected++
  }
  return Object.values(map)
}

/** 발굴팀 직원 1명의 이번 달 인건비: 기본급 + (월 승인 − 영업일×8) 초과분 1건당 1만원 */
export function digPay(approved: number, totalBizDays: number) {
  const over = Math.max(0, approved - totalBizDays * DIG_DAILY_GOAL)
  return DIG_BASE_SALARY + over * DIG_BONUS_PER_EXTRA
}

export { DIG_BASE_SALARY, DIG_DAILY_GOAL, DIG_BONUS_PER_EXTRA }
