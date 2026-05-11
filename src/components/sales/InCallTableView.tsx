'use client'

import { useState, useRef, useEffect } from 'react'

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

export interface Props {
  customers: Customer[]
  tabType: 'db010' | 'lead' | 'contracted' | 'emotional' | 'trash'
  salesUsers: string[]
  userName: string
  onUpdate: (id: string, patch: Record<string, any>) => Promise<void>
  onStatusChange: (id: string, newStatus: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onTransferToOps?: (customer: Customer) => Promise<void>
  showOwner?: boolean
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

// 인콜일지 필드 목록
function buildLogFields(c: Customer) {
  return [
    { label: '업체명',    value: c.details?.company || c.company },
    { label: '대표자',    value: c.name },
    { label: '연락처',    value: c.phone },
    { label: '지역',      value: c.details?.region },
    { label: '접수일',    value: c.details?.reception_date },
    { label: '업종',      value: c.details?.business_type },
    { label: '실제업무',  value: c.details?.real_work },
    { label: '업력',      value: c.details?.years_in_business || c.details?.biz_size },
    { label: '직원수',    value: c.details?.employee_count },
    { label: '혁신요건',  value: c.details?.innovation },
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
}

function BadgeDropdown({ value, options, onChange }: BadgeDropdownProps) {
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
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer select-none whitespace-nowrap ${current.color}`}
      >
        {current.key || '—'}
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[110px] py-1">
          {options.map(opt => (
            <button
              key={opt.key || '__empty__'}
              type="button"
              onClick={() => { onChange(opt.key); setOpen(false) }}
              className="w-full text-left px-3 py-1.5 text-[11px] font-semibold hover:bg-gray-50 flex items-center gap-2"
            >
              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${opt.color}`}>
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
  onClose: () => void
  onConfirm: (data: Record<string, any>) => Promise<void>
}

function ContractModal({ company, onClose, onConfirm }: ContractModalProps) {
  const [contractFee, setContractFee] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [vatIncluded, setVatIncluded] = useState(false)
  const [myRevenue, setMyRevenue] = useState('')
  const [cumulativeRevenue, setCumulativeRevenue] = useState('')
  const [opsMemo, setOpsMemo] = useState('')
  const [groupChatInvited, setGroupChatInvited] = useState(false)
  const [coopRequestSent, setCoopRequestSent] = useState(false)
  const [saving, setSaving] = useState(false)

  const feeNum  = parseFloat(contractFee.replace(/[^0-9.]/g, '')) || 0
  const paidNum = parseFloat(paidAmount.replace(/[^0-9.]/g, '')) || 0
  const unpaid  = Math.max(0, feeNum - paidNum)
  const vat     = vatIncluded ? Math.round(feeNum / 11) : 0

  async function handleConfirm() {
    setSaving(true)
    await onConfirm({
      contract_fee:        contractFee,
      payment_amount:      paidAmount,
      unpaid_amount:       unpaid > 0 ? unpaid.toLocaleString() + '원' : '0',
      vat_included:        vatIncluded,
      my_revenue:          myRevenue,
      cumulative_revenue:  cumulativeRevenue,
      ops_memo:            opsMemo,
      group_chat_invited:  groupChatInvited,
      coop_request_sent:   coopRequestSent,
    })
    setSaving(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[#1B2A45] text-sm">✅ 계약완료 처리</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">{company}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-blue-700 mb-1 block font-bold">계약금</label>
              <input type="text" value={contractFee} onChange={e => setContractFee(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="2,500,000" />
            </div>
            <div>
              <label className="text-[10px] text-blue-700 mb-1 block font-bold">입금액</label>
              <input type="text" value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="1,000,000" />
            </div>
          </div>

          {/* 자동계산 행 */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">미입금액</p>
              <p className={`text-sm font-bold ${unpaid > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {unpaid > 0 ? unpaid.toLocaleString() + '원' : '없음'}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 mb-0.5">부가세 {vatIncluded ? '(포함)' : '(미포함)'}</p>
              <p className={`text-sm font-bold ${vatIncluded && vat > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                {vatIncluded && vat > 0 ? vat.toLocaleString() + '원' : '—'}
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={vatIncluded} onChange={e => setVatIncluded(e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500" />
            <span className="text-xs text-gray-600">부가세 포함 (계약금의 1/11 자동계산)</span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-blue-700 mb-1 block font-bold">본인 매출</label>
              <input type="text" value={myRevenue} onChange={e => setMyRevenue(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="예: 15%, 375,000" />
            </div>
            <div>
              <label className="text-[10px] text-blue-700 mb-1 block font-bold">누적 매출</label>
              <input type="text" value={cumulativeRevenue} onChange={e => setCumulativeRevenue(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                placeholder="예: 5,000,000" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-blue-700 mb-1 block font-bold">자금팀 전달 메모</label>
            <textarea value={opsMemo} onChange={e => setOpsMemo(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 resize-none"
              placeholder="자금팀에 전달할 내용..." />
          </div>

          {/* 체크리스트 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2.5">
            <p className="text-[10px] font-bold text-amber-700 mb-1">📋 계약 후 체크리스트</p>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={groupChatInvited} onChange={e => setGroupChatInvited(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500" />
              <span className={`text-xs font-medium ${groupChatInvited ? 'text-emerald-700 line-through' : 'text-gray-700'}`}>
                단톡방 초대 완료
              </span>
              {groupChatInvited && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-semibold">✓ 완료</span>}
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={coopRequestSent} onChange={e => setCoopRequestSent(e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-500" />
              <span className={`text-xs font-medium ${coopRequestSent ? 'text-emerald-700 line-through' : 'text-gray-700'}`}>
                업무협조 요청서 발송 완료
              </span>
              {coopRequestSent && <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-semibold">✓ 완료</span>}
            </label>
          </div>
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

// ── InCallTableRow ─────────────────────────────────────────────────────
interface RowProps {
  customer: Customer
  index: number
  salesUsers: string[]
  userName: string
  tabType: Props['tabType']
  showOwner?: boolean
  onUpdate: Props['onUpdate']
  onStatusChange: Props['onStatusChange']
  onDelete: Props['onDelete']
  onTransferToOps?: Props['onTransferToOps']
}

function InCallTableRow({ customer, index, salesUsers, userName, tabType, showOwner, onUpdate, onStatusChange, onDelete, onTransferToOps }: RowProps) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [tlText, setTlText] = useState('')
  const [tradeOpen, setTradeOpen] = useState(false)
  const menuRef  = useRef<HTMLDivElement>(null)
  const tradeRef = useRef<HTMLDivElement>(null)

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
  const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'

  async function handleContractConfirm(data: Record<string, any>) {
    await onUpdate(c.id, { details: data })
    await onStatusChange(c.id, 'contracted')
    setContractModalOpen(false)
    setExpanded(false)
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
      user: '영업팀',
      content: tlText.trim(),
      created_at: new Date().toISOString(),
    }
    const updated = [...(c.call_timeline || []), entry]
    setTlText('')
    await onUpdate(c.id, { call_timeline: updated })
  }

  const inspectionStatus = c.details?.inspection_status
  const leadType = c.details?.lead_type

  return (
    <>
      {/* 계약완료 모달 */}
      {contractModalOpen && (
        <ContractModal
          company={c.company || c.name}
          onClose={() => setContractModalOpen(false)}
          onConfirm={handleContractConfirm}
        />
      )}

      <tr className={`${rowBg} hover:bg-blue-50/30 transition-colors border-b border-gray-100`}>
        {/* # */}
        <td className="px-3 py-2.5 text-gray-300 text-[11px] w-8 font-mono">{index + 1}</td>

        {/* 업체명 — 칸 전체 클릭 */}
        <td
          className="px-3 py-2.5 cursor-pointer select-none"
          onClick={() => setExpanded(v => !v)}
        >
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-gray-400 text-[10px] shrink-0">{expanded ? '▾' : '▸'}</span>
            <span className="font-semibold text-[#1B2A45] text-xs truncate max-w-[150px]">
              {c.company || c.name}
            </span>
          </div>
          {c.name && (c.company && c.company !== c.name) && (
            <p className="text-[10px] text-gray-400 ml-3.5 truncate max-w-[150px]">{c.name}</p>
          )}
          {/* 직가/공가 배지 */}
          {leadType && (
            <span className={`ml-3.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              leadType === '직가' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
            }`}>{leadType}</span>
          )}
        </td>

        {/* 담당자 (CEO) */}
        {showOwner && (
          <td className="px-3 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">
            {c.sales_user_name || c.details?.sales_user_name || '—'}
          </td>
        )}

        {/* 접수일 */}
        <td className="px-3 py-2.5 text-gray-500 text-[11px] whitespace-nowrap font-mono">
          {c.details?.reception_date
            ? c.details.reception_date.slice(5).replace('-', '/')
            : <span className="text-gray-300">—</span>}
        </td>

        {/* 전화번호 */}
        <td className="px-3 py-2.5 text-gray-600 text-[11px] whitespace-nowrap font-mono">
          {c.phone || <span className="text-gray-300">—</span>}
        </td>

        {/* 업종 */}
        <td className="px-3 py-2.5 text-gray-500 text-[11px] max-w-[100px]">
          <span className="truncate block">{c.details?.business_type || <span className="text-gray-300">—</span>}</span>
        </td>

        {/* 결정전결과 */}
        <td className="px-3 py-2.5">
          <BadgeDropdown
            value={c.details?.call_result || ''}
            options={CALL_RESULTS}
            onChange={(val) => onUpdate(c.id, { details: { call_result: val } })}
          />
        </td>

        {/* 클로징결과 */}
        <td className="px-3 py-2.5">
          <BadgeDropdown
            value={c.details?.closing_result || ''}
            options={CLOSING_RESULTS}
            onChange={(val) => onUpdate(c.id, { details: { closing_result: val } })}
          />
        </td>

        {/* 재통화 */}
        <td className="px-3 py-2.5">
          <input
            type="date"
            value={c.details?.follow_up_date || ''}
            onChange={e => onUpdate(c.id, { details: { follow_up_date: e.target.value } })}
            className="text-[11px] border-0 bg-transparent focus:outline-none w-24 text-gray-500 font-mono"
          />
        </td>

        {/* 통화내용 요약 */}
        <td className="px-3 py-2.5 text-[11px] text-gray-400 max-w-[160px]">
          <span className="truncate block">
            {c.memo || c.notes || c.details?.notes || ''}
          </span>
        </td>

        {/* 3-dot menu */}
        <td className="px-3 py-2.5 w-8">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              className="text-gray-300 hover:text-gray-600 px-1 py-0.5 rounded hover:bg-gray-100 font-bold leading-none"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-50 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[140px] py-1">
                {tabType !== 'contracted' && (
                  <button type="button" onClick={() => { setContractModalOpen(true); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-emerald-600 font-medium">
                    ✅ 계약완료
                  </button>
                )}
                {tabType !== 'emotional' && (
                  <button type="button" onClick={() => { onStatusChange(c.id, 'emotional'); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-violet-600 font-medium">
                    💬 감성톡(거절업체)
                  </button>
                )}
                {tabType !== 'trash' && (
                  <button type="button" onClick={() => { onStatusChange(c.id, 'trash'); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-500 font-medium">
                    🗑 자체거절
                  </button>
                )}
                {tabType !== 'lead' && tabType !== 'db010' && (
                  <button type="button" onClick={() => { onStatusChange(c.id, 'lead'); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-blue-500 font-medium">
                    ↩ 신규복구
                  </button>
                )}
                {tabType === 'contracted' && onTransferToOps && (
                  <button type="button" onClick={() => { onTransferToOps(c); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-amber-600 font-medium">
                    📤 자금팀전송
                  </button>
                )}
                <div className="border-t border-gray-100 my-0.5" />
                <button type="button"
                  onClick={() => { if (confirm('삭제하시겠습니까?')) { onDelete(c.id); setMenuOpen(false) } }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-500 font-medium">
                  🗑 삭제
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>

      {/* ── 확장 패널 ── */}
      {expanded && (
        <tr>
          <td colSpan={showOwner ? 11 : 10} className="p-0">
            <div className="bg-[#FAFAF8] border-t border-b border-blue-100">

              {/* 상단 액션 바 */}
              <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 bg-white">
                <span className="text-xs font-bold text-[#1B2A45] mr-2">
                  {c.details?.company || c.company || c.name}
                </span>
                {tabType !== 'contracted' && (
                  <button type="button" onClick={() => setContractModalOpen(true)}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-500 text-white hover:bg-emerald-600">
                    ✅ 계약완료
                  </button>
                )}
                {tabType !== 'emotional' && (
                  <button type="button" onClick={() => { onStatusChange(c.id, 'emotional'); setExpanded(false) }}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-violet-500 text-white">
                    💬 감성톡(거절업체)
                  </button>
                )}
                {tabType !== 'trash' && (
                  <button type="button" onClick={() => { onStatusChange(c.id, 'trash'); setExpanded(false) }}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-gray-400 text-white">
                    🗑 자체거절
                  </button>
                )}
                {tabType !== 'lead' && tabType !== 'db010' && (
                  <button type="button" onClick={() => { onStatusChange(c.id, 'lead'); setExpanded(false) }}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-500 text-white">
                    ↩ 신규복구
                  </button>
                )}
                {onTransferToOps && tabType === 'contracted' && (
                  <button type="button" onClick={() => { onTransferToOps(c); setExpanded(false) }}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-500 text-white">
                    📤 자금팀 전송
                  </button>
                )}
                {/* DB 트레이드 */}
                <div className="relative" ref={tradeRef}>
                  <button type="button" onClick={() => setTradeOpen(v => !v)}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-sky-500 hover:bg-sky-600 text-white">
                    🔄 DB 트레이드
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
                <button type="button" onClick={() => { if (confirm('삭제?')) { onDelete(c.id); setExpanded(false) } }}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-red-50 text-red-500 ml-auto">
                  🗑 삭제
                </button>
                <button type="button" onClick={() => setExpanded(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-bold px-1 ml-1">✕</button>
              </div>

              {/* 좌/우 2단 패널 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-200">

                {/* ── 좌측: 인콜일지 ── */}
                <div className="p-4 overflow-y-auto max-h-[520px]">
                  <p className="text-[10px] font-bold text-[#1B2A45] uppercase tracking-wide mb-3">📋 인콜일지</p>
                  <div className="grid grid-cols-1 gap-1">
                    {buildLogFields(c).map(({ label, value }) => {
                      const isEmpty = !value || !String(value).trim()
                      return (
                        <div key={label} className="flex items-start gap-2 bg-white border border-gray-100 rounded-lg px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                          <span className="w-20 shrink-0 text-[10px] text-blue-700 font-bold pt-0.5">{label}</span>
                          <span className={`text-xs flex-1 break-words ${isEmpty ? 'text-gray-300 italic' : 'text-gray-800 font-medium'}`}>
                            {isEmpty ? '—' : String(value)}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* 직가/공가 — 인콜일지 내 */}
                  <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg px-2.5 py-2 mt-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <span className="w-20 shrink-0 text-[10px] text-blue-700 font-bold">직가/공가</span>
                    <div className="flex gap-1.5">
                      {['직가', '공가'].map(opt => (
                        <button key={opt} type="button"
                          onClick={() => onUpdate(c.id, { details: { lead_type: leadType === opt ? '' : opt } })}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
                            leadType === opt
                              ? opt === '직가' ? 'bg-blue-500 text-white border-blue-500' : 'bg-amber-500 text-white border-amber-500'
                              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                          }`}>{opt}</button>
                      ))}
                    </div>
                  </div>

                  {/* 통화내용 */}
                  <div className="bg-white border border-gray-100 rounded-lg px-2.5 py-2 mt-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <p className="text-[10px] font-bold text-blue-700 mb-1.5">통화내용</p>
                    {(c.memo || c.notes || c.details?.notes) ? (
                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {c.memo || c.notes || c.details?.notes}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300 italic">—</p>
                    )}
                  </div>
                </div>

                {/* ── 우측: 인콜결과 ── */}
                <div className="p-4 overflow-y-auto max-h-[520px] space-y-4">
                  {/* 담당자 (자동 - 읽기 전용) */}
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">📞 인콜결과</p>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                      담당: {c.sales_user_name || c.details?.sales_user_name || userName}
                    </span>
                  </div>

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

                  {/* 재통화 일정 */}
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <label className="text-[10px] text-blue-700 mb-1.5 block font-bold">재통화 일정</label>
                    <input
                      type="date"
                      value={c.details?.follow_up_date || ''}
                      onChange={e => onUpdate(c.id, { details: { follow_up_date: e.target.value } })}
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/50 text-gray-800"
                    />
                  </div>

                  {/* 환불없이 진행 체크박스 */}
                  <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={c.details?.no_refund || false}
                        onChange={e => onUpdate(c.id, { details: { no_refund: e.target.checked } })}
                        className="w-4 h-4 rounded accent-red-500"
                      />
                      <span className="text-xs text-gray-700 font-medium">환불없이 진행</span>
                      {c.details?.no_refund && (
                        <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">환불불가</span>
                      )}
                    </label>
                  </div>

                  {/* A/S 요청 + 심사 요청 */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* A/S 요청 → 대표에게 */}
                    {c.details?.as_requested ? (
                      <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                        🔧 A/S 요청됨 {c.details.as_request_date ? `(${c.details.as_request_date})` : ''}
                      </span>
                    ) : (
                      <button type="button"
                        onClick={() => onUpdate(c.id, { details: {
                          as_requested: true,
                          as_request_date: new Date().toISOString().slice(0, 10),
                        }})}
                        className="inline-flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
                      >
                        🔧 A/S 요청
                      </button>
                    )}

                    {/* 심사 요청 → 대표에게 */}
                    {(tabType === 'lead' || tabType === 'db010') && (
                      inspectionStatus === 'pending' ? (
                        <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                          ⏳ 심사요청 중
                        </span>
                      ) : inspectionStatus === 'approved' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                          ✅ 심사 승인
                        </span>
                      ) : inspectionStatus === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-full text-[11px] font-semibold">
                          ❌ 심사 반려
                        </span>
                      ) : (
                        <button type="button" onClick={handleInspectionRequest}
                          className="inline-flex items-center gap-1 bg-violet-500 hover:bg-violet-600 text-white px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
                        >
                          🔍 심사 요청
                        </button>
                      )
                    )}
                  </div>

                  {/* 메모 */}
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <label className="text-[10px] text-blue-700 mb-1.5 block font-bold">메모</label>
                    <ResultMemoField
                      value={c.details?.result_memo || ''}
                      onChange={(val) => onUpdate(c.id, { details: { result_memo: val } })}
                    />
                  </div>

                  {/* 타임라인 */}
                  <div className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                    <p className="text-[10px] font-bold text-blue-700 mb-1.5">📝 타임라인</p>
                    {/* 추가 입력 */}
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={tlText}
                        onChange={e => setTlText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTimelineEntry() } }}
                        placeholder="메모 입력 후 Enter"
                        className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                      />
                      <button
                        type="button"
                        onClick={addTimelineEntry}
                        disabled={!tlText.trim()}
                        className="shrink-0 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors"
                      >
                        추가
                      </button>
                    </div>
                    {c.call_timeline && c.call_timeline.length > 0 ? (
                      <div className="space-y-1.5">
                        {(c.call_timeline as any[]).slice().reverse().map((entry: any, i: number) => (
                          <div key={i} className="bg-white border border-gray-100 rounded p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-semibold text-[#1B2A45]">{entry.user}</span>
                              <span className="text-[10px] text-gray-400">{entry.created_at?.slice(0, 16)}</span>
                            </div>
                            <p className="text-xs text-gray-600 whitespace-pre-wrap">{entry.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-300 italic text-center py-2">타임라인 없음</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── 날짜 그룹 헤더 ─────────────────────────────────────────────────────
function DateGroupHeader({ date, count, colSpan }: { date: string; count: number; colSpan: number }) {
  const display = date === '__none__'
    ? '📅 날짜 미정'
    : `📅 ${date.slice(0, 7).replace('-', '년 ')}월  ${date.slice(8, 10)}일`
  return (
    <tr className="bg-[#1B2A45]/5">
      <td colSpan={colSpan} className="px-4 py-1.5">
        <span className="text-[10px] font-bold text-[#1B2A45]/60 tracking-wide">{display}</span>
        <span className="ml-2 text-[10px] text-gray-400">{count}건</span>
      </td>
    </tr>
  )
}

// ── 날짜 기준 그룹핑 ───────────────────────────────────────────────────
function groupByDate(customers: Customer[]): { date: string; items: Customer[] }[] {
  const map = new Map<string, Customer[]>()
  for (const c of customers) {
    const date = c.details?.reception_date?.slice(0, 10) || '__none__'
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

// ── Main InCallTableView ───────────────────────────────────────────────
export default function InCallTableView({
  customers,
  tabType,
  salesUsers,
  userName,
  onUpdate,
  onStatusChange,
  onDelete,
  onTransferToOps,
  showOwner = false,
}: Props) {
  const groups = groupByDate(customers)
  const colSpan = showOwner ? 11 : 10
  let globalIndex = 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-[#1B2A45] text-white">
              <th className="px-3 py-2.5 text-left font-medium text-white/50 w-8">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">업체명</th>
              {showOwner && <th className="px-3 py-2.5 text-left font-semibold">담당자</th>}
              <th className="px-3 py-2.5 text-left font-semibold">접수일</th>
              <th className="px-3 py-2.5 text-left font-semibold">전화번호</th>
              <th className="px-3 py-2.5 text-left font-semibold">업종</th>
              <th className="px-3 py-2.5 text-left font-semibold">결정전결과</th>
              <th className="px-3 py-2.5 text-left font-semibold">클로징결과</th>
              <th className="px-3 py-2.5 text-left font-semibold">재통화일정</th>
              <th className="px-3 py-2.5 text-left font-semibold">통화내용</th>
              <th className="px-3 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="py-16 text-center text-gray-400 text-sm">
                  데이터가 없습니다
                </td>
              </tr>
            ) : (
              groups.map(({ date, items }) => (
                <>
                  <DateGroupHeader key={`hdr-${date}`} date={date} count={items.length} colSpan={colSpan} />
                  {items.map((c) => {
                    const idx = globalIndex++
                    return (
                      <InCallTableRow
                        key={c.id}
                        customer={c}
                        index={idx}
                        salesUsers={salesUsers}
                        userName={userName}
                        tabType={tabType}
                        showOwner={showOwner}
                        onUpdate={onUpdate}
                        onStatusChange={onStatusChange}
                        onDelete={onDelete}
                        onTransferToOps={onTransferToOps}
                      />
                    )
                  })}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
