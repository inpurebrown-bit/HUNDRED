'use client'

import { useState, useEffect, useRef, useCallback, FormEvent, ReactNode } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import MyProfileTab from '@/components/MyProfileTab'
import PullToRefresh from '@/components/ui/PullToRefresh'
import SplitView from '@/components/shared/SplitView'
import { contractWeight } from '@/lib/supplyRules'
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
/** 전화번호 하이픈 포맷: 01012345678 → 010-1234-5678 */
function formatPhone(v: string): string {
  if (!v) return ''
  const d = v.replace(/[^0-9]/g, '')
  if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`
  return v
}
/** 전화번호 입력 자동 하이픈: 타이핑 중에도 실시간 포맷 */
function autoHyphenPhone(v: string): string {
  const d = v.replace(/[^0-9]/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`
  return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`
}
/** 숫자에 콤마 포맷 */
function formatComma(v: string | number): string {
  const n = typeof v === 'number' ? v : parseInt(String(v).replace(/[^0-9]/g, ''), 10)
  if (isNaN(n) || n === 0) return ''
  return n.toLocaleString()
}
/** 콤마 제거 후 숫자 파싱 */
function parseComma(v: string): number {
  return parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0
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
    representative?: string
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

// 전체 진행단계 (간소화 — 상세 단계는 직접/간접자금 내부에서 관리)
const OVERALL_STAGES = [
  { key: '서류받는중', label: '서류받는중', color: 'bg-gray-500'    },
  { key: '진행중',     label: '진행중',     color: 'bg-blue-500'    },
  { key: '홀딩',       label: '홀딩',       color: 'bg-slate-400'   },
  { key: 'absorbed',   label: '흡수완료',   color: 'bg-emerald-500' },
  { key: 'completed',  label: '완료',       color: 'bg-emerald-700' },
]

const STAGE_COLOR: Record<string, string> = Object.fromEntries(
  [...PIPELINE_STAGES, ...OVERALL_STAGES].map(s => [s.key, s.color])
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

// 계약일로부터 12개월 초과 여부 판정 (종료/환불 제외한 활성 케이스에 적용)
function isContractExpired(c: any): boolean {
  const contractDate = c.customers?.details?.contract_date || c.details?.contract_date || c.details?.puto_contract_date
  if (!contractDate) return false
  const expiry = new Date(contractDate)
  expiry.setFullYear(expiry.getFullYear() + 1)
  return expiry < new Date()
}

// ── 기관 목록 ──────────────────────────────────────────────────────────
const INST_DIRECT   = ['중진공','소진공(혁신)','소진공(신취)','소진공(재도전)','소진공(일시적경영애로)','서민금융(미소)']
const INST_INDIRECT = ['기보','신보','재단']
const INDIRECT_SET  = new Set(INST_INDIRECT)
const ALL_INST_ORDER = [...INST_DIRECT, ...INST_INDIRECT]

// ── 기관명 축약 ────────────────────────────────────────────
function abbrevInst(inst: string): string {
  const MAP: Record<string, string> = {
    '중진공':        '중진공',
    '소진공(혁신)':         '소(혁신)',
    '소진공(신취)':         '소(신취)',
    '소진공(재도전)':       '소(재도전)',
    '소진공(일시적경영애로)':'소(일시)',
    '서민금융(미소)':'서(미소)',
    '기보':          '기보',
    '신보':          '신보',
    '재단':          '재단',
  }
  return MAP[inst] || inst
}

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

// ── 혁신성장촉진자금 드롭다운 ──────────────────────────────────────────
const INNOVATION_GROUPS = [
  { group: '혁신형', color: 'bg-violet-100 text-violet-800 border-violet-300', options: ['매출신장', '수출', '직접대출 성실상환'] },
  { group: '일반형', color: 'bg-sky-100 text-sky-800 border-sky-300', options: ['3D', 'AI', '키오스크', '디지털오더', '무인판매기', '로봇', '디지털메뉴', '전자칠판', '고객관리S/W', '매출관리S/W', '재고관리S/W', '통합관리시스템', '온라인예약관리', '육가공공정시스템'] },
]
function InnovationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = value ? value.split(',').map(v => v.trim()).filter(Boolean) : []
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])
  function toggle(opt: string) { const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]; onChange(next.join(', ')) }
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full text-left bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs min-h-[28px] flex flex-wrap gap-1 items-center">
        {selected.length > 0 ? selected.map(s => <span key={s} className="bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">{s}</span>)
          : <span className="text-gray-300 text-[10px]">클릭하여 선택</span>}
        <span className="ml-auto text-gray-300 text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 w-72">
          {INNOVATION_GROUPS.map(({ group, color, options }) => (
            <div key={group} className="mb-3 last:mb-0">
              <p className="text-[10px] font-bold text-gray-500 mb-1.5">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {options.map(opt => (
                  <button key={opt} type="button" onClick={() => toggle(opt)}
                    className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors ${selected.includes(opt) ? color : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>{opt}</button>
                ))}
              </div>
            </div>
          ))}
          {selected.length > 0 && <button type="button" onClick={() => onChange('')} className="mt-2 text-[10px] text-red-400 hover:text-red-600 w-full text-right">전체 해제</button>}
        </div>
      )}
    </div>
  )
}

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
type OpsTab = 'dashboard' | 'active' | 'expired' | 'refund' | 'completed' | 'newdb' | 'ops_contract' | 'report' | 'revenue' | 'profile'

const opsTabs: { key: OpsTab; label: string }[] = [
  { key: 'dashboard',    label: '대시보드' },
  { key: 'active',       label: '진행중업체' },
  { key: 'expired',      label: '계약기간만료' },
  { key: 'refund',       label: '환불업체' },
  { key: 'completed',    label: '종료업체' },
  { key: 'newdb',        label: '신규DB' },
  { key: 'ops_contract', label: '관리팀계약' },
  { key: 'report',       label: '관리팀보고' },
  { key: 'revenue',      label: '매출 현황' },
  { key: 'profile',      label: '사원정보' },
]

// ── Detail Tab Types: 진행현황 우선, 타임라인 진행현황 하단에 통합 ──────────
const DETAIL_TABS = ['진행현황', '인콜일지', '기관ID/PW', '입금/계약'] as const
type DetailTab = typeof DETAIL_TABS[number]

// ──────────────────────────────────────────────────────────────────────
// TimelineSection
// ──────────────────────────────────────────────────────────────────────
function TimelineSection({ initialTimeline, onSchedule, userName }: {
  initialTimeline: any[]
  onSchedule: (patch: Record<string, any>) => void
  userName?: string
}) {
  const [tl, setTl] = useState<any[]>(initialTimeline || [])
  const [text, setText] = useState('')

  function add() {
    if (!text.trim()) return
    const entry = { user: userName || '자금팀', content: text.trim(), created_at: nowKST() }
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
            const realIdx = tl.length - 1 - i
            const isSales = entry.source === 'sales'
            const isAuto  = entry.user === '자동기록'
            const kst = formatKST(entry.created_at || entry.date || '')
            const user = entry.user || entry.author || ''
            const content = entry.content || entry.text || ''
            const bg      = isSales ? 'bg-violet-50'   : isAuto ? 'bg-violet-50/60' : 'bg-gray-50'
            const avatarBg = isSales ? 'bg-violet-400'  : isAuto ? 'bg-violet-300'   : 'bg-[#1B2A45]'
            const nameColor = isSales ? 'text-violet-600' : isAuto ? 'text-violet-400' : 'text-[#1B2A45]'
            const avatarLabel = isSales ? '영' : (user ? user.slice(-2) : '관')
            return (
              <div key={i} className={`flex gap-2 items-start rounded-lg px-2 py-1.5 ${bg} group`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarBg}`}>
                  {avatarLabel}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold ${nameColor}`}>{user || '—'}</span>
                    {isSales && <span className="text-[9px] bg-violet-100 text-violet-600 px-1 py-0.5 rounded font-bold">영업팀</span>}
                    <span className="text-[10px] text-gray-300">{kst.date} {kst.time}</span>
                  </div>
                  <p className="text-xs text-gray-700 mt-0.5">{content}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const updated = tl.filter((_: any, idx: number) => idx !== realIdx)
                    setTl(updated)
                    onSchedule({ timeline: updated })
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-xs shrink-0 px-1 py-0.5 rounded hover:bg-red-50"
                  title="삭제"
                >✕</button>
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
export function OpsDetailPanel({ c, onSave, userRole, userName }: { c: OpsCase; onSave: (id: string, patch: Record<string, any>) => void; userRole?: string; userName?: string }) {
  const [local, setLocal] = useState<OpsCase>({ ...c })
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('진행현황')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // pwVisible 제거됨 — 기관ID/PW 필드는 항상 평문 표시
  const [salesLogOpen, setSalesLogOpen] = useState(false)
  // 인콜일지 수정모드
  const [incallEditing, setIncallEditing] = useState(false)
  // 1차 입금 저장 상태
  const [feeSaving, setFeeSaving] = useState(false)
  const [feeSaved,  setFeeSaved]  = useState(false)

  useEffect(() => {
    const next = { ...c }
    // 영업팀 인계 정보 자동 주입
    // sci: ops_cases.details.sales_customer_info
    // cd : customers 테이블 live 데이터 (normalize() 에서 병합된 mergedDetails)
    const sci = (c.details as any)?.sales_customer_info
    const cd  = (c as any).customers?.details || {}
    const d   = { ...(c.details || {}) } as Record<string, any>

    function fill(key: string, ...srcs: (string | undefined)[]) {
      if (d[key]) return   // 이미 ops가 입력한 값이 있으면 덮어쓰지 않음
      for (const src of srcs) {
        if (src) { d[key] = src; return }
      }
    }

    fill('contract_amount_vat', sci?.contract_fee,    cd.contract_fee)
    fill('deposit_amount_vat',  sci?.payment_amount,  cd.payment_amount)
    fill('unpaid_amount',       sci?.unpaid_amount,   cd.unpaid_amount)
    fill('commission_rate',     sci?.commission_rate, cd.commission_rate)
    // 세금계산서: 영업팀 계약 시 vat_included 여부로 자동 설정 (발급/미발급)
    const vatIncluded = sci?.vat_included ?? cd.vat_included
    const taxInvoiceFallback = vatIncluded === true ? '발급' : vatIncluded === false ? '미발급' : undefined
    fill('tax_invoice', sci?.tax_invoice, cd.tax_invoice, taxInvoiceFallback)

    next.details = d
    setLocal(next)
  }, [c.id])

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
  // 즉시 저장 (배지 등 상위 컴포넌트 상태도 즉시 반영, 기존 schedule 타이머 취소)
  function immediateDetailFields(patch: Record<string, any>) {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    const merged = { ...(local.details || {}), ...patch }
    setLocal(prev => ({ ...prev, details: merged }))
    onSave(c.id, { details: merged })
  }
  // 여러 detail 필드를 한 번에 업데이트 (두 번 호출 시 덮어씌움 방지)
  function detailFields(patch: Record<string, any>) {
    const merged = { ...(local.details || {}), ...patch }
    setLocal(prev => ({ ...prev, details: merged }))
    schedule({ details: merged })
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

  async function handleRefundComplete() {
    const company    = d.company || c.customers?.details?.company || c.customers?.name || '—'
    const feeAmt     = parseFloat(String(d.fee_amount || '0').replace(/[^0-9.]/g, '')) || 0
    const fmtFee     = feeAmt > 0 ? feeAmt.toLocaleString('ko-KR') + '원' : '—'
    const kstNow     = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
    const kstMonth   = kstNow.slice(0, 7)
    const salesUser  = d.sales_user_name || c.customers?.details?.sales_user_name || ''
    // 원계약 가중치: 착수금 기준
    const payAmt     = parseFloat(String(c.customers?.details?.payment_amount || d.payment_amount || '0').replace(/[^0-9.]/g, ''))
    const vatInc     = c.customers?.details?.vat_included
    const contractW  = contractWeight(payAmt, vatInc)  // 계약 당시 가중치
    const contractMonth = (c.customers?.details?.contract_date || c.created_at || '').slice(0, 7)
    const isSameMonth = contractMonth === kstMonth

    const ok = window.confirm(
      `[환불완료 처리]\n\n업체: ${company}\n수수료 환수금액: ${fmtFee}\n계약 차감 가중치: -${contractW}개\n원계약 월: ${contractMonth || '미상'}\n\n환불완료 처리하시겠습니까?`
    )
    if (!ok) return

    const opsUser = c.ops_user_name || userName || ''

    const patch = {
      progress_stage: 'refunded',
      details: {
        ...(local.details || {}),
        refund_completed: true,
        refund_completed_at: kstMonth,
        refund_deduction_count: contractW,
        refund_deduction_amount: feeAmt,
        refund_ops_user: opsUser,
        refund_sales_user: salesUser,
        refund_contract_month: contractMonth,
        refund_is_same_month: isSameMonth,
      },
    }

    try {
      const res = await fetch(`/api/ops-cases/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) { alert('저장 실패'); return }

      // customers status: contracted → active+sub_status:refunded (집계 제외)
      // 전월 계약 건은 추가로 refund_deduction_month 기록 → PayrollTab이 이번달 차감에 사용
      if (c.customer_id) {
        const customerPatch: Record<string, any> = { status: 'refunded' }
        if (!isSameMonth && salesUser && contractW > 0) {
          customerPatch.details = {
            refund_deduction_month: kstMonth,
            refund_deduction_weight: contractW,
            refund_deduction_sales: salesUser,
            refund_company: company,
          }
        }
        await fetch(`/api/customers/${c.customer_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerPatch),
        })
      }

      setLocal(prev => ({ ...prev, ...patch, details: patch.details }))
      onSave(c.id, patch)
    } catch {
      alert('네트워크 오류')
    }
  }

  async function handleFeeSave() {
    // 진행 중인 자동저장 타이머 취소 (race condition 방지)
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setFeeSaving(true)
    const nowIso = new Date().toISOString()
    const todayStr = nowIso.slice(0, 10)
    // c.details(서버 최신) 위에 local.details(로컬 편집) 병합
    // → stale한 local 초기값이 서버에 저장된 최신값(예: tax_invoice_completed)을 덮어씌우지 않도록
    const localDetails = local.details || {}
    const serverDetails = c.details || {}
    const baseDetails: Record<string, any> = { ...serverDetails }
    for (const [k, v] of Object.entries(localDetails)) {
      if (v !== null && v !== undefined) baseDetails[k] = v
    }
    // deposit_date가 없으면 오늘로 자동 세팅 (revenue API date fallback 보장)
    if (!baseDetails.deposit_date) baseDetails.deposit_date = todayStr
    if (baseDetails.tax_invoice_requested == null) baseDetails.tax_invoice_requested = false
    if (baseDetails.tax_invoice_issued == null) baseDetails.tax_invoice_issued = false
    const mergedDetails = { ...baseDetails, fee_locked: true }
    const next = { ...local, details: mergedDetails }
    setLocal(next)
    try {
      const res = await fetch(`/api/ops-cases/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details: mergedDetails }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[handleFeeSave] PATCH failed:', err)
        alert(`저장 실패: ${err?.error || res.status}`)
        return
      }
      onSave(c.id, { details: mergedDetails })
      setFeeSaved(true)
    } catch (e) {
      console.error('[handleFeeSave] network error:', e)
      alert('네트워크 오류로 저장에 실패했습니다.')
    } finally {
      setFeeSaving(false)
    }
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
  // 1차 입금 잠금: fee_locked=true 이면 읽기전용 (CEO도 동일, 단 CEO는 잠금해제 버튼 표시)
  const feeLocked = !!d.fee_locked

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
                <p className="font-bold text-white text-sm">영업팀 전달 기록</p>
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
                승인
              </button>
              <button onClick={handleCeoReject}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors">
                반려
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

          {/* ── 신규 배정 배너: 진행현황 탭 맨 위 ── */}
          {local.progress_stage === 'assigned' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-indigo-800">📋 신규 배정 업체</p>
                  <p className="text-xs text-indigo-600 mt-0.5">고객과 첫 통화 후 흡수 처리해주세요</p>
                  {d.first_call_done && d.first_call_at && (
                    <p className="text-[10px] text-emerald-600 mt-1.5 font-semibold">
                      📞 첫 통화: {new Date(d.first_call_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 items-end shrink-0">
                  <button type="button"
                    onClick={() => {
                      const isNowDone = !d.first_call_done
                      const newDetails = {
                        ...(local.details || {}),
                        first_call_done: isNowDone,
                        ...(isNowDone ? { first_call_at: new Date().toISOString() } : {}),
                      }
                      setLocal({ ...local, details: newDetails })
                      schedule({ details: newDetails })
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                      d.first_call_done
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                        : 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50'
                    }`}>
                    📞 첫 통화 완료{d.first_call_done ? ' ✓' : ''}
                  </button>
                  <button type="button"
                    onClick={() => field('progress_stage', 'absorbed')}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-[11px] font-bold transition-colors shadow-sm">
                    ✅ 흡수완료
                  </button>
                </div>
              </div>
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
                  전달화면
                </button>
              )}
              {/* 컨설팅 자료 전송 */}
              {!['종료','완료','환불','refunded','completed'].includes(local.progress_stage) && (
                <button type="button"
                  onClick={() => detailField('consulting_sent', !d.consulting_sent)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap shadow-sm border ${
                    d.consulting_sent
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                  }`}>
                  {d.consulting_sent ? '📋 자료전송 ✓' : '📋 컨설팅 자료전송'}
                </button>
              )}
              {/* 흡수완료 버튼 or 완료 표시 */}
              {['absorbed','completed'].includes(local.progress_stage) ? (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-bold whitespace-nowrap shadow-sm">
                  ✅ 흡수완료 ✓
                </span>
              ) : !['종료','완료','환불','refunded'].includes(local.progress_stage) ? (
                <button type="button"
                  onClick={() => field('progress_stage', 'absorbed')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold transition-colors whitespace-nowrap shadow-sm">
                  흡수 전
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
              <div>
                <label className={lbl}>전체 진행 단계</label>
                <select value={local.progress_stage} onChange={e => handleStageChange(e.target.value)} className={inp}>
                  {[
                    ...OVERALL_STAGES,
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

            {/* ── 환불완료 버튼 (환불 단계일 때만 표시) ── */}
            {local.progress_stage === '환불' && !d.refund_completed && (
              <div className="mt-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                <p className="text-xs font-bold text-rose-700 mb-1">환불 처리</p>
                <p className="text-[11px] text-rose-600 mb-2">
                  수수료 환수금: <b>{d.fee_amount ? Number(d.fee_amount).toLocaleString('ko-KR') + '원' : '—'}</b>
                  {d.fee_amount ? ` (공제 ${contractWeight(parseFloat(String(d.fee_amount)), false)}개)` : ''}
                </p>
                <button type="button"
                  onClick={handleRefundComplete}
                  className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors">
                  환불완료 처리
                </button>
              </div>
            )}
            {d.refund_completed && (
              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
                <span className="text-[11px] font-bold text-gray-500">환불완료 {d.refund_completed_at && `(${d.refund_completed_at})`}</span>
                {d.refund_deduction_amount > 0 && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    환수금 {Number(d.refund_deduction_amount).toLocaleString('ko-KR')}원 · 공제 {d.refund_deduction_count}개
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── 핸들링 섹션 ── */}
          <div className="border border-gray-200 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">핸들링</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'handling_no_contact',  label: '연락 안됨',      on: 'bg-red-500 text-white border-red-500',    off: 'bg-white text-gray-500 border-gray-300 hover:bg-red-50' },
                { key: 'handling_no_fit',      label: '들어갈 곳 없음', on: 'bg-orange-500 text-white border-orange-500', off: 'bg-white text-gray-500 border-gray-300 hover:bg-orange-50' },
                { key: 'handling_mindless',    label: '무지성 핸들링',  on: 'bg-slate-500 text-white border-slate-500',  off: 'bg-white text-gray-500 border-gray-300 hover:bg-slate-50' },
              ].map(({ key, label, on, off }) => {
                const active = !!(d as any)[key]
                return (
                  <button key={key} type="button"
                    onClick={() => detailField(key, active ? '' : '1')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${active ? on : off}`}>
                    {label}
                  </button>
                )
              })}
              {/* 홀딩 버튼 */}
              <button type="button"
                onClick={() => detailField('is_holding', !(d as any).is_holding)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  (d as any).is_holding
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50'
                }`}>
                홀딩{(d as any).is_holding ? ' (해제)' : ''}
              </button>
            </div>
            {((d as any).handling_no_contact || (d as any).handling_no_fit || (d as any).handling_mindless) && (
              <div className="mt-2">
                <input type="text" value={d.handling_memo || ''} onChange={e => detailField('handling_memo', e.target.value)}
                  placeholder="핸들링 메모 (선택)"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-300" />
              </div>
            )}
          </div>

          {/* ── 직접자금 섹션 (항상 표시) ── */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-blue-700">직접자금</span>
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
                <label className={lbl}>기관방문 날짜/시간</label>
                <div className="flex gap-1">
                  <input type="date" value={d.direct_visit_date || ''} onChange={e => {
                    if (e.target.value) handleDirectVisitDate(e.target.value)
                    else detailField('direct_visit_date', '')
                  }} className={inp + ' flex-1'} />
                  <input type="time" value={d.direct_visit_time || ''} onChange={e => detailField('direct_visit_time', e.target.value)} className={inp + ' w-20'} />
                </div>
                {d.direct_visit_date && <p className="text-[10px] text-emerald-600 mt-0.5">캘린더 자동 등록</p>}
              </div>
              <div>
                <label className={lbl}>실사일정 날짜/시간</label>
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
              <span className="text-[11px] font-bold text-violet-700">간접자금</span>
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
                <label className={lbl}>기관방문 날짜/시간</label>
                <div className="flex gap-1">
                  <input type="date" value={d.indirect_visit_date || ''} onChange={e => {
                    if (e.target.value) handleIndirectVisitDate(e.target.value)
                    else detailField('indirect_visit_date', '')
                  }} className={inp + ' flex-1'} />
                  <input type="time" value={d.indirect_visit_time || ''} onChange={e => detailField('indirect_visit_time', e.target.value)} className={inp + ' w-20'} />
                </div>
                {d.indirect_visit_date && <p className="text-[10px] text-emerald-600 mt-0.5">캘린더 자동 등록</p>}
              </div>
              <div>
                <label className={lbl}>실사일정 날짜/시간</label>
                <div className="flex gap-1">
                  <input type="date" value={d.indirect_inspection_date || ''} onChange={e => detailField('indirect_inspection_date', e.target.value)} className={inp + ' flex-1'} />
                  <input type="time" value={d.indirect_inspection_time || ''} onChange={e => detailField('indirect_inspection_time', e.target.value)} className={inp + ' w-20'} />
                </div>
              </div>
            </div>
          </div>

          {/* ── 확인서 섹션 ── */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-amber-700 shrink-0">소진공 확인서</span>
              <div className="h-px bg-amber-200 flex-1 min-w-[8px]" />
              {[
                { key: 'cert_general',   label: '일반경영안정' },
                { key: 'cert_emergency', label: '긴급경영안정' },
                { key: 'cert_youth',     label: '청년' },
                { key: 'cert_disabled',  label: '장애인' },
                { key: 'cert_refinance', label: '대환대출' },
              ].map(({ key, label }) => {
                const on = !!(d as any)[key]
                return (
                  <label key={key} className="flex items-center gap-1 cursor-pointer shrink-0">
                    <input type="checkbox" checked={on} onChange={() => toggleDetail(key)} className="w-3 h-3 accent-amber-500" />
                    <span className={`text-[10px] ${on ? 'text-amber-800 font-bold' : 'text-gray-400'}`}>{label}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* 타임라인 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">타임라인</span>
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] text-gray-300">마지막 수정: {new Date(c.updated_at).toLocaleString('ko-KR')}</span>
            </div>
            <TimelineSection initialTimeline={local.timeline || []} onSchedule={schedule} userName={userRole === 'ceo' ? 'ceo' : userName} />
          </div>
        </div>
      )}

      {/* ── 기관ID/PW ── */}
      {activeDetailTab === '기관ID/PW' && (
        <div className="space-y-3">

          {/* 기본 식별 정보 */}
          <div className="bg-[#1B2A45]/5 border border-[#1B2A45]/15 rounded-lg p-3">
            <p className="text-[11px] font-bold text-[#1B2A45] mb-2">기본 식별 정보</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lbl}>사업자등록번호</label>
                <input type="text" autoComplete="off"
                  value={d.biz_reg_number || ''}
                  onChange={e => detailField('biz_reg_number', e.target.value)}
                  className={inp} placeholder="000-00-00000" />
              </div>
              <div>
                <label className={lbl}>법인등록번호</label>
                <input type="text" autoComplete="off"
                  value={d.corp_reg_number || ''}
                  onChange={e => detailField('corp_reg_number', e.target.value)}
                  className={inp} placeholder="000000-0000000" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>대표자 주민번호</label>
                <input type="text" autoComplete="off"
                  value={d.ceo_resident_number || ''}
                  onChange={e => detailField('ceo_resident_number', e.target.value)}
                  className={inp} placeholder="000000-0000000" />
              </div>
              <div>
                <label className={lbl}>통신사</label>
                <select
                  value={d.carrier || ''}
                  onChange={e => detailField('carrier', e.target.value)}
                  className={inp}>
                  <option value="">선택</option>
                  <option value="SKT">SKT</option>
                  <option value="KT">KT</option>
                  <option value="LGU+">LGU+</option>
                  <option value="SKT 알뜰폰">SKT 알뜰폰</option>
                  <option value="KT 알뜰폰">KT 알뜰폰</option>
                  <option value="LGU+ 알뜰폰">LGU+ 알뜰폰</option>
                </select>
              </div>
              <div>
                <label className={lbl}>휴대폰번호</label>
                <input type="text" autoComplete="off"
                  value={d.cert_phone || ''}
                  onChange={e => detailField('cert_phone', e.target.value)}
                  className={inp} placeholder="010-0000-0000" />
              </div>
            </div>
          </div>

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

          {/* 기타 아이디/비밀번호 */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-gray-600">기타 아이디/비밀번호</p>
              <button
                type="button"
                onClick={() => {
                  const extras: any[] = d.extra_creds || []
                  detailField('extra_creds', [...extras, { label: '', id: '', pw: '' }])
                }}
                className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-2 py-0.5 rounded font-medium transition-colors"
              >+ 추가</button>
            </div>
            {(!d.extra_creds || (d.extra_creds as any[]).length === 0) ? (
              <p className="text-[11px] text-gray-300 text-center py-1">+ 추가를 눌러 입력하세요 (네이버, 구글 등)</p>
            ) : (
              <div className="space-y-2">
                {(d.extra_creds as any[]).map((item: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-end">
                    <div>
                      {idx === 0 && <label className={lbl}>서비스명</label>}
                      <input type="text" autoComplete="off"
                        value={item.label || ''}
                        onChange={e => {
                          const next = [...(d.extra_creds as any[])]
                          next[idx] = { ...next[idx], label: e.target.value }
                          detailField('extra_creds', next)
                        }}
                        className={inp} placeholder="네이버, 구글..." />
                    </div>
                    <div>
                      {idx === 0 && <label className={lbl}>아이디</label>}
                      <input type="text" autoComplete="off"
                        value={item.id || ''}
                        onChange={e => {
                          const next = [...(d.extra_creds as any[])]
                          next[idx] = { ...next[idx], id: e.target.value }
                          detailField('extra_creds', next)
                        }}
                        className={inp} placeholder="아이디" />
                    </div>
                    <div>
                      {idx === 0 && <label className={lbl}>비밀번호</label>}
                      <input type="text" autoComplete="off"
                        value={item.pw || ''}
                        onChange={e => {
                          const next = [...(d.extra_creds as any[])]
                          next[idx] = { ...next[idx], pw: e.target.value }
                          detailField('extra_creds', next)
                        }}
                        className={inp} placeholder="비밀번호" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = (d.extra_creds as any[]).filter((_: any, i: number) => i !== idx)
                        detailField('extra_creds', next)
                      }}
                      className={idx === 0 ? 'text-red-300 hover:text-red-500 text-xs pb-0.5' : 'text-red-300 hover:text-red-500 text-xs'}
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
            const innovationVal = gv('innovation', cd.innovation || '')
            const sections = [
              {
                title: '기업 기본정보', bg: 'bg-[#1B2A45]', textColor: 'text-white',
                fields: [
                  [['업체명', 'company', gv('company', cd.company || local.customers?.company || local.customers?.name || '')], ['담당자', 'sales_user_name', gv('sales_user_name', cd.sales_user_name || '')]],
                  [['대표자', 'representative', gv('representative', local.customers?.name || '')], ['연락처', 'phone', gv('phone', formatPhone(local.customers?.phone || ''))]],
                  [['지역', 'region', gv('region', cd.region || '')], ['접수일', 'reception_date', gv('reception_date', cd.reception_date || (cd.created_at ? formatKST(cd.created_at).date : ''))]],
                  [['업종', 'business_type', gv('business_type', cd.business_type || '')], ['실제업무', 'real_work', gv('real_work', cd.real_work || '')]],
                  [['업력', 'years_in_business', gv('years_in_business', cd.years_in_business || cd.biz_size || '')], ['직원수', 'employee_count', gv('employee_count', cd.employee_count || '')]],
                  [['특허', 'patent', gv('patent', cd.patent || '')]],
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
                  [['26년매출', 'revenue_2026', gv('revenue_2026', cd.revenue_2026 || '')], ['25년매출', 'revenue_2025', gv('revenue_2025', cd.revenue_2025 || '')]],
                  [['24년매출', 'revenue_2024', gv('revenue_2024', cd.revenue_2024 || '')], ['23년매출', 'revenue_2023', gv('revenue_2023', cd.revenue_2023 || '')]],
                  [['필요자금', 'required_funds', gv('required_funds', cd.required_funds || '')], ['솔루션', 'solution', gv('solution', cd.solution || '')]],
                ],
              },
            ]

            return (
              <div>
                {/* ── 헤더: 수정 버튼 ── */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <span className="text-[11px] font-bold text-gray-600">인콜일지</span>
                  <button type="button" onClick={() => setIncallEditing(e => !e)}
                    className={`text-[10px] px-3 py-1 rounded-full font-bold transition-colors ${
                      incallEditing
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                    }`}>
                    {incallEditing ? '✓ 저장완료' : '수정'}
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
                                  value={k === 'phone' ? autoHyphenPhone(val) : val}
                                  onChange={e => incallField(k, k === 'phone' ? autoHyphenPhone(e.target.value) : e.target.value)}
                                  placeholder={k === 'phone' ? '010-0000-0000' : '—'}
                                  className="flex-1 text-xs font-semibold text-[#1B2A45] bg-transparent border-b border-violet-300 focus:outline-none focus:border-violet-500 px-0.5 py-0"
                                />
                              ) : (
                                <span className={`flex-1 text-xs font-semibold ${val ? 'text-[#1B2A45]' : 'text-gray-300'}`}>
                                  {k === 'phone' ? (val ? formatPhone(val) : '—') : (val || '—')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* ── 혁신성장촉진자금 ── */}
                <div className="mb-0">
                  <div className="bg-emerald-700 px-3 py-1.5">
                    <span className="text-[10px] font-bold text-white tracking-wide">혁신성장촉진자금</span>
                  </div>
                  <div className="px-3 py-2 hover:bg-gray-50 transition-colors">
                    <span className="text-[10px] text-gray-400 font-medium block mb-1">혁신요건</span>
                    {incallEditing ? (
                      <InnovationSelect value={innovationVal} onChange={v => incallField('innovation', v)} />
                    ) : (
                      innovationVal
                        ? <div className="flex flex-wrap gap-1">{innovationVal.split(',').map((s: string) => s.trim()).filter((s: string) => Boolean(s)).map((s: string) => (
                            <span key={s} className="bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">{s}</span>
                          ))}</div>
                        : <span className="text-xs font-semibold text-gray-300">—</span>
                    )}
                  </div>
                </div>

                {/* ── 일시적경영애로자금 ── */}
                {(() => {
                  const ILTMP_TYPES = ['일반자금', '청년고용자금', '재기자금', '긴급경영안정자금']
                  const iltmpVal: string = gv('iltmp_type', cd.iltmp_type || '')
                  return (
                    <div className="mb-0">
                      <div className="bg-orange-600 px-3 py-1.5">
                        <span className="text-[10px] font-bold text-white tracking-wide">일시적경영애로자금</span>
                      </div>
                      <div className="px-3 py-2 hover:bg-gray-50 transition-colors">
                        <span className="text-[10px] text-gray-400 font-medium block mb-1">자금 종류</span>
                        {incallEditing ? (
                          <div className="flex flex-wrap gap-1">
                            {ILTMP_TYPES.map(t => (
                              <button key={t} type="button"
                                onClick={() => incallField('iltmp_type', iltmpVal === t ? '' : t)}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                                  iltmpVal === t ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-500 border-gray-300 hover:bg-orange-50'
                                }`}>{t}</button>
                            ))}
                          </div>
                        ) : (
                          iltmpVal
                            ? <span className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">{iltmpVal}</span>
                            : <span className="text-xs font-semibold text-gray-300">—</span>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* ── 통화 메모 ── */}
                <div className="mb-0">
                  <div className="bg-gray-700 px-3 py-1.5">
                    <span className="text-[10px] font-bold text-white tracking-wide">통화 메모</span>
                  </div>
                  <div className="px-3 py-2">
                    {incallEditing ? (
                      <textarea
                        value={gv('notes', cd.notes || '')}
                        onChange={e => incallField('notes', e.target.value)}
                        placeholder="통화 내용 / 메모를 입력하세요…"
                        rows={3}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-y"
                      />
                    ) : (
                      <p className={`text-xs whitespace-pre-wrap ${gv('notes', cd.notes || '') ? 'text-gray-700' : 'text-gray-300'}`}>
                        {gv('notes', cd.notes || '') || '—'}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── 영업팀 통화메모 (읽기전용) ── */}
                {(() => {
                  const salesTL: any[] = local.customers?.call_timeline || []
                  if (salesTL.length === 0) return null
                  return (
                    <div className="border-t border-emerald-100">
                      <div className="bg-emerald-600 px-3 py-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-white tracking-wide">영업팀 통화메모</span>
                        <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded-full">{salesTL.length}건</span>
                      </div>
                      <div className="divide-y divide-emerald-50">
                        {[...salesTL].reverse().map((entry: any, i: number) => {
                          const kst = formatKST(entry.date || entry.created_at || '')
                          const author = entry.user || entry.author || entry.user_name || '영업팀'
                          const content = entry.content || entry.text || entry.memo || ''
                          const result = entry.call_result || entry.result || ''
                          const closing = entry.closing_result || ''
                          return (
                            <div key={i} className="px-3 py-2 hover:bg-emerald-50/50 transition-colors">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-[10px] font-bold text-emerald-700">{author}</span>
                                {result && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">{result}</span>}
                                {closing && <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{closing}</span>}
                                <span className="text-[10px] text-gray-300 ml-auto">{kst.date} {kst.time}</span>
                              </div>
                              {content && <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{content}</p>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

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
                        {subcallDate ? `${subcallDate}` : '—'}
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
      {activeDetailTab === '입금/계약' && (
        <div className="space-y-4">
          {/* 월정기권 안내 */}
          {d.contract_type === '월정기권' && (
            <div className="bg-purple-600 rounded-xl px-4 py-3 flex items-center gap-4">
              <div className="text-2xl">🟣</div>
              <div>
                <p className="text-white font-bold text-sm">월정기권 계약</p>
                <p className="text-purple-200 text-[11px] mt-0.5">월 10만원 × 12개월 = 120만원 선결제 · 수수료 없음</p>
              </div>
            </div>
          )}
          {/* 영업팀 계약 정보 (읽기 전용) */}
          {local.progress_memo && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-[10px] font-bold text-amber-700 mb-1.5">영업팀 계약 정보 (읽기전용)</p>
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
              <div className={`border rounded-xl p-3 ${feeLocked ? 'bg-gray-50 border-gray-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[10px] font-bold ${feeLocked ? 'text-gray-500' : 'text-emerald-700'}`}>
                    1차 입금 {feeLocked && <span className="ml-1 text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">저장됨 (대표만 수정)</span>}
                  </p>
                  {isCeo && d.fee_locked && (
                    <button type="button"
                      onClick={() => {
                        const mergedDetails = { ...(local.details || {}), fee_locked: false }
                        setLocal({ ...local, details: mergedDetails })
                        onSave(c.id, { details: mergedDetails })
                        setFeeSaved(false)
                      }}
                      className="text-[9px] bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-0.5 rounded font-bold transition-colors">
                      잠금 해제
                    </button>
                  )}
                </div>
                {feeLocked ? (
                  /* 잠금 상태 — 읽기 전용 표시 */
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                    {d.deposit_date && <div className="col-span-2"><span className="text-gray-400">날짜</span> <span className="font-medium text-gray-700">{d.deposit_date}</span></div>}
                    {d.deposit_institution && <div><span className="text-gray-400">기관명</span><br/><span className="font-medium text-gray-700">{d.deposit_institution}</span></div>}
                    {d.deposit_product    && <div><span className="text-gray-400">상품명</span><br/><span className="font-medium text-gray-700">{d.deposit_product}</span></div>}
                    {d.approval_amount && <div><span className="text-gray-400">승인금액</span><br/><span className="font-medium text-gray-700">{formatComma(d.approval_amount)}원</span></div>}
                    {d.fee_rate       && <div><span className="text-gray-400">수수료율</span><br/><span className="font-medium text-gray-700">{d.fee_rate}%</span></div>}
                    {d.fee_amount && (
                      <div className="col-span-2 mt-1 bg-white rounded-lg p-2 border border-gray-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-[10px]">매출액(공급가액)</span>
                          <span className="font-bold text-emerald-700 text-sm">{formatComma(d.fee_amount)}원</span>
                        </div>
                        {d.tax_invoice_requested && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-[10px]">부가세(10%)</span>
                            <span className="font-semibold text-orange-500 text-xs">{formatComma(Math.round(parseComma(String(d.fee_amount)) * 0.1))}원</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t border-gray-100 pt-1">
                          <span className="text-gray-500 text-[10px] font-bold">실제입금액</span>
                          <span className="font-black text-gray-700 text-sm">
                            {formatComma(d.tax_invoice_requested
                              ? Math.round(parseComma(String(d.fee_amount)) * 1.1)
                              : parseComma(String(d.fee_amount)))}원
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {d.tax_invoice_requested
                            ? <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-bold">계산서 희망</span>
                            : <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-bold">계산서 불필요</span>
                          }
                          {d.tax_invoice_requested && (
                            d.tax_invoice_issued
                              ? <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold">발급 완료</span>
                              : <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-bold">발급 대기</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 편집 상태 */
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                    <div className="col-span-2">
                      <label className={lbl}>입금 날짜</label>
                      <input type="date" value={d.deposit_date || ''} onChange={e => detailField('deposit_date', e.target.value)} className={inp} />
                    </div>
                    <div><label className={lbl}>기관명</label><input type="text" value={d.deposit_institution || ''} onChange={e => detailField('deposit_institution', e.target.value)} className={inp} placeholder="기관명" /></div>
                    <div><label className={lbl}>상품명</label><input type="text" value={d.deposit_product || ''} onChange={e => detailField('deposit_product', e.target.value)} className={inp} placeholder="상품명" /></div>
                    <div><label className={lbl}>승인금액</label><input type="text"
                      inputMode="numeric"
                      value={d.approval_amount ? formatComma(d.approval_amount) : ''}
                      onChange={e => {
                        const raw = parseComma(e.target.value)
                        const stored = raw > 0 ? String(raw) : ''
                        const rate = parseFloat(String(d.fee_rate || '0')) || 0
                        const newFee = raw > 0 && rate > 0 ? String(Math.round(raw * rate / 100)) : (d.fee_amount || '')
                        const next = { ...local, details: { ...(local.details || {}), approval_amount: stored, fee_amount: newFee } }
                        setLocal(next)
                        schedule({ details: { ...(local.details || {}), approval_amount: stored, fee_amount: newFee } })
                      }} className={inp} placeholder="0원" /></div>
                    <div><label className={lbl}>수수료%</label><input type="text"
                      inputMode="decimal"
                      value={d.fee_rate || ''}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9.]/g, '')
                        const rate = parseFloat(val) || 0
                        const amt = parseComma(String(d.approval_amount || '0'))
                        const newFee = amt > 0 && rate > 0 ? String(Math.round(amt * rate / 100)) : (d.fee_amount || '')
                        const next = { ...local, details: { ...(local.details || {}), fee_rate: val, fee_amount: newFee } }
                        setLocal(next)
                        schedule({ details: { ...(local.details || {}), fee_rate: val, fee_amount: newFee } })
                      }} className={inp} placeholder="%" /></div>
                    <div className="col-span-2">
                      <label className={lbl}>매출액 <span className="text-emerald-600 font-bold">(공급가액 · 자동산정)</span></label>
                      <div className="relative">
                        <input type="text" readOnly
                          value={d.fee_amount ? formatComma(d.fee_amount) : ''}
                          className="w-full border border-emerald-300 bg-emerald-50 rounded-lg px-3 py-2 text-xs font-bold text-emerald-700 cursor-default focus:outline-none" placeholder="승인금액 × 수수료% 자동계산" />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500 text-[10px] font-semibold">원</span>
                      </div>
                    </div>
                    {/* 세금계산서 */}
                    <div className="col-span-2 space-y-1.5">
                      <p className="text-[10px] text-gray-500 font-medium mb-1">세금계산서</p>
                      <div className="flex gap-1.5">
                        <button type="button"
                          onClick={() => detailField('tax_invoice_requested', true)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            d.tax_invoice_requested === true
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-white text-gray-500 border-gray-300 hover:border-amber-400 hover:text-amber-600'
                          }`}>
                          희망
                        </button>
                        <button type="button"
                          onClick={() => detailFields({ tax_invoice_requested: false, tax_invoice_issued: false })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                            d.tax_invoice_requested === false
                              ? 'bg-gray-500 text-white border-gray-500'
                              : 'bg-white text-gray-500 border-gray-300 hover:border-gray-500 hover:text-gray-700'
                          }`}>
                          미희망
                        </button>
                      </div>
                      {d.tax_invoice_requested === true && (
                        <label className="flex items-center gap-2 cursor-pointer select-none pl-1">
                          <input type="checkbox" checked={!!d.tax_invoice_issued}
                            onChange={e => detailField('tax_invoice_issued', e.target.checked)}
                            className="w-3.5 h-3.5 accent-emerald-500" />
                          <span className="text-xs font-semibold text-emerald-700">발급 완료</span>
                        </label>
                      )}
                    </div>
                    {/* 실제입금액 */}
                    <div className="col-span-2">
                      <label className={lbl}>실제입금액 <span className="text-gray-400 font-normal">{d.tax_invoice_requested ? '(매출액 + 부가세10%)' : '(부가세 없음)'}</span></label>
                      <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-xs font-bold text-gray-700 cursor-default">
                        {d.fee_amount
                          ? formatComma(d.tax_invoice_requested
                              ? Math.round(parseComma(String(d.fee_amount)) * 1.1)
                              : parseComma(String(d.fee_amount))) + '원'
                          : '—'}
                      </div>
                      {d.tax_invoice_requested && d.fee_amount && (
                        <div className="mt-1.5 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-[11px] text-gray-500 space-y-0.5">
                          <p className="font-semibold text-amber-700">부가세 내역</p>
                          <p>매출액(공급가액): {formatComma(parseComma(String(d.fee_amount)))}원</p>
                          <p>부가세(10%): {formatComma(Math.round(parseComma(String(d.fee_amount)) * 0.1))}원</p>
                          <p>실제입금액 합계: {formatComma(Math.round(parseComma(String(d.fee_amount)) * 1.1))}원</p>
                        </div>
                      )}
                    </div>
                    {/* 저장하기 버튼 */}
                    <div className="col-span-2 flex justify-end mt-1">
                      <button type="button"
                        onClick={handleFeeSave}
                        disabled={feeSaving || !d.fee_amount}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shadow-sm">
                        {feeSaving ? '저장 중…' : feeSaved ? '저장됨' : '저장하기'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* 추가 입금 블록들 */}
              {(d.payment_entries || []).map((entry: any, idx: number) => {
                const entryLocked = !!entry.fee_locked
                const entryInp = entryLocked
                  ? 'w-full border border-gray-200 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-500 cursor-not-allowed'
                  : inp

                async function saveEntry() {
                  if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
                  const todayStr2 = new Date().toISOString().slice(0, 10)
                  const entries: any[] = [...(d.payment_entries || [])]
                  // deposit_date 없으면 오늘로 세팅
                  if (!entries[idx].date) entries[idx] = { ...entries[idx], date: todayStr2 }
                  if (entries[idx].tax_invoice_requested == null) entries[idx].tax_invoice_requested = false
                  if (entries[idx].tax_invoice_issued == null) entries[idx].tax_invoice_issued = false
                  entries[idx] = { ...entries[idx], fee_locked: true }
                  const mergedDetails2 = { ...(local.details || {}), payment_entries: entries }
                  const next2 = { ...local, details: mergedDetails2 }
                  setLocal(next2)
                  try {
                    const res2 = await fetch(`/api/ops-cases/${c.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ details: mergedDetails2 }),
                    })
                    if (!res2.ok) {
                      const err2 = await res2.json().catch(() => ({}))
                      alert(`저장 실패: ${err2?.error || res2.status}`)
                      return
                    }
                    onSave(c.id, { details: mergedDetails2 })
                  } catch {
                    alert('네트워크 오류로 저장에 실패했습니다.')
                  }
                }

                async function unlockEntry() {
                  const entries: any[] = [...(d.payment_entries || [])]
                  entries[idx] = { ...entries[idx], fee_locked: false }
                  const mergedDetails2 = { ...(local.details || {}), payment_entries: entries }
                  setLocal({ ...local, details: mergedDetails2 })
                  await fetch(`/api/ops-cases/${c.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ details: mergedDetails2 }),
                  })
                  onSave(c.id, { details: mergedDetails2 })
                }

                return (
                <div key={entry.id || idx} className={`border rounded-xl p-3 ${entryLocked ? 'bg-blue-50/50 border-blue-200' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold text-blue-700">{idx + 2}차 입금</p>
                      {entryLocked && <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-bold">잠금</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {entryLocked && (isCeo) && (
                        <button type="button" onClick={unlockEntry}
                          className="text-[9px] text-orange-500 hover:text-orange-700 font-bold border border-orange-300 rounded px-1.5 py-0.5">
                          해제
                        </button>
                      )}
                      {!entryLocked && (
                        <button type="button"
                          onClick={() => {
                            const entries: any[] = d.payment_entries || []
                            detailField('payment_entries', entries.filter((_: any, i: number) => i !== idx))
                          }}
                          className="text-[10px] text-red-400 hover:text-red-600 font-bold">✕ 삭제</button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                    <div className="col-span-2">
                      <label className={lbl}>입금 날짜</label>
                      <input type="date" value={entry.date || ''} disabled={entryLocked} onChange={e => {
                        const entries: any[] = [...(d.payment_entries || [])]
                        entries[idx] = { ...entries[idx], date: e.target.value }
                        detailField('payment_entries', entries)
                      }} className={entryInp} />
                    </div>
                    <div><label className={lbl}>기관명</label><input type="text" value={entry.institution || ''} disabled={entryLocked} onChange={e => {
                      const entries: any[] = [...(d.payment_entries || [])]
                      entries[idx] = { ...entries[idx], institution: e.target.value }
                      detailField('payment_entries', entries)
                    }} className={entryInp} placeholder="기관명" /></div>
                    <div><label className={lbl}>상품명</label><input type="text" value={entry.product || ''} disabled={entryLocked} onChange={e => {
                      const entries: any[] = [...(d.payment_entries || [])]
                      entries[idx] = { ...entries[idx], product: e.target.value }
                      detailField('payment_entries', entries)
                    }} className={entryInp} placeholder="상품명" /></div>
                    <div><label className={lbl}>승인금액</label><input type="text" value={entry.approval_amount || ''} disabled={entryLocked} onChange={e => {
                      const entries: any[] = [...(d.payment_entries || [])]
                      const amt = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0
                      const rate = parseFloat(String(entries[idx].fee_rate || '0')) || 0
                      entries[idx] = { ...entries[idx], approval_amount: e.target.value, ...(amt > 0 && rate > 0 ? { fee_amount: String(Math.round(amt * rate / 100)) } : {}) }
                      detailField('payment_entries', entries)
                    }} className={entryInp} placeholder="0원" /></div>
                    <div><label className={lbl}>수수료%</label><input type="text" value={entry.fee_rate || ''} disabled={entryLocked} onChange={e => {
                      const entries: any[] = [...(d.payment_entries || [])]
                      const rate = parseFloat(e.target.value) || 0
                      const amt = parseInt(String(entries[idx].approval_amount || '0').replace(/[^0-9]/g, ''), 10) || 0
                      entries[idx] = { ...entries[idx], fee_rate: e.target.value, ...(amt > 0 && rate > 0 ? { fee_amount: String(Math.round(amt * rate / 100)) } : {}) }
                      detailField('payment_entries', entries)
                    }} className={entryInp} placeholder="%" /></div>
                    <div className="col-span-2">
                      <label className={lbl}>매출액 <span className="text-blue-600 font-bold">(공급가액)</span></label>
                      {entryLocked ? (
                        <div className="w-full border border-blue-300 bg-blue-50 rounded-lg px-3 py-2 text-xs font-bold text-blue-700 cursor-default">
                          {entry.fee_amount ? formatComma(entry.fee_amount) + '원' : '—'}
                        </div>
                      ) : (
                        <input type="text" value={entry.fee_amount || ''} onChange={e => {
                          const entries: any[] = [...(d.payment_entries || [])]
                          entries[idx] = { ...entries[idx], fee_amount: e.target.value }
                          detailField('payment_entries', entries)
                        }} className={inp} placeholder="0원" />
                      )}
                    </div>
                    {/* 세금계산서 */}
                    <div className="col-span-2 space-y-1.5">
                      {entryLocked ? (
                        /* 잠금 상태: 읽기전용 표시 */
                        <div className="flex items-center gap-1.5">
                          {entry.tax_invoice_requested
                            ? <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-bold">계산서 희망</span>
                            : <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-bold">계산서 불필요</span>
                          }
                          {entry.tax_invoice_requested && (
                            entry.tax_invoice_issued
                              ? <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold">발급 완료</span>
                              : <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-bold">발급 대기</span>
                          )}
                        </div>
                      ) : (
                        /* 편집 상태: 체크박스 */
                        <>
                          <p className="text-[10px] text-gray-500 font-medium mb-1">세금계산서</p>
                          <div className="flex gap-1.5">
                            <button type="button"
                              onClick={() => {
                                const entries: any[] = [...(d.payment_entries || [])]
                                entries[idx] = { ...entries[idx], tax_invoice_requested: true }
                                detailField('payment_entries', entries)
                              }}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                entry.tax_invoice_requested === true
                                  ? 'bg-amber-500 text-white border-amber-500'
                                  : 'bg-white text-gray-500 border-gray-300 hover:border-amber-400 hover:text-amber-600'
                              }`}>
                              희망
                            </button>
                            <button type="button"
                              onClick={() => {
                                const entries: any[] = [...(d.payment_entries || [])]
                                entries[idx] = { ...entries[idx], tax_invoice_requested: false, tax_invoice_issued: false }
                                detailField('payment_entries', entries)  // entries는 객체라 단일 호출로 OK
                              }}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                entry.tax_invoice_requested === false
                                  ? 'bg-gray-500 text-white border-gray-500'
                                  : 'bg-white text-gray-500 border-gray-300 hover:border-gray-500 hover:text-gray-700'
                              }`}>
                              미희망
                            </button>
                          </div>
                          {entry.tax_invoice_requested === true && (
                            <label className="flex items-center gap-2 cursor-pointer select-none pl-1 mt-1">
                              <input type="checkbox"
                                checked={!!entry.tax_invoice_issued}
                                onChange={e => {
                                  const entries: any[] = [...(d.payment_entries || [])]
                                  entries[idx] = { ...entries[idx], tax_invoice_issued: e.target.checked }
                                  detailField('payment_entries', entries)
                                }}
                                className="w-3.5 h-3.5 accent-emerald-500" />
                              <span className="text-xs font-semibold text-emerald-700">발급 완료</span>
                            </label>
                          )}
                        </>
                      )}
                    </div>
                    {/* 실제입금액 */}
                    {entry.fee_amount && (
                      <div className="col-span-2 bg-white rounded-lg p-2 border border-gray-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400 text-[10px]">매출액(공급가액)</span>
                          <span className="font-bold text-blue-700 text-sm">{formatComma(entry.fee_amount)}원</span>
                        </div>
                        {entry.tax_invoice_requested && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-[10px]">부가세(10%)</span>
                            <span className="font-semibold text-orange-500 text-xs">{formatComma(Math.round(parseComma(String(entry.fee_amount)) * 0.1))}원</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t border-gray-100 pt-1">
                          <span className="text-gray-500 text-[10px] font-bold">실제입금액</span>
                          <span className="font-black text-gray-700 text-sm">
                            {formatComma(entry.tax_invoice_requested
                              ? Math.round(parseComma(String(entry.fee_amount)) * 1.1)
                              : parseComma(String(entry.fee_amount)))}원
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* 저장하기 버튼 */}
                  {!entryLocked && (
                    <div className="mt-3 flex justify-end">
                      <button type="button" onClick={saveEntry}
                        disabled={!entry.fee_amount}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shadow-sm">
                        저장하기
                      </button>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          </div>

          {/* 착수금 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">착수금</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* 환불없이 계약 뱃지 (영업팀이 체크한 경우) */}
            {(local.customers?.details?.no_refund || d.no_refund) && (
              <div className="mb-2 inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <span className="text-red-500 text-sm"></span>
                <span className="text-xs font-bold text-red-700">환불없이 계약</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
              <div><label className={lbl}>계약금(VAT미포함)</label><input type="text" value={d.contract_amount_vat || ''} onChange={e => detailField('contract_amount_vat', e.target.value)} className={inp} placeholder="0원" /></div>
              <div><label className={lbl}>입금액(VAT포함)</label><input type="text" value={d.deposit_amount_vat || ''} onChange={e => detailField('deposit_amount_vat', e.target.value)} className={inp} placeholder="0원" /></div>
              <div><label className={lbl}>미입금액(VAT미포함)</label><input type="text" value={d.unpaid_amount || ''} onChange={e => detailField('unpaid_amount', e.target.value)} className={inp} placeholder="0원" /></div>
              <div><label className={lbl}>착수금 세금계산서 희망</label>
                <select value={d.tax_invoice || ''} onChange={e => immediateDetailFields({ tax_invoice: e.target.value })} className={inp}>
                  <option value="">— 미정 —</option>
                  <option value="희망">희망</option>
                  <option value="미희망">미희망</option>
                </select>
              </div>
              <div><label className={lbl}>착수금 세금계산서 발급 완료</label>
                <button
                  type="button"
                  onClick={() => immediateDetailFields({ tax_invoice_completed: !d.tax_invoice_completed })}
                  className={`w-full rounded-lg px-3 py-2 text-xs font-bold border transition-colors ${
                    d.tax_invoice_completed
                      ? 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white text-gray-500 border-gray-300 hover:border-emerald-400 hover:text-emerald-600'
                  }`}
                >
                  {d.tax_invoice_completed ? '🧾 발급 완료 ✓' : '🧾 발급 완료 처리'}
                </button>
              </div>
              <div><label className={lbl}>수수료율</label>
                <div className="relative">
                  <input type="text" value={d.commission_rate || ''} onChange={e => detailField('commission_rate', e.target.value)} className={inp + ' pr-5'} placeholder="%" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* 결제방식 */}
          <div>
            <label className={lbl}>결제방식</label>
            <div className="flex gap-2 mt-1">
              {[{ key: 'has_cash', label: '현금' }, { key: 'has_card', label: '카드' }].map(opt => (
                <button key={opt.key} type="button" onClick={() => {
                  const newVal = !local.details?.[opt.key]
                  if (opt.key === 'has_card' && newVal) {
                    immediateDetailFields({ has_card: true, tax_invoice: '희망', tax_invoice_completed: true })
                  } else {
                    toggleDetail(opt.key)
                  }
                }}
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
  const allStages     = [...PIPELINE_STAGES, ...OVERALL_STAGES]
  const overallStage  = allStages.find(s => s.key === c.progress_stage)
  const directStage   = c.details?.direct_stage   || ''
  const indirectStage = c.details?.indirect_stage  || ''
  const directInfo    = allStages.find(s => s.key === directStage)
  const indirectInfo  = allStages.find(s => s.key === indirectStage)
  const companyName   = c.customers?.details?.company || c.customers?.name || '—'
  const repName       = c.customers?.representative || c.customers?.details?.representative || ''
  const phone         = c.customers?.phone || ''
  const scriptSent    = c.details?.script_sent || false
  const opsUser       = c.ops_user_name || ''

  const allInstitutions = (c.institution || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const directInsts   = allInstitutions.filter(i => !INDIRECT_SET.has(i))
  const indirectInsts = allInstitutions.filter(i => INDIRECT_SET.has(i))

  // 경고 뱃지 (홀딩, 핸들링, 승인대기)
  const warningBadges = [
    c.details?.is_holding && '홀딩',
    c.progress_stage === '환불예정' && '환불예정',
    c.progress_stage === '종료예정' && '종료예정',
    c.details?.handling_no_contact && '연락안됨',
    c.details?.handling_no_fit     && '곳없음',
    c.details?.handling_mindless   && '무지성',
  ].filter(Boolean) as string[]

  const isAbsorbed = ['absorbed','completed','종료','완료','환불','refunded'].includes(c.progress_stage)
  // 흡수 필요 여부
  const needsAbsorb = !isAbsorbed
  // 착수금 세금계산서 미발급
  const needsTaxInvoiceDown = c.details?.tax_invoice === '희망' && !c.details?.tax_invoice_completed
  // 수수료 세금계산서 미발급 (잠금된 항목에 한해서만 체크)
  const feeEntries: any[] = c.details?.payment_entries || []
  const hasSavedFeeEntry = (!!c.details?.fee_locked && !!c.details?.fee_amount) ||
    feeEntries.some((e: any) => !!e.fee_amount && !!e.fee_locked)
  const needsTaxInvoiceFee = hasSavedFeeEntry && (
    (!!c.details?.fee_locked && !c.details?.tax_invoice_issued) ||
    feeEntries.some((e: any) => !!e.fee_amount && !!e.fee_locked && !e.tax_invoice_issued)
  )
  const needsTaxInvoiceBadge = needsTaxInvoiceDown || needsTaxInvoiceFee
  // 컨설팅 자료 미전송 — 종료/완료/환불만 제외 (absorbed는 아직 자료 미전송일 수 있음)
  const needsConsulting = !c.details?.consulting_sent &&
    !['종료','완료','환불','refunded','completed'].includes(c.progress_stage)

  const isMonthlyCard = c.details?.contract_type === '월정기권'

  return (
    <div
      className={`border rounded-xl p-2 cursor-pointer hover:shadow-md transition-all relative flex flex-col ${
        isMonthlyCard
          ? isOpen ? 'bg-purple-50 ring-2 ring-purple-400 border-purple-300' : 'bg-purple-50 border-purple-200 hover:border-purple-400'
          : isOpen ? 'bg-white ring-2 ring-violet-400 border-violet-300' : 'bg-white border-gray-200 hover:border-violet-300'
      }`}
      onClick={() => onToggle(c.id)}
    >
      {/* ① 담당자명 + 뱃지 — 고정 높이 1줄 */}
      <div className="h-[14px] flex items-center gap-1 mb-0.5 overflow-hidden">
        <span className="text-[8px] text-gray-400 font-medium truncate shrink-0 max-w-[40%]">{opsUser || '—'}</span>
        {isMonthlyCard && (
          <span className="text-[7px] font-bold bg-purple-500 text-white px-1 rounded leading-tight shrink-0">월정기</span>
        )}
        {needsAbsorb && (
          <span className="text-[7px] font-bold bg-indigo-500 text-white px-1 rounded leading-tight shrink-0">흡수</span>
        )}
        {needsTaxInvoiceBadge && (
          <span className="text-[7px] font-bold bg-red-500 text-white px-1 rounded leading-tight shrink-0">계산서</span>
        )}
        {needsConsulting && (
          <span className="text-[7px] font-bold bg-amber-500 text-white px-1 rounded leading-tight shrink-0">자료</span>
        )}
      </div>

      {/* ② 업체명 — 네모 박스 */}
      <div className="h-[34px] flex items-center justify-center border border-gray-300 rounded-lg bg-gray-50 px-1.5 mt-0.5">
        <p className="font-bold text-[#1B2A45] text-[11px] leading-tight text-center break-all line-clamp-2 w-full"
          style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
          {companyName}
        </p>
      </div>

      {/* ③ 대표명 — 1줄 고정 */}
      <div className="h-[16px] flex items-center justify-center mt-0.5">
        <p className="text-[10px] text-gray-400 truncate">{repName || <span className="text-gray-200">—</span>}</p>
      </div>

      {/* ④ 전화번호 — 1줄 고정 */}
      <div className="h-[14px] flex items-center justify-center mt-0.5">
        <p className="text-[9px] text-gray-400 font-mono">{phone ? formatPhone(phone) : <span className="text-gray-200">—</span>}</p>
      </div>

      {/* ⑤ 전체 진행현황 — 1줄 고정 */}
      {/* 영문 key → 한글 label 직접 매핑 (OVERALL_STAGES 조회 실패 방어) */}
      {(() => {
        const LABEL_MAP: Record<string, { label: string; color: string }> = {
          absorbed:  { label: '흡수완료', color: 'bg-emerald-500' },
          completed: { label: '완료',     color: 'bg-emerald-700' },
          assigned:  { label: '신규배정', color: 'bg-sky-500' },
        }
        const stage = overallStage
          ? { label: overallStage.label, color: overallStage.color }
          : LABEL_MAP[c.progress_stage] ?? (c.progress_stage ? { label: c.progress_stage, color: 'bg-gray-400' } : null)
        return (
        <div className="h-[20px] flex items-center justify-center mt-1">
            {stage ? (
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold text-white ${stage.color}`}>
                {stage.label}
              </span>
            ) : (
              <span className="text-[9px] text-gray-200">—</span>
            )}
          </div>
        )
      })()}

      {/* ⑥ 직접대출 기관 : 현황 — 1줄 고정 */}
      <div className="h-[18px] flex items-center justify-center gap-1 mt-1">
        <span className="text-[8px] font-bold text-blue-400 shrink-0">직</span>
        {directInsts.length > 0
          ? <span className="text-[8px] text-blue-700 font-medium truncate">{directInsts.map(abbrevInst).join('·')}</span>
          : <span className="text-[8px] text-gray-200">—</span>
        }
        {directStage
          ? <span className={`shrink-0 text-[8px] font-bold text-white px-1 py-0.5 rounded ${directInfo?.color || 'bg-blue-400'}`}>{directStage}</span>
          : <span className="text-[8px] text-gray-200"></span>
        }
      </div>

      {/* ⑦ 간접대출 기관 : 현황 — 1줄 고정 */}
      <div className="h-[18px] flex items-center justify-center gap-1 mt-0.5">
        <span className="text-[8px] font-bold text-violet-400 shrink-0">간</span>
        {indirectInsts.length > 0
          ? <span className="text-[8px] text-violet-700 font-medium truncate">{indirectInsts.map(abbrevInst).join('·')}</span>
          : <span className="text-[8px] text-gray-200">—</span>
        }
        {indirectStage
          ? <span className={`shrink-0 text-[8px] font-bold text-white px-1 py-0.5 rounded ${indirectInfo?.color || 'bg-violet-400'}`}>{indirectStage}</span>
          : <span className="text-[8px] text-gray-200"></span>
        }
      </div>

      {/* 경고 뱃지 (있을 때만, 높이 변동 허용) */}
      {warningBadges.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5 justify-center">
          {warningBadges.map(b => (
            <span key={b} className="text-[8px] bg-orange-50 text-orange-500 border border-orange-200 px-1 py-0.5 rounded font-bold">{b}</span>
          ))}
        </div>
      )}

      {/* ⑧ 스크립트 발송 — 항상 최하단 */}
      <div className="mt-auto pt-1.5 flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
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
          {(() => { const rep = c.customers?.representative || c.customers?.details?.representative || ''; return rep && rep !== companyName ? <span className="text-xs text-gray-400">{rep}</span> : null })()}
          <span className="text-[10px] text-gray-400 font-mono">{formatPhone(c.customers?.phone || '')}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {c.institution && <span className="text-[10px] text-gray-500">{c.institution}</span>}
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
        {cardType === 'refund' ? '환불' : '종료'}
      </div>
      {/* 업체명 */}
      <p className="font-bold text-[#1B2A45] text-[11px] leading-snug break-all" style={{ wordBreak: 'break-all' }}>
        {companyName}
      </p>
      {/* 대표자 */}
      <p className="text-[10px] text-gray-400 mt-0.5">{c.customers?.name}</p>
      {/* 기관 */}
      {c.institution && (
        <p className="text-[9px] text-violet-500 mt-0.5 font-medium">{c.institution.split(',')[0].trim()}</p>
      )}
      {/* 이동 날짜 */}
      <div className={`mt-1.5 inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${cardType === 'refund' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
        {movedDate || '—'}
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
  const [selectedInst, setSelectedInst] = useState<string | null>(null)

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

  // 신취 예정 현황 (소진공 신취 포함 케이스)
  const shintwiCases = activeCases.filter(c =>
    (c.institution || '').split(',').map((s: string) => s.trim()).includes('소진공(신취)')
  )
  const shintwiByStage: Record<string, number> = {}
  shintwiCases.forEach(c => {
    const stage = c.details?.direct_stage || c.progress_stage || '진행중'
    shintwiByStage[stage] = (shintwiByStage[stage] || 0) + 1
  })

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

      {/* 기관별 진행 현황 — 클릭하면 업체 목록 표시 */}
      {instEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">기관별 진행 현황 <span className="font-normal text-gray-400">(버튼 누르면 업체 목록)</span></p>
          <div className="flex flex-wrap gap-2 mb-3">
            {instEntries.map(({ inst, count }) => {
              const isIndirect = INDIRECT_SET.has(inst)
              const isActive = selectedInst === inst
              return (
                <button
                  key={inst}
                  onClick={() => setSelectedInst(isActive ? null : inst)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    isActive
                      ? isIndirect ? 'bg-violet-600 text-white border-violet-600' : 'bg-blue-600 text-white border-blue-600'
                      : isIndirect ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  }`}>
                  <span>{inst}</span>
                  <span className={`font-black text-[11px] px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20' : isIndirect ? 'bg-violet-200 text-violet-800' : 'bg-blue-200 text-blue-800'
                  }`}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* 선택된 기관의 단계별 요약 + 업체 목록 */}
          {selectedInst && (() => {
            const isIndirectSel = INDIRECT_SET.has(selectedInst)
            const instCases = activeCases.filter(c =>
              (c.institution || '').split(',').map((s: string) => s.trim()).includes(selectedInst)
            )
            // 단계별 집계
            const stageMap: Record<string, number> = {}
            instCases.forEach(c => {
              const st = (isIndirectSel ? c.details?.indirect_stage : c.details?.direct_stage) || c.progress_stage || '미정'
              stageMap[st] = (stageMap[st] || 0) + 1
            })
            const stageSummary = Object.entries(stageMap).sort((a, b) => b[1] - a[1])
            const allStages = [...PIPELINE_STAGES, ...OVERALL_STAGES]
            return (
              <div className="border-t border-gray-100 pt-3 space-y-3">
                {/* 단계별 요약 칩 */}
                <div>
                  <p className="text-[10px] font-bold text-gray-500 mb-1.5">{selectedInst} 단계별 현황</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stageSummary.map(([stage, cnt]) => {
                      const si = allStages.find(s => s.key === stage)
                      return (
                        <span key={stage} className={`flex items-center gap-1 text-[10px] font-semibold text-white px-2.5 py-1 rounded-full ${si?.color || 'bg-gray-400'}`}>
                          {stage} <span className="font-black">{cnt}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
                {/* 업체 목록 */}
                <div>
                  <p className="text-[10px] font-bold text-gray-500 mb-1.5">업체 목록 ({instCases.length}건)</p>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {instCases.map(c => {
                      const company = c.customers?.details?.company || c.customers?.name || '—'
                      const stage = (isIndirectSel ? c.details?.indirect_stage : c.details?.direct_stage) || c.progress_stage || '—'
                      const stageInfo = allStages.find(s => s.key === stage)
                      return (
                        <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-xs font-semibold text-[#1B2A45]">{company}</p>
                            {c.customers?.representative && (
                              <p className="text-[10px] text-gray-400 mt-0.5">{c.customers.representative}</p>
                            )}
                          </div>
                          {stage && stage !== '—' && (
                            <span className={`text-[9px] font-bold text-white px-2 py-0.5 rounded-full ${stageInfo?.color || 'bg-gray-400'}`}>
                              {stage}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* 단계별 분포 */}
      {stageEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">단계별 현황</p>
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

  // 플래그 분류 헬퍼
  const isHolding  = (c: OpsCase) => !!(c.details?.is_holding)
  const isHandling = (c: OpsCase) =>
    !!(c.details?.handling_no_contact || c.details?.handling_no_fit || c.details?.handling_mindless)

  // 승인 대기 케이스 분리 (환불예정/종료예정) — 기관 그룹에서 제외
  const pendingCases = cases.filter(c =>
    PENDING_REFUND_KEYS.has(c.progress_stage) || PENDING_DONE_KEYS.has(c.progress_stage)
  )
  const holdingCases = cases.filter(c =>
    !PENDING_REFUND_KEYS.has(c.progress_stage) && !PENDING_DONE_KEYS.has(c.progress_stage) && isHolding(c)
  )
  const handlingCases = cases.filter(c =>
    !PENDING_REFUND_KEYS.has(c.progress_stage) && !PENDING_DONE_KEYS.has(c.progress_stage) && !isHolding(c) && isHandling(c)
  )
  const regularCases = cases.filter(c =>
    !PENDING_REFUND_KEYS.has(c.progress_stage) && !PENDING_DONE_KEYS.has(c.progress_stage) && !isHolding(c) && !isHandling(c)
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
  // 핸들링 그룹
  if (handlingCases.length > 0) instGroups.push({ inst: '핸들링', items: handlingCases })
  // 홀딩 그룹 — 핸들링 아래
  if (holdingCases.length > 0) instGroups.push({ inst: '홀딩', items: holdingCases })
  // 승인 대기 — 최상단에 배치
  if (pendingCases.length > 0) instGroups.unshift({ inst: '대표 승인 대기', items: pendingCases })

  if (instGroups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E8E2D4] p-14 text-center text-[#1B2A45]/40 text-sm">
        진행중인 업체가 없습니다
      </div>
    )
  }

  // 다음 자금 대기 판별: 해당 기관(직접/간접)의 자금 진행단계가 대기 상태인지 확인
  // 대기 조건: 미선택 / 서류받는중 / 접수전
  const UPCOMING_STAGES = new Set(['', '미선택', '서류받는중', '접수전'])

  function isUpcoming(c: OpsCase, inst: string): boolean {
    const stage = INDIRECT_SET.has(inst)
      ? (c.details?.indirect_stage || '')   // 간접자금 → indirect_stage 기준
      : (c.details?.direct_stage   || '')   // 직접자금 → direct_stage 기준
    return UPCOMING_STAGES.has(stage)
  }

  return (
    <div className="space-y-4">
      {instGroups.map(({ inst, items }) => {
        const isIndirect = INDIRECT_SET.has(inst)
        const isOpen = !collapsed[inst]
        const isSpecial = inst === '신규 유입' || inst === '대표 승인 대기' || inst === '핸들링' || inst === '홀딩'

        // 기관 그룹만 진행/대기 분리 (특수 그룹 제외)
        // 직접자금 탭 → direct_stage 기준, 간접자금 탭 → indirect_stage 기준
        const activeItems   = isSpecial ? items : items.filter(c => !isUpcoming(c, inst))
        const upcomingItems = isSpecial ? []    : items.filter(c =>  isUpcoming(c, inst))

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
                    : inst === '대표 승인 대기'
                      ? 'bg-rose-500 hover:bg-rose-600'
                      : inst === '핸들링'
                        ? 'bg-slate-500 hover:bg-slate-600'
                        : inst === '홀딩'
                          ? 'bg-indigo-600 hover:bg-indigo-700'
                          : 'bg-[#1B2A45] hover:bg-[#1B2A45]/90'
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-bold text-sm">{inst}</span>
                {/* 진행 건수 */}
                <span className="bg-[#C5A258] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  진행 {activeItems.length}
                </span>
                {/* 다음 자금 대기 건수 */}
                {upcomingItems.length > 0 && (
                  <span className="bg-gray-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    대기 {upcomingItems.length}
                  </span>
                )}
                {isIndirect && <span className="text-white/60 text-[10px]">간접자금</span>}
              </div>
              <span className="text-white/60 text-xs">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="flex gap-0 items-start">
                {/* 진행 중 카드 — 항상 w-1/2 고정 */}
                <div className="w-1/2 min-w-0 pr-3">
                  {activeItems.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {activeItems.map(c => (
                        <OpsCard
                          key={`${inst}-${c.id}`}
                          c={c}
                          isOpen={openPanelIds.includes(c.id)}
                          onToggle={onToggle}
                          onScriptToggle={onScriptToggle}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full min-h-[40px]" />
                  )}
                </div>
                {/* 다음 자금 대기 — 항상 w-1/2 고정, 분리선 항상 표시 */}
                <div className="w-1/2 min-w-0 border-l-2 border-dashed border-gray-200 pl-3">
                  <p className="text-[9px] font-bold text-gray-400 mb-1.5 uppercase tracking-wide">다음 자금 대기</p>
                  {upcomingItems.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {upcomingItems.map(c => (
                        <OpsCard
                          key={`${inst}-upcoming-${c.id}`}
                          c={c}
                          isOpen={openPanelIds.includes(c.id)}
                          onToggle={onToggle}
                          onScriptToggle={onScriptToggle}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-300 italic">없음</p>
                  )}
                </div>
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
function OpsNewDbTab({ cases, userName, onSave, onAdded }: {
  cases: OpsCase[]
  userName: string
  onSave: (id: string, patch: Record<string, any>) => void
  onAdded?: () => void
}) {
  const [contractingCase, setContractingCase] = useState<OpsCase | null>(null)
  const [form, setForm] = useState({ institution: '', contract_amount: '', stage: '서류받는중', memo: '', manager: '' })
  const [saving, setSaving] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [opsUsers, setOpsUsers] = useState<{ id: string; name: string }[]>([])
  // 직접 추가 모달
  const [addModal, setAddModal] = useState(false)
  const EMPTY_ADD_FORM = {
    company: '', name: '', phone: '', region: '', reception_date: '',
    business_type: '', real_work: '', years_in_business: '', employee_count: '', patent: '',
    revenue_2026: '', revenue_2025: '', revenue_2024: '', revenue_2023: '',
    loan_kibo: '', loan_shinbo: '', loan_jaedan: '', loan_jinjong: '', loan_sojin: '', loan_other: '', loan_total: '',
    credit_kcb: '', credit_nice: '', tax_status: '', assets: '',
    required_funds: '', solution: '', memo: '',
  }
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM)
  const [addSaving, setAddSaving] = useState(false)

  function af(field: keyof typeof EMPTY_ADD_FORM, val: string) {
    setAddForm(p => ({ ...p, [field]: val }))
  }

  // ops 직원 목록 불러오기
  useEffect(() => {
    fetch('/api/users?role=ops')
      .then(r => r.json())
      .then(d => { if (d.users) setOpsUsers(d.users) })
      .catch(() => {})
  }, [])

  async function handleAddDb() {
    if (!addForm.company.trim()) return
    setAddSaving(true)
    try {
      const detailsPayload: Record<string, any> = { ops_user_name: userName }
      const fieldKeys = Object.keys(EMPTY_ADD_FORM) as (keyof typeof EMPTY_ADD_FORM)[]
      fieldKeys.forEach(k => { if (addForm[k]) detailsPayload[k] = addForm[k] })

      // 고객 생성
      const custRes = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name || addForm.company,
          phone: addForm.phone || '00000000000',
          status: 'lead',
          details: detailsPayload,
        }),
      })
      const custData = custRes.ok ? await custRes.json() : null
      const customerId = custData?.customer?.id || custData?.id || null

      // ops_case 생성 (stage: new_db)
      await fetch('/api/ops-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: addForm.company,
          phone: addForm.phone || '00000000000',
          customer_id: customerId,
          stage: 'new_db',
          ops_user_name: userName,
          details: detailsPayload,
          timeline: [{ user: userName, content: `신규DB 직접 추가: ${addForm.company}`, created_at: nowKST() }],
        }),
      })
      setAddForm(EMPTY_ADD_FORM)
      setAddModal(false)
      onAdded?.()
    } finally {
      setAddSaving(false)
    }
  }

  function openContractModal(c: OpsCase) {
    setContractingCase(c)
    setForm({ institution: c.institution || '', contract_amount: '', stage: '서류받는중', memo: '', manager: userName })
  }

  function handleContract() {
    if (!contractingCase) return
    setSaving(true)
    const managerName = form.manager || userName
    const patch: Record<string, any> = {
      progress_stage: form.stage,
      institution: form.institution || contractingCase.institution,
      ops_user_name: managerName,
      details: {
        ...(contractingCase.details || {}),
        puto_contract_amount: form.contract_amount,
        puto_contract_date: new Date().toISOString().slice(0, 10),
        puto_contract_memo: form.memo,
        ops_user_name: managerName,
      },
      timeline: [
        ...(contractingCase.timeline || []),
        {
          user: userName,
          content: `🆕 뿌토DB 계약 시작 → ${form.institution || '기관미정'}${form.contract_amount ? ' / ' + Number(form.contract_amount.replace(/[^0-9]/g,'')).toLocaleString() + '원' : ''} / 담당: ${managerName}`,
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
                <p className="text-[10px] font-bold text-gray-400 mb-1.5">담당 기관 (복수 선택)</p>
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
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">계약금액 (원)</label>
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
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">시작 단계</label>
                <select
                  value={form.stage}
                  onChange={e => setForm(p => ({ ...p, stage: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400">
                  {PIPELINE_STAGES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              {/* 담당 관리자 배정 */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">담당 관리자 배정</label>
                <select
                  value={form.manager}
                  onChange={e => setForm(p => ({ ...p, manager: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400">
                  {opsUsers.length === 0 && (
                    <option value={userName}>{userName} (현재 담당자)</option>
                  )}
                  {opsUsers.map(u => (
                    <option key={u.id} value={u.name}>{u.name}{u.name === userName ? ' (나)' : ''}</option>
                  ))}
                </select>
              </div>
              {/* 메모 */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">메모</label>
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
                {saving ? '처리중...' : '계약 시작 → 진행중'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 직접 추가 모달 — 인콜일지 전체 필드 */}
      {addModal && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-2"
          onClick={e => { if (e.target === e.currentTarget) setAddModal(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '95vh' }}>
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-[#1B2A45] to-emerald-700 px-5 py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
              <div>
                <h3 className="font-bold text-white text-sm">신규DB 직접 추가</h3>
                <p className="text-white/60 text-xs mt-0.5">내가 발굴한 DB 정보를 입력합니다</p>
              </div>
              <button onClick={() => setAddModal(false)} className="text-white/60 hover:text-white text-lg">✕</button>
            </div>

            {/* 스크롤 바디 */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

              {/* ── 기본 정보 ── */}
              <div>
                <p className="text-[11px] font-bold text-emerald-600 mb-2 flex items-center gap-1">
                  <span className="w-1 h-3 bg-emerald-500 rounded-full inline-block"></span> 기본 정보
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">업체명 <span className="text-red-400">*</span></label>
                    <input type="text" value={addForm.company} onChange={e => af('company', e.target.value)}
                      placeholder="업체명 입력" autoFocus
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">대표자명</label>
                    <input type="text" value={addForm.name} onChange={e => af('name', e.target.value)}
                      placeholder="대표자명"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">연락처</label>
                    <input type="tel" value={addForm.phone} onChange={e => af('phone', autoHyphenPhone(e.target.value))}
                      placeholder="010-0000-0000"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">지역</label>
                    <input type="text" value={addForm.region} onChange={e => af('region', e.target.value)}
                      placeholder="예: 서울 강남구"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">접수일</label>
                    <input type="date" value={addForm.reception_date} onChange={e => af('reception_date', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400" />
                  </div>
                </div>
              </div>

              {/* ── 업체 정보 ── */}
              <div>
                <p className="text-[11px] font-bold text-sky-600 mb-2 flex items-center gap-1">
                  <span className="w-1 h-3 bg-sky-500 rounded-full inline-block"></span> 업체 정보
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">업종</label>
                    <input type="text" value={addForm.business_type} onChange={e => af('business_type', e.target.value)}
                      placeholder="예: 제조업"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">실업종</label>
                    <input type="text" value={addForm.real_work} onChange={e => af('real_work', e.target.value)}
                      placeholder="실제 업종"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">업력</label>
                    <input type="text" value={addForm.years_in_business} onChange={e => af('years_in_business', e.target.value)}
                      placeholder="예: 5년"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">직원수</label>
                    <input type="text" value={addForm.employee_count} onChange={e => af('employee_count', e.target.value)}
                      placeholder="예: 10명"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">특허</label>
                    <input type="text" value={addForm.patent} onChange={e => af('patent', e.target.value)}
                      placeholder="예: 2건"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">솔루션</label>
                    <input type="text" value={addForm.solution} onChange={e => af('solution', e.target.value)}
                      placeholder="예: 기보, 신보"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">필요자금</label>
                    <input type="text" value={addForm.required_funds} onChange={e => af('required_funds', e.target.value)}
                      placeholder="예: 2억"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-400" />
                  </div>
                </div>
              </div>

              {/* ── 매출 현황 ── */}
              <div>
                <p className="text-[11px] font-bold text-amber-600 mb-2 flex items-center gap-1">
                  <span className="w-1 h-3 bg-amber-500 rounded-full inline-block"></span> 매출 현황
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {(['revenue_2026','revenue_2025','revenue_2024','revenue_2023'] as const).map(key => (
                    <div key={key}>
                      <label className="text-[10px] font-bold text-gray-400 mb-1 block">
                        {key === 'revenue_2026' ? '2026년' : key === 'revenue_2025' ? '2025년' : key === 'revenue_2024' ? '2024년' : '2023년'}
                      </label>
                      <input type="text" value={addForm[key]} onChange={e => af(key, e.target.value)}
                        placeholder="매출액"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400" />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 기대출 현황 ── */}
              <div>
                <p className="text-[11px] font-bold text-violet-600 mb-2 flex items-center gap-1">
                  <span className="w-1 h-3 bg-violet-500 rounded-full inline-block"></span> 기대출 현황
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['loan_kibo','기보'],['loan_shinbo','신보'],['loan_jaedan','재단'],
                    ['loan_jinjong','진종'],['loan_sojin','소진'],['loan_other','기타'],
                  ] as [keyof typeof EMPTY_ADD_FORM, string][]).map(([k, label]) => (
                    <div key={k}>
                      <label className="text-[10px] font-bold text-gray-400 mb-1 block">{label}</label>
                      <input type="text" value={addForm[k]} onChange={e => af(k, e.target.value)}
                        placeholder="금액"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400" />
                    </div>
                  ))}
                  <div className="col-span-3">
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">합계</label>
                    <input type="text" value={addForm.loan_total} onChange={e => af('loan_total', e.target.value)}
                      placeholder="총 대출 합계"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400" />
                  </div>
                </div>
              </div>

              {/* ── 신용·재무 ── */}
              <div>
                <p className="text-[11px] font-bold text-rose-600 mb-2 flex items-center gap-1">
                  <span className="w-1 h-3 bg-rose-500 rounded-full inline-block"></span> 신용·재무
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">신용 KCB</label>
                    <input type="text" value={addForm.credit_kcb} onChange={e => af('credit_kcb', e.target.value)}
                      placeholder="예: 750"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-rose-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">신용 NICE</label>
                    <input type="text" value={addForm.credit_nice} onChange={e => af('credit_nice', e.target.value)}
                      placeholder="예: 740"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-rose-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">세금 납부 현황</label>
                    <input type="text" value={addForm.tax_status} onChange={e => af('tax_status', e.target.value)}
                      placeholder="정상/연체 등"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-rose-400" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 mb-1 block">자산</label>
                    <input type="text" value={addForm.assets} onChange={e => af('assets', e.target.value)}
                      placeholder="예: 5억"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-rose-400" />
                  </div>
                </div>
              </div>

              {/* ── 메모 ── */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 mb-1 block">메모</label>
                <textarea value={addForm.memo} onChange={e => af('memo', e.target.value)}
                  rows={3} placeholder="특이사항, 상담 내용 등"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none" />
              </div>
            </div>

            {/* 푸터 버튼 */}
            <div className="px-5 pb-5 pt-3 flex gap-2 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setAddModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">취소</button>
              <button onClick={handleAddDb} disabled={addSaving || !addForm.company.trim()}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {addSaving ? '추가 중...' : '추가하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-sky-700 rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-base">신규DB (뿌토)</h2>
            <p className="text-white/60 text-xs mt-0.5">배정받은 DB · 계약 처리 시 진행중업체로 자동 이동</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setAddModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
              직접 추가
            </button>
            <span className="bg-white/20 text-white font-black text-xl px-4 py-1.5 rounded-xl">{cases.length}</span>
          </div>
        </div>
      </div>

      {/* 카드 그리드 */}
      {cases.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-16 text-center">
          <p className="text-2xl mb-2"></p>
          <p className="text-sm font-semibold text-gray-400">배정된 신규DB가 없습니다</p>
          <p className="text-xs text-gray-300 mt-1">대표가 뿌토 DB를 배정하면 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {cases.map(c => {
            const d = c.customers?.details || {}
            const company = d.company || c.customers?.company || c.customers?.name || '—'
            const repName = c.customers?.representative || c.customers?.name || ''
            const phone = c.customers?.phone || ''
            const businessType = d.business_type || ''
            const realWork = d.real_work || ''
            const yearsInBiz = d.years_in_business || ''
            const loanTotal = d.loan_total || ''
            const requiredFunds = d.required_funds || ''
            const solution = d.solution || c.details?.solution || ''
            const creditKcb = d.credit_kcb || ''
            const patent = d.patent || ''
            const revenueLatest = d.revenue_2025 || d.revenue_2024 || ''
            const { date } = formatKST(c.created_at || '')
            const isSelected = openId === c.id
            const isSelfAdded = c.details?.ops_user_name === userName && !c.details?.sales_customer_info
            const isMonthly = c.details?.contract_type === '월정기권'

            return (
              <div key={c.id}
                className={`border-2 rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all relative ${
                  isMonthly
                    ? isSelected ? 'bg-purple-100 ring-2 ring-purple-500 border-purple-500 shadow-lg' : 'bg-purple-100 border-purple-400 hover:border-purple-600'
                    : isSelected ? 'bg-white ring-2 ring-sky-400 border-sky-300 shadow-lg' : 'bg-white border-gray-200 hover:border-sky-300'
                }`}
                onClick={() => setOpenId(id => id === c.id ? null : c.id)}
              >
                {/* 상단 컬러바 */}
                <div className={`w-full ${
                  isMonthly ? 'h-7 bg-gradient-to-r from-purple-600 to-violet-700 flex items-center px-3 gap-1.5'
                  : isSelfAdded ? 'h-1 bg-gradient-to-r from-emerald-400 to-teal-400'
                  : 'h-1 bg-gradient-to-r from-sky-400 to-blue-500'
                }`}>
                  {isMonthly && (
                    <>
                      <span className="text-white text-[11px] font-bold tracking-wide">월정기권</span>
                      <span className="text-purple-200 text-[10px]">· 월 10만 × 12개월 · 수수료 없음</span>
                    </>
                  )}
                </div>

                <div className="p-3.5">
                  {/* 헤더 행: 뱃지 + 업체명 */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {!isMonthly && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold ${isSelfAdded ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}`}>
                          {isSelfAdded ? '직접추가' : '배정'}
                        </span>
                        )}
                        {solution && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700">
                            {solution.length > 8 ? solution.slice(0,8)+'…' : solution}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-[#1B2A45] text-sm leading-tight truncate">{company}</p>
                      {repName && repName !== company && (
                        <p className="text-[11px] text-gray-500 mt-0.5">{repName}</p>
                      )}
                    </div>
                  </div>

                  {/* 정보 그리드 */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-3">
                    {phone && (
                      <div className="col-span-2 flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-10 flex-shrink-0">연락처</span>
                        <span className="text-[11px] font-medium text-gray-700">{formatPhone(phone)}</span>
                      </div>
                    )}
                    {(businessType || realWork) && (
                      <div className="col-span-2 flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-10 flex-shrink-0">업종</span>
                        <span className="text-[11px] text-gray-700 truncate">{realWork || businessType}</span>
                      </div>
                    )}
                    {yearsInBiz && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-10 flex-shrink-0">업력</span>
                        <span className="text-[11px] text-gray-700">{yearsInBiz}</span>
                      </div>
                    )}
                    {creditKcb && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-10 flex-shrink-0">KCB</span>
                        <span className="text-[11px] text-gray-700">{creditKcb}</span>
                      </div>
                    )}
                    {patent && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-10 flex-shrink-0">특허</span>
                        <span className="text-[11px] text-gray-700">{patent}</span>
                      </div>
                    )}
                    {revenueLatest && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400 w-10 flex-shrink-0">매출</span>
                        <span className="text-[11px] text-gray-700">{revenueLatest}</span>
                      </div>
                    )}
                  </div>

                  {/* 기대출 + 필요자금 강조 */}
                  {(loanTotal || requiredFunds) && (
                    <div className="flex gap-2 mb-3">
                      {loanTotal && (
                        <div className="flex-1 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5 text-center">
                          <p className="text-[9px] text-rose-400 font-medium">기대출합계</p>
                          <p className="text-[11px] font-bold text-rose-700 mt-0.5">{loanTotal}</p>
                        </div>
                      )}
                      {requiredFunds && (
                        <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1.5 text-center">
                          <p className="text-[9px] text-emerald-400 font-medium">필요자금</p>
                          <p className="text-[11px] font-bold text-emerald-700 mt-0.5">{requiredFunds}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 하단: 날짜 + 계약 버튼 */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] text-gray-300">배정: {date}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); openContractModal(c) }}
                      className="text-[10px] bg-sky-500 hover:bg-sky-600 text-white rounded-lg px-3 py-1.5 font-semibold transition-colors flex-shrink-0"
                    >
                      계약하기
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 상세 드로어 */}
      {openId && (() => {
        const c = cases.find(x => x.id === openId)
        if (!c) return null
        const isMonthlyCase = c.details?.contract_type === '월정기권'
        return (
          <div className={`border rounded-2xl p-4 shadow-lg ${isMonthlyCase ? 'bg-purple-50 border-purple-200' : 'bg-white border-sky-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1B2A45] text-sm">
                  {c.customers?.details?.company || c.customers?.name}
                </span>
                {isMonthlyCase && (
                  <span className="text-[10px] font-bold bg-purple-600 text-white px-2 py-0.5 rounded-full">월정기권</span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openContractModal(c)}
                  className="text-xs bg-sky-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-sky-600">
                  계약하기
                </button>
                <button onClick={() => setOpenId(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
              </div>
            </div>
            {isMonthlyCase && (
              <div className="mb-3 bg-white border border-purple-200 rounded-xl px-4 py-3 flex items-center gap-6">
                <div className="text-center">
                  <p className="text-[9px] text-purple-400 font-medium">월 납입금</p>
                  <p className="text-sm font-bold text-purple-700">10만원</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-purple-400 font-medium">계약 기간</p>
                  <p className="text-sm font-bold text-purple-700">12개월</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-purple-400 font-medium">총 금액</p>
                  <p className="text-sm font-bold text-purple-700">120만원 선결제</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-purple-400 font-medium">수수료</p>
                  <p className="text-sm font-bold text-gray-400">없음</p>
                </div>
              </div>
            )}
            <OpsDetailPanel c={c} onSave={onSave} userRole="ops" userName={userName} />
          </div>
        )
      })()}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// OpsContractTab (관리팀계약 - 뿌토DB 계약된 업체 확인용 / 읽기전용)
// ──────────────────────────────────────────────────────────────────────
function OpsContractTab({ userName, openPanelIds, onToggle, onScriptToggle }: {
  userName: string
  openPanelIds: string[]
  onToggle: (id: string) => void
  onScriptToggle: (id: string, val: boolean) => void
}) {
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadContracts() }, [])

  async function loadContracts() {
    setLoading(true)
    const res = await fetch('/api/ops-cases')
    const data = await res.json()
    // 뿌토DB에서 계약된 케이스 (puto_contract_amount > 0, new_db 아닌 것)
    const putoContracts = (data.cases || []).filter((c: any) =>
      c.details?.puto_contract_amount &&
      parseInt(String(c.details.puto_contract_amount).replace(/[^0-9]/g, '') || '0') > 0 &&
      c.progress_stage !== 'new_db'
    )
    // 직접계약도 포함
    const directContracts = (data.cases || []).filter((c: any) =>
      c.details?.is_ops_direct_contract === true &&
      !putoContracts.find((p: any) => p.id === c.id)
    )
    setContracts([...putoContracts, ...directContracts])
    setLoading(false)
  }

  const totalContractAmt = contracts.reduce((sum, c) => {
    const puto = parseInt(String(c.details?.puto_contract_amount || '0').replace(/[^0-9]/g, '') || '0')
    const direct = parseInt(String(c.details?.contract_amount || '0').replace(/[^0-9]/g, '') || '0')
    return sum + (puto || direct)
  }, 0)

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-sky-700 rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-base">계약업체 현황</h2>
            <p className="text-white/60 text-xs mt-0.5">뿌토DB에서 계약 처리된 업체 목록 (읽기전용)</p>
          </div>
          <button onClick={loadContracts}
            className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
            새로고침
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-white/50 text-[10px]">총 계약 건수</p>
            <p className="text-white font-black text-xl">{contracts.length}</p>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-white/50 text-[10px]">총 계약금액</p>
            <p className="text-white font-black text-lg">{fmt(totalContractAmt)}원</p>
          </div>
        </div>
      </div>

      {/* 카드 그리드 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : contracts.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-12 text-center text-gray-400 text-sm">
          계약된 업체가 없습니다<br />
          <span className="text-xs text-gray-300 mt-1 block">신규DB 탭에서 계약하기를 눌러 계약을 진행하세요</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {contracts.map(c => (
            <OpsCard
              key={c.id}
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

// ──────────────────────────────────────────────────────────────────────
// OpsMiniRevenue — 대시보드 탭에 인라인 표시되는 매출 요약
// ──────────────────────────────────────────────────────────────────────
function OpsMiniRevenue({ userName }: { userName: string }) {
  const [rev, setRev] = useState<any>(null)

  useEffect(() => {
    fetch('/api/revenue')
      .then(r => r.json())
      .then(d => setRev(d))
      .catch(() => {})
  }, [])

  function fmtMoney(n: number) {
    if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
    if (n >= 10_000) return Math.round(n / 10_000) + '만원'
    return n.toLocaleString() + '원'
  }

  const feeTotal = (rev?.thisMonthOps || []).reduce((s: number, e: any) => s + (e.amount || 0), 0)
  const contractTotal = (rev?.thisMonthOpsContracts || []).reduce((s: number, e: any) => s + (e.amount || 0), 0)
  const total = feeTotal + contractTotal
  const monthLabel = new Date().getMonth() + 1

  return (
    <div className="bg-gradient-to-r from-[#1B2A45] to-[#2d4a7a] rounded-xl px-5 py-4 text-white mt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/70 text-xs font-semibold">{monthLabel}월 내 매출</p>
        <button onClick={() => fetch('/api/revenue').then(r=>r.json()).then(d=>setRev(d))}
          className="text-white/40 hover:text-white/70 text-[10px]">↺</button>
      </div>
      <p className="text-2xl font-black tracking-tight">{rev ? fmtMoney(total) : '—'}</p>
      <div className="flex gap-3 mt-3">
        <div className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-center">
          <p className="text-white/50 text-[9px] mb-0.5">수수료 매출</p>
          <p className="text-emerald-300 font-black text-sm">{rev ? fmtMoney(feeTotal) : '—'}</p>
          <p className="text-white/30 text-[9px] mt-0.5">{rev ? (rev.thisMonthOps?.length || 0) + '건' : ''}</p>
        </div>
        <div className="flex-1 bg-white/10 rounded-lg px-3 py-2 text-center">
          <p className="text-white/50 text-[9px] mb-0.5">계약 매출</p>
          <p className="text-sky-300 font-black text-sm">{rev ? fmtMoney(contractTotal) : '—'}</p>
          <p className="text-white/30 text-[9px] mt-0.5">{rev ? (rev.thisMonthOpsContracts?.length || 0) + '건' : ''}</p>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────
// OpsRevenueTab (개인 매출 현황 — 수수료 + 계약)
// ──────────────────────────────────────────────────────────────────────
function OpsRevenueTab({ userName }: { userName: string }) {
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [revenueTab, setRevenueTab] = useState<'fee' | 'contract'>('fee')

  function load() {
    setLoading(true)
    fetch('/api/revenue')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  function fmtMoney(n: number) {
    if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
    if (n >= 10_000) return Math.round(n / 10_000) + '만원'
    return n.toLocaleString() + '원'
  }

  const now = new Date()
  const monthLabel = now.getMonth() + 1

  // 수수료 매출 (API가 이미 유저별 필터 완료 — 추가 필터 없음)
  const feeEntries: { company: string; amount: number; date: string }[] =
    (data?.thisMonthOps || []).map((e: any) => ({
      company: e.company || '—', amount: e.amount, date: e.date || '',
    }))
  const feeTotal = feeEntries.reduce((s, e) => s + e.amount, 0)

  // 계약 매출
  const contractEntries: { company: string; amount: number; date: string; type: string }[] =
    (data?.thisMonthOpsContracts || []).map((e: any) => ({
      company: e.company || '—', amount: e.amount, date: e.date || '', type: e.type || '',
    }))
  const contractTotal = contractEntries.reduce((s, e) => s + e.amount, 0)

  const totalAll = feeTotal + contractTotal

  // 월별 추이
  const monthly = (data?.monthly || []).map((m: any) => ({
    month: m.month,
    fee: m.관리팀 || 0,
    contract: m.관리팀계약 || 0,
    total: (m.관리팀 || 0) + (m.관리팀계약 || 0),
  }))

  if (loading) return <div className="text-center py-16 text-[#1B2A45]/40 text-sm animate-pulse">불러오는 중...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* 타이틀 + 새로고침 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-[#1B2A45] text-lg">{userName || '—'} 매출 현황</h2>
          <p className="text-xs text-gray-400 mt-0.5">{now.getFullYear()}년 {monthLabel}월</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 text-xs bg-white border border-[#E8E2D4] text-[#1B2A45]/60 px-3 py-1.5 rounded-lg hover:border-[#1B2A45]/30 transition-colors">
          새로고침
        </button>
      </div>

      {/* 이달 합계 카드 */}
      <div className="bg-gradient-to-br from-[#1B2A45] to-[#2d4a7a] rounded-2xl p-5 text-white">
        <p className="text-white/50 text-xs font-semibold mb-1">{monthLabel}월 총 매출</p>
        <p className="text-4xl font-black tracking-tight">{fmtMoney(totalAll)}</p>
        <div className="flex gap-4 mt-3">
          <div className="bg-white/10 rounded-xl px-3 py-2 flex-1 text-center">
            <p className="text-white/50 text-[10px] mb-0.5">수수료 매출</p>
            <p className="font-black text-emerald-300">{fmtMoney(feeTotal)}</p>
            <p className="text-white/40 text-[9px] mt-0.5">{feeEntries.length}건</p>
          </div>
          <div className="bg-white/10 rounded-xl px-3 py-2 flex-1 text-center">
            <p className="text-white/50 text-[10px] mb-0.5">계약 매출</p>
            <p className="font-black text-sky-300">{fmtMoney(contractTotal)}</p>
            <p className="text-white/40 text-[9px] mt-0.5">{contractEntries.length}건</p>
          </div>
        </div>
      </div>

      {/* 탭 전환 */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {([['fee', '수수료 매출'], ['contract', '계약 매출']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setRevenueTab(key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${revenueTab === key ? 'bg-white text-[#1B2A45] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 수수료 매출 탭 */}
      {revenueTab === 'fee' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500">이달 수수료 매출 내역</p>
            <span className="text-xs font-black text-emerald-600">{fmtMoney(feeTotal)}</span>
          </div>
          {feeEntries.length === 0 ? (
            <div className="p-8 text-center text-gray-300 text-sm">이달 수수료 내역이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {feeEntries.map((e, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1B2A45]">{e.company}</p>
                    {e.date && <p className="text-[10px] text-gray-400 mt-0.5">{e.date}</p>}
                  </div>
                  <span className="text-sm font-black text-emerald-600">{fmtMoney(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 계약 매출 탭 */}
      {revenueTab === 'contract' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500">이달 계약 매출 내역</p>
            <span className="text-xs font-black text-sky-600">{fmtMoney(contractTotal)}</span>
          </div>
          {contractEntries.length === 0 ? (
            <div className="p-8 text-center text-gray-300 text-sm">이달 계약 내역이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {contractEntries.map((e, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1B2A45]">{e.company}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {e.date && <span className="text-[10px] text-gray-400">{e.date}</span>}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${e.type === 'puto' ? 'bg-sky-100 text-sky-600' : 'bg-violet-100 text-violet-600'}`}>
                        {e.type === 'puto' ? '뿌토계약' : '직접계약'}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-sky-600">{fmtMoney(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 월별 추이 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500">월별 매출 추이</p>
        </div>
        <div className="p-4 space-y-2.5">
          {monthly.map((m: any, i: number) => {
            const max = Math.max(...monthly.map((x: any) => x.total), 1)
            const feePct     = Math.round((m.fee / max) * 100)
            const contractPct= Math.round((m.contract / max) * 100)
            const isCurrent  = m.month === String(monthLabel).padStart(2, '0') + '월'
            return (
              <div key={i} className="flex items-center gap-2">
                <span className={`text-[11px] w-9 shrink-0 font-medium ${isCurrent ? 'text-[#1B2A45] font-bold' : 'text-gray-400'}`}>{m.month}</span>
                <div className="flex-1 flex flex-col gap-0.5">
                  {m.fee > 0 && (
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: feePct + '%' }} />
                    </div>
                  )}
                  {m.contract > 0 && (
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-sky-400 rounded-full" style={{ width: contractPct + '%' }} />
                    </div>
                  )}
                  {m.fee === 0 && m.contract === 0 && (
                    <div className="h-2 bg-gray-100 rounded-full" />
                  )}
                </div>
                <span className={`text-xs font-bold w-16 text-right ${isCurrent ? 'text-[#1B2A45]' : 'text-gray-500'}`}>
                  {m.total > 0 ? fmtMoney(m.total) : '—'}
                </span>
              </div>
            )
          })}
        </div>
        <div className="px-4 pb-3 flex items-center gap-3">
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400" /><span className="text-[10px] text-gray-400">수수료</span></div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-sky-400" /><span className="text-[10px] text-gray-400">계약</span></div>
        </div>
      </div>
    </div>
  )
}

function OpsReportTab({ userId, userName, activeCases }: { userId: string; userName: string; activeCases: OpsCase[] }) {
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
          <p className="text-xs text-violet-700 font-bold mb-3">나의 업무보고 누적 통계 ({opsReports.length}건)</p>
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
              <span className="text-4xl">✓</span>
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
              <span className="text-xs text-violet-700 font-medium">수정 중 — {editDate}</span>
              <button type="button" onClick={() => setEditDate(null)} className="text-xs text-violet-500 hover:text-violet-700">취소</button>
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">관리팀 일일업무보고</h3>
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
            <h4 className="font-semibold text-gray-800 text-sm">오늘 처리 업체</h4>
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
                        {item.institution && <span className="text-[10px] text-gray-500">{item.institution}</span>}
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
                        {activeCases.length > 0 ? (
                          <select
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400 bg-white"
                            value={item.company}
                            onChange={e => updateProcessed(i, 'company', e.target.value)}>
                            <option value="">업체 선택</option>
                            {activeCases.map(c => {
                              const name = c.customers?.details?.company || c.customers?.name || '—'
                              return <option key={c.id} value={name}>{name}</option>
                            })}
                            <option value="__direct__">직접 입력</option>
                          </select>
                        ) : (
                          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                            placeholder="업체명" value={item.company}
                            onChange={e => updateProcessed(i, 'company', e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && item.company.trim() && (e.preventDefault(), updateProcessed(i, '_locked', true))} />
                        )}
                        {item.company === '__direct__' && (
                          <input className="w-full border border-violet-300 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-violet-400"
                            placeholder="업체명 직접 입력" autoFocus
                            onChange={e => updateProcessed(i, 'company', e.target.value)} />
                        )}
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
            <label className="text-sm font-semibold text-gray-800 block mb-2">특이사항</label>
            <textarea
              value={data.special_notes}
              onChange={e => setData(p => ({ ...p, special_notes: e.target.value }))}
              rows={3} placeholder="오늘 발생한 특이사항, 이슈, 대표님께 알릴 사항 등을 입력하세요"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50 resize-none" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-800 block mb-2">내일 예정 업무</label>
            <textarea
              value={data.tomorrow_plan}
              onChange={e => setData(p => ({ ...p, tomorrow_plan: e.target.value }))}
              rows={3} placeholder="내일 처리 예정인 업체, 기관 방문 일정, 서류 준비 등을 입력하세요"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/50 resize-none" />
          </div>
        </div>

        <button type="submit" disabled={submitting}
          className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
          {submitting ? '전송 중...' : editDate ? '업무보고 수정 전송 →' : '업무보고 전송 →'}
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
                <h3 className="font-bold text-gray-900">관리팀 업무보고</h3>
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
                            {item.institution && <span className="text-[10px] text-gray-500">{item.institution}</span>}
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
  const [splitActive, setSplitActive] = useState(false)
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([])
  const [closingPanelIds, setClosingPanelIds] = useState<string[]>([])
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

  // 패널 열리면 배경 스크롤 잠금 (iOS 호환)
  useEffect(() => {
    if (openPanelIds.length > 0) {
      const scrollY = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
    } else {
      const scrollY = Math.abs(parseInt(document.body.style.top || '0', 10))
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      if (scrollY) window.scrollTo(0, scrollY)
    }
    return () => {
      const scrollY = Math.abs(parseInt(document.body.style.top || '0', 10))
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      if (scrollY) window.scrollTo(0, scrollY)
    }
  }, [openPanelIds])

  function closePanel(id: string) {
    setClosingPanelIds(prev => [...prev, id])
    setTimeout(() => {
      setOpenPanelIds(prev => prev.filter(x => x !== id))
      setClosingPanelIds(prev => prev.filter(x => x !== id))
    }, 300)
  }

  function closeAllPanels() {
    setClosingPanelIds([...openPanelIds])
    setTimeout(() => {
      setOpenPanelIds([])
      setClosingPanelIds([])
    }, 300)
  }

  function togglePanel(id: string) {
    if (openPanelIds.includes(id)) {
      closePanel(id)
    } else {
      setOpenPanelIds(prev => {
        const next = [...prev, id]
        return next.length > 2 ? next.slice(1) : next
      })
    }
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
        (c.customers?.company || '').toLowerCase().includes(q) ||
        ((c as any).customer_name || '').toLowerCase().includes(q) ||
        (c.details?.incall_journal?.company || '').toLowerCase().includes(q) ||
        (c.customers?.name || '').toLowerCase().includes(q) ||
        (c.customers?.phone || '').replace(/-/g, '').includes(q.replace(/-/g, '')) ||
        ((c as any).phone || '').replace(/-/g, '').includes(q.replace(/-/g, '')) ||
        (c.institution || '').toLowerCase().includes(q)
      )
    : cases

  const newdbCases     = filteredCases.filter(c => NEWDB_STAGE_KEYS.has(c.progress_stage))
  const refundCases    = filteredCases.filter(c => REFUND_STAGE_KEYS.has(c.progress_stage) || c.is_refund)
  const completedCases = filteredCases.filter(c => COMPLETED_STAGE_KEYS.has(c.progress_stage) || c.is_completed)
  const expiredCases   = filteredCases.filter(c =>
    !NEWDB_STAGE_KEYS.has(c.progress_stage) &&
    !REFUND_STAGE_KEYS.has(c.progress_stage) && !c.is_refund &&
    !COMPLETED_STAGE_KEYS.has(c.progress_stage) && !c.is_completed &&
    (ACTIVE_STAGE_KEYS.has(c.progress_stage) || true) &&
    isContractExpired(c)
  )
  const expiredIds = new Set(expiredCases.map(c => c.id))
  const activeCases    = filteredCases.filter(c =>
    !NEWDB_STAGE_KEYS.has(c.progress_stage) &&
    !expiredIds.has(c.id) && (
      ACTIVE_STAGE_KEYS.has(c.progress_stage) ||
      (!REFUND_STAGE_KEYS.has(c.progress_stage) && !COMPLETED_STAGE_KEYS.has(c.progress_stage) && !c.is_refund && !c.is_completed)
    )
  )

  const tabCounts: Record<OpsTab, number | null> = {
    dashboard:    null,
    active:       activeCases.length,
    expired:      expiredCases.length,
    refund:       refundCases.length,
    completed:    completedCases.length,
    newdb:        newdbCases.length,
    ops_contract: null,
    report:       null,
    revenue:      null,
    profile:      null,
  }

  return (
    <PullToRefresh onRefresh={loadCases}>
    <div className="min-h-screen page-bg">
      {splitActive && <SplitView onClose={() => setSplitActive(false)} />}
      {/* Header */}
      <header className="bg-[#1B2A45] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <Link href="/" className="relative h-8 w-24 shrink-0 block">
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain object-left brightness-0 invert" unoptimized />
        </Link>
        <span className="text-white/50 text-xs font-medium hidden md:block">
          {opsTabs.find(t => t.key === activeTab)?.label ?? '관리팀 대시보드'}
        </span>
        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="업체명·이름·기관..."
              className="bg-white/10 text-white placeholder-white/40 text-xs px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:bg-white/20 w-28 md:w-40"
            />
            {q.length >= 1 && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs">✕</button>
            )}
            {/* 검색 결과 드롭다운 */}
            {q.length >= 1 && filteredCases.length > 0 && filteredCases.length < cases.length && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 w-80 max-h-80 overflow-y-auto">
                <p className="text-[10px] text-gray-400 px-3 pt-2.5 pb-1 font-semibold">{filteredCases.length}건 검색됨</p>
                {filteredCases.slice(0, 15).map((c: any) => {
                  const company = c.customers?.details?.company || c.customers?.company || c.customer_name || c.details?.incall_journal?.company || '(업체명 없음)'
                  const phone = c.customers?.phone || c.phone || ''
                  const tabKey = NEWDB_STAGE_KEYS.has(c.progress_stage) ? 'newdb'
                    : (REFUND_STAGE_KEYS.has(c.progress_stage) || c.is_refund) ? 'refund'
                    : (COMPLETED_STAGE_KEYS.has(c.progress_stage) || c.is_completed) ? 'completed'
                    : expiredIds.has(c.id) ? 'expired'
                    : 'active'
                  const tabLabel: Record<string, string> = { active: '진행중', expired: '기간만료', refund: '환불', completed: '종료', newdb: '신규DB' }
                  return (
                    <button key={c.id}
                      onClick={() => {
                        setActiveTab(tabKey as any)
                        setSearchQuery('')
                        // 스크롤 to ops case
                        setTimeout(() => {
                          const el = document.getElementById(`opscase-${c.id}`)
                          if (el) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            el.classList.add('ring-2', 'ring-[#C5A258]', 'ring-offset-1')
                            setTimeout(() => el.classList.remove('ring-2', 'ring-[#C5A258]', 'ring-offset-1'), 2500)
                          } else {
                            // OpsCard 안에 있는 경우 togglePanel로 열기
                            setOpenPanelIds(prev => prev.includes(c.id) ? prev : [...prev, c.id])
                          }
                        }, 200)
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2 border-t border-gray-50">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{company}</p>
                        <p className="text-[11px] text-gray-400 truncate">{phone} · {c.institution || '기관미정'} · {c.ops_user_name || '-'}</p>
                      </div>
                      <span className="shrink-0 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {tabLabel[tabKey]}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {q.length >= 1 && filteredCases.length === 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 w-72 px-4 py-3 text-xs text-gray-400">
                검색 결과 없음
              </div>
            )}
          </div>
          {/* 창분할 버튼 */}
          <button
            onClick={() => setSplitActive(true)}
            className="text-[11px] px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap font-medium hidden md:block text-white/50 hover:text-white hover:bg-white/10"
            title="창 분할 — 화면을 두 패널로 나눠서 독립적으로 사용">
            ⊞ 분할
          </button>
          <button
            onClick={() => setNotepadOpen(v => !v)}
            className={`text-[11px] px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap font-medium ${notepadOpen ? 'bg-[#C5A258]/80 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}>
            메모
          </button>
          <button onClick={() => setActiveTab('dashboard')}
            className="text-white/50 hover:text-white text-[11px] px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap hidden md:block font-medium">
            홈
          </button>
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
                    <button onClick={async () => { try { sessionStorage.removeItem('pin_verified'); sessionStorage.removeItem('pin_user_id'); sessionStorage.removeItem('pin_last_activity') } catch {} await signOut({ redirect: false }); window.location.replace('/login') }}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition-colors font-medium">로그아웃</button>
                  </div>
                  {installable && (
                    <button onClick={() => { handleInstall(); setMenuOpen(false) }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs border border-[#1B2A45]/20 hover:border-[#C5A258]/60 text-[#1B2A45]/60 hover:text-[#C5A258] font-semibold px-3 py-1.5 rounded-lg transition-colors">
                      앱 설치
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

      {/* 데스크탑 탭바 */}
      <div className="hidden md:flex bg-white border-b border-gray-200 sticky top-[52px] z-20 px-6 overflow-x-auto shadow-sm">
        {opsTabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-3 text-sm whitespace-nowrap shrink-0 transition-colors font-medium flex items-center gap-1.5 ${
              activeTab === tab.key ? 'text-[#1B2A45]' : 'text-[#1B2A45]/45 hover:text-[#1B2A45]/75'
            }`}>
            {tab.label}
            {tabCounts[tab.key] !== null && tabCounts[tab.key]! > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === tab.key ? 'bg-[#1B2A45] text-white' : 'bg-gray-100 text-gray-500'
              }`}>{tabCounts[tab.key]}</span>
            )}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#C5A258] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">

        {/* ── 대시보드 ── */}
        {activeTab === 'dashboard' && (
          loading ? (
            <div className="text-center py-16 text-[#1B2A45]/40 text-sm">불러오는 중...</div>
          ) : (
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-[#1B2A45] text-base">관리팀 대시보드</h2>
                <button onClick={loadCases}
                  className="text-xs bg-white border border-[#E8E2D4] text-[#1B2A45]/60 px-3 py-1.5 rounded-lg hover:border-[#1B2A45]/30 transition-colors">
                  새로고침
                </button>
              </div>
              {/* 이달 매출 — 최상단 */}
              <OpsMiniRevenue userName={userName} />

              <DashboardOverview cases={cases} />

              {/* 공지사항 */}
              {notices.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h3 className="text-sm font-bold text-gray-700">공지사항</h3>
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
                  { tab: 'active' as OpsTab, icon: '', label: '진행중업체', count: activeCases.length, color: 'border-amber-200 hover:border-amber-400' },
                  { tab: 'expired' as OpsTab, icon: '', label: '계약기간만료', count: expiredCases.length, color: 'border-orange-300 hover:border-orange-500' },
                  { tab: 'refund' as OpsTab, icon: '', label: '환불업체', count: refundCases.length, color: 'border-rose-200 hover:border-rose-400' },
                  { tab: 'completed' as OpsTab, icon: '', label: '종료업체', count: completedCases.length, color: 'border-emerald-200 hover:border-emerald-400' },
                  { tab: 'ops_contract' as OpsTab, icon: '', label: '관리팀계약', count: null, color: 'border-violet-200 hover:border-violet-400' },
                  { tab: 'report' as OpsTab, icon: '', label: '관리팀보고', count: null, color: 'border-blue-200 hover:border-blue-400' },
                  { tab: 'revenue' as OpsTab, icon: '', label: '매출 현황', count: null, color: 'border-emerald-200 hover:border-emerald-400' },
                  { tab: 'profile' as OpsTab, icon: '', label: '사원정보', count: null, color: 'border-gray-200 hover:border-gray-400' },
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
              <h2 className="font-bold text-[#1B2A45] text-base">진행중업체</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{activeCases.length}건</span>
                <button onClick={loadCases}
                  className="text-xs bg-white border border-[#E8E2D4] text-[#1B2A45]/60 px-3 py-1.5 rounded-lg hover:border-[#1B2A45]/30 transition-colors">
                  새로고침
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
              <h2 className="font-bold text-[#1B2A45] text-base">환불업체</h2>
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
              <h2 className="font-bold text-[#1B2A45] text-base">종료업체</h2>
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

        {/* ── 계약기간만료 ── */}
        {activeTab === 'expired' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-[#1B2A45] text-base">계약기간만료</h2>
                <p className="text-xs text-orange-500 mt-0.5">계약일로부터 1년 경과한 진행중 업체</p>
              </div>
              <span className="text-xs text-gray-400">{expiredCases.length}건</span>
            </div>
            {loading ? (
              <div className="text-center py-16 text-[#1B2A45]/40 text-sm">불러오는 중...</div>
            ) : expiredCases.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E8E2D4] p-14 text-center text-[#1B2A45]/40 text-sm">계약기간 만료 업체가 없습니다</div>
            ) : (
              <InstitutionGroupedView
                cases={expiredCases}
                openPanelIds={openPanelIds}
                onToggle={togglePanel}
                onScriptToggle={(id, val) =>
                  handleSave(id, { details: { ...(cases.find(x => x.id === id)?.details || {}), script_sent: val } })
                }
              />
            )}
          </div>
        )}

        {/* ── 신규DB (뿌토) ── */}
        {activeTab === 'newdb' && (
          <OpsNewDbTab cases={newdbCases} userName={userName} onSave={handleSave} onAdded={loadCases} />
        )}

        {/* ── 관리팀계약 ── */}
        {activeTab === 'ops_contract' && (
          <OpsContractTab
            userName={userName}
            openPanelIds={openPanelIds}
            onToggle={togglePanel}
            onScriptToggle={(id, val) =>
              handleSave(id, { details: { ...(cases.find(x => x.id === id)?.details || {}), script_sent: val } })
            }
          />
        )}

        {/* ── 관리팀보고 ── */}
        {activeTab === 'report' && (
          <OpsReportTab userId={userId} userName={userName} activeCases={activeCases} />
        )}

        {/* ── 매출 현황 ── */}
        {activeTab === 'revenue' && (
          <OpsRevenueTab userName={userName} />
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
            <span className="text-[11px] font-bold text-white">메모장</span>
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
                const sectionLabel = { today: '오늘', week: '이번주', month: '이번달' }[p]
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
              <p className="text-[9px] font-bold text-amber-600 mb-1.5">자유 메모</p>
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
          className="fixed inset-0 bg-black/40 z-[99] transition-opacity duration-300"
          onClick={closeAllPanels}
        />
      )}

      {/* ── 우측 슬라이딩 패널 ── */}
      {openPanelIds.map((id, panelIndex) => {
        const c = cases.find(x => x.id === id)
        if (!c) return null
        const rightOffset = panelIndex === 0 ? 'right-0' : 'right-0 md:right-[530px]'
        const isClosing = closingPanelIds.includes(id)
        return (
          <div key={id}
            className={`fixed top-0 bottom-0 ${rightOffset} w-full md:w-[520px] shadow-2xl overflow-y-auto z-[100] transition-transform duration-300 ease-in-out ${isClosing ? 'translate-x-full' : 'translate-x-0'} ${c.details?.contract_type === '월정기권' ? 'bg-purple-50' : 'bg-white'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`sticky top-0 border-b px-5 py-3 flex items-center justify-between z-10 ${c.details?.contract_type === '월정기권' ? 'bg-purple-600 border-purple-700' : 'bg-white border-gray-100'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className={`font-bold text-sm ${c.details?.contract_type === '월정기권' ? 'text-white' : 'text-[#1B2A45]'}`}>{c.customers?.details?.company || c.customers?.name}</p>
                  {c.details?.contract_type === '월정기권' && (
                    <span className="text-[10px] font-bold bg-white text-purple-700 px-2 py-0.5 rounded-full">월정기권</span>
                  )}
                </div>
                <p className={`text-[10px] ${c.details?.contract_type === '월정기권' ? 'text-purple-200' : 'text-gray-400'}`}>{c.customers?.name} · {formatPhone(c.customers?.phone || '')}</p>
                {c.details?.contract_type === '월정기권' && (
                  <p className="text-[10px] text-purple-200 mt-0.5">월 10만원 × 12개월 = 120만원 선결제 · 수수료 없음</p>
                )}
              </div>
              <button onClick={() => closePanel(id)} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">✕</button>
            </div>
            <div className="p-4">
              <OpsDetailPanel c={c} onSave={handleSave} userRole={userRole} userName={userName} />
            </div>
          </div>
        )
      })}
    </div>
    </PullToRefresh>
  )
}
