'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MonthPnl } from '@/lib/pnlCalc'
import { analyze, won, man, monthLabel, type Analysis } from '@/lib/pnlAnalysis'

const NAVY = '#0b2140'
const GOLD = '#b8995a'
const GREEN = '#12805c'
const RED = '#c0392b'

const delta = (cur: number, prev: number | undefined) => {
  if (prev == null || prev === 0) return null
  return (cur - prev) / Math.abs(prev)
}
const pct = (v: number | null, d = 0) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`)

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 ${className}`}>{children}</div>
}
function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
      <div>
        <h3 className="text-[17px] font-black text-[#0b2140]">{title}</h3>
        {sub && <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

// ── 작은 추이선 ──
function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-8" />
  const w = 120, h = 32, mx = Math.max(...values), mn = Math.min(...values)
  const rng = mx - mn || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - ((v - mn) / rng) * (h - 8)}`).join(' ')
  const last = pts.split(' ').slice(-1)[0].split(',')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  )
}

// ── 월별 추이 차트: 막대(영업/관리 매출) + 선(순이익) ──
function TrendChart({ months, selected, currentYm, onSelect }: { months: MonthPnl[]; selected: string; currentYm: string; onSelect: (ym: string) => void }) {
  const W = 760, H = 310, L = 54, R = 14, T = 26, B = 40
  const iw = W - L - R, ih = H - T - B
  const maxRev = Math.max(1, ...months.map(m => m.totalRev))
  const minNet = Math.min(0, ...months.map(m => m.net))
  // 눈금은 보기 좋은 단위(1·2·5 × 10^n)로 맞춘다
  const rawMax = maxRev * 1.12, rawMin = minNet * 1.2
  const stepRaw = (rawMax - rawMin) / 4
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(stepRaw, 1))))
  const fr = stepRaw / pow
  const niceStep = (fr <= 1 ? 1 : fr <= 2 ? 2 : fr <= 5 ? 5 : 10) * pow
  const yMin = Math.min(0, rawMin)   // 적자가 없으면 0에서 시작, 적자가 있으면 그만큼만 아래로
  const yMax = Math.ceil(rawMax / niceStep) * niceStep
  const y = (v: number) => T + ih * (1 - (v - yMin) / (yMax - yMin))
  const step = iw / months.length
  const bw = Math.min(46, step * 0.52)
  const cx = (i: number) => L + step * i + step / 2
  const ticks: number[] = []
  for (let t = Math.ceil(yMin / niceStep) * niceStep; t <= yMax + niceStep / 2; t += niceStep) ticks.push(t)
  const netPts = months.map((m, i) => `${cx(i)},${y(m.net)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none">
      <defs>
        <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#243b6b" /><stop offset="1" stopColor={NAVY} /></linearGradient>
        <linearGradient id="gOps" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e6d4a3" /><stop offset="1" stopColor={GOLD} /></linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#eef0f4" strokeDasharray={Math.abs(t) < 1 ? '0' : '4 4'} />
          <text x={L - 8} y={y(t) + 3.5} textAnchor="end" fontSize="12" fill="#9aa3b2">{Math.abs(t) < 1 ? '0' : man(t)}</text>
        </g>
      ))}
      {yMin < 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#cbd2de" />}
      {months.map((m, i) => {
        const partial = m.quality === 'partial'
        const cur = m.ym === currentYm
        const sel = m.ym === selected
        const x0 = cx(i) - bw / 2
        const sH = Math.max(0, y(0) - y(m.salesRev)), oH = Math.max(0, y(0) - y(m.opsRev))
        return (
          <g key={m.ym} style={{ cursor: 'pointer' }} onClick={() => onSelect(m.ym)} opacity={partial ? 0.45 : 1}>
            {sel && <rect x={cx(i) - step / 2 + 3} y={T - 8} width={step - 6} height={ih + 12} rx="10" fill={GOLD} opacity="0.10" />}
            <rect x={x0} y={y(0) - sH} width={bw} height={sH} fill="url(#gSales)" rx="3" strokeDasharray={cur ? '4 3' : undefined} stroke={cur ? NAVY : undefined} />
            <rect x={x0} y={y(0) - sH - oH} width={bw} height={oH} fill="url(#gOps)" rx="3" strokeDasharray={cur ? '4 3' : undefined} stroke={cur ? GOLD : undefined} />
            <text x={cx(i)} y={y(m.totalRev) - 7} textAnchor="middle" fontSize="12.5" fill="#6b7280" fontWeight="600">{man(m.totalRev)}</text>
            <text x={cx(i)} y={H - 20} textAnchor="middle" fontSize="13" fill={sel ? NAVY : '#6b7280'} fontWeight={sel ? 800 : 500}>{monthLabel(m.ym)}</text>
            {(cur || partial) && <text x={cx(i)} y={H - 7} textAnchor="middle" fontSize="11" fill="#9aa3b2">{cur ? '진행중' : '불완전'}</text>}
          </g>
        )
      })}
      <polyline points={netPts} fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {months.map((m, i) => (
        <g key={m.ym + 'n'} opacity={m.quality === 'partial' ? 0.5 : 1} style={{ pointerEvents: 'none' }}>
          <circle cx={cx(i)} cy={y(m.net)} r="4.5" fill="#fff" stroke={m.net >= 0 ? GREEN : RED} strokeWidth="2.5" />
          <text x={cx(i)} y={y(m.net) + (m.net >= 0 ? 17 : -9)} textAnchor="middle" fontSize="12.5" fontWeight="800" fill={m.net >= 0 ? GREEN : RED}
            stroke="#fff" strokeWidth="3" paintOrder="stroke">{man(m.net)}</text>
        </g>
      ))}
    </svg>
  )
}

// ── 돈의 흐름 (매출 → 순이익 → 실수령) ──
function Flow({ m }: { m: MonthPnl }) {
  const rev = Math.max(1, m.totalRev)
  type Row = { label: string; v: number; kind: 'total' | 'minus'; color: string; note?: string }
  const rows: Row[] = [
    { label: '매출', v: m.totalRev, kind: 'total', color: NAVY, note: `영업 ${man(m.salesRev)} + 관리 ${man(m.opsRev)}` },
    { label: '세금 적립 (매출의 10%)', v: m.tax, kind: 'minus', color: '#d97706', note: '종소세·부가세 대비 보유 권장액' },
    { label: '영업팀 인건비', v: m.labor.sales, kind: 'minus', color: '#3b5b9a' },
    { label: '관리팀 인건비', v: m.labor.ops, kind: 'minus', color: '#7a6a3a' },
    { label: '발굴팀 인건비', v: m.labor.dig, kind: 'minus', color: '#6b7a99' },
    { label: 'DB 매입비', v: m.costs.db, kind: 'minus', color: '#8b5cf6', note: '공급받는 DB 구입 (매입)' },
    { label: '임대·관리비', v: m.costs.rent + m.costs.mgmt, kind: 'minus', color: '#64748b' },
    { label: '고정비·기타', v: m.costs.fixed + m.costs.extra, kind: 'minus', color: '#94a3b8' },
    { label: '순이익', v: m.net, kind: 'total', color: m.net >= 0 ? GREEN : RED, note: '매출 − 세금적립 − 인건비 − 운영비' },
    { label: '개인 지출', v: m.personal.card + m.personal.rent, kind: 'minus', color: '#94a3b8', note: '카드·월세 등 대표 개인 지출' },
    { label: '대표 실수령', v: m.takeHome, kind: 'total', color: m.takeHome >= 0 ? NAVY : RED },
  ]
  let remaining = m.totalRev
  return (
    <div className="space-y-1.5">
      {rows.map(r => {
        let left = 0, width = 0
        if (r.kind === 'total') { width = Math.max(0, r.v) / rev * 100; left = 0; remaining = r.v }
        else { remaining -= r.v; left = Math.max(0, remaining) / rev * 100; width = Math.min(r.v / rev * 100, 100 - left) }
        const strong = r.kind === 'total'
        return (
          <div key={r.label} className={`flex items-center gap-3 ${strong ? 'py-1.5 border-y border-gray-100 bg-gray-50/60 -mx-2 px-2 rounded-lg' : ''}`}>
            <div className="w-[128px] md:w-[170px] shrink-0">
              <p className={`text-[13px] ${strong ? 'font-black text-[#0b2140]' : 'text-gray-600'}`}>{strong ? '' : '− '}{r.label}</p>
              {r.note && <p className="text-[13px] text-gray-400 leading-tight hidden md:block">{r.note}</p>}
            </div>
            <div className="flex-1 h-5 bg-gray-100/70 rounded-md relative overflow-hidden">
              <div className="absolute top-0 bottom-0 rounded-md transition-all duration-700" style={{ left: `${left}%`, width: `${Math.max(width, r.v ? 0.6 : 0)}%`, background: r.color, opacity: strong ? 1 : 0.85 }} />
            </div>
            <div className="w-[108px] md:w-[130px] shrink-0 text-right">
              <p className={`text-[12.5px] tabular-nums ${strong ? 'font-black' : 'font-semibold'}`} style={{ color: strong ? r.color : '#374151' }}>{won(r.v)}</p>
              <p className="text-[13px] text-gray-400 tabular-nums">{m.totalRev > 0 ? pct(r.v / rev, 1) : ''}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 팀별 카드 ──
function TeamCard({ title, color, t, push, unit }: { title: string; color: string; t: Analysis['sales']; push: boolean; unit: string }) {
  const ok = t.gap >= 0
  const maxBar = Math.max(t.avgRev, t.breakEven) * 1.15 || 1
  return (
    <div className={`rounded-2xl border p-5 ${push ? 'border-[#b8995a] bg-[#b8995a]/[.05] shadow-[0_8px_24px_-14px_rgba(184,153,90,.7)]' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: color }} />
          <h4 className="font-black text-[#0b2140]">{title}</h4>
        </div>
        {push && <span className="text-[13px] font-black px-2 py-1 rounded-full bg-[#0b2140] text-[#E8D080]">{ok ? '키우면 이득이 큰 곳' : '지금 우선 점검'}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-[12.5px] text-gray-400">최근 월 평균 매출</p>
          <p className="text-lg font-black text-[#0b2140] tabular-nums">{man(t.avgRev)}</p>
        </div>
        <div>
          <p className="text-[12.5px] text-gray-400">본전 매출 (월)</p>
          <p className="text-lg font-black tabular-nums" style={{ color: GOLD }}>{man(t.breakEven)}</p>
        </div>
      </div>
      <div className="relative h-3 rounded-full bg-gray-100 mb-1.5">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (t.avgRev / maxBar) * 100)}%`, background: ok ? GREEN : RED }} />
        <div className="absolute -top-1 bottom-[-4px] w-[3px] rounded bg-[#0b2140]" style={{ left: `${(t.breakEven / maxBar) * 100}%` }} title="본전 라인" />
      </div>
      <p className="text-[12.5px] mb-3" style={{ color: ok ? GREEN : RED }}>
        <b>{ok ? `본전 대비 ${man(t.gap)} 여유` : `본전까지 ${man(-t.gap)} 부족`}</b>
        <span className="text-gray-400"> · 본전 달성률 {pct(t.coverage)}</span>
      </p>
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <p className="text-[12.5px] text-gray-400">매출 +100만 원이면</p>
          <p className="text-sm font-black text-[#0b2140]">순이익 +{Math.round(t.margin * 100)}만 원</p>
          <p className="text-[13px] text-gray-400 leading-tight mt-0.5">{unit}</p>
        </div>
        <div>
          <p className="text-[12.5px] text-gray-400 mb-0.5">최근 매출 흐름</p>
          <Spark values={t.last6} color={color} />
        </div>
      </div>
    </div>
  )
}

export default function RevenueAnalytics({ data }: { data: any }) {
  const [months, setMonths] = useState<MonthPnl[]>([])
  const [currentYm, setCurrentYm] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [selected, setSelected] = useState('')
  const [target, setTarget] = useState(10_000_000)

  useEffect(() => {
    try { const v = Number(localStorage.getItem('hc_target_profit')); if (v > 0) setTarget(v) } catch { /* 저장값 없음 */ }
    fetch('/api/analytics/pnl').then(r => r.json()).then(d => {
      if (d.error) { setErr(d.error); return }
      setMonths(d.months || []); setCurrentYm(d.currentMonth || '')
      const done = (d.months || []).filter((m: MonthPnl) => m.quality === 'ok' && m.ym !== d.currentMonth)
      setSelected((done[done.length - 1] || (d.months || [])[(d.months || []).length - 1] || {}).ym || '')
    }).catch(() => setErr('데이터를 불러오지 못했습니다.')).finally(() => setLoading(false))
  }, [])
  const saveTarget = (v: number) => { setTarget(v); try { localStorage.setItem('hc_target_profit', String(v)) } catch { /* 저장 불가 */ } }

  const a = useMemo(() => analyze(months, currentYm), [months, currentYm])

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
  if (err) return <div className="text-center py-16 text-red-500 text-sm">{err}</div>
  if (months.length === 0) return <div className="text-center py-16 text-gray-400 text-sm">급여·손익 탭에 저장된 월별 기록이 없어 분석할 수 없습니다.</div>

  const sel = months.find(m => m.ym === selected) || months[months.length - 1]
  const idx = months.findIndex(m => m.ym === sel.ym)
  const prev = idx > 0 ? months[idx - 1] : undefined
  const cur = months.find(m => m.ym === currentYm)
  const doneCount = a.done.length
  const sDef = a.sales.gap < 0, oDef = a.ops.gap < 0
  const growTeam = a.sales.margin >= a.ops.margin ? '영업팀' : '관리팀'

  const trendMeta = {
    growing: { label: '잘 크고 있어요', icon: '📈', tone: 'from-[#0f3b2f] to-[#0a1f1a]', chip: '#7ee0b5' },
    flat: { label: '제자리예요', icon: '➖', tone: 'from-[#10203a] to-[#0a1424]', chip: '#E8D080' },
    declining: { label: '주의가 필요해요', icon: '📉', tone: 'from-[#4a1717] to-[#220b0b]', chip: '#ff9b9b' },
    unknown: { label: '아직 비교할 달이 부족해요', icon: '…', tone: 'from-[#10203a] to-[#0a1424]', chip: '#E8D080' },
  }[a.trend]

  const cost = (m: MonthPnl) => m.tax + m.labor.total + m.costs.total
  const kpis = [
    { label: '들어온 돈', v: sel.totalRev, d: delta(sel.totalRev, prev?.totalRev), good: 'up' as const },
    { label: '나간 돈', v: cost(sel), d: delta(cost(sel), prev ? cost(prev) : undefined), good: 'down' as const },
    { label: '남은 돈', v: sel.net, d: delta(sel.net, prev?.net), good: 'up' as const, strong: true },
    { label: '내 몫', v: sel.takeHome, d: delta(sel.takeHome, prev?.takeHome), good: 'up' as const },
  ]

  // 목표 계산
  const totalRevAvg = a.sales.avgRev + a.ops.avgRev
  const vTotal = totalRevAvg > 0 ? (a.sales.avgRev * a.sales.varRate + a.ops.avgRev * a.ops.varRate) / totalRevAvg : 0.35
  const reqTotal = (a.fixedTotal + target) / Math.max(0.05, 1 - vTotal)
  const sShare = totalRevAvg > 0 ? a.sales.avgRev / totalRevAvg : 0.5
  const reqSales = reqTotal * sShare, reqOps = reqTotal * (1 - sShare)
  const dProfit = target - a.avgNet
  const onlySales = dProfit > 0 ? dProfit / a.sales.margin : 0
  const onlyOps = dProfit > 0 ? dProfit / a.ops.margin : 0

  // 이번 달 진행
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000)
  const dayNow = kstNow.getUTCDate(), dim = new Date(kstNow.getUTCFullYear(), kstNow.getUTCMonth() + 1, 0).getDate()
  const projected = cur && dayNow > 0 ? cur.totalRev / (dayNow / dim) : 0

  // 세금
  const thisYr: number = data?.thisYear ?? new Date().getFullYear()
  const annual = (data?.annualRevenue || {})[String(thisYr)] || { sales: 0, ops: 0, total: 0 }
  const h2 = kstNow.getUTCMonth() >= 6
  const vat = h2 ? data?.vatCurrH2 : data?.vatCurrH1
  const vatPeriod = h2 ? `${thisYr}년 7~12월` : `${thisYr}년 1~6월`
  const vatDue = h2 ? `${thisYr + 1}년 1월 25일` : `${thisYr}년 7월 25일`

  // 한 줄 결론
  const headline = sDef && oDef ? '두 팀 모두 아직 본전 아래예요. 둘 다 끌어올려야 해요.'
    : sDef ? `영업팀이 본전(월 ${man(a.sales.breakEven)})에 못 미쳐요. 영업팀을 먼저 챙기세요.`
    : oDef ? `관리팀이 본전(월 ${man(a.ops.breakEven)})에 못 미쳐요. 관리팀을 먼저 챙기세요.`
    : `두 팀 모두 본전은 넘었어요. 더 남기려면 ${growTeam}을 키우는 게 유리해요.`

  const TeamRow = ({ title, color, t, unit }: { title: string; color: string; t: Analysis['sales']; unit: string }) => {
    const ok = t.gap >= 0
    const maxBar = Math.max(t.avgRev, t.breakEven) * 1.15 || 1
    return (
      <div>
        <div className="flex items-end justify-between mb-1.5">
          <p className="text-[15px] font-black text-[#0b2140] flex items-center gap-2"><i className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />{title}</p>
          <p className="text-[13px] font-black" style={{ color: ok ? GREEN : RED }}>{ok ? `본전 넘음 · ${man(t.gap)} 여유` : `본전까지 ${man(-t.gap)} 부족`}</p>
        </div>
        <div className="relative h-4 rounded-full bg-gray-100">
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (t.avgRev / maxBar) * 100)}%`, background: ok ? GREEN : RED }} />
          <div className="absolute -top-1.5 -bottom-1.5 w-[3px] rounded bg-[#0b2140]" style={{ left: `${(t.breakEven / maxBar) * 100}%` }} />
        </div>
        <div className="flex justify-between text-[12.5px] text-gray-500 mt-1.5">
          <span>요즘 월 평균 <b className="text-[#0b2140]">{man(t.avgRev)}</b></span>
          <span>본전 <b className="text-[#0b2140]">월 {man(t.breakEven)}</b>{unit && <span className="text-gray-400"> · {unit}</span>}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── 1. 한눈에: 지금 어떤 상태인가 ── */}
      <div className={`rounded-3xl p-6 md:p-8 text-white bg-gradient-to-br ${trendMeta.tone} shadow-[0_24px_50px_-28px_rgba(11,33,64,.8)]`}>
        <h2 className="text-2xl md:text-[28px] font-black">{trendMeta.icon} {trendMeta.label}</h2>
        {doneCount >= 2 && <p className="text-[14px] text-white/75 mt-2">최근 {Math.min(3, doneCount)}개월 평균, 한 달에 <b className="text-white">{man(a.avgRev)}</b> 벌고 <b style={{ color: trendMeta.chip }}>{man(a.avgNet)}</b> 남겨요.</p>}

        <div className="flex flex-wrap gap-1.5 mt-5 mb-3">
          {months.slice().reverse().map(m => (
            <button key={m.ym} onClick={() => setSelected(m.ym)}
              className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-bold border transition-all ${m.ym === sel.ym ? 'bg-[#C5A258] text-[#0b1220] border-[#C5A258]' : 'bg-white/5 text-white/70 border-white/15 hover:bg-white/10'}`}>
              {monthLabel(m.ym)}{m.ym === currentYm ? ' (진행중)' : m.quality === 'partial' ? ' *' : ''}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map(k => {
            const good = k.d == null ? null : (k.good === 'up' ? k.d >= 0 : k.d <= 0)
            return (
              <div key={k.label} className={`rounded-2xl px-4 py-4 ${k.strong ? 'bg-white/[.14] border border-white/25' : 'bg-white/[.07]'}`}>
                <p className="text-[13px] text-white/65 font-semibold">{k.label}</p>
                <p className={`text-[26px] md:text-[30px] leading-tight font-black mt-1 tabular-nums ${k.strong ? (k.v >= 0 ? 'text-[#7ee0b5]' : 'text-[#ff9b9b]') : ''}`}>{man(k.v)}</p>
                {k.d != null && <p className={`text-[12.5px] font-bold mt-1 ${good ? 'text-[#7ee0b5]' : 'text-[#ff9b9b]'}`}>지난달보다 {k.d >= 0 ? '▲' : '▼'}{Math.abs(k.d * 100).toFixed(0)}%</p>}
              </div>
            )
          })}
        </div>
        {(sel.ym === currentYm || sel.quality === 'partial') && (
          <p className="text-[12px] text-white/50 mt-3">{sel.ym === currentYm ? '이번 달은 아직 진행 중이라 급여·비용이 덜 들어와 있어요.' : `이 달은 ${sel.partialReason}`}</p>
        )}
      </div>

      {/* ── 2. 달마다 얼마 벌고 얼마 남았나 ── */}
      <Card>
        <SectionTitle title="달마다 얼마 벌고, 얼마 남았나"
          right={<div className="flex items-center gap-3 text-[12.5px] text-gray-500">
            <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: NAVY }} />영업팀</span>
            <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded-sm" style={{ background: GOLD }} />관리팀</span>
            <span className="flex items-center gap-1.5"><i className="w-4 h-0.5 rounded" style={{ background: GREEN }} />남은 돈</span>
          </div>} />
        <TrendChart months={months} selected={sel.ym} currentYm={currentYm} onSelect={setSelected} />
      </Card>

      {/* ── 3. 어느 팀이 더 해야 하나 ── */}
      <Card>
        <SectionTitle title="어느 팀이 더 해야 하나요?" sub="본전 = 그 팀이 자기 몫의 월급·고정비·세금을 내고도 손해가 나지 않는 월 매출" />
        {doneCount >= 1 ? (
          <div className="space-y-6">
            <p className="text-[15px] font-black text-[#0b2140] bg-[#b8995a]/10 border border-[#b8995a]/30 rounded-2xl px-4 py-3">👉 {headline}</p>
            <TeamRow title="영업팀" color={NAVY} t={a.sales} unit={a.avgContractValue > 0 ? `계약 월 ${Math.max(0, Math.ceil(a.sales.breakEven / a.avgContractValue))}건` : ''} />
            <TeamRow title="관리팀" color={GOLD} t={a.ops} unit={a.avgOpsFee > 0 ? `수수료 월 ${Math.max(0, Math.ceil(a.ops.breakEven / a.avgOpsFee))}건` : ''} />
          </div>
        ) : <p className="text-sm text-gray-400 text-center py-6">입력이 끝난 달이 없어 계산할 수 없어요.</p>}
      </Card>

      {/* ── 4. 더 남기려면 ── */}
      {doneCount >= 1 && (
        <Card>
          <SectionTitle title="한 달에 얼마 남기고 싶으세요?" />
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            <div className="relative">
              <input type="text" inputMode="numeric" value={Math.round(target / 10000).toLocaleString('ko-KR')}
                onChange={e => { const v = Number(e.target.value.replace(/[^0-9]/g, '')); if (v >= 0) saveTarget(v * 10000) }}
                className="w-40 border-[1.5px] border-gray-200 rounded-2xl pl-3 pr-12 py-2.5 text-right text-lg font-black text-[#0b2140] focus:outline-none focus:border-[#b8995a]" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">만원</span>
            </div>
            {[500, 1000, 1500, 2000].map(v => (
              <button key={v} onClick={() => saveTarget(v * 10000)} className={`px-3.5 py-2 rounded-full text-[12.5px] font-bold border ${target === v * 10000 ? 'bg-[#0b2140] text-white border-[#0b2140]' : 'text-gray-500 border-gray-200 hover:border-gray-400'}`}>{v.toLocaleString()}만</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-gray-50 py-4 px-2">
              <p className="text-[12.5px] text-gray-500">한 달 매출</p>
              <p className="text-[22px] md:text-[26px] font-black text-[#0b2140] tabular-nums leading-tight">{man(reqTotal)}</p>
              <p className="text-[12px] font-bold mt-0.5" style={{ color: reqTotal > a.avgRev ? RED : GREEN }}>{reqTotal > a.avgRev ? `지금보다 ${man(reqTotal - a.avgRev)} 더` : '지금도 가능'}</p>
            </div>
            <div className="rounded-2xl py-4 px-2" style={{ background: 'rgba(11,33,64,.05)' }}>
              <p className="text-[12.5px] text-gray-500">영업팀 목표</p>
              <p className="text-[22px] md:text-[26px] font-black tabular-nums leading-tight" style={{ color: NAVY }}>{man(reqSales)}</p>
              <p className="text-[12px] text-gray-500 mt-0.5">{a.avgContractValue > 0 ? `계약 ${Math.ceil(reqSales / a.avgContractValue)}건` : ''}</p>
            </div>
            <div className="rounded-2xl py-4 px-2" style={{ background: 'rgba(184,153,90,.12)' }}>
              <p className="text-[12.5px] text-gray-500">관리팀 목표</p>
              <p className="text-[22px] md:text-[26px] font-black tabular-nums leading-tight" style={{ color: '#a8873f' }}>{man(reqOps)}</p>
              <p className="text-[12px] text-gray-500 mt-0.5">{a.avgOpsFee > 0 ? `수수료 ${Math.ceil(reqOps / a.avgOpsFee)}건` : ''}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── 자세히 (평소엔 접어둠) ── */}
      <details className="group bg-white rounded-2xl border border-gray-100 shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[15px] font-black text-[#0b2140]">자세히 보기</p>
            <p className="text-[12.5px] text-gray-400 mt-0.5">월별 표 · 돈이 어디로 나갔나 · 팀별 분석 · 세금</p>
          </div>
          <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="px-5 pb-6 space-y-8">
          <div>
            <p className="text-[14px] font-black text-[#0b2140] mb-3">{monthLabel(sel.ym)} 돈이 어디로 나갔나</p>
            <Flow m={sel} />
          </div>

          <div>
            <p className="text-[14px] font-black text-[#0b2140] mb-2">월별 표</p>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-[13px] min-w-[560px]">
                <thead>
                  <tr className="text-gray-500 text-[12px]">
                    {['월', '들어온 돈', '나간 돈', '남은 돈', '남는 비율', '지난달 대비'].map((h, i) => <th key={h} className={`px-2 py-2 font-semibold ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {months.slice().reverse().map(m => {
                    const i = months.findIndex(x => x.ym === m.ym)
                    const pv = i > 0 ? months[i - 1] : undefined
                    const d = delta(m.totalRev, pv?.totalRev)
                    return (
                      <tr key={m.ym} onClick={() => setSelected(m.ym)} className={`cursor-pointer border-t border-gray-100 ${m.ym === sel.ym ? 'bg-[#b8995a]/[.08]' : 'hover:bg-gray-50'} ${m.quality === 'partial' ? 'opacity-60' : ''}`}>
                        <td className="px-2 py-2.5 font-bold text-[#0b2140]">{monthLabel(m.ym)}{m.ym === currentYm && <span className="ml-1 text-[11px] text-[#a8873f]">진행중</span>}{m.quality === 'partial' && m.ym !== currentYm && <span className="ml-1 text-[11px] text-gray-400">불완전</span>}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums font-semibold">{man(m.totalRev)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-gray-500">{man(cost(m))}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums font-black" style={{ color: m.net >= 0 ? GREEN : RED }}>{man(m.net)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-gray-500">{pct(m.margin, 0)}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums font-semibold" style={{ color: d == null ? '#9ca3af' : d >= 0 ? GREEN : RED }}>{d == null ? '—' : `${d >= 0 ? '▲' : '▼'}${Math.abs(d * 100).toFixed(0)}%`}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {months.some(m => m.quality === 'partial') && <p className="text-[12px] text-gray-400 mt-2">* 급여 입력이 덜 된 달은 남은 돈이 실제보다 커 보여서 평균·판단에서 뺐어요.</p>}
          </div>

          {doneCount >= 1 && (
            <div>
              <p className="text-[14px] font-black text-[#0b2140] mb-3">팀별 분석</p>
              <div className="grid md:grid-cols-2 gap-4">
                <TeamCard title="영업팀" color={NAVY} t={a.sales} push={sDef || (!oDef && growTeam === '영업팀')} unit={a.avgContractValue > 0 ? `계약 1건 평균 ${man(a.avgContractValue)}` : ''} />
                <TeamCard title="관리팀" color={GOLD} t={a.ops} push={oDef || (!sDef && growTeam === '관리팀')} unit={a.avgOpsFee > 0 ? `수수료 1건 평균 ${man(a.avgOpsFee)}` : ''} />
              </div>
              <ul className="mt-4 space-y-1.5">
                {a.verdict.map((v, i) => <li key={i} className="text-[13px] text-gray-600 leading-relaxed flex gap-2"><span className="text-[#b8995a] font-black">•</span>{v}</li>)}
              </ul>
              {dProfit > 0 && (
                <p className="mt-3 text-[13px] text-gray-600 leading-relaxed rounded-2xl bg-[#b8995a]/[.07] border border-[#b8995a]/30 p-4">
                  목표({man(target)})까지 {man(dProfit)} 더 남기려면 — 영업팀만 올리면 월 <b>{man(onlySales)}</b>{a.avgContractValue > 0 && <> (계약 약 {Math.ceil(onlySales / a.avgContractValue)}건)</>}, 관리팀만 올리면 월 <b>{man(onlyOps)}</b>{a.avgOpsFee > 0 && <> (수수료 약 {Math.ceil(onlyOps / a.avgOpsFee)}건)</>} 늘려야 해요.
                </p>
              )}
              {cur && projected > 0 && (
                <p className="mt-3 text-[13px] text-gray-500">이번 달은 {dayNow}일/{dim}일 시점에 {man(cur.totalRev)}. 단순 환산하면 월말 약 {man(projected)}이에요(입금이 몰리는 구조라 참고용).</p>
              )}
            </div>
          )}

          <div>
            <p className="text-[14px] font-black text-[#0b2140] mb-1">세금</p>
            <p className="text-[12.5px] text-gray-400 mb-3">세무사 확인 전 참고용 추정치예요.</p>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
                <p className="text-[12.5px] font-bold text-teal-700">부가세 · {vatPeriod}</p>
                <p className="text-2xl font-black text-teal-800 tabular-nums mt-1">{man(vat?.total_vat || 0)}</p>
                <p className="text-[12px] text-teal-600 font-semibold mt-1">신고·납부 {vatDue}</p>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
                <p className="text-[12.5px] font-bold text-orange-700">종합소득세 · {thisYr}년 (예상)</p>
                <p className="text-2xl font-black text-orange-700 tabular-nums mt-1">{man(Math.round((annual.total || 0) * 0.1))}</p>
                <p className="text-[12px] text-orange-600 font-semibold mt-1">신고 {thisYr + 1}년 5월</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[12.5px] font-bold text-gray-600">{monthLabel(sel.ym)} 세금 적립</p>
                <p className="text-2xl font-black text-[#0b2140] tabular-nums mt-1">{man(sel.tax)}</p>
                <p className="text-[12px] text-gray-500 mt-1">매출의 10% · 남은 돈 계산에 이미 뺐어요</p>
              </div>
            </div>
          </div>
        </div>
      </details>
    </div>
  )
}
