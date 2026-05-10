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
  showOwner?: boolean  // CEO 뷰에서 담당자 컬럼 표시
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

// 인콜일지 필드 목록 (모두 표시 — 빈 값은 — 로 표시)
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
              key={opt.key}
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

// ── InCallTableRow ─────────────────────────────────────────────────────
interface RowProps {
  customer: Customer
  index: number
  salesUsers: string[]
  tabType: Props['tabType']
  showOwner?: boolean
  onUpdate: Props['onUpdate']
  onStatusChange: Props['onStatusChange']
  onDelete: Props['onDelete']
  onTransferToOps?: Props['onTransferToOps']
}

function InCallTableRow({ customer, index, salesUsers, tabType, showOwner, onUpdate, onStatusChange, onDelete, onTransferToOps }: RowProps) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const c = customer
  const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'

  return (
    <>
      <tr className={`${rowBg} hover:bg-blue-50/30 transition-colors border-b border-gray-100`}>
        {/* # */}
        <td className="px-3 py-2.5 text-gray-300 text-[11px] w-8 font-mono">{index + 1}</td>

        {/* 업체명 */}
        <td className="px-3 py-2.5">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="font-semibold text-[#1B2A45] hover:text-blue-600 text-left truncate block max-w-[160px] text-xs"
          >
            {expanded ? '▾ ' : '▸ '}{c.company || c.name}
          </button>
          {c.name && (c.company && c.company !== c.name) && (
            <p className="text-[10px] text-gray-400 ml-4">{c.name}</p>
          )}
        </td>

        {/* 담당자 (CEO 뷰에서만) */}
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

        {/* 결정결과 */}
        <td className="px-3 py-2.5">
          <BadgeDropdown
            value={c.details?.call_result || ''}
            options={CALL_RESULTS}
            onChange={(val) => onUpdate(c.id, { details: { call_result: val } })}
          />
        </td>

        {/* 클로징 */}
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
              <div className="absolute right-0 z-50 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[130px] py-1">
                {tabType !== 'contracted' && (
                  <button type="button" onClick={() => { onStatusChange(c.id, 'contracted'); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-emerald-600 font-medium">
                    ✅ 계약완료
                  </button>
                )}
                {tabType !== 'emotional' && (
                  <button type="button" onClick={() => { onStatusChange(c.id, 'emotional'); setMenuOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-violet-600 font-medium">
                    💬 감성톡
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
                  <button type="button" onClick={() => { onStatusChange(c.id, 'contracted'); setExpanded(false) }}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-500 text-white hover:bg-emerald-600">
                    ✅ 계약완료
                  </button>
                )}
                {tabType !== 'emotional' && (
                  <button type="button" onClick={() => { onStatusChange(c.id, 'emotional'); setExpanded(false) }}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-violet-500 text-white">
                    💬 감성톡
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
                <button type="button" onClick={() => { if (confirm('삭제?')) { onDelete(c.id); setExpanded(false) } }}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-red-50 text-red-500 ml-auto">
                  🗑 삭제
                </button>
                <button type="button" onClick={() => setExpanded(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm font-bold px-1 ml-1">✕</button>
              </div>

              {/* 좌/우 2단 패널 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-gray-200">

                {/* ── 좌측: 인콜일지 (모든 필드 표시) ── */}
                <div className="p-4 overflow-y-auto max-h-[520px]">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">
                    📋 인콜일지
                  </p>
                  <div className="divide-y divide-gray-50">
                    {buildLogFields(c).map(({ label, value }) => {
                      const isEmpty = !value || !String(value).trim()
                      return (
                        <div key={label} className="flex items-start py-1.5 gap-2">
                          <span className="w-20 shrink-0 text-[10px] text-gray-400 pt-0.5 font-medium">
                            {label}
                          </span>
                          <span className={`text-xs flex-1 break-words ${isEmpty ? 'text-gray-300 italic' : 'text-gray-800'}`}>
                            {isEmpty ? '—' : String(value)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {/* 통화내용 */}
                  <div className="pt-3 mt-2 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 mb-1.5">통화내용</p>
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
                <div className="p-4 overflow-y-auto max-h-[520px]">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">
                    📞 인콜결과
                  </p>
                  <div className="space-y-4">

                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block font-medium">결정전 결과</label>
                      <BadgeDropdown
                        value={c.details?.call_result || ''}
                        options={CALL_RESULTS}
                        onChange={(val) => onUpdate(c.id, { details: { call_result: val } })}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block font-medium">클로징 결과</label>
                      <BadgeDropdown
                        value={c.details?.closing_result || ''}
                        options={CLOSING_RESULTS}
                        onChange={(val) => onUpdate(c.id, { details: { closing_result: val } })}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block font-medium">재통화 일정</label>
                      <input
                        type="date"
                        value={c.details?.follow_up_date || ''}
                        onChange={e => onUpdate(c.id, { details: { follow_up_date: e.target.value } })}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block font-medium">심사원 배정</label>
                      <input
                        type="text"
                        value={c.details?.inspector || ''}
                        onChange={e => onUpdate(c.id, { details: { inspector: e.target.value } })}
                        placeholder="심사원 이름"
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/50"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block font-medium">메모</label>
                      <ResultMemoField
                        value={c.details?.result_memo || ''}
                        onChange={(val) => onUpdate(c.id, { details: { result_memo: val } })}
                      />
                    </div>

                    {/* 타임라인 */}
                    {c.call_timeline && c.call_timeline.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 mb-1.5">업데이트 히스토리</p>
                        <div className="space-y-2">
                          {(c.call_timeline as any[]).map((entry: any, i: number) => (
                            <div key={i} className="bg-white border border-gray-100 rounded p-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-semibold text-[#1B2A45]">{entry.user}</span>
                                <span className="text-[10px] text-gray-400">{entry.created_at?.slice(0, 16)}</span>
                              </div>
                              <p className="text-xs text-gray-600 whitespace-pre-wrap">{entry.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
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
  // 날짜 내림차순, 미정은 맨 뒤
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
              <th className="px-3 py-2.5 text-left font-semibold">결정결과</th>
              <th className="px-3 py-2.5 text-left font-semibold">클로징</th>
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
