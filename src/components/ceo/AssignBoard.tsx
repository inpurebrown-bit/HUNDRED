'use client'

import { useState, useEffect, useCallback, FormEvent, ReactNode } from 'react'

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
  const [form, setForm] = useState<SupplyFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
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

  function handleFormChange(field: keyof SupplyFormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim()) return
    setSubmitting(true)
    try {
      const selectedUser = salesUsers.find(u => u.id === form.assigned_user_id)
      const body = {
        reception_date: form.reception_date,
        company_name: form.company_name.trim(),
        region: form.region.trim(),
        business_number: form.business_number.trim(),
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        industry: form.industry.trim(),
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '등록 실패')
      setForm({ ...EMPTY_FORM, reception_date: today() })
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

      {/* Collapsible form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-[#E8E2D4] p-5 mb-5 space-y-4"
        >
          <p className="text-sm font-semibold text-[#1B2A45]">신규 공급 DB 등록</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="접수일자" required>
              <input
                type="date"
                value={form.reception_date}
                onChange={e => handleFormChange('reception_date', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="상호명" required>
              <input
                type="text"
                placeholder="주식회사 예시"
                value={form.company_name}
                onChange={e => handleFormChange('company_name', e.target.value)}
                required
                className={inputCls}
              />
            </Field>
            <Field label="지역">
              <input
                type="text"
                placeholder="서울, 경기..."
                value={form.region}
                onChange={e => handleFormChange('region', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="사업자등록번호">
              <input
                type="text"
                placeholder="000-00-00000"
                value={form.business_number}
                onChange={e => handleFormChange('business_number', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="고객명">
              <input
                type="text"
                placeholder="홍길동"
                value={form.customer_name}
                onChange={e => handleFormChange('customer_name', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="연락처">
              <input
                type="text"
                placeholder="010-0000-0000"
                value={form.phone}
                onChange={e => handleFormChange('phone', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="업종">
              <input
                type="text"
                placeholder="제조, 도소매..."
                value={form.industry}
                onChange={e => handleFormChange('industry', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="작년 매출 (만원)">
              <input
                type="number"
                placeholder="5000"
                min={0}
                value={form.last_year_revenue}
                onChange={e => handleFormChange('last_year_revenue', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="신용점수">
              <input
                type="number"
                placeholder="700"
                min={0}
                max={1000}
                value={form.credit_score}
                onChange={e => handleFormChange('credit_score', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="세금체납여부">
              <select
                value={form.tax_delinquent}
                onChange={e => handleFormChange('tax_delinquent', e.target.value)}
                className={inputCls}
              >
                <option value="없음">없음</option>
                <option value="있음">있음</option>
              </select>
            </Field>
            <Field label="필요자금 (만원)">
              <input
                type="number"
                placeholder="10000"
                min={0}
                value={form.required_funds}
                onChange={e => handleFormChange('required_funds', e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="담당자 배정">
              <select
                value={form.assigned_user_id}
                onChange={e => handleFormChange('assigned_user_id', e.target.value)}
                className={inputCls}
              >
                <option value="">미배정</option>
                {salesUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="메모">
            <textarea
              rows={2}
              placeholder="특이사항, 메모..."
              value={form.notes}
              onChange={e => handleFormChange('notes', e.target.value)}
              className={inputCls + ' resize-none'}
            />
          </Field>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting || !form.company_name.trim()}
              className="px-5 py-2 rounded-lg bg-[#C5A258] text-white text-sm font-semibold hover:bg-[#C5A258]/90 disabled:opacity-40 transition-colors"
            >
              {submitting ? '저장 중...' : '등록'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM, reception_date: today() }) }}
              className="px-5 py-2 rounded-lg border border-[#E8E2D4] text-[#1B2A45]/60 text-sm hover:bg-[#FAF8F3] transition-colors"
            >
              취소
            </button>
          </div>
        </form>
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
