'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_ASM, calcPlan, simulateLoans, parsePhaseEnd, type Assumptions, type PlanLoan } from '@/lib/plannerCalc'

// ─────────────────────────────────────────────────────────────
// 플래너 — ① 건수를 조작하면 매출·남는 돈이 바로 보이는 시뮬레이터
//          ② 기준점 표 / 월별 현황(실제 매출 연동)
//          ③ 그 아래: 시뮬레이션 여유 금액으로 짜지는 대출 상환 계획
// 계산식은 엑셀(기준점·현황 시트)과 같고, 매출은 CRM 매출 관리에서 가져온다.
// ─────────────────────────────────────────────────────────────

type Mode = 'now' | 'avg' | 'manual'
interface Saved {
  asm?: Partial<Assumptions>; simN?: number; opsMode?: Mode; opsManual?: number
  share?: number; extraOverride?: number | null; balances?: Record<string, number>
}
interface RawLoan {
  id: string; amount: number; rate: number; institution: string; bank: string
  p1_principal: number; p1_monthly: number; p2_same: boolean; p2_principal: number; p2_monthly: number
  repayment_type?: string; repayment_day?: string; goal?: string
}

const sign = (v: number) => (v < 0 ? '−' : '')
const man = (v: number) => {
  const a = Math.abs(Math.round(v))
  if (a >= 100000000) return sign(v) + parseFloat((a / 100000000).toFixed(2)) + '억'
  return sign(v) + Math.round(a / 10000).toLocaleString() + '만'
}
const won = (v: number) => sign(v) + Math.abs(Math.round(v)).toLocaleString() + '원'
const kst = () => new Date(Date.now() + 9 * 3600 * 1000)

function NumInput({ value, onChange, suffix, className = '' }: { value: number; onChange: (v: number) => void; suffix?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <input inputMode="numeric" value={value ? value.toLocaleString() : ''} placeholder="0"
        onChange={e => onChange(parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
        className="w-full min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-[#0b2140]/30 bg-white" />
      {suffix && <span className="text-[11px] text-gray-400 shrink-0">{suffix}</span>}
    </span>
  )
}

export default function PlannerTab() {
  const [loading, setLoading] = useState(true)
  const [monthly, setMonthly] = useState<any[]>([])
  const [thisSalesCount, setThisSalesCount] = useState(0)
  const [loansRaw, setLoansRaw] = useState<RawLoan[]>([])
  const [phaseLabels, setPhaseLabels] = useState<[string, string]>(['', ''])

  const [asm, setAsm] = useState<Assumptions>({ ...DEFAULT_ASM })
  const [simN, setSimN] = useState(20)
  const [opsMode, setOpsMode] = useState<Mode>('avg')
  const [opsManual, setOpsManual] = useState(0)
  const [share, setShare] = useState(100)
  const [extraOverride, setExtraOverride] = useState<number | null>(null)
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [page, setPage] = useState<'base' | 'month'>('base')
  const [showAsm, setShowAsm] = useState(false)
  const [showRows, setShowRows] = useState(false)
  const [showOld, setShowOld] = useState(false)
  const [oldH, setOldH] = useState(1400)
  const [saveMsg, setSaveMsg] = useState('')
  const loaded = useRef(false)

  // ── 불러오기: 매출(CRM) · 대출(개인재무) · 저장해 둔 가정값 ──
  useEffect(() => {
    let dead = false
    Promise.all([
      fetch('/api/revenue').then(r => r.json()).catch(() => null),
      fetch('/api/personal-finance').then(r => r.json()).catch(() => null),
      fetch('/api/planner/settings').then(r => r.json()).catch(() => null),
    ]).then(([rev, pf, st]) => {
      if (dead) return
      setMonthly((rev?.monthly || []).slice().sort((a: any, b: any) => String(a.fullMonth).localeCompare(String(b.fullMonth))))
      setThisSalesCount(((rev?.thisMonthSales || []) as any[]).filter(e => (e.amount || 0) > 0).length)
      const emp = pf?.record?.employees
      if (Array.isArray(emp?.loans)) setLoansRaw(emp.loans)
      if (Array.isArray(emp?.phaseLabels)) setPhaseLabels(emp.phaseLabels as [string, string])
      const v: Saved | null = st?.value || null
      if (v) {
        if (v.asm) setAsm({ ...DEFAULT_ASM, ...v.asm })
        if (typeof v.simN === 'number') setSimN(v.simN)
        if (v.opsMode) setOpsMode(v.opsMode)
        if (typeof v.opsManual === 'number') setOpsManual(v.opsManual)
        if (typeof v.share === 'number') setShare(v.share)
        if (v.extraOverride !== undefined) setExtraOverride(v.extraOverride)
        if (v.balances) setBalances(v.balances)
      }
      loaded.current = true
      setLoading(false)
    })
    return () => { dead = true }
  }, [])

  // ── 바꾼 값은 잠깐 뒤 자동 저장 ──
  useEffect(() => {
    if (!loaded.current) return
    const t = setTimeout(() => {
      const value: Saved = { asm, simN, opsMode, opsManual, share, extraOverride, balances }
      fetch('/api/planner/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) })
        .then(r => setSaveMsg(r.ok ? '자동 저장됨' : '저장 실패')).catch(() => setSaveMsg('저장 실패'))
    }, 900)
    return () => clearTimeout(t)
  }, [asm, simN, opsMode, opsManual, share, extraOverride, balances])

  // ── 매출 연동 값 ──
  const now = kst()
  const curKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const opsOf = (m: any) => Number(m?.관리팀 || 0) + Number(m?.관리팀계약 || 0)
  const curRow = monthly.find(m => m.fullMonth === curKey)
  const doneRows = monthly.filter(m => m.fullMonth < curKey).slice(-3)
  const opsNow = opsOf(curRow)
  const opsAvg = doneRows.length ? doneRows.reduce((s, m) => s + opsOf(m), 0) / doneRows.length : 0
  const opsRev = opsMode === 'now' ? opsNow : opsMode === 'manual' ? opsManual : opsAvg
  const salesNowRev = Number(curRow?.영업팀 || 0)
  const day = now.getUTCDate()
  const dim = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate()
  const pacedN = day > 0 && salesNowRev > 0 ? (salesNowRev / asm.unit) / day * dim : 0

  // ── 대출 연동 ──
  const phase1End = parsePhaseEnd(phaseLabels[0])
  const calNow = now.getUTCFullYear() * 12 + now.getUTCMonth()
  const inPhase1 = phase1End == null || calNow <= phase1End - 1
  const monthlyOf = (l: RawLoan) => Number(inPhase1 ? l.p1_monthly : (l.p2_same ? l.p1_monthly : l.p2_monthly)) || 0
  const loanMonthly = loansRaw.reduce((s, l) => s + monthlyOf(l), 0)

  const plan = useMemo(() => calcPlan(asm, simN, opsRev, loanMonthly), [asm, simN, opsRev, loanMonthly])

  // ── ① 기준점 표 ──
  const baseRows = useMemo(() => {
    const ns = Array.from(new Set([10, 15, 20, 25, 30, 35, 40, simN])).sort((a, b) => a - b)
    return ns.map(n => ({ n, r: calcPlan(asm, n, opsRev, loanMonthly) }))
  }, [asm, opsRev, loanMonthly, simN])

  // ── ② 월별 현황 (실제 매출) ──
  const monthRows = useMemo(() => monthly.slice(-6).reverse().map(m => {
    const n = asm.unit > 0 ? Number(m.영업팀 || 0) / asm.unit : 0
    return { key: m.fullMonth as string, label: m.month as string, cur: m.fullMonth === curKey, n, sales: Number(m.영업팀 || 0), ops: opsOf(m), r: calcPlan(asm, n, opsOf(m), loanMonthly) }
  }), [monthly, asm, loanMonthly, curKey])
  // 실제 영업 매출을 그대로 쓰기 위해, 월별 현황은 건수×단가가 아니라 실제 매출로 다시 계산
  const monthRowsExact = monthRows.map(x => {
    const rev = x.sales + x.ops
    const salesPay = x.sales * asm.salesRate, opsPay = x.ops * asm.opsRate
    const pay = salesPay + opsPay + asm.opsBase + asm.digBase
    const tax = rev * asm.taxRate
    const left = rev - pay - tax
    const afterFixed = left - x.r.fixed
    const final = afterFixed - x.r.goals
    return { ...x, rev, left, afterFixed, final, ok: final > 0 }
  })

  // ── 대출 상환 계획 ──
  const planLoans: PlanLoan[] = loansRaw.map(l => ({
    id: l.id, institution: l.institution, bank: l.bank,
    balance: balances[l.id] ?? l.amount, rate: l.rate,
    p1Principal: l.p1_principal || 0, p2Principal: l.p2_same ? (l.p1_principal || 0) : (l.p2_principal || 0),
  }))
  const surplus = Math.max(0, plan.final)
  const autoExtra = Math.round(surplus * share / 100)
  const extra = extraOverride !== null ? extraOverride : autoExtra
  const start = { y: now.getUTCFullYear(), m: now.getUTCMonth() + 1 }
  const simBase = useMemo(() => simulateLoans(planLoans, 0, phase1End, start, 120), [loansRaw, balances, phase1End]) // eslint-disable-line react-hooks/exhaustive-deps
  const simPlan = useMemo(() => simulateLoans(planLoans, extra, phase1End, start, 120), [loansRaw, balances, phase1End, extra]) // eslint-disable-line react-hooks/exhaustive-deps
  const totalBal = planLoans.reduce((s, l) => s + l.balance, 0)
  const payoffTxt = (m: number | null) => {
    if (m == null) return '10년 안에 완납 안 됨'
    const cal = calNow + (m - 1)
    return `${Math.floor(cal / 12)}년 ${(cal % 12) + 1}월 (${m}개월 후)`
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>

  const okColor = plan.ok ? 'text-emerald-300' : 'text-rose-300'
  const setA = (k: keyof Assumptions, v: number) => setAsm(a => ({ ...a, [k]: v }))
  const cardCls = 'bg-white rounded-2xl border border-gray-100 p-4 md:p-6'
  const rate = (v: number) => Math.round(v * 1000) / 10

  return (
    <div className="space-y-5 pb-10">
      {/* ═══ ① 시뮬레이터 ═══ */}
      <section className="rounded-2xl bg-gradient-to-br from-[#10203a] to-[#0a1424] text-white p-4 md:p-6 shadow-sm">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-[#E8D080]">이번 달, 얼마 하면?</h2>
          <span className="text-[10px] text-white/40">{saveMsg}</span>
        </div>

        <div className="mt-4 grid md:grid-cols-[1.1fr_1fr] gap-5">
          {/* 조작 */}
          <div>
            <p className="text-[11px] text-white/60 mb-1.5">영업 계약 건수 (건당 {man(asm.unit)})</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSimN(n => Math.max(0, n - 1))} className="w-11 h-11 rounded-xl bg-white/10 text-xl font-bold active:bg-white/20">−</button>
              <input inputMode="numeric" value={simN} onChange={e => setSimN(Math.min(200, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0))}
                className="w-24 h-11 rounded-xl bg-white text-[#0b2140] text-center text-2xl font-black tabular-nums focus:outline-none" />
              <button type="button" onClick={() => setSimN(n => Math.min(200, n + 1))} className="w-11 h-11 rounded-xl bg-white/10 text-xl font-bold active:bg-white/20">+</button>
              <span className="text-sm text-white/70">건</span>
            </div>
            <input type="range" min={0} max={60} step={1} value={Math.min(60, simN)} onChange={e => setSimN(parseInt(e.target.value, 10))}
              className="w-full mt-3 accent-[#E8D080]" />
            <div className="flex justify-between text-[10px] text-white/35 -mt-0.5"><span>0</span><span>15</span><span>30</span><span>45</span><span>60</span></div>
            <p className="mt-2 text-[12px] text-white/70">영업 매출 <b className="text-white text-base tabular-nums">{man(plan.salesRev)}</b>
              <span className="text-white/40"> · 직접 입력 </span>
              <input inputMode="numeric" value={plan.salesRev ? Math.round(plan.salesRev / 10000).toLocaleString() : ''} placeholder="0"
                onChange={e => { const v = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0; setSimN(Math.round(v * 10000 / (asm.unit || 1))) }}
                className="w-20 rounded-lg bg-white/10 border border-white/15 px-2 py-1 text-right text-sm tabular-nums focus:outline-none" /> 만원</p>

            {/* 연동 정보 */}
            <div className="mt-4 rounded-xl bg-white/[.06] border border-white/10 px-3 py-2.5 text-[11px] leading-relaxed text-white/70 space-y-1">
              <p>📊 <b className="text-white/90">이번 달 실제(지금까지)</b> 영업 {man(salesNowRev)} ≈ <b className="text-white/90">{(salesNowRev / (asm.unit || 1)).toFixed(1)}건</b>
                {pacedN > 0 && <> · 이 속도면 월말 약 <b className="text-[#E8D080]">{Math.round(pacedN)}건</b></>}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span>🏢 관리팀 매출 가정</span>
                {([['now', `지금까지 ${man(opsNow)}`], ['avg', `3개월 평균 ${man(opsAvg)}`], ['manual', '직접']] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setOpsMode(k)}
                    className={`px-2 py-1 rounded-full border text-[10px] font-semibold ${opsMode === k ? 'bg-[#E8D080] text-[#0b2140] border-[#E8D080]' : 'border-white/20 text-white/70'}`}>{l}</button>
                ))}
                {opsMode === 'manual' && (
                  <input inputMode="numeric" value={opsManual ? Math.round(opsManual / 10000).toLocaleString() : ''} placeholder="0"
                    onChange={e => setOpsManual((parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0) * 10000)}
                    className="w-16 rounded-lg bg-white/10 border border-white/15 px-2 py-0.5 text-right text-[11px] focus:outline-none" />
                )}
                {opsMode === 'manual' && <span>만원</span>}
              </div>
            </div>
          </div>

          {/* 결과 */}
          <div className="rounded-xl bg-white/[.06] border border-white/10 p-4">
            <p className="text-[11px] text-white/60">전부 빼고 이러면 남는 돈</p>
            <p className={`text-4xl font-black tabular-nums mt-0.5 ${okColor}`}>{man(plan.final)}</p>
            <p className="text-[11px] text-white/40 tabular-nums">{won(plan.final)}</p>
            <div className="mt-2">
              {plan.ok
                ? <span className="inline-block px-3 py-1 rounded-full bg-emerald-400/15 text-emerald-300 text-xs font-bold">✅ 성공 — 목표 달성</span>
                : <span className="inline-block px-3 py-1 rounded-full bg-rose-400/15 text-rose-300 text-xs font-bold">❌ 실패 — 부족 {man(-plan.final)}</span>}
            </div>
            {!plan.ok && (
              <p className="mt-2 text-[12px] text-white/80 leading-relaxed">
                내가 직접 <b className="text-[#E8D080]">{plan.needSelf}건</b> 더 계약하면 채워져요
                <span className="text-white/45"> (팀 계약이면 {plan.needTeam}건)</span>
              </p>
            )}
            <p className="mt-2 text-[11px] text-white/55">관리팀 {man(opsRev)} 기준, 영업 <b className="text-white/85">{plan.breakEvenN}건</b> 이상이면 성공</p>
          </div>
        </div>

        {/* 계산 내역 */}
        <div className="mt-4 rounded-xl bg-white/[.04] border border-white/10 overflow-hidden text-[12px]">
          {([
            ['총 매출', plan.rev, `영업 ${man(plan.salesRev)} + 관리 ${man(plan.opsRev)}`, 'text-white'],
            ['− 인건비', -(plan.salesPay + plan.opsPay), `영업 ${rate(asm.salesRate)}% · 관리 ${rate(asm.opsRate)}%`, 'text-white/80'],
            ['− 기본급', -plan.baseSalary, `관리 ${man(asm.opsBase)} + 발굴 ${man(asm.digBase)}`, 'text-white/80'],
            ['− 세금', -plan.tax, `매출의 ${rate(asm.taxRate)}%`, 'text-white/80'],
            ['= 남은돈', plan.left, '최종 매출에서 남은돈', 'text-[#E8D080] font-bold'],
            ['− 고정 지출', -plan.fixed, `임대 ${man(asm.rent)} · 대출 ${man(plan.loan + asm.extraInterest)} · 카드 ${man(asm.card)} · 월세 ${man(asm.living)}`, 'text-white/80'],
            ['− 모을 돈', -plan.goals, `결혼 ${man(asm.marry)} + 사무실 확장 ${man(asm.expand)}`, 'text-white/80'],
            ['= 이러면 남은돈', plan.final, plan.ok ? '성공' : '실패', plan.ok ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'],
          ] as [string, number, string, string][]).map(([l, v, sub, cls], i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-white/5 last:border-0">
              <div className="min-w-0"><span className={cls}>{l}</span><span className="ml-2 text-[10px] text-white/35 truncate">{sub}</span></div>
              <span className={`tabular-nums shrink-0 ${cls}`}>{man(v)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ ② 기준점 표 / 월별 현황 ═══ */}
      <section className={cardCls}>
        <div className="flex gap-1.5 mb-4">
          {([['base', '① 기준점 표'], ['month', '② 지금까지 월별 현황']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setPage(k)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${page === k ? 'bg-[#0b2140] text-white border-[#0b2140]' : 'bg-white text-gray-500 border-gray-200'}`}>{l}</button>
          ))}
        </div>

        {page === 'base' ? (
          <>
            <p className="text-[11px] text-gray-400 mb-2">건수별로 이러면 어떻게 되는지 한눈에 — 줄을 누르면 위 시뮬레이터가 그 건수로 바뀝니다 · 관리팀 {man(opsRev)} 기준</p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[560px] text-[12px] tabular-nums">
                <thead>
                  <tr className="text-gray-400 text-[11px] border-b border-gray-100">
                    <th className="text-left font-medium py-2 px-2">영업 건수</th>
                    <th className="text-right font-medium px-2">총 매출</th>
                    <th className="text-right font-medium px-2">남은돈</th>
                    <th className="text-right font-medium px-2">뺄거 다빼고</th>
                    <th className="text-right font-medium px-2">이러면 남은돈</th>
                    <th className="text-center font-medium px-2">결과</th>
                    <th className="text-right font-medium px-2">내가 더</th>
                  </tr>
                </thead>
                <tbody>
                  {baseRows.map(({ n, r }) => (
                    <tr key={n} onClick={() => setSimN(n)}
                      className={`cursor-pointer border-b border-gray-50 hover:bg-[#0b2140]/[.04] ${n === simN ? 'bg-[#b8995a]/15 font-bold' : ''}`}>
                      <td className="py-2 px-2 text-[#0b2140]">{n}건{n === simN && <span className="ml-1 text-[10px] text-[#a8873f]">◀ 지금</span>}</td>
                      <td className="text-right px-2">{man(r.rev)}</td>
                      <td className="text-right px-2">{man(r.left)}</td>
                      <td className="text-right px-2">{man(r.afterFixed)}</td>
                      <td className={`text-right px-2 font-bold ${r.ok ? 'text-emerald-600' : 'text-rose-500'}`}>{man(r.final)}</td>
                      <td className="text-center px-2">{r.ok ? <span className="text-emerald-600">성공</span> : <span className="text-rose-500">실패</span>}</td>
                      <td className="text-right px-2 text-gray-500">{r.ok ? '달성' : `${r.needSelf}건 필요`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] text-gray-400 mb-2">CRM 매출 관리의 실제 매출을 그대로 가져와 같은 계산식에 넣은 결과입니다 · 이번 달은 아직 진행 중이라 지금까지 기준</p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full min-w-[640px] text-[12px] tabular-nums">
                <thead>
                  <tr className="text-gray-400 text-[11px] border-b border-gray-100">
                    <th className="text-left font-medium py-2 px-2">월</th>
                    <th className="text-right font-medium px-2">영업 매출<span className="text-gray-300"> (환산)</span></th>
                    <th className="text-right font-medium px-2">관리 매출</th>
                    <th className="text-right font-medium px-2">총 매출</th>
                    <th className="text-right font-medium px-2">남은돈</th>
                    <th className="text-right font-medium px-2">이러면 남은돈</th>
                    <th className="text-center font-medium px-2">결과</th>
                    <th className="text-right font-medium px-2">내가 더</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRowsExact.map(x => {
                    const perSelf = asm.unit * (1 - asm.taxRate)
                    const need = x.final < 0 && perSelf > 0 ? Math.ceil(-x.final / perSelf) : 0
                    return (
                      <tr key={x.key} className={`border-b border-gray-50 ${x.cur ? 'bg-[#b8995a]/15 font-bold' : ''}`}>
                        <td className="py-2 px-2 text-[#0b2140]">{x.label}{x.cur && <span className="ml-1 text-[10px] text-[#a8873f]">지금까지</span>}</td>
                        <td className="text-right px-2">{man(x.sales)}<span className="text-gray-300 text-[10px]"> ({x.n.toFixed(1)}건)</span></td>
                        <td className="text-right px-2">{man(x.ops)}</td>
                        <td className="text-right px-2">{man(x.rev)}</td>
                        <td className="text-right px-2">{man(x.left)}</td>
                        <td className={`text-right px-2 font-bold ${x.ok ? 'text-emerald-600' : 'text-rose-500'}`}>{man(x.final)}</td>
                        <td className="text-center px-2">{x.ok ? <span className="text-emerald-600">성공</span> : <span className="text-rose-500">실패</span>}</td>
                        <td className="text-right px-2 text-gray-500">{x.ok ? '달성' : `${need}건 필요`}</td>
                      </tr>
                    )
                  })}
                  {monthRowsExact.length === 0 && <tr><td colSpan={8} className="text-center text-gray-400 py-8">아직 매출 데이터가 없습니다</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ═══ ③ 대출 상환 계획 ═══ */}
      <section className={cardCls}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-[#0b2140]">대출 상환 계획</h2>
          <span className="text-[10px] text-gray-400">위 시뮬레이터와 연동 · 대출 정보는 개인재무 탭</span>
        </div>

        {planLoans.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">개인재무 탭에 대출을 등록하면 여기에 상환 계획이 짜집니다.</p>
        ) : (
          <>
            {/* 연동 설명 + 조작 */}
            <div className="mt-3 rounded-xl bg-[#0b2140]/[.04] border border-[#0b2140]/10 p-3.5">
              <p className="text-[12px] text-gray-600">
                지금 시뮬레이션({simN}건)의 남는 돈 <b className={plan.ok ? 'text-emerald-600' : 'text-rose-500'}>{man(plan.final)}</b>
                {plan.ok
                  ? <> 중 <b className="text-[#0b2140]">{share}%</b> 를 매달 금리 높은 대출부터 추가 상환합니다.</>
                  : <> — 여유가 없어 추가 상환은 0원입니다. 영업 <b>{plan.breakEvenN}건</b> 이상이면 추가 상환이 시작돼요.</>}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="flex items-center gap-2 text-[11px] text-gray-500">여유의
                  <input type="range" min={0} max={100} step={10} value={share} onChange={e => { setShare(parseInt(e.target.value, 10)); setExtraOverride(null) }} className="w-28 accent-[#0b2140]" />
                  <b className="text-[#0b2140] w-9">{share}%</b>
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-gray-500">또는 매달 직접
                  <NumInput value={extraOverride ?? 0} onChange={v => setExtraOverride(v > 0 ? v : null)} suffix="원" className="w-36" />
                </label>
                <span className="text-[12px] text-gray-600">→ 매달 추가 상환 <b className="text-[#0b2140] tabular-nums">{won(extra)}</b></span>
              </div>
            </div>

            {/* 결과 요약 */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { l: '현재 대출 잔액', v: man(totalBal), s: `이번 달 납부 ${won(loanMonthly)}`, c: 'text-[#0b2140]' },
                { l: '다 갚는 시점', v: extra > 0 ? payoffTxt(simPlan.payoffMonth) : payoffTxt(simBase.payoffMonth), s: extra > 0 ? `추가 상환 없이는 ${payoffTxt(simBase.payoffMonth)}` : '추가 상환 없이 (기본 일정)', c: 'text-[#0b2140]' },
                { l: '12개월 뒤 잔액', v: man(simPlan.balances[Math.min(12, simPlan.balances.length - 1)]), s: `추가 상환 없이 ${man(simBase.balances[Math.min(12, simBase.balances.length - 1)])}`, c: 'text-[#0b2140]' },
                { l: '아끼는 이자', v: man(simBase.totalInterest - simPlan.totalInterest), s: `총 이자 ${man(simPlan.totalInterest)} (기본 ${man(simBase.totalInterest)})`, c: 'text-emerald-600' },
              ].map(t => (
                <div key={t.l} className="rounded-xl border border-gray-100 bg-white px-3 py-3">
                  <p className="text-[10px] text-gray-400">{t.l}</p>
                  <p className={`text-base md:text-lg font-black mt-0.5 leading-tight ${t.c}`}>{t.v}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{t.s}</p>
                </div>
              ))}
            </div>

            {/* 잔액 추이 그래프 */}
            <BalanceChart base={simBase.balances} plan={simPlan.balances} hasExtra={extra > 0} startCal={calNow} />

            {/* 대출별 */}
            <div className="mt-4 overflow-x-auto -mx-1">
              <table className="w-full min-w-[620px] text-[12px] tabular-nums">
                <thead>
                  <tr className="text-gray-400 text-[11px] border-b border-gray-100">
                    <th className="text-left font-medium py-2 px-2">대출</th>
                    <th className="text-right font-medium px-2">현재 잔액</th>
                    <th className="text-right font-medium px-2">금리</th>
                    <th className="text-right font-medium px-2">이번 달 납부</th>
                    <th className="text-right font-medium px-2">{phaseLabels[1] || '이후'} 월 원금</th>
                    <th className="text-right font-medium px-2">완납 예상</th>
                  </tr>
                </thead>
                <tbody>
                  {loansRaw.map(l => {
                    const pl = simPlan.perLoan.find(p => p.id === l.id)
                    return (
                      <tr key={l.id} className="border-b border-gray-50">
                        <td className="py-2 px-2 text-[#0b2140] font-semibold">{l.institution}<span className="text-gray-400 font-normal"> {l.bank}</span></td>
                        <td className="px-2"><NumInput value={balances[l.id] ?? l.amount} onChange={v => setBalances(b => ({ ...b, [l.id]: v }))} className="w-32 float-right" /></td>
                        <td className="text-right px-2">{l.rate}%</td>
                        <td className="text-right px-2">{won(monthlyOf(l))}</td>
                        <td className="text-right px-2">{won(l.p2_same ? l.p1_principal : l.p2_principal)}</td>
                        <td className="text-right px-2 text-gray-600">{pl?.payoffMonth != null ? payoffTxt(pl.payoffMonth) : `${man(pl?.endBalance || 0)} 남음`}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">잔액은 원금 기준으로 시작하며 직접 고치면 저장됩니다 · 거치 기간({phaseLabels[0] || '미설정'})은 이자만 내고 이후 원금을 나눠 갚는 것으로 계산 · 중도상환수수료는 반영하지 않았습니다</p>

            {/* 모으는 돈 */}
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-[#b8995a]/10 border border-[#b8995a]/25 px-3 py-3">
                <p className="text-[10px] text-[#a8873f] font-semibold">💍 결혼 모을돈</p>
                <p className="text-base font-black text-[#a8873f] mt-0.5">매달 {man(asm.marry)}</p>
                <p className="text-[10px] text-gray-500">12개월 뒤 {man(asm.marry * 12)}</p>
              </div>
              <div className="rounded-xl bg-[#0b2140]/[.05] border border-[#0b2140]/10 px-3 py-3">
                <p className="text-[10px] text-[#0b2140]/70 font-semibold">🏢 사무실 확장 모을돈</p>
                <p className="text-base font-black text-[#0b2140] mt-0.5">매달 {man(asm.expand)}</p>
                <p className="text-[10px] text-gray-500">12개월 뒤 {man(asm.expand * 12)}</p>
              </div>
            </div>

            {/* 월별 일정 */}
            <button type="button" onClick={() => setShowRows(v => !v)} className="mt-4 text-[11px] font-semibold text-[#0b2140] underline underline-offset-2">
              {showRows ? '월별 상환 일정 접기 ▲' : '월별 상환 일정 보기 ▼ (12개월)'}
            </button>
            {showRows && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[420px] text-[12px] tabular-nums">
                  <thead><tr className="text-gray-400 text-[11px] border-b border-gray-100">
                    <th className="text-left font-medium py-1.5 px-2">월</th><th className="text-right font-medium px-2">기본 납부(원금+이자)</th>
                    <th className="text-right font-medium px-2">추가 상환</th><th className="text-right font-medium px-2">남은 잔액</th></tr></thead>
                  <tbody>
                    {simPlan.rows.slice(0, 12).map(r => (
                      <tr key={r.t} className="border-b border-gray-50">
                        <td className="py-1.5 px-2 text-[#0b2140]">{r.label}</td><td className="text-right px-2">{won(r.scheduled)}</td>
                        <td className="text-right px-2 text-emerald-600">{r.extra ? won(r.extra) : '-'}</td><td className="text-right px-2">{won(r.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* ═══ 가정값 ═══ */}
      <section className={cardCls}>
        <button type="button" onClick={() => setShowAsm(v => !v)} className="w-full flex items-center justify-between">
          <span className="text-sm font-bold text-[#0b2140]">계산에 쓰는 값 (고치면 자동 저장)</span>
          <span className="text-xs text-gray-400">{showAsm ? '▲' : '▼'}</span>
        </button>
        {showAsm && (
          <div className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[12px]">
            {([
              ['unit', '계약 1건당 매출', '원'], ['opsBase', '관리팀 기본급', '원'], ['digBase', '발굴팀 기본급', '원'],
              ['rent', '사무실 임대료', '원'], ['extraInterest', '기타 이자·할부 (대출 현황 밖)', '원'], ['card', '카드값', '원'], ['living', '월세', '원'],
              ['marry', '결혼 모을돈 (월)', '원'], ['expand', '사무실 확장 모을돈 (월)', '원'],
            ] as [keyof Assumptions, string, string][]).map(([k, l, u]) => (
              <label key={k} className="flex items-center justify-between gap-3"><span className="text-gray-600">{l}</span><NumInput value={asm[k]} onChange={v => setA(k, v)} suffix={u} className="w-44" /></label>
            ))}
            {([['salesRate', '영업팀 인건비율'], ['opsRate', '관리팀 인건비율'], ['taxRate', '세금']] as [keyof Assumptions, string][]).map(([k, l]) => (
              <label key={k} className="flex items-center justify-between gap-3"><span className="text-gray-600">{l}</span>
                <span className="inline-flex items-center gap-1 w-44"><input inputMode="decimal" value={rate(asm[k])} onChange={e => setA(k, (parseFloat(e.target.value) || 0) / 100)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-right tabular-nums focus:outline-none" /><span className="text-[11px] text-gray-400">%</span></span></label>
            ))}
            <p className="sm:col-span-2 text-[10px] text-gray-400">대출 월 납부 {won(loanMonthly)} 은 개인재무 탭의 대출 현황에서 자동으로 가져옵니다. 기타 이자·할부는 그 밖에 나가는 금액입니다.</p>
            <button type="button" onClick={() => setAsm({ ...DEFAULT_ASM })} className="sm:col-span-2 text-left text-[11px] text-gray-400 underline">기본값으로 되돌리기</button>
          </div>
        )}
      </section>

      {/* 예전 플래너 */}
      <div className="text-center">
        <button type="button" onClick={() => setShowOld(v => !v)} className="text-[11px] text-gray-400 underline">{showOld ? '예전 플래너 닫기' : '예전 플래너 보기'}</button>
      </div>
      {showOld && <OldPlanner h={oldH} setH={setOldH} />}
    </div>
  )
}

function OldPlanner({ h, setH }: { h: number; setH: (n: number) => void }) {
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.data?.type === 'planner-h' && typeof e.data.h === 'number') setH(Math.max(600, Math.ceil(e.data.h) + 8))
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [setH])
  return <iframe src="/api/planner/page" title="예전 플래너" style={{ width: '100%', height: h, border: 0, display: 'block', background: 'transparent' }} />
}

// 대출 잔액이 줄어드는 모양 (기본 일정 vs 추가 상환 반영)
function BalanceChart({ base, plan, hasExtra, startCal }: { base: number[]; plan: number[]; hasExtra: boolean; startCal: number }) {
  const W = 600, H = 170, P = { l: 44, r: 10, t: 10, b: 22 }
  const n = Math.max(base.length, plan.length, 2)
  const maxV = Math.max(1, base[0] || 0, plan[0] || 0)
  const x = (i: number) => P.l + (i / (n - 1)) * (W - P.l - P.r)
  const y = (v: number) => P.t + (1 - v / maxV) * (H - P.t - P.b)
  const line = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ticks = [0, 0.5, 1]
  const labelAt = (i: number) => { const c = startCal + i; return `${String(Math.floor(c / 12)).slice(2)}.${String((c % 12) + 1).padStart(2, '0')}` }
  const xt = [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1]
  return (
    <div className="mt-4 rounded-xl border border-gray-100 p-3">
      <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-1">
        <span className="flex items-center gap-1"><i className="w-3 h-0.5 bg-gray-400 inline-block" />기본 일정</span>
        {hasExtra && <span className="flex items-center gap-1"><i className="w-3 h-0.5 bg-[#b8995a] inline-block" />추가 상환 반영</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="대출 잔액 추이">
        {ticks.map(t => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(maxV * t)} y2={y(maxV * t)} stroke="#eef0f4" strokeDasharray="3 3" />
            <text x={P.l - 6} y={y(maxV * t) + 3} textAnchor="end" fontSize="9" fill="#9aa4b5">{Math.round((maxV * t) / 10000).toLocaleString()}만</text>
          </g>
        ))}
        {xt.map(i => <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#9aa4b5">{labelAt(i)}</text>)}
        <path d={line(base)} fill="none" stroke="#9aa4b5" strokeWidth="2" strokeLinejoin="round" />
        {hasExtra && <path d={line(plan)} fill="none" stroke="#b8995a" strokeWidth="2.5" strokeLinejoin="round" />}
      </svg>
    </div>
  )
}
