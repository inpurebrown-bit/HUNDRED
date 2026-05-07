'use client'

import { useState, useRef, useEffect } from 'react'
import InCallForm, { InCallData, emptyInCallData } from './InCallForm'

export interface Customer {
  id: string
  name: string
  phone: string
  company: string
  status: string
  notes?: string
  details?: Record<string, any>
  created_at?: string
}

interface Props {
  customers: Customer[]
  tabType: 'db010' | 'lead' | 'contracted' | 'emotional' | 'trash'
  salesUsers: string[]
  userName: string
  onUpdate: (id: string, patch: Record<string, any>) => Promise<void>
  onStatusChange: (id: string, newStatus: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onTransferToOps?: (customer: Customer) => Promise<void>
}

// ── Badge configs ──────────────────────────────────────────────────────
const CALL_RESULTS = [
  { key: '광정업체', color: 'bg-emerald-500 text-white' },
  { key: '고민중', color: 'bg-orange-400 text-white' },
  { key: '인콜대기', color: 'bg-yellow-300 text-gray-800' },
  { key: '대기', color: 'bg-slate-300 text-slate-700' },
  { key: '거절', color: 'bg-rose-400 text-white' },
  { key: '', color: 'bg-gray-100 text-gray-400' },
]

const CLOSING_RESULTS = [
  { key: '광정업체', color: 'bg-emerald-500 text-white' },
  { key: '고민중', color: 'bg-orange-400 text-white' },
  { key: '인콜업체', color: 'bg-blue-400 text-white' },
  { key: '', color: 'bg-gray-100 text-gray-400' },
]

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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
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
              key={opt.key}
              type="button"
              onClick={() => { onChange(opt.key); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-[11px] font-semibold hover:bg-gray-50 flex items-center gap-2`}
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

// ── InCallTableRow ─────────────────────────────────────────────────────
interface RowProps {
  customer: Customer
  index: number
  salesUsers: string[]
  tabType: Props['tabType']
  onUpdate: Props['onUpdate']
  onStatusChange: Props['onStatusChange']
  onDelete: Props['onDelete']
  onTransferToOps?: Props['onTransferToOps']
}

function InCallTableRow({ customer, index, salesUsers, tabType, onUpdate, onStatusChange, onDelete, onTransferToOps }: RowProps) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const c = customer

  return (
    <>
      <tr className="hover:bg-gray-50/80 transition-colors border-b border-gray-50">
        {/* # */}
        <td className="px-3 py-2 text-gray-300 text-[11px] w-8">{index + 1}</td>

        {/* 업체명 */}
        <td className="px-3 py-2">
          <span
            className="font-semibold text-gray-800 cursor-pointer hover:text-blue-600 truncate block max-w-[140px]"
            onClick={() => setExpanded(v => !v)}
          >
            {c.company || c.name}
          </span>
        </td>

        {/* 접수일 */}
        <td className="px-3 py-2 text-gray-500 text-[11px] whitespace-nowrap">
          {c.details?.reception_date ? c.details.reception_date.slice(5) : ''}
        </td>

        {/* 전화번호 */}
        <td className="px-3 py-2 text-gray-600 text-[11px] whitespace-nowrap">
          {c.phone}
        </td>

        {/* 업종 */}
        <td className="px-3 py-2 text-gray-500 text-[11px] truncate max-w-[100px]">
          {c.details?.business_type || ''}
        </td>

        {/* 결정결과 */}
        <td className="px-3 py-2">
          <BadgeDropdown
            value={c.details?.call_result || ''}
            options={CALL_RESULTS}
            onChange={(val) => onUpdate(c.id, { details: { call_result: val } })}
          />
        </td>

        {/* 클로징 */}
        <td className="px-3 py-2">
          <BadgeDropdown
            value={c.details?.closing_result || ''}
            options={CLOSING_RESULTS}
            onChange={(val) => onUpdate(c.id, { details: { closing_result: val } })}
          />
        </td>

        {/* 재통화 */}
        <td className="px-3 py-2">
          <input
            type="date"
            value={c.details?.follow_up_date || ''}
            onChange={e => onUpdate(c.id, { details: { follow_up_date: e.target.value } })}
            className="text-xs border-0 bg-transparent focus:outline-none w-24"
          />
        </td>

        {/* 내용 */}
        <td className="px-3 py-2 text-xs text-gray-400 truncate max-w-[180px]">
          {c.details?.notes || c.notes || ''}
        </td>

        {/* 3-dot menu */}
        <td className="px-3 py-2 w-8">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              className="text-gray-400 hover:text-gray-600 px-1 py-0.5 rounded hover:bg-gray-100 text-sm font-bold"
            >
              ···
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-50 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[130px] py-1">
                {tabType !== 'contracted' && (
                  <button
                    type="button"
                    onClick={() => { onStatusChange(c.id, 'contracted'); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-emerald-600 font-medium"
                  >
                    ✅ 계약완료
                  </button>
                )}
                {tabType !== 'emotional' && (
                  <button
                    type="button"
                    onClick={() => { onStatusChange(c.id, 'emotional'); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-violet-600 font-medium"
                  >
                    💬 감성톡
                  </button>
                )}
                {tabType !== 'trash' && (
                  <button
                    type="button"
                    onClick={() => { onStatusChange(c.id, 'trash'); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-500 font-medium"
                  >
                    🗑 자체거절
                  </button>
                )}
                {tabType === 'contracted' && onTransferToOps && (
                  <button
                    type="button"
                    onClick={() => { onTransferToOps(c); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-amber-600 font-medium"
                  >
                    📤 자금팀전송
                  </button>
                )}
                <div className="border-t border-gray-100 my-0.5" />
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('삭제하시겠습니까?')) {
                      onDelete(c.id)
                      setMenuOpen(false)
                    }
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 text-red-500 font-medium"
                >
                  🗑 삭제
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded panel */}
      {expanded && (
        <tr>
          <td colSpan={10} className="p-0">
            <div className="bg-gray-50 border-t border-gray-100 p-3">
              {/* Status action buttons */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {tabType !== 'contracted' && (
                  <button
                    type="button"
                    onClick={() => { onStatusChange(c.id, 'contracted'); setExpanded(false) }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    ✅ 계약완료
                  </button>
                )}
                {tabType !== 'emotional' && (
                  <button
                    type="button"
                    onClick={() => { onStatusChange(c.id, 'emotional'); setExpanded(false) }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-violet-500 text-white"
                  >
                    💬 감성톡
                  </button>
                )}
                {tabType !== 'trash' && (
                  <button
                    type="button"
                    onClick={() => { onStatusChange(c.id, 'trash'); setExpanded(false) }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-gray-400 text-white"
                  >
                    🗑 자체거절
                  </button>
                )}
                {tabType !== 'lead' && tabType !== 'db010' && (
                  <button
                    type="button"
                    onClick={() => { onStatusChange(c.id, 'lead'); setExpanded(false) }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-500 text-white"
                  >
                    ↩ 신규복구
                  </button>
                )}
                {onTransferToOps && tabType === 'contracted' && (
                  <button
                    type="button"
                    onClick={() => { onTransferToOps(c); setExpanded(false) }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500 text-white"
                  >
                    📤 자금팀 전송
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('삭제?')) {
                      onDelete(c.id)
                      setExpanded(false)
                    }
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-600 ml-auto"
                >
                  🗑 삭제
                </button>
              </div>

              {/* InCallForm edit mode */}
              <InCallForm
                title={`${c.company || c.name} — 인콜일지 수정`}
                salesUsers={salesUsers}
                submitting={saving}
                submitLabel="💾 저장"
                initialData={{
                  name: c.name,
                  phone: c.phone,
                  company: c.company,
                  notes: c.details?.notes || c.notes || '',
                  ...c.details,
                } as Partial<InCallData>}
                onSubmit={async (data) => {
                  setSaving(true)
                  const { name, phone, company, notes, sensitivity, ...rest } = data
                  await onUpdate(c.id, {
                    name, phone, company, notes,
                    details: { ...rest, sensitivity, notes },
                  })
                  setSaving(false)
                  setExpanded(false)
                }}
                onCancel={() => setExpanded(false)}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  )
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
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left text-gray-400 font-medium w-8">#</th>
              <th className="px-3 py-2 text-left text-gray-600 font-semibold">업체명</th>
              <th className="px-3 py-2 text-left text-gray-600 font-semibold">접수일</th>
              <th className="px-3 py-2 text-left text-gray-600 font-semibold">전화번호</th>
              <th className="px-3 py-2 text-left text-gray-600 font-semibold">업종</th>
              <th className="px-3 py-2 text-left text-gray-600 font-semibold">결정결과</th>
              <th className="px-3 py-2 text-left text-gray-600 font-semibold">클로징</th>
              <th className="px-3 py-2 text-left text-gray-600 font-semibold">재통화일정</th>
              <th className="px-3 py-2 text-left text-gray-600 font-semibold">내용</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map((c, i) => (
              <InCallTableRow
                key={c.id}
                customer={c}
                index={i}
                salesUsers={salesUsers}
                tabType={tabType}
                onUpdate={onUpdate}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                onTransferToOps={onTransferToOps}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
