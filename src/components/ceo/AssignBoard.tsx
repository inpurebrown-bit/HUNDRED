'use client'

import { useState, useEffect, useCallback, FormEvent, ReactNode } from 'react'
import InCallForm, { InCallData } from '@/components/sales/InCallForm'

// ── Types ────────────────────────────────────────────────────────────────────

interface SalesUser {
  id: string
  name: string
}

interface OpsUser {
  id: string
  name: string
}

interface SupplyEntry {
  id: string
  reception_date: string
  company_name: string
  region: string
  business_number: string
  customer_name: string
  phone: string
  industry: string
  last_year_revenue: number | null
  credit_score: number | null
  tax_delinquent: string
  required_funds: number | null
  assigned_user_id: string | null
  assigned_user_name: string | null
  status: string
  notes: string
  created_at: string
}

interface LeadCustomer {
  id: string
  created_at: string
  company: string
  region?: string
  name: string
  phone: string
  loan_history: string
  notes: string
  sales_user_id: string | null
  sales_user_name: string | null
  status: string
}

interface Contract {
  id: string
  customer_id: string
  sales_user_name: string
  contract_amount: number
  memo: string
  created_at: string
  customers: { name: string; phone: string; company: string }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(s: string) {
  if (!s) return '-'
  return s.slice(0, 10)
}

function fmtMoney(v: number | null) {
  if (v == null) return '-'
  return v.toLocaleString() + '만원'
}

// ── Badge ────────────────────────────────────────────────────────────────────

function AssignedBadge({ name }: { name: string | null }) {
  if (name) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {name}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
      미배정
    </span>
  )
}

// ── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, count }: { title: string; subtitle: string; count?: number }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-lg font-bold text-[#1B2A45]">{title}</h2>
        <p className="text-sm text-[#1B2A45]/50 mt-0.5">{subtitle}</p>
      </div>
      {count !== undefined && (
        <span className="text-xs text-[#1B2A45]/40 tabular-nums">{count}건</span>
      )}
    </div>
  )
}

// ── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div className="my-8 flex items-center gap-4">
      <div className="flex-1 h-px bg-[#E8E2D4]" />
      <span className="w-1.5 h-1.5 rounded-full bg-[#C5A258]" />
      <div className="flex-1 h-px bg-[#E8E2D4]" />
    </div>
  )
}

// ── Loading / Empty ──────────────────────────────────────────────────────────

function LoadingBlock() {
  return (
    <div className="bg-white rounded-xl border border-[#E8E2D4] p-10 text-center">
      <div className="inline-flex gap-1.5">
        {[0, 150, 300].map(d => (
          <span
            key={d}
            className="w-2 h-2 rounded-full bg-[#C5A258]/60 animate-bounce"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#E8E2D4] p-10 text-center text-[#1B2A45]/40 text-sm">
      {message}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — 직접 공급 DB
// ════════════════════════════════════════════════════════════════════════════

interface SupplyFormState {
  reception_date: string
  company_name: string
  region: string
  business_number: string
  customer_name: string
  phone: string
  industry: string
  last_year_revenue: string
  credit_score: string
  tax_delinquent: string
  required_funds: string
  assigned_user_id: string
  notes: string
}

const EMPTY_FORM: SupplyFormState = {
  reception_date: today(),
  company_name: '',
  region: '',
  business_number: '',
  customer_name: '',
  phone: '',
  industry: '',
  last_year_revenue: '',
  credit_score: '',
  tax_delinquent: '없음',
  required_funds: '',
  assigned_user_id: '',
  notes: '',
}

function SupplyDBSection({ salesUsers }: { salesUsers: SalesUser[] }) {
  const [entries, setEntries] = useState<SupplyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [assignTo, setAssignTo] = useState<string>('')  // 배정할 영업사원 id
  const [toast, setToast] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [patchingId, setPatchingId] = useState<string | null>(null)
  const [inlineAssign, setInlineAssign] = useState<Record<string, string>>({})
  const [inlineMemo, setInlineMemo] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/supply-db')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '불러오기 실패')
      setEntries(data.items || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── InCallForm 제출 → customers 테이블에 저장 (영업팀과 동일 포맷) ──
  async function handleInCallSubmit(data: InCallData) {
    setSubmitting(true)
    try {
      const selectedUser = salesUsers.find(u => u.id === assignTo)
      const body: Record<string, any> = {
        name: data.name || '',
        phone: data.phone || '',
        company: data.company || '',
        loan_history: data.loan_credit || '',
        notes: data.notes || '',
        status: 'db010',
        details: data,
      }
      // CEO가 특정 영업사원에게 배정
      if (assignTo && selectedUser) {
        body.sales_user_id = selectedUser.id
        body.sales_user_name = selectedUser.name
      }
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (res.ok) {
        setShowForm(false)
        setAssignTo('')
        const target = selectedUser ? `${selectedUser.name}에게 배정` : '미배정'
        setToast(`✅ DB 등록 완료 (${target})`)
        setTimeout(() => setToast(null), 3500)
      } else {
        alert(`등록 실패: ${json.error}`)
      }
    } catch (e: any) {
      alert(`오류: ${e.message}`)
    }
    setSubmitting(false)
  }

  // ── 구형 supply_db 수정 (기존 데이터용) ──
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const form: any = {}
    if (!form.company_name?.trim()) return
    setSubmitting(true)
    try {
      const selectedUser = salesUsers.find(u => u.id === form.assigned_user_id)
      const body = {
        reception_date: form.reception_date,
        company_name: form.company_name.trim(),
        region: form.region?.trim(),
        business_number: form.business_number?.trim(),
        customer_name: form.customer_name?.trim(),
        phone: form.phone?.trim(),
        industry: form.industry?.trim(),
        last_year_revenue: form.last_year_revenue ? Number(form.last_year_revenue) : null,
        credit_score: form.credit_score ? Number(form.credit_score) : null,
        tax_delinquent: form.tax_delinquent,
        required_funds: form.required_funds ? Number(form.required_funds) : null,
        assigned_user_id: form.assigned_user_id || null,
        assigned_user_name: selectedUser?.name || null,
        notes: form.notes.trim(),
      }
      const res = await fetch('/api/supply-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '등록 실패')
      setShowForm(false)
      load()
    } catch (e: any) {
      alert('오류: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" DB를 삭제하시겠습니까?`)) return
    try {
      const res = await fetch(`/api/supply-db/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || '삭제 실패')
      }
      load()
    } catch (e: any) {
      alert('오류: ' + e.message)
    }
  }

  async function handlePatch(id: string) {
    setPatchingId(id)
    try {
      const entry = entries.find(e => e.id === id)
      const userId = inlineAssign[id] ?? entry?.assigned_user_id ?? ''
      const selectedUser = salesUsers.find(u => u.id === userId)
      const memo = inlineMemo[id] ?? entry?.notes ?? ''
      const body: Record<string, any> = {
        notes: memo,
      }
      if (userId !== (entry?.assigned_user_id ?? '')) {
        body.assign = true
        body.assigned_user_id = userId || null
        body.assigned_user_name = selectedUser?.name || null
      }
      const res = await fetch(`/api/supply-db/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || '수정 실패')
      }
      load()
    } catch (e: any) {
      alert('오류: ' + e.message)
    } finally {
      setPatchingId(null)
    }
  }

  function toggleExpand(id: string, entry: SupplyEntry) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      setInlineAssign(prev => ({ ...prev, [id]: entry.assigned_user_id ?? '' }))
      setInlineMemo(prev => ({ ...prev, [id]: entry.notes ?? '' }))
    }
  }

  return (
    <div>
      <SectionHeader
        title="직접 공급 DB"
        subtitle="대표가 직접 공급하는 DB"
        count={entries.length}
      />

      {/* Add button */}
      <div className="mb-4">
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1B2A45] text-white text-sm font-medium hover:bg-[#1B2A45]/90 transition-colors"
        >
          <span className="text-[#C5A258] font-bold text-base leading-none">+</span>
          DB 추가
        </button>
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white bg-emerald-500">
          {toast}
        </div>
      )}

      {/* InCallForm 기반 DB 등록 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-[#1B2A45]">📋 신규 DB 등록 (인콜일지 양식)</p>
            <button
              onClick={() => { setShowForm(false); setAssignTo('') }}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >✕ 닫기</button>
          </div>
          {/* 영업사원 배정 선택 */}
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 block mb-1">배정할 영업사원</label>
            <select
              value={assignTo}
              onChange={e => setAssignTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-[#C5A258]"
            >
              <option value="">미배정 (나중에 설정)</option>
              {salesUsers.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            {assignTo && (
              <p className="text-xs text-emerald-600 mt-1">
                ✅ {salesUsers.find(u => u.id === assignTo)?.name}의 010DB 탭에 등록됩니다
              </p>
            )}
          </div>
          <InCallForm
            title="DB 등록"
            salesUsers={[]}
            submitting={submitting}
            onSubmit={handleInCallSubmit}
            onCancel={() => { setShowForm(false); setAssignTo('') }}
          />
        </div>
      )}

      {/* List */}
      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-600">{error}</div>
      ) : entries.length === 0 ? (
        <EmptyBlock message="등록된 공급 DB가 없습니다." />
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const isOpen = expandedId === entry.id
            return (
              <div
                key={entry.id}
                className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden transition-shadow hover:shadow-sm"
              >
                {/* Collapsed row */}
                <button
                  type="button"
                  onClick={() => toggleExpand(entry.id, entry)}
                  className="w-full text-left px-5 py-4"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <span className="text-xs text-[#1B2A45]/40 shrink-0">{fmtDate(entry.reception_date)}</span>
                      <span className="font-semibold text-[#1B2A45] truncate">{entry.company_name}</span>
                      {entry.region && (
                        <span className="text-xs text-[#1B2A45]/50 hidden sm:inline">{entry.region}</span>
                      )}
                      {entry.customer_name && (
                        <span className="text-xs text-[#1B2A45]/60 hidden md:inline">{entry.customer_name}</span>
                      )}
                      {entry.phone && (
                        <span className="text-xs text-[#1B2A45]/50 hidden md:inline">{entry.phone}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <AssignedBadge name={entry.assigned_user_name} />
                      <span className="text-[#1B2A45]/30 text-xs">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-[#E8E2D4] px-5 py-4 space-y-4 bg-[#FAF8F3]/50">
                    {/* Detail grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {[
                        { label: '접수일자', value: fmtDate(entry.reception_date) },
                        { label: '지역', value: entry.region || '-' },
                        { label: '사업자등록번호', value: entry.business_number || '-' },
                        { label: '고객명', value: entry.customer_name || '-' },
                        { label: '연락처', value: entry.phone || '-' },
                        { label: '업종', value: entry.industry || '-' },
                        { label: '작년 매출', value: fmtMoney(entry.last_year_revenue) },
                        { label: '신용점수', value: entry.credit_score != null ? String(entry.credit_score) : '-' },
                        { label: '세금체납', value: entry.tax_delinquent || '-' },
                        { label: '필요자금', value: fmtMoney(entry.required_funds) },
                      ].map(f => (
                        <div key={f.label} className="bg-white rounded-lg border border-[#E8E2D4] px-3 py-2">
                          <p className="text-[10px] text-[#1B2A45]/40 mb-0.5">{f.label}</p>
                          <p className="text-sm text-[#1B2A45] font-medium">{f.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Inline edit: 담당자 + 메모 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-[#1B2A45]/50 mb-1">담당자 배정</label>
                        <select
                          value={inlineAssign[entry.id] ?? entry.assigned_user_id ?? ''}
                          onChange={e => setInlineAssign(prev => ({ ...prev, [entry.id]: e.target.value }))}
                          className={inputCls}
                        >
                          <option value="">미배정</option>
                          {salesUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-[#1B2A45]/50 mb-1">메모</label>
                        <textarea
                          rows={2}
                          value={inlineMemo[entry.id] ?? entry.notes ?? ''}
                          onChange={e => setInlineMemo(prev => ({ ...prev, [entry.id]: e.target.value }))}
                          className={inputCls + ' resize-none'}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handlePatch(entry.id)}
                        disabled={patchingId === entry.id}
                        className="px-4 py-1.5 rounded-lg bg-[#1B2A45] text-white text-xs font-medium hover:bg-[#1B2A45]/90 disabled:opacity-40 transition-colors"
                      >
                        {patchingId === entry.id ? '저장 중...' : '저장'}
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id, entry.company_name)}
                        className="px-4 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — 리드폼 DB
// ════════════════════════════════════════════════════════════════════════════

function LeadDBSection({ salesUsers }: { salesUsers: SalesUser[] }) {
  const [leads, setLeads] = useState<LeadCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [assignSelect, setAssignSelect] = useState<Record<string, string>>({})
  const [patching, setPatching] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '불러오기 실패')
      const all: LeadCustomer[] = data.customers || []
      setLeads(all.filter(c => c.status === 'lead'))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function toggleExpand(id: string, lead: LeadCustomer) {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      setAssignSelect(prev => ({ ...prev, [id]: lead.sales_user_id ?? '' }))
    }
  }

  async function handleAssign(id: string) {
    setPatching(id)
    try {
      const userId = assignSelect[id] ?? ''
      const selectedUser = salesUsers.find(u => u.id === userId)
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_user_id: userId || null,
          sales_user_name: selectedUser?.name || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '수정 실패')
      load()
    } catch (e: any) {
      alert('오류: ' + e.message)
    } finally {
      setPatching(null)
    }
  }

  return (
    <div>
      <SectionHeader
        title="리드폼 DB"
        subtitle="홈페이지 상담신청 유입 DB"
        count={leads.length}
      />

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-600">{error}</div>
      ) : leads.length === 0 ? (
        <EmptyBlock message="신규 리드 DB가 없습니다." />
      ) : (
        <div className="space-y-3">
          {leads.map(lead => {
            const isOpen = expandedId === lead.id
            return (
              <div
                key={lead.id}
                className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden hover:shadow-sm transition-shadow"
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(lead.id, lead)}
                  className="w-full text-left px-5 py-4"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      <span className="text-xs text-[#1B2A45]/40 shrink-0">{fmtDate(lead.created_at)}</span>
                      <span className="font-semibold text-[#1B2A45] truncate">{lead.company || '(상호 없음)'}</span>
                      {lead.region && (
                        <span className="text-xs text-[#1B2A45]/50 hidden sm:inline">{lead.region}</span>
                      )}
                      <span className="text-xs text-[#1B2A45]/60 hidden md:inline">{lead.name}</span>
                      <span className="text-xs text-[#1B2A45]/50 hidden md:inline">{lead.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <AssignedBadge name={lead.sales_user_name} />
                      <span className="text-[#1B2A45]/30 text-xs">{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-[#E8E2D4] px-5 py-4 space-y-4 bg-[#FAF8F3]/50">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { label: '접수일자', value: fmtDate(lead.created_at) },
                        { label: '상호명', value: lead.company || '-' },
                        { label: '고객명', value: lead.name || '-' },
                        { label: '연락처', value: lead.phone || '-' },
                        { label: '세금체납', value: lead.loan_history || '-' },
                        { label: '문의 내용', value: lead.notes || '-' },
                      ].map(f => (
                        <div key={f.label} className="bg-white rounded-lg border border-[#E8E2D4] px-3 py-2">
                          <p className="text-[10px] text-[#1B2A45]/40 mb-0.5">{f.label}</p>
                          <p className="text-sm text-[#1B2A45] font-medium break-words">{f.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-end gap-3">
                      <div className="flex-1 max-w-xs">
                        <label className="block text-xs text-[#1B2A45]/50 mb-1">담당자 배정</label>
                        <select
                          value={assignSelect[lead.id] ?? lead.sales_user_id ?? ''}
                          onChange={e => setAssignSelect(prev => ({ ...prev, [lead.id]: e.target.value }))}
                          className={inputCls}
                        >
                          <option value="">미배정</option>
                          {salesUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => handleAssign(lead.id)}
                        disabled={patching === lead.id}
                        className="px-4 py-2 rounded-lg bg-[#1B2A45] text-white text-xs font-medium hover:bg-[#1B2A45]/90 disabled:opacity-40 transition-colors"
                      >
                        {patching === lead.id ? '저장 중...' : '배정'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — 계약 배정 대기
// ════════════════════════════════════════════════════════════════════════════

function ContractAssignSection({ opsUsers }: { opsUsers: OpsUser[] }) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOps, setSelectedOps] = useState<Record<string, string>>({})
  const [assigning, setAssigning] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/assign')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '불러오기 실패')
      setContracts(data.contracts || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function assign(contractId: string) {
    const opsUserId = selectedOps[contractId]
    if (!opsUserId) return alert('관리팀 담당자를 선택해주세요')
    const opsUser = opsUsers.find(u => u.id === opsUserId)
    setAssigning(contractId)
    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_id: contractId,
          ops_user_id: opsUserId,
          ops_user_name: opsUser?.name,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '배정 실패')
      load()
    } catch (e: any) {
      alert('오류: ' + e.message)
    } finally {
      setAssigning(null)
    }
  }

  return (
    <div>
      <SectionHeader
        title="계약 배정 대기"
        subtitle="영업팀이 체결한 계약을 관리팀에 배정"
        count={contracts.length}
      />

      {loading ? (
        <LoadingBlock />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-600">{error}</div>
      ) : contracts.length === 0 ? (
        <EmptyBlock message="배정 대기 중인 계약이 없습니다." />
      ) : (
        <div className="space-y-3">
          {contracts.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-[#E8E2D4] p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-semibold text-[#1B2A45]">{c.customers?.name}</span>
                    {c.customers?.company && (
                      <span className="text-xs text-[#1B2A45]/50">{c.customers.company}</span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#C5A258]/15 text-[#C5A258] font-medium">
                      배정 대기
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-[#1B2A45]/50">
                    {c.customers?.phone && <span>{c.customers.phone}</span>}
                    {c.contract_amount > 0 && (
                      <span className="text-[#1B2A45]/70 font-medium">
                        {c.contract_amount.toLocaleString()}원
                      </span>
                    )}
                    <span>영업: {c.sales_user_name}</span>
                    <span>{fmtDate(c.created_at)}</span>
                  </div>
                  {c.memo && (
                    <p className="text-xs text-[#1B2A45]/50 mt-2 bg-[#FAF8F3] px-3 py-2 rounded-lg border border-[#E8E2D4]">
                      {c.memo}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedOps[c.id] || ''}
                    onChange={e => setSelectedOps(prev => ({ ...prev, [c.id]: e.target.value }))}
                    className={inputCls + ' min-w-[120px]'}
                  >
                    <option value="">담당자 선택</option>
                    {opsUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => assign(c.id)}
                    disabled={assigning === c.id || !selectedOps[c.id]}
                    className="px-4 py-2 rounded-lg bg-[#C5A258] hover:bg-[#C5A258]/90 disabled:opacity-40 text-white text-xs font-semibold transition-colors"
                  >
                    {assigning === c.id ? '배정 중...' : '배정'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Shared input class ───────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-[#E8E2D4] bg-white px-3 py-2 text-sm text-[#1B2A45] ' +
  'placeholder:text-[#1B2A45]/30 focus:outline-none focus:ring-2 focus:ring-[#C5A258]/40 focus:border-[#C5A258]'

// ── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#1B2A45]/60 mb-1">
        {label}
        {required && <span className="text-[#C5A258] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export default function AssignBoard() {
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [opsUsers, setOpsUsers] = useState<OpsUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  useEffect(() => {
    async function loadUsers() {
      setUsersLoading(true)
      try {
        const [sRes, oRes] = await Promise.all([
          fetch('/api/users?role=sales'),
          fetch('/api/users?role=ops'),
        ])
        const [sData, oData] = await Promise.all([sRes.json(), oRes.json()])
        setSalesUsers(sData.users || [])
        setOpsUsers(oData.users || [])
      } catch {
        // silently ignore — dropdowns will just be empty
      } finally {
        setUsersLoading(false)
      }
    }
    loadUsers()
  }, [])

  return (
    <div className="pb-12 space-y-0">
      {/* Section 1: 직접 공급 DB */}
      <SupplyDBSection salesUsers={usersLoading ? [] : salesUsers} />

      <Divider />

      {/* Section 2: 리드폼 DB */}
      <LeadDBSection salesUsers={usersLoading ? [] : salesUsers} />

      <Divider />

      {/* Section 3: 계약 배정 대기 */}
      <ContractAssignSection opsUsers={usersLoading ? [] : opsUsers} />
    </div>
  )
}
