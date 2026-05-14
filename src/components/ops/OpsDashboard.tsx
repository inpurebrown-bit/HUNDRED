'use client'

import { useState, useEffect, useRef, useCallback, FormEvent, ReactNode } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import MyProfileTab from '@/components/MyProfileTab'

// ── KST Utils ──────────────────────────────────────────────────────────
function nowKST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00'
}
function formatKST(isoStr: string) {
  if (!isoStr) return { date: '', time: '' }
  const d = new Date(isoStr)
  const date = d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')
  const time = d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
  return { date, time }
}
function fmt(n: number) {
  if (!n) return '-'
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
  if (n >= 10_000) return Math.round(n / 10_000) + '만'
  return n.toLocaleString()
}

// ── Types ──────────────────────────────────────────────────────────────
export interface OpsCase {
  id: string
  customer_id: string
  ops_user_id: string
  ops_user_name: string
  contract_id?: string
  institution: string
  solution_type: string
  progress_stage: string
  progress_memo: string
  revenue: number
  is_refund?: boolean
  is_completed?: boolean
  timeline?: any[]
  institution_credentials?: Record<string, any>
  details?: Record<string, any>
  updated_at: string
  created_at: string
  customers: {
    name: string
    phone: string
    company?: string
    loan_history?: string
    call_timeline?: any[]
    details?: Record<string, any>
  }
}

interface Props {
  userId: string
  userName: string
}

// ── Pipeline stages ────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: '서류받는중', label: '서류받는중', color: 'bg-gray-500',    light: 'bg-gray-50 border-gray-200' },
  { key: '접수전',     label: '접수전',     color: 'bg-sky-500',     light: 'bg-sky-50 border-sky-200' },
  { key: '신청완료',   label: '신청완료',   color: 'bg-blue-500',    light: 'bg-blue-50 border-blue-200' },
  { key: '반려보정',   label: '반려보정',   color: 'bg-orange-500',  light: 'bg-orange-50 border-orange-200' },
  { key: '실사대기',   label: '실사대기',   color: 'bg-amber-500',   light: 'bg-amber-50 border-amber-200' },
  { key: '실사완료',   label: '실사완료',   color: 'bg-yellow-500',  light: 'bg-yellow-50 border-yellow-200' },
  { key: '승인대기',   label: '승인대기',   color: 'bg-violet-500',  light: 'bg-violet-50 border-violet-200' },
  { key: '승인',       label: '승인',       color: 'bg-emerald-500', light: 'bg-emerald-50 border-emerald-200' },
  { key: '부결',       label: '부결',       color: 'bg-red-500',     light: 'bg-red-50 border-red-200' },
  { key: '입금전',     label: '입금전',     color: 'bg-teal-500',    light: 'bg-teal-50 border-teal-200' },
  { key: '홀딩',       label: '홀딩',       color: 'bg-slate-400',   light: 'bg-slate-50 border-slate-200' },
  { key: '검토중',     label: '검토중',     color: 'bg-gray-400',    light: 'bg-gray-50 border-gray-200' },
  { key: '접수',       label: '접수',       color: 'bg-sky-400',     light: 'bg-sky-50 border-sky-200' },
  { key: '진행중',     label: '진행중',     color: 'bg-blue-400',    light: 'bg-blue-50 border-blue-200' },
  { key: '환불예정',   label: '환불예정',   color: 'bg-rose-400',    light: 'bg-rose-50 border-rose-200' },
  { key: '종료예정',   label: '종료예정',   color: 'bg-orange-400',  light: 'bg-orange-50 border-orange-200' },
]

const STAGE_COLOR: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGES.map(s => [s.key, s.color])
)

const ACTIVE_STAGE_KEYS = new Set([
  '서류받는중','접수전','신청완료','반려보정','실사대기','실사완료',
  '승인대기','승인','부결','입금전','홀딩','검토중','접수','진행중',
  '환불예정','종료예정',
  'assigned','absorbed','doc_collect','reviewing','approved','executing','rejected',
])
const REFUND_STAGE_KEYS    = new Set(['환불','refunded'])
const COMPLETED_STAGE_KEYS = new Set(['종료','완료','completed'])
const PENDING_REFUND_KEYS  = new Set(['환불예정'])
const PENDING_DONE_KEYS    = new Set(['종료예정'])
const NEWDB_STAGE_KEYS     = new Set(['new_db'])

// ── 기관 목록 ──────────────────────────────────────────────────────────
const INST_DIRECT   = ['중진공','소진공(혁신)','소진공(신취)','소진공(재도전)','서민금융(미소)']
const INST_INDIRECT = ['기보','신보','재단']
const INDIRECT_SET  = new Set(INST_INDIRECT)
const ALL_INST_ORDER = [...INST_DIRECT, ...INST_INDIRECT]

const INDIRECT_SCRIPT_TEMPLATE = (company: string, name: string, inst: string, visitDate: string, visitTime: string) =>
`안녕하세요, ${company} ${name} 대표님. 헌드레드컨설팅입니다.
${inst} 보증서 심사를 위해 고객님이 직접 방문하셔야 합니다.

■ 방문 일정: ${visitDate || '(날짜 미정)'} ${visitTime || ''}
■ 방문 기관: ${inst}
■ 지참 서류: 사업자등록증, 신분증, 법인등기부등본(해당 시)

방문 전 미리 연락 주시면 감사하겠습니다.`

const CRED_TYPES = [
  { key: 'cert_personal', label: '공동인증서 개인PW', hasId: false, hasPw: true,  hasPw2: false },
  { key: 'corp_pw',       label: '법인PW',           hasId: false, hasPw: true,  hasPw2: false },
  { key: 'jinjin',        label: '중진공',            hasId: true,  hasPw: true,  hasPw2: false },
  { key: 'sojin',         label: '소진공',            hasId: true,  hasPw: true,  hasPw2: false },
  { key: 'sojin_edu',     label: '소진공지식배움터',   hasId: true,  hasPw: true,  hasPw2: false },
  { key: 'kibo',          label: '기보',              hasId: true,  hasPw: true,  hasPw2: false },
  { key: 'sinbo',         label: '신보',              hasId: true,  hasPw: true,  hasPw2: false },
  { key: 'creditforyou',  label: '크래딧포유',        hasId: true,  hasPw: true,  hasPw2: false },
  { key: 'ipin',          label: '아이핀',            hasId: true,  hasPw: true,  hasPw2: true  },
]

const inp = 'w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/50 bg-white'
const lbl = 'text-[10px] text-gray-400 mb-0.5 block font-medium'

// 인콜일지 결과 배지 옵션 (영업팀과 동일)
const INCALL_CALL_RESULTS = [
  { key: '원콜클로징', color: 'bg-emerald-500 text-white' },
  { key: '심사요청',   color: 'bg-violet-500 text-white' },
  { key: '고민중',     color: 'bg-orange-400 text-white' },
  { key: '클로징대기', color: 'bg-blue-500 text-white' },
  { key: '부재',       color: 'bg-slate-400 text-white' },
  { key: '대기',       color: 'bg-yellow-400 text-gray-800' },
  { key: '거절',       color: 'bg-red-500 text-white' },
  { key: '자체거절',   color: 'bg-gray-400 text-white' },
  { key: '',           color: 'bg-gray-100 text-gray-400' },
]
const INCALL_CLOSING_RESULTS = [
  { key: '결정업체',   color: 'bg-emerald-500 text-white' },
  { key: '고민중',     color: 'bg-orange-400 text-white' },
  { key: '부재',       color: 'bg-slate-400 text-white' },
  { key: '재통화',     color: 'bg-sky-400 text-white' },
  { key: '거절',       color: 'bg-red-500 text-white' },
  { key: '자체거절',   color: 'bg-gray-400 text-white' },
  { key: '',           color: 'bg-gray-100 text-gray-400' },
]

// ── Tab types ──────────────────────────────────────────────────────────
type OpsTab = 'dashboard' | 'active' | 'refund' | 'completed' | 'newdb' | 'ops_contract' | 'report' | 'profile'

const opsTabs: { key: OpsTab; label: string }[] = [
  { key: 'dashboard',    label: '📊 대시보드' },
  { key: 'active',       label: '🔄 진행중업체' },
  { key: 'refund',       label: '💸 환불업체' },
  { key: 'completed',    label: '✅ 종료업체' },
  { key: 'newdb',        label: '🆕 신규DB' },
  { key: 'ops_contract', label: '📝 관리팀계약' },
  { key: 'report',       label: '📋 관리팀보고' },
  { key: 'profile',      label: '👤 사원정보' },
]

// ── Detail Tab Types: 진행현황 우선, 타임라인 진행현황 하단에 통합 ──────────
const DETAIL_TABS = ['진행현황', '인콜일지', '기관ID/PW', '💰 입금/계약'] as const
type DetailTab = typeof DETAIL_TABS[number]

// ──────────────────────────────────────────────────────────────────────
// TimelineSection
// ──────────────────────────────────────────────────────────────────────
function TimelineSection({ initialTimeline, onSchedule }: {
  initialTimeline: any[]
  onSchedule: (patch: Record<string, any>) => void
}) {
  const [tl, setTl] = useState<any[]>(initialTimeline || [])
  const [text, setText] = useState('')

  function add() {
    if (!text.trim()) return
    const entry = { user: '수동입력', content: text.trim(), created_at: nowKST() }
    const updated = [...tl, entry]
    setTl(updated)
    onSchedule({ timeline: updated })
    setText('')
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="타임라인 내용 입력..."
          className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/50" />
        <button onClick={add} className="text-xs bg-violet-500 text-white px-2 py-1 rounded hover:bg-violet-600">추가</button>
      </div>
      {tl.length === 0 ? (
        <p className="text-[10px] text-gray-300 text-center py-1">타임라인이 없습니다</p>
      ) : (
        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
          {[...tl].reverse().map((entry: any, i: number) => {
            const isAuto = entry.user === '자동기록'
            const kst = formatKST(entry.created_at || entry.date || '')
            const user = entry.user || entry.author || ''
            const content = entry.content || entry.text || ''
            return (
              <div key={i} className={`flex gap-2 items-start rounded-lg px-2 py-1.5 ${isAuto ? 'bg-violet-50' : 'bg-gray-50'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${isAuto ? 'bg-violet-400' : 'bg-gray-400'}`}>
                  {user ? user.slice(-2) : '기록'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold ${isAuto ? 'text-violet-600' : 'text-gray-600'}`}>{user || '—'}</span>
                    <span className="text-[10px] text-gray-300">{kst.date} {kst.time}</span>
                  </div>
                  <p className="text-xs text-gray-700 mt-0.5">{content}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// OpsDetailPanel (타임라인 기본, 고객정보 탭 제거)
// ──────────────────────────────────────────────────────────────────────
export function OpsDetailPanel({ c, onSave, userRole }: { c: OpsCase; onSave: (id: string, patch: Record<string, any>) => void; userRole?: string }) {
  const [local, setLocal] = useState<OpsCase>({ ...c })
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('진행현황')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // pwVisible 제거됨 — 기관ID/PW 필드는 항상 평문 표시
  const [salesLogOpen, setSalesLogOpen] = useState(false)
  // 인콜일지 수정모드
  const [incallEditing, setIncallEditing] = useState(false)

  useEffect(() => { setLocal({ ...c }) }, [c.id])

  function field<K extends keyof OpsCase>(key: K, val: OpsCase[K]) {
    const next = { ...local, [key]: val }
    setLocal(next)
    schedule({ [key]: val })
  }
  function detailField(key: string, val: any) {
    const next = { ...local, details: { ...(local.details || {}), [key]: val } }
    setLocal(next)
    schedule({ details: { ...(local.details || {}), [key]: val } })
  }
  function toggleDetail(key: string) {
    detailField(key, !local.details?.[key])
  }
  function toggleInstitution(inst: string) {
    const current = (local.institution || '').split(',').map((s: string) => s.trim()).filter(Boolean)
    const next = current.includes(inst) ? current.filter((s: string) => s !== inst) : [...current, inst]
    const val = next.join(', ')
    setLocal(prev => ({ ...prev, institution: val }))
    schedule({ institution: val })
  }
  async function handleDirectVisitDate(val: string) {
    detailField('direct_visit_date', val)
    if (!val) return
    const directInsts = (local.institution || '').split(',').map((s: string) => s.trim()).filter(i => i && !INDIRECT_SET.has(i))
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `[직접방문] ${c.customers?.details?.company || c.customers?.name} — ${directInsts.join(', ') || '기관미정'}`,
          start_date: val, end_date: val,
          start_time: local.details?.direct_visit_time || null,
          description: `${c.customers?.name} / ${c.customers?.phone}\n기관: ${directInsts.join(', ')}`,
          color: 'blue', is_allday: !local.details?.direct_visit_time,
        }),
      })
    } catch {}
  }
  async function handleIndirectVisitDate(val: string) {
    detailField('indirect_visit_date', val)
    if (!val) return
    const indirectInsts = (local.institution || '').split(',').map((s: string) => s.trim()).filter(i => i && INDIRECT_SET.has(i))
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `[간접방문] ${c.customers?.details?.company || c.customers?.name} — ${indirectInsts.join(', ') || '기관미정'}`,
          start_date: val, end_date: val,
          start_time: local.details?.indirect_visit_time || null,
          description: `${c.customers?.name} / ${c.customers?.phone}\n기관: ${indirectInsts.join(', ')}`,
          color: 'violet', is_allday: !local.details?.indirect_visit_time,
        }),
      })
    } catch {}
  }
  // 인콜일지 필드 저장 (details.incall_journal 에 저장)
  function incallField(key: string, val: any) {
    const ij = local.details?.incall_journal || {}
    detailField('incall_journal', { ...ij, [key]: val })
  }
  function handleStageChange(nextStage: string) {
    // 관리팀 직원은 환불/종료를 직접 선택 불가 → 예정 단계로 자동 전환
    if (userRole !== 'ceo') {
      if (nextStage === '환불') nextStage = '환불예정'
      if (nextStage === '종료') nextStage = '종료예정'
    }
    const prevStage = local.progress_stage
    const autoEntry = { user: '자동기록', content: `단계 변경: ${prevStage} → ${nextStage}`, created_at: nowKST() }
    const updatedTimeline = [...(local.timeline || []), autoEntry]

    setLocal(prev => ({
      ...prev,
      progress_stage: nextStage,
      timeline: updatedTimeline,
    }))
    schedule({
      progress_stage: nextStage,
      timeline: updatedTimeline,
    })
  }
  function handleCeoApprove() {
    const targetStage = local.progress_stage === '환불예정' ? '환불' : '종료'
    handleStageChange(targetStage)
  }
  function handleCeoReject() {
    handleStageChange('서류받는중')
  }
  function schedule(patch: Record<string, any>) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => onSave(c.id, patch), 1500)
  }

  const d = local.details || {}
  const selectedInstitutions = (local.institution || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const hasIndirect = selectedInstitutions.some((i: string) => INDIRECT_SET.has(i))
  const indirectList = selectedInstitutions.filter((i: string) => INDIRECT_SET.has(i))

  const isPendingApproval = local.progress_stage === '환불예정' || local.progress_stage === '종료예정'
  const isCeo = userRole === 'ceo'

  // 전달화면 모달용 영업팀 기록 추출
  const salesLogs = (local.timeline || []).filter((e: any) => e.source === 'sales')

  return (
    <div className="space-y-3">

      {/* ── 전달화면 모달 ── */}
      {salesLogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSalesLogOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-violet-600 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-white text-sm">📋 영업팀 전달 기록</p>
                <p className="text-white/70 text-xs mt-0.5">{c.customers?.name} · {c.customers?.company || c.customers?.phone}</p>
              </div>
              <button onClick={() => setSalesLogOpen(false)} className="text-white/70 hover:text-white text-lg leading-none">✕</button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {salesLogs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">전달 기록이 없습니다</p>
              ) : (
                <div className="relative pl-4 border-l-2 border-violet-200 space-y-2">
                  {[...salesLogs].reverse().map((log: any, i: number) => {
                    const kst = formatKST(log.created_at || log.date || '')
                    const author = log.user || log.author || log.user_name || '영업팀'
                    return (
                      <div key={i} className="relative">
                        <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-violet-400 border-2 border-white" />
                        <div className="bg-violet-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-violet-700">{author}</span>
                            <span className="text-[10px] text-gray-400">{kst.date} {kst.time}</span>
                            {log.call_result && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">{log.call_result}</span>
                            )}
                          </div>
                          {log.content && <p className="text-xs text-gray-700 whitespace-pre-wrap">{log.content}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CEO 승인 대기 배너 ── */}
      {isPendingApproval && isCeo && (
        <div className={`rounded-xl p-3.5 border ${local.progress_stage === '환불예정' ? 'bg-rose-50 border-rose-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`text-sm font-bold ${local.progress_stage === '환불예정' ? 'text-rose-800' : 'text-orange-800'}`}>
                ⏳ {local.progress_stage === '환불예정' ? '환불' : '종료'} 처리 승인 요청
              </p>
              <p className={`text-xs mt-0.5 ${local.progress_stage === '환불예정' ? 'text-rose-600' : 'text-orange-600'}`}>
                담당 직원이 {local.progress_stage === '환불예정' ? '환불' : '종료'} 처리를 요청했습니다. 승인하시겠습니까?
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={handleCeoApprove}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors ${local.progress_stage === '환불예정' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-orange-500 hover:bg-orange-600'}`}>
                ✅ 승인
              </button>
              <button onClick={handleCeoReject}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors">
                ❌ 반려
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 일반 직원 — 승인 대기 안내 ── */}
      {isPendingApproval && !isCeo && (
        <div className={`rounded-xl p-3 border ${local.progress_stage === '환불예정' ? 'bg-rose-50 border-rose-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className={`text-xs font-semibold ${local.progress_stage === '환불예정' ? 'text-rose-700' : 'text-orange-700'}`}>
            ⏳ {local.progress_stage === '환불예정' ? '환불' : '종료'} 처리 대표 승인 대기중
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">대표 컨펌 후 최종 {local.progress_stage === '환불예정' ? '환불' : '종료'} 처리됩니다</p>
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-gray-100 overflow-x-auto">
        {DETAIL_TABS.map(tab => (
          <button key={tab} type="button" onClick={e => { e.stopPropagation(); setActiveDetailTab(tab) }}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeDetailTab === tab ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── 진행현황 ── */}
      {activeDetailTab === '진행현황' && (
        <div className="space-y-4">
          {local.progress_stage === 'assigned' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-indigo-800">📥 신규 배정 업체</p>
                <p className="text-xs text-indigo-600 mt-0.5">내용 확인 및 고객과 통화 후 흡수 처리해주세요</p>
              </div>
              <button type="button" onClick={() => field('progress_stage', 'absorbed')}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                ✅ 흡수 완료
              </button>
            </div>
          )}

          {/* 진행 현황 — 전체 단계 + 계약날짜 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">진행 현황</span>
              <div className="flex-1 h-px bg-gray-100" />
              {(local.timeline || []).some((e: any) => e.source === 'sales') && (
                <button type="button" onClick={() => setSalesLogOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-600 text-[10px] font-bold border border-violet-200 transition-colors whitespace-nowrap">
                  📋 전달화면
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
              <div>
                <label className={lbl}>전체 진행 단계</label>
                <select value={local.progress_stage} onChange={e => handleStageChange(e.target.value)} className={inp}>
                  {[
                    ...PIPELINE_STAGES,
                    ...(isCeo
                      ? [{ key: '환불', label: '환불' }, { key: '종료', label: '종료' }]
                      : [{ key: '환불예정', label: '환불예정 (승인요청)' }, { key: '종료예정', label: '종료예정 (승인요청)' }]
                    ),
                  ].map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>계약 날짜</label>
                <input type="date" value={d.contract_date || ''} onChange={e => detailField('contract_date', e.target.value)} className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>계약 특이사항</label>
                <input type="text" value={d.contract_notes || ''} onChange={e => detailField('contract_notes', e.target.value)} className={inp} placeholder="계약 관련 특이사항" />
              </div>
            </div>
          </div>

          {/* ── 직접자금 섹션 (항상 표시) ── */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-blue-700">🏦 직접자금</span>
              <div className="flex-1 h-px bg-blue-200" />
            </div>
            {/* 기관 선택 */}
            <div>
              <label className={lbl}>기관 선택</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {INST_DIRECT.map(inst => (
                  <button key={inst} type="button" onClick={() => toggleInstitution(inst)}
                    className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                      selectedInstitutions.includes(inst) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-blue-50'
                    }`}>{inst}</button>
                ))}
              </div>
            </div>
            {/* 직접자금 진행단계 + 일정 */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
              <div className="col-span-2">
                <label className={lbl}>직접자금 진행단계</label>
                <select value={d.direct_stage || ''} onChange={e => detailField('direct_stage', e.target.value)} className={inp}>
                  <option value="">— 선택 —</option>
                  {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>기관방문 날짜/시간 📅</label>
                <div className="flex gap-1">
                  <input type="date" value={d.direct_visit_date || ''} onChange={e => {
                    if (e.target.value) handleDirectVisitDate(e.target.value)
                    else detailField('direct_visit_date', '')
                  }} className={inp + ' flex-1'} />
                  <input type="time" value={d.direct_visit_time || ''} onChange={e => detailField('direct_visit_time', e.target.value)} className={inp + ' w-20'} />
                </div>
                {d.direct_visit_date && <p className="text-[10px] text-emerald-600 mt-0.5">✅ 캘린더 자동 등록</p>}
              </div>
              <div>
                <label className={lbl}>실사일정 날짜/시간 📅</label>
                <div className="flex gap-1">
                  <input type="date" value={d.direct_inspection_date || ''} onChange={e => detailField('direct_inspection_date', e.target.value)} className={inp + ' flex-1'} />
                  <input type="time" value={d.direct_inspection_time || ''} onChange={e => detailField('direct_inspection_time', e.target.value)} className={inp + ' w-20'} />
                </div>
              </div>
            </div>
          </div>

          {/* ── 간접자금 섹션 (항상 표시) ── */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-violet-700">🏛 간접자금</span>
              <div className="flex-1 h-px bg-violet-200" />
            </div>
            {/* 기관 선택 */}
            <div>
              <label className={lbl}>기관 선택</label>
              <div className="flex flex-wrap gap-1 mt-1">
                {INST_INDIRECT.map(inst => (
                  <button key={inst} type="button" onClick={() => toggleInstitution(inst)}
                    className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                      selectedInstitutions.includes(inst) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-500 border-gray-300 hover:bg-violet-50'
                    }`}>{inst}</button>
                ))}
              </div>
            </div>
            {/* 간접자금 진행단계 + 일정 */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
              <div className="col-span-2">
                <label className={lbl}>간접자금 진행단계</label>
                <select value={d.indirect_stage || ''} onChange={e => detailField('indirect_stage', e.target.value)} className={inp}>
                  <option value="">— 선택 —</option>
                  {PIPELINE_STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>기관방문 날짜/시간 📅</label>
                <div className="flex gap-1">
                  <input type="date" value={d.indirect_visit_date || ''} onChange={e => {
                    if (e.target.value) handleIndirectVisitDate(e.target.value)
                    else detailField('indirect_visit_date', '')
                  }} className={inp + ' flex-1'} />
                  <input type="time" value={d.indirect_visit_time || ''} onChange={e => detailField('indirect_visit_time', e.target.value)} className={inp + ' w-20'} />
                </div>
                {d.indirect_visit_date && <p className="text-[10px] text-emerald-600 mt-0.5">✅ 캘린더 자동 등록</p>}
              </div>
              <div>
                <label className={lbl}>실사일정 날짜/시간 📅</label>
                <div className="flex gap-1">
                  <input type="date" value={d.indirect_inspection_date || ''} onChange={e => detailField('indirect_inspection_date', e.target.value)} className={inp + ' flex-1'} />
                  <input type="time" value={d.indirect_inspection_time || ''} onChange={e => detailField('indirect_inspection_time', e.target.value)} className={inp + ' w-20'} />
                </div>
              </div>
            </div>
          </div>

          {/* 소진공 확인서 */}
          {selectedInstitutions.some(i => i.startsWith('소진공')) && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">소진공 확인서</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-2">
                <p className="text-[10px] font-semibold text-amber-700 mb-2">📋 확인서 종류 선택</p>
                {[
                  { key: 'cert_general',   label: '일반경영안정 확인서' },
                  { key: 'cert_youth',     label: '청년 확인서' },
                  { key: 'cert_disabled',  label: '장애인 확인서' },
                  { key: 'cert_emergency', label: '긴급경영안정 확인서' },
                  { key: 'cert_refinance', label: '대환대출 확인서' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={!!(d as any)[key]} onChange={() => toggleDetail(key)} className="w-4 h-4 accent-amber-500" />
                    <span className={`text-xs font-medium ${(d as any)[key] ? 'text-amber-800 font-semibold' : 'text-gray-600'}`}>{label}</span>
                    {(d as any)[key] && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold ml-auto">✓ 선택됨</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 타임라인 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">타임라인</span>
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] text-gray-300">마지막 수정: {new Date(c.updated_at).toLocaleString('ko-KR')}</span>
            </div>
            <TimelineSection initialTimeline={local.timeline || []} onSchedule={schedule} />
          </div>
        </div>
      )}

      {/* ── 기관ID/PW ── */}
      {activeDetailTab === '기관ID/PW' && (
        <div className="space-y-3">
          {CRED_TYPES.map(cred => {
            const idKey  = `cred_${cred.key}_id`
            const pwKey  = `cred_${cred.key}_pw`
            const pw2Key = `cred_${cred.key}_pw2`
            const colCount = [cred.hasId, cred.hasPw, cred.hasPw2].filter(Boolean).length
            return (
              <div key={cred.key} className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] font-bold text-gray-600 mb-2">{cred.label}</p>
                <div className={`grid grid-cols-${colCount} gap-2`}>
                  {cred.hasId && (
                    <div><label className={lbl}>ID</label>
                      <input type="text" autoComplete="off" value={d[idKey] || ''} onChange={e => detailField(idKey, e.target.value)} className={inp} placeholder={`${cred.label} 아이디`} /></div>
                  )}
                  {cred.hasPw && (
                    <div><label className={lbl}>PW</label>
                      <input type="text" autoComplete="off" value={d[pwKey] || ''} onChange={e => detailField(pwKey, e.target.value)} className={inp} placeholder={`${cred.label} 비밀번호`} />
                    </div>
                  )}
                  {cred.hasPw2 && (
                    <div><label className={lbl}>2차PW</label>
                      <input type="text" autoComplete="off" value={d[pw2Key] || ''} onChange={e => detailField(pw2Key, e.target.value)} className={inp} placeholder={`${cred.label} 2차 비밀번호`} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 인콜일지 ── */}
      {activeDetailTab === '인콜일지' && (
        <div className="space-y-0">
          {(() => {
            const cd = local.customers?.details || {}
            const ij = d.incall_journal || {}
            const gv = (k: string, cv: any) => (ij[k] !== undefined && ij[k] !== '') ? ij[k] : (cv ?? '')
            const callResult    = gv('call_result',    cd.call_result    ?? '')
            const closingResult = gv('closing_result', cd.closing_result ?? '')
            const subcallDate   = gv('subcall_date',   cd.subcall_date   ?? '')

            // 섹션별 필드 정의
            const sections = [
              {
                title: '기업 기본정보', bg: 'bg-[#1B2A45]', textColor: 'text-white',
                fields: [
                  [['업체명', 'company', gv('company', cd.company || local.customers?.company || local.customers?.name || '')]],
                  [['대표자', 'representative', gv('representative', local.customers?.name || '')], ['연락처', 'phone', gv('phone', local.customers?.phone || '')]],
                  [['지역', 'region', gv('region', cd.region || '')], ['접수일', 'reception_date', gv('reception_date', cd.reception_date || (cd.created_at ? formatKST(cd.created_at).date : ''))]],
                  [['업종', 'business_type', gv('business_type', cd.business_type || '')], ['실제업무', 'real_work', gv('real_work', cd.real_work || '')]],
                  [['업력', 'years_in_business', gv('years_in_business', cd.years_in_business || cd.biz_size || '')], ['직원수', 'employee_count', gv('employee_count', cd.employee_count || '')]],
                  [['혁신요건', 'innovation', gv('innovation', cd.innovation || '')]],
                ],
              },
              {
                title: '대출 현황', bg: 'bg-amber-600', textColor: 'text-white',
                fields: [
                  [['기보대출', 'loan_kibo', gv('loan_kibo', cd.loan_kibo || cd.loan_policy || '')], ['신보대출', 'loan_shinbo', gv('loan_shinbo', cd.loan_shinbo || '')]],
                  [['재단대출', 'loan_jaedan', gv('loan_jaedan', cd.loan_jaedan || '')], ['중진공', 'loan_jinjong', gv('loan_jinjong', cd.loan_jinjong || '')]],
                  [['소진공', 'loan_sojin', gv('loan_sojin', cd.loan_sojin || '')], ['신용/담보', 'loan_other', gv('loan_other', cd.loan_other || cd.loan_credit || '')]],
                  [['기대출합계', 'loan_total', gv('loan_total', cd.loan_total || '')]],
                ],
              },
              {
                title: '신용 / 재무', bg: 'bg-violet-700', textColor: 'text-white',
                fields: [
                  [['KCB점수', 'credit_kcb', gv('credit_kcb', cd.credit_kcb || cd.credit_score || '')], ['NICE점수', 'credit_nice', gv('credit_nice', cd.credit_nice || '')]],
                  [['세금체납', 'tax_status', gv('tax_status', cd.tax_status || cd.tax_delinquency || '')], ['자산', 'assets', gv('assets', cd.assets || '')]],
                  [['25년매출', 'revenue_2025', gv('revenue_2025', cd.revenue_2025 || '')], ['24년매출', 'revenue_2024', gv('revenue_2024', cd.revenue_2024 || '')]],
                  [['23년매출', 'revenue_2023', gv('revenue_2023', cd.revenue_2023 || '')], ['필요자금', 'required_funds', gv('required_funds', cd.required_funds || '')]],
                  [['솔루션', 'solution', gv('solution', cd.solution || '')]],
                ],
              },
            ]

            return (
              <div>
                {/* ── 헤더: 수정 버튼 ── */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <span className="text-[11px] font-bold text-gray-600">📋 인콜일지</span>
                  <button type="button" onClick={() => setIncallEditing(e => !e)}
                    className={`text-[10px] px-3 py-1 rounded-full font-bold transition-colors ${
                      incallEditing
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}>
                    {incallEditing ? '✓ 저장완료' : '✏️ 수정'}
                  </button>
                </div>

                {/* ── 섹션별 필드 그리드 ── */}
                {sections.map(sec => (
                  <div key={sec.title} className="mb-0">
                    <div className={`${sec.bg} px-3 py-1.5`}>
                      <span className={`text-[10px] font-bold ${sec.textColor} tracking-wide`}>{sec.title}</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {sec.fields.map((row, ri) => (
                        <div key={ri} className={`grid gap-0 divide-x divide-gray-50 ${row.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {row.map(([label, k, val]: any) => (
                            <div key={k} className="flex items-center px-3 py-2 hover:bg-gray-50 transition-colors">
                              <span className="text-[10px] text-gray-400 font-medium w-[58px] shrink-0">{label}</span>
                              {incallEditing ? (
                                <input
                                  type="text"
                                  value={val}
                                  onChange={e => incallField(k, e.target.value)}
                                  placeholder="—"
                                  className="flex-1 text-xs font-semibold text-[#1B2A45] bg-transparent border-b border-violet-300 focus:outline-none focus:border-violet-500 px-0.5 py-0"
                                />
                              ) : (
                                <span className={`flex-1 text-xs font-semibold ${val ? 'text-[#1B2A45]' : 'text-gray-300'}`}>
                                  {val || '—'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* ── 인콜결과 + 재통화 (컴팩트) ── */}
                <div className="bg-gray-50 border-t border-gray-100 px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-medium">결정전</span>
                    {callResult ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${INCALL_CALL_RESULTS.find(o => o.key === callResult)?.color || 'bg-gray-200 text-gray-600'}`}>
                        {callResult}
                      </span>
                    ) : <span className="text-[10px] text-gray-300">—</span>}
                    {incallEditing && (
                      <div className="flex flex-wrap gap-1 ml-1">
                        {INCALL_CALL_RESULTS.filter(o => o.key).map(opt => (
                          <button key={opt.key} type="button"
                            onClick={() => incallField('call_result', callResult === opt.key ? '' : opt.key)}
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border transition-all ${
                              callResult === opt.key ? opt.color + ' border-transparent' : 'bg-white text-gray-400 border-gray-200'
                            }`}>{opt.key}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-medium">클로징</span>
                    {closingResult ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${INCALL_CLOSING_RESULTS.find(o => o.key === closingResult)?.color || 'bg-gray-200 text-gray-600'}`}>
                        {closingResult}
                      </span>
                    ) : <span className="text-[10px] text-gray-300">—</span>}
                    {incallEditing && (
                      <div className="flex flex-wrap gap-1 ml-1">
                        {INCALL_CLOSING_RESULTS.filter(o => o.key).map(opt => (
                          <button key={opt.key} type="button"
                            onClick={() => incallField('closing_result', closingResult === opt.key ? '' : opt.key)}
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border transition-all ${
                              closingResult === opt.key ? opt.color + ' border-transparent' : 'bg-white text-gray-400 border-gray-200'
                            }`}>{opt.key}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-medium">재통화</span>
                    {incallEditing ? (
                      <input type="date" value={subcallDate} onChange={e => incallField('subcall_date', e.target.value)}
                        className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none" />
                    ) : (
                      <span className={`text-[10px] font-semibold ${subcallDate ? 'text-amber-700' : 'text-gray-300'}`}>
                        {subcallDate ? `📅 ${subcallDate}` : '—'}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            )
          })()}
        </div>
      )}

      {/* ── 💰 입금/계약 ── */}
      {activeDetailTab === '💰 입금/계약' && (
        <div className="space-y-4">
          {/* 영업팀 계약 정보 (읽기 전용) */}
          {local.progress_memo && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-[10px] font-bold text-amber-700 mb-1.5">📋 영업팀 계약 정보 (읽기전용)</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{local.progress_memo}</p>
            </div>
          )}

          {/* 입금내역 (복수 입금 지원) */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">입금내역</span>
              <div className="flex-1 h-px bg-gray-100" />
              <button type="button"
                onClick={() => {
                  const entries: any[] = d.payment_entries || []
                  detailField('payment_entries', [...entries, { id: Date.now().toString(), date: '', approval_amount: '', fee_rate: '', fee_amount: '' }])
                }}
                className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-1 rounded font-bold transition-colors">
                + 입금내역 추가
              </button>
            </div>
            {/* 기본 첫번째 입금 블록 */}
            <div className="space-y-2">
              {/* 기본 단일 입금 (항상 표시) */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-emerald-700 mb-2">💰 1차 입금</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                  <div className="col-span-2">
                    <label className={lbl}>입금 날짜</label>
                    <input type="date" value={d.deposit_date || ''} onChange={e => detailField('deposit_date', e.target.value)} className={inp} />
                  </div>
                  <div><label className={lbl}>승인금액</label><input type="text" value={d.approval_amount || ''} onChange={e => detailField('approval_amount', e.target.value)} className={inp} placeholder="0원" /></div>
                  <div><label className={lbl}>수수료%</label><input type="text" value={d.fee_rate || ''} onChange={e => detailField('fee_rate', e.target.value)} className={inp} placeholder="%" /></div>
                  <div className="col-span-2"><label className={lbl}>수수료</label><input type="text" value={d.fee_amount || ''} onChange={e => detailField('fee_amount', e.target.value)} className={inp} placeholder="0원" /></div>
                </div>
              </div>
              {/* 추가 입금 블록들 */}
              {(d.payment_entries || []).map((entry: any, idx: number) => (
                <div key={entry.id || idx} className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-blue-700">💰 {idx + 2}차 입금</p>
                    <button type="button"
                      onClick={() => {
                        const entries: any[] = d.payment_entries || []
                        detailField('payment_entries', entries.filter((_: any, i: number) => i !== idx))
                      }}
                      className="text-[10px] text-red-400 hover:text-red-600 font-bold">✕ 삭제</button>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                    <div className="col-span-2">
                      <label className={lbl}>입금 날짜</label>
                      <input type="date" value={entry.date || ''} onChange={e => {
                        const entries: any[] = [...(d.payment_entries || [])]
                        entries[idx] = { ...entries[idx], date: e.target.value }
                        detailField('payment_entries', entries)
                      }} className={inp} />
                    </div>
                    <div><label className={lbl}>승인금액</label><input type="text" value={entry.approval_amount || ''} onChange={e => {
                      const entries: any[] = [...(d.payment_entries || [])]
                      entries[idx] = { ...entries[idx], approval_amount: e.target.value }
                      detailField('payment_entries', entries)
                    }} className={inp} placeholder="0원" /></div>
                    <div><label className={lbl}>수수료%</label><input type="text" value={entry.fee_rate || ''} onChange={e => {
                      const entries: any[] = [...(d.payment_entries || [])]
                      entries[idx] = { ...entries[idx], fee_rate: e.target.value }
                      detailField('payment_entries', entries)
                    }} className={inp} placeholder="%" /></div>
                    <div className="col-span-2"><label className={lbl}>수수료</label><input type="text" value={entry.fee_amount || ''} onChange={e => {
                      const entries: any[] = [...(d.payment_entries || [])]
                      entries[idx] = { ...entries[idx], fee_amount: e.target.value }
                      detailField('payment_entries', entries)
                    }} className={inp} placeholder="0원" /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 기타 재무 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">기타 재무</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
              <div><label className={lbl}>미입금액</label><input type="text" value={d.unpaid_amount || ''} onChange={e => detailField('unpaid_amount', e.target.value)} className={inp} placeholder="0원" /></div>
              <div><label className={lbl}>계약금(VAT포함)</label><input type="text" value={d.contract_amount_vat || ''} onChange={e => detailField('contract_amount_vat', e.target.value)} className={inp} placeholder="0원" /></div>
              <div><label className={lbl}>계약금(VAT제외)</label><input type="text" value={d.contract_amount || ''} onChange={e => detailField('contract_amount', e.target.value)} className={inp} placeholder="0원" /></div>
              <div><label className={lbl}>입금액(VAT포함)</label><input type="text" value={d.deposit_amount_vat || ''} onChange={e => detailField('deposit_amount_vat', e.target.value)} className={inp} placeholder="0원" /></div>
              <div><label className={lbl}>입금액(VAT제외)</label><input type="text" value={d.deposit_amount || ''} onChange={e => detailField('deposit_amount', e.target.value)} className={inp} placeholder="0원" /></div>
            </div>
          </div>

          {/* 결제방식 */}
          <div>
            <label className={lbl}>결제방식</label>
            <div className="flex gap-2 mt-1">
              {[{ key: 'has_invoice', label: '계산서' }, { key: 'has_cash', label: '현금' }, { key: 'has_card', label: '카드' }].map(opt => (
                <button key={opt.key} type="button" onClick={() => toggleDetail(opt.key)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    d[opt.key] ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}>{opt.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// OpsCard (기관별 그룹용, 동시진행 기관 표시)
// ──────────────────────────────────────────────────────────────────────
function OpsCard({ c, isOpen, onToggle, onScriptToggle }: {
  c: OpsCase; isOpen: boolean
  onToggle: (id: string) => void
  onScriptToggle: (id: string, val: boolean) => void
}) {
  const stage = PIPELINE_STAGES.find(s => s.key === c.progress_stage)
  const companyName = c.customers?.details?.company || c.customers?.name || '—'
  const scriptSent = c.details?.script_sent || false
  const nextInst = c.details?.next_inst || ''
  const nextDate = c.details?.visit_date || ''
  const allInstitutions = (c.institution || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const hasMultiple = allInstitutions.length > 1

  return (
    <div
      className={`bg-white border rounded-xl p-2.5 cursor-pointer hover:shadow-md transition-all text-center relative ${
        isOpen ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-200 hover:border-violet-300'
      }`}
      onClick={() => onToggle(c.id)}
    >
      {/* 업체명 */}
      <p className="font-bold text-[#1B2A45] text-[11px] leading-snug"
        style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
        {companyName}
      </p>
      {/* 대표자 — 업체명과 다를 때만 표시 */}
      {c.customers?.name && c.customers.name !== companyName && (
        <p className="text-[10px] text-gray-400 mt-0.5">{c.customers?.name}</p>
      )}
      {/* 전화번호 */}
      <p className="text-[9px] text-gray-400 mt-0.5 font-mono">{c.customers?.phone}</p>

      {/* 진행 단계 */}
      <div className="mt-1.5">
        {stage ? (
          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-white ${stage.color}`}>
            {stage.label}
          </span>
        ) : c.progress_stage ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-gray-400">
            {c.progress_stage}
          </span>
        ) : null}
      </div>

      {/* 동시진행 기관 표시 (복수일 때) */}
      {hasMultiple && (
        <div className="mt-1 flex flex-wrap gap-0.5 justify-center">
          {allInstitutions.map(inst => (
            <span key={inst} className={`text-[8px] px-1 py-0.5 rounded font-medium ${
              INDIRECT_SET.has(inst) ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
            }`}>{inst}</span>
          ))}
        </div>
      )}

      {/* 다음 기관 + 날짜 */}
      {(nextInst || nextDate) && (
        <div className="mt-1.5 flex items-center justify-center gap-1 flex-wrap">
          {nextInst && (
            <span className="text-[8px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">→ {nextInst}</span>
          )}
          {nextDate && (
            <span className="text-[8px] text-sky-500 font-medium">📅 {nextDate.slice(5)}</span>
          )}
        </div>
      )}

      {/* 승인대기 뱃지 */}
      {(c.progress_stage === '환불예정' || c.progress_stage === '종료예정') && (
        <div className={`mt-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
          c.progress_stage === '환불예정' ? 'bg-rose-100 text-rose-700' : 'bg-orange-100 text-orange-700'
        }`}>
          ⏳ 대표 승인 대기
        </div>
      )}

      {/* 빠른 일정 표시 */}
      {(() => {
        const today = new Date().toISOString().slice(0, 10)
        const candidates = [
          { label: '직방문', date: c.details?.direct_visit_date },
          { label: '간방문', date: c.details?.indirect_visit_date },
          { label: '직실사', date: c.details?.direct_inspection_date },
          { label: '간실사', date: c.details?.indirect_inspection_date },
        ].filter(d => d.date && d.date >= today).sort((a, b) => a.date!.localeCompare(b.date!))
        const nearest = candidates[0]
        if (!nearest) return null
        return (
          <div className="mt-1.5 flex items-center justify-center gap-0.5">
            <span className="text-[8px] bg-sky-50 text-sky-600 font-semibold px-1.5 py-0.5 rounded-full border border-sky-200">
              📅 {nearest.label} {nearest.date!.slice(5)}
            </span>
          </div>
        )
      })()}

      {/* 스크립트 발송 체크 */}
      <div className="mt-1.5 flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
        <input type="checkbox" id={`script-${c.id}`} checked={scriptSent}
          onChange={e => onScriptToggle(c.id, e.target.checked)}
          className="w-3 h-3 accent-violet-500 cursor-pointer" />
        <label htmlFor={`script-${c.id}`}
          className={`text-[9px] cursor-pointer select-none ${scriptSent ? 'text-violet-600 font-semibold line-through' : 'text-gray-400'}`}>
          스크립트 발송
        </label>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// CaseListRow (환불/종료용 리스트 행) — 레거시, CaseCard로 교체됨
// ──────────────────────────────────────────────────────────────────────
function CaseListRow({ c, onToggle, isOpen }: { c: OpsCase; onToggle: (id: string) => void; isOpen: boolean }) {
  const companyName = c.customers?.details?.company || c.customers?.name || '—'
  const stage = PIPELINE_STAGES.find(s => s.key === c.progress_stage)
  const latestTimeline = c.timeline && c.timeline.length > 0 ? c.timeline[c.timeline.length - 1] : null

  return (
    <div
      className={`bg-white border rounded-xl px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:border-violet-300 transition-colors ${
        isOpen ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-200'
      }`}
      onClick={() => onToggle(c.id)}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[#1B2A45] text-sm" style={{ wordBreak: 'break-all' }}>{companyName}</span>
          <span className="text-xs text-gray-400">{c.customers?.name}</span>
          <span className="text-[10px] text-gray-400 font-mono">{c.customers?.phone}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {c.institution && <span className="text-[10px] text-gray-500">🏦 {c.institution}</span>}
          {latestTimeline && (
            <span className="text-[10px] text-gray-400">
              {formatKST(latestTimeline.created_at || latestTimeline.date || '').date} — {(latestTimeline.content || latestTimeline.text || '').slice(0, 30)}
            </span>
          )}
          {c.ops_user_name && <span className="text-[10px] text-violet-500">{c.ops_user_name}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {c.details?.approval_amount && (
          <span className="text-[10px] text-emerald-600 font-medium">{c.details.approval_amount}</span>
        )}
        {stage ? (
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold text-white ${stage.color}`}>{stage.label}</span>
        ) : (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">{c.progress_stage || '—'}</span>
        )}
        <span className="text-gray-300 text-xs">›</span>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// CaseCard (환불/종료용 카드형)
// ──────────────────────────────────────────────────────────────────────
function CaseCard({ c, onToggle, isOpen, cardType }: {
  c: OpsCase
  onToggle: (id: string) => void
  isOpen: boolean
  cardType: 'refund' | 'completed'
}) {
  const companyName = c.customers?.details?.company || c.customers?.name || '—'
  // 이동 날짜: timeline에서 환불/종료 변경 기록 찾기, 없으면 updated_at
  const movedTimeline = (c.timeline || []).slice().reverse().find((e: any) => {
    const txt = (e.content || e.text || '').toLowerCase()
    return cardType === 'refund' ? txt.includes('환불') : (txt.includes('종료') || txt.includes('완료'))
  })
  const movedDate = movedTimeline
    ? formatKST(movedTimeline.created_at || movedTimeline.date || '').date
    : formatKST(c.updated_at || '').date

  const stageBg  = cardType === 'refund' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
  const borderOn = cardType === 'refund' ? 'ring-2 ring-rose-400 border-rose-300' : 'ring-2 ring-emerald-400 border-emerald-300'
  const borderOff = cardType === 'refund' ? 'border-gray-200 hover:border-rose-300' : 'border-gray-200 hover:border-emerald-300'

  return (
    <div
      className={`bg-white border rounded-xl p-2.5 cursor-pointer hover:shadow-md transition-all text-center relative ${isOpen ? borderOn : borderOff}`}
      onClick={() => onToggle(c.id)}
    >
      {/* 스테이지 뱃지 */}
      <div className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold mb-1 ${stageBg}`}>
        {cardType === 'refund' ? '💸 환불' : '✅ 종료'}
      </div>
      {/* 업체명 */}
      <p className="font-bold text-[#1B2A45] text-[11px] leading-snug break-all" style={{ wordBreak: 'break-all' }}>
        {companyName}
      </p>
      {/* 대표자 */}
      <p className="text-[10px] text-gray-400 mt-0.5">{c.customers?.name}</p>
      {/* 기관 */}
      {c.institution && (
        <p className="text-[9px] text-violet-500 mt-0.5 font-medium">🏦 {c.institution.split(',')[0].trim()}</p>
      )}
      {/* 이동 날짜 */}
      <div className={`mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${cardType === 'refund' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
        📅 {movedDate || '—'}
      </div>
      {/* 담당자 */}
      {c.ops_user_name && (
        <p className="text-[9px] text-gray-400 mt-0.5">{c.ops_user_name}</p>
      )}
      {/* 승인금액 */}
      {c.details?.approval_amount && (
        <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">{c.details.approval_amount}</p>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// DashboardOverview
// ──────────────────────────────────────────────────────────────────────
function DashboardOverview({ cases }: { cases: OpsCase[] }) {
  const activeCases    = cases.filter(c => ACTIVE_STAGE_KEYS.has(c.progress_stage) || (!REFUND_STAGE_KEYS.has(c.progress_stage) && !COMPLETED_STAGE_KEYS.has(c.progress_stage) && !c.is_refund && !c.is_completed))
  const refundCases    = cases.filter(c => REFUND_STAGE_KEYS.has(c.progress_stage) || c.is_refund)
  const completedCases = cases.filter(c => COMPLETED_STAGE_KEYS.has(c.progress_stage) || c.is_completed)

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthCases = completedCases.filter(c => (c.details?.contract_date || c.updated_at || '').startsWith(thisMonth))
  const monthRevenue = monthCases.reduce((s, c) => {
    const v = parseFloat((c.details?.deposit_amount || c.details?.contract_amount || '0').replace(/[^0-9.]/g, ''))
    return s + (isNaN(v) ? 0 : v)
  }, 0)

  // 기관별 분포
  const instMap: Record<string, number> = {}
  activeCases.forEach(c => {
    const insts = (c.institution || '').split(',').map((s: string) => s.trim()).filter(Boolean)
    insts.forEach(inst => { instMap[inst] = (instMap[inst] || 0) + 1 })
  })
  const instEntries = ALL_INST_ORDER.filter(i => instMap[i] > 0).map(i => ({ inst: i, count: instMap[i] }))

  // 단계별 분포 (top5)
  const stageMap: Record<string, number> = {}
  activeCases.forEach(c => { stageMap[c.progress_stage] = (stageMap[c.progress_stage] || 0) + 1 })
  const stageEntries = Object.entries(stageMap).sort((a, b) => b[1] - a[1]).slice(0, 6)

  // 본인 매출 계산
  const allMonthRevenue = monthCases.reduce((s, c) => {
    const v = parseFloat((c.details?.deposit_amount || c.details?.contract_amount || '0').replace(/[^0-9.]/g, ''))
    return s + (isNaN(v) ? 0 : v)
  }, 0)
  const totalAllRevenue = completedCases.reduce((s, c) => {
    const v = parseFloat((c.details?.deposit_amount || c.details?.contract_amount || '0').replace(/[^0-9.]/g, ''))
    return s + (isNaN(v) ? 0 : v)
  }, 0)

  return (
    <div className="space-y-4">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '전체 케이스', value: cases.length, color: 'text-[#1B2A45]', bg: 'bg-[#1B2A45]/5' },
          { label: '진행중', value: activeCases.length, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: '이번달 종료', value: monthCases.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: '환불', value: refundCases.length, color: 'text-rose-500', bg: 'bg-rose-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 본인 매출 현황 */}
      {(allMonthRevenue > 0 || totalAllRevenue > 0) && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-[11px] font-bold text-emerald-700 mb-3">💰 나의 매출 현황</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 text-center border border-emerald-100">
              <p className="text-[10px] text-gray-400 mb-1">이번달 입금</p>
              <p className="text-lg font-black text-emerald-700">{fmt(allMonthRevenue)}원</p>
              <p className="text-[9px] text-gray-400">{monthCases.length}건</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center border border-emerald-100">
              <p className="text-[10px] text-gray-400 mb-1">과거 총 입금</p>
              <p className="text-lg font-black text-[#1B2A45]">{fmt(totalAllRevenue)}원</p>
              <p className="text-[9px] text-gray-400">{completedCases.length}건</p>
            </div>
          </div>
        </div>
      )}

      {/* 이번달 매출 */}
      {monthRevenue > 0 && (
        <div className="bg-gradient-to-r from-violet-500 to-indigo-600 rounded-xl p-4 text-white">
          <p className="text-xs text-white/60 mb-1">이번달 입금 합계</p>
          <p className="text-2xl font-black">{fmt(monthRevenue)}원</p>
        </div>
      )}

      {/* 기관별 분포 */}
      {instEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">📊 기관별 진행 현황</p>
          <div className="space-y-2">
            {instEntries.map(({ inst, count }) => {
              const isIndirect = INDIRECT_SET.has(inst)
              const pct = Math.round(count / activeCases.length * 100)
              return (
                <div key={inst} className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold w-24 shrink-0 ${isIndirect ? 'text-violet-600' : 'text-blue-600'}`}>{inst}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className={`h-2 rounded-full ${isIndirect ? 'bg-violet-400' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-500 w-8 text-right">{count}건</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 단계별 분포 */}
      {stageEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">📋 단계별 현황</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stageEntries.map(([stage, count]) => {
              const s = PIPELINE_STAGES.find(p => p.key === stage)
              return (
                <div key={stage} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s?.color || 'bg-gray-400'}`} />
                  <span className="text-[11px] text-gray-700 flex-1">{stage}</span>
                  <span className="text-[11px] font-bold text-gray-800">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// InstitutionGroupedView (진행중업체 - 기관별 카드 그룹)
// ──────────────────────────────────────────────────────────────────────
function InstitutionGroupedView({ cases, openPanelIds, onToggle, onScriptToggle }: {
  cases: OpsCase[]
  openPanelIds: string[]
  onToggle: (id: string) => void
  onScriptToggle: (id: string, val: boolean) => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // 승인 대기 케이스 분리 (환불예정/종료예정) — 기관 그룹에서 제외
  const pendingCases = cases.filter(c =>
    PENDING_REFUND_KEYS.has(c.progress_stage) || PENDING_DONE_KEYS.has(c.progress_stage)
  )
  const regularCases = cases.filter(c =>
    !PENDING_REFUND_KEYS.has(c.progress_stage) && !PENDING_DONE_KEYS.has(c.progress_stage)
  )

  // 기관별 그룹: 한 케이스가 여러 기관에 걸쳐 있으면 모두 등장
  const instGroups = ALL_INST_ORDER.map(inst => ({
    inst,
    items: regularCases.filter(c =>
      (c.institution || '').split(',').map((s: string) => s.trim()).includes(inst)
    ),
  })).filter(g => g.items.length > 0)

  // 신규 유입 (institution이 비어있는 케이스) — 제일 상단에 배치
  const unassigned = regularCases.filter(c => !c.institution || c.institution.trim() === '')
  if (unassigned.length > 0) instGroups.unshift({ inst: '신규 유입', items: unassigned })
  // 승인 대기 — 최상단에 배치
  if (pendingCases.length > 0) instGroups.unshift({ inst: '⏳ 대표 승인 대기', items: pendingCases })

  if (instGroups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E8E2D4] p-14 text-center text-[#1B2A45]/40 text-sm">
        진행중인 업체가 없습니다
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {instGroups.map(({ inst, items }) => {
        const isIndirect = INDIRECT_SET.has(inst)
        const isOpen = !collapsed[inst]
        return (
          <div key={inst}>
            {/* 기관 헤더 */}
            <button
              onClick={() => setCollapsed(p => ({ ...p, [inst]: !p[inst] }))}
              className={`w-full flex items-center justify-between py-2.5 px-4 rounded-xl mb-2 transition-colors ${
                isIndirect
                  ? 'bg-violet-600 hover:bg-violet-700'
                  : inst === '신규 유입'
                    ? 'bg-sky-500 hover:bg-sky-600'
                    : inst === '⏳ 대표 승인 대기'
                      ? 'bg-rose-500 hover:bg-rose-600'
                      : 'bg-[#1B2A45] hover:bg-[#1B2A45]/90'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">{inst}</span>
                <span className="bg-[#C5A258] text-white text-xs font-bold px-2 py-0.5 rounded-full">{items.length}</span>
                {isIndirect && <span className="text-white/60 text-[10px]">간접자금</span>}
              </div>
              <span className="text-white/60 text-xs">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {items.map(c => (
                  <OpsCard
                    key={`${inst}-${c.id}`}
                    c={c}
                    isOpen={openPanelIds.includes(c.id)}
                    onToggle={onToggle}
                    onScriptToggle={onScriptToggle}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// OpsNewDbTab (신규DB - 대표에게 배정받은 뿌토 DB)
// ──────────────────────────────────────────────────────────────────────
function OpsNewDbTab({ cases, userName, onSave }: {
  cases: OpsCase[]
  userName: string
  onSave: (id: string, patch: Record<string, any>) => void
}) {
  const [contractingCase, setContractingCase] = useState<OpsCase | null>(null)
  const [form, setForm] = useState({ institution: '', contract_amount: '', stage: '서류받는중', memo: '' })
  const [saving, setSaving] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  function openContractModal(c: OpsCase) {
    setContractingCase(c)
    setForm({ institution: c.institution || '', contract_amount: '', stage: '서류받는중', memo: '' })
  }

  function handleContract() {
    if (!contractingCase) return
    setSaving(true)
    const patch: Record<string, any> = {
      progress_stage: form.stage,
      institution: form.institution || contractingCase.institution,
      details: {
        ...(contractingCase.details || {}),
        puto_contract_amount: form.contract_amount,
        puto_contract_date: new Date().toISOString().slice(0, 10),
        puto_contract_memo: form.memo,
      },
      timeline: [
        ...(contractingCase.timeline || []),
        {
          user: userName,
          content: `🆕 뿌토DB 계약 시작 → ${form.institution || '기관미정'}${form.contract_amount ? ' / ' + Number(form.contract_amount.replace(/[^0-9]/g,'')).toLocaleString() + '원' : ''}`,
          created_at: nowKST(),
        },
      ],
    }
    onSave(contractingCase.id, patch)
    setSaving(false)
    setContractingCase(null)
  }

  return (
    <div className="space-y-4">

      {/* 계약 모달 */}
      {contractingCase && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setContractingCase(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#1B2A45] to-sky-700 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-sm">🆕 뿌토DB 계약 처리</h3>
                  <p className="text-white/60 text-xs mt-0.5">
                    {contractingCase.customers?.details?.company || contractingCase.customers?.name}
                  </p>
                </div>
                <button onClick={() => setContractingCase(null)} className="text-white/60 hover:text-white text-lg">✕</button>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* 담당 기관 */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 mb-1.5">🏦 담당 기관 (복수 선택)</p>
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-blue-500 font-medium w-12 flex items-center">직접</span>
                    {INST_DIRECT.map(inst => {
                      const sel = form.institution.split(',').map(s => s.trim()).includes(inst)
                      return (
                        <button key={inst} type="button"
                          onClick={() => {
                            const cur = form.institution.split(',').map(s => s.trim()).filter(Boolean)
                            const next = sel ? cur.filter(s => s !== inst) : [...cur, inst]
                            setForm(p => ({ ...p, institution: next.join(', ') }))
                          }}
                          className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${sel ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                          {inst}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-violet-500 font-medium w-12 flex items-center">간접</span>
                    {INST_INDIRECT.map(inst => {
                      const sel = form.institution.split(',').map(s => s.trim()).includes(inst)
                      return (
                        <button key={inst} type="button"
                          onClick={() => {
                            const cur = form.institution.split(',').map(s => s.trim()).filter(Boolean)
                            const next = sel ? cur.filter(s => s !== inst) : [...cur, inst]
                            setForm(p => ({ ...p, institution: next.join(', ') }))
                          }}
                          className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${sel ? 'bg-violet-500 text-white border-violet-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                          {inst}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              {/* 계약금액 */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">💰 계약금액 (원)</label>
                <input
                  type="text"
                  value={form.contract_amount}
                  onChange={e => setForm(p => ({ ...p, contract_amount: e.target.value }))}
                  placeholder="예: 3,000,000"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
              {/* 시작 단계 */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">📌 시작 단계</label>
                <select
                  value={form.stage}
                  onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400">
                  {PIPELINE_STAGES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              {/* 메모 */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">📝 메모</label>
                <textarea
                  value={form.memo}
                  onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
                  rows={2}
                  placeholder="특이사항 입력..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-sky-400 resize-none"
                />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setContractingCase(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                취소
              </button>
              <button onClick={handleContract} disabled={saving || !form.institution}
                className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {saving ? '처리중...' : '✅ 계약 시작 → 진행중'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-sky-700 rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-base">🆕 신규DB (뿌토)</h2>
            <p className="text-white/60 text-xs mt-0.5">대표로부터 배정받은 DB · 계약 처리 시 진행중업체로 자동 이동</p>
          </div>
          <span className="bg-white/20 text-white font-black text-xl px-4 py-1.5 rounded-xl">{cases.length}</span>
        </div>
      </div>

      {/* 카드 그리드 */}
      {cases.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-16 text-center">
          <p className="text-2xl mb-2">📭</p>
          <p className="text-sm font-semibold text-gray-400">배정된 신규DB가 없습니다</p>
          <p className="text-xs text-gray-300 mt-1">대표가 뿌토 DB를 배정하면 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {cases.map(c => {
            const company = c.customers?.details?.company || c.customers?.name || '—'
            const { date } = formatKST(c.created_at || '')
            return (
              <div key={c.id}
                className={`bg-white border rounded-xl p-2.5 cursor-pointer hover:shadow-md transition-all text-center relative ${
                  openId === c.id ? 'ring-2 ring-sky-400 border-sky-300' : 'border-gray-200 hover:border-sky-300'
                }`}
                onClick={() => setOpenId(id => id === c.id ? null : c.id)}
              >
                {/* 배정 뱃지 */}
                <div className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold mb-1 bg-sky-100 text-sky-700">
                  🆕 배정
                </div>
                {/* 업체명 */}
                <p className="font-bold text-[#1B2A45] text-[11px] leading-snug break-all" style={{ wordBreak: 'break-all' }}>
                  {company}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{c.customers?.name}</p>
                {c.institution && (
                  <p className="text-[9px] text-violet-500 mt-0.5 font-medium">🏦 {c.institution.split(',')[0].trim()}</p>
                )}
                <p className="text-[9px] text-gray-300 mt-0.5">배정: {date}</p>
                {/* 계약하기 버튼 */}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); openContractModal(c) }}
                  className="mt-1.5 w-full text-[9px] bg-sky-500 hover:bg-sky-600 text-white rounded py-1 font-semibold transition-colors"
                >
                  ✅ 계약하기
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* 상세 드로어 */}
      {openId && (() => {
        const c = cases.find(x => x.id === openId)
        if (!c) return null
        return (
          <div className="bg-white border border-sky-200 rounded-2xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-[#1B2A45] text-sm">
                {c.customers?.details?.company || c.customers?.name}
              </span>
              <div className="flex gap-2">
                <button onClick={() => openContractModal(c)}
                  className="text-xs bg-sky-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-sky-600">
                  ✅ 계약하기
                </button>
                <button onClick={() => setOpenId(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
              </div>
            </div>
            <OpsDetailPanel c={c} onSave={onSave} userRole="ops" />
          </div>
        )
      })()}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// OpsContractTab (관리팀계약 - 거절DB 직접계약)
// ──────────────────────────────────────────────────────────────────────
function OpsContractTab({ userName }: { userName: string }) {
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    company: '', name: '', phone: '', contract_date: '',
    contract_amount: '', memo: '',
  })

  useEffect(() => { loadContracts() }, [])

  async function loadContracts() {
    setLoading(true)
    const res = await fetch('/api/ops-cases')
    const data = await res.json()
    const opsContracts = (data.cases || []).filter((c: any) => c.details?.is_ops_direct_contract === true)
    setContracts(opsContracts)
    setLoading(false)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.company.trim()) return
    setSaving(true)
    try {
      // 고객 생성 후 ops_case 생성
      const custRes = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          status: 'contracted',
          details: {
            company: form.company,
            sales_user_name: userName,
            contract_date: form.contract_date,
          },
        }),
      })
      if (custRes.ok) {
        const custData = await custRes.json()
        const customerId = custData.customer?.id || custData.id
        if (customerId) {
          await fetch('/api/ops-cases', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_id: customerId,
              progress_stage: '서류받는중',
              details: {
                is_ops_direct_contract: true,
                contract_source: 'rejected_db',
                commission_rate: 50,
                contract_amount: form.contract_amount,
                ops_contract_memo: form.memo,
                contract_date: form.contract_date,
              },
              timeline: [{ user: userName, content: '관리팀 직접계약 등록 (거절DB)', created_at: nowKST() }],
            }),
          })
        }
      }
      setForm({ company: '', name: '', phone: '', contract_date: '', contract_amount: '', memo: '' })
      setShowForm(false)
      loadContracts()
    } finally {
      setSaving(false)
    }
  }

  // 총 수수료 계산 (50%)
  const totalCommission = contracts.reduce((sum, c) => {
    const amt = parseFloat((c.details?.contract_amount || '0').replace(/[^0-9.]/g, ''))
    return sum + (isNaN(amt) ? 0 : amt * 0.5)
  }, 0)

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-violet-700 rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-base">📝 관리팀 직접계약</h2>
            <p className="text-white/60 text-xs mt-0.5">거절DB 넘겨받아 계약한 업체 (계약금의 50% 지급)</p>
          </div>
          <button onClick={() => setShowForm(p => !p)}
            className="bg-[#C5A258] hover:bg-[#C5A258]/90 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
            + 계약 등록
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-white/50 text-[10px]">총 계약 건수</p>
            <p className="text-white font-black text-xl">{contracts.length}</p>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-white/50 text-[10px]">예상 수수료 합계 (50%)</p>
            <p className="text-white font-black text-lg">{fmt(totalCommission)}원</p>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-white/50 text-[10px]">수수료율</p>
            <p className="text-white font-black text-xl">50%</p>
          </div>
        </div>
      </div>

      {/* 등록 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h3 className="font-semibold text-[#1B2A45] text-sm">📋 신규 관리팀 계약 등록</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'company', label: '업체명', placeholder: '업체명 입력', required: true },
              { key: 'name', label: '대표명', placeholder: '대표자명' },
              { key: 'phone', label: '연락처', placeholder: '010-0000-0000' },
              { key: 'contract_date', label: '계약일', type: 'date' },
              { key: 'contract_amount', label: '계약금액 (원)', placeholder: '예: 3000000' },
              { key: 'memo', label: '메모', placeholder: '특이사항' },
            ].map((f: any) => (
              <div key={f.key}>
                <label className="text-xs text-gray-500 mb-1 block font-medium">{f.label}{f.required && ' *'}</label>
                <input
                  type={f.type || 'text'}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  required={f.required}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
              </div>
            ))}
          </div>
          {form.contract_amount && (
            <div className="bg-violet-50 rounded-lg px-4 py-2 text-sm">
              <span className="text-violet-700 font-semibold">
                예상 수수료 (50%): {fmt(parseFloat(form.contract_amount.replace(/[^0-9.]/g, '') || '0') * 0.5)}원
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold transition-colors">
              {saving ? '등록 중...' : '✅ 계약 등록'}
            </button>
          </div>
        </form>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : contracts.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-12 text-center text-gray-400 text-sm">
          등록된 관리팀 직접계약이 없습니다<br />
          <span className="text-xs text-gray-300 mt-1 block">거절DB를 넘겨받아 계약한 업체를 등록하세요</span>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map(c => {
            const companyName = c.customers?.details?.company || c.customers?.name || '—'
            const amt = parseFloat((c.details?.contract_amount || '0').replace(/[^0-9.]/g, ''))
            const commission = isNaN(amt) ? 0 : amt * 0.5
            const stage = PIPELINE_STAGES.find(s => s.key === c.progress_stage)
            return (
              <div key={c.id} className="bg-white border border-[#E8E2D4] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#1B2A45] text-sm" style={{ wordBreak: 'break-all' }}>{companyName}</span>
                    <span className="text-xs text-gray-400">{c.customers?.name}</span>
                    <span className="text-[10px] text-gray-400">{c.customers?.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.details?.contract_date && <span className="text-[10px] text-gray-400">계약일: {c.details.contract_date}</span>}
                    {amt > 0 && <span className="text-[10px] text-gray-500">계약금: {fmt(amt)}원</span>}
                    {commission > 0 && <span className="text-[10px] font-bold text-violet-600">수수료: {fmt(commission)}원</span>}
                  </div>
                  {c.details?.ops_contract_memo && <p className="text-[10px] text-gray-400 mt-0.5">{c.details.ops_contract_memo}</p>}
                </div>
                <div className="shrink-0">
                  {stage ? (
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold text-white ${stage.color}`}>{stage.label}</span>
                  ) : (
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">{c.progress_stage || '진행중'}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// OpsReportTab (관리팀 특화 일일 보고)
// ──────────────────────────────────────────────────────────────────────
const ACTION_TYPES = [
  { value: '서류수거',   label: '서류수거',   color: 'bg-gray-500' },
  { value: '접수',       label: '접수',       color: 'bg-sky-500' },
  { value: '신청완료',   label: '신청완료',   color: 'bg-blue-500' },
  { value: '실사처리',   label: '실사처리',   color: 'bg-amber-500' },
  { value: '승인',       label: '승인',       color: 'bg-emerald-500' },
  { value: '부결',       label: '부결',       color: 'bg-red-500' },
  { value: '입금완료',   label: '입금완료',   color: 'bg-teal-500' },
  { value: '방문처리',   label: '방문처리',   color: 'bg-violet-500' },
  { value: '보정처리',   label: '보정처리',   color: 'bg-orange-500' },
  { value: '기타',       label: '기타',       color: 'bg-slate-400' },
]

interface OpsProcessedEntry {
  company: string
  action: string
  institution: string
  amount: string
  memo: string
  _locked?: boolean
}

interface OpsDailyReport {
  processed: OpsProcessedEntry[]
  tomorrow_plan: string
  special_notes: string
  month_revenue: string
  new_contracts_count: string
}

function OpsReportTab({ userId, userName }: { userId: string; userName: string }) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pastReports, setPastReports] = useState<any[]>([])
  const [editDate, setEditDate] = useState<string | null>(null)
  const [viewReport, setViewReport] = useState<any | null>(null)

  const [data, setData] = useState<OpsDailyReport>({
    processed: [],
    tomorrow_plan: '',
    special_notes: '',
    month_revenue: '',
    new_contracts_count: '',
  })

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => setPastReports(d.reports || []))
  }, [submitted])

  function addProcessed() {
    setData(p => ({ ...p, processed: [...p.processed, { company: '', action: '', institution: '', amount: '', memo: '', _locked: false }] }))
  }
  function updateProcessed(i: number, key: string, val: any) {
    setData(p => ({ ...p, processed: p.processed.map((item, j) => j === i ? { ...item, [key]: val } : item) }))
  }
  function removeProcessed(i: number) {
    setData(p => ({ ...p, processed: p.processed.filter((_, j) => j !== i) }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    // strip _locked UI fields
    const cleanProcessed = data.processed.map(({ _locked, ...rest }) => rest)
    const payload = { ...data, processed: cleanProcessed }
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_type: 'ops_daily', report_date: editDate || todayStr, data: payload }),
    })
    if (res.ok) { setSubmitted(true); setEditDate(null) }
    setSubmitting(false)
  }

  function loadForEdit(r: any) {
    setData({
      processed: r.data?.processed || [],
      tomorrow_plan: r.data?.tomorrow_plan || '',
      special_notes: r.data?.special_notes || '',
      month_revenue: r.data?.month_revenue || '',
      new_contracts_count: r.data?.new_contracts_count || '',
    })
    setEditDate(r.report_date)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const opsReports = pastReports.filter(r => r.report_type === 'ops_daily' || r.report_type === 'ops_morning')

  // 누적 통계
  const totalProcessed = opsReports.reduce((s, r) => s + (r.data?.processed?.length || 0), 0)
  const approvalCount = opsReports.reduce((s, r) => s + (r.data?.processed || []).filter((p: any) => p.action === '승인').length, 0)
  const depositCount = opsReports.reduce((s, r) => s + (r.data?.processed || []).filter((p: any) => p.action === '입금완료').length, 0)

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* 누적 통계 */}
      {opsReports.length > 0 && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
          <p className="text-xs text-violet-700 font-bold mb-3">📋 나의 업무보고 누적 통계 ({opsReports.length}건)</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '총 처리건수', value: totalProcessed + '건', color: 'text-[#1B2A45]' },
              { label: '승인 결과', value: approvalCount + '건', color: 'text-emerald-600' },
              { label: '입금 완료', value: depositCount + '건', color: 'text-teal-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg p-2.5 text-center border border-violet-100">
                <p className="text-[10px] text-gray-400 mb-0.5">{s.label}</p>
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 제출 완료 팝업 */}
      {submitted && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] px-6">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center">
            <div className="w-20 h-20 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">업무보고 완료!</h2>
            <p className="text-sm text-gray-500 mb-1">대표님께 성공적으로 전송되었습니다.</p>
            <p className="text-xs text-gray-400 mb-7">{todayStr} · {userName}</p>
            <button onClick={() => setSubmitted(false)}
              className="w-full bg-violet-500 hover:bg-violet-600 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors">
              확인
            </button>
          </div>
        </div>
      )}

      {/* 보고 폼 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          {editDate && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 flex items-center justify-between mb-3">
              <span className="text-xs text-violet-700 font-medium">✏️ 수정 중 — {editDate}</span>
              <button type="button" onClick={() => setEditDate(null)} className="text-xs text-violet-500 hover:text-violet-700">취소</button>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">📋 관리팀 일일업무보고</h3>
            <span className="text-xs text-gray-400">{editDate || todayStr} · {userName}</span>
          </div>

          {/* 계약/매출 현황 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">이번달 매출</label>
              <input type="text" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                placeholder="예: 5,000,000원" value={data.month_revenue} onChange={e => setData(p => ({ ...p, month_revenue: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-medium">이번달 신규 계약 수</label>
              <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                placeholder="0" value={data.new_contracts_count} onChange={e => setData(p => ({ ...p, new_contracts_count: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* 오늘 처리 업체 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800 text-sm">📂 오늘 처리 업체</h4>
            <button type="button" onClick={addProcessed}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-violet-50 text-violet-600 border border-violet-100 hover:bg-violet-100 transition-colors">
              + 추가
            </button>
          </div>
          {data.processed.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">+ 추가를 눌러 오늘 처리한 업체를 입력하세요</p>
          ) : (
            <div className="space-y-3">
              {data.processed.map((item, i) => (
                item._locked ? (
                  <div key={i} className="border-l-4 border-violet-400 bg-violet-50/50 rounded-r-lg p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-800 text-sm">{item.company || '(업체명 없음)'}</span>
                        {item.action && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold text-white ${ACTION_TYPES.find(a => a.value === item.action)?.color || 'bg-gray-400'}`}>
                            {item.action}
                          </span>
                        )}
                        {item.institution && <span className="text-[10px] text-gray-500">🏦 {item.institution}</span>}
                        {item.amount && <span className="text-[10px] text-emerald-600 font-semibold">{item.amount}</span>}
                      </div>
                      {item.memo && <p className="text-xs text-gray-500 mt-0.5">{item.memo}</p>}
                    </div>
                    <button type="button" onClick={() => updateProcessed(i, '_locked', false)}
                      className="shrink-0 text-xs text-amber-500 hover:text-amber-700 font-medium border border-amber-200 rounded-lg px-2 py-1 bg-white">수정</button>
                  </div>
                ) : (
                  <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">#{i + 1}</span>
                      <button type="button" onClick={() => removeProcessed(i)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400 mb-0.5 block">업체명</label>
                        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                          placeholder="업체명" value={item.company}
                          onChange={e => updateProcessed(i, 'company', e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && item.company.trim() && (e.preventDefault(), updateProcessed(i, '_locked', true))} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-0.5 block">처리 기관</label>
                        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                          placeholder="중진공, 기보 등" value={item.institution}
                          onChange={e => updateProcessed(i, 'institution', e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-0.5 block">처리 유형</label>
                      <div className="flex flex-wrap gap-1">
                        {ACTION_TYPES.map(a => (
                          <button key={a.value} type="button"
                            onClick={() => updateProcessed(i, 'action', item.action === a.value ? '' : a.value)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                              item.action === a.value
                                ? `${a.color} text-white border-transparent`
                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                            }`}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-400 mb-0.5 block">금액 (있을 경우)</label>
                        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                          placeholder="예: 5,000만원 승인" value={item.amount}
                          onChange={e => updateProcessed(i, 'amount', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-0.5 block">메모</label>
                        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                          placeholder="특이사항" value={item.memo}
                          onChange={e => updateProcessed(i, 'memo', e.target.value)} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => item.company.trim() && updateProcessed(i, '_locked', true)}
                        disabled={!item.company.trim()}
                        className="text-xs bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
                        ✓ 확정
                      </button>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        {/* 특이사항 & 내일 예정 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-800 block mb-2">⚠️ 특이사항</label>
            <textarea
              value={data.special_notes}
              onChange={e => setData(p => ({ ...p, special_notes: e.target.value }))}
              rows={3} placeholder="오늘 발생한 특이사항, 이슈, 대표님께 알릴 사항 등을 입력하세요"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50 resize-none" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-800 block mb-2">📅 내일 예정 업무</label>
            <textarea
              value={data.tomorrow_plan}
              onChange={e => setData(p => ({ ...p, tomorrow_plan: e.target.value }))}
              rows={3} placeholder="내일 처리 예정인 업체, 기관 방문 일정, 서류 준비 등을 입력하세요"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50 resize-none" />
          </div>
        </div>

        <button type="submit" disabled={submitting}
          className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
          {submitting ? '전송 중...' : editDate ? '✏️ 업무보고 수정 전송 →' : '📋 업무보고 전송 →'}
        </button>
      </form>

      {/* 과거 보고 목록 */}
      {opsReports.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">지난 업무보고 누적</h3>
            <span className="text-xs text-gray-400">{opsReports.length}건</span>
          </div>
          <div className="divide-y divide-gray-50">
            {opsReports.slice(0, 50).map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <span className="text-sm font-medium text-gray-800">{r.report_date}</span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    처리 {r.data?.processed?.length || 0}건
                    {r.data?.processed?.filter((p: any) => p.action === '승인').length > 0 && (
                      <span className="text-emerald-500 font-semibold ml-2">승인 {r.data.processed.filter((p: any) => p.action === '승인').length}건</span>
                    )}
                    {r.data?.processed?.filter((p: any) => p.action === '입금완료').length > 0 && (
                      <span className="text-teal-500 font-semibold ml-2">입금 {r.data.processed.filter((p: any) => p.action === '입금완료').length}건</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 ml-2">
                  <button onClick={() => setViewReport(r)} className="text-xs text-blue-500 hover:text-blue-700">상세보기</button>
                  <button onClick={() => loadForEdit(r)} className="text-xs text-amber-500 hover:text-amber-700 font-medium">수정하기</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 상세보기 모달 */}
      {viewReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="font-bold text-gray-900">📋 관리팀 업무보고</h3>
                <p className="text-xs text-gray-400 mt-0.5">{viewReport.report_date} · {userName}</p>
              </div>
              <button onClick={() => setViewReport(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {(viewReport.data?.processed || []).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">처리 업체 현황</p>
                  <div className="space-y-2">
                    {(viewReport.data.processed as OpsProcessedEntry[]).map((item, i) => {
                      const actionInfo = ACTION_TYPES.find(a => a.value === item.action)
                      return (
                        <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800 text-sm">{item.company}</span>
                            {item.action && actionInfo && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold text-white ${actionInfo.color}`}>{item.action}</span>
                            )}
                            {item.institution && <span className="text-[10px] text-gray-500">🏦 {item.institution}</span>}
                            {item.amount && <span className="text-[10px] text-emerald-600 font-semibold">{item.amount}</span>}
                          </div>
                          {item.memo && <p className="text-xs text-gray-500 mt-1">{item.memo}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {viewReport.data?.special_notes && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">특이사항</p>
                  <p className="text-sm text-gray-700 bg-amber-50 rounded-xl p-3 border border-amber-100">{viewReport.data.special_notes}</p>
                </div>
              )}
              {viewReport.data?.tomorrow_plan && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">내일 예정</p>
                  <p className="text-sm text-gray-700 bg-blue-50 rounded-xl p-3 border border-blue-100">{viewReport.data.tomorrow_plan}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// Main OpsDashboard
// ──────────────────────────────────────────────────────────────────────
export default function OpsDashboard({ userId, userName }: Props) {
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role || 'ops'
  const [activeTab, setActiveTab] = useState<OpsTab>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [cases, setCases] = useState<OpsCase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([])
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installable, setInstallable] = useState(false)
  const [notices, setNotices] = useState<any[]>([])
  // ── 메모장 ──────────────────────────────────────────────
  const [notepadOpen, setNotepadOpen] = useState(false)
  const [notepadOpacity, setNotepadOpacity] = useState(90)
  const [notepadSize, setNotepadSize] = useState({ w: 300, h: 480 })
  const [notepadInput, setNotepadInput] = useState('')
  const [addPeriod, setAddPeriod] = useState<'today' | 'week' | 'month'>('today')
  const [memoText, setMemoText] = useState(() => {
    if (typeof window !== 'undefined') { try { return localStorage.getItem('ops-notepad-memo') || '' } catch { return '' } }
    return ''
  })
  const notepadResizeRef = useRef({ active: false, startX: 0, startY: 0, startW: 0, startH: 0 })
  function onNotepadResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    notepadResizeRef.current = { active: true, startX: e.clientX, startY: e.clientY, startW: notepadSize.w, startH: notepadSize.h }
    function onMove(ev: MouseEvent) {
      if (!notepadResizeRef.current.active) return
      setNotepadSize({
        w: Math.max(240, Math.min(640, notepadResizeRef.current.startW + ev.clientX - notepadResizeRef.current.startX)),
        h: Math.max(300, Math.min(900, notepadResizeRef.current.startH + ev.clientY - notepadResizeRef.current.startY)),
      })
    }
    function onUp() {
      notepadResizeRef.current.active = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  const [todos, setTodos] = useState<{id: string; text: string; checked: boolean; period: 'today' | 'week' | 'month'}[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('ops-daily-todos') || '[]')
        return saved.map((t: any) => ({ ...t, period: t.period || 'today' }))
      } catch { return [] }
    }
    return []
  })
  function saveTodos(next: typeof todos) {
    setTodos(next)
    if (typeof window !== 'undefined') localStorage.setItem('ops-daily-todos', JSON.stringify(next))
  }
  function addTodo(text: string, period: 'today' | 'week' | 'month' = 'today') {
    if (!text.trim()) return
    saveTodos([...todos, { id: Date.now().toString(), text: text.trim(), checked: false, period }])
    setNotepadInput('')
  }
  function toggleTodo(id: string) { saveTodos(todos.map(t => t.id === id ? { ...t, checked: !t.checked } : t)) }
  function deleteTodo(id: string) { saveTodos(todos.filter(t => t.id !== id)) }

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); setInstallable(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') { setInstallable(false); setInstallPrompt(null) }
  }

  async function loadCases() {
    setLoading(true)
    const res = await fetch('/api/ops-cases')
    const data = await res.json()
    setCases(data.cases || [])
    setLoading(false)
  }

  useEffect(() => { loadCases() }, [])

  useEffect(() => {
    fetch('/api/notices?team=ops&_t=' + Date.now())
      .then(r => r.json())
      .then(d => {
        const all = (d.notices || [])
        setNotices(all.filter((n: any) => n.notice_type !== 'supply_config' && n.notice_type !== 'supply_count'))
      })
      .catch(() => {})
  }, [])

  function togglePanel(id: string) {
    setOpenPanelIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      const next = [...prev, id]
      return next.length > 2 ? next.slice(1) : next
    })
  }

  const handleSave = useCallback((id: string, patch: Record<string, any>) => {
    setCases(prev => prev.map(c => {
      if (c.id !== id) return c
      const mergedDetails = patch.details ? { ...(c.details || {}), ...patch.details } : c.details
      const mergedTimeline = patch.timeline !== undefined ? patch.timeline : c.timeline
      return { ...c, ...patch, details: mergedDetails, timeline: mergedTimeline }
    }))
    if (autoSaveTimers.current[id]) clearTimeout(autoSaveTimers.current[id])
    autoSaveTimers.current[id] = setTimeout(async () => {
      await fetch(`/api/ops-cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    }, 1500)
  }, [])

  const q = searchQuery.trim().toLowerCase()
  const filteredCases = q.length >= 1
    ? cases.filter(c =>
        (c.customers?.details?.company || '').toLowerCase().includes(q) ||
        (c.customers?.name || '').toLowerCase().includes(q) ||
        (c.customers?.phone || '').replace(/-/g, '').includes(q.replace(/-/g, '')) ||
        (c.institution || '').toLowerCase().includes(q)
      )
    : cases

  const newdbCases     = filteredCases.filter(c => NEWDB_STAGE_KEYS.has(c.progress_stage))
  const activeCases    = filteredCases.filter(c =>
    !NEWDB_STAGE_KEYS.has(c.progress_stage) && (
      ACTIVE_STAGE_KEYS.has(c.progress_stage) ||
      (!REFUND_STAGE_KEYS.has(c.progress_stage) && !COMPLETED_STAGE_KEYS.has(c.progress_stage) && !c.is_refund && !c.is_completed)
    )
  )
  const refundCases    = filteredCases.filter(c => REFUND_STAGE_KEYS.has(c.progress_stage) || c.is_refund)
  const completedCases = filteredCases.filter(c => COMPLETED_STAGE_KEYS.has(c.progress_stage) || c.is_completed)

  const tabCounts: Record<OpsTab, number | null> = {
    dashboard:    null,
    active:       activeCases.length,
    refund:       refundCases.length,
    completed:    completedCases.length,
    newdb:        newdbCases.length,
    ops_contract: null,
    report:       null,
    profile:      null,
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      {/* Header */}
      <header className="bg-[#1B2A45] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="relative h-8 w-24 shrink-0 block">
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain object-left brightness-0 invert" unoptimized />
        </Link>
        <span className="text-white/60 text-xs font-medium hidden md:block">
          {opsTabs.find(t => t.key === activeTab)?.label ?? '관리팀 대시보드'}
        </span>
        <div className="flex items-center gap-2 relative">
          {/* 검색 — 항상 표시 */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="업체명·이름·기관..."
              className="bg-white/10 text-white placeholder-white/40 text-xs px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:bg-white/20 w-28 md:w-44"
            />
            {q.length >= 1 && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs">✕</button>
            )}
          </div>
          {/* 메모장 버튼 */}
          <button
            onClick={() => setNotepadOpen(v => !v)}
            className={`text-[11px] px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap ${notepadOpen ? 'bg-amber-400/80 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
            title="오늘 할일 메모장">
            📝
          </button>
          <button onClick={() => setActiveTab('dashboard')}
            className="text-white/50 hover:text-white text-[10px] px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap hidden md:block">
            🏠 홈
          </button>
          {/* 메뉴 */}
          <button onClick={() => setMenuOpen(!menuOpen)} aria-label="메뉴"
            className={`flex flex-col gap-[5px] p-2 rounded-lg transition-colors ${menuOpen ? 'bg-white/20' : 'hover:bg-white/10'}`}>
            <span className={`block w-5 h-0.5 bg-white/80 transition-all origin-center ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white/80 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white/80 transition-all origin-center ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-full right-0 mt-2 bg-white border border-[#E8E2D4] rounded-2xl shadow-2xl z-50 py-2 min-w-[200px]">
                <div className="px-4 py-3 border-b border-[#E8E2D4] mb-1">
                  <p className="text-[10px] text-[#C5A258] font-bold tracking-wide uppercase mb-0.5">관리팀</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#1B2A45]">{userName}</p>
                    <button onClick={() => signOut({ callbackUrl: '/login' })}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition-colors font-medium">로그아웃</button>
                  </div>
                  {installable && (
                    <button onClick={() => { handleInstall(); setMenuOpen(false) }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs border border-[#1B2A45]/20 hover:border-[#C5A258]/60 text-[#1B2A45]/60 hover:text-[#C5A258] font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      📲 앱 설치
                    </button>
                  )}
                </div>
                {opsTabs.map(tab => (
                  <button key={tab.key} onClick={() => { setActiveTab(tab.key); setMenuOpen(false) }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between gap-3 ${
                      activeTab === tab.key
                        ? 'text-[#C5A258] font-semibold bg-[#C5A258]/8'
                        : 'text-[#1B2A45]/65 hover:text-[#1B2A45] hover:bg-[#FAF8F3]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTab === tab.key ? 'bg-[#C5A258]' : 'bg-transparent'}`} />
                      {tab.label}
                    </div>
                    {tabCounts[tab.key] !== null && tabCounts[tab.key]! > 0 && (
                      <span className="text-[10px] bg-[#1B2A45]/10 text-[#1B2A45]/60 px-1.5 py-0.5 rounded-full font-bold">
                        {tabCounts[tab.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      {/* 콘텐츠 */}
      <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">

        {/* ── 대시보드 ── */}
        {activeTab === 'dashboard' && (
          loading ? (
            <div className="text-center py-16 text-[#1B2A45]/40 text-sm">불러오는 중...</div>
          ) : (
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[#1B2A45] text-base">📊 관리팀 대시보드</h2>
                <button onClick={loadCases}
                  className="text-xs bg-white border border-[#E8E2D4] text-[#1B2A45]/60 px-3 py-1.5 rounded-lg hover:border-[#1B2A45]/30 transition-colors">
                  🔄 새로고침
                </button>
              </div>
              <DashboardOverview cases={cases} />

              {/* 공지사항 */}
              {notices.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h3 className="text-sm font-bold text-gray-700">📢 공지사항</h3>
                  {notices.map(n => (
                    <div key={n.id} className="bg-white border border-[#E8E2D4] rounded-xl px-5 py-4">
                      <p className="font-semibold text-[#1B2A45] text-sm">{n.title}</p>
                      {n.content && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{n.content}</p>}
                      <p className="text-xs text-gray-300 mt-2">{new Date(n.created_at).toLocaleDateString('ko-KR')}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* 빠른 메뉴 */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                {[
                  { tab: 'active' as OpsTab, icon: '🔄', label: '진행중업체', count: activeCases.length, color: 'border-amber-200 hover:border-amber-400' },
                  { tab: 'refund' as OpsTab, icon: '💸', label: '환불업체', count: refundCases.length, color: 'border-rose-200 hover:border-rose-400' },
                  { tab: 'completed' as OpsTab, icon: '✅', label: '종료업체', count: completedCases.length, color: 'border-emerald-200 hover:border-emerald-400' },
                  { tab: 'ops_contract' as OpsTab, icon: '📝', label: '관리팀계약', count: null, color: 'border-violet-200 hover:border-violet-400' },
                  { tab: 'report' as OpsTab, icon: '📋', label: '관리팀보고', count: null, color: 'border-blue-200 hover:border-blue-400' },
                  { tab: 'profile' as OpsTab, icon: '👤', label: '사원정보', count: null, color: 'border-gray-200 hover:border-gray-400' },
                ].map(item => (
                  <button key={item.tab} onClick={() => setActiveTab(item.tab)}
                    className={`bg-white border rounded-xl p-4 text-left transition-colors ${item.color}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{item.icon}</span>
                      {item.count !== null && (
                        <span className="text-xl font-black text-[#1B2A45]">{item.count}</span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[#1B2A45] mt-2">{item.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {/* ── 진행중업체 ── */}
        {activeTab === 'active' && (
          <div className="max-w-6xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#1B2A45] text-base">🔄 진행중업체</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{activeCases.length}건</span>
                <button onClick={loadCases}
                  className="text-xs bg-white border border-[#E8E2D4] text-[#1B2A45]/60 px-3 py-1.5 rounded-lg hover:border-[#1B2A45]/30 transition-colors">
                  🔄 새로고침
                </button>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-16 text-[#1B2A45]/40 text-sm">불러오는 중...</div>
            ) : (
              <InstitutionGroupedView
                cases={activeCases}
                openPanelIds={openPanelIds}
                onToggle={togglePanel}
                onScriptToggle={(id, val) =>
                  handleSave(id, { details: { ...(cases.find(x => x.id === id)?.details || {}), script_sent: val } })
                }
              />
            )}
          </div>
        )}

        {/* ── 환불업체 ── */}
        {activeTab === 'refund' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#1B2A45] text-base">💸 환불업체</h2>
              <span className="text-xs text-gray-400">{refundCases.length}건</span>
            </div>
            {loading ? (
              <div className="text-center py-16 text-[#1B2A45]/40 text-sm">불러오는 중...</div>
            ) : refundCases.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E8E2D4] p-14 text-center text-[#1B2A45]/40 text-sm">환불 업체가 없습니다</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {refundCases.map(c => (
                  <CaseCard key={c.id} c={c} onToggle={togglePanel} isOpen={openPanelIds.includes(c.id)} cardType="refund" />
                ))}
              </div>
            )}
            {/* 상세 패널은 우측 슬라이딩 패널로만 표시 (#18) */}
          </div>
        )}

        {/* ── 종료업체 ── */}
        {activeTab === 'completed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#1B2A45] text-base">✅ 종료업체</h2>
              <span className="text-xs text-gray-400">{completedCases.length}건</span>
            </div>
            {loading ? (
              <div className="text-center py-16 text-[#1B2A45]/40 text-sm">불러오는 중...</div>
            ) : completedCases.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E8E2D4] p-14 text-center text-[#1B2A45]/40 text-sm">종료 업체가 없습니다</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {completedCases.map(c => (
                  <CaseCard key={c.id} c={c} onToggle={togglePanel} isOpen={openPanelIds.includes(c.id)} cardType="completed" />
                ))}
              </div>
            )}
            {/* 상세 패널은 우측 슬라이딩 패널로만 표시 (#18) */}
          </div>
        )}

        {/* ── 신규DB (뿌토) ── */}
        {activeTab === 'newdb' && (
          <OpsNewDbTab cases={newdbCases} userName={userName} onSave={handleSave} />
        )}

        {/* ── 관리팀계약 ── */}
        {activeTab === 'ops_contract' && (
          <OpsContractTab userName={userName} />
        )}

        {/* ── 관리팀보고 ── */}
        {activeTab === 'report' && (
          <OpsReportTab userId={userId} userName={userName} />
        )}

        {/* ── 사원정보 ── */}
        {activeTab === 'profile' && (
          <div className="max-w-xl mx-auto">
            <MyProfileTab />
          </div>
        )}
      </div>

      {/* ── 플로팅 메모장 ── */}
      {notepadOpen && (
        <div
          className="fixed top-14 right-4 z-[300] bg-amber-50 border border-amber-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none"
          style={{ width: notepadSize.w, height: notepadSize.h, opacity: notepadOpacity / 100 }}
        >
          <div className="flex items-center justify-between px-3 py-2 bg-amber-400 rounded-t-2xl shrink-0">
            <span className="text-[11px] font-bold text-white">📝 메모장</span>
            <button onClick={() => setNotepadOpen(false)} className="text-white/80 hover:text-white text-sm leading-none">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="px-2.5 pt-2 pb-2 border-b border-amber-200 shrink-0">
              <div className="flex gap-1 mb-1.5">
                {(['today', 'week', 'month'] as const).map(p => {
                  const lbl = { today: '오늘', week: '이번주', month: '이번달' }[p]
                  return (
                    <button key={p} type="button" onClick={() => setAddPeriod(p)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${addPeriod === p ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}>
                      {lbl}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-1">
                <input value={notepadInput} onChange={e => setNotepadInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTodo(notepadInput, addPeriod) }}
                  placeholder={`${addPeriod === 'today' ? '오늘' : addPeriod === 'week' ? '이번주' : '이번달'} 할일 추가...`}
                  className="flex-1 text-xs bg-white border border-amber-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400/50" />
                <button onClick={() => addTodo(notepadInput, addPeriod)}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded font-semibold">+</button>
              </div>
            </div>
            <div className="px-2.5 py-2 space-y-3 shrink-0">
              {(['today', 'week', 'month'] as const).map(p => {
                const sectionLabel = { today: '📅 오늘', week: '📆 이번주', month: '🗓 이번달' }[p]
                const items = todos.filter(t => t.period === p)
                return (
                  <div key={p}>
                    <p className="text-[9px] font-bold text-amber-600 mb-1">{sectionLabel}</p>
                    {items.length === 0 ? (
                      <p className="text-[10px] text-amber-200 italic pl-1">없음</p>
                    ) : (
                      <div className="space-y-0.5">
                        {items.map(t => (
                          <div key={t.id} className="flex items-center gap-1.5 group py-0.5">
                            <input type="checkbox" checked={t.checked} onChange={() => toggleTodo(t.id)}
                              className="w-3.5 h-3.5 accent-amber-500 cursor-pointer shrink-0" />
                            <span className={`text-xs flex-1 ${t.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.text}</span>
                            <button onClick={() => deleteTodo(t.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-[10px] transition-opacity shrink-0">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="border-t border-amber-200 px-2.5 pt-2 pb-3 flex flex-col flex-1" style={{ minHeight: 120 }}>
              <p className="text-[9px] font-bold text-amber-600 mb-1.5">✏️ 자유 메모</p>
              <textarea value={memoText}
                onChange={e => { setMemoText(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('ops-notepad-memo', e.target.value) }}
                placeholder="자유롭게 메모하세요..."
                className="flex-1 w-full text-xs bg-white border border-amber-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-amber-400/50 resize-none"
                style={{ minHeight: 80 }} />
            </div>
          </div>
          <div className="px-3 py-1.5 border-t border-amber-200 flex items-center gap-2 shrink-0">
            <span className="text-[9px] text-amber-600 font-semibold shrink-0">투명도</span>
            <input type="range" min={20} max={100} value={notepadOpacity}
              onChange={e => setNotepadOpacity(Number(e.target.value))}
              className="flex-1 h-1 accent-amber-400" />
            <span className="text-[9px] text-amber-600 font-semibold w-6 text-right">{notepadOpacity}%</span>
          </div>
          <div onMouseDown={onNotepadResizeStart}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10 flex items-end justify-end pb-0.5 pr-0.5" title="드래그하여 크기 조절">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 1L1 9M9 5L5 9M9 9" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      )}

      {/* ── 배경 오버레이 (패널 열릴 때) ── */}
      {openPanelIds.length > 0 && (
        <div
          className="fixed inset-0 bg-black/40 z-[99]"
          onClick={() => setOpenPanelIds([])}
        />
      )}

      {/* ── 우측 슬라이딩 패널 ── */}
      {openPanelIds.map((id, panelIndex) => {
        const c = cases.find(x => x.id === id)
        if (!c) return null
        const rightOffset = panelIndex === 0 ? 'right-0' : 'right-0 md:right-[530px]'
        return (
          <div key={id}
            className={`fixed top-0 bottom-0 ${rightOffset} w-full md:w-[520px] bg-white shadow-2xl overflow-y-auto z-[100]`}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between z-10">
              <div>
                <p className="font-bold text-[#1B2A45] text-sm">{c.customers?.details?.company || c.customers?.name}</p>
                <p className="text-[10px] text-gray-400">{c.customers?.name} · {c.customers?.phone}</p>
              </div>
              <button onClick={() => togglePanel(id)} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">✕</button>
            </div>
            <div className="p-4">
              <OpsDetailPanel c={c} onSave={handleSave} userRole={userRole} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
