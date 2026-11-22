'use client'

// 헌드레드 사무실 — 대표 첫 화면. 게임처럼 꾸민 픽셀 사무실.
//  · 부서별 방(대표실·매출관리·세무관리·법무서식 / 영업팀·발굴팀·관리팀·총괄검수)에 실제 직원과 AI 서브(색상 이름)가 앉아 일한다.
//  · 직원이 계약·보고·심사요청 같은 걸 올리면 자리에서 일어나 '대표실 앞'에 서서 보고한다. 대표가 확인(클릭)하면 자리로 돌아간다.
//  · 발굴팀은 "오늘 N개 했습니다! 대기·승인·이번 달 목표 달성률" 을 보고한다.
//  · 노랑(매출분석)은 이번 달 매출과 얼마나 더 필요한지, 초록(세무)은 파킹통장에 들고 있어야 할 금액을 말한다.
//  · 핑크(검수)는 계속 돌아다니며 보고가 생긴 곳에 가서 확인한다.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { isTester } from '@/lib/tester'
import { bizDays } from '@/lib/digStats'

type DeptKey = 'ceo' | 'revenue' | 'tax' | 'legal' | 'sales' | 'dig' | 'ops' | 'qa'
type Pt = { x: number; y: number }

type Dept = {
  key: DeptKey; label: string; agent: string; agentRole: string
  floor: string; floor2: string; accent: string
  rect: { x: number; y: number; w: number; h: number }   // 무대 안 % 좌표
  role?: 'sales' | 'ops' | 'dig'
  go: string       // 클릭 시 이동할 탭
}

// 무대 1000 x 660 기준 % 배치 — 위 4개 방, 가운데 복도, 아래 4개 방
const DEPTS: Dept[] = [
  { key: 'ceo',     label: '대표실',     agent: '빨강', agentRole: 'CRM 개발·총괄',     floor: '#8a6a45', floor2: '#7c5e3c', accent: '#ef4444', rect: { x: 1,  y: 9,  w: 23.5, h: 25 }, go: 'overview' },
  { key: 'revenue', label: '매출관리',   agent: '노랑', agentRole: '매출 분석',          floor: '#c7a53e', floor2: '#b8962f', accent: '#facc15', rect: { x: 25.5, y: 9, w: 23.5, h: 25 }, go: 'analytics' },
  { key: 'tax',     label: '세무관리',   agent: '초록', agentRole: '세금 계산',          floor: '#3f8a5a', floor2: '#357a4e', accent: '#22c55e', rect: { x: 50, y: 9,  w: 23.5, h: 25 }, go: 'analytics' },
  { key: 'legal',   label: '법무·서식',  agent: '파랑', agentRole: '계약서·서식',        floor: '#3d73b3', floor2: '#3466a0', accent: '#3b82f6', rect: { x: 74.5, y: 9, w: 24.5, h: 25 }, go: 'rules' },
  { key: 'sales',   label: '영업팀',     agent: '남색', agentRole: '영업 코칭·현황',     floor: '#4a55a0', floor2: '#404a90', accent: '#6366f1', rect: { x: 1,  y: 58, w: 23.5, h: 35 }, role: 'sales', go: 'sales' },
  { key: 'dig',     label: '발굴팀',     agent: '보라', agentRole: 'DB 발굴·중복 점검',  floor: '#84519a', floor2: '#744588', accent: '#a855f7', rect: { x: 25.5, y: 58, w: 23.5, h: 35 }, role: 'dig', go: 'dig' },
  { key: 'ops',     label: '관리팀',     agent: '주황', agentRole: '카톡 단톡방·서류',   floor: '#c26a2e', floor2: '#b05e26', accent: '#f97316', rect: { x: 50, y: 58, w: 23.5, h: 35 }, role: 'ops', go: 'ops' },
  { key: 'qa',      label: '총괄 검수',  agent: '핑크', agentRole: '실행 전 검수·순찰',  floor: '#c0517f', floor2: '#ad4572', accent: '#ec4899', rect: { x: 74.5, y: 58, w: 24.5, h: 35 }, go: 'overview' },
]
const DEPT = Object.fromEntries(DEPTS.map(d => [d.key, d])) as Record<DeptKey, Dept>

// ── 도트 캐릭터 ─────────────────────────────────────────
const HAIR = ['#2b2018', '#4a3020', '#1a1a1a', '#6b4a2a', '#3a2a40', '#7a4a20']
const SKIN = ['#f1c9a0', '#e8b98a', '#f5d6b4', '#d9a577']
const hash = (s: string) => Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

function Human({ name, shirt, mode = 'idle', raised = false, scale = 3, you = false }: { name: string; shirt: string; mode?: 'idle' | 'type' | 'walk'; raised?: boolean; scale?: number; you?: boolean }) {
  const h = hash(name)
  const hair = HAIR[h % HAIR.length], skin = SKIN[(h >> 2) % SKIN.length], style = (h >> 4) % 3
  const cls = raised ? 'of-raise' : mode === 'type' ? 'of-head' : mode === 'walk' ? 'of-step' : ''
  const st = (d = 0): CSSProperties => ({ animationDelay: `${(h % 600) + d}ms` })
  return (
    <svg width={10 * scale} height={14 * scale} viewBox="0 0 10 14" shapeRendering="crispEdges" className={cls} style={st()} aria-hidden>
      {/* 머리카락 3종 */}
      {style === 0 && <><rect x="3" y="0" width="4" height="1" fill={hair} /><rect x="2" y="1" width="6" height="2" fill={hair} /></>}
      {style === 1 && <><rect x="2" y="0" width="6" height="2" fill={hair} /><rect x="2" y="2" width="1" height="3" fill={hair} /><rect x="7" y="2" width="1" height="3" fill={hair} /></>}
      {style === 2 && <><rect x="3" y="0" width="4" height="1" fill={hair} /><rect x="2" y="1" width="6" height="1" fill={hair} /><rect x="2" y="2" width="2" height="1" fill={hair} /></>}
      <rect x="3" y="3" width="4" height="3" fill={skin} />
      <rect x="4" y="4" width="1" height="1" fill="#222" /><rect x="6" y="4" width="1" height="1" fill="#222" />
      <rect x="2" y="6" width="6" height="4" fill={shirt} />
      <rect x="4" y="6" width="2" height="1" fill="#fff" opacity=".9" />
      {you && <rect x="4" y="8" width="2" height="1" fill="#facc15" />}
      {mode === 'type' ? (
        <><rect className="of-armA" style={st()} x="1" y="7" width="1" height="3" fill={shirt} /><rect className="of-armB" style={st()} x="8" y="7" width="1" height="3" fill={shirt} /></>
      ) : mode === 'walk' ? (
        <><rect className="of-armB" style={st()} x="1" y="7" width="1" height="3" fill={shirt} /><rect className="of-armA" style={st()} x="8" y="7" width="1" height="3" fill={shirt} /></>
      ) : (
        <><rect x="1" y="7" width="1" height="3" fill={shirt} />{raised ? <><rect x="8" y="2" width="1" height="5" fill={shirt} /><rect x="8" y="1" width="1" height="1" fill={skin} /></> : <rect x="8" y="7" width="1" height="3" fill={shirt} />}</>
      )}
      <rect className={mode === 'walk' ? 'of-legA' : ''} style={st()} x="3" y="10" width="2" height="4" fill="#2a2f3a" />
      <rect className={mode === 'walk' ? 'of-legB' : ''} style={st()} x="5" y="10" width="2" height="4" fill="#2a2f3a" />
    </svg>
  )
}

function Bot({ accent, name, mode = 'idle', scale = 3 }: { accent: string; name: string; mode?: 'idle' | 'walk'; scale?: number }) {
  const h = hash(name)
  return (
    <svg width={10 * scale} height={14 * scale} viewBox="0 0 10 14" shapeRendering="crispEdges" className={mode === 'walk' ? 'of-step' : 'of-bob'} style={{ animationDelay: `${h % 500}ms` }} aria-hidden>
      <rect x="4" y="0" width="2" height="1" fill={accent} /><rect x="5" y="1" width="1" height="1" fill="#9ca3af" />
      <rect x="2" y="2" width="6" height="4" fill="#d1d5db" /><rect x="2" y="2" width="6" height="1" fill="#f3f4f6" />
      <rect className="of-blink" x="3" y="3" width="1" height="2" fill={accent} /><rect className="of-blink" x="6" y="3" width="1" height="2" fill={accent} />
      <rect x="2" y="6" width="6" height="4" fill={accent} /><rect x="4" y="7" width="2" height="2" fill="#fff" opacity=".85" />
      <rect x="1" y="7" width="1" height="3" fill="#9ca3af" /><rect x="8" y="7" width="1" height="3" fill="#9ca3af" />
      <rect className={mode === 'walk' ? 'of-legA' : ''} x="3" y="10" width="2" height="4" fill="#6b7280" />
      <rect className={mode === 'walk' ? 'of-legB' : ''} x="5" y="10" width="2" height="4" fill="#6b7280" />
    </svg>
  )
}

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
  const [u, rv, pn, tx, dg, cu, rp, as] = await Promise.all([
    jget('/api/users'), jget('/api/revenue'), jget('/api/analytics/pnl'), jget('/api/tax-calc'),
    jget('/api/dig-prospects?status=all'), jget('/api/customers'), jget('/api/reports'), jget('/api/assign'),
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
  }
}

// ── 보고 만들기 ────────────────────────────────────────
type Report = { id: string; dept: DeptKey; who: string; lines: string[]; sig: string; go: string; sub?: string }

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

function Walker({ pos, children, z, moving }: { pos: Pt; children: React.ReactNode; z?: number; moving?: boolean }) {
  return (
    <div className="absolute" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%,-100%)', transition: 'left 1.8s linear, top 1.8s linear', zIndex: z ?? Math.round(pos.y * 10), pointerEvents: 'none' }} data-moving={moving ? 1 : 0}>
      {children}
    </div>
  )
}

export default function OfficeTab({ onNavigate }: { onNavigate: (tab: string, sub?: string) => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [acked, setAcked] = useState<Record<string, string>>({})
  const [now, setNow] = useState(() => kstNow())
  const [manual, setManual] = useState(false)
  const [patrol, setPatrol] = useState(0)
  const alive = useRef(true)

  const refresh = useCallback(async () => { const d = await loadAll(); if (alive.current) setData(d) }, [])
  useEffect(() => { alive.current = true; setAcked(readAck()); refresh(); const t = setInterval(() => { if (!document.hidden) refresh() }, 60_000); return () => { alive.current = false; clearInterval(t) } }, [refresh])
  useEffect(() => { const t = setInterval(() => setNow(kstNow()), 30_000); return () => clearInterval(t) }, [])

  const reports = useMemo(() => (data ? buildReports(data) : []), [data])
  const waiting = reports.filter(r => acked[r.id] !== r.sig)
  const ack = (r: Report) => { const next = { ...acked, [r.id]: r.sig }; setAcked(next); try { localStorage.setItem(ACK_KEY, JSON.stringify(next)) } catch {} }

  // 핑크(검수) 순찰: 4초마다 다음 목적지로 — 보고가 있으면 그 사람 쪽, 없으면 방들을 돈다
  useEffect(() => { const t = setInterval(() => setPatrol(p => p + 1), 4200); return () => clearInterval(t) }, [])

  const hour = now.getUTCHours()
  const night = hour < 6 || hour >= 19
  const users = data?.users || []
  const staff = (d: Dept) => (d.role ? users.filter(u => u.role === d.role) : [])
  const biz = bizDays(kstNow().toISOString().slice(0, 7)).total
  const digCount = staff(DEPT.dig).length

  // 위치 계산
  const deskPos = (d: Dept, i: number, n: number): Pt => {
    const cols = Math.min(Math.max(n, 1), 4), col = i % cols, row = Math.floor(i / cols)
    const span = d.rect.w * 0.78, x0 = d.rect.x + d.rect.w * 0.11
    return { x: x0 + (cols === 1 ? span / 2 : (span * col) / (cols - 1)), y: d.rect.y + d.rect.h * (0.78 + row * 0.2) }
  }
  const doorPos = (i: number): Pt => ({ x: 8 + (i % 7) * 13, y: 42 })
  const botPos = (d: Dept): Pt => ({ x: d.rect.x + d.rect.w * 0.9, y: d.rect.y + d.rect.h * 0.62 })

  // 핑크 목적지 — 보고 대기가 있으면 그 직원들 옆을 차례로, 없으면 방들을 돌며 순찰
  const roomStops: Pt[] = DEPTS.filter(d => d.key !== 'qa').map(d => ({ x: d.rect.x + d.rect.w * 0.5, y: ['ceo', 'revenue', 'tax', 'legal'].includes(d.key) ? 50 : 54 }))
  const stops: Pt[] = waiting.length > 0 ? waiting.map((_, i) => ({ x: doorPos(i).x + 6, y: 47 })) : roomStops
  const pinkAt = stops[patrol % stops.length]
  const pinkSay = waiting.length > 0 ? `${waiting[patrol % waiting.length].who} 보고 확인 중…` : ['순찰 중…', '이상 없음 ✔', '장부 점검 중', '서식 확인 ✔'][patrol % 4]

  const rev = data?.rev, pnl = data?.pnl, tax = data?.tax
  const need = pnl?.hasCost && rev ? Math.max(0, pnl.cost - rev.thisMonth) : 0
  const revSay = !rev ? '집계 중…' : pnl?.hasCost
    ? (need > 0 ? `이번 달 매출 ${won(rev.thisMonth)}원! 비용 ${won(pnl.cost)}원 맞추려면 ${won(need)}원 더 필요해요 (${pnl.label})` : `이번 달 매출 ${won(rev.thisMonth)}원! 비용 ${won(pnl.cost)}원을 넘겼어요, 순이익 약 ${won(rev.thisMonth - pnl.cost)}원 (${pnl.label})`)
    : `이번 달 매출 ${won(rev.thisMonth)}원 (영업 ${won(rev.sales)} · 관리 ${won(rev.ops)})`
  const taxSay = tax ? `지금 상황이면 파킹통장에 ${won(tax.parking)}원 들고 계세요!${tax.nextDue ? ` 다음 ${tax.nextLabel} ${tax.nextDue.slice(5).replace('-', '/')}` : ''}` : '세금 계산 중…'
  const monthDig = (data?.dig || []).filter(p => String(p.call_date || p.created_at || '').slice(0, 7) === kstNow().toISOString().slice(0, 7) && (p.status === 'approved' || p.status === 'assigned') && !isTester(p.dig_user_name, p.dig_user_username)).length
  const digGoal = digCount * biz * 8
  const digPct = digGoal > 0 ? Math.round((monthDig / digGoal) * 100) : 0

  const infoFor = (k: DeptKey): { head: string; body: string; pct?: number } | null => {
    if (k === 'ceo') return { head: '이번 달 총매출', body: rev ? `${won(rev.thisMonth)}원` : '…' }
    if (k === 'revenue') return { head: '매출분석 보고', body: revSay + (rev && rev.receivableCount > 0 ? ` · 받을 잔금 ${rev.receivableCount}건 ${won(rev.receivableSum)}원${rev.overdueCount ? `(기한 지남 ${rev.overdueCount})` : ''}` : '') }
    if (k === 'tax') return { head: '세무 보고', body: taxSay }
    if (k === 'sales') return { head: '영업팀 매출', body: rev ? `${won(rev.sales)}원` : '…' }
    if (k === 'ops') return { head: '관리팀 매출', body: rev ? `${won(rev.ops)}원` : '…' }
    if (k === 'dig') return { head: '이번 달 승인', body: `${monthDig}/${digGoal || '-'}개`, pct: digPct }
    if (k === 'legal') return { head: '서식·계약서', body: '계약서 · 약관 · 서식 담당' }
    if (k === 'qa') return { head: '검수 현황', body: `보고 ${waiting.length}건 확인 대기` }
    return null
  }

  const bg = night ? 'linear-gradient(180deg,#05081a,#0a1030)' : 'linear-gradient(180deg,#14214d,#0e1838)'
  const sky = night ? '#0b1233' : '#7cc3ff'

  return (
    <section className="rounded-2xl overflow-hidden border-2 border-[#0e1428] shadow-[0_8px_0_#070b18]" style={{ background: bg }}>
      <style>{CSS}</style>

      {/* ── HUD ── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5" style={{ background: 'linear-gradient(180deg,#1b2552,#111a3d)', borderBottom: '3px solid #0a1030' }}>
        <div className="flex items-center gap-2 mr-2">
          <span className="of-logo">HUNDRED</span><span className="text-[12px] font-black text-white/90 tracking-widest">OFFICE</span>
        </div>
        <Hud icon="🪙" label="이번 달 매출" value={rev ? `${won(rev.thisMonth)}원` : '…'} tone="#facc15" />
        <Hud icon="📣" label="보고 대기" value={`${waiting.length}건`} tone={waiting.length ? '#fb7185' : '#86efac'} />
        <Hud icon="👥" label="직원" value={`${users.length}명`} tone="#93c5fd" />
        <Hud icon="🤖" label="AI 서브" value="8" tone="#c4b5fd" />
        <div className="ml-auto flex items-center gap-2">
          <span className="of-clock">{night ? '🌙' : '☀️'} {String(hour).padStart(2, '0')}:{String(now.getUTCMinutes()).padStart(2, '0')}</span>
          <button onClick={() => setManual(v => !v)} className="of-btn">{manual ? '닫기' : '도움말'}</button>
          <button onClick={refresh} className="of-btn">새로고침</button>
        </div>
      </div>

      {manual && (
        <div className="mx-3 mt-3 rounded-lg border-2 border-white/15 bg-black/30 px-4 py-3 text-[12px] leading-relaxed text-white/85 of-pop">
          <p className="font-black text-[#facc15] mb-1">★ 사무실 사용법</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>직원이 계약·보고·심사요청을 올리면 자리에서 일어나 <b>대표실 앞</b>에 서서 말풍선으로 보고합니다.</li>
            <li>말풍선의 <b>[확인]</b>을 누르면 보고를 받은 것으로 처리되고 직원이 자리로 돌아갑니다. <b>[이동]</b>은 해당 화면으로 갑니다.</li>
            <li>발굴팀은 오늘 한 개수, 대기·승인, 이번 달 목표 달성률을 보고합니다.</li>
            <li>노랑 = 매출 분석(이번 달 매출·더 필요한 금액), 초록 = 세무(파킹통장에 들고 있어야 할 금액), 핑크 = 검수(돌아다니며 확인).</li>
            <li>방을 누르면 그 부서 화면으로 이동합니다. 테스트 계정은 표시하지 않습니다.</li>
          </ul>
        </div>
      )}

      {/* ── 무대 ── */}
      <div className="overflow-x-auto p-3">
        <div className="relative mx-auto select-none" style={{ aspectRatio: '1000 / 660', minWidth: 1100, maxWidth: 1400, background: '#2a3050', border: '4px solid #0a1030', borderRadius: 10, boxShadow: 'inset 0 0 0 3px #3a4270' }}>
          {/* 바닥 타일 + 복도 */}
          <div className="absolute inset-0 of-tiles" />
          {/* 창문(하늘) */}
          <div className="absolute left-0 right-0 top-0" style={{ height: '7%', background: sky, borderBottom: '4px solid #0a1030' }}>
            {night
              ? Array.from({ length: 14 }).map((_, i) => <span key={i} className="of-star" style={{ left: `${(i * 73) % 100}%`, top: `${(i * 37) % 70}%`, animationDelay: `${i * 230}ms` }} />)
              : <><span className="of-cloud" style={{ left: '12%', top: '20%' }} /><span className="of-cloud" style={{ left: '58%', top: '35%', animationDelay: '-9s' }} /><span className="of-sun" /></>}
            <p className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-black tracking-[0.3em] text-white/80" style={{ textShadow: '0 1px 0 #0006' }}>HUNDRED CONSULTING</p>
          </div>

          {DEPTS.map(d => (
            <Room key={d.key} d={d} info={infoFor(d.key)} active={(d.key === 'sales' || d.key === 'ops' || d.key === 'dig') && waiting.some(r => r.dept === d.key)} onPick={() => onNavigate(d.go)} night={night} />
          ))}

          {/* 복도 표지 */}
          <div className="absolute text-[10px] font-black tracking-[0.4em] text-white/25" style={{ left: '50%', top: '53%', transform: 'translateX(-50%)' }}>— CORRIDOR —</div>
          <div className="absolute of-doormat" style={{ left: '1%', top: '36.5%', width: '98%', height: '19%' }}>
            <span className="absolute left-2 top-1 text-[10px] font-black tracking-widest text-[#facc15]/80">▲ 대표실 앞 · 보고 구역 (직원이 여기 서서 보고합니다)</span>
          </div>

          {/* 대표 */}
          <Walker pos={{ x: DEPT.ceo.rect.x + DEPT.ceo.rect.w * 0.5, y: DEPT.ceo.rect.y + DEPT.ceo.rect.h * 0.8 }}>
            <Human name="대표" shirt="#ef4444" mode="idle" you />
            <NameTag text="대표" gold />
          </Walker>

          {/* AI 서브 */}
          {DEPTS.filter(d => d.key !== 'qa').map(d => (
            <Walker key={'bot' + d.key} pos={botPos(d)}>
              <Bot accent={d.accent} name={d.agent} />
              <NameTag text={d.agent} color={d.accent} />
            </Walker>
          ))}
          <Walker pos={pinkAt} z={9990} moving>
            <div className="of-say" style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4, whiteSpace: 'nowrap', borderColor: DEPT.qa.accent }}>{pinkSay}</div>
            <Bot accent={DEPT.qa.accent} name="핑크" mode="walk" />
            <NameTag text="핑크" color={DEPT.qa.accent} />
          </Walker>

          {/* 직원 */}
          {DEPTS.filter(d => d.role).map(d => staff(d).map((u, i, arr) => {
            const rep = waiting.find(r => r.dept === d.key && r.who === u.name)
            const wi = rep ? waiting.indexOf(rep) : -1
            const pos = rep ? doorPos(wi) : deskPos(d, i, arr.length)
            return (
              <Walker key={u.name + d.key} pos={pos} moving={!!rep} z={rep ? 9000 + wi : undefined}>
                {rep && (
                  <div className="absolute of-report" style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 10, pointerEvents: 'auto', borderColor: d.accent }}>
                    {rep.lines.map((l, k) => <p key={k} className={k === 0 ? 'font-black' : ''}>{l}</p>)}
                    <div className="mt-1 flex gap-1">
                      <button onClick={() => ack(rep)} className="of-ok">확인</button>
                      <button onClick={() => onNavigate(rep.go, rep.sub)} className="of-go">이동</button>
                    </div>
                    <span className="of-tail" style={{ borderColor: d.accent }} />
                  </div>
                )}
                <Human name={u.name} shirt={d.accent} mode={rep ? 'idle' : 'type'} raised={!!rep} />
                <NameTag text={strip(u.name)} />
              </Walker>
            )
          }))}
        </div>
      </div>

      {!data && <p className="text-center text-[12px] text-white/50 pb-4">사무실 불러오는 중…</p>}
    </section>
  )
}

function Hud({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: string }) {
  return (
    <div className="of-hud">
      <span className="text-[15px] leading-none">{icon}</span>
      <div className="leading-tight"><p className="text-[9px] font-bold text-white/50 tracking-wider">{label}</p><p className="text-[13px] font-black" style={{ color: tone }}>{value}</p></div>
    </div>
  )
}

function NameTag({ text, color, gold }: { text: string; color?: string; gold?: boolean }) {
  return <p className="of-name" style={{ background: gold ? '#facc15' : color || '#0e1428', color: gold || color ? '#111' : '#fff' }}>{text}</p>
}

function Room({ d, info, active, onPick, night }: { d: Dept; info: { head: string; body: string; pct?: number } | null; active: boolean; onPick: () => void; night: boolean }) {
  const r = d.rect
  return (
    <div className="absolute cursor-pointer group" onClick={onPick} style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}>
      {/* 방 바닥 */}
      <div className="absolute inset-0 rounded-[6px] overflow-hidden transition-transform group-hover:-translate-y-0.5" style={{ border: `4px solid ${active ? d.accent : '#10162e'}`, boxShadow: active ? `0 0 0 2px ${d.accent}77, 0 0 18px ${d.accent}66` : '0 4px 0 #070b18', background: `repeating-linear-gradient(90deg, ${d.floor} 0 28px, ${d.floor2} 28px 30px)` }}>
        {/* 벽 */}
        <div className="absolute left-0 right-0 top-0" style={{ height: '24%', background: `linear-gradient(180deg, #1a2140, #232c58)`, borderBottom: '3px solid #0a1030' }}>
          <span className="absolute left-2 top-1 text-[12px] font-black text-white tracking-tight" style={{ textShadow: '0 2px 0 #0008' }}>{d.label}</span>
          <span className="absolute right-1.5 top-1 flex items-center gap-1 text-[9.5px] font-black px-1.5 py-[1px] rounded-sm" style={{ background: d.accent, color: '#111' }}>
            <i className="inline-block w-1.5 h-1.5 rounded-full of-blink" style={{ background: '#111' }} />{d.agent}
          </span>
          {/* 창 */}
          <span className="absolute left-[38%] bottom-[8%]" style={{ width: 26, height: 12, background: night ? '#16224f' : '#9fd2ff', border: '2px solid #0a1030' }} />
        </div>
        {/* 가구: 화분 */}
        <span className="of-plant" style={{ right: 6, bottom: 6 }} />
        {d.key === 'qa' && <span className="of-shield" />}
        {/* 책상 라인 */}
        {d.role && <span className="absolute left-[8%] right-[8%]" style={{ top: '76%', height: 10, background: '#6e4f2c', border: '2px solid #3e2a14', boxShadow: '0 3px 0 #2c1d0d' }} />}
      </div>
      {/* 현황판 */}
      {info && (
        <div className="absolute left-[5%] right-[5%] of-board" style={{ top: '27%', borderColor: d.accent }}>
          <p className="text-[9px] font-black tracking-wider" style={{ color: d.accent }}>{info.head}</p>
          <p className={`${info.body.length > 22 ? 'text-[10.5px]' : 'text-[15px]'} font-black text-white leading-tight`}>{info.body}</p>
          {info.pct != null && (
            <div className="mt-1 h-2 rounded-sm overflow-hidden" style={{ background: '#0a1030', border: '1px solid #000' }}>
              <div className="h-full of-bar" style={{ width: `${Math.min(100, info.pct)}%`, background: `repeating-linear-gradient(90deg, ${d.accent} 0 6px, ${d.accent}bb 6px 8px)` }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const CSS = `
@keyframes of-raise { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes of-blink { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
@keyframes of-pop { 0% { transform: scale(.9); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
@keyframes of-armA { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1px) } }
@keyframes of-armB { 0%,100% { transform: translateY(-1px) } 50% { transform: translateY(0) } }
@keyframes of-legA { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1px) } }
@keyframes of-legB { 0%,100% { transform: translateY(-1px) } 50% { transform: translateY(0) } }
@keyframes of-head { 0%,100% { transform: translateY(0) } 50% { transform: translateY(.5px) } }
@keyframes of-step { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
@keyframes of-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
@keyframes of-twinkle { 0%,100% { opacity: .9 } 50% { opacity: .2 } }
@keyframes of-drift { from { transform: translateX(0) } to { transform: translateX(60px) } }
@keyframes of-glow { 0%,100% { box-shadow: 0 0 0 0 #facc1500 } 50% { box-shadow: 0 0 10px 2px #facc1566 } }
.of-armA { animation: of-armA .28s steps(2) infinite }
.of-armB { animation: of-armB .28s steps(2) infinite }
.of-legA { animation: of-legA .3s steps(2) infinite }
.of-legB { animation: of-legB .3s steps(2) infinite }
.of-head { animation: of-head 1.4s steps(2) infinite }
.of-step { animation: of-step .3s steps(2) infinite }
.of-bob { animation: of-bob 1.6s steps(2) infinite }
.of-raise { animation: of-raise .7s steps(2) infinite }
.of-blink { animation: of-blink 1.4s steps(2) infinite }
.of-pop { animation: of-pop .25s ease-out both }
@media (prefers-reduced-motion: reduce) { .of-armA,.of-armB,.of-legA,.of-legB,.of-head,.of-step,.of-bob,.of-raise,.of-blink { animation: none } }
.of-logo { font-weight: 900; font-size: 15px; letter-spacing: .12em; color: #facc15; text-shadow: 2px 2px 0 #7a5a00, 0 0 8px #facc1555 }
.of-hud { display: flex; align-items: center; gap: 7px; padding: 4px 10px; background: #0b1230; border: 2px solid #2a3570; border-radius: 6px; box-shadow: 0 2px 0 #060a1c }
.of-clock { font-size: 12px; font-weight: 900; color: #e5e7eb; background: #0b1230; border: 2px solid #2a3570; border-radius: 6px; padding: 4px 9px; font-family: ui-monospace, monospace }
.of-btn { font-size: 11px; font-weight: 800; color: #e5e7eb; background: #26306a; border: 2px solid #3a4690; border-radius: 6px; padding: 4px 9px; box-shadow: 0 2px 0 #060a1c }
.of-btn:hover { background: #33408a }
.of-tiles { background-color: #343c66; background-image: linear-gradient(45deg,#0003 25%,transparent 25%,transparent 75%,#0003 75%),linear-gradient(45deg,#0003 25%,transparent 25%,transparent 75%,#0003 75%); background-size: 24px 24px; background-position: 0 0,12px 12px }
.of-doormat { background: repeating-linear-gradient(135deg,#7a1f2a55 0 10px,#9b2c3a55 10px 20px); border: 2px dashed #facc1566; border-radius: 6px }
.of-name { font-size: 9.5px; font-weight: 900; padding: 1px 5px; border-radius: 3px; text-align: center; margin: 1px auto 0; width: max-content; max-width: 90px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border: 1px solid #000a; box-shadow: 0 1px 0 #000a }
.of-board { background: #0b1230; border: 2px solid; border-radius: 4px; padding: 4px 6px; box-shadow: 0 2px 0 #060a1c; pointer-events: none }
.of-bar { transition: width .8s steps(12) }
.of-say { font-size: 10px; font-weight: 800; background: #fff; color: #111; padding: 2px 7px; border: 2px solid; border-radius: 6px }
.of-report { width: 142px; background: #fff; color: #111; border: 3px solid; border-radius: 8px; padding: 5px 7px 6px; font-size: 11px; line-height: 1.3; animation: of-pop .25s ease-out both; box-shadow: 0 3px 0 #0006 }
.of-report p { margin: 0 }
.of-tail { position: absolute; left: 50%; top: -8px; width: 10px; height: 10px; background: #fff; border-left: 3px solid; border-top: 3px solid; transform: translateX(-50%) rotate(45deg) }
.of-ok { font-size: 10.5px; font-weight: 900; background: #16a34a; color: #fff; border: 2px solid #0b5a28; border-radius: 4px; padding: 1px 9px }
.of-ok:hover { background: #22c55e }
.of-go { font-size: 10.5px; font-weight: 800; background: #e5e7eb; color: #111; border: 2px solid #9ca3af; border-radius: 4px; padding: 1px 8px }
.of-plant { position: absolute; width: 14px; height: 22px; background: radial-gradient(circle at 50% 30%, #22c55e 0 7px, transparent 8px); }
.of-plant::after { content: ''; position: absolute; left: 3px; bottom: 0; width: 8px; height: 8px; background: #a16207; border: 1px solid #422006 }
.of-shield { position: absolute; left: 8px; bottom: 8px; width: 16px; height: 18px; background: #ec4899; clip-path: polygon(0 0,100% 0,100% 60%,50% 100%,0 60%); border: 2px solid #831843 }
.of-star { position: absolute; width: 3px; height: 3px; background: #fff; animation: of-twinkle 2s steps(3) infinite }
.of-cloud { position: absolute; width: 46px; height: 10px; background: #fff; border-radius: 6px; box-shadow: 10px -5px 0 #fff; animation: of-drift 18s linear infinite alternate }
.of-sun { position: absolute; right: 6%; top: 18%; width: 16px; height: 16px; background: #fde047; border-radius: 50%; box-shadow: 0 0 10px #fde047 }
`
