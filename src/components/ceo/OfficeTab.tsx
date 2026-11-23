'use client'

// 헌드레드 사무실 — 대표 첫 화면. 밤의 도시가 보이는 아이소메트릭(3D 느낌) 사무실.
//  · 가운데 홀로그램 테이블 둘레에 부서별 책상 클러스터(대표실·매출관리·세무관리·법무서식 / 영업팀·발굴팀·관리팀·총괄검수)가 있고
//    실제 직원과 AI 서브(색상 이름)가 자기 자리에 앉아 일한다.
//  · 직원이 계약·보고·심사요청 같은 걸 올리면 자리에서 일어나 '대표실 앞 보고 구역'에 서서 말풍선으로 보고한다. 대표가 [확인]하면 자리로 돌아간다.
//  · 직원/AI를 누르면 오른쪽에 '직원 살펴보기' 카드가 열려 맡은 일·오늘 보고·부서 현황을 보여 준다.
//  · 발굴팀은 "오늘 N개 했습니다! 대기·승인·이번 달 목표 달성률" 을 보고한다.
//  · 노랑(매출분석)은 이번 달 매출과 얼마나 더 필요한지, 초록(세무)은 파킹통장에 들고 있어야 할 금액을 말한다.
//  · 핑크(검수)는 계속 돌아다니며 보고가 생긴 곳에 가서 확인한다.
import { useCallback, useEffect, useId, useMemo, useRef, useState, memo } from 'react'
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

// ── 무대 기하 (화면 1200 x 760, 아이소메트릭) ─────────────────
const W = 1200, H = 760, U = 34, V = 17, CX = 600, CY = 110
const iso = (gx: number, gy: number): Pt => ({ x: CX + (gx - gy) * U, y: CY + (gx + gy) * V })
const P = (pts: Pt[]) => pts.map(p => `${p.x},${p.y}`).join(' ')
const CENTER: Pt = iso(8, 8)                      // (600, 382)
const RX = 315, RY = 151
const spotOf = (angle: number): Pt => ({ x: CENTER.x + RX * Math.cos((angle * Math.PI) / 180), y: CENTER.y + RY * Math.sin((angle * Math.PI) / 180) })
const SPOT = Object.fromEntries(DEPTS.map(d => [d.key, spotOf(d.angle)])) as Record<DeptKey, Pt>
const REPORT_Y = 318
const SLOT_X = [600, 500, 700, 400, 800, 300, 900]
const slotPos = (i: number): Pt => ({ x: SLOT_X[i % SLOT_X.length], y: REPORT_Y + Math.floor(i / SLOT_X.length) * 30 })

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

// ── 캐릭터 ─────────────────────────────────────────────
const HAIR = ['#20170f', '#3b2616', '#121212', '#5a3a1e', '#2d2236', '#6b3d17']
const SKIN = ['#f6d3b0', '#efc29a', '#f9dfc4', '#deae85']
const hash = (s: string) => Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

type Item = { id: string; kind: 'human' | 'bot'; name: string; label: string; dept: DeptKey; shirt: string; accent: string; user?: User; roam?: boolean }
type Pose = 'sit' | 'stand' | 'walk'

// 색 밝기 조절 (amt > 0 밝게, < 0 어둡게)
const shade = (hex: string, amt: number) => {
  const n = parseInt(hex.replace('#', ''), 16), f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))))
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join('')
}

// 부드러운 3D 느낌 캐릭터 — 그라데이션·하이라이트·부드러운 그림자로 입체감을 낸다 (픽셀/평면 느낌 X)
function Sprite({ item, pose, raised = false }: { item: Pick<Item, 'kind' | 'name' | 'shirt' | 'accent'>; pose: Pose; raised?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const h = hash(item.name)
  const delay = { animationDelay: `${h % 700}ms` }
  const G = (k: string) => `url(#${k}${uid})`
  const lin = (k: string, c: string, a = 0.28, b = -0.3, horiz = false) => (
    <linearGradient id={k + uid} x1="0" y1="0" x2={horiz ? 1 : 0} y2={horiz ? 0 : 1}><stop offset="0" stopColor={shade(c, a)} /><stop offset="1" stopColor={shade(c, b)} /></linearGradient>
  )
  const shadow = (
    <>
      <defs><radialGradient id={'sh' + uid}><stop offset="0" stopColor="#000" stopOpacity=".5" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient></defs>
      <ellipse cx="22" cy="61.5" rx="14" ry="3.6" fill={G('sh')} />
    </>
  )

  if (item.kind === 'bot') {
    const a = item.accent, sit = pose === 'sit'
    return (
      <svg width="44" height="64" viewBox="0 0 44 64" aria-hidden className={sit ? 'of-bob' : pose === 'walk' ? 'of-step' : 'of-bob'} style={delay}>
        <defs>
          {lin('bb', a, 0.35, -0.35)}{lin('bh', '#e8edf7', 0.5, -0.12)}{lin('bl', '#9aa3b5', 0.3, -0.3)}
          <radialGradient id={'bv' + uid} cx=".5" cy=".4" r=".7"><stop offset="0" stopColor="#1c2a5a" /><stop offset="1" stopColor="#070b1c" /></radialGradient>
        </defs>
        {shadow}
        {!sit && <><rect className={pose === 'walk' ? 'of-legA' : ''} x="15" y="47" width="6" height="13" rx="3" fill={G('bl')} /><rect className={pose === 'walk' ? 'of-legB' : ''} x="23" y="47" width="6" height="13" rx="3" fill={G('bl')} /></>}
        <rect className={sit ? 'of-armA' : ''} x="7" y={sit ? 36 : 31} width="6" height="14" rx="3" fill={G('bl')} />
        <rect className={sit ? 'of-armB' : ''} x="31" y={sit ? 36 : 31} width="6" height="14" rx="3" fill={G('bl')} />
        <rect x="12" y={sit ? 32 : 28} width="20" height={sit ? 21 : 22} rx="8" fill={G('bb')} />
        <ellipse cx="18" cy={sit ? 36 : 32} rx="4" ry="2" fill="#fff" opacity=".28" />
        <circle cx="22" cy={sit ? 43 : 39} r="3.2" fill="#fff" opacity=".85" />
        <line x1="22" y1="2" x2="22" y2="8" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" /><circle cx="22" cy="3" r="3" fill={G('bb')} className="of-blink" />
        <rect x="8" y={sit ? 11 : 7} width="28" height="24" rx="11" fill={G('bh')} />
        <ellipse cx="16" cy={sit ? 15 : 11} rx="6" ry="2.6" fill="#fff" opacity=".55" />
        <rect x="4" y={sit ? 19 : 15} width="5" height="9" rx="2.5" fill={G('bb')} /><rect x="35" y={sit ? 19 : 15} width="5" height="9" rx="2.5" fill={G('bb')} />
        {sit ? <rect x="13" y="16" width="18" height="4" rx="2" fill={a} opacity=".9" /> : (
          <><rect x="11" y="12" width="22" height="13" rx="6.5" fill={G('bv')} /><ellipse className="of-blink" cx="17" cy="18.5" rx="2.4" ry="3" fill={a} /><ellipse className="of-blink" cx="27" cy="18.5" rx="2.4" ry="3" fill={a} /><ellipse cx="22" cy="14" rx="7" ry="1.3" fill="#fff" opacity=".18" /></>
        )}
      </svg>
    )
  }

  const hair = HAIR[h % HAIR.length], skin = SKIN[(h >> 2) % SKIN.length], style = (h >> 4) % 3, shirt = item.shirt
  const defs = (
    <defs>
      {lin('sh2', shirt, 0.32, -0.32)}{lin('pt', '#2b3552', 0.25, -0.35)}{lin('hr', hair, 0.4, -0.2)}{lin('sk2', skin, 0.1, -0.12)}
      <radialGradient id={'hd' + uid} cx=".4" cy=".32" r=".8"><stop offset="0" stopColor={shade(skin, 0.28)} /><stop offset=".6" stopColor={skin} /><stop offset="1" stopColor={shade(skin, -0.18)} /></radialGradient>
      <radialGradient id={'ck' + uid}><stop offset="0" stopColor="#ff7f8a" stopOpacity=".55" /><stop offset="1" stopColor="#ff7f8a" stopOpacity="0" /></radialGradient>
    </defs>
  )
  if (pose === 'sit') {
    return (
      <svg width="44" height="64" viewBox="0 0 44 64" aria-hidden style={delay}>
        {defs}{shadow}
        <rect x="11" y="32" width="22" height="21" rx="9" fill={G('sh2')} />
        <rect className="of-armA" x="6" y="36" width="6" height="13" rx="3" fill={G('sh2')} />
        <rect className="of-armB" x="32" y="36" width="6" height="13" rx="3" fill={G('sh2')} />
        <rect x="18.5" y="29" width="7" height="6" rx="3" fill={G('sk2')} />
        <circle cx="22" cy="21" r="14" fill={G('hr')} />
        <ellipse cx="16" cy="13" rx="7" ry="3" fill="#fff" opacity=".22" />
        <circle cx="8.5" cy="25" r="2.8" fill={G('sk2')} /><circle cx="35.5" cy="25" r="2.8" fill={G('sk2')} />
        {style === 1 && <rect x="11" y="27" width="22" height="7" rx="3.5" fill={G('hr')} />}
      </svg>
    )
  }
  const walk = pose === 'walk'
  return (
    <svg width="44" height="64" viewBox="0 0 44 64" aria-hidden className={walk ? 'of-step' : raised ? 'of-raise' : ''} style={delay}>
      {defs}{shadow}
      <rect className={walk ? 'of-legA' : ''} x="14.5" y="46" width="6.5" height="14" rx="3" fill={G('pt')} /><rect className={walk ? 'of-legB' : ''} x="23" y="46" width="6.5" height="14" rx="3" fill={G('pt')} />
      <ellipse cx="17.5" cy="60" rx="4.6" ry="2.4" fill="#f3f5fa" /><ellipse cx="26.5" cy="60" rx="4.6" ry="2.4" fill="#f3f5fa" />
      <rect className={walk ? 'of-armB' : ''} x="7" y="30" width="6.5" height="15" rx="3.2" fill={G('sh2')} />
      <rect x="12" y="28" width="20" height="21" rx="9" fill={G('sh2')} />
      <ellipse cx="18" cy="33" rx="4.5" ry="2.2" fill="#fff" opacity=".25" />
      <path d="M18.5 28.5 L22 33 L25.5 28.5 Z" fill="#fff" opacity=".92" />
      {raised ? <><rect className="of-wave" x="30.5" y="12" width="6.5" height="20" rx="3.2" fill={G('sh2')} /><circle cx="33.7" cy="11" r="3.4" fill={G('hd')} /></> : <><rect className={walk ? 'of-armA' : ''} x="30.5" y="30" width="6.5" height="15" rx="3.2" fill={G('sh2')} /><circle cx="33.7" cy="45.5" r="3" fill={G('hd')} /></>}
      {!raised && <circle cx="10.2" cy="45.5" r="3" fill={G('hd')} />}
      <circle cx="22" cy="19" r="14" fill={G('hd')} />
      <circle cx="8.4" cy="21" r="2.6" fill={G('sk2')} /><circle cx="35.6" cy="21" r="2.6" fill={G('sk2')} />
      <path d="M8 19 Q7 3.5 22 3.5 Q37 3.5 36 19 Q31 10.5 22 10.5 Q13 10.5 8 19Z" fill={G('hr')} />
      <path d="M13 8 Q20 4 28 7" stroke="#fff" strokeOpacity=".3" strokeWidth="2" fill="none" strokeLinecap="round" />
      {style === 1 && <rect x="7.6" y="11" width="4.6" height="13" rx="2.3" fill={G('hr')} />}
      {style === 2 && <rect x="31.8" y="11" width="4.6" height="10" rx="2.3" fill={G('hr')} />}
      <ellipse cx="16.8" cy="21" rx="2.1" ry="2.7" fill="#1a1424" /><ellipse cx="27.2" cy="21" rx="2.1" ry="2.7" fill="#1a1424" />
      <circle cx="17.5" cy="19.8" r=".8" fill="#fff" /><circle cx="27.9" cy="19.8" r=".8" fill="#fff" />
      <circle cx="13.6" cy="25.5" r="3" fill={G('ck')} /><circle cx="30.4" cy="25.5" r="3" fill={G('ck')} />
      <path d="M19.6 26 Q22 28.6 24.4 26" stroke="#8a4034" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// 책상 + 모니터 + 의자 (사람은 따로 올린다). 좌표 원점: 책상 중심 바닥 = (70, 92)
function SeatSVG({ accent, glow }: { accent: string; glow: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const hgt = 22, O = { x: 70, y: 92 }
  const a = { x: O.x, y: O.y - 21.25 }, r = { x: O.x + 42.5, y: O.y + 5.95 }, b = { x: O.x, y: O.y + 21.25 }, l = { x: O.x - 42.5, y: O.y - 5.95 }
  const up = (p: Pt) => ({ x: p.x, y: p.y - hgt })
  return (
    <svg width="140" height="132" viewBox="0 0 140 132" aria-hidden>
      <defs>
        <linearGradient id={"dl" + uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d3dcee" /><stop offset="1" stopColor="#a9b6d0" /></linearGradient>
        <linearGradient id={"dr" + uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#aebbd5" /><stop offset="1" stopColor="#7f8eac" /></linearGradient>
        <linearGradient id={"dt" + uid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dbe4f4" /></linearGradient>
        <linearGradient id={"ch" + uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b4a7d" /><stop offset="1" stopColor="#1d2748" /></linearGradient>
        <radialGradient id={"sd" + uid}><stop offset="0" stopColor="#000" stopOpacity=".42" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
        <linearGradient id={"sc" + uid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7fd0ff" /><stop offset="1" stopColor="#2f86e6" /></linearGradient>
      </defs>
      <ellipse cx={O.x} cy={O.y + 6} rx="58" ry="26" fill={`url(#sd${uid})`} />
      <polygon points={P([l, b, up(b), up(l)])} fill={`url(#dl${uid})`} stroke="#c9d3e8" strokeWidth="1" strokeLinejoin="round" />
      <polygon points={P([b, r, up(r), up(b)])} fill={`url(#dr${uid})`} stroke="#9aa8c4" strokeWidth="1" strokeLinejoin="round" />
      <polygon points={P([up(a), up(r), up(b), up(l)])} fill={`url(#dt${uid})`} stroke="#f4f7fd" strokeWidth="1" strokeLinejoin="round" />
      <polyline points={P([up(l), up(b), up(r)])} fill="none" stroke={accent} strokeWidth="2" strokeOpacity=".9" />
      <rect x={O.x - 30} y={O.y - hgt + 2} width="5" height="14" fill={accent} opacity=".0" />
      {/* 키보드 */}
      <g transform={`translate(${O.x - 20},${O.y - hgt + 8}) matrix(1,.5,0,1,0,0)`}><rect x="0" y="0" width="22" height="5" rx="1" fill="#c3cde0" /></g>
      {/* 모니터 */}
      <g transform={`translate(${O.x + 4},${O.y - hgt - 6}) matrix(1,.5,0,1,0,0)`}>
        <rect x="-17" y="-24" width="34" height="23" rx="2.5" fill="#141a2c" />
        <rect x="-15" y="-22" width="30" height="19" rx="1.5" fill={glow ? `url(#sc${uid})` : '#22304f'} opacity={glow ? '.92' : '.9'} />
        {glow && <><rect x="-12" y="-19" width="14" height="2" fill="#fff" opacity=".7" /><rect x="-12" y="-14" width="22" height="2" fill="#fff" opacity=".45" /><rect x="-12" y="-9" width="10" height="2" fill={accent} opacity=".9" /></>}
      </g>
      <rect x={O.x + 2} y={O.y - hgt - 6} width="4" height="5" fill="#141a2c" />
      {/* 의자 */}
      <ellipse cx="36" cy="116" rx="13" ry="3.4" fill="#0c1226" />
      <rect x="34" y="104" width="4" height="12" fill="#1a2340" />
      <ellipse cx="36" cy="102.5" rx="15" ry="7.5" fill={`url(#ch${uid})`} />
      <ellipse cx="36" cy="100.5" rx="15" ry="7" fill="#3a4a80" />
      <ellipse cx="33" cy="98.8" rx="8" ry="2.6" fill="#fff" opacity=".18" />
    </svg>
  )
}

const Mover = memo(function Mover({ pos, z, children, slow }: { pos: Pt; z: number; children: React.ReactNode; slow?: boolean }) {
  return <div className="absolute" style={{ left: pos.x, top: pos.y, transform: 'translate(-50%,-100%)', transition: `left ${slow ? 2.4 : 1.8}s linear, top ${slow ? 2.4 : 1.8}s linear`, zIndex: z }}>{children}</div>
})

function Person({ item, pos, atSlot, selected, onPick, label }: { item: Item; pos: Pt; atSlot: boolean; selected: boolean; onPick: () => void; label?: string }) {
  const [walking, setWalking] = useState(false)
  const prev = useRef(pos)
  useEffect(() => {
    if (prev.current.x === pos.x && prev.current.y === pos.y) return
    prev.current = pos
    setWalking(true)
    const t = setTimeout(() => setWalking(false), 1900)
    return () => clearTimeout(t)
  }, [pos.x, pos.y]) // eslint-disable-line react-hooks/exhaustive-deps
  const pose: Pose = walking ? 'walk' : atSlot ? 'stand' : 'sit'
  return (
    <Mover pos={pos} z={atSlot ? 9000 + Math.round(pos.x / 10) : Math.round(pos.y) + 2}>
      <div onClick={e => { e.stopPropagation(); onPick() }} className="relative cursor-pointer" style={{ width: 44, height: 64 }}>
        {selected && <span className="of-ring" style={{ borderColor: item.accent, boxShadow: `0 0 14px ${item.accent}` }} />}
        <Sprite item={item} pose={pose} raised={atSlot && !walking} />
        <span className="of-pill" style={item.kind === 'bot' ? { background: item.accent, color: '#101521', borderColor: 'transparent' } : item.dept === 'ceo' ? { background: '#fde047', color: '#111', borderColor: 'transparent' } : undefined}>{label || item.label}</span>
      </div>
    </Mover>
  )
}

// ── 정적 배경 (밤 도시 · 바닥 · 벽 · 가운데 홀로그램) ─────────────
const FLOOR_G: [number, number][] = [[2, 0], [14, 0], [16, 2], [16, 14], [14, 16], [2, 16], [0, 14], [0, 2]]
const FLOOR = FLOOR_G.map(([x, y]) => iso(x, y))
const SLAB = 20
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const dn = (p: Pt, d: number): Pt => ({ x: p.x, y: p.y + d })

const Scenery = memo(function Scenery() {
  const WH = 100
  const wallQuad = (A: Pt, B: Pt) => P([A, B, dn(B, -WH), dn(A, -WH)])
  const aL = iso(0, 2), bL = iso(0, 14), aR = iso(2, 0), bR = iso(14, 0)
  const panels = (A: Pt, B: Pt, n: number) => Array.from({ length: n }, (_, i) => {
    const t0 = 0.05 + (i * 0.9) / n, t1 = 0.05 + ((i + 1) * 0.9) / n - 0.02
    const p0 = lerp(A, B, t0), p1 = lerp(A, B, t1)
    return P([dn(p0, -20), dn(p1, -20), dn(p1, -82), dn(p0, -82)])
  })
  const ring = (r: number) => Array.from({ length: 48 }, (_, k) => { const t = (k / 48) * Math.PI * 2; return iso(8 + r * Math.cos(t), 8 + r * Math.sin(t)) })
  const oct = Array.from({ length: 8 }, (_, k) => { const t = (k / 8) * Math.PI * 2 + Math.PI / 8; return iso(8 + 2.7 * Math.cos(t), 8 + 2.7 * Math.sin(t)) })
  const buildings = [[0, 470, 70, 290], [66, 520, 56, 240], [118, 430, 64, 330], [1010, 500, 60, 260], [1066, 440, 70, 320], [1128, 520, 72, 240], [180, 560, 50, 200], [972, 560, 46, 200]]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }} aria-hidden>
      <defs>
        <linearGradient id="of-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#070c1e" /><stop offset="1" stopColor="#0f1a38" /></linearGradient>
        <linearGradient id="of-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a4b72" /><stop offset="1" stopColor="#2c3c60" /></linearGradient>
        <linearGradient id="of-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24355c" /><stop offset="1" stopColor="#16213f" /></linearGradient>
        <linearGradient id="of-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#5bc8ff" stopOpacity=".42" /><stop offset="1" stopColor="#5bc8ff" stopOpacity="0" /></linearGradient>
        <radialGradient id="of-moon"><stop offset="0" stopColor="#f4f8ff" /><stop offset=".55" stopColor="#dfe9ff" /><stop offset="1" stopColor="#9db4e6" /></radialGradient>
        <radialGradient id="of-vig" cx=".5" cy=".5" r=".75"><stop offset=".6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".55" /></radialGradient>
        <clipPath id="of-clip"><polygon points={P(FLOOR)} /></clipPath>
        <filter id="of-blur"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <rect width={W} height={H} fill="url(#of-bg)" />
      {Array.from({ length: 40 }).map((_, i) => <circle key={i} cx={(i * 197) % W} cy={(i * 71) % 330} r={i % 5 === 0 ? 1.6 : 1} fill="#fff" opacity={0.25 + (i % 4) * 0.12} />)}
      <circle cx="150" cy="105" r="70" fill="#9db4e6" opacity=".16" filter="url(#of-blur)" /><circle cx="150" cy="105" r="42" fill="url(#of-moon)" />
      {buildings.map(([x, y, w, h], i) => (
        <g key={i}><rect x={x} y={y} width={w} height={h} fill="#0b1328" stroke="#16224a" />
          {Array.from({ length: Math.floor(h / 30) }).map((_, r) => Array.from({ length: Math.floor(w / 18) }).map((__, c) => ((i + r * 3 + c * 5) % 3 === 0 ? <rect key={r + '-' + c} x={x + 6 + c * 18} y={y + 10 + r * 30} width="7" height="10" fill="#ffd27a" opacity=".7" /> : null)))}
        </g>
      ))}
      {/* 바닥 두께 */}
      {[[iso(16, 2), iso(16, 14), '#18244a'], [iso(16, 14), iso(14, 16), '#121c3b'], [iso(14, 16), iso(2, 16), '#0e1733'], [iso(2, 16), iso(0, 14), '#121c3b']].map(([p, q, c], i) => (
        <polygon key={i} points={P([p as Pt, q as Pt, dn(q as Pt, SLAB), dn(p as Pt, SLAB)])} fill={c as string} />
      ))}
      <polyline points={P([dn(iso(16, 2), SLAB), dn(iso(16, 14), SLAB), dn(iso(14, 16), SLAB), dn(iso(2, 16), SLAB), dn(iso(0, 14), SLAB)])} fill="none" stroke="#4aa3ff" strokeWidth="2" opacity=".55" />
      {/* 바닥 */}
      <polygon points={P(FLOOR)} fill="url(#of-floor)" stroke="#66799f" strokeWidth="1.5" />
      <g clipPath="url(#of-clip)" stroke="#6b80ab" strokeOpacity=".3" strokeWidth="1">
        {Array.from({ length: 15 }).map((_, k) => <line key={'a' + k} x1={iso(k + 1, 0).x} y1={iso(k + 1, 0).y} x2={iso(k + 1, 16).x} y2={iso(k + 1, 16).y} />)}
        {Array.from({ length: 15 }).map((_, k) => <line key={'b' + k} x1={iso(0, k + 1).x} y1={iso(0, k + 1).y} x2={iso(16, k + 1).x} y2={iso(16, k + 1).y} />)}
      </g>
      {/* 보고 구역 (대표실 앞) */}
      <g clipPath="url(#of-clip)">
        <rect x="268" y="298" width="664" height="44" rx="10" fill="#8f2536" opacity=".22" stroke="#fcd34d" strokeOpacity=".55" strokeDasharray="7 6" strokeWidth="2" />
        <text x="282" y="312" fontSize="10.5" fontWeight="800" fill="#fde68a" opacity=".85" letterSpacing="2">▲ 대표실 앞 · 보고 구역</text>
      </g>
      {/* 벽 */}
      <polygon points={wallQuad(aL, bL)} fill="url(#of-wall)" />
      <polygon points={wallQuad(aR, bR)} fill="url(#of-wall)" />
      <polygon points={wallQuad(aL, aR)} fill="#1a2748" />
      {panels(aL, bL, 4).map((p, i) => <polygon key={'l' + i} points={p} fill="#79b4ff" fillOpacity=".16" stroke="#7fb0ee" strokeOpacity=".7" strokeWidth="1.5" />)}
      {panels(aR, bR, 4).map((p, i) => <polygon key={'r' + i} points={p} fill="#79b4ff" fillOpacity=".16" stroke="#7fb0ee" strokeOpacity=".7" strokeWidth="1.5" />)}
      <polyline points={P([dn(bL, -WH), dn(aL, -WH), dn(aR, -WH), dn(bR, -WH)])} fill="none" stroke="#6f93cf" strokeWidth="3" />
      <text x="600" y="108" textAnchor="middle" fontSize="15" fontWeight="900" letterSpacing="5" fill="#fde68a">HUNDRED</text>
      <text x="600" y="124" textAnchor="middle" fontSize="8.5" fontWeight="800" letterSpacing="4" fill="#9db4e6">CONSULTING</text>
      {/* 가운데 홀로그램 테이블 */}
      <polygon points={P(oct.map(p => dn(p, 16)))} fill="#aab6cc" />
      {oct.map((p, k) => { const q = oct[(k + 1) % 8]; return <polygon key={k} points={P([p, q, dn(q, 16), dn(p, 16)])} fill={k < 4 ? '#d6deee' : '#b4c0d6'} stroke="#8fa0c0" strokeWidth="1" /> })}
      <polygon points={P(oct)} fill="#16335f" stroke="#eaf1fb" strokeWidth="3" />
      <polygon points={P(ring(2.0))} fill="none" stroke="#4cc3ff" strokeWidth="2.5" opacity=".9" className="of-pulse" />
      <polygon points={P(ring(1.3))} fill="none" stroke="#9fe0ff" strokeWidth="1.5" opacity=".8" />
      <polygon points={P(ring(0.6))} fill="#4cc3ff" opacity=".35" />
      <polygon points={`${CENTER.x - 44},${CENTER.y - 4} ${CENTER.x + 44},${CENTER.y - 4} ${CENTER.x + 26},${CENTER.y - 74} ${CENTER.x - 26},${CENTER.y - 74}`} fill="url(#of-beam)" />
      <g transform={`translate(${CENTER.x},${CENTER.y - 62})`} fill="none" stroke="#bfe6ff" strokeWidth="1.2" opacity=".85">
        <circle r="28" /><ellipse rx="28" ry="9" /><ellipse rx="28" ry="9" transform="rotate(60)" /><ellipse rx="28" ry="9" transform="rotate(-60)" />
        <ellipse rx="10" ry="28"><animate attributeName="rx" values="3;28;3" dur="6s" repeatCount="indefinite" /></ellipse>
        <ellipse rx="22" ry="28"><animate attributeName="rx" values="28;3;28" dur="6s" repeatCount="indefinite" /></ellipse>
      </g>
      <polygon points={P(FLOOR)} fill="url(#of-vig)" pointerEvents="none" opacity=".35" />
    </svg>
  )
})

// ── 화면 ───────────────────────────────────────────────
const ACK_KEY = 'office_ack_v2'
const readAck = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(ACK_KEY) || '{}') } catch { return {} } }

export default function OfficeTab({ onNavigate }: { onNavigate: (tab: string, sub?: string) => void }) {
  const [data, setData] = useState<Data | null>(null)
  const [acked, setAcked] = useState<Record<string, string>>({})
  const [now, setNow] = useState(() => kstNow())
  const [manual, setManual] = useState(false)
  const [patrol, setPatrol] = useState(0)
  const [sel, setSel] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const alive = useRef(true)
  const wrapRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)

  const refresh = useCallback(async () => { const d = await loadAll(); if (alive.current) setData(d) }, [])
  useEffect(() => { alive.current = true; setAcked(readAck()); refresh(); const t = setInterval(() => { if (!document.hidden) refresh() }, 60_000); return () => { alive.current = false; clearInterval(t) } }, [refresh])
  useEffect(() => { const t = setInterval(() => setNow(kstNow()), 30_000); return () => clearInterval(t) }, [])
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const fit = () => setScale(Math.max(0.2, el.clientWidth / W))
    fit(); const ro = new ResizeObserver(fit); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { const t = setInterval(() => setPatrol(p => p + 1), 4200); return () => clearInterval(t) }, [])

  const reports = useMemo(() => (data ? buildReports(data) : []), [data])
  const waiting = reports.filter(r => acked[r.id] !== r.sig)
  const ack = (r: Report) => { const next = { ...acked, [r.id]: r.sig }; setAcked(next); try { localStorage.setItem(ACK_KEY, JSON.stringify(next)) } catch {} }

  const hour = now.getUTCHours()
  const users = data?.users || []
  const biz = bizDays(kstNow().toISOString().slice(0, 7)).total
  const digCount = users.filter(u => u.role === 'dig').length

  // 부서별 자리(클러스터): 책상 중심 좌표
  const clusters = useMemo(() => DEPTS.map(d => {
    const items: Item[] = [{ id: 'bot:' + d.key, kind: 'bot', name: d.agent, label: d.agent, dept: d.key, shirt: d.accent, accent: d.accent, roam: d.key === 'qa' }]
    if (d.key === 'ceo') items.unshift({ id: 'human:ceo', kind: 'human', name: '대표', label: '대표', dept: 'ceo', shirt: '#ef4444', accent: '#ef4444' })
    if (d.role) for (const u of users.filter(x => x.role === d.role)) items.push({ id: 'human:' + d.key + ':' + u.name, kind: 'human', name: u.name, label: strip(u.name), dept: d.key, shirt: d.accent, accent: d.accent, user: u })
    const n = items.length, cols = n <= 2 ? n : n <= 6 ? 2 : 3, rows = Math.ceil(n / cols)
    const seats = items.map((it, i) => {
      const col = i % cols, row = Math.floor(i / cols)
      const ox = (col - (cols - 1) / 2) * 2.1, oy = (row - (rows - 1) / 2) * 2.0
      return { it, seat: { x: SPOT[d.key].x + (ox - oy) * U, y: SPOT[d.key].y + (ox + oy) * V } as Pt }
    })
    return { d, seats, top: Math.min(...seats.map(s => s.seat.y)) }
  }), [users])

  // 핑크(검수) 순찰: 4초마다 다음 목적지로 — 보고가 있으면 그 직원 쪽, 없으면 테이블 둘레를 돈다
  const stops: Pt[] = waiting.length > 0
    ? waiting.map((_, i) => { const s = slotPos(i); return { x: s.x + 46, y: s.y + 6 } })
    : Array.from({ length: 8 }, (_, k) => ({ x: CENTER.x + 175 * Math.cos((k * Math.PI) / 4 + 0.4), y: CENTER.y + 84 * Math.sin((k * Math.PI) / 4 + 0.4) + 40 }))
  const pinkAt = stops[patrol % stops.length]
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

  const infoFor = (k: DeptKey): { short: string; caption?: string; pct?: number; long: string } => {
    const rcv = rev && rev.receivableCount > 0 ? ` · 받을 잔금 ${rev.receivableCount}건 ${won(rev.receivableSum)}원${rev.overdueCount ? `(기한 지남 ${rev.overdueCount})` : ''}` : ''
    if (k === 'ceo') return { short: rev ? `총매출 ${won(rev.thisMonth)}원` : '…', long: rev ? `이번 달 총매출 ${won(rev.thisMonth)}원` : '집계 중…' }
    if (k === 'revenue') return { short: rev ? `${won(rev.thisMonth)}원` : '…', caption: revSay, long: revSay + rcv }
    if (k === 'tax') return { short: tax ? `파킹 ${won(tax.parking)}원` : '…', caption: taxSay, long: taxSay }
    if (k === 'sales') return { short: rev ? `${won(rev.sales)}원` : '…', long: rev ? `이번 달 영업팀 매출 ${won(rev.sales)}원` : '집계 중…' }
    if (k === 'ops') return { short: rev ? `${won(rev.ops)}원` : '…', long: rev ? `이번 달 관리팀 매출 ${won(rev.ops)}원` : '집계 중…' }
    if (k === 'dig') return { short: `승인 ${monthDig}/${digGoal || '-'}`, pct: digPct, long: `이번 달 승인 ${monthDig}개 / 목표 ${digGoal || '-'}개 (${digPct}%)` }
    if (k === 'legal') return { short: '서식·계약서', long: '계약서 · 약관 · 서식 담당' }
    return { short: `보고 ${waiting.length}건 대기`, long: `보고 ${waiting.length}건 확인 대기` }
  }

  // 선택된 대상
  const allItems = clusters.flatMap(c => c.seats.map(s => s.it))
  const selItem = allItems.find(i => i.id === sel) || null
  const selRep = selItem?.kind === 'human' ? waiting.find(r => r.dept === selItem.dept && r.who === selItem.user?.name) : undefined
  const pick = (id: string) => setSel(s => (s === id ? null : id))

  const fullscreen = () => { const el = sectionRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.() }

  return (
    <section ref={sectionRef} className="rounded-2xl overflow-hidden border border-[#1b2a55] shadow-[0_10px_30px_rgba(5,8,20,.45)]" style={{ background: '#070c1e' }}>
      <style>{CSS}</style>

      {/* ── 상단 바 ── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5" style={{ background: 'linear-gradient(180deg,#101a3a,#0a1230)', borderBottom: '1px solid #1b2a55' }}>
        <div className="flex items-center gap-2 mr-1">
          <span className="of-logo">HUNDRED</span><span className="text-[11px] font-black text-white/70 tracking-[0.3em]">OFFICE</span>
        </div>
        <Hud icon="👥" label="직원 관리" value={`${users.length}명`} tone="#93c5fd" />
        <Hud icon="🪙" label="이번 달 매출" value={rev ? `${won(rev.thisMonth)}원` : '…'} tone="#facc15" />
        <Hud icon="📣" label="보고 대기" value={`${waiting.length}건`} tone={waiting.length ? '#fb7185' : '#86efac'} />
        <Hud icon="🤖" label="AI 서브" value="8" tone="#c4b5fd" />
        <div className="ml-auto flex items-center gap-2">
          <span className="of-clock">{hour < 6 || hour >= 19 ? '🌙' : '☀️'} {String(hour).padStart(2, '0')}:{String(now.getUTCMinutes()).padStart(2, '0')}</span>
          <button onClick={refresh} className="of-btn">새로고침</button>
          <button onClick={fullscreen} className="of-btn" title="전체화면">⛶</button>
          <button onClick={() => setManual(v => !v)} className="of-btn">{manual ? '닫기' : '?'}</button>
        </div>
      </div>

      {manual && (
        <div className="mx-3 mt-3 rounded-lg border border-white/15 bg-black/30 px-4 py-3 text-[12px] leading-relaxed text-white/85 of-pop">
          <p className="font-black text-[#facc15] mb-1">★ 사무실 사용법</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>직원이 계약·보고·심사요청을 올리면 자리에서 일어나 <b>대표실 앞 보고 구역</b>에 서서 말풍선으로 보고합니다.</li>
            <li>말풍선의 <b>[확인]</b>을 누르면 보고를 받은 것으로 처리되고 직원이 자리로 돌아갑니다. <b>[이동]</b>은 해당 화면으로 갑니다.</li>
            <li>직원이나 AI를 누르면 오른쪽에 <b>직원 살펴보기</b> 카드가 열립니다. 부서 이름표를 누르면 그 부서 화면으로 이동합니다.</li>
            <li>발굴팀은 오늘 한 개수, 대기·승인, 이번 달 목표 달성률을 보고합니다.</li>
            <li>노랑 = 매출 분석(이번 달 매출·더 필요한 금액), 초록 = 세무(파킹통장에 들고 있어야 할 금액), 핑크 = 검수(돌아다니며 확인). 테스트 계정은 표시하지 않습니다.</li>
          </ul>
        </div>
      )}

      {/* ── 무대 ── */}
      <div ref={wrapRef} className="relative w-full overflow-hidden select-none" style={{ height: H * scale }} onClick={() => setSel(null)}>
        <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'absolute', left: 0, top: 0 }}>
          <Scenery />

          {/* 부서 이름표 */}
          {clusters.map(({ d, top }) => {
            const info = infoFor(d.key), active = waiting.some(r => r.dept === d.key)
            return (
              <div key={'sign' + d.key} className="absolute" style={{ left: SPOT[d.key].x, top: top - 64, transform: 'translate(-50%,-100%)', zIndex: 15000 }}>
                <button onClick={e => { e.stopPropagation(); onNavigate(d.go) }} className="of-sign" style={{ borderColor: active ? d.accent : '#2a3a72', boxShadow: active ? `0 0 14px ${d.accent}88` : undefined }}>
                  <span className="flex items-center gap-1.5"><i className="of-dot" style={{ background: d.accent }} /><b>{d.label}</b></span>
                  <span className="of-sub">{info.short}</span>
                  {info.pct != null && <span className="of-meter"><i style={{ width: `${Math.min(100, info.pct)}%`, background: d.accent }} /></span>}
                  {info.caption && <span className="of-cap">{info.caption}</span>}
                </button>
              </div>
            )
          })}

          {/* 책상 */}
          {clusters.map(({ d, seats }) => seats.map(({ it, seat }) => (
            <div key={'seat' + it.id} className="absolute" style={{ left: seat.x - 70, top: seat.y - 92, width: 140, height: 132, zIndex: Math.round(seat.y), pointerEvents: 'none' }}>
              <SeatSVG accent={d.accent} glow={!it.roam} />
            </div>
          )))}

          {/* 사람·AI (자리에 앉아 있거나, 보고 구역에 서 있음) */}
          {clusters.map(({ d, seats }) => seats.map(({ it, seat }) => {
            if (it.roam) return null
            const home: Pt = { x: seat.x - 34, y: seat.y + 22 }
            const rep = it.kind === 'human' && it.user ? waiting.find(r => r.dept === d.key && r.who === it.user!.name) : undefined
            const wi = rep ? waiting.indexOf(rep) : -1
            return <Person key={it.id} item={it} pos={rep ? slotPos(wi) : home} atSlot={!!rep} selected={sel === it.id} onPick={() => pick(it.id)} />
          }))}

          {/* 핑크(검수) — 돌아다닌다 */}
          <Mover pos={pinkAt} z={8500} slow>
            <div className="of-say" style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 20, whiteSpace: 'nowrap', borderColor: DEPT.qa.accent }}>{pinkSay}</div>
            <div onClick={e => { e.stopPropagation(); pick('bot:qa') }} className="relative cursor-pointer" style={{ width: 44, height: 64 }}>
              {sel === 'bot:qa' && <span className="of-ring" style={{ borderColor: DEPT.qa.accent, boxShadow: `0 0 14px ${DEPT.qa.accent}` }} />}
              <Sprite item={{ kind: 'bot', name: '핑크', shirt: DEPT.qa.accent, accent: DEPT.qa.accent }} pose="walk" />
              <span className="of-pill" style={{ background: DEPT.qa.accent, color: '#101521', borderColor: 'transparent' }}>핑크</span>
            </div>
          </Mover>

          {/* 보고 말풍선 — 캐릭터(핑크 포함)에 가리지 않도록 맨 위 레이어 */}
          {waiting.map((rep, wi) => {
            const d = DEPT[rep.dept], above = wi % 2 === 0, p = slotPos(wi)
            return (
              <div key={'bub' + rep.id} className="absolute" style={{ left: p.x, top: p.y, width: 0, height: 0, zIndex: 20000 + wi }}>
                <div className="absolute of-report" style={{ left: '50%', transform: 'translateX(-50%)', ...(above ? { bottom: 84 } : { top: 10 }), borderColor: d.accent }} onClick={e => e.stopPropagation()}>
                  <p className="font-black" style={{ color: '#6b7280', fontSize: 10 }}>{strip(rep.who)} · {d.label}</p>
                  {rep.lines.map((l, k) => <p key={k} className={k === 0 ? 'font-black' : ''}>{l}</p>)}
                  <div className="mt-1 flex gap-1">
                    <button onClick={() => ack(rep)} className="of-ok">확인</button>
                    <button onClick={() => onNavigate(rep.go, rep.sub)} className="of-go">이동</button>
                  </div>
                  <span className={above ? 'of-tail-d' : 'of-tail-u'} style={{ borderColor: d.accent }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* 직원 살펴보기 카드 */}
        {selItem && (
          <div className="of-panel" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-black text-white/90">{selItem.kind === 'bot' ? 'AI 서브 살펴보기' : '직원 살펴보기'}</p>
              <button onClick={() => setSel(null)} className="text-white/60 hover:text-white text-[14px] leading-none">✕</button>
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <span className="of-avatar" style={{ background: selItem.accent }}>{selItem.label.slice(0, 2)}</span>
              <div className="leading-tight min-w-0">
                <p className="text-[15px] font-black text-white truncate">{selItem.kind === 'bot' ? `${selItem.name}` : selItem.label}</p>
                <p className="text-[10.5px] text-white/55">{DEPT[selItem.dept].label}{selItem.kind === 'bot' ? ' · AI 서브' : selItem.dept === 'ceo' ? ' · 대표' : ' · 직원'}</p>
              </div>
            </div>
            <p className="of-k">{selItem.kind === 'bot' ? '주요 업무' : '오늘 보고'}</p>
            <div className="of-v">
              {selItem.kind === 'bot' ? DEPT[selItem.dept].agentRole : selRep ? selRep.lines.map((l, i) => <p key={i}>{l}</p>) : <p className="text-white/55">{selItem.dept === 'ceo' ? '이번 달 총매출을 확인하세요.' : '오늘 올라온 보고가 없습니다.'}</p>}
            </div>
            <p className="of-k">{DEPT[selItem.dept].label} 현황</p>
            <div className="of-v">{infoFor(selItem.dept).long}</div>
            <div className="mt-2.5 flex gap-1.5">
              {selRep && <button className="of-ok" style={{ padding: '4px 12px' }} onClick={() => ack(selRep)}>보고 확인</button>}
              <button className="of-open" onClick={() => onNavigate(selRep?.go || DEPT[selItem.dept].go, selRep?.sub)}>{DEPT[selItem.dept].label} 화면으로 ↗</button>
            </div>
          </div>
        )}

        {/* 아래 칩 — AI 서브 */}
        <div className="of-chips">
          {DEPTS.map(d => (
            <button key={d.key} onClick={e => { e.stopPropagation(); pick('bot:' + d.key) }} className={`of-chip ${sel === 'bot:' + d.key ? 'on' : ''}`}>
              <i className="of-dot" style={{ background: d.accent }} />{d.agent}<span className="text-white/45">{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      {!data && <p className="text-center text-[12px] text-white/50 py-2">사무실 불러오는 중…</p>}
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
@keyframes of-raise { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
@keyframes of-blink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
@keyframes of-pop { 0% { transform: scale(.92); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
@keyframes of-armA { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
@keyframes of-armB { 0%,100% { transform: translateY(-2px) } 50% { transform: translateY(0) } }
@keyframes of-legA { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
@keyframes of-legB { 0%,100% { transform: translateY(-2px) } 50% { transform: translateY(0) } }
@keyframes of-step { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
@keyframes of-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1.5px) } }
@keyframes of-wave { 0%,100% { transform: rotate(-8deg) } 50% { transform: rotate(10deg) } }
@keyframes of-pulse { 0%,100% { opacity: .95 } 50% { opacity: .45 } }
.of-armA { animation: of-armA .32s ease-in-out infinite }
.of-armB { animation: of-armB .32s ease-in-out infinite }
.of-legA { animation: of-legA .32s ease-in-out infinite }
.of-legB { animation: of-legB .32s ease-in-out infinite }
.of-step { animation: of-step .32s ease-in-out infinite }
.of-bob { animation: of-bob 1.8s ease-in-out infinite }
.of-raise { animation: of-raise .8s ease-in-out infinite }
.of-wave { animation: of-wave .5s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100% }
.of-blink { animation: of-blink 1.6s ease-in-out infinite }
.of-pulse { animation: of-pulse 2.4s ease-in-out infinite }
.of-pop { animation: of-pop .25s ease-out both }
@media (prefers-reduced-motion: reduce) { .of-armA,.of-armB,.of-legA,.of-legB,.of-step,.of-bob,.of-raise,.of-wave,.of-blink,.of-pulse { animation: none } }
.of-logo { font-weight: 900; font-size: 15px; letter-spacing: .14em; color: #fde68a; text-shadow: 0 0 10px #facc1566 }
.of-hud { display: flex; align-items: center; gap: 7px; padding: 4px 10px; background: #0b1332; border: 1px solid #25347a; border-radius: 8px }
.of-clock { font-size: 12px; font-weight: 800; color: #e5e7eb; background: #0b1332; border: 1px solid #25347a; border-radius: 8px; padding: 5px 9px; font-family: ui-monospace, monospace }
.of-btn { font-size: 11px; font-weight: 800; color: #e5e7eb; background: #1b2766; border: 1px solid #34449a; border-radius: 8px; padding: 5px 10px }
.of-btn:hover { background: #2a3a8c }
.of-pill { position: absolute; left: 50%; top: -16px; transform: translateX(-50%); font-size: 10.5px; font-weight: 800; padding: 1px 7px; border-radius: 6px; background: rgba(9,14,33,.9); color: #fff; border: 1px solid #3a4a8a; white-space: nowrap; line-height: 1.35; pointer-events: none }
.of-ring { position: absolute; left: 50%; bottom: -2px; width: 46px; height: 16px; transform: translateX(-50%); border: 2px solid; border-radius: 50%; pointer-events: none }
.of-sign { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 96px; max-width: 204px; padding: 5px 10px 6px; border-radius: 10px; border: 1.5px solid; background: linear-gradient(180deg, rgba(20,30,70,.94), rgba(10,16,40,.94)); color: #fff; text-align: center; transition: transform .15s }
.of-sign:hover { transform: translateY(-2px) }
.of-sign b { font-size: 13px; font-weight: 900; letter-spacing: -.01em }
.of-sub { font-size: 11px; font-weight: 800; color: #fde68a }
.of-cap { font-size: 10.5px; line-height: 1.35; color: #dbe5ff; font-weight: 600; margin-top: 2px; padding-top: 3px; border-top: 1px solid #2a3a72 }
.of-meter { width: 100%; height: 6px; border-radius: 3px; background: #0a1030; border: 1px solid #25347a; overflow: hidden }
.of-meter i { display: block; height: 100%; transition: width .8s }
.of-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50% }
.of-say { font-size: 10.5px; font-weight: 800; background: #fff; color: #111; padding: 2px 8px; border: 2px solid; border-radius: 8px }
.of-report { width: 156px; background: #fff; color: #111; border: 3px solid; border-radius: 10px; padding: 6px 8px 7px; font-size: 11.5px; line-height: 1.32; animation: of-pop .25s ease-out both; box-shadow: 0 6px 16px rgba(0,0,0,.45) }
.of-report p { margin: 0 }
.of-tail-d, .of-tail-u { position: absolute; left: 50%; width: 11px; height: 11px; background: #fff; transform: translateX(-50%) rotate(45deg) }
.of-tail-d { bottom: -7px; border-right: 3px solid; border-bottom: 3px solid }
.of-tail-u { top: -7px; border-left: 3px solid; border-top: 3px solid }
.of-ok { font-size: 10.5px; font-weight: 900; background: #16a34a; color: #fff; border: 2px solid #0b5a28; border-radius: 6px; padding: 1px 10px }
.of-ok:hover { background: #22c55e }
.of-go { font-size: 10.5px; font-weight: 800; background: #e5e7eb; color: #111; border: 2px solid #9ca3af; border-radius: 6px; padding: 1px 9px }
.of-open { font-size: 11px; font-weight: 800; background: #3b82f6; color: #fff; border-radius: 6px; padding: 4px 10px }
.of-open:hover { background: #60a5fa }
.of-panel { position: absolute; right: 12px; top: 12px; width: 256px; max-width: calc(100% - 24px); padding: 12px 14px 14px; border-radius: 12px; background: rgba(8,13,34,.93); border: 1px solid #2a3a8a; color: #fff; z-index: 30000; box-shadow: 0 10px 30px rgba(0,0,0,.5); animation: of-pop .2s ease-out both }
.of-avatar { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; color: #101521; flex-shrink: 0 }
.of-k { margin-top: 10px; font-size: 10px; font-weight: 800; color: #7f93d6; letter-spacing: .04em }
.of-v { margin-top: 3px; font-size: 12px; line-height: 1.45; color: #e6ecff; font-weight: 600 }
.of-chips { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; max-width: calc(100% - 24px); z-index: 29000; padding: 6px 8px; border-radius: 12px; background: rgba(8,13,34,.78); border: 1px solid #1f2d6a }
.of-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; color: #fff; padding: 3px 9px; border-radius: 999px; background: #121c4a; border: 1px solid #2a3a8a }
.of-chip:hover, .of-chip.on { background: #26378f; border-color: #5b78e6 }
`
