'use client'

// 대표 첫 화면 — 픽셀 사무실. 부서별 방에 직원(실제 직원 이름)과 담당 AI 서브(색상 이름)가 앉아 있고,
// 보고할 일이 생기면 그 부서 직원이 가운데 '보고 광장'으로 나와 손을 들고 말한다. 클릭하면 해당 화면으로 이동.
import { useEffect, useState, type CSSProperties } from 'react'

export type OfficeAlert = {
  dept: DeptKey
  text: string          // "계약 있습니다!" 같은 한 줄 보고
  count?: number
  go?: () => void
}

export type DeptKey = 'ceo' | 'revenue' | 'tax' | 'legal' | 'sales' | 'dig' | 'ops' | 'qa'

type Dept = {
  key: DeptKey
  label: string
  agent: string          // 서브 AI 색상 이름
  agentRole: string
  color: string          // 방 바닥 색
  accent: string         // 서브 색
  role?: 'sales' | 'ops' | 'dig'   // 실제 직원을 불러올 역할
  fixed?: string[]       // 직원 계정이 없는 부서(매출·세무·법무)의 표시용 이름
  note: string
}

const DEPTS: Dept[] = [
  { key: 'ceo',     label: '대표실',   agent: '빨강', agentRole: 'CRM 개발·총괄',        color: '#7a5a38', accent: '#e5484d', note: '화면·기능 수정, 전체 지시' },
  { key: 'revenue', label: '매출관리', agent: '노랑', agentRole: '매출·마진 집계',        color: '#c9a640', accent: '#f5c518', fixed: ['매출 분석'], note: '월 매출·마진·정산 점검' },
  { key: 'tax',     label: '세무관리', agent: '초록', agentRole: '홈택스·세금 계산',      color: '#3d7a52', accent: '#30a46c', fixed: ['세금 계산'], note: '부가세·소득세·홈택스 연동' },
  { key: 'legal',   label: '법무·서식', agent: '파랑', agentRole: '계약서·서식 전문',      color: '#3a6ea5', accent: '#3b82f6', fixed: ['계약서 서식'], note: '계약서·약관·서식 검토' },
  { key: 'sales',   label: '영업팀',   agent: '남색', agentRole: '영업 코칭·현황',        color: '#3f4a8a', accent: '#4f5bd5', role: 'sales', note: '인콜·상담·계약 현황' },
  { key: 'dig',     label: '발굴팀',   agent: '보라', agentRole: 'DB 발굴·중복 점검',     color: '#7a4a8a', accent: '#9b5de5', role: 'dig', note: '가망 접수·중복 확인' },
  { key: 'ops',     label: '관리팀',   agent: '주황', agentRole: '카톡 단톡방·서류 발송', color: '#b8662c', accent: '#f97316', role: 'ops', note: '단톡방 안내·사업계획서·자금 요청' },
  { key: 'qa',      label: '총괄 검수', agent: '핑크', agentRole: '실행 전 검수·전 분야 점검', color: '#b84a7a', accent: '#ec4899', fixed: ['검수'], note: '모든 실행 전에 한 번 검수' },
]

type Person = { name: string; real: boolean }

// 사람 하나(머리·몸·팔). raised 면 한 팔을 번쩍 든다.
function Pixel({ skin = '#f1c9a0', shirt = '#1b2a45', hair = '#2b2018', raised = false, tag, scale = 3, mode = 'idle', delay = 0 }: {
  skin?: string; shirt?: string; hair?: string; raised?: boolean; tag?: string; scale?: number; mode?: 'idle' | 'type' | 'walk'; delay?: number
}) {
  const st: CSSProperties = { animationDelay: `${delay}ms` }
  const w = 10, h = 14
  return (
    <svg width={w * scale} height={h * scale} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" className={raised ? 'of-raise' : mode === 'type' ? 'of-head' : mode === 'walk' ? 'of-step' : ''} style={st} aria-hidden>
      <rect x="3" y="0" width="4" height="1" fill={hair} />
      <rect x="2" y="1" width="6" height="2" fill={hair} />
      <rect x="3" y="3" width="4" height="3" fill={skin} />
      <rect x="4" y="4" width="1" height="1" fill="#222" />
      <rect x="6" y="4" width="1" height="1" fill="#222" />
      <rect x="2" y="6" width="6" height="4" fill={shirt} />
      {tag && <rect x="4" y="7" width="2" height="1" fill={tag} />}
      {mode === 'type' ? (
        <>
          <rect className="of-armA" style={st} x="1" y="7" width="1" height="3" fill={shirt} />
          {raised ? <rect x="8" y="2" width="1" height="5" fill={shirt} /> : <rect className="of-armB" style={st} x="8" y="7" width="1" height="3" fill={shirt} />}
        </>
      ) : mode === 'walk' ? (
        <>
          <rect className="of-armB" style={st} x="1" y="7" width="1" height="3" fill={shirt} />
          <rect className="of-armA" style={st} x="8" y="7" width="1" height="3" fill={shirt} />
        </>
      ) : (
        <>
          <rect x="1" y="7" width="1" height="3" fill={shirt} />
          {raised ? <rect x="8" y="2" width="1" height="5" fill={shirt} /> : <rect x="8" y="7" width="1" height="3" fill={shirt} />}
        </>
      )}
      {raised && <rect x="8" y="1" width="1" height="1" fill={skin} />}
      <rect className={mode === 'walk' ? 'of-legA' : ''} style={st} x="3" y="10" width="2" height="4" fill="#2a2f3a" />
      <rect className={mode === 'walk' ? 'of-legB' : ''} style={st} x="5" y="10" width="2" height="4" fill="#2a2f3a" />
    </svg>
  )
}

const HAIR = ['#2b2018', '#4a3020', '#1a1a1a', '#6b4a2a', '#3a2a40']
const SHIRT = ['#1b2a45', '#46566e', '#5a4a6a', '#2f5d62', '#6a4545']

const hash = (s: string) => Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
function Desk({ p, accent }: { p: Person; accent: string }) {
  const h = hash(p.name)
  return (
    <div className="flex flex-col items-center" style={{ width: 62 }}>
      <Pixel hair={HAIR[h % HAIR.length]} shirt={SHIRT[(h >> 3) % SHIRT.length]} tag={accent} scale={2} mode="type" delay={h % 700} />
      <div className="relative -mt-1" style={{ width: 52, height: 14, background: '#8a6a45', border: '1px solid #5c4326', boxShadow: '0 2px 0 #5c4326' }}>
        <div className="absolute left-1/2 -translate-x-1/2 -top-[7px]" style={{ width: 16, height: 8, background: '#202633', border: '1px solid #0e1118' }}>
          <div className="of-screen" style={{ width: 12, height: 2, margin: '2px auto 0', background: accent, animationDelay: `${hash(p.name) % 900}ms` }} />
        </div>
      </div>
      <p className="mt-1 text-[10px] font-bold text-white/90 leading-none text-center truncate w-full" style={{ textShadow: '0 1px 0 rgba(0,0,0,.5)' }}>{p.name}</p>
    </div>
  )
}

function Room({ d, people, alert, onPick }: { d: Dept; people: Person[]; alert?: OfficeAlert; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="text-left group relative rounded-md overflow-hidden transition-transform hover:-translate-y-0.5"
      style={{ background: d.color, border: `3px solid ${alert ? d.accent : '#1b2236'}`, boxShadow: alert ? `0 0 0 2px ${d.accent}55, 0 6px 16px -6px #000a` : '0 4px 12px -6px #0008' }}>
      {/* 바닥 격자 */}
      <div className="absolute inset-0 opacity-25 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(45deg,#0004 25%,transparent 25%,transparent 75%,#0004 75%),linear-gradient(45deg,#0004 25%,transparent 25%,transparent 75%,#0004 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0,8px 8px' }} />
      <div className="relative flex items-center justify-between px-2 py-1" style={{ background: 'rgba(15,20,35,.72)' }}>
        <span className="text-[11px] font-black text-white tracking-tight">{d.label}</span>
        <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-[1px] rounded-sm" style={{ background: d.accent, color: '#111' }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full of-blink" style={{ background: '#111' }} />
          {d.agent}
        </span>
      </div>
      <div className="relative px-2 pt-3 pb-2 flex flex-wrap gap-x-1 gap-y-2 justify-center items-end" style={{ minHeight: 104 }}>
        {people.length === 0
          ? <p className="text-[10px] text-white/50 self-center">직원 없음</p>
          : people.slice(0, 8).map((p, i) => <Desk key={p.name + i} p={p} accent={d.accent} />)}
        {people.length > 8 && <span className="text-[10px] text-white/70 self-center">+{people.length - 8}</span>}
      </div>
      <p className="relative px-2 pb-1.5 text-[9.5px] text-white/70 leading-tight">{d.agent} · {d.agentRole}</p>
    </button>
  )
}

function Reporter({ a, d, onClick }: { a: OfficeAlert; d: Dept; onClick: () => void }) {
  const [walking, setWalking] = useState(true)
  useEffect(() => { const t = setTimeout(() => setWalking(false), 1700); return () => clearTimeout(t) }, [])
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center of-walkin" style={{ maxWidth: 170 }}>
      <div className={`relative rounded-md px-2.5 py-1.5 mb-1.5 text-[11.5px] font-bold text-[#111] text-center leading-tight ${walking ? 'opacity-0' : 'of-pop'}`} style={{ background: '#fff', border: `2px solid ${d.accent}` }}>
        {a.text}{a.count && a.count > 1 ? ` (${a.count})` : ''}
        <span className="absolute left-1/2 -translate-x-1/2 -bottom-[7px] w-2.5 h-2.5 rotate-45 bg-white" style={{ borderRight: `2px solid ${d.accent}`, borderBottom: `2px solid ${d.accent}` }} />
      </div>
      <Pixel raised={!walking} mode={walking ? 'walk' : 'idle'} shirt={d.accent} tag="#fff" scale={3} />
      <p className="text-[10px] font-bold text-white/85 mt-0.5">{d.label} · {d.agent}</p>
    </button>
  )
}

export default function OfficeMap({ alerts, onGo }: { alerts: OfficeAlert[]; onGo: (dept: DeptKey) => void }) {
  const [users, setUsers] = useState<{ name: string; role: string }[]>([])
  const [manual, setManual] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/users').then(r => r.json()).then(j => { if (alive) setUsers((j.users || []).filter((u: any) => !u.blocked && !/tester/i.test(u.username || ''))) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const peopleOf = (d: Dept): Person[] => {
    if (d.key === 'ceo') return [{ name: '대표', real: true }]
    if (d.role) return users.filter(u => u.role === d.role).map(u => ({ name: u.name, real: true }))
    return (d.fixed || []).map(n => ({ name: n, real: false }))
  }
  const alertOf = (k: DeptKey) => alerts.find(a => a.dept === k && (a.count ?? 1) > 0)
  const active = alerts.filter(a => (a.count ?? 1) > 0)

  const top = DEPTS.filter(d => ['ceo', 'revenue', 'tax', 'legal'].includes(d.key))
  const bottom = DEPTS.filter(d => ['sales', 'dig', 'ops', 'qa'].includes(d.key))

  return (
    <section className="rounded-2xl overflow-hidden border border-[#0e1428]" style={{ background: 'linear-gradient(180deg,#0f1630,#0a1022)' }}>
      <style>{`
        @keyframes of-raise { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes of-blink { 0%,100% { opacity: 1 } 50% { opacity: .25 } }
        @keyframes of-pop { 0% { transform: scale(.85); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
        @keyframes of-armA { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1px) } }
        @keyframes of-armB { 0%,100% { transform: translateY(-1px) } 50% { transform: translateY(0) } }
        @keyframes of-legA { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1px) } }
        @keyframes of-legB { 0%,100% { transform: translateY(-1px) } 50% { transform: translateY(0) } }
        @keyframes of-head { 0%,100% { transform: translateY(0) } 50% { transform: translateY(.4px) } }
        @keyframes of-step { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-1.5px) } }
        @keyframes of-screen { 0%,100% { opacity: .9 } 40% { opacity: .35 } 70% { opacity: .8 } }
        @keyframes of-walkin { from { transform: translateX(-140px) } to { transform: translateX(0) } }
        .of-armA { animation: of-armA .28s steps(2) infinite }
        .of-armB { animation: of-armB .28s steps(2) infinite }
        .of-legA { animation: of-legA .3s steps(2) infinite }
        .of-legB { animation: of-legB .3s steps(2) infinite }
        .of-head { animation: of-head 1.4s steps(2) infinite }
        .of-step { animation: of-step .3s steps(2) infinite }
        .of-screen { animation: of-screen 1.1s steps(3) infinite }
        .of-walkin { animation: of-walkin 1.6s steps(9) both }
        @media (prefers-reduced-motion: reduce) { .of-armA,.of-armB,.of-legA,.of-legB,.of-head,.of-step,.of-screen,.of-walkin,.of-raise,.of-blink { animation: none } }
        .of-raise { animation: of-raise .7s steps(2) infinite }
        .of-blink { animation: of-blink 1.6s steps(2) infinite }
        .of-pop { animation: of-pop .25s ease-out both }
      `}</style>

      <div className="flex items-center justify-between px-4 py-2.5">
        <p className="text-[13px] font-black text-white tracking-tight">
          <span className="text-[#f5c518]">HUNDRED</span> 사무실 <span className="text-white/40 font-semibold ml-1">사람 {users.length || '·'}명 + AI 서브 8</span>
        </p>
        <button onClick={() => setManual(v => !v)} className="text-[11px] font-semibold text-white/60 hover:text-white px-2 py-1 rounded-md hover:bg-white/10">
          {manual ? '매뉴얼 닫기' : '보고 매뉴얼'}
        </button>
      </div>

      {manual && (
        <div className="mx-4 mb-3 rounded-lg bg-white/5 border border-white/10 px-3.5 py-3 text-[12px] leading-relaxed text-white/80 of-pop">
          <p className="font-bold text-white mb-1">보고 매뉴얼</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>보고할 일이 생기면 그 부서 직원이 <b>가운데 보고 광장</b>으로 나와 손을 들고 말합니다. (예: “계약 있습니다!”)</li>
            <li>말풍선을 누르면 해당 화면(영업팀·관리팀·세금 등)으로 바로 이동합니다.</li>
            <li>처리가 끝나 보고 건수가 0이 되면 자리로 돌아갑니다.</li>
            <li>각 방 오른쪽 위 색상 이름이 그 부서를 맡는 AI 서브입니다. 지시할 때 “노랑, 이번 달 마진 다시 계산해” 처럼 색상 이름으로 부르면 됩니다.</li>
            <li>핑크는 총괄 검수 담당입니다. 다른 색상이 무언가를 실행(발송·수정·계산 반영)하기 전에 한 번 검수합니다.</li>
            <li>직원이 입사해 회원가입하면 해당 부서 방에 캐릭터가 자동으로 생깁니다. (영업팀=남색, 관리팀=주황, 발굴팀=보라)</li>
            <li className="text-white/60">빨강 = CRM 개발·총괄 / 주황 = 카카오톡 단톡방·서류 발송 (다른 PC). 나머지 색상은 순서대로 준비됩니다.</li>
          </ul>
        </div>
      )}

      <div className="px-3 pb-3 space-y-2.5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {top.map(d => <Room key={d.key} d={d} people={peopleOf(d)} alert={alertOf(d.key)} onPick={() => onGo(d.key)} />)}
        </div>

        {/* 가운데 보고 광장 */}
        <div className="relative rounded-md px-3 py-3" style={{ background: '#3a3f58', border: '3px solid #1b2236', minHeight: 96 }}>
          <div className="absolute inset-0 opacity-30 pointer-events-none"
            style={{ backgroundImage: 'linear-gradient(45deg,#0005 25%,transparent 25%,transparent 75%,#0005 75%),linear-gradient(45deg,#0005 25%,transparent 25%,transparent 75%,#0005 75%)', backgroundSize: '18px 18px', backgroundPosition: '0 0,9px 9px' }} />
          <p className="relative text-[10px] font-black tracking-widest text-white/55 mb-2">보고 광장</p>
          <div className="relative flex flex-wrap justify-center gap-x-5 gap-y-3 items-end">
            {active.length === 0 && (
              <div className="flex items-center gap-2 text-[12px] text-white/55 py-2">
                <Pixel scale={2} /> 지금은 보고할 일이 없습니다. 모두 자리에서 일하는 중입니다.
              </div>
            )}
            {active.map((a, i) => {
              const d = DEPTS.find(x => x.key === a.dept)!
              return (
                <Reporter key={a.dept + i + a.text} a={a} d={d} onClick={() => (a.go ? a.go() : onGo(a.dept))} />
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {bottom.map(d => <Room key={d.key} d={d} people={peopleOf(d)} alert={alertOf(d.key)} onPick={() => onGo(d.key)} />)}
        </div>
      </div>
    </section>
  )
}
