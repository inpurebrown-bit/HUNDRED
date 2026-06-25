'use client'

import { useState, useRef, useEffect } from 'react'
import NumberInput, { parseNumber, formatNumber } from '@/components/ui/NumberInput'
import MeetingJournal from '@/components/sales/MeetingJournal'

// ── 전화번호 유틸 ──────────────────────────────────────────
function formatPhone(v: string): string {
  if (!v) return ''
  const d = v.replace(/[^0-9]/g, '')
  if (d.length === 11) return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`
  return v
}
function autoHyphenPhone(v: string): string {
  const d = v.replace(/[^0-9]/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0,3)}-${d.slice(3)}`
  return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`
}

// ── KST 시간 유틸 ──────────────────────────────────────────
function nowKST(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00'
}
function formatKST(isoStr: string): { date: string; time: string } {
  if (!isoStr) return { date: '', time: '' }
  const d = new Date(isoStr)
  const date = d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')
  const time = d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
  return { date, time }
}

// ── 혁신요건 옵션 ──────────────────────────────────────────
const INNOVATION_GROUPS = [
  {
    group: '혁신형',
    color: 'bg-violet-100 text-violet-800 border-violet-300',
    options: ['매출신장', '수출', '직접대출 성실상환'],
  },
  {
    group: '일반형',
    color: 'bg-sky-100 text-sky-800 border-sky-300',
    options: ['3D', 'AI', '키오스크', '디지털오더', '무인판매기', '로봇', '디지털메뉴', '전자칠판', '고객관리S/W', '매출관리S/W', '재고관리S/W', '통합관리시스템', '온라인예약관리', '육가공공정시스템'],
  },
]

function InnovationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = value ? value.split(',').map(v => v.trim()).filter(Boolean) : []

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function toggle(opt: string) {
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]
    onChange(next.join(', '))
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full text-left bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none min-h-[32px] flex flex-wrap gap-1 items-center">
        {selected.length > 0
          ? selected.map(s => <span key={s} className="bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">{s}</span>)
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
                    className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                      selected.includes(opt) ? color : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                    }`}>{opt}</button>
                ))}
              </div>
            </div>
          ))}
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange('')}
              className="mt-2 text-[10px] text-red-400 hover:text-red-600 w-full text-right">전체 해제</button>
          )}
        </div>
      )}
    </div>
  )
}

export interface Customer {
  id: string
  name: string
  phone: string
  company: string
  status: string
  notes?: string
  memo?: string
  details?: Record<string, any>
  call_timeline?: any[]
  created_at?: string
  updated_at?: string
  sales_user_name?: string
}

// ── ResultMemoField (자동저장) ─────────────────────────────────────────
function ResultMemoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setLocal(value) }, [value])

  function handleChange(v: string) {
    setLocal(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(v), 1000)
  }

  return (
    <textarea
      value={local}
      onChange={e => handleChange(e.target.value)}
      rows={4}
      placeholder="통화 결과, 반응, 특이사항..."
      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/50 resize-none"
    />
  )
}

export type OpsStatus = {
  stage: string
  institution?: string
  memo?: string
  is_refund?: boolean
  is_completed?: boolean
}

export interface Props {
  customers: Customer[]
  allCustomers?: Customer[]   // 누적매출 계산용 (전체 고객)
  opsContracts?: { customer_id: string; ops_user_name?: string }[] // 자금담당자 표시용
  opsStatusMap?: Record<string, OpsStatus>   // 자금팀 진행현황 (읽기전용)
  tabType: 'db010' | 'lead' | 'contracted' | 'emotional' | 'trash'
  salesUsers: string[]
  opsUsers?: string[]         // 대표 전용 DB 이동용 관리팀 목록
  userName: string
  onUpdate: (id: string, patch: Record<string, any>) => Promise<void>
  onStatusChange: (id: string, newStatus: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onTransferToOps?: (customer: Customer) => Promise<void>
  onCeoTransfer?: (id: string, destPerson: string, destBucket: string, destRole: 'sales' | 'ops') => Promise<void>
  onMarkDirect?: (id: string) => Promise<void>  // 대표 전용: 공가→직가 전환
  showOwner?: boolean
  groupBy?: 'date' | 'mood'   // db010 전용: 접수날짜별 or 감도별
  scrollToId?: string          // 이 ID의 카드로 자동 스크롤 + 펼침
}

// ── ops 진행단계 스타일 ──────────────────────────────────────────
function getOpsStageStyle(stage: string): { bg: string; label: string } {
  if (!stage) return { bg: 'bg-gray-300 text-white', label: '대기중' }
  if (stage === '환불')     return { bg: 'bg-rose-600 text-white',   label: '환불' }
  if (stage === '환불예정') return { bg: 'bg-rose-400 text-white',   label: '환불예정' }
  if (stage === '종료예정') return { bg: 'bg-orange-400 text-white', label: '종료예정' }
  if (stage === '종료' || stage === '완료') return { bg: 'bg-gray-400 text-white', label: stage }
  if (stage === '승인')     return { bg: 'bg-emerald-500 text-white', label: '승인' }
  if (stage === 'absorbed')  return { bg: 'bg-emerald-500 text-white', label: '흡수완료' }
  if (stage === 'completed') return { bg: 'bg-emerald-700 text-white', label: '완료' }
  if (stage === 'assigned')  return { bg: 'bg-sky-500 text-white',     label: '신규배정' }
  if (stage === 'refunded')  return { bg: 'bg-rose-600 text-white',    label: '환불' }
  if (['서류받는중', '접수전'].includes(stage)) return { bg: 'bg-gray-400 text-white', label: stage }
  return { bg: 'bg-blue-500 text-white', label: stage }
}

// ── CEO 카드 이동 모달 ────────────────────────────────────────────────
const SALES_BUCKETS = [
  { label: '고객DB',   value: 'lead',       color: 'bg-sky-500 text-white' },
  { label: '010DB',    value: 'db010',      color: 'bg-violet-500 text-white' },
  { label: '계약업체', value: 'contracted', color: 'bg-emerald-500 text-white' },
  { label: '감성톡',   value: 'emotional',  color: 'bg-pink-500 text-white' },
  { label: '거절',     value: 'trash',      color: 'bg-gray-400 text-white' },
]
const OPS_BUCKETS = [
  { label: '신규DB',     value: 'new_db',       color: 'bg-sky-500 text-white' },
  { label: '서류받는중', value: '서류받는중',   color: 'bg-orange-500 text-white' },
  { label: '진행중',     value: '진행중',       color: 'bg-blue-500 text-white' },
]

function CeoMoveModal({
  customer,
  salesUsers,
  opsUsers,
  onClose,
  onConfirm,
}: {
  customer: Customer
  salesUsers: string[]
  opsUsers: string[]
  onClose: () => void
  onConfirm: (destPerson: string, destBucket: string, destRole: 'sales' | 'ops') => Promise<void>
}) {
  // 단계별 선택: 팀 → 담당자 → 메뉴
  const [selTeam, setSelTeam] = useState<'sales' | 'ops' | null>(null)
  const [selPerson, setSelPerson] = useState<string>('')
  const [selBucket, setSelBucket] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const buckets = selTeam === 'ops' ? OPS_BUCKETS : SALES_BUCKETS
  const people = selTeam === 'ops' ? opsUsers : salesUsers
  const canMove = selPerson && selBucket

  function pickTeam(team: 'sales' | 'ops') {
    setSelTeam(team)
    setSelPerson('')
    setSelBucket('')
  }

  async function handleMove() {
    if (!canMove || !selTeam) return
    setLoading(true)
    await onConfirm(selPerson, selBucket, selTeam)
    setLoading(false)
    onClose()
  }

  const company = (customer as any).details?.company || customer.company || customer.name
  const bucketLabel = buckets.find(b => b.value === selBucket)?.label

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-[#1B2A45] to-blue-700 px-5 py-4 text-white flex items-start justify-between">
          <div>
            <p className="font-bold text-sm">DB 이동</p>
            <p className="text-white/70 text-xs mt-0.5 break-all">{company}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-lg leading-none ml-4">✕</button>
        </div>

        <div className="p-4 space-y-4">

          {/* STEP 1: 팀 선택 */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 mb-2">어느 팀으로 이동할까요?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => pickTeam('sales')}
                className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${selTeam === 'sales' ? 'bg-[#1B2A45] text-white border-[#1B2A45]' : 'bg-white text-[#1B2A45] border-[#1B2A45]/30 hover:border-[#1B2A45]'}`}>
                영업팀
              </button>
              <button onClick={() => pickTeam('ops')}
                className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${selTeam === 'ops' ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-violet-600 border-violet-200 hover:border-violet-400'}`}>
                관리팀
              </button>
            </div>
          </div>

          {/* STEP 2: 담당자 선택 */}
          {selTeam && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 mb-2">
                {selTeam === 'sales' ? '영업팀' : '관리팀'} 담당자를 선택하세요
              </p>
              {people.length === 0 ? (
                <p className="text-xs text-gray-400 italic">등록된 담당자 없음</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {people.map(u => (
                    <button key={u} onClick={() => { setSelPerson(u); setSelBucket('') }}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${selPerson === u
                        ? selTeam === 'ops' ? 'bg-violet-600 text-white border-violet-600' : 'bg-[#1B2A45] text-white border-[#1B2A45]'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400'}`}>
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: 메뉴 선택 */}
          {selPerson && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 mb-2">
                <span className="font-bold text-gray-700">{selPerson}</span>의 어느 메뉴로?
              </p>
              <div className="flex flex-wrap gap-1.5">
                {buckets.map(b => (
                  <button key={b.value} onClick={() => setSelBucket(b.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${selBucket === b.value ? b.color + ' border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 이동 경로 요약 */}
          {canMove && bucketLabel && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
              <p className="font-bold text-sm mb-0.5">이동 경로 확인</p>
              <p className="text-amber-600">
                <span className="font-bold text-amber-900">{company}</span>{' '}
                →{' '}<span className="font-bold text-amber-900">{selPerson}</span>의{' '}
                <span className={`font-bold px-1.5 py-0.5 rounded ${buckets.find(b => b.value === selBucket)?.color}`}>{bucketLabel}</span>
              </p>
            </div>
          )}
        </div>

        {/* 실행 버튼 */}
        <div className="px-4 pb-4 flex gap-2">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
            취소
          </button>
          <button onClick={handleMove} disabled={!canMove || loading}
            className="flex-1 bg-[#C5A258] hover:bg-[#C5A258]/90 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-bold transition-colors">
            {loading ? '이동중...' : '이동하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 이번달 특정 영업사원의 기존 누적매출 합산 */
function calcMonthlyRevenue(allCustomers: Customer[], salesUserName: string): number {
  const currentMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  return allCustomers
    .filter(c =>
      c.status === 'contracted' &&
      (c.sales_user_name === salesUserName || c.details?.sales_user_name === salesUserName) &&
      (c.details?.contract_date || c.created_at || '').slice(0, 7) === currentMonth
    )
    .reduce((sum, c) => sum + parseNumber(c.details?.my_revenue || '0'), 0)
}

// ── Badge configs ──────────────────────────────────────────────────────
const CALL_RESULTS = [
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

const CLOSING_RESULTS = [
  { key: '결정업체',   color: 'bg-emerald-500 text-white' },
  { key: '고민중',     color: 'bg-orange-400 text-white' },
  { key: '부재',       color: 'bg-slate-400 text-white' },
  { key: '재통화',     color: 'bg-sky-400 text-white' },
  { key: '거절',       color: 'bg-red-500 text-white' },
  { key: '자체거절',   color: 'bg-gray-400 text-white' },
  { key: '',           color: 'bg-gray-100 text-gray-400' },
]

// 인콜일지 필드 목록 (혁신요건은 별도 컴포넌트로 처리)
const KEY_LABELS = new Set(['업체명','대표자','연락처','업종','실제업무','25년매출','NICE점수','필요자금'])
function buildLogFields(c: Customer) {
  return [
    { label: '업체명',    value: c.details?.company || c.company },
    { label: '대표자',    value: c.name },
    { label: '연락처',    value: formatPhone(c.phone || '') },
    { label: '지역',      value: c.details?.region },
    { label: '접수일',    value: c.details?.reception_date },
    { label: '업종',      value: c.details?.business_type },
    { label: '실제업무',  value: c.details?.real_work },
    { label: '업력',      value: c.details?.years_in_business || c.details?.biz_size },
    { label: '직원수',    value: c.details?.employee_count },
    // 혁신요건은 InnovationSelect 컴포넌트로 처리
    { label: '특허',      value: c.details?.patent },
    { label: '26년매출',  value: c.details?.revenue_2026 },
    { label: '25년매출',  value: c.details?.revenue_2025 },
    { label: '24년매출',  value: c.details?.revenue_2024 },
    { label: '23년매출',  value: c.details?.revenue_2023 },
    { label: '기보대출',  value: c.details?.loan_kibo || c.details?.loan_policy },
    { label: '신보대출',  value: c.details?.loan_shinbo },
    { label: '재단대출',  value: c.details?.loan_jaedan },
    { label: '중진공',    value: c.details?.loan_jinjong },
    { label: '소진공',    value: c.details?.loan_sojin },
    { label: '신용/담보', value: c.details?.loan_other || c.details?.loan_credit },
    { label: '기대출합계',value: c.details?.loan_total },
    { label: 'KCB점수',   value: c.details?.credit_kcb || c.details?.credit_score },
    { label: 'NICE점수',  value: c.details?.credit_nice },
    { label: '세금체납',  value: c.details?.tax_status || c.details?.tax_delinquency },
    { label: '자산',      value: c.details?.assets },
    { label: '필요자금',  value: c.details?.required_funds },
    { label: '솔루션',    value: c.details?.solution },
  ]
}

// ── BadgeDropdown ──────────────────────────────────────────────────────
interface BadgeDropdownProps {
  value: string
  options: { key: string; color: string }[]
  onChange: (key: string) => void
  placeholder?: string
}

function BadgeDropdown({ value, options, onChange, placeholder }: BadgeDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => o.key === value) || options[options.length - 1]

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title={current.key || placeholder || '—'}
        className={`w-full block text-center px-0.5 py-0.5 rounded text-[8px] font-bold cursor-pointer select-none leading-tight overflow-hidden whitespace-nowrap ${current.color}`}
        style={{ textOverflow: 'ellipsis' }}
      >
        {current.key || placeholder || '—'}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[100px] py-1">
          {options.map(opt => (
            <button
              key={opt.key || '__empty__'}
              type="button"
              onClick={() => { onChange(opt.key); setOpen(false) }}
              className="w-full text-left px-2.5 py-1.5 text-[10px] font-semibold hover:bg-gray-50 flex items-center gap-1.5"
            >
              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap ${opt.color}`}>
                {opt.key || '—'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ContractModal ──────────────────────────────────────────────────────
interface ContractModalProps {
  company: string
  cumulativeBase: number
  initialMemo?: string     // 통화내용/메모 미러링용 초기값
  initialNoRefund?: boolean
  onClose: () => void
  onConfirm: (data: Record<string, any>) => Promise<void>
}

const INP = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50'

function ContractModal({ company, cumulativeBase, initialMemo = '', initialNoRefund = false, onClose, onConfirm }: ContractModalProps) {
  const [contractFee, setContractFee] = useState('')
  const [paidAmount,  setPaidAmount]  = useState('')
  const [vatIncluded, setVatIncluded] = useState(false)
  const [myRevenue,   setMyRevenue]   = useState('')
  const [contractDate, setContractDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<'카드' | '현금' | ''>('')
  const [approvedAmount, setApprovedAmount] = useState('')
  const [commissionRate, setCommissionRate] = useState('')
  // 메모 미러링: 통화내용/메모와 동일 필드 (initialMemo로 pre-fill)
  const [opsMemo,     setOpsMemo]     = useState(initialMemo)
  const [noRefund,    setNoRefund]    = useState(initialNoRefund)
  const [groupChatInvited, setGroupChatInvited] = useState(false)
  const [coopRequestSent,  setCoopRequestSent]  = useState(false)
  const [saving, setSaving] = useState(false)

  const feeNum      = parseNumber(contractFee)
  const paidNum     = parseNumber(paidAmount)
  const myRevNum    = parseNumber(myRevenue)
  const approvedNum = parseNumber(approvedAmount)

  // 부가세: 입금액 ÷ 11
  const vat     = vatIncluded && paidNum > 0 ? Math.round(paidNum / 11) : 0
  // 순입금 = 입금액 - 부가세 (VAT 제외 실금액)
  const netPaid = paidNum - vat
  // 잔금 = 총합의금(VAT별도) - 순입금
  const unpaid  = feeNum > 0 ? Math.max(0, feeNum - netPaid) : 0
  // 누적 매출: 이번달 기존 합 + 이번 본인 매출
  const cumulative = cumulativeBase + myRevNum

  async function handleConfirm() {
    setSaving(true)
    const commRateNum = parseFloat(commissionRate) || 0
    // 성공보수 = 승인예상금액 × 성공보수율% (입금액 기준 아님)
    const commAmount  = approvedNum > 0 && commRateNum > 0 ? Math.round(approvedNum * commRateNum / 100) : 0
    await onConfirm({
      contract_fee:        formatNumber(feeNum),
      payment_amount:      formatNumber(paidNum),
      net_paid:            formatNumber(netPaid),
      vat_included:        vatIncluded,
      vat_amount:          vat > 0 ? formatNumber(vat) : '0',
      unpaid_amount:       unpaid > 0 ? formatNumber(unpaid) : '0',
      // 부가세 체크 여부 → 자금팀 세금계산서 자동 설정
      tax_invoice:         vatIncluded ? '발급' : '미발급',
      my_revenue:          formatNumber(myRevNum),
      cumulative_revenue:  formatNumber(cumulative),
      payment_method:      paymentMethod,
      approved_amount:     approvedNum > 0 ? formatNumber(approvedNum) : '',
      commission_rate:     commissionRate,
      commission_amount:   commAmount > 0 ? formatNumber(commAmount) : '',
      result_memo:         opsMemo,
      no_refund:           noRefund,
      group_chat_invited:  groupChatInvited,
      coop_request_sent:   coopRequestSent,
      contract_date:       contractDate,
    })
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[#1B2A45] text-sm">계약완료 처리</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{company}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">

          {/* ① 계약금 */}
          <div>
            <label className="text-[10px] text-blue-700 mb-1 block font-bold">
              계약금 <span className="text-gray-400 font-normal">(계약서 작성 시 기입한 금액, VAT 별도)</span>
            </label>
            <NumberInput value={contractFee} onChange={setContractFee} className={INP} placeholder="500,000" />
          </div>

          {/* ② 이번 입금액 */}
          <div>
            <label className="text-[10px] text-blue-700 mb-1 block font-bold">이번 입금액 <span className="text-gray-400 font-normal">(VAT 포함)</span></label>
            <NumberInput value={paidAmount} onChange={setPaidAmount} className={INP} placeholder="330,000" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-blue-50 rounded-lg px-3 py-2">
            <input type="checkbox" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500" />
            <span className="text-xs text-blue-800 font-medium">입금액에 부가세 포함 (÷11 자동계산)</span>
          </label>

          {/* 결제방식 — 카드·현금만 */}
          <div>
            <label className="text-[10px] text-blue-700 mb-1.5 block font-bold">결제방식</label>
            <div className="flex gap-2">
              {(['카드', '현금'] as const).map(m => (
                <button key={m} type="button"
                  onClick={() => setPaymentMethod(p => p === m ? '' : m)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    paymentMethod === m
                      ? m === '카드' ? 'bg-blue-500 text-white border-blue-500'
                                     : 'bg-emerald-500 text-white border-emerald-500'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                  }`}>{m}</button>
              ))}
            </div>
          </div>

          {/* 수수료율 */}
          <div className="bg-violet-50 rounded-xl p-3 space-y-2.5 border border-violet-100">
            <p className="text-[10px] text-violet-700 font-bold">
              수수료율
            </p>
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">수수료율</label>
              <div className="relative">
                <input
                  type="number"
                  value={commissionRate}
                  onChange={e => setCommissionRate(e.target.value)}
                  placeholder="예: 6"
                  className={INP + ' pr-6'}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
              </div>
            </div>
          </div>

          {/* ③ 자동계산 박스 */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">부가세</p>
                <p className={`text-sm font-bold ${vat > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                  {vat > 0 ? vat.toLocaleString() + '원' : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">순입금</p>
                <p className={`text-sm font-bold ${netPaid > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                  {netPaid > 0 ? netPaid.toLocaleString() + '원' : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">잔금</p>
                <p className={`text-sm font-bold ${unpaid > 0 ? 'text-red-500' : unpaid === 0 && feeNum > 0 ? 'text-emerald-500' : 'text-gray-300'}`}>
                  {feeNum > 0
                    ? unpaid > 0 ? unpaid.toLocaleString() + '원' : '완납 ✓'
                    : '—'}
                </p>
              </div>
            </div>
            {feeNum > 0 && paidNum > 0 && (
              <p className="text-[10px] text-gray-400 text-center border-t border-gray-200 pt-2">
                {feeNum.toLocaleString()}원 (합의) − {netPaid.toLocaleString()}원 (순입금) = <span className={unpaid > 0 ? 'text-red-500 font-semibold' : 'text-emerald-600 font-semibold'}>{unpaid > 0 ? unpaid.toLocaleString() + '원 잔금' : '완납'}</span>
              </p>
            )}
          </div>

          {/* ★ 계약 일자 (매출 월 반영 기준) */}
          <div>
            <label className="text-[10px] text-red-600 mb-1 block font-bold">
              계약 일자 <span className="text-gray-400 font-normal">(매출 월 분류 기준 — 정확히 입력)</span>
            </label>
            <input
              type="date"
              value={contractDate}
              onChange={e => setContractDate(e.target.value)}
              className={INP + ' text-gray-800'}
            />
          </div>

          {/* 본인 매출 */}
          <div>
            <label className="text-[10px] text-blue-700 mb-1 block font-bold">본인 매출</label>
            <NumberInput value={myRevenue} onChange={setMyRevenue} className={INP} placeholder="500,000" />
          </div>

          {/* 누적 매출 (자동계산 읽기전용) */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-emerald-700">이번달 누적 매출 (자동계산)</p>
              <p className="text-[10px] text-emerald-600 mt-0.5">기존 {cumulativeBase.toLocaleString()}원 + 이번 {myRevNum.toLocaleString()}원</p>
            </div>
            <p className="text-base font-bold text-emerald-700">
              {cumulative > 0 ? cumulative.toLocaleString() + '원' : '—'}
            </p>
          </div>

          {/* 자금팀 전달 메모 (통화내용/메모와 미러링) */}
          <div>
            <label className="text-[10px] text-blue-700 mb-1 block font-bold">
              자금팀 전달 메모
              <span className="ml-1 text-[9px] text-emerald-600 font-normal">↔ 인콜일지 메모와 연동</span>
            </label>
            <textarea value={opsMemo} onChange={e => setOpsMemo(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 resize-none"
              placeholder="통화내용, 특이사항, 자금팀 전달 내용..." />
          </div>

          {/* 환불없이 진행 */}
          <label className="flex items-center gap-2.5 cursor-pointer bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
            <input type="checkbox" checked={noRefund} onChange={e => setNoRefund(e.target.checked)}
              className="w-4 h-4 rounded accent-red-500" />
            <span className={`text-xs font-semibold ${noRefund ? 'text-red-700' : 'text-gray-600'}`}>
              환불없이 진행
            </span>
            {noRefund && <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold ml-auto">환불불가</span>}
          </label>

        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2.5">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
            {saving ? '처리중...' : '계약완료 확정'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 날짜 기준 그룹핑 ───────────────────────────────────────────────────
function groupByDate(customers: Customer[], useContractDate = false): { date: string; items: Customer[] }[] {
  const map = new Map<string, Customer[]>()
  for (const c of customers) {
    const date = useContractDate
      ? (c.details?.contract_date?.slice(0, 10) || '__none__')
      : (c.details?.reception_date?.slice(0, 10) || '__none__')
    if (!map.has(date)) map.set(date, [])
    map.get(date)!.push(c)
  }
  const entries = Array.from(map.entries()).sort(([a], [b]) => {
    if (a === '__none__') return 1
    if (b === '__none__') return -1
    return b.localeCompare(a)
  })
  return entries.map(([date, items]) => ({ date, items }))
}

// ── CustomerCard ───────────────────────────────────────────────────────
interface CardProps {
  customer: Customer
  salesUsers: string[]
  opsUsers?: string[]
  userName: string
  tabType: Props['tabType']
  showOwner?: boolean
  opsUserName?: string   // 자금담당자
  opsStatus?: OpsStatus  // 자금팀 진행현황 (전송 후 읽기전용)
  cumulativeBase: number
  expandedId: string | null
  onExpand: (id: string | null) => void
  onUpdate: Props['onUpdate']
  onStatusChange: Props['onStatusChange']
  onDelete: Props['onDelete']
  onTransferToOps?: Props['onTransferToOps']
  onCeoTransfer?: Props['onCeoTransfer']
  onMarkDirect?: Props['onMarkDirect']
}

function CustomerCard({
  customer,
  salesUsers,
  userName,
  tabType,
  showOwner,
  opsUserName,
  opsStatus,
  opsUsers,
  cumulativeBase,
  expandedId,
  onExpand,
  onUpdate,
  onStatusChange,
  onDelete,
  onTransferToOps,
  onCeoTransfer,
  onMarkDirect,
}: CardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [ceoMoveOpen, setCeoMoveOpen] = useState(false)

  // 직가DB로 설정: status + is_direct 플래그 + db010_month 동시 설정
  async function setToDirectDb() {
    const thisMonth = new Date().toISOString().slice(0, 7)
    await onUpdate(c.id, {
      details: {
        is_direct: true,
        db010_month: (c.details as any)?.db010_month || thisMonth,
      },
    })
    await onStatusChange(c.id, 'db010')
  }
  // 공가DB로 되돌릴 때 직가 플래그 해제
  async function setToSupplyDb(targetStatus: 'lead' | 'db010' = 'lead') {
    if (targetStatus === 'lead') {
      await onUpdate(c.id, { details: { is_direct: false } })
    }
    await onStatusChange(c.id, targetStatus)
  }
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [quickTransferOpen, setQuickTransferOpen] = useState(false)
  const [qtCheckedGroup, setQtCheckedGroup] = useState(false)
  const [qtCheckedCoop,  setQtCheckedCoop]  = useState(false)
  const [qtLoading, setQtLoading] = useState(false)
  const [qtContractDate, setQtContractDate] = useState('')
  const [tlText, setTlText] = useState('')
  const [tradeOpen, setTradeOpen] = useState(false)
  const [logEditMode, setLogEditMode] = useState(false)
  const [logDraft, setLogDraft] = useState<Record<string, string>>({})
  const [logSaving, setLogSaving] = useState(false)
  const [emotionalOpen, setEmotionalOpen] = useState(false)
  const [emotionalMood, setEmotionalMood] = useState<'상'|'중'|'하'|''>('')
  const [meetingJournalOpen, setMeetingJournalOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const [trashReason, setTrashReason] = useState('')
  const menuRef    = useRef<HTMLDivElement>(null)
  const tradeRef   = useRef<HTMLDivElement>(null)
  const expandedRef = useRef<HTMLDivElement>(null)

  function openLogEdit() {
    const d = c.details || {} as any
    setLogDraft({
      name:               c.name || '',
      phone:              c.phone || '',
      company:            d.company || (c as any).company || '',
      region:             d.region || '',
      reception_date:     d.reception_date || '',
      business_type:      d.business_type || '',
      real_work:          d.real_work || '',
      years_in_business:  d.years_in_business || d.biz_size || '',
      employee_count:     d.employee_count || '',
      patent:             d.patent || '',
      revenue_2026:       d.revenue_2026 || '',
      revenue_2025:       d.revenue_2025 || '',
      revenue_2024:       d.revenue_2024 || '',
      revenue_2023:       d.revenue_2023 || '',
      loan_kibo:          d.loan_kibo || d.loan_policy || '',
      loan_shinbo:        d.loan_shinbo || '',
      loan_jaedan:        d.loan_jaedan || '',
      loan_jinjong:       d.loan_jinjong || '',
      loan_sojin:         d.loan_sojin || '',
      loan_other:         d.loan_other || d.loan_credit || '',
      loan_total:         d.loan_total || '',
      credit_kcb:         d.credit_kcb || d.credit_score || '',
      credit_nice:        d.credit_nice || '',
      tax_status:         d.tax_status || d.tax_delinquency || '',
      assets:             d.assets || '',
      required_funds:     d.required_funds || '',
      solution:           d.solution || '',
    })
    setLogEditMode(true)
  }

  async function saveLogEdit() {
    setLogSaving(true)
    const { name, phone, company, region, reception_date, business_type, real_work,
      years_in_business, employee_count, patent, revenue_2026, revenue_2025, revenue_2024, revenue_2023,
      loan_kibo, loan_shinbo, loan_jaedan, loan_jinjong, loan_sojin, loan_other, loan_total,
      credit_kcb, credit_nice, tax_status, assets, required_funds, solution } = logDraft
    await onUpdate(c.id, {
      name,
      phone,
      details: {
        company, region, reception_date, business_type, real_work,
        years_in_business, employee_count, patent,
        revenue_2026, revenue_2025, revenue_2024, revenue_2023,
        loan_kibo, loan_shinbo, loan_jaedan, loan_jinjong, loan_sojin, loan_other, loan_total,
        credit_kcb, credit_nice, tax_status, assets, required_funds, solution,
      },
    })
    setLogSaving(false)
    setLogEditMode(false)
  }

  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  useEffect(() => {
    if (!tradeOpen) return
    function handler(e: MouseEvent) {
      if (tradeRef.current && !tradeRef.current.contains(e.target as Node)) setTradeOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [tradeOpen])

  const c = customer
  const expanded = expandedId === c.id
  const isTransferred = !!(c.details as any)?.ops_transferred

  // 확장 패널 열리면 배경 스크롤 잠금 (iOS 호환)
  useEffect(() => {
    if (expanded) {
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
  }, [expanded])

  const leadType = c.details?.lead_type
  const ownerName = c.sales_user_name || c.details?.sales_user_name || userName
  const inspectionStatus = c.details?.inspection_status

  async function handleContractConfirm(data: Record<string, any>) {
    await onUpdate(c.id, { details: data })
    await onStatusChange(c.id, 'contracted')
    setContractModalOpen(false)
    onExpand(null)
  }

  async function handleInspectionRequest() {
    await onUpdate(c.id, {
      details: {
        inspection_status: 'pending',
        inspection_date: new Date().toISOString().slice(0, 10),
      },
    })
  }

  async function addTimelineEntry() {
    if (!tlText.trim()) return
    const entry = {
      user: userName,
      content: tlText.trim(),
      created_at: nowKST(),
    }
    const updated = [...(c.call_timeline || []), entry]
    setTlText('')
    await onUpdate(c.id, { call_timeline: updated })
  }

  async function deleteTimelineEntry(reversedIdx: number) {
    const orig = (c.call_timeline || []).length - 1 - reversedIdx
    const updated = (c.call_timeline || []).filter((_, i) => i !== orig)
    await onUpdate(c.id, { call_timeline: updated })
  }

  async function handleEmotional() {
    if (emotionalMood) {
      await onUpdate(c.id, { details: { rejection_mood: emotionalMood } })
    }
    await onStatusChange(c.id, 'emotional')
    setEmotionalOpen(false)
    onExpand(null)
  }

  async function handleTrash() {
    if (trashReason.trim()) {
      await onUpdate(c.id, { details: { self_rejection_reason: trashReason.trim() } })
    }
    await onStatusChange(c.id, 'trash')
    setTrashOpen(false)
    onExpand(null)
  }

  async function handleQuickTransfer() {
    if (!onTransferToOps) return
    setQtLoading(true)
    // 계약일자가 바뀐 경우 먼저 업데이트
    const existingDate = (c as any).details?.contract_date || ''
    if (qtContractDate && qtContractDate !== existingDate) {
      await onUpdate(c.id, { details: { contract_date: qtContractDate } })
    }
    await onTransferToOps(c)
    setQtLoading(false)
    setQuickTransferOpen(false)
    setQtCheckedGroup(false)
    setQtCheckedCoop(false)
  }

  return (
    <>
      {/* CEO 카드 이동 모달 */}
      {ceoMoveOpen && onCeoTransfer && (
        <CeoMoveModal
          customer={c}
          salesUsers={salesUsers}
          opsUsers={opsUsers || []}
          onClose={() => setCeoMoveOpen(false)}
          onConfirm={async (destPerson, destBucket, destRole) => {
            await onCeoTransfer(c.id, destPerson, destBucket, destRole)
          }}
        />
      )}

      {/* 관리팀 빠른 전송 모달 */}
      {quickTransferOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setQuickTransferOpen(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-[#1B2A45] text-sm">자금팀 전송</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">{c.company || c.name}</p>
              </div>
              <button onClick={() => setQuickTransferOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* ★ 계약일자 확인/수정 */}
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <label className="text-[10px] text-red-700 font-bold block mb-1.5">
                  계약 일자 확인 <span className="font-normal text-red-500">(매출 월 반영 기준 — 꼭 확인)</span>
                </label>
                <input
                  type="date"
                  value={qtContractDate}
                  onChange={e => setQtContractDate(e.target.value)}
                  className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300/50 text-gray-800 bg-white"
                />
              </div>
              <p className="text-[10px] text-gray-400 font-semibold">전송 전 체크리스트</p>
              <label className="flex items-center gap-3 cursor-pointer bg-emerald-50 rounded-lg px-3 py-2.5 border border-emerald-100">
                <input type="checkbox" checked={qtCheckedGroup} onChange={e => setQtCheckedGroup(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                <span className={`text-xs font-medium ${qtCheckedGroup ? 'text-emerald-700 line-through' : 'text-gray-700'}`}>단톡방 초대 완료</span>
                {qtCheckedGroup && <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full ml-auto font-bold">✓</span>}
              </label>
              <label className="flex items-center gap-3 cursor-pointer bg-emerald-50 rounded-lg px-3 py-2.5 border border-emerald-100">
                <input type="checkbox" checked={qtCheckedCoop} onChange={e => setQtCheckedCoop(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                <span className={`text-xs font-medium ${qtCheckedCoop ? 'text-emerald-700 line-through' : 'text-gray-700'}`}>업무협조 요청서 발송 완료</span>
                {qtCheckedCoop && <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full ml-auto font-bold">✓</span>}
              </label>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setQuickTransferOpen(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                취소
              </button>
              <button onClick={handleQuickTransfer} disabled={qtLoading}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {qtLoading ? '전송중...' : '자금팀 전송'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 감성톡(거절업체) 감도 선택 모달 */}
      {emotionalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setEmotionalOpen(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-[#1B2A45] text-sm">거절업체 이동</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">{c.company || c.name}</p>
              </div>
              <button onClick={() => setEmotionalOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-bold text-gray-700 mb-3">통화 감도를 선택해주세요</p>
              <div className="grid grid-cols-3 gap-2">
                {(['상', '중', '하'] as const).map(mood => (
                  <button key={mood} type="button"
                    onClick={() => setEmotionalMood(mood)}
                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                      emotionalMood === mood
                        ? mood === '상' ? 'bg-red-500 text-white border-red-500'
                          : mood === '중' ? 'bg-orange-400 text-white border-orange-400'
                          : 'bg-gray-400 text-white border-gray-400'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}>
                    감도 {mood}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setEmotionalOpen(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                취소
              </button>
              <button onClick={handleEmotional}
                disabled={!emotionalMood}
                className="flex-1 bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                거절업체로 이동
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 자체거절 사유 입력 모달 */}
      {trashOpen && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setTrashOpen(false) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-[#1B2A45] text-sm">자체거절 처리</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">{c.company || c.name}</p>
              </div>
              <button onClick={() => setTrashOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs font-bold text-gray-700 mb-2">자체거절 사유를 입력해주세요</p>
              <textarea
                value={trashReason}
                onChange={e => setTrashReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300/50 resize-none"
                placeholder="거절 사유 입력..."
                autoFocus
              />
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setTrashOpen(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                취소
              </button>
              <button onClick={handleTrash}
                disabled={!trashReason.trim()}
                className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                자체거절 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미팅일지 모달 */}
      {meetingJournalOpen && (
        <MeetingJournal
          customer={c}
          onClose={() => setMeetingJournalOpen(false)}
        />
      )}

      {/* 계약완료 모달 */}
      {contractModalOpen && (
        <ContractModal
          company={c.company || c.name}
          cumulativeBase={cumulativeBase}
          initialMemo={c.details?.result_memo || c.notes || c.memo || ''}
          initialNoRefund={c.details?.no_refund || false}
          onClose={() => setContractModalOpen(false)}
          onConfirm={handleContractConfirm}
        />
      )}

      {/* 카드 본체 */}
      <div
        className={`bg-white border rounded-xl p-2.5 cursor-pointer hover:shadow-md transition-all relative text-center ${
          expanded ? 'ring-2 ring-blue-400 border-blue-300' : 'border-gray-200 hover:border-blue-300'
        }`}
        onClick={() => onExpand(expanded ? null : c.id)}
      >
        {/* 관리팀 담당자 배지 — 전송 완료 후 우측 상단 */}
        {isTransferred && opsUserName && (
          <div className="absolute top-1 right-1" onClick={e => e.stopPropagation()}>
            <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded leading-none">
              {opsUserName}
            </span>
          </div>
        )}

        {/* 3-dot 메뉴 — 자금팀 전송 전만 표시 */}
        {!isTransferred && (
          <div
            className="absolute top-1.5 right-1.5"
            ref={menuRef}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              className="text-gray-300 hover:text-gray-600 px-1 py-0.5 rounded hover:bg-gray-100 font-bold leading-none text-sm"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-50 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[140px] py-1">
                {tabType !== 'contracted' && (
                  <button type="button" onClick={() => { setContractModalOpen(true); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-emerald-600 font-medium">
                    계약완료
                  </button>
                )}
                {tabType !== 'emotional' && (
                  <button type="button" onClick={() => { setEmotionalMood(''); setEmotionalOpen(true); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-violet-600 font-medium">
                    감성톡(거절업체)
                  </button>
                )}
                {tabType !== 'trash' && (
                  <button type="button" onClick={() => { setTrashReason(''); setTrashOpen(true); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-500 font-medium">
                    자체거절
                  </button>
                )}
                {tabType === 'db010' && (
                  <button type="button" onClick={() => { onStatusChange(c.id, 'lead'); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-blue-600 font-medium">
                    공가DB로 전송
                  </button>
                )}
                {tabType === 'lead' && (
                  <button type="button" onClick={async () => { await setToDirectDb(); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-indigo-600 font-medium">
                    직가DB로 전송
                  </button>
                )}
                {tabType !== 'lead' && tabType !== 'db010' && (
                  <>
                    <button type="button" onClick={() => { onStatusChange(c.id, 'lead'); setMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-blue-600 font-medium">
                      ↩ 공급으로 돌리기
                    </button>
                    <button type="button" onClick={async () => { await setToDirectDb(); setMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 text-indigo-600 font-medium">
                      ↩ 직접으로 돌리기
                    </button>
                  </>
                )}
                {tabType === 'contracted' && onTransferToOps && (
                  <button type="button" onClick={() => { onTransferToOps(c); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-amber-600 font-medium">
                    자금팀전송
                  </button>
                )}
                {/* 대표 전용: 카드 이동 */}
                {userName === 'ceo' && onCeoTransfer && (
                  <>
                    <div className="border-t border-gray-100 my-0.5" />
                    <button type="button" onClick={() => { setCeoMoveOpen(true); setMenuOpen(false) }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 text-amber-600 font-semibold">
                      DB 이동
                    </button>
                  </>
                )}
                {/* 대표 전용: 공가→직가 전환 */}
                {userName === 'ceo' && onMarkDirect && !(c.details as any)?.is_direct && (
                  <>
                    <div className="border-t border-gray-100 my-0.5" />
                    <button type="button" onClick={async () => {
                      if (confirm(`"${(c.details as any)?.company || c.company || c.name}" 업체를 직가로 전환하시겠습니까?\n\n전환 후 결제율 탭에서 해당 직원 공급수를 -1 해주세요.`)) {
                        await onMarkDirect(c.id)
                        setMenuOpen(false)
                      }
                    }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-violet-50 text-violet-600 font-semibold">
                      직가로 전환
                    </button>
                  </>
                )}
                <div className="border-t border-gray-100 my-0.5" />
                <button type="button"
                  onClick={() => { if (confirm('삭제하시겠습니까?')) { onDelete(c.id); setMenuOpen(false) } }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-500 font-medium">
                  삭제
                </button>
              </div>
            )}
          </div>
        )}

        {/* 현재 탭 위치 뱃지 */}
        {(() => {
          const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
            db010:      { label: '직가DB',   cls: 'bg-violet-100 text-violet-700' },
            lead:       { label: '공가DB',   cls: 'bg-sky-100 text-sky-700' },
            consulting: { label: '공가DB',   cls: 'bg-sky-100 text-sky-700' },
            contracted: { label: '계약업체', cls: 'bg-emerald-100 text-emerald-700' },
            emotional:  { label: '거절업체', cls: 'bg-pink-100 text-pink-700' },
            trash:      { label: '자체거절', cls: 'bg-gray-100 text-gray-500' },
          }
          const badge = STATUS_BADGE[c.status]
          return badge ? (
            <div className="mb-1 flex justify-center gap-1">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>
                {badge.label}
              </span>
              {leadType && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${leadType === '직가' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {leadType}
                </span>
              )}
            </div>
          ) : leadType ? (
            <div className="mb-1 flex justify-center">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${leadType === '직가' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                {leadType}
              </span>
            </div>
          ) : null
        })()}

        {/* 업체명 — 긴 이름 줄바꿈 */}
        <p className="font-bold text-[#1B2A45] text-[11px] leading-snug px-1 break-all"
          style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
          {c.company || c.name}
        </p>
        {/* 대표자 */}
        <p className="text-[10px] text-gray-400 mt-0.5 truncate px-1">{c.name}</p>
        {/* 전화번호 */}
        <p className="text-[9px] text-gray-400 mt-0.5 font-mono truncate px-1">{formatPhone(c.phone || '')}</p>

        {/* 감도 — contracted(계약업체)에서는 숨김 */}
        {c.details?.sensitivity && tabType !== 'contracted' && (
          <div className="mt-1.5 flex justify-center w-full">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              c.details.sensitivity === '상' ? 'bg-red-100 text-red-600' :
              c.details.sensitivity === '중' ? 'bg-orange-100 text-orange-600' :
              'bg-gray-100 text-gray-500'
            }`}>감도 {c.details.sensitivity}</span>
          </div>
        )}

        {/* 거절업체 감도 — emotional 탭: 클릭으로 변경 가능 */}
        {tabType === 'emotional' && (
          <div className="mt-1 flex gap-0.5 justify-center w-full" onClick={e => e.stopPropagation()}>
            {(['상', '중', '하'] as const).map(m => (
              <button key={m} type="button"
                onClick={() => onUpdate(c.id, { details: { rejection_mood: c.details?.rejection_mood === m ? '' : m } })}
                className={`text-[8px] font-bold px-1 py-0.5 rounded transition-colors ${
                  c.details?.rejection_mood === m
                    ? m === '상' ? 'bg-red-500 text-white'
                      : m === '중' ? 'bg-orange-400 text-white'
                      : 'bg-gray-400 text-white'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}>{m}</button>
            ))}
          </div>
        )}
        {tabType === 'db010' && (
          <div className="mt-1 flex gap-0.5 justify-center w-full" onClick={e => e.stopPropagation()}>
            {(['상', '중', '하'] as const).map(m => (
              <button key={m} type="button"
                onClick={() => onUpdate(c.id, { details: { sensitivity: c.details?.sensitivity === m ? '' : m } })}
                className={`text-[8px] font-bold px-1 py-0.5 rounded transition-colors ${
                  c.details?.sensitivity === m
                    ? m === '상' ? 'bg-red-500 text-white'
                      : m === '중' ? 'bg-orange-400 text-white'
                      : 'bg-gray-400 text-white'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}>{m}</button>
            ))}
          </div>
        )}
        {tabType !== 'emotional' && tabType !== 'db010' && tabType !== 'contracted' && c.details?.rejection_mood && (
          <div className="mt-1 flex justify-center w-full">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              c.details.rejection_mood === '상' ? 'bg-red-100 text-red-600' :
              c.details.rejection_mood === '중' ? 'bg-orange-100 text-orange-600' :
              'bg-gray-100 text-gray-500'
            }`}>감도 {c.details.rejection_mood}</span>
          </div>
        )}

        {/* 자체거절 사유 */}
        {c.details?.self_rejection_reason && (
          <p className="mt-1 text-[9px] text-gray-400 leading-tight text-center px-1 line-clamp-2" style={{ wordBreak: 'break-all' }}>
            {c.details.self_rejection_reason}
          </p>
        )}

        {/* 결정전 결과 + 클로징 결과 — 레이블 포함 2열 */}
        <div className="mt-1.5 grid grid-cols-2 gap-1 w-full" onClick={e => e.stopPropagation()}>
          <div className="flex flex-col items-center gap-0.5 min-w-0">
            <span className="text-[9px] text-gray-400 font-medium leading-none">결정전</span>
            <BadgeDropdown
              value={c.details?.call_result || ''}
              options={CALL_RESULTS}
              onChange={(val) => onUpdate(c.id, { details: { call_result: val } })}
            />
          </div>
          <div className="flex flex-col items-center gap-0.5 min-w-0">
            <span className="text-[9px] text-gray-400 font-medium leading-none">클로징</span>
            <BadgeDropdown
              value={c.details?.closing_result || ''}
              options={CLOSING_RESULTS}
              onChange={(val) => onUpdate(c.id, { details: { closing_result: val } })}
            />
          </div>
        </div>

        {/* 재통화 일정 마크 */}
        {c.details?.follow_up_date && (
          <div className="mt-1.5 flex justify-center w-full">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold max-w-full text-center leading-tight ${
              c.details.follow_up_date === new Date().toISOString().slice(0, 10)
                ? 'bg-sky-500 text-white animate-pulse'
                : 'bg-sky-100 text-sky-700'
            }`}>
              {c.details.follow_up_date.slice(5)}
            </span>
          </div>
        )}

        {/* 계약일자 표시 (contracted 탭) */}
        {tabType === 'contracted' && (
          <p className="text-[9px] text-emerald-600 font-semibold mt-1">
            {(c as any).details?.contract_date ? (c as any).details.contract_date.slice(0, 10) : '계약일 미입력'}
          </p>
        )}

        {/* 계약업체 전송 빠른버튼 / 전송 후 진행현황 배지 */}
        {tabType === 'contracted' && !isTransferred && onTransferToOps && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              setQtContractDate((c as any).details?.contract_date || new Date().toISOString().slice(0, 10))
              setQuickTransferOpen(true)
            }}
            className="mt-1.5 w-full text-[9px] bg-amber-500 hover:bg-amber-600 text-white rounded py-1 font-semibold transition-colors"
          >
            자금팀 전송
          </button>
        )}
        {tabType === 'contracted' && isTransferred && (
          <div className="mt-1.5 space-y-1">
            {opsStatus?.stage ? (
              <span className={`block w-full text-center text-[9px] font-bold px-1 py-0.5 rounded ${getOpsStageStyle(opsStatus.stage).bg}`}>
                {getOpsStageStyle(opsStatus.stage).label}
              </span>
            ) : (
              <span className="block w-full text-center text-[9px] text-emerald-600 font-semibold">자금팀 전송완료</span>
            )}
            {opsStatus?.institution && (
              <p className="text-[8px] text-gray-400 text-center truncate">{opsStatus.institution}</p>
            )}
          </div>
        )}
      </div>

      {/* ── 확장 패널 (fixed 오버레이) ── */}
      {expanded && (
        <>
          {/* 배경 오버레이 */}
          <div className="fixed inset-0 bg-black/40 z-[199]" onClick={() => onExpand(null)} />
          {/* 우측 슬라이딩 패널 */}
          <div ref={expandedRef} className="fixed top-0 right-0 bottom-0 w-full md:w-[680px] bg-[#FAFAF8] z-[200] overflow-y-auto shadow-2xl">

          {/* 상단 액션 바 */}
          <div className="sticky top-0 flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 bg-white z-10">
            <span className="text-xs font-bold text-[#1B2A45] mr-2">
              {c.details?.company || c.company || c.name}
            </span>
            {/* 자금팀 전송 후: 액션 버튼 모두 숨김 */}
            {!isTransferred && (
              <>
                {tabType !== 'contracted' && (
                  <button type="button" onClick={() => setContractModalOpen(true)}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-500 text-white hover:bg-emerald-600">
                    계약완료
                  </button>
                )}
                {tabType !== 'emotional' && (
                  <button type="button" onClick={() => { setEmotionalMood(''); setEmotionalOpen(true) }}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-violet-500 text-white">
                    감성톡(거절업체)
                  </button>
                )}
                {tabType !== 'trash' && (
                  <button type="button" onClick={() => { setTrashReason(''); setTrashOpen(true) }}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-gray-400 text-white">
                    자체거절
                  </button>
                )}
                {tabType === 'db010' && (
                  <button type="button" onClick={() => { onStatusChange(c.id, 'lead'); onExpand(null) }}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-700">
                    공가DB로 전송
                  </button>
                )}
                {tabType === 'lead' && (
                  <button type="button" onClick={async () => { await setToDirectDb(); onExpand(null) }}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700">
                    직가DB로 전송
                  </button>
                )}
                {tabType !== 'lead' && tabType !== 'db010' && (
                  <>
                    <button type="button" onClick={async () => { await setToSupplyDb('lead'); onExpand(null) }}
                      className="px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-500 text-white hover:bg-blue-600">
                      ↩ 공급
                    </button>
                    <button type="button" onClick={async () => { await setToDirectDb(); onExpand(null) }}
                      className="px-2.5 py-1 rounded text-[11px] font-semibold bg-indigo-500 text-white hover:bg-indigo-600">
                      ↩ 직접
                    </button>
                  </>
                )}
                {/* DB 트레이드 */}
                <div className="relative" ref={tradeRef}>
                  <button type="button" onClick={() => setTradeOpen(v => !v)}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-sky-500 hover:bg-sky-600 text-white">
                    DB 트레이드
                  </button>
                  {tradeOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 py-1 z-50 min-w-[160px]">
                      <p className="text-[10px] text-gray-400 px-3 py-1.5 font-semibold border-b border-gray-50">담당자 변경</p>
                      {salesUsers.filter(u => u !== (c.sales_user_name || c.details?.sales_user_name)).map(u => (
                        <button key={u} type="button"
                          onClick={() => {
                            onUpdate(c.id, { details: {
                              sales_user_name: u,
                              trade_from: c.sales_user_name || c.details?.sales_user_name || '',
                              trade_date: new Date().toISOString().slice(0, 10),
                            }})
                            setTradeOpen(false)
                          }}
                          className="w-full text-left px-3 py-2.5 text-xs hover:bg-sky-50 text-sky-700 font-semibold flex items-center gap-2">
                          <span className="text-gray-300 text-[10px]">→</span> {u}
                        </button>
                      ))}
                      {salesUsers.filter(u => u !== (c.sales_user_name || c.details?.sales_user_name)).length === 0 && (
                        <p className="text-[11px] text-gray-400 px-3 py-2 italic">다른 영업사원 없음</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
            {/* 자금팀 전송됨 알림 */}
            {isTransferred && opsStatus?.stage && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getOpsStageStyle(opsStatus.stage).bg}`}>
                {getOpsStageStyle(opsStatus.stage).label}
              </span>
            )}
            {/* 대표 전용: 직가 전환 (전송 여부 상관없이 항상 표시) */}
            {userName === 'ceo' && onMarkDirect && !(c.details as any)?.is_direct && (
              <button type="button"
                onClick={async () => {
                  if (confirm(`"${(c.details as any)?.company || c.company || c.name}" 업체를\n직가로 전환하시겠습니까?\n\n공급결제 → 직접결제로 즉시 재계산됩니다.\n결제율 탭에서 해당 직원 공급수를 -1 해주세요.`)) {
                    await onMarkDirect(c.id)
                    onExpand(null)
                  }
                }}
                className="px-2.5 py-1 rounded text-[11px] font-semibold bg-violet-600 hover:bg-violet-700 text-white">
                직가 전환
              </button>
            )}
            {/* 미팅일지 출력 버튼 */}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setMeetingJournalOpen(true) }}
              className="ml-auto px-2.5 py-1 rounded text-[11px] font-semibold bg-[#C5A258] hover:bg-[#b8923f] text-white flex items-center gap-1"
            >
              미팅일지
            </button>
            <button type="button" onClick={() => onExpand(null)}
              className="text-gray-400 hover:text-gray-600 text-sm font-bold px-1">✕</button>
          </div>

          {/* 좌/우 2단 패널 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-200">

            {/* ── 좌측: 인콜일지 ── */}
            <div className="p-4 flex flex-col">
              {/* 헤더 + 수정 버튼 (자금팀 전송 전만) */}
              <div className="flex items-center justify-between mb-2 shrink-0">
                <p className="text-[10px] font-bold text-[#1B2A45] uppercase tracking-wide">인콜일지</p>
                {!isTransferred && (
                  <button type="button" onClick={logEditMode ? () => setLogEditMode(false) : openLogEdit}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold transition-colors ${
                      logEditMode
                        ? 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                        : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                    }`}>
                    {logEditMode ? '✕ 취소' : '수정'}
                  </button>
                )}
                {isTransferred && (
                  <span className="text-[9px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">읽기전용</span>
                )}
              </div>
              {/* 스크롤 영역 */}
              <div className="flex-1 overflow-y-auto min-h-0">

              {/* ① 직가/공가 — 최상단 (항상 표시) */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-[#1B2A45] to-sky-800 border border-transparent rounded-lg px-2.5 py-2 mb-2 shadow-sm">
                <span className="w-20 shrink-0 text-[10px] text-white font-bold">직가/공가</span>
                <div className="flex gap-1.5">
                  {['직가', '공가'].map(opt => (
                    <button key={opt} type="button"
                      onClick={() => onUpdate(c.id, { details: { lead_type: leadType === opt ? '' : opt } })}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                        leadType === opt
                          ? opt === '직가' ? 'bg-blue-400 text-white border-blue-400' : 'bg-amber-400 text-white border-amber-400'
                          : 'bg-white/10 text-white/60 border-white/20 hover:bg-white/20'
                      }`}>{opt}</button>
                  ))}
                </div>
              </div>

              {logEditMode ? (
                /* ── 편집 모드: 인풋 폼 ── */
                <div className="grid grid-cols-1 gap-1">
                  {([
                    { label: '업체명',    key: 'company',          isKey: true },
                    { label: '대표자',    key: 'name',             isKey: true },
                    { label: '연락처',    key: 'phone',            isKey: true },
                    { label: '지역',      key: 'region' },
                    { label: '접수일',    key: 'reception_date' },
                    { label: '업종',      key: 'business_type',    isKey: true },
                    { label: '실제업무',  key: 'real_work',        isKey: true },
                    { label: '업력',      key: 'years_in_business' },
                    { label: '직원수',    key: 'employee_count' },
                    { label: '특허',      key: 'patent' },
                    { label: '26년매출',  key: 'revenue_2026' },
                    { label: '25년매출',  key: 'revenue_2025',     isKey: true },
                    { label: '24년매출',  key: 'revenue_2024' },
                    { label: '23년매출',  key: 'revenue_2023' },
                    { label: '기보대출',  key: 'loan_kibo' },
                    { label: '신보대출',  key: 'loan_shinbo' },
                    { label: '재단대출',  key: 'loan_jaedan' },
                    { label: '중진공',    key: 'loan_jinjong' },
                    { label: '소진공',    key: 'loan_sojin' },
                    { label: '신용/담보', key: 'loan_other' },
                    { label: '기대출합계',key: 'loan_total' },
                    { label: 'KCB점수',   key: 'credit_kcb' },
                    { label: 'NICE점수',  key: 'credit_nice',      isKey: true },
                    { label: '세금체납',  key: 'tax_status' },
                    { label: '자산',      key: 'assets' },
                    { label: '필요자금',  key: 'required_funds',   isKey: true },
                    { label: '솔루션',    key: 'solution' },
                  ] as { label: string; key: string; isKey?: boolean }[]).map(({ label, key, isKey }) => (
                    <div key={key} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${
                      isKey ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-gray-100'
                    }`}>
                      <span className={`w-20 shrink-0 text-[10px] font-bold ${isKey ? 'text-blue-800' : 'text-blue-600'}`}>{label}</span>
                      <input
                        type="text"
                        value={key === 'phone' ? autoHyphenPhone(logDraft[key] || '') : (logDraft[key] || '')}
                        onChange={e => setLogDraft(prev => ({ ...prev, [key]: key === 'phone' ? autoHyphenPhone(e.target.value) : e.target.value }))}
                        className="flex-1 text-xs bg-transparent border-0 border-b border-gray-300 focus:border-blue-400 focus:outline-none py-0.5 text-gray-800 placeholder:text-gray-300"
                        placeholder={key === 'phone' ? '010-0000-0000' : '—'}
                      />
                    </div>
                  ))}

                  {/* 혁신요건 — 항상 인터랙티브 */}
                  <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-2">
                    <span className="w-20 shrink-0 text-[10px] text-violet-800 font-bold pt-1">혁신요건</span>
                    <div className="flex-1">
                      <InnovationSelect
                        value={c.details?.innovation || ''}
                        onChange={v => onUpdate(c.id, { details: { innovation: v } })}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* ── 읽기 모드 ── */
                <div className="grid grid-cols-1 gap-1">
                  {buildLogFields(c).map(({ label, value }) => {
                    const isEmpty = !value || !String(value).trim()
                    const isKey = KEY_LABELS.has(label)
                    return (
                      <div key={label} className={`flex items-start gap-2 rounded-lg px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
                        isKey ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-gray-100'
                      }`}>
                        <span className={`w-20 shrink-0 text-[10px] font-bold pt-0.5 ${isKey ? 'text-blue-800' : 'text-blue-600'}`}>{label}</span>
                        <span className={`text-xs flex-1 break-words ${isEmpty ? 'text-gray-300 italic' : isKey ? 'text-gray-900 font-semibold' : 'text-gray-700 font-medium'}`}>
                          {isEmpty ? '—' : label === '연락처' ? formatPhone(String(value)) : String(value)}
                        </span>
                      </div>
                    )
                  })}

                  {/* 혁신요건 — 인터랙티브 */}
                  <div className="flex items-start gap-2 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <span className="w-20 shrink-0 text-[10px] text-violet-800 font-bold pt-1">혁신요건</span>
                    <div className="flex-1">
                      <InnovationSelect
                        value={c.details?.innovation || ''}
                        onChange={v => onUpdate(c.id, { details: { innovation: v } })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 통화내용 + 메모 미러링 */}
              <div className="bg-white border border-gray-100 rounded-lg px-2.5 py-2 mt-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-blue-700">통화내용 / 메모</p>
                  <span className="text-[9px] text-emerald-600">↔ 자금팀 전달메모와 연동</span>
                </div>
                <ResultMemoField
                  value={c.details?.result_memo || c.notes || c.memo || ''}
                  onChange={(val) => onUpdate(c.id, { details: { result_memo: val } })}
                />
              </div>
              </div>{/* end scroll area */}
              {/* ── 하단 버튼 바: 자금팀 전송 전만 표시 ── */}
              {!isTransferred && (
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100 shrink-0">
                  <button type="button" onClick={saveLogEdit} disabled={logSaving || !logEditMode}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      logEditMode
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    }`}>
                    {logSaving ? '저장중…' : '저장'}
                  </button>
                  <button type="button"
                    onClick={() => { if (confirm('이 고객을 삭제하시겠습니까?')) { onDelete(c.id); onExpand(null) } }}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-red-50 text-red-400 hover:bg-red-100 border border-red-100 transition-colors">
                    삭제
                  </button>
                </div>
              )}
            </div>

            {/* ── 우측: 인콜결과 또는 자금팀 현황 ── */}
            <div className="p-4 space-y-4">
              {/* 담당자 (자동 - 읽기 전용) */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                  {isTransferred ? '자금팀 진행현황' : '인콜결과'}
                </p>
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                  담당: {c.sales_user_name || c.details?.sales_user_name || userName}
                </span>
              </div>

              {/* ── 자금팀 전송 후: 진행현황 표시 (읽기전용) ── */}
              {isTransferred && (
                <div className="space-y-3">
                  {/* 현재 단계 */}
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <label className="text-[10px] text-blue-700 mb-1.5 block font-bold">현재 진행단계</label>
                    {opsStatus?.stage ? (
                      <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${getOpsStageStyle(opsStatus.stage).bg}`}>
                        {getOpsStageStyle(opsStatus.stage).label}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 italic">자금팀 업데이트 대기중</span>
                    )}
                  </div>

                  {/* 신청 기관 */}
                  {opsStatus?.institution && (
                    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                      <label className="text-[10px] text-blue-700 mb-1 block font-bold">신청 기관</label>
                      <p className="text-xs font-semibold text-gray-800">{opsStatus.institution}</p>
                    </div>
                  )}

                  {/* 자금팀 메모 */}
                  {opsStatus?.memo && (
                    <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                      <label className="text-[10px] text-blue-700 mb-1 block font-bold">자금팀 메모</label>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{opsStatus.memo}</p>
                    </div>
                  )}

                  {/* 환불/종료 예정 안내 */}
                  {opsStatus?.stage && ['환불예정', '종료예정', '환불', '종료', '완료'].includes(opsStatus.stage) && (
                    <div className={`rounded-xl p-3 border text-xs font-semibold ${
                      ['환불', '환불예정'].includes(opsStatus.stage)
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-orange-50 border-orange-200 text-orange-700'
                    }`}>
                      {opsStatus.stage === '환불예정' && '환불 진행 예정 — 대표 승인 대기중입니다'}
                      {opsStatus.stage === '환불'     && '환불 처리가 완료되었습니다'}
                      {opsStatus.stage === '종료예정' && '종료 예정 — 대표 승인 대기중입니다'}
                      {(opsStatus.stage === '종료' || opsStatus.stage === '완료') && '업무가 종료되었습니다'}
                    </div>
                  )}

                  {/* 아직 진행정보 없음 */}
                  {!opsStatus?.stage && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-center">
                      <p className="text-xs text-amber-700 font-semibold">자금팀으로 전송 완료</p>
                      <p className="text-[10px] text-amber-500 mt-0.5">자금팀에서 진행사항을 업데이트하면 여기에 표시됩니다</p>
                    </div>
                  )}
                </div>
              )}

              {/* 자금팀 전송 전: 기존 인콜결과 섹션 */}
              {!isTransferred && (
                <>
                  {/* 결정전 결과 */}
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <label className="text-[10px] text-blue-700 mb-1.5 block font-bold">결정전 결과</label>
                    <BadgeDropdown
                      value={c.details?.call_result || ''}
                      options={CALL_RESULTS}
                      onChange={(val) => onUpdate(c.id, { details: { call_result: val } })}
                    />
                  </div>

                  {/* 클로징 결과 */}
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <label className="text-[10px] text-blue-700 mb-1.5 block font-bold">클로징 결과</label>
                    <BadgeDropdown
                      value={c.details?.closing_result || ''}
                      options={CLOSING_RESULTS}
                      onChange={(val) => onUpdate(c.id, { details: { closing_result: val } })}
                    />
                  </div>

                  {/* ★ 계약 일자 (contracted 탭) */}
                  {tabType === 'contracted' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                      <label className="text-[10px] text-red-700 mb-1.5 block font-bold">
                        계약 일자 <span className="text-red-400 font-normal">(매출 월 기준 — 수정 가능)</span>
                      </label>
                      <input
                        type="date"
                        value={(c as any).details?.contract_date || ''}
                        onChange={e => onUpdate(c.id, { details: { contract_date: e.target.value } })}
                        className="w-full border border-red-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400/50 text-gray-800 bg-white"
                      />
                      {!(c as any).details?.contract_date && (
                        <p className="text-[9px] text-red-500 mt-1 font-medium">계약일 미입력 — 반드시 입력해야 해당 월 매출에 반영됩니다</p>
                      )}
                    </div>
                  )}

                  {/* 직가DB 감도 — db010 탭 전용 */}
                  {tabType === 'db010' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                      <label className="text-[10px] text-blue-700 mb-2 block font-bold">감도 설정</label>
                      <div className="flex gap-2">
                        {(['상', '중', '하'] as const).map(m => (
                          <button key={m} type="button"
                            onClick={() => onUpdate(c.id, { details: { sensitivity: c.details?.sensitivity === m ? '' : m } })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                              c.details?.sensitivity === m
                                ? m === '상' ? 'bg-red-500 text-white border-red-500'
                                  : m === '중' ? 'bg-orange-400 text-white border-orange-400'
                                  : 'bg-gray-400 text-white border-gray-400'
                                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                            }`}>
                            감도 {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 감성톡 감도 — emotional 탭 전용 */}
                  {tabType === 'emotional' && (
                    <div className="bg-pink-50 border border-pink-200 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                      <label className="text-[10px] text-pink-700 mb-2 block font-bold">감도 설정</label>
                      <div className="flex gap-2">
                        {(['상', '중', '하'] as const).map(m => (
                          <button key={m} type="button"
                            onClick={() => onUpdate(c.id, { details: { rejection_mood: c.details?.rejection_mood === m ? '' : m } })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                              c.details?.rejection_mood === m
                                ? m === '상' ? 'bg-red-500 text-white border-red-500'
                                  : m === '중' ? 'bg-orange-400 text-white border-orange-400'
                                  : 'bg-gray-400 text-white border-gray-400'
                                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                            }`}>
                            감도 {m}
                          </button>
                        ))}
                      </div>
                      {!c.details?.rejection_mood && (
                        <p className="text-[9px] text-pink-500 mt-1.5 font-medium">감도 미설정 — 그룹 분류를 위해 선택해주세요</p>
                      )}
                    </div>
                  )}

                  {/* 재통화 일정 */}
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <label className="text-[10px] text-blue-700 mb-1.5 block font-bold">재통화 일정</label>
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={c.details?.follow_up_date || ''}
                        onChange={e => onUpdate(c.id, { details: { follow_up_date: e.target.value } })}
                        className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/50 text-gray-800"
                      />
                      <input
                        type="time"
                        value={c.details?.follow_up_time || ''}
                        onChange={e => onUpdate(c.id, { details: { follow_up_time: e.target.value } })}
                        className="w-28 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/50 text-gray-800"
                      />
                    </div>
                  </div>

                  {/* 미팅 일정 */}
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <label className="text-[10px] text-violet-700 mb-1.5 block font-bold">미팅 일정</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="date"
                        value={c.details?.meeting_date || ''}
                        onChange={e => onUpdate(c.id, { details: { meeting_date: e.target.value } })}
                        className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/50 text-gray-800"
                      />
                      <input
                        type="time"
                        value={c.details?.meeting_time || ''}
                        onChange={e => onUpdate(c.id, { details: { meeting_time: e.target.value } })}
                        className="w-28 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/50 text-gray-800"
                      />
                    </div>
                    <input
                      type="text"
                      value={c.details?.meeting_memo || ''}
                      onChange={e => onUpdate(c.id, { details: { meeting_memo: e.target.value } })}
                      placeholder="메모 (장소, 내용 등)"
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/50 text-gray-800"
                    />
                    {c.details?.meeting_date && (
                      <button type="button"
                        onClick={() => onUpdate(c.id, { details: { meeting_date: '', meeting_time: '', meeting_memo: '' } })}
                        className="text-[10px] text-red-400 hover:text-red-600 mt-1.5">미팅 일정 삭제</button>
                    )}
                  </div>

                  {/* A/S 요청 + 심사 요청 */}
                  <div className="flex flex-wrap items-center gap-2">
                    {c.details?.as_not_applicable ? (
                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                        A/S비해당 {c.details.as_not_applicable_date ? `(${c.details.as_not_applicable_date})` : ''}
                      </span>
                    ) : c.details?.as_approved ? (
                      <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                        A/S완료 {c.details.as_approve_date ? `(${c.details.as_approve_date})` : ''}
                      </span>
                    ) : c.details?.as_requested ? (
                      <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                        A/S 요청됨 {c.details.as_request_date ? `(${c.details.as_request_date})` : ''}
                      </span>
                    ) : (
                      <button type="button"
                        onClick={() => onUpdate(c.id, { details: {
                          as_requested: true,
                          as_request_date: new Date().toISOString().slice(0, 10),
                        }})}
                        className="inline-flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
                      >
                        A/S 요청
                      </button>
                    )}
                    {(tabType === 'lead' || tabType === 'db010') && (
                      inspectionStatus === 'pending' ? (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                          심사요청 중
                        </span>
                      ) : inspectionStatus === 'approved' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                          심사완료
                        </span>
                      ) : inspectionStatus === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                          심사 반려
                        </span>
                      ) : (
                        <button type="button" onClick={handleInspectionRequest}
                          className="inline-flex items-center gap-1 bg-violet-500 hover:bg-violet-600 text-white px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
                        >
                          심사 요청
                        </button>
                      )
                    )}
                  </div>

                  {/* 타임라인 */}
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <p className="text-[10px] font-bold text-blue-700 mb-2">타임라인</p>
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={tlText}
                        onChange={e => setTlText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTimelineEntry() } }}
                        placeholder="기록 입력 후 Enter…"
                        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                      />
                      <button
                        type="button"
                        onClick={addTimelineEntry}
                        disabled={!tlText.trim()}
                        className="shrink-0 bg-[#1B2A45] hover:bg-[#243959] disabled:opacity-40 text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        추가
                      </button>
                    </div>
                    {c.call_timeline && c.call_timeline.length > 0 ? (
                      <div className="space-y-2">
                        {(c.call_timeline as any[]).slice().reverse().map((entry: any, i: number) => {
                          const { date, time } = formatKST(entry.created_at || '')
                          const initials = entry.user ? entry.user.slice(-2) : '??'
                          return (
                            <div key={i} className="flex gap-2.5 group">
                              <div className="shrink-0 w-6 h-6 rounded-full bg-[#1B2A45] flex items-center justify-center mt-0.5">
                                <span className="text-[9px] font-bold text-white">{initials}</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-[#1B2A45]">{entry.user || '—'}</span>
                                  <span className="text-[9px] text-gray-300">·</span>
                                  <span className="text-[9px] font-mono text-gray-400">{date}</span>
                                  <span className="text-[9px] font-mono text-gray-400">{time}</span>
                                </div>
                                <p className="text-[11px] text-gray-600 whitespace-pre-wrap leading-relaxed mt-0.5">{entry.content}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => { if (confirm('이 기록을 삭제하시겠습니까?')) deleteTimelineEntry(i) }}
                                className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all text-xs px-1 py-0.5 rounded self-start mt-0.5"
                                title="삭제"
                              >✕</button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-300 italic text-center py-3">기록 없음</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          </div>{/* fixed panel */}
        </>
      )}
    </>
  )
}

// ── Main InCallTableView ───────────────────────────────────────────────
export default function InCallTableView({
  customers,
  allCustomers = [],
  opsContracts = [],
  opsStatusMap = {},
  tabType,
  salesUsers,
  opsUsers,
  userName,
  onUpdate,
  onStatusChange,
  onDelete,
  onTransferToOps,
  onCeoTransfer,
  onMarkDirect,
  showOwner = false,
  groupBy = 'date',
  scrollToId,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // scrollToId가 바뀌면 해당 카드로 스크롤 + 펼치기
  useEffect(() => {
    if (!scrollToId) return
    setExpandedId(scrollToId)
    // 렌더링 후 스크롤
    const timer = setTimeout(() => {
      const el = document.getElementById(`ccard-${scrollToId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // 노란 highlight 효과
        el.classList.add('ring-2', 'ring-[#C5A258]', 'ring-offset-1')
        setTimeout(() => el.classList.remove('ring-2', 'ring-[#C5A258]', 'ring-offset-1'), 2500)
      }
    }, 120)
    return () => clearTimeout(timer)
  }, [scrollToId])

  const isMoodGroup = tabType === 'emotional' || (tabType === 'db010' && groupBy === 'mood')

  const groups = tabType === 'emotional'
    ? (['상', '중', '하', ''] as const).map(mood => ({
        date: mood || '__none__',
        items: customers.filter(c => (c.details?.rejection_mood || '') === mood),
      })).filter(g => g.items.length > 0)
    : (tabType === 'db010' && groupBy === 'mood')
    ? (['상', '중', '하', ''] as const).map(mood => ({
        date: mood || '__none__',
        items: customers.filter(c => (c.details?.sensitivity || '') === mood),
      })).filter(g => g.items.length > 0)
    : groupByDate(customers, tabType === 'contracted')

  if (customers.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400 text-sm shadow-sm">
        데이터가 없습니다
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map(({ date, items }) => {
        const display = isMoodGroup
          ? date === '__none__' ? '감도 미설정'
            : date === '상' ? '감도 상'
            : date === '중' ? '감도 중'
            : '감도 하'
          : date === '__none__'
          ? '날짜 미정'
          : `${date.slice(0, 7).replace('-', '년 ')}월  ${date.slice(8, 10)}일`

        return (
          <div key={date}>
            {/* 그룹 헤더 */}
            <div className="flex items-center gap-2 px-1 mb-2">
              <span className="text-[10px] font-bold text-[#1B2A45]/60 tracking-wide">{display}</span>
              <span className="text-[10px] text-gray-400">{items.length}건</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* 8열 카드 그리드 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {items.map(c => {
                const ownerName = c.sales_user_name || c.details?.sales_user_name || userName
                const cumBase = calcMonthlyRevenue(allCustomers, ownerName)
                const opsContract = opsContracts?.find(ct => ct.customer_id === c.id)
                const opsUserName = opsContract?.ops_user_name
                return (
                  <div key={c.id} id={`ccard-${c.id}`} className="rounded-xl transition-all duration-300">
                    <CustomerCard
                      customer={c}
                      salesUsers={salesUsers}
                      opsUsers={opsUsers}
                      userName={userName}
                      tabType={tabType}
                      showOwner={showOwner}
                      opsUserName={opsUserName}
                      opsStatus={opsStatusMap[c.id]}
                      cumulativeBase={cumBase}
                      expandedId={expandedId}
                      onExpand={setExpandedId}
                      onUpdate={onUpdate}
                      onStatusChange={onStatusChange}
                      onDelete={onDelete}
                      onTransferToOps={onTransferToOps}
                      onCeoTransfer={onCeoTransfer}
                      onMarkDirect={onMarkDirect}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
