'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────
interface SalesUser {
  id: string
  name: string
}

interface SupplyRecord {
  id: string
  received_date: string
  company_name: string
  region: string
  business_number: string
  customer_name: string
  phone: string
  industry: string
  last_year_revenue: number | null
  credit_score: number | null
  has_tax_arrears: boolean
  required_funds: number | null
  memo: string
  status: string
  assigned_user_id: string | null
  assigned_user_name: string | null
}

interface LeadCustomer {
  id: string
  created_at: string
  company: string
  name: string
  phone: string
  status: string
  notes: string | null
  sales_user_id: string | null
  sales_user_name: string | null
}

// ─── Loading skeleton ─────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-[#E8E2D4] rounded ${className}`} />
}

// ─── Supply DB Section ────────────────────────────────────
function SupplyDbSection({ salesUsers }: { salesUsers: SalesUser[] }) {
  const [records, setRecords] = useState<SupplyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<Record<string, string>>({})

  const emptyForm = {
    received_date: new Date().toISOString().slice(0, 10),
    company_name: '',
    region: '',
    business_number: '',
    customer_name: '',
    phone: '',
    industry: '',
    last_year_revenue: '',
    credit_score: '',
    has_tax_arrears: false,
    required_funds: '',
    memo: '',
  }
  const [form, setForm] = useState(emptyForm)

  async function loadRecords() {
    setLoading(true)
    try {
      const res = await fetch('/api/supply-db')
      const data = await res.json()
      setRecords(data.records ?? data.supply_db ?? [])
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRecords() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch('/api/supply-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          last_year_revenue: form.last_year_revenue ? Number(form.last_year_revenue) : null,
          credit_score: form.credit_score ? Number(form.credit_score) : null,
          required_funds: form.required_funds ? Number(form.required_funds) : null,
        }),
      })
      setForm(emptyForm)
      setShowForm(false)
      await loadRecords()
    } catch {
      // silently handle
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAssign(record: SupplyRecord) {
    const userId = selectedUser[record.id]
    if (!userId) return alert('담당자를 선택해주세요')
    const user = salesUsers.find(u => u.id === userId)
    setAssigningId(record.id)
    try {
      await fetch(`/api/supply-db/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_user_id: userId,
          assigned_user_name: user?.name,
          status: 'assigned',
        }),
      })
      await loadRecords()
    } catch {
      // silently handle
    } finally {
      setAssigningId(null)
    }
  }

  const unassigned = records.filter(r => !r.assigned_user_id)
  const assigned = records.filter(r => r.assigned_user_id)

  return (
    <section className="bg-white rounded-xl border border-[#E8E2D4] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-[#1B2A45]">직접 공급 DB</h2>
          <span className="text-xs bg-[#1B2A45]/10 text-[#1B2A45] px-2 py-0.5 rounded-full font-medium">
            전체 {records.length}건
          </span>
          {unassigned.length > 0 && (
            <span className="text-xs bg-[#C5A258]/10 text-[#C5A258] px-2 py-0.5 rounded-full font-medium">
              미배정 {unassigned.length}건
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
            showForm
              ? 'bg-[#1B2A45] text-white'
              : 'bg-[#C5A258] hover:bg-[#D4B568] text-white'
          }`}
        >
          {showForm ? '닫기' : '+ DB 추가'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="border border-[#E8E2D4] rounded-xl p-4 bg-[#FAF8F3] space-y-3">
          <h3 className="text-sm font-semibold text-[#1B2A45] mb-2">신규 DB 등록</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[#1B2A45]/60 font-medium mb-1 block">접수일자</label>
              <input
                type="date"
                value={form.received_date}
                onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] bg-white"
                required
              />
            </div>
            <div>
              <label className="text-xs text-[#1B2A45]/60 font-medium mb-1 block">상호명</label>
              <input
                type="text"
                placeholder="(주)예시"
                value={form.company_name}
                onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] bg-white"
                required
              />
            </div>
            <div>
              <label className="text-xs text-[#1B2A45]/60 font-medium mb-1 block">지역</label>
              <input
                type="text"
                placeholder="서울 강남구"
                value={form.region}
                onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#1B2A45]/60 font-medium mb-1 block">사업자등록번호</label>
              <input
                type="text"
                placeholder="000-00-00000"
                value={form.business_number}
                onChange={e => setForm(f => ({ ...f, business_number: e.target.value }))}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#1B2A45]/60 font-medium mb-1 block">고객명</label>
              <input
                type="text"
                placeholder="홍길동"
                value={form.customer_name}
                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] bg-white"
                required
              />
            </div>
            <div>
              <label className="text-xs text-[#1B2A45]/60 font-medium mb-1 block">연락처</label>
              <input
                type="text"
                placeholder="010-0000-0000"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#1B2A45]/60 font-medium mb-1 block">업종</label>
              <input
                type="text"
                placeholder="제조업"
                value={form.industry}
                onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#1B2A45]/60 font-medium mb-1 block">작년매출 (원)</label>
              <input
                type="number"
                placeholder="500000000"
                value={form.last_year_revenue}
                onChange={e => setForm(f => ({ ...f, last_year_revenue: e.target.value }))}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#1B2A45]/60 font-medium mb-1 block">신용점수</label>
              <input
                type="number"
                placeholder="700"
                min={0}
                max={1000}
                value={form.credit_score}
                onChange={e => setForm(f => ({ ...f, credit_score: e.target.value }))}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] bg-white"
              />
            </div>
            <div>
              <label className="text-xs text-[#1B2A45]/60 font-medium mb-1 block">필요자금 (원)</label>
              <input
                type="number"
                placeholder="100000000"
                value={form.required_funds}
                onChange={e => setForm(f => ({ ...f, required_funds: e.target.value }))}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] bg-white"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                id="tax-arrears"
                type="checkbox"
                checked={form.has_tax_arrears}
                onChange={e => setForm(f => ({ ...f, has_tax_arrears: e.target.checked }))}
                className="w-4 h-4 accent-[#C5A258]"
              />
              <label htmlFor="tax-arrears" className="text-sm text-[#1B2A45]/70">세금체납여부</label>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#1B2A45]/60 font-medium mb-1 block">메모</label>
            <textarea
              rows={3}
              placeholder="특이사항 입력..."
              value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] bg-white resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setForm(emptyForm); setShowForm(false) }}
              className="text-sm px-4 py-2 rounded-lg border border-[#E8E2D4] text-[#1B2A45]/70 hover:bg-[#FAF8F3] transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="text-sm px-4 py-2 rounded-lg bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-50 text-white font-medium transition-colors"
            >
              {submitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : records.length === 0 ? (
        <p className="text-sm text-[#1B2A45]/40 text-center py-8">등록된 공급 DB가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-[#E8E2D4]">
                {['접수일자', '상호명', '지역', '고객명', '연락처', '신용점수', '세금체납', '담당자'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-[#1B2A45]/50 font-medium whitespace-nowrap">{h}</th>
                ))}
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {records.map(rec => (
                <tr key={rec.id} className="border-b border-[#E8E2D4]/60 hover:bg-[#FAF8F3] transition-colors">
                  <td className="py-2.5 px-3 text-xs text-[#1B2A45]/60 whitespace-nowrap">
                    {rec.received_date ? new Date(rec.received_date).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-[#1B2A45] whitespace-nowrap">{rec.company_name}</td>
                  <td className="py-2.5 px-3 text-[#1B2A45]/70">{rec.region || '-'}</td>
                  <td className="py-2.5 px-3 text-[#1B2A45]/80">{rec.customer_name}</td>
                  <td className="py-2.5 px-3 text-[#1B2A45]/60 whitespace-nowrap">{rec.phone || '-'}</td>
                  <td className="py-2.5 px-3 text-[#1B2A45]/70">{rec.credit_score ?? '-'}</td>
                  <td className="py-2.5 px-3">
                    {rec.has_tax_arrears
                      ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">체납</span>
                      : <span className="text-xs text-[#1B2A45]/30">-</span>
                    }
                  </td>
                  <td className="py-2.5 px-3">
                    {rec.assigned_user_name
                      ? <span className="text-xs bg-[#1B2A45]/10 text-[#1B2A45] px-2 py-0.5 rounded-full font-medium">{rec.assigned_user_name}</span>
                      : salesUsers.length > 0
                        ? (
                          <select
                            value={selectedUser[rec.id] ?? ''}
                            onChange={e => setSelectedUser(prev => ({ ...prev, [rec.id]: e.target.value }))}
                            className="border border-[#E8E2D4] rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#C5A258]"
                          >
                            <option value="">담당자 선택</option>
                            {salesUsers.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        )
                        : <span className="text-xs text-[#1B2A45]/30">-</span>
                    }
                  </td>
                  <td className="py-2.5 px-3">
                    {!rec.assigned_user_name && (
                      <button
                        onClick={() => handleAssign(rec)}
                        disabled={assigningId === rec.id || !selectedUser[rec.id]}
                        className="text-xs bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-40 text-white px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap"
                      >
                        {assigningId === rec.id ? '배정 중...' : '배정'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ─── Lead Form DB Section ─────────────────────────────────
function LeadFormSection({ salesUsers }: { salesUsers: SalesUser[] }) {
  const [leads, setLeads] = useState<LeadCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<Record<string, string>>({})

  async function loadLeads() {
    setLoading(true)
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      const all: LeadCustomer[] = data.customers ?? []
      setLeads(all.filter(c => c.status === 'lead'))
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadLeads() }, [])

  async function handleAssign(customer: LeadCustomer) {
    const userId = selectedUser[customer.id]
    if (!userId) return alert('담당자를 선택해주세요')
    const user = salesUsers.find(u => u.id === userId)
    setAssigningId(customer.id)
    try {
      await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_user_id: userId,
          sales_user_name: user?.name,
          status: 'consulting',
        }),
      })
      await loadLeads()
    } catch {
      // silently handle
    } finally {
      setAssigningId(null)
    }
  }

  const unassigned = leads.filter(l => !l.sales_user_id)

  return (
    <section className="bg-white rounded-xl border border-[#E8E2D4] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="font-semibold text-[#1B2A45]">리드폼 DB</h2>
        <span className="text-xs text-[#1B2A45]/50">홈페이지 신청</span>
        <span className="text-xs bg-[#1B2A45]/10 text-[#1B2A45] px-2 py-0.5 rounded-full font-medium">
          전체 {leads.length}건
        </span>
        {unassigned.length > 0 && (
          <span className="text-xs bg-[#C5A258]/10 text-[#C5A258] px-2 py-0.5 rounded-full font-medium">
            미배정 {unassigned.length}건
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : leads.length === 0 ? (
        <p className="text-sm text-[#1B2A45]/40 text-center py-8">홈페이지 신청 리드가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-[#E8E2D4]">
                {['접수일자', '상호명', '고객명', '연락처', '세금체납', '담당자'].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-[#1B2A45]/50 font-medium whitespace-nowrap">{h}</th>
                ))}
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => {
                // Try to extract tax info from notes field
                const hasTax = lead.notes?.includes('체납') || lead.notes?.includes('tax_arrears: true')

                return (
                  <tr key={lead.id} className="border-b border-[#E8E2D4]/60 hover:bg-[#FAF8F3] transition-colors">
                    <td className="py-2.5 px-3 text-xs text-[#1B2A45]/60 whitespace-nowrap">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#1B2A45] whitespace-nowrap">{lead.company || '-'}</td>
                    <td className="py-2.5 px-3 text-[#1B2A45]/80">{lead.name}</td>
                    <td className="py-2.5 px-3 text-[#1B2A45]/60 whitespace-nowrap">{lead.phone || '-'}</td>
                    <td className="py-2.5 px-3">
                      {hasTax
                        ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">체납</span>
                        : <span className="text-xs text-[#1B2A45]/30">-</span>
                      }
                    </td>
                    <td className="py-2.5 px-3">
                      {lead.sales_user_name
                        ? <span className="text-xs bg-[#1B2A45]/10 text-[#1B2A45] px-2 py-0.5 rounded-full font-medium">{lead.sales_user_name}</span>
                        : salesUsers.length > 0
                          ? (
                            <select
                              value={selectedUser[lead.id] ?? ''}
                              onChange={e => setSelectedUser(prev => ({ ...prev, [lead.id]: e.target.value }))}
                              className="border border-[#E8E2D4] rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#C5A258]"
                            >
                              <option value="">담당자 선택</option>
                              {salesUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                          )
                          : <span className="text-xs text-[#1B2A45]/30">-</span>
                      }
                    </td>
                    <td className="py-2.5 px-3">
                      {!lead.sales_user_name && (
                        <button
                          onClick={() => handleAssign(lead)}
                          disabled={assigningId === lead.id || !selectedUser[lead.id]}
                          className="text-xs bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-40 text-white px-3 py-1 rounded-lg font-medium transition-colors whitespace-nowrap"
                        >
                          {assigningId === lead.id ? '배정 중...' : '배정'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ─── Main component ───────────────────────────────────────
export default function AssignBoard() {
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  useEffect(() => {
    fetch('/api/users?role=sales')
      .then(r => r.json())
      .then(data => setSalesUsers(data.users ?? []))
      .catch(() => setSalesUsers([]))
      .finally(() => setUsersLoading(false))
  }, [])

  return (
    <div className="space-y-6 pb-8">
      {usersLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          <SupplyDbSection salesUsers={salesUsers} />
          <LeadFormSection salesUsers={salesUsers} />
        </>
      )}
    </div>
  )
}
