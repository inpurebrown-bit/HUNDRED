// 월별 손익 기록에서 "사업이 성장 중인가 / 어디를 더 밀어야 하나 / 얼마를 해야 남나"를 계산한다.
import type { MonthPnl } from './pnlCalc'

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

export type Trend = 'growing' | 'flat' | 'declining' | 'unknown'

export interface TeamModel {
  avgRev: number          // 최근 평균 매출
  varRate: number         // 매출 1원당 나가는 변동비(인센티브 + 세금적립)
  margin: number          // 매출 1원이 늘면 남는 돈 (1 − 변동비율)
  directFixed: number     // 이 팀이 쓰는 고정비
  sharedFixed: number     // 공통비(임대·관리비) 중 이 팀 몫
  breakEven: number       // 이 팀이 본전을 맞추려면 필요한 월 매출
  coverage: number | null // 평균 매출 ÷ 본전 매출
  gap: number             // 평균 매출 − 본전 매출 (+ 여유 / − 부족)
  last6: number[]
}

export interface Analysis {
  done: MonthPnl[]            // 완료된 달(입력 완전)
  last3: MonthPnl[]
  prev3: MonthPnl[]
  trend: Trend
  trendNote: string
  revGrowth: number | null    // 최근3개월 평균 매출 증감률
  netGrowth: number | null
  avgRev: number
  avgNet: number
  avgMargin: number | null
  sales: TeamModel
  ops: TeamModel
  totalBreakEven: number
  fixedTotal: number
  avgContractValue: number    // 영업 계약 1건당 평균 매출
  avgOpsFee: number           // 관리팀 수수료 1건당 평균
  pushTarget: 'sales' | 'ops' | 'both' | 'none'
  verdict: string[]
  opsVolatility: { min: number; max: number } | null
  salesVolatility: { min: number; max: number } | null
}

export function analyze(months: MonthPnl[], currentYm: string): Analysis {
  const done = months.filter(m => m.hasData && m.quality === 'ok' && m.ym !== currentYm)
  const last3 = done.slice(-3)
  const prev3 = done.slice(-6, -3)

  const revL = avg(last3.map(m => m.totalRev)), revP = avg(prev3.map(m => m.totalRev))
  const netL = avg(last3.map(m => m.net)), netP = avg(prev3.map(m => m.net))
  const revGrowth = prev3.length >= 2 && revP > 0 ? (revL - revP) / revP : null
  const netGrowth = prev3.length >= 2 && Math.abs(netP) > 0 ? (netL - netP) / Math.abs(netP) : null

  let trend: Trend = 'unknown'
  let trendNote = '비교할 달이 부족합니다.'
  if (last3.length >= 2) {
    // 비교 기준: 이전 3개월이 있으면 3개월 대 3개월, 없으면 첫 달 대 마지막 달
    const a = prev3.length >= 2 ? { r: revP, n: netP } : { r: last3[0].totalRev, n: last3[0].net }
    const b = prev3.length >= 2 ? { r: revL, n: netL } : { r: last3[last3.length - 1].totalRev, n: last3[last3.length - 1].net }
    const rg = a.r > 0 ? (b.r - a.r) / a.r : 0
    const ng = Math.abs(a.n) > 0 ? (b.n - a.n) / Math.abs(a.n) : 0
    if (netL < 0) { trend = 'declining'; trendNote = '최근 평균 순이익이 적자입니다.' }
    else if (rg > 0.05 && ng > 0.05) { trend = 'growing'; trendNote = `매출 ${(rg * 100).toFixed(0)}%↑, 순이익 ${(ng * 100).toFixed(0)}%↑` }
    else if (rg < -0.05 || ng < -0.15) { trend = 'declining'; trendNote = `매출 ${(rg * 100).toFixed(0)}%, 순이익 ${(ng * 100).toFixed(0)}% (이전 대비)` }
    else { trend = 'flat'; trendNote = `매출 ${(rg * 100).toFixed(0)}%, 순이익 ${(ng * 100).toFixed(0)}% — 큰 변화 없음` }
  }

  // ── 팀별 손익분기 ──
  const base = last3.length ? last3 : done.slice(-1)
  const salesRev = avg(base.map(m => m.salesRev)), opsRev = avg(base.map(m => m.opsRev))
  const totalRev = salesRev + opsRev
  const sShare = totalRev > 0 ? salesRev / totalRev : 0.5
  const salesVarL = avg(base.map(m => m.labor.salesVar + m.labor.digVar))   // 발굴팀은 영업 DB를 만들어 주므로 영업 쪽으로 묶음
  const opsVarL = avg(base.map(m => m.labor.opsVar))
  // 고정비는 '지금의 구조'를 반영하도록 가장 최근 완료된 달 기준, 변동이 큰 DB 매입·기타는 최근 평균
  const latest = done[done.length - 1] || base[base.length - 1]
  const salesDirectFixed = (latest ? latest.labor.salesFixed + latest.labor.digFixed + latest.costs.fixed : 0)
    + avg(base.map(m => m.costs.db)) + avg(base.map(m => m.costs.extra))
  const opsDirectFixed = latest ? latest.labor.opsFixed : 0
  const shared = latest ? latest.costs.rent + latest.costs.mgmt : 0

  const model = (rev: number, varL: number, direct: number, sharedPart: number, series: number[]): TeamModel => {
    const varRate = rev > 0 ? varL / rev + 0.10 : 0.35
    const margin = Math.max(0.05, 1 - varRate)
    const breakEven = (direct + sharedPart) / margin
    return {
      avgRev: rev, varRate, margin, directFixed: direct, sharedFixed: sharedPart, breakEven,
      coverage: breakEven > 0 ? rev / breakEven : null, gap: rev - breakEven, last6: series,
    }
  }
  const sales = model(salesRev, salesVarL, salesDirectFixed, shared * sShare, done.slice(-6).map(m => m.salesRev))
  const ops = model(opsRev, opsVarL, opsDirectFixed, shared * (1 - sShare), done.slice(-6).map(m => m.opsRev))

  const salesCountSum = sum(base.map(m => m.salesCount))
  const avgContractValue = salesCountSum > 0 ? sum(base.map(m => m.salesRev)) / salesCountSum : 0
  const feeCountSum = sum(base.map(m => m.opsFeeCount))
  const avgOpsFee = feeCountSum > 0 ? sum(base.map(m => m.opsRev)) / feeCountSum : 0

  const range = (xs: number[]) => (xs.length >= 3 ? { min: Math.min(...xs), max: Math.max(...xs) } : null)
  const opsVolatility = range(done.slice(-6).map(m => m.opsRev))
  const salesVolatility = range(done.slice(-6).map(m => m.salesRev))

  // ── 어디를 더 밀어야 하나 ──
  let pushTarget: Analysis['pushTarget'] = 'none'
  const sC = sales.coverage ?? 1, oC = ops.coverage ?? 1
  if (sC < 1 && oC < 1) pushTarget = 'both'
  else if (sC < 1) pushTarget = 'sales'
  else if (oC < 1) pushTarget = 'ops'
  else pushTarget = sales.margin >= ops.margin ? 'sales' : 'ops'   // 둘 다 본전 이상이면 1원당 더 남는 쪽을 키운다

  const m = (n: number) => `${Math.round(Math.abs(n) / 10000).toLocaleString()}만 원`
  const verdict: string[] = []
  if (sales.gap >= 0) verdict.push(`영업팀은 월 ${m(sales.breakEven)}이면 본전인데 최근 평균 ${m(sales.avgRev)}으로 ${m(sales.gap)} 여유가 있습니다.`)
  else verdict.push(`영업팀은 월 ${m(sales.breakEven)}은 해야 본전인데 최근 평균 ${m(sales.avgRev)}으로 ${m(sales.gap)} 부족합니다.`)
  if (ops.gap >= 0) verdict.push(`관리팀은 월 ${m(ops.breakEven)}이면 본전인데 최근 평균 ${m(ops.avgRev)}으로 ${m(ops.gap)} 여유가 있습니다.`)
  else verdict.push(`관리팀은 월 ${m(ops.breakEven)}은 해야 본전인데 최근 평균 ${m(ops.avgRev)}으로 ${m(ops.gap)} 부족합니다.`)
  verdict.push(`매출 1원이 늘 때 남는 돈은 영업팀 ${(sales.margin * 100).toFixed(0)}원, 관리팀 ${(ops.margin * 100).toFixed(0)}원입니다(인센티브·세금적립 제외).`)
  if (opsVolatility && opsVolatility.max > opsVolatility.min * 3) verdict.push(`관리팀 매출은 월별 편차가 큽니다(최저 ${m(opsVolatility.min)} ~ 최고 ${m(opsVolatility.max)}). 수수료 입금이 몰리는 달에 의존하는 구조입니다.`)
  if (salesVolatility && salesVolatility.max > salesVolatility.min * 2) verdict.push(`영업팀 매출도 월별로 ${m(salesVolatility.min)} ~ ${m(salesVolatility.max)} 사이에서 흔들립니다.`)

  return {
    done, last3, prev3, trend, trendNote, revGrowth, netGrowth,
    avgRev: revL, avgNet: netL, avgMargin: revL > 0 ? netL / revL : null,
    sales, ops, totalBreakEven: sales.breakEven + ops.breakEven,
    fixedTotal: salesDirectFixed + opsDirectFixed + shared,
    avgContractValue, avgOpsFee, pushTarget, verdict, opsVolatility, salesVolatility,
  }
}

// ── 금액 표시 ──
export const won = (v: number) => (v < 0 ? '-' : '') + Math.round(Math.abs(v)).toLocaleString('ko-KR') + '원'
export const man = (v: number) => {
  const a = Math.abs(v), sign = v < 0 ? '-' : ''
  if (a >= 100_000_000) return sign + parseFloat((a / 100_000_000).toFixed(2)) + '억'
  return sign + Math.round(a / 10_000).toLocaleString('ko-KR') + '만'
}
export const monthLabel = (ym: string) => `${parseInt(ym.slice(5), 10)}월`
