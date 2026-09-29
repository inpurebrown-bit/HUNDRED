import React from 'react'

// ── 타입 ──────────────────────────────────────────────
export interface Item { heading: string; text: string }
export interface Section { key: string; title: string; items: Item[] }
export interface ConsultingReport {
  headline: string
  summary?: string
  keyFindings?: string[]
  riskLevel: string
  riskScore: number
  metrics: { label: string; value: string }[]
  financials?: {
    years?: { year: string; revenue: number | null; profit: number | null }[]
    debtRatio?: number | null
    debtBreakdown?: { label: string; amountWan: number }[]
    monthly?: { income?: number | null; costBreakdown?: { label: string; amountWan: number }[] }
    industryCompare?: { label: string; company: number | null; industry: number | null }[]
    comment?: string
    cashflowComment?: string
  }
  crossCheck: { item: string; incall: string; document: string; status: string }[]
  sections: Section[]
  policyFunds?: { org: string; product: string; limit: string; rate?: string; fitScore: number; timing: string; matchReason?: string; prerequisites: string; verified?: boolean; source?: string }[]
  roadmap: { startMonth?: number; endMonth?: number; track?: string; period?: string; title: string; detail: string }[]
  certifications?: { name: string; requirement: string; benefit: string; timing: string; fit: string }[]
  corpTransition?: { threshold: string; currentStatus: string; reasons: string[]; benefits: string[]; triggers?: { label: string; met: boolean | null; note: string }[] }
  marketing?: { budgetSplit?: { channel: string; pct: number; monthlyWan: number; strategy: string; kpi: string }[]; note?: string }
  swot?: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }
  outlook?: { label: string; value: string }[]
  sources?: { title: string; uri: string }[]
  generatedAt: string
  missingDocs?: string[]
}

// ── 색상/공통 ─────────────────────────────────────────
const K = {
  navy: '#1B2A45', blue: '#2563eb', sky: '#0ea5e9', teal: '#0d9488', green: '#16a34a',
  amber: '#f59e0b', orange: '#ea580c', rose: '#e11d48', violet: '#7c3aed', gray: '#64748b', line: '#e2e8f0', bg: '#f1f5f9',
}
const PALETTE = [K.blue, K.teal, K.amber, K.violet, K.rose, K.sky, K.green, K.orange]
const FONT = 'Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif'
const riskColor = (l: string) => l === '낮음' ? K.green : l === '높음' ? K.rose : K.amber
const TRACK_COLOR: Record<string, string> = { '정책자금': K.blue, '인증': K.violet, '마케팅': K.orange, '재무': K.teal }
const STATUS_BG: Record<string, [string, string]> = {
  '일치': ['#dcfce7', '#166534'], '불일치': ['#fee2e2', '#991b1b'], '확인필요': ['#fef3c7', '#92400e'],
}
const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v)
const fmtWan = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(1)}억` : `${Math.round(n).toLocaleString()}만`

// ── 페이지 셸 ─────────────────────────────────────────
function Page({ n, title, sub, company, color = K.navy, children }: {
  n: number; title: string; sub?: string; company: string; color?: string; children: React.ReactNode
}) {
  return (
    <div className="crd-page" style={{ width: 794, height: 1123, position: 'relative', background: '#fff', overflow: 'hidden', pageBreakAfter: 'always', breakAfter: 'page', fontFamily: FONT, color: '#1e293b', boxSizing: 'border-box' }}>
      <div style={{ background: `linear-gradient(90deg, ${color} 0%, ${K.blue} 100%)`, height: 78, padding: '0 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 3, opacity: .75 }}>{sub || 'BUSINESS CONSULTING PROPOSAL'}</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{title}</div>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, opacity: .25 }}>{String(n).padStart(2, '0')}</div>
      </div>
      <div style={{ padding: '20px 36px 0', boxSizing: 'border-box' }}>{children}</div>
      <div style={{ position: 'absolute', left: 36, right: 36, bottom: 18, borderTop: `1px solid ${K.line}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 9, color: K.gray }}>
        <span>HUNDRED CONSULTING · {company}</span><span>{n} / 10</span>
      </div>
    </div>
  )
}

function H({ children, color = K.navy }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontSize: 13, fontWeight: 800, color, borderLeft: `4px solid ${color}`, paddingLeft: 8, margin: '14px 0 8px' }}>{children}</div>
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ border: `1px solid ${K.line}`, borderRadius: 10, padding: 12, background: '#fff', ...style }}>{children}</div>
}
function ItemList({ items, color }: { items: Item[]; color: string }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ background: K.bg, borderRadius: 8, padding: '9px 12px', borderLeft: `4px solid ${color}` }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: K.navy }}>{it.heading}</div>
          <div style={{ fontSize: 10.5, lineHeight: 1.65, marginTop: 3, whiteSpace: 'pre-wrap', color: '#334155' }}>{it.text}</div>
        </div>
      ))}
    </div>
  )
}
const Empty = ({ h = 90 }: { h?: number }) => (
  <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11, background: K.bg, borderRadius: 8 }}>자료 미확인</div>
)

// ── 차트 ──────────────────────────────────────────────
function BarChart({ years }: { years: { year: string; revenue: number | null; profit: number | null }[] }) {
  const W = 340, Hh = 200, pad = 28
  const max = Math.max(1, ...years.flatMap(y => [y.revenue || 0, y.profit || 0]))
  const gw = (W - pad) / years.length
  return (
    <svg width={W} height={Hh} viewBox={`0 0 ${W} ${Hh}`}>
      {[0, .5, 1].map(t => <line key={t} x1={pad} x2={W} y1={Hh - 30 - (Hh - 60) * t} y2={Hh - 30 - (Hh - 60) * t} stroke={K.line} />)}
      {years.map((y, i) => {
        const x = pad + i * gw + gw * 0.15
        const bw = gw * 0.32
        const rh = ((y.revenue || 0) / max) * (Hh - 60)
        const ph = (Math.max(0, y.profit || 0) / max) * (Hh - 60)
        return (
          <g key={i}>
            <rect x={x} y={Hh - 30 - rh} width={bw} height={rh} rx={3} fill={K.blue} />
            <rect x={x + bw + 4} y={Hh - 30 - ph} width={bw} height={ph} rx={3} fill={K.teal} />
            {isNum(y.revenue) && <text x={x + bw / 2} y={Hh - 34 - rh} fontSize={9} textAnchor="middle" fill={K.navy} fontWeight={700}>{y.revenue}</text>}
            {isNum(y.profit) && <text x={x + bw * 1.5 + 4} y={Hh - 34 - ph} fontSize={9} textAnchor="middle" fill={K.teal} fontWeight={700}>{y.profit}</text>}
            <text x={x + bw + 2} y={Hh - 14} fontSize={10} textAnchor="middle" fill={K.gray}>{y.year}</text>
          </g>
        )
      })}
      <rect x={pad} y={2} width={9} height={9} fill={K.blue} rx={2} /><text x={pad + 13} y={10} fontSize={9} fill={K.gray}>매출(억)</text>
      <rect x={pad + 66} y={2} width={9} height={9} fill={K.teal} rx={2} /><text x={pad + 79} y={10} fontSize={9} fill={K.gray}>영업이익(억)</text>
    </svg>
  )
}

function Donut({ data, size = 150, unit = 'wan' }: { data: { label: string; value: number }[]; size?: number; unit?: 'wan' | 'pct' }) {
  const rows = data.filter(d => isNum(d.value) && d.value > 0)
  const total = rows.reduce((s, d) => s + d.value, 0)
  if (!total) return <Empty h={size} />
  const r = size * 0.32, c = 2 * Math.PI * r
  let acc = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        {rows.map((d, i) => {
          const dash = c * d.value / total
          const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth={size * 0.16}
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          acc += dash
          return el
        })}
        <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize={9} fill={K.gray}>합계</text>
        <text x={size / 2} y={size / 2 + 13} textAnchor="middle" fontSize={13} fontWeight={800} fill={K.navy}>{unit === 'wan' ? fmtWan(total) : `${Math.round(total)}%`}</text>
      </svg>
      <div style={{ fontSize: 10, display: 'grid', gap: 3 }}>
        {rows.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: PALETTE[i % PALETTE.length] }} />
            <span style={{ color: '#334155' }}>{d.label}</span>
            <span style={{ color: K.gray, marginLeft: 4 }}>{unit === 'wan' ? fmtWan(d.value) : `${d.value}%`} ({Math.round(d.value / total * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Gauge({ value, max = 100, label, color, text }: { value: number; max?: number; label: string; color: string; text?: string }) {
  const len = Math.PI * 70
  const ratio = Math.min(1, Math.max(0, value / max))
  return (
    <svg width={170} height={110} viewBox="0 0 170 110">
      <path d="M15 90 A70 70 0 0 1 155 90" fill="none" stroke={K.line} strokeWidth={14} strokeLinecap="round" />
      <path d="M15 90 A70 70 0 0 1 155 90" fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${len * ratio} ${len}`} />
      <text x={85} y={78} textAnchor="middle" fontSize={22} fontWeight={800} fill={color}>{text ?? value}</text>
      <text x={85} y={102} textAnchor="middle" fontSize={10} fill={K.gray}>{label}</text>
    </svg>
  )
}

function CompareBars({ rows }: { rows: { label: string; company: number | null; industry: number | null }[] }) {
  const max = Math.max(1, ...rows.flatMap(r => [Math.abs(r.company || 0), Math.abs(r.industry || 0)]))
  return (
    <div style={{ display: 'grid', gap: 9 }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div style={{ fontSize: 10, fontWeight: 700, color: K.navy, marginBottom: 3 }}>{r.label}</div>
          {[{ n: '당사', v: r.company, c: K.blue }, { n: '업종 평균', v: r.industry, c: '#94a3b8' }].map(b => (
            <div key={b.n} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <span style={{ width: 44, fontSize: 9, color: K.gray }}>{b.n}</span>
              <div style={{ flex: 1, background: K.bg, borderRadius: 4, height: 10 }}>
                <div style={{ width: `${isNum(b.v) ? Math.min(100, Math.abs(b.v) / max * 100) : 0}%`, height: 10, borderRadius: 4, background: b.c }} />
              </div>
              <span style={{ width: 42, fontSize: 9.5, fontWeight: 700, textAlign: 'right' }}>{isNum(b.v) ? b.v : '-'}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// 개인사업자(종합소득세) vs 법인(법인세) — 소득금액(과세표준) 구간별 세부담 비교. 지방소득세 10% 포함.
// 세율 기준: 소득세법 종합소득세율(6~45%), 법인세법 2026년 사업연도 이후 10/20/22/25% (국세청 안내 기준)
function personalTax(inc: number) {
  const b: [number, number, number][] = [[14e6, .06, 0], [50e6, .15, 1.26e6], [88e6, .24, 5.76e6], [150e6, .35, 15.44e6], [300e6, .38, 19.94e6], [500e6, .40, 25.94e6], [1e9, .42, 35.94e6], [Infinity, .45, 65.94e6]]
  const r = b.find(x => inc <= x[0])!
  return Math.max(0, inc * r[1] - r[2]) * 1.1
}
function corpTax(inc: number) {
  const t = inc <= 2e8 ? inc * .10 : 2e7 + (inc - 2e8) * .20
  return t * 1.1
}
function TaxCompare() {
  const levels = [3000, 5000, 8000, 10000, 15000, 20000, 30000, 50000]
  const rows = levels.map(l => { const inc = l * 1e4; const p = personalTax(inc), c = corpTax(inc); return { l, p, c, save: p - c, pr: p / inc * 100, cr: c / inc * 100 } })
  const W = 330, Hh = 170, pad = 28
  const mx = Math.max(...rows.map(r => Math.max(r.pr, r.cr)))
  const gw = (W - pad) / rows.length
  return (
    <div>
      <svg width={W} height={Hh} viewBox={`0 0 ${W} ${Hh}`}>
        {[0, .5, 1].map(t => <line key={t} x1={pad} x2={W} y1={Hh - 26 - (Hh - 50) * t} y2={Hh - 26 - (Hh - 50) * t} stroke={K.line} />)}
        {rows.map((r, i) => {
          const x = pad + i * gw + gw * .12, bw = gw * .34
          const ph = r.pr / mx * (Hh - 50), ch = r.cr / mx * (Hh - 50)
          return (
            <g key={i}>
              <rect x={x} y={Hh - 26 - ph} width={bw} height={ph} rx={2} fill={K.rose} />
              <rect x={x + bw + 3} y={Hh - 26 - ch} width={bw} height={ch} rx={2} fill={K.teal} />
              <text x={x + bw / 2} y={Hh - 29 - ph} fontSize={7.5} textAnchor="middle" fill={K.rose} fontWeight={700}>{r.pr.toFixed(0)}</text>
              <text x={x + bw * 1.5 + 3} y={Hh - 29 - ch} fontSize={7.5} textAnchor="middle" fill={K.teal} fontWeight={700}>{r.cr.toFixed(0)}</text>
              <text x={x + bw + 1.5} y={Hh - 12} fontSize={8.5} textAnchor="middle" fill={K.gray}>{r.l >= 10000 ? (r.l / 10000) + '억' : (r.l / 1000) + '천'}</text>
            </g>
          )
        })}
        <rect x={pad} y={0} width={8} height={8} fill={K.rose} rx={2} /><text x={pad + 11} y={8} fontSize={8.5} fill={K.gray}>개인 실효세율(%)</text>
        <rect x={pad + 92} y={0} width={8} height={8} fill={K.teal} rx={2} /><text x={pad + 103} y={8} fontSize={8.5} fill={K.gray}>법인 실효세율(%)</text>
      </svg>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, marginTop: 4 }}>
        <thead><tr style={{ background: K.bg }}>{['연 소득금액', '개인 세부담', '법인 세부담', '연 절세 효과'].map(h => <th key={h} style={{ padding: '3px 5px', textAlign: 'right', fontWeight: 700 }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.l}>
            <td style={{ padding: '2px 5px', textAlign: 'right' }}>{fmtWan(r.l)}</td>
            <td style={{ padding: '2px 5px', textAlign: 'right' }}>{fmtWan(Math.round(r.p / 1e4))}</td>
            <td style={{ padding: '2px 5px', textAlign: 'right' }}>{fmtWan(Math.round(r.c / 1e4))}</td>
            <td style={{ padding: '2px 5px', textAlign: 'right', fontWeight: 800, color: r.save > 0 ? K.green : K.rose }}>{r.save > 0 ? '+' : ''}{fmtWan(Math.round(r.save / 1e4))}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function Table({ head, rows, widths }: { head: string[]; rows: React.ReactNode[][]; widths?: string[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, tableLayout: 'fixed' }}>
      <thead><tr>{head.map((h, i) => (
        <th key={i} style={{ background: K.navy, color: '#fff', padding: '6px 7px', textAlign: 'left', fontWeight: 700, width: widths?.[i] }}>{h}</th>
      ))}</tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i} style={{ background: i % 2 ? '#f8fafc' : '#fff' }}>
          {r.map((c, j) => <td key={j} style={{ padding: '6px 7px', borderBottom: `1px solid ${K.line}`, verticalAlign: 'top', lineHeight: 1.5, wordBreak: 'keep-all' }}>{c}</td>)}
        </tr>
      ))}</tbody>
    </table>
  )
}

// ── 표지 ──────────────────────────────────────────────
function Cover({ company, rep, dateStr, toc }: { company: string; rep?: string; dateStr: string; toc: string[] }) {
  const chev = (dx: number, fill: string, op: number) => (
    <polygon points="0,0 300,0 520,300 300,600 0,600 220,300" transform={`translate(${dx},0)`} fill={fill} opacity={op} />
  )
  return (
    <div className="crd-page" style={{ width: 794, height: 1123, position: 'relative', overflow: 'hidden', pageBreakAfter: 'always', breakAfter: 'page', fontFamily: FONT, background: 'linear-gradient(160deg,#f8fafc 0%,#e8eef7 100%)', boxSizing: 'border-box' }}>
      <svg width={794} height={1123} style={{ position: 'absolute', left: 0, top: 0 }}>
        <defs>
          <linearGradient id="cg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#1B2A45" /><stop offset="1" stopColor="#2563eb" /></linearGradient>
          <linearGradient id="cg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2563eb" /><stop offset="1" stopColor="#0ea5e9" /></linearGradient>
          <linearGradient id="cg3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0ea5e9" /><stop offset="1" stopColor="#14b8a6" /></linearGradient>
        </defs>
        <g transform="translate(-170,230)">
          {chev(0, 'url(#cg1)', 1)}
          {chev(120, 'url(#cg2)', .85)}
          {chev(240, 'url(#cg3)', .7)}
        </g>
        <rect x={0} y={0} width={794} height={10} fill="url(#cg1)" />
      </svg>

      <div style={{ position: 'absolute', left: 60, top: 60, color: K.navy }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2 }}>HUNDRED</div>
        <div style={{ fontSize: 9, letterSpacing: 5, color: K.gray, marginTop: 2 }}>CONSULTING</div>
      </div>

      <div style={{ position: 'absolute', right: 60, top: 300, width: 330, textAlign: 'right' }}>
        <div style={{ fontSize: 11, letterSpacing: 4, color: K.blue, fontWeight: 700 }}>BUSINESS CONSULTING PROPOSAL</div>
        <div style={{ fontSize: 38, fontWeight: 900, color: K.navy, lineHeight: 1.25, marginTop: 14 }}>기업 컨설팅<br />제안 보고서</div>
        <div style={{ width: 60, height: 5, background: `linear-gradient(90deg,${K.blue},${K.teal})`, borderRadius: 3, marginLeft: 'auto', marginTop: 18 }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: K.navy, marginTop: 20 }}>{company}</div>
        {rep && <div style={{ fontSize: 12, color: K.gray, marginTop: 4 }}>대표 {rep}</div>}
        <div style={{ marginTop: 34, display: 'grid', gap: 7, fontSize: 12.5, color: '#334155' }}>
          {toc.map((t, i) => <div key={i}><span style={{ color: K.blue, fontWeight: 800, marginRight: 6 }}>{i + 1}.</span>{t}</div>)}
        </div>
      </div>

      <div style={{ position: 'absolute', right: 60, bottom: 60, textAlign: 'right', fontSize: 10, color: K.gray, lineHeight: 1.7 }}>
        <div>작성일 {dateStr}</div>
        <div>본 문서는 분석 시점 기준의 제안·계획이며 승인·선정을 보장하지 않습니다.</div>
      </div>
    </div>
  )
}

// ── 본문 ──────────────────────────────────────────────
export default function ReportDoc({ report: r, companyName, representative }: { report: ConsultingReport; companyName: string; representative?: string }) {
  const dateStr = new Date(r.generatedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' })
  const sec = (k: string) => r.sections.find(s => s.key === k)
  const s1 = sec('s1'), s2 = sec('s2'), s3 = sec('s3'), s4 = sec('s4'), s5 = sec('s5')
  const rc = riskColor(r.riskLevel)
  const fin = r.financials || {}
  const years = (fin.years || []).filter(y => isNum(y.revenue) || isNum(y.profit))
  const debts = (fin.debtBreakdown || []).map(d => ({ label: d.label, value: d.amountWan }))
  const costs = (fin.monthly?.costBreakdown || []).map(d => ({ label: d.label, value: d.amountWan }))
  const totalCost = costs.reduce((s, c) => s + (c.value || 0), 0)
  const income = fin.monthly?.income
  const compare = (fin.industryCompare || []).filter(x => isNum(x.company) || isNum(x.industry))
  const pf = r.policyFunds || []
  const road = r.roadmap || []
  const bud = r.marketing?.budgetSplit || []
  const corp = r.corpTransition
  const swot = r.swot

  return (
    <div>
      <Cover company={companyName} rep={representative} dateStr={dateStr}
        toc={['기업 분석', '정책자금 진행 전략', '인증 및 기업 전환', '마케팅 전략', '종합 컨설팅 소견']} />

      {/* 2. 종합 진단 */}
      <Page n={2} title="종합 진단" company={companyName}>
        <div style={{ display: 'flex', gap: 14 }}>
          <Card style={{ flex: 1, background: `linear-gradient(135deg,${K.navy},#2c4370)`, color: '#fff', border: 'none' }}>
            <div style={{ fontSize: 10, opacity: .7, letterSpacing: 2 }}>EXECUTIVE SUMMARY</div>
            <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.5, marginTop: 6 }}>{r.headline}</div>
          </Card>
          <Card style={{ width: 200, textAlign: 'center', padding: 6 }}>
            <Gauge value={r.riskScore} max={5} label="재무 위험도" color={rc} text={r.riskLevel} />
          </Card>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 14 }}>
          {r.metrics.slice(0, 6).map((m, i) => (
            <div key={i} style={{ borderRadius: 10, padding: '11px 13px', background: `${PALETTE[i % PALETTE.length]}12`, borderTop: `3px solid ${PALETTE[i % PALETTE.length]}` }}>
              <div style={{ fontSize: 10, color: K.gray }}>{m.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: K.navy, marginTop: 3 }}>{m.value}</div>
            </div>
          ))}
        </div>
        <H>종합 분석</H>
        <div style={{ fontSize: 11.5, lineHeight: 1.85, whiteSpace: 'pre-wrap', color: '#334155' }}>{r.summary}</div>
        <H color={K.teal}>핵심 발견 사항</H>
        <div style={{ display: 'grid', gap: 8 }}>
          {(r.keyFindings || []).map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: K.bg, borderRadius: 8, padding: '9px 12px' }}>
              <span style={{ width: 22, height: 22, borderRadius: 11, background: K.teal, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 11.5, lineHeight: 1.6 }}>{f}</span>
            </div>
          ))}
        </div>
      </Page>

      {/* 3. 재무 분석 */}
      <Page n={3} title="1. 기업 분석 · 재무 현황" company={companyName}>
        <div style={{ display: 'flex', gap: 14 }}>
          <Card style={{ flex: 1.3 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: K.navy, marginBottom: 6 }}>연도별 매출 · 영업이익 추이</div>
            {years.length ? <BarChart years={years} /> : <Empty h={200} />}
          </Card>
          <Card style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: K.navy, textAlign: 'left' }}>부채비율</div>
            {isNum(fin.debtRatio)
              ? <Gauge value={Math.min(fin.debtRatio, 400)} max={400} label="업종 안정권 ≈ 100~200%" text={`${fin.debtRatio}%`}
                  color={fin.debtRatio > 300 ? K.rose : fin.debtRatio > 200 ? K.amber : K.green} />
              : <Empty h={110} />}
          </Card>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
          <Card style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: K.navy, marginBottom: 8 }}>기대출 구성 (여신구분)</div>
            <Donut data={debts} size={140} />
          </Card>
        </div>
        <H>재무 종합 진단</H>
        <div style={{ fontSize: 11.5, lineHeight: 1.85, color: '#334155', whiteSpace: 'pre-wrap' }}>{fin.comment}</div>
        {s1?.items?.[0] && <><H color={K.blue}>{s1.items[0].heading}</H>
          <div style={{ fontSize: 11, lineHeight: 1.75, color: '#334155', whiteSpace: 'pre-wrap' }}>{s1.items[0].text}</div></>}
      </Page>

      {/* 4. 현금흐름·업종 비교 */}
      <Page n={4} title="1. 기업 분석 · 현금흐름과 업종 비교" company={companyName}>
        <div style={{ display: 'flex', gap: 14 }}>
          <Card style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: K.navy, marginBottom: 8 }}>월 추정 고정지출 구성</div>
            <Donut data={costs} size={140} />
          </Card>
          <Card style={{ width: 210 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: K.navy, marginBottom: 10 }}>월 추정 수지</div>
            {[{ n: '월 매출(추정)', v: income, c: K.blue }, { n: '월 고정지출(추정)', v: totalCost || null, c: K.rose }].map(b => {
              const mx = Math.max(income || 0, totalCost || 0, 1)
              return (
                <div key={b.n} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9.5, color: K.gray }}>{b.n}</div>
                  <div style={{ background: K.bg, borderRadius: 5, height: 14, marginTop: 3 }}>
                    <div style={{ width: `${isNum(b.v) ? (b.v / mx) * 100 : 0}%`, height: 14, borderRadius: 5, background: b.c }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: K.navy, marginTop: 2 }}>{isNum(b.v) ? fmtWan(b.v) : '자료 미확인'}</div>
                </div>
              )
            })}
            {isNum(income) && totalCost > 0 && (
              <div style={{ fontSize: 10, color: income - totalCost >= 0 ? K.green : K.rose, fontWeight: 700 }}>
                월 잉여 {income - totalCost >= 0 ? '+' : ''}{fmtWan(income - totalCost)} (추정)
              </div>
            )}
          </Card>
        </div>
        <H color={K.violet}>동종업계 비교</H>
        <Card>{compare.length ? <CompareBars rows={compare} /> : <Empty />}</Card>
        <H>현금흐름 · 업종 코멘트</H>
        <div style={{ fontSize: 11.5, lineHeight: 1.85, color: '#334155', whiteSpace: 'pre-wrap' }}>{fin.cashflowComment}</div>
        {s1?.items?.[1] && <><H color={K.blue}>{s1.items[1].heading}</H>
          <div style={{ fontSize: 11, lineHeight: 1.75, color: '#334155', whiteSpace: 'pre-wrap' }}>{s1.items[1].text}</div></>}
      </Page>

      {/* 5. 정합성 · 기업분석 상세 */}
      <Page n={5} title="1. 기업 분석 · 자료 정합성과 발전 방향" company={companyName}>
        <H>인콜카드 · 제출서류 대조</H>
        {r.crossCheck?.length ? (
          <Table head={['항목', '인콜카드', '서류', '결과']} widths={['22%', '32%', '32%', '14%']}
            rows={r.crossCheck.map(x => [
              <b key="a">{x.item}</b>, x.incall, x.document,
              <span key="b" style={{ background: (STATUS_BG[x.status] || ['#e2e8f0', '#334155'])[0], color: (STATUS_BG[x.status] || ['#e2e8f0', '#334155'])[1], padding: '2px 8px', borderRadius: 10, fontWeight: 800, fontSize: 9.5 }}>{x.status}</span>,
            ])} />
        ) : <Empty h={60} />}
        {!!r.missingDocs?.length && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#92400e', background: '#fef3c7', borderRadius: 6, padding: '6px 10px' }}>
            미제출/미확인 서류: {r.missingDocs.join(', ')} — 제출 시 분석 정밀도가 높아집니다.
          </div>
        )}
        <H color={K.blue}>기업 분석 상세</H>
        <ItemList items={(s1?.items || []).slice(2)} color={K.blue} />
      </Page>

      {/* 6. 정책자금 */}
      <Page n={6} title="2. 정책자금 진행 전략" company={companyName} color={K.blue}>
        <H color={K.blue}>매칭 가능 정책자금 (검토 대상)</H>
        {pf.length ? (
          <Table head={['기관 / 상품', '한도 · 금리', '적합 근거', '확인·준비 사항', '기준']} widths={['19%', '19%', '27%', '23%', '12%']}
            rows={pf.slice(0, 5).map(p => [
              <span key="o"><b>{p.org}</b><br />{p.product}<br /><span style={{ color: K.gray, fontSize: 9 }}>{p.timing}</span></span>,
              <span key="l"><b style={{ color: K.navy }}>{p.limit}</b>{p.rate ? <><br /><span style={{ color: K.gray }}>{p.rate}</span></> : null}</span>,
              p.matchReason, p.prerequisites,
              p.verified
                ? <span key="v" style={{ background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 8, fontWeight: 800, fontSize: 9 }}>공문 기준{p.source ? <><br />{p.source.slice(0, 22)}</> : null}</span>
                : <span key="v" style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 8, fontWeight: 800, fontSize: 9 }}>공고 재확인 필요</span>])} />
        ) : <Empty />}
        <div style={{ fontSize: 9, color: K.gray, marginTop: 6 }}>※ 한도·요건은 2026년 기관 공고문(소진공 제2026-478호, 중진공 제2026-464호 등) 기준이며, 실제 승인 여부와 한도는 기관 심사 결과에 따라 결정됩니다. 접수 시점의 최신 공고를 반드시 재확인하시기 바랍니다.</div>
        <H color={K.teal}>적합도 분석</H>
        <Card>
          <div style={{ display: 'grid', gap: 7 }}>
            {pf.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 130, fontSize: 10, fontWeight: 700, color: K.navy }}>{p.org} · {p.product.slice(0, 10)}</span>
                <div style={{ flex: 1, background: K.bg, borderRadius: 5, height: 12 }}>
                  <div style={{ width: `${Math.min(100, p.fitScore || 0)}%`, height: 12, borderRadius: 5, background: `linear-gradient(90deg,${K.blue},${K.teal})` }} />
                </div>
                <span style={{ width: 34, fontSize: 10, fontWeight: 800, textAlign: 'right' }}>{p.fitScore}</span>
              </div>
            ))}
          </div>
        </Card>
        <H color={K.blue}>진행 전략</H>
        <ItemList items={s2?.items || []} color={K.blue} />
      </Page>

      {/* 7. 로드맵 */}
      <Page n={7} title="2. 12개월 진행 로드맵" company={companyName} color={K.blue}>
        <Card style={{ padding: 10 }}>
          <div style={{ display: 'flex', marginLeft: 200, fontSize: 9, color: K.gray }}>
            {Array.from({ length: 12 }, (_, i) => <div key={i} style={{ flex: 1, textAlign: 'center' }}>{i + 1}M</div>)}
          </div>
          {road.map((x, i) => {
            const s = Math.max(1, x.startMonth || 1), e = Math.max(s, x.endMonth || s)
            const col = TRACK_COLOR[x.track || ''] || K.blue
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', height: 26, borderTop: `1px solid ${K.line}` }}>
                <div style={{ width: 200, fontSize: 10, fontWeight: 700, color: K.navy, paddingRight: 8, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{x.title}</div>
                <div style={{ flex: 1, position: 'relative', height: 26 }}>
                  <div style={{ position: 'absolute', left: `${(s - 1) / 12 * 100}%`, width: `${(e - s + 1) / 12 * 100}%`, top: 6, height: 14, borderRadius: 7, background: col }} />
                </div>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 9.5, color: K.gray }}>
            {Object.entries(TRACK_COLOR).map(([k, c]) => <span key={k}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: c, marginRight: 4 }} />{k}</span>)}
          </div>
        </Card>
        <H color={K.blue}>단계별 상세</H>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {road.map((x, i) => (
            <div key={i} style={{ background: K.bg, borderRadius: 8, padding: '8px 10px', borderLeft: `4px solid ${TRACK_COLOR[x.track || ''] || K.blue}` }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: TRACK_COLOR[x.track || ''] || K.blue }}>
                {x.startMonth ? `${x.startMonth}~${x.endMonth}개월` : x.period} · {x.track}
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: K.navy, marginTop: 2 }}>{x.title}</div>
              <div style={{ fontSize: 10, lineHeight: 1.55, color: '#475569', marginTop: 2 }}>{x.detail}</div>
            </div>
          ))}
        </div>
      </Page>

      {/* 8. 인증 · 법인전환 */}
      <Page n={8} title="3. 인증 및 기업 전환" company={companyName} color={K.violet}>
        <H color={K.violet}>추천 인증 로드맵</H>
        {r.certifications?.length ? (
          <Table head={['인증', '핵심 요건', '이점', '목표 시기', '적합']} widths={['16%', '28%', '30%', '14%', '12%']}
            rows={r.certifications.map(c => [<b key="n">{c.name}</b>, c.requirement, c.benefit, c.timing,
              <span key="f" style={{ fontWeight: 800, color: c.fit === '높음' ? K.green : c.fit === '낮음' ? K.rose : K.amber }}>{c.fit}</span>])} />
        ) : <Empty />}
        <H color={K.teal}>사업자 → 법인 전환 검토</H>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
          {(corp?.triggers?.length ? corp.triggers : [
            { label: '매출 성장', met: null, note: '' }, { label: '인력 채용', met: null, note: '' },
            { label: '투자 계획', met: null, note: '' }, { label: '대외 신뢰도', met: null, note: '' },
          ]).map((t, i) => (
            <div key={i} style={{ borderRadius: 8, padding: '7px 8px', background: t.met ? '#dcfce7' : t.met === false ? '#f1f5f9' : '#fef3c7', borderTop: `3px solid ${t.met ? K.green : t.met === false ? '#94a3b8' : K.amber}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: K.navy }}>{t.met ? '✔ ' : t.met === false ? '– ' : '? '}{t.label}</div>
              <div style={{ fontSize: 8.8, lineHeight: 1.45, marginTop: 2, color: '#475569' }}>{t.note || '자료 미확인'}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9, color: K.gray, marginBottom: 6 }}>매출이 성장하고, 인력을 채용하며, 투자 계획이 있고, 대외 신뢰도가 필요한 사업자는 법인 설립을 권장합니다.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Card style={{ width: 350, padding: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: K.navy, marginBottom: 2 }}>법인 전환 시 이득 구간 (개인 vs 법인 세부담)</div>
            <TaxCompare />
          </Card>
          <div style={{ flex: 1, display: 'grid', gap: 6, alignContent: 'start' }}>
            {corp && <>
              <Card style={{ padding: 8, background: K.bg }}><div style={{ fontSize: 9, color: K.gray }}>현재 진단</div><div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.5 }}>{corp.currentStatus}</div></Card>
              <Card style={{ padding: 8, background: `${K.violet}12` }}><div style={{ fontSize: 9, color: K.violet }}>전환 권장 기준</div><div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.5 }}>{corp.threshold}</div></Card>
              <Card style={{ padding: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: K.violet, marginBottom: 3 }}>전환·인증 후 이점</div>
                {corp.benefits.slice(0, 3).map((x, i) => <div key={i} style={{ fontSize: 9.5, lineHeight: 1.5, marginBottom: 2 }}>• {x}</div>)}
              </Card>
            </>}
          </div>
        </div>
        <div style={{ fontSize: 8.3, color: '#94a3b8', marginTop: 4, lineHeight: 1.5 }}>
          ※ 소득세법 종합소득세율(6~45%)과 법인세법 2026년 사업연도 이후 세율(10/20/22/25%)에 지방소득세 10%를 더한 단순 비교이며, 소득금액=과세표준으로 가정했습니다. 법인은 대표 급여·배당 시 개인 소득세가 추가되고 법인 유지비용(기장·4대보험 등)이 발생하므로 실제 절세액은 세무사 검토가 필요합니다.
        </div>
        <H color={K.violet}>세부 전략</H>
        <ItemList items={(s3?.items || []).slice(0, 2)} color={K.violet} />
      </Page>

      {/* 9. 마케팅 */}
      <Page n={9} title="4. 마케팅 전략" company={companyName} color={K.orange}>
        <div style={{ display: 'flex', gap: 14 }}>
          <Card style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: K.navy, marginBottom: 8 }}>채널별 예산 배분 (제안)</div>
            <Donut data={bud.map(b => ({ label: b.channel, value: b.pct }))} size={150} unit="pct" />
          </Card>
          <Card style={{ width: 230 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: K.navy, marginBottom: 6 }}>월 광고 예산</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: K.orange }}>{fmtWan(bud.reduce((s, b) => s + (b.monthlyWan || 0), 0))}</div>
            <div style={{ fontSize: 10, lineHeight: 1.6, color: '#475569', marginTop: 6 }}>{r.marketing?.note}</div>
          </Card>
        </div>
        <H color={K.orange}>채널별 운영 전략</H>
        {bud.length ? (
          <Table head={['채널', '비중', '월 예산', '전략', '목표 지표']} widths={['13%', '9%', '13%', '41%', '24%']}
            rows={bud.map(b => [<b key="c">{b.channel}</b>, `${b.pct}%`, fmtWan(b.monthlyWan || 0), b.strategy, b.kpi])} />
        ) : <Empty />}
        <H color={K.orange}>세부 전략</H>
        <ItemList items={s4?.items || []} color={K.orange} />
      </Page>

      {/* 10. 종합 소견 */}
      <Page n={10} title="5. 종합 컨설팅 소견" company={companyName} color={K.teal}>
        {swot && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {([['강점 Strengths', swot.strengths, K.green], ['약점 Weaknesses', swot.weaknesses, K.rose], ['기회 Opportunities', swot.opportunities, K.blue], ['위협 Threats', swot.threats, K.amber]] as [string, string[], string][]).map(([t, list, c]) => (
              <div key={t} style={{ borderRadius: 10, background: `${c}12`, borderTop: `3px solid ${c}`, padding: '9px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: c, marginBottom: 4 }}>{t}</div>
                {(list || []).map((x, i) => <div key={i} style={{ fontSize: 10.5, lineHeight: 1.55, marginBottom: 2 }}>• {x}</div>)}
              </div>
            ))}
          </div>
        )}
        <H color={K.teal}>컨설팅 소견</H>
        <ItemList items={s5?.items || []} color={K.teal} />
        {!!r.outlook?.length && <>
          <H color={K.navy}>기대 효과 (보수적 전망)</H>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {r.outlook.map((o, i) => (
              <div key={i} style={{ background: K.bg, borderRadius: 8, padding: '8px 11px' }}>
                <div style={{ fontSize: 9.5, color: K.gray }}>{o.label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, lineHeight: 1.5 }}>{o.value}</div>
              </div>
            ))}
          </div>
        </>}
        {!!r.sources?.length && (
          <div style={{ marginTop: 10, fontSize: 8.5, color: K.gray, lineHeight: 1.5 }}>
            <b>참고 출처(웹 조사):</b> {r.sources.map(s => s.title || s.uri).join(' · ')}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 8.5, color: '#94a3b8', borderTop: `1px solid ${K.line}`, paddingTop: 6, lineHeight: 1.6 }}>
          ※ 본 보고서는 고객이 제공한 자료와 작성일({dateStr}) 시점의 정보를 바탕으로 한 분석 및 진행 제안이며, 정책자금 승인·인증 선정 등 결과를 보장하지 않습니다. 각 기관의 최신 공고와 심사 결과에 따라 달라질 수 있으며, 추정치는 실제와 다를 수 있습니다.
        </div>
      </Page>
    </div>
  )
}
