'use client'

// 헌드레드 사무실 — 대표 첫 화면. 밤의 도시가 보이는 아이소메트릭(3D 느낌) 사무실.
//  · 가운데 홀로그램 테이블 둘레에 부서별 책상 클러스터(대표실·매출관리·세무관리·법무서식 / 영업팀·발굴팀·관리팀·총괄검수)가 있고
//    실제 직원과 AI 서브(색상 이름)가 자기 자리에 앉아 일한다.
//  · 직원이 계약·보고·심사요청 같은 걸 올리면 자리에서 일어나 '대표실 앞 보고 구역'에 서서 말풍선으로 보고한다. 대표가 [확인]하면 자리로 돌아간다.
//  · 직원/AI를 누르면 오른쪽에 '직원 살펴보기' 카드가 열려 맡은 일·오늘 보고·부서 현황을 보여 준다.
//  · 발굴팀은 "오늘 N개 했습니다! 대기·승인·이번 달 목표 달성률" 을 보고한다.
//  · 노랑(매출분석)은 이번 달 매출과 얼마나 더 필요한지, 초록(세무)은 파킹통장에 들고 있어야 할 금액을 말한다.
//  · 핑크(검수)는 계속 돌아다니며 보고가 생긴 곳에 가서 확인한다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { SceneCluster } from './Office3D'
import { isTester } from '@/lib/tester'
import { bizDays } from '@/lib/digStats'

type DeptKey = 'ceo' | 'revenue' | 'tax' | 'legal' | 'sales' | 'dig' | 'ops' | 'qa'
type Pt = { x: number; y: number }

type Dept = {
  key: DeptKey; label: string; agent: string; agentRole: string
  accent: string
  angle: number                      // 가운데 테이블 둘레 배치 각도(도)
  role?: 'sales' | 'ops' | 'dig'
  go: string                         // 클릭 시 이동할 탭
}

const DEPTS: Dept[] = [
  { key: 'ceo',     label: '대표실',     agent: '빨강', agentRole: 'CRM 개발·총괄',     accent: '#ef4444', angle: -90,  go: 'overview' },
  { key: 'revenue', label: '매출관리',   agent: '노랑', agentRole: '매출 분석',          accent: '#facc15', angle: 0,    go: 'analytics' },
  { key: 'tax',     label: '세무관리',   agent: '초록', agentRole: '세금 계산',          accent: '#22c55e', angle: 180,  go: 'analytics' },
  { key: 'legal',   label: '법무·서식',  agent: '파랑', agentRole: '계약서·서식',        accent: '#3b82f6', angle: -45,  go: 'rules' },
  { key: 'sales',   label: '영업팀',     agent: '남색', agentRole: '영업 코칭·현황',     accent: '#818cf8', angle: -135, role: 'sales', go: 'sales' },
  { key: 'dig',     label: '발굴팀',     agent: '보라', agentRole: 'DB 발굴·중복 점검',  accent: '#c084fc', angle: 135,  role: 'dig', go: 'dig' },
  { key: 'ops',     label: '관리팀',     agent: '주황', agentRole: '카톡 단톡방·서류',   accent: '#fb923c', angle: 45,   role: 'ops', go: 'ops' },
  { key: 'qa',      label: '총괄 검수',  agent: '핑크', agentRole: '실행 전 검수·순찰',  accent: '#f472b6', angle: 90,   go: 'overview' },
]
const DEPT = Object.fromEntries(DEPTS.map(d => [d.key, d])) as Record<DeptKey, Dept>


// ── 데이터 ─────────────────────────────────────────────
type User = { id?: string; name: string; username?: string; role: string; blocked?: boolean }
type Data = {
  users: User[]
  rev?: { thisMonth: number; sales: number; ops: number; receivableCount: number; receivableSum: number; overdueCount: number }
  pnl?: { cost: number; label: string; hasCost: boolean }
  tax?: { parking: number; nextLabel: string; nextDue: string }
  dig: any[]
  customers: any[]
  reports: any[]
  assignCount: number
  acts: any[]
}

const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000)
const kstDay = () => kstNow().toISOString().slice(0, 10)
const won = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? '-' : ''
  if (a >= 100_000_000) return s + parseFloat((a / 100_000_000).toFixed(2)) + '억'
  return s + Math.round(a / 10_000).toLocaleString('ko-KR') + '만'
}
const strip = (s: string) => String(s || '').replace(/\s*(수석팀장|팀장|팀원|대리|과장|부장|차장|이사|수석|매니저|주임|사원).*$/, '').trim()

async function jget(url: string): Promise<any> { try { const r = await fetch(url); return r.ok ? await r.json() : {} } catch { return {} } }

async function loadAll(): Promise<Data> {
  const ym = kstNow().toISOString().slice(0, 7)
  const [u, rv, pn, tx, dg, cu, rp, as, ac] = await Promise.all([
    jget('/api/users'), jget('/api/revenue'), jget('/api/analytics/pnl'), jget('/api/tax-calc'),
    jget('/api/dig-prospects?status=all'), jget('/api/customers'), jget('/api/reports'), jget('/api/assign'), jget('/api/agent/activity'),
  ])
  const users: User[] = (u.users || []).filter((x: any) => !x.blocked && !isTester(x.name, x.username) && x.role !== 'ceo')
  const m = (rv.monthly || []).find((x: any) => x.fullMonth === ym) || {}
  const rc = rv.v2?.receivable || {}
  const months: any[] = pn.months || []
  const cur = months.find(x => x.ym === ym)
  const past = [...months].reverse().find(x => x.ym !== ym && x.hasData)
  const basis = cur && cur.costs?.total + cur.labor?.total > 0 ? cur : past
  const cost = basis ? (basis.labor?.total || 0) + (basis.costs?.total || 0) + (basis.tax || 0) : 0
  const sm = tx.summary || {}
  return {
    users,
    rev: { thisMonth: m['합계'] || 0, sales: m['영업팀'] || 0, ops: (m['관리팀'] || 0) + (m['관리팀계약'] || 0), receivableCount: rc.count || 0, receivableSum: rc.sum || 0, overdueCount: rc.overdueCount || 0 },
    pnl: { cost, label: basis ? (basis.ym === ym ? '이번 달 비용 기준' : `${basis.ym.slice(5)}월 비용 기준`) : '', hasCost: cost > 0 },
    tax: sm.parking != null ? { parking: sm.parking, nextLabel: sm.nextVat?.label || '', nextDue: sm.nextVat?.due || '' } : undefined,
    dig: dg.prospects || [],
    customers: cu.customers || [],
    reports: rp.reports || [],
    assignCount: (as.contracts || []).length,
    acts: ac.acts || [],
  }
}

// ── 보고 만들기 ────────────────────────────────────────
type Report = { id: string; dept: DeptKey; who: string; lines: string[]; sig: string; go: string; sub?: string; itemId?: string }
type Item = { id: string; kind: 'human' | 'bot'; name: string; label: string; dept: DeptKey; shirt: string; accent: string; user?: User; roam?: boolean }

function buildReports(d: Data): Report[] {
  const out: Report[] = []
  const today = kstDay(), ym = today.slice(0, 7)
  const people = (role: string) => d.users.filter(u => u.role === role)
  // 영업팀: 오늘 계약·오전/마감 보고
  const salesUsers = people('sales')
  const lead = salesUsers.find(u => /손제후|제후/.test(u.name)) || salesUsers[0]
  for (const u of salesUsers) {
    const lines: string[] = []
    const base = strip(u.name)
    const contractsToday = d.customers.filter((c: any) => c.status === 'contracted' && String(c.details?.contract_date || '').slice(0, 10) === today && strip(c.details?.sales_user_name || c.sales_user_name) === base).length
    if (contractsToday > 0) lines.push(`계약 ${contractsToday}건 했습니다!`)
    const rs = d.reports.filter((r: any) => (r.report_date === today || String(r.created_at || '').slice(0, 10) === today) && (r.user_id === u.id || strip(r.user_name) === base) && (r.report_type === 'morning' || r.report_type === 'daily'))
    if (rs.some((r: any) => r.report_type === 'morning')) lines.push('오전 보고 올렸습니다!')
    if (rs.some((r: any) => r.report_type === 'daily')) lines.push('마감 보고 올렸습니다!')
    if (lead && u === lead && d.assignCount > 0) lines.push(`계약 배정 대기 ${d.assignCount}건!`)
    if (lines.length) out.push({ id: `sales:${u.name}`, dept: 'sales', who: u.name, lines, sig: lines.join('|'), go: 'sales' })
  }
  // 관리팀: 심사 요청·매출 신고(보고)·A/S
  const insp = d.customers.filter((c: any) => c.details?.inspection_status === 'pending').length
  const asReq = d.customers.filter((c: any) => c.details?.as_requested && !c.details?.as_approved && !c.details?.as_not_applicable && !c.details?.as_rejected && !c.details?.as_resolved).length
  const opsUsers = people('ops')
  opsUsers.forEach((u, i) => {
    const lines: string[] = []
    const base = strip(u.name)
    if (i === 0 && insp > 0) lines.push(`심사 요청 ${insp}건 있습니다!`)
    if (i === 0 && asReq > 0) lines.push(`A/S 요청 ${asReq}건 있습니다!`)
    const rs = d.reports.filter((r: any) => (r.report_date === today || String(r.created_at || '').slice(0, 10) === today) && (r.user_id === u.id || strip(r.user_name) === base) && (r.report_type === 'ops_daily' || r.report_type === 'ops_morning'))
    if (rs.length) lines.push('매출 신고·보고 올렸습니다!')
    if (lines.length) out.push({ id: `ops:${u.name}`, dept: 'ops', who: u.name, lines, sig: lines.join('|'), go: 'ops', sub: insp > 0 && i === 0 ? 'inspection' : asReq > 0 && i === 0 ? 'as' : undefined })
  })
  // 발굴팀: 오늘 현황 — 몇 개 했고, 대기·승인, 이번 달 목표 대비
  const biz = bizDays(ym).total, digs = people('dig'), goalEach = biz * 8
  for (const u of digs) {
    const mine = d.dig.filter((p: any) => (p.dig_user_id && p.dig_user_id === u.id) || strip(p.dig_user_name) === strip(u.name))
    const inMonth = mine.filter((p: any) => String(p.call_date || p.created_at || '').slice(0, 7) === ym)
    const doneToday = mine.filter((p: any) => (p.call_date === today || String(p.created_at || '').slice(0, 10) === today) && p.status !== 'canceled').length
    const pending = inMonth.filter((p: any) => p.status === 'pending').length
    const approved = inMonth.filter((p: any) => p.status === 'approved' || p.status === 'assigned').length
    if (doneToday === 0 && pending === 0) continue
    const pct = goalEach > 0 ? Math.round((approved / goalEach) * 100) : 0
    const lines = [`지금까지 ${doneToday}개 했습니다!`, `대기 ${pending}개 · 승인 ${approved}개`, `이번 달 목표 ${goalEach}개 중 ${pct}% 됐습니다!`]
    out.push({ id: `dig:${u.name}`, dept: 'dig', who: u.name, lines, sig: `${doneToday}/${pending}/${approved}`, go: 'dig' })
  }
  return out
}


// ── 화면 ───────────────────────────────────────────────
const ACK_KEY = 'office_ack_v2'
const readAck = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(ACK_KEY) || '{}') } catch { return {} } }
const AGENT_DEPT: Record<string, DeptKey> = { '주황이': 'ops', '주황': 'ops', '보라': 'dig', '남색': 'sales', '노랑': 'revenue', '핑크': 'qa', '초록': 'tax', '파랑': 'legal', '빨강': 'ceo' }
const itemIdOf = (r: Report) => r.itemId || `human:${r.dept}:${r.who}`

const Office3D = dynamic(() => import('./Office3D'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-[13px] text-white/50">3D 사무실을 불러오는 중…</div>,
})

function Sky() {
  const bl = [[0, 62, 8, 38], [7, 70, 6, 30], [14, 58, 8, 42], [86, 66, 7, 34], [92, 56, 8, 44], [98, 70, 6, 30]]
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#050a1c" /><stop offset="1" stopColor="#10204a" /></linearGradient>
        <radialGradient id="moon3"><stop offset="0" stopColor="#f6f9ff" /><stop offset=".6" stopColor="#dfe9ff" /><stop offset="1" stopColor="#9db4e6" /></radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sky3)" />
      {Array.from({ length: 46 }).map((_, i) => <circle key={i} cx={(i * 37) % 100} cy={(i * 17) % 58} r={i % 6 === 0 ? 0.22 : 0.12} fill="#fff" opacity={0.25 + (i % 4) * 0.14} />)}
      <circle cx="12" cy="17" r="8.5" fill="#9db4e6" opacity=".14" /><circle cx="12" cy="17" r="4.4" fill="url(#moon3)" />
      {bl.map(([x, y, w, h], i) => <g key={i}><rect x={x} y={y} width={w} height={h} fill="#0a1226" stroke="#16224a" strokeWidth=".15" />{Array.from({ length: 6 }).map((_, k) => <rect key={k} x={x + 1 + (k % 2) * 3} y={y + 3 + Math.floor(k / 2) * 6} width="1.2" height="1.6" fill="#ffd27a" opacity={(i + k) % 3 === 0 ? 0.8 : 0.15} />)}</g>)}
    </svg>
  )
}

export default function OfficeTab({ onNavigate }: { onNavigate: (tab: string, sub?: string) => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [acked, setAcked] = useState<Record<string, string>>({})
  const [now, setNow] = useState(() => kstNow())
  const [manual, setManual] = useState(false)
  const [patrol, setPatrol] = useState(0)
  const [selId, setSelId] = useState<string | null>(null)
  const [focus, setFocus] = useState<DeptKey | null>(null)
  const [hover, setHover] = useState<{ dept: DeptKey | null; id: string | null }>({ dept: null, id: null })
  const [stageH, setStageH] = useState(640)
  const alive = useRef(true)
  const stageRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)

  const refresh = useCallback(async () => { const d = await loadAll(); if (alive.current) setData(d) }, [])
  useEffect(() => { alive.current = true; setAcked(readAck()); refresh(); const t = setInterval(() => { if (!document.hidden) refresh() }, 45_000); return () => { alive.current = false; clearInterval(t) } }, [refresh])
  useEffect(() => { const t = setInterval(() => setNow(kstNow()), 30_000); return () => clearInterval(t) }, [])
  useEffect(() => { const t = setInterval(() => setPatrol(p => p + 1), 6000); return () => clearInterval(t) }, [])
  // 창 안에 딱 맞게 — 아래로 스크롤할 필요가 없도록 남은 높이를 전부 쓴다
  useEffect(() => {
    const fit = () => { const el = stageRef.current; if (!el) return; const top = el.getBoundingClientRect().top + window.scrollY; setStageH(Math.max(460, Math.floor(window.innerHeight - (top - window.scrollY) - 14))) }
    fit(); window.addEventListener('resize', fit); const t = setTimeout(fit, 400)
    return () => { window.removeEventListener('resize', fit); clearTimeout(t) }
  }, [manual, data === null])

  const hour = now.getUTCHours()
  const users = data?.users || []
  const biz = bizDays(kstNow().toISOString().slice(0, 7)).total
  const digCount = users.filter(u => u.role === 'dig').length

  // 보고: 직원 보고 + 색상 AI 가 한 일(카톡 보냄 등)
  const reports = useMemo<Report[]>(() => {
    if (!data) return []
    const base = buildReports(data)
    const acts: Report[] = (data.acts || []).map((a: any) => {
      const dept = AGENT_DEPT[String(a.agent)] || 'qa'
      return { id: `act:${a.id}`, dept, who: String(a.agent), lines: [String(a.text || '').slice(0, 120)], sig: String(a.id), go: DEPT[dept].go, itemId: `bot:${dept}` }
    })
    return [...base, ...acts]
  }, [data])
  const waiting = reports.filter(r => acked[r.id] !== r.sig)
  const ack = (r: Report) => { const next = { ...acked, [r.id]: r.sig }; setAcked(next); try { localStorage.setItem(ACK_KEY, JSON.stringify(next)) } catch {} }

  // 장면에 넘길 구성
  const clusters = useMemo<SceneCluster[]>(() => DEPTS.map(d => {
    const items: Item[] = [{ id: 'bot:' + d.key, kind: 'bot', name: d.agent, label: d.agent, dept: d.key, shirt: d.accent, accent: d.accent, roam: d.key === 'qa' }]
    if (d.key === 'ceo') items.unshift({ id: 'human:ceo', kind: 'human', name: '대표', label: '대표', dept: 'ceo', shirt: '#ef4444', accent: '#ef4444' })
    if (d.role) for (const u of users.filter(x => x.role === d.role)) items.push({ id: 'human:' + d.key + ':' + u.name, kind: 'human', name: u.name, label: strip(u.name), dept: d.key, shirt: d.accent, accent: d.accent, user: u })
    return { dept: d.key, accent: d.accent, angle: d.angle, items }
  }), [users])

  const slots = useMemo(() => { const m: Record<string, number> = {}; waiting.forEach((r, i) => { if (m[itemIdOf(r)] == null) m[itemIdOf(r)] = i }); return m }, [waiting])
  const bubbleIds = useMemo(() => Object.keys(slots), [slots])
  const pinkSlot = waiting.length > 0 ? patrol % waiting.length : null
  const pinkSay = waiting.length > 0 ? `${strip(waiting[patrol % waiting.length].who)} 보고 확인 중…` : ['순찰 중…', '이상 없음 ✔', '장부 점검 중', '서식 확인 ✔'][patrol % 4]

  const rev = data?.rev, pnl = data?.pnl, tax = data?.tax
  const need = pnl?.hasCost && rev ? Math.max(0, pnl.cost - rev.thisMonth) : 0
  const revSay = !rev ? '집계 중…' : pnl?.hasCost
    ? (need > 0 ? `이번 달 매출 ${won(rev.thisMonth)}원! 비용 ${won(pnl.cost)}원 맞추려면 ${won(need)}원 더 필요해요 (${pnl.label})` : `이번 달 매출 ${won(rev.thisMonth)}원! 비용 ${won(pnl.cost)}원을 넘겼어요, 순이익 약 ${won(rev.thisMonth - pnl.cost)}원 (${pnl.label})`)
    : `이번 달 매출 ${won(rev.thisMonth)}원 (영업 ${won(rev.sales)} · 관리 ${won(rev.ops)})`
  const taxSay = tax ? `지금 상황이면 파킹통장에 ${won(tax.parking)}원 들고 계세요!${tax.nextDue ? ` 다음 ${tax.nextLabel} ${tax.nextDue.slice(5).replace('-', '/')}` : ''}` : '세금 계산 중…'
  const monthDig = (data?.dig || []).filter(p => String(p.call_date || p.created_at || '').slice(0, 7) === kstNow().toISOString().slice(0, 7) && (p.status === 'approved' || p.status === 'assigned') && !isTester(p.dig_user_name, p.dig_user_username)).length
  const digGoal = digCount * biz * 8
  const digPct = digGoal > 0 ? Math.round((monthDig / digGoal) * 100) : 0

  const infoFor = (k: DeptKey): { short: string; pct?: number; long: string } => {
    const rcv = rev && rev.receivableCount > 0 ? ` · 받을 잔금 ${rev.receivableCount}건 ${won(rev.receivableSum)}원${rev.overdueCount ? `(기한 지남 ${rev.overdueCount})` : ''}` : ''
    if (k === 'ceo') return { short: rev ? `총매출 ${won(rev.thisMonth)}원` : '…', long: rev ? `이번 달 총매출 ${won(rev.thisMonth)}원 (영업 ${won(rev.sales)} · 관리 ${won(rev.ops)})${rcv}` : '집계 중…' }
    if (k === 'revenue') return { short: rev ? `${won(rev.thisMonth)}원` : '…', long: revSay + rcv }
    if (k === 'tax') return { short: tax ? `파킹 ${won(tax.parking)}원` : '…', long: taxSay }
    if (k === 'sales') return { short: rev ? `${won(rev.sales)}원` : '…', long: rev ? `이번 달 영업팀 매출 ${won(rev.sales)}원` : '집계 중…' }
    if (k === 'ops') return { short: rev ? `${won(rev.ops)}원` : '…', long: rev ? `이번 달 관리팀 매출 ${won(rev.ops)}원` : '집계 중…' }
    if (k === 'dig') return { short: `승인 ${monthDig}/${digGoal || '-'}`, pct: digPct, long: `이번 달 승인 ${monthDig}개 / 목표 ${digGoal || '-'}개 (${digPct}%)` }
    if (k === 'legal') return { short: '서식·계약서', long: '계약서 · 약관 · 서식 담당' }
    return { short: `보고 ${waiting.length}건 대기`, long: `보고 ${waiting.length}건 확인 대기` }
  }

  const allItems = clusters.flatMap(c => c.items) as Item[]
  const itemById = (id: string | null) => (id ? allItems.find(i => i.id === id) || null : null)
  const repOf = (id: string) => waiting.filter(r => itemIdOf(r) === id)

  const pick = (dept: DeptKey | null, id: string | null) => { if (!dept) { setFocus(null); setSelId(null); return } setFocus(dept); setSelId(id) }
  const fullscreen = () => { const el = sectionRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.() }
  const onStageMove = (e: React.MouseEvent) => { const t = tipRef.current, s = stageRef.current; if (!t || !s) return; const r = s.getBoundingClientRect(); const x = Math.min(e.clientX - r.left + 16, r.width - 300), y = Math.min(e.clientY - r.top + 16, r.height - 160); t.style.transform = `translate(${Math.max(8, x)}px,${Math.max(8, y)}px)` }

  const hoverDept = hover.dept
  const hoverItem = itemById(hover.id)
  const focusInfo = focus ? infoFor(focus) : null
  const focusItems = focus ? (clusters.find(c => c.dept === focus)?.items as Item[] | undefined) || [] : []

  const renderSign = (d: DeptKey) => {
    const D = DEPT[d], info = infoFor(d), active = waiting.some(r => r.dept === d)
    return (
      <button type="button" onClick={e => { e.stopPropagation(); pick(d, null) }} onMouseEnter={() => setHover({ dept: d, id: null })} onMouseLeave={() => setHover({ dept: null, id: null })}
        className={`of3-sign ${focus === d ? 'on' : ''}`} style={{ borderColor: active ? D.accent : undefined, boxShadow: active ? `0 0 16px ${D.accent}99` : undefined }}>
        <span className="flex items-center gap-1.5"><i className="of-dot" style={{ background: D.accent }} /><b>{D.label}</b></span>
        <span className="of3-sub">{info.short}</span>
        {info.pct != null && <span className="of-meter"><i style={{ width: `${Math.min(100, info.pct)}%`, background: D.accent }} /></span>}
      </button>
    )
  }
  const renderBubble = (id: string, below: boolean) => {
    const reps = repOf(id); if (reps.length === 0) return null
    const rep = reps[0], d = DEPT[rep.dept], more = reps.length - 1
    return (
      <div className="of-report" style={{ borderColor: d.accent }} onClick={e => e.stopPropagation()}>
        <p className="font-black" style={{ color: '#6b7280', fontSize: 10 }}>{strip(rep.who)} · {d.label}</p>
        {rep.lines.map((l, k) => <p key={k} className={k === 0 ? 'font-black' : ''}>{l}</p>)}
        {more > 0 && <p style={{ color: '#9ca3af', fontSize: 10 }}>외 {more}건</p>}
        <div className="mt-1 flex gap-1">
          <button onClick={() => reps.forEach(ack)} className="of-ok">확인</button>
          <button onClick={() => onNavigate(rep.go, rep.sub)} className="of-go">이동</button>
        </div>
        <span className={below ? 'of-tail-u' : 'of-tail-d'} style={{ borderColor: d.accent }} />
      </div>
    )
  }

  return (
    <section ref={sectionRef} className="rounded-2xl overflow-hidden border border-[#1b2a55] shadow-[0_10px_30px_rgba(5,8,20,.45)]" style={{ background: '#070c1e' }}>
      <style>{CSS}</style>

      {/* ── 상단 바 ── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2" style={{ background: 'linear-gradient(180deg,#101a3a,#0a1230)', borderBottom: '1px solid #1b2a55' }}>
        <div className="flex items-center gap-2 mr-1"><span className="of-logo">HUNDRED</span><span className="text-[11px] font-black text-white/70 tracking-[0.3em]">OFFICE</span></div>
        <Hud icon="👥" label="직원 관리" value={`${users.length}명`} tone="#93c5fd" />
        <Hud icon="🪙" label="이번 달 매출" value={rev ? `${won(rev.thisMonth)}원` : '…'} tone="#facc15" />
        <Hud icon="📣" label="보고 대기" value={`${waiting.length}건`} tone={waiting.length ? '#fb7185' : '#86efac'} />
        <Hud icon="🤖" label="AI 서브" value="8" tone="#c4b5fd" />
        <div className="ml-auto flex items-center gap-2">
          <span className="of-clock">{hour < 6 || hour >= 19 ? '🌙' : '☀️'} {String(hour).padStart(2, '0')}:{String(now.getUTCMinutes()).padStart(2, '0')}</span>
          {waiting.length > 0 && <button onClick={() => waiting.forEach(ack)} className="of-btn">전체 확인</button>}
          <button onClick={refresh} className="of-btn">새로고침</button>
          <button onClick={fullscreen} className="of-btn" title="전체화면">⛶</button>
          <button onClick={() => setManual(v => !v)} className="of-btn">{manual ? '닫기' : '?'}</button>
        </div>
      </div>

      {manual && (
        <div className="mx-3 mt-3 rounded-lg border border-white/15 bg-black/30 px-4 py-3 text-[12px] leading-relaxed text-white/85 of-pop">
          <p className="font-black text-[#facc15] mb-1">★ 사무실 사용법</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>마우스를 팀이나 직원에 올리면 간단한 현황이 뜹니다. <b>클릭하면 그 팀으로 줌인</b>되고 오른쪽에 자세한 내용이 나옵니다. 빈 곳을 누르면 전체 보기로 돌아갑니다.</li>
            <li>직원이나 색상 AI 가 보고할 게 생기면 <b>대표 앞에 와서</b> 말풍선으로 보고합니다. [확인]을 누르면 자리로 돌아가고, [이동]은 해당 화면으로 갑니다.</li>
            <li>색상 AI 가 카톡을 보냈거나 일을 끝내면 그 내용도 대표 앞에 와서 보고합니다.</li>
            <li>노랑 = 매출 분석, 초록 = 세무, 핑크 = 검수(돌아다니며 확인). 테스트 계정은 표시하지 않습니다.</li>
          </ul>
        </div>
      )}

      {/* ── 3D 무대 (창 안에 딱 맞게) ── */}
      <div ref={stageRef} className="relative w-full overflow-hidden select-none" style={{ height: stageH }} onMouseMove={onStageMove}>
        <Sky />
        <Office3D
          clusters={clusters as SceneCluster[]}
          slots={slots}
          pinkSlot={pinkSlot}
          selectedId={selId}
          focusDept={focus}
          hoverDept={hoverDept}
          onHover={(dept, id) => setHover(h => (h.dept === dept && h.id === id ? h : { dept, id }))}
          onPick={pick}
          renderSign={renderSign}
          bubbleIds={bubbleIds}
          renderBubble={renderBubble}
          pinkSay={pinkSay}
        />

        {/* 마우스 올렸을 때 설명 (마우스를 따라다닌다) */}
        <div ref={tipRef} className="of3-tip" style={{ opacity: hoverDept ? 1 : 0, pointerEvents: 'none' }}>
          {hoverDept && (() => {
            const D = DEPT[hoverDept], info = infoFor(hoverDept)
            return (
              <>
                <p className="flex items-center gap-1.5"><i className="of-dot" style={{ background: D.accent }} /><b>{D.label}</b><span className="text-white/50 text-[10.5px]"> · {D.agent} {D.agentRole}</span></p>
                {hoverItem && hoverItem.kind === 'human' && <p className="of3-tip-h">{hoverItem.label}{repOf(hoverItem.id)[0] ? ' — ' + repOf(hoverItem.id)[0].lines[0] : ''}</p>}
                <p className="of3-tip-b">{info.long}</p>
                <p className="text-[10px] text-white/40 mt-1">클릭하면 확대해서 자세히 봅니다</p>
              </>
            )
          })()}
        </div>

        {/* 오른쪽 상세 (클릭 → 줌인) */}
        {focus && focusInfo && (
          <div className="of-panel" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-black text-white/90">{DEPT[focus].label} 자세히</p>
              <button onClick={() => { setFocus(null); setSelId(null) }} className="text-[11px] text-white/70 hover:text-white border border-white/20 rounded px-2 py-0.5">← 전체 보기</button>
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <span className="of-avatar" style={{ background: DEPT[focus].accent }}>{DEPT[focus].agent.slice(0, 2)}</span>
              <div className="leading-tight min-w-0"><p className="text-[15px] font-black text-white truncate">{DEPT[focus].label}</p><p className="text-[10.5px] text-white/55">{DEPT[focus].agent} · {DEPT[focus].agentRole}</p></div>
            </div>
            <p className="of-k">현황</p><div className="of-v">{focusInfo.long}</div>
            {focusInfo.pct != null && <div className="of-meter mt-2" style={{ height: 8 }}><i style={{ width: `${Math.min(100, focusInfo.pct)}%`, background: DEPT[focus].accent }} /></div>}
            <p className="of-k">자리에 있는 사람 · AI</p>
            <ul className="space-y-1.5 mt-1">
              {focusItems.map(it => {
                const reps = repOf(it.id)
                return (
                  <li key={it.id} className={`of-row ${selId === it.id ? 'on' : ''}`} onClick={() => setSelId(it.id)}>
                    <div className="flex items-center gap-2"><span className="of-mini" style={{ background: it.accent }} /><b className="text-[12.5px] text-white">{it.label}</b><span className="text-[10px] text-white/45">{it.kind === 'bot' ? 'AI 서브' : it.dept === 'ceo' ? '대표' : '직원'}</span></div>
                    {reps.length > 0 ? reps.map(r => <p key={r.id} className="text-[11.5px] text-amber-200 mt-0.5">• {r.lines.join(' · ')}</p>) : <p className="text-[11px] text-white/40 mt-0.5">{it.kind === 'bot' ? DEPT[it.dept].agentRole : '보고 없음'}</p>}
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 flex gap-1.5">
              {waiting.some(r => r.dept === focus) && <button className="of-ok" style={{ padding: '4px 12px' }} onClick={() => waiting.filter(r => r.dept === focus).forEach(ack)}>이 팀 보고 확인</button>}
              <button className="of-open" onClick={() => onNavigate(DEPT[focus].go)}>{DEPT[focus].label} 화면으로 ↗</button>
            </div>
          </div>
        )}

        {/* 아래 칩 — AI 서브 */}
        <div className="of-chips">
          {DEPTS.map(d => (
            <button key={d.key} onClick={() => pick(d.key, 'bot:' + d.key)} className={`of-chip ${focus === d.key ? 'on' : ''}`}><i className="of-dot" style={{ background: d.accent }} />{d.agent}<span className="text-white/45">{d.label}</span></button>
          ))}
        </div>
      </div>

      {!data && <p className="text-center text-[12px] text-white/50 py-1">사무실 불러오는 중…</p>}
    </section>
  )
}

function Hud({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: string }) {
  return (
    <div className="of-hud">
      <span className="text-[14px] leading-none">{icon}</span>
      <div className="leading-tight"><p className="text-[9px] font-bold text-white/45 tracking-wider">{label}</p><p className="text-[13px] font-black" style={{ color: tone }}>{value}</p></div>
    </div>
  )
}

const CSS = `
@keyframes of-pop { 0% { transform: scale(.92); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
.of-pop { animation: of-pop .25s ease-out both }
.of-logo { font-weight: 900; font-size: 15px; letter-spacing: .14em; color: #fde68a; text-shadow: 0 0 10px #facc1566 }
.of-hud { display: flex; align-items: center; gap: 7px; padding: 3px 10px; background: #0b1332; border: 1px solid #25347a; border-radius: 8px }
.of-clock { font-size: 12px; font-weight: 800; color: #e5e7eb; background: #0b1332; border: 1px solid #25347a; border-radius: 8px; padding: 5px 9px; font-family: ui-monospace, monospace }
.of-btn { font-size: 11px; font-weight: 800; color: #e5e7eb; background: #1b2766; border: 1px solid #34449a; border-radius: 8px; padding: 5px 10px }
.of-btn:hover { background: #2a3a8c }
.of3-pill { display: inline-block; font-size: 11px; font-weight: 800; padding: 1px 8px; border-radius: 7px; background: rgba(9,14,33,.9); color: #fff; border: 1px solid #3a4a8a; white-space: nowrap; line-height: 1.4; box-shadow: 0 2px 6px rgba(0,0,0,.4) }
.of3-say { font-size: 10.5px; font-weight: 800; background: #fff; color: #111; padding: 2px 9px; border: 2px solid #f472b6; border-radius: 9px; white-space: nowrap; margin-bottom: 18px }
.of3-sign { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 92px; padding: 5px 11px 6px; border-radius: 11px; border: 1.5px solid #2a3a72; background: linear-gradient(180deg, rgba(22,32,74,.95), rgba(10,16,40,.95)); color: #fff; text-align: center; transition: transform .15s, border-color .15s; box-shadow: 0 6px 16px rgba(0,0,0,.45) }
.of3-sign:hover, .of3-sign.on { transform: translateY(-2px); border-color: #6b86ff }
.of3-sign b { font-size: 13px; font-weight: 900 }
.of3-sub { font-size: 11px; font-weight: 800; color: #fde68a }
.of-meter { width: 100%; height: 6px; border-radius: 3px; background: #0a1030; border: 1px solid #25347a; overflow: hidden }
.of-meter i { display: block; height: 100%; transition: width .8s }
.of-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50% }
.of-report { position: relative; width: 168px; margin: 4px 0; background: #fff; color: #111; border: 3px solid; border-radius: 11px; padding: 6px 9px 7px; font-size: 11.5px; line-height: 1.32; animation: of-pop .25s ease-out both; box-shadow: 0 8px 20px rgba(0,0,0,.5) }
.of-report p { margin: 0 }
.of-tail-d { position: absolute; left: 50%; bottom: -7px; width: 11px; height: 11px; background: #fff; transform: translateX(-50%) rotate(45deg); border-right: 3px solid; border-bottom: 3px solid }
.of-tail-u { position: absolute; left: 50%; top: -7px; width: 11px; height: 11px; background: #fff; transform: translateX(-50%) rotate(45deg); border-left: 3px solid; border-top: 3px solid }
.of-ok { font-size: 10.5px; font-weight: 900; background: #16a34a; color: #fff; border: 2px solid #0b5a28; border-radius: 6px; padding: 1px 10px }
.of-ok:hover { background: #22c55e }
.of-go { font-size: 10.5px; font-weight: 800; background: #e5e7eb; color: #111; border: 2px solid #9ca3af; border-radius: 6px; padding: 1px 9px }
.of-open { font-size: 11px; font-weight: 800; background: #3b82f6; color: #fff; border-radius: 6px; padding: 4px 10px }
.of-open:hover { background: #60a5fa }
.of3-tip { position: absolute; left: 0; top: 0; width: 280px; padding: 9px 12px 10px; border-radius: 12px; background: rgba(8,13,34,.95); border: 1px solid #3a4cb0; color: #fff; z-index: 40000; box-shadow: 0 12px 30px rgba(0,0,0,.55); transition: opacity .12s }
.of3-tip b { font-size: 13px }
.of3-tip-h { margin-top: 4px; font-size: 12px; font-weight: 800; color: #fde68a }
.of3-tip-b { margin-top: 4px; font-size: 12px; line-height: 1.45; color: #e6ecff; font-weight: 600 }
.of-panel { position: absolute; right: 12px; top: 12px; bottom: 56px; width: 300px; max-width: calc(100% - 24px); overflow-y: auto; padding: 12px 14px 14px; border-radius: 14px; background: rgba(8,13,34,.94); border: 1px solid #2a3a8a; color: #fff; z-index: 30000; box-shadow: 0 10px 30px rgba(0,0,0,.5); animation: of-pop .2s ease-out both }
.of-avatar { width: 40px; height: 40px; border-radius: 11px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; color: #101521; flex-shrink: 0 }
.of-k { margin-top: 11px; font-size: 10px; font-weight: 800; color: #7f93d6; letter-spacing: .04em }
.of-v { margin-top: 3px; font-size: 12px; line-height: 1.5; color: #e6ecff; font-weight: 600 }
.of-row { padding: 7px 9px; border-radius: 9px; background: #101a44; border: 1px solid #22307a; cursor: pointer }
.of-row.on, .of-row:hover { border-color: #5b78e6; background: #17235c }
.of-mini { width: 9px; height: 9px; border-radius: 50% }
.of-chips { position: absolute; left: 12px; bottom: 10px; display: flex; flex-wrap: wrap; gap: 6px; max-width: calc(100% - 340px); z-index: 29000; padding: 6px 8px; border-radius: 12px; background: rgba(8,13,34,.8); border: 1px solid #1f2d6a }
.of-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: #fff; padding: 3px 9px; border-radius: 999px; background: #121c4a; border: 1px solid #2a3a8a }
.of-chip:hover, .of-chip.on { background: #26378f; border-color: #5b78e6 }
`
