'use client'

import { useEffect, useMemo, useState } from 'react'
import { contractWeight } from '@/lib/supplyRules'
import { isTester } from '@/lib/tester'
import { bizDays, digPersonStats, digPay, selfSupplyStats, stripTitle, todayKST, DB_UNIT_DEFAULT, REVENUE_PER_COUNT, DIG_BASE_SALARY, DIG_DAILY_GOAL, DIG_BONUS_PER_EXTRA } from '@/lib/digStats'

const NAVY = '#0b2140'
const won = (v: number) => Math.round(v).toLocaleString('ko-KR') + '원'
const man = (v: number) => (Math.abs(v) >= 100000000 ? parseFloat((v / 100000000).toFixed(2)) + '억' : Math.round(v / 10000).toLocaleString('ko-KR') + '만') + '원'
const num = (v: string) => parseInt(v.replace(/[^0-9]/g, ''), 10) || 0

function Box({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
      <h3 className="text-[17px] font-black" style={{ color: NAVY }}>{title}</h3>
      {sub && <p className="text-[13px] text-gray-500 mt-1 mb-4 leading-relaxed">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </div>
  )
}
function Stat({ label, value, note, tone = 'plain' }: { label: string; value: string; note?: string; tone?: 'plain' | 'good' | 'bad' | 'gold' }) {
  const c = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : tone === 'gold' ? 'text-[#a8873f]' : 'text-[#0b2140]'
  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
      <p className="text-[12.5px] text-gray-500 font-semibold">{label}</p>
      <p className={`text-[22px] leading-tight font-black tabular-nums mt-0.5 ${c}`}>{value}</p>
      {note && <p className="text-[12px] text-gray-400 mt-0.5">{note}</p>}
    </div>
  )
}

/** 매출 관리 — 발굴팀이 만든 이득, 손익분기(데드라인), 영업팀 목표→필요 공급→매출 시뮬레이터 */
export default function DigEffectPanel() {
  const ym = todayKST().slice(0, 7)
  const biz = bizDays(ym)
  const [loaded, setLoaded] = useState(false)
  const [prospects, setProspects] = useState<any[]>([])
  const [digNames, setDigNames] = useState<string[]>([])
  const [salesNames, setSalesNames] = useState<string[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [payrate, setPayrate] = useState<any[]>([])
  const [unit, setUnit] = useState(DB_UNIT_DEFAULT)

  // 시뮬레이터 입력
  const [who, setWho] = useState('')
  const [rateIn, setRateIn] = useState<string | null>(null)
  const [targetIn, setTargetIn] = useState<string | null>(null)
  const [selfIn, setSelfIn] = useState<string | null>(null)
  const [revIn, setRevIn] = useState(REVENUE_PER_COUNT)

  useEffect(() => {
    let live = true
    const j = (u: string) => fetch(u).then(r => r.json()).catch(() => ({}))
    Promise.all([
      j('/api/dig-prospects?status=all'), j('/api/users?role=dig'), j('/api/users?role=sales'),
      j('/api/customers'), j(`/api/payrate?year_month=${ym}`), j(`/api/payroll?year_month=${ym}`),
    ]).then(([p, d, s, c, pr, pay]) => {
      if (!live) return
      setProspects(p.prospects || [])
      setDigNames((d.users || []).filter((x: any) => x.name && !isTester(x.name, x.username)).map((x: any) => x.name))
      setSalesNames((s.users || []).filter((x: any) => x.name && !isTester(x.name, x.username)).map((x: any) => x.name))
      setCustomers(c.customers || [])
      setPayrate(pr.record?.employee_details || [])
      const u = Number(pay.record?.employees?.other_costs?.db_unit_price)
      if (u > 0) setUnit(u)
      setLoaded(true)
    })
    return () => { live = false }
  }, [ym])

  const people = useMemo(() => digPersonStats(prospects, ym, digNames), [prospects, ym, digNames])
  const nDig = Math.max(1, people.length)
  const approved = people.reduce((s, p) => s + p.approvedMonth, 0)
  const cost = people.length ? people.reduce((s, p) => s + digPay(p.approvedMonth, biz.total), 0) : 0
  const saved = approved * unit                       // 한경연에서 샀다면 들었을 DB 비용
  const gain = saved - cost                           // DB 절감 − 인건비
  const self = useMemo(() => selfSupplyStats(customers, ym), [customers, ym])
  const selfPaid = Object.values(self).reduce((s, v) => s + v.paid, 0)
  const selfSupplied = Object.values(self).reduce((s, v) => s + v.supplied, 0)
  const selfRev = Object.values(self).reduce((s, v) => s + v.revenue, 0)

  // 손익분기(데드라인) — 인건비를 DB 절감으로 메우려면 몇 개?
  const beEach = Math.ceil(DIG_BASE_SALARY / unit)    // 1인 월 최소 개수
  const beTeam = beEach * nDig
  const beDayEach = Math.ceil(beEach / Math.max(1, biz.total))
  const leftBE = Math.max(0, beTeam - approved)
  const beNeedDay = biz.remaining > 0 ? Math.ceil(leftBE / nDig / biz.remaining) : leftBE
  const goalTeam = nDig * biz.total * DIG_DAILY_GOAL
  const goalGain = goalTeam * unit - nDig * DIG_BASE_SALARY
  const leftGoal = Math.max(0, goalTeam - approved)
  const goalNeedDay = biz.remaining > 0 ? Math.ceil(leftGoal / nDig / biz.remaining) : leftGoal
  const projected = biz.elapsed > 0 ? Math.round(approved / biz.elapsed * biz.total) : 0

  // 영업팀원별 현재 수치 (자동 집계)
  const rows = useMemo(() => {
    const dailySum = (e: any) => Object.values(e?.daily_supplies || {}).reduce((s: number, v: any) => s + Number(v || 0), 0)
    return salesNames.map(n => {
      const key = stripTitle(n)
      const det = payrate.find((e: any) => stripTitle(String(e.name)) === key)
      let pay = 0
      for (const c of customers) {
        if (c.status !== 'contracted') continue
        const owner = stripTitle(String(c.details?.sales_user_name || c.sales_user_name || ''))
        if (owner !== key) continue
        if (String(c.details?.contract_date || c.created_at || '').slice(0, 7) !== ym) continue
        pay += contractWeight(c.details?.payment_amount, c.details?.vat_included)
      }
      const hk = det ? dailySum(det) : 0
      const sf = self[key]?.supplied || 0
      const rate = hk + sf > 0 ? pay / (hk + sf) * 100 : null
      return { name: n, hk, sf, pay, rate, target: Number(det?.target) || 0 }
    })
  }, [salesNames, payrate, customers, self, ym])

  const pick = rows.find(r => r.name === who) || rows.find(r => r.name.includes('제후')) || rows[0]
  const rate = rateIn !== null ? Number(rateIn) || 0 : Math.round((pick?.rate ?? 15) * 10) / 10
  const target = targetIn !== null ? num(targetIn) : (pick?.target || 30)
  const selfPlan = selfIn !== null ? num(selfIn) : projected
  const need = rate > 0 ? Math.ceil(target / (rate / 100)) : 0
  const buy = Math.max(0, need - selfPlan)
  const buyCost = buy * unit
  const revenue = Math.round(target * revIn)
  const noDigCost = need * unit
  const perDayNeed = biz.total > 0 ? Math.ceil(need / biz.total) : need

  if (!loaded) return <div className="text-center py-10 text-gray-400 text-sm">발굴팀 효과를 계산하는 중…</div>

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[12px] tracking-[0.25em] text-[#b8995a] font-semibold">DIG TEAM</p>
        <h2 className="text-[20px] font-black" style={{ color: NAVY }}>발굴팀 · {ym.replace('-', '년 ')}월 이득과 목표</h2>
        <p className="text-[13px] text-gray-500 mt-1">한경연 DB 개당 <b>{won(unit)}</b>인데, 발굴팀이 승인받은 건은 DB를 사지 않아도 되는 자체공급입니다.</p>
      </div>

      <Box title="① 이번 달 이득" sub="발굴팀 승인 개수 × 한경연 DB 단가 − 발굴팀 인건비">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="발굴팀 승인" value={`${approved}개`} note={`${people.length}명 · 지금 속도면 월 ${projected}개`} />
          <Stat label="DB 값 절감" value={man(saved)} note={`${approved}개 × ${won(unit)}`} tone="gold" />
          <Stat label="발굴팀 인건비" value={man(cost)} note={`기본 ${man(DIG_BASE_SALARY)} × ${people.length || 0}명 + 초과 1만원/개`} />
          <Stat label="순이득 (DB 기준)" value={(gain >= 0 ? '+' : '−') + man(Math.abs(gain))} tone={gain >= 0 ? 'good' : 'bad'} note={gain >= 0 ? '이미 본전을 넘었어요' : '아직 본전 전이에요'} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <Stat label="영업팀에 넘긴 자체공급" value={`${selfSupplied}개`} />
          <Stat label="자체공급 결제" value={`${selfPaid % 1 === 0 ? selfPaid : selfPaid.toFixed(1)}건`} note={selfSupplied > 0 ? `결제율 ${(selfPaid / selfSupplied * 100).toFixed(1)}%` : undefined} tone="good" />
          <Stat label="자체공급 결제 매출" value={man(selfRev)} note="부가세 제외 · 결제 1개 = 50만원" tone="gold" />
          <Stat label="매출 − 인건비" value={(selfRev - cost >= 0 ? '+' : '−') + man(Math.abs(selfRev - cost))} tone={selfRev - cost >= 0 ? 'good' : 'bad'} note="DB 절감까지 합치면 위 이득에 더해져요" />
        </div>
      </Box>

      <Box title="② 데드라인 — 몇 개는 따야 하나" sub={`영업일 ${biz.total}일 (지난 ${biz.elapsed}일 · 남은 ${biz.remaining}일) 기준. 손익분기 = 기본급 ${man(DIG_BASE_SALARY)} ÷ DB 단가 ${won(unit)}`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="손익분기 (1인 월)" value={`${beEach}개`} note={`팀 ${beTeam}개 · 1인 하루 ${beDayEach}개 이상`} tone="gold" />
          <Stat label="본전까지 남은 개수" value={leftBE > 0 ? `${leftBE}개` : '달성 ✓'} note={leftBE > 0 ? `남은 영업일 1인 하루 ${beNeedDay}개` : undefined} tone={leftBE > 0 ? 'bad' : 'good'} />
          <Stat label={`월 목표 (하루 ${DIG_DAILY_GOAL}개)`} value={`${goalTeam}개`} note={`달성 시 DB 절감 순이득 ${man(goalGain)}`} />
          <Stat label="목표까지 남은 개수" value={leftGoal > 0 ? `${leftGoal}개` : '달성 ✓'} note={leftGoal > 0 ? `남은 영업일 1인 하루 ${goalNeedDay}개` : undefined} tone={leftGoal > 0 ? 'plain' : 'good'} />
        </div>
        <p className="text-[12px] text-gray-400 mt-3">※ 월 {DIG_DAILY_GOAL}개 × 영업일 {biz.total}일 = {biz.total * DIG_DAILY_GOAL}개를 넘긴 개수부터는 1개당 {won(DIG_BONUS_PER_EXTRA)}이 추가로 나가요 (이미 인건비에 반영).</p>
      </Box>

      <Box title="③ 영업팀장 목표 시뮬레이터" sub="결제율이 이 정도이고 목표를 이만큼 잡으면 DB를 몇 개 줘야 하는지, 그러면 매출이 얼마인지 계산합니다. 숫자는 직접 바꿔 볼 수 있어요.">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <label className="block"><span className="text-[12.5px] text-gray-500 font-semibold">영업팀원</span>
            <select value={pick?.name || ''} onChange={e => { setWho(e.target.value); setRateIn(null); setTargetIn(null) }}
              className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white">
              {rows.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select></label>
          <label className="block"><span className="text-[12.5px] text-gray-500 font-semibold">총결제율 (%)</span>
            <input value={rateIn ?? String(rate)} onChange={e => setRateIn(e.target.value)} inputMode="decimal" className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm" /></label>
          <label className="block"><span className="text-[12.5px] text-gray-500 font-semibold">목표 결제 (개)</span>
            <input value={targetIn ?? String(target)} onChange={e => setTargetIn(e.target.value)} inputMode="numeric" className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm" /></label>
          <label className="block"><span className="text-[12.5px] text-gray-500 font-semibold">발굴팀에서 받을 자체공급 (개)</span>
            <input value={selfIn ?? String(selfPlan)} onChange={e => setSelfIn(e.target.value)} inputMode="numeric" className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm" /></label>
          <label className="block"><span className="text-[12.5px] text-gray-500 font-semibold">결제 1개당 매출 (원)</span>
            <input value={revIn.toLocaleString('ko-KR')} onChange={e => setRevIn(num(e.target.value))} inputMode="numeric" className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm" /></label>
        </div>
        {pick && <p className="text-[12.5px] text-gray-500 mt-2">{pick.name} 이번 달 현재: 한경연 공급 {pick.hk}개 + 자체 {pick.sf}개 · 결제 {pick.pay % 1 === 0 ? pick.pay : pick.pay.toFixed(1)}건 · 총결제율 {pick.rate !== null ? pick.rate.toFixed(1) + '%' : '—'}</p>}
        <div className="rounded-2xl text-white bg-gradient-to-br from-[#10203a] to-[#0a1424] p-5 mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div><p className="text-[12.5px] text-white/60 font-semibold">필요한 총 공급</p><p className="text-[26px] font-black tabular-nums text-[#E8D080]">{need}개</p><p className="text-[12px] text-white/50">목표 {target} ÷ 결제율 {rate}% · 하루 {perDayNeed}개</p></div>
          <div><p className="text-[12.5px] text-white/60 font-semibold">그중 한경연에서 구매</p><p className="text-[26px] font-black tabular-nums">{buy}개</p><p className="text-[12px] text-white/50">자체공급 {Math.min(selfPlan, need)}개로 충당 · DB비 {man(buyCost)}</p></div>
          <div><p className="text-[12.5px] text-white/60 font-semibold">예상 매출</p><p className="text-[26px] font-black tabular-nums text-[#7ee0b5]">{man(revenue)}</p><p className="text-[12px] text-white/50">{target}개 × {won(revIn)}</p></div>
          <div><p className="text-[12.5px] text-white/60 font-semibold">발굴팀 덕에 아끼는 DB비</p><p className="text-[26px] font-black tabular-nums text-[#7ee0b5]">{man(noDigCost - buyCost)}</p><p className="text-[12px] text-white/50">발굴팀이 없으면 DB비 {man(noDigCost)}</p></div>
        </div>
        <p className="text-[12px] text-gray-400 mt-3">※ 결제율은 (공가+직가 결제) ÷ (한경연 공급 + 자체공급)이고, 결제 1개 = 부가세 제외 50만원(10만원당 0.2개) 기준입니다. 현재 속도 기준 발굴팀 월 예상 승인은 {projected}개예요.</p>
      </Box>
    </div>
  )
}
