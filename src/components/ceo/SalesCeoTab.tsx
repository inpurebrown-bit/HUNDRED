'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────
interface Notice {
  id: string
  title: string
  content: string
  type: 'daily' | 'weekly' | 'monthly' | 'promo' | 'general'
  target: 'all' | 'sales' | 'ops'
  expires_at: string | null
  created_at: string
}

interface Customer {
  id: string
  name: string
  company: string
  phone: string
  status: 'lead' | 'consulting' | 'contracted'
  sales_user_name: string
  notes: string
  loan_history: string
  created_at: string
}

interface Contract {
  id: string
  customer_id: string
  sales_user_name: string
  contract_amount: number
  status: string
  created_at: string
  customers: { name: string; company: string; phone: string }
}

// ─── Helpers ──────────────────────────────────────────────
const NOTICE_STYLES: Record<string, string> = {
  daily:   'bg-amber-50 border-amber-200 text-amber-800',
  weekly:  'bg-blue-50 border-blue-200 text-blue-800',
  monthly: 'bg-violet-50 border-violet-200 text-violet-800',
  promo:   'bg-[#C5A258]/10 border-[#C5A258]/30 text-[#1B2A45]',
  general: 'bg-white border-[#E8E2D4] text-[#1B2A45]/70',
}

const NOTICE_TYPE_LABEL: Record<string, string> = {
  daily: '일별', weekly: '주별', monthly: '월별', promo: '프로모션', general: '일반',
}

const STATUS_BADGE: Record<string, string> = {
  lead:       'bg-sky-100 text-sky-700',
  consulting: 'bg-amber-100 text-amber-700',
  contracted: 'bg-emerald-100 text-emerald-700',
}
const STATUS_LABEL: Record<string, string> = {
  lead: '리드', consulting: '상담중', contracted: '계약완료',
}

const CONTRACT_STATUS_BADGE: Record<string, string> = {
  pending_assign: 'bg-amber-100 text-amber-700',
  assigned:       'bg-emerald-100 text-emerald-700',
}
const CONTRACT_STATUS_LABEL: Record<string, string> = {
  pending_assign: '배정대기',
  assigned:       '배정완료',
}

function fmt(n: number) {
  if (!n) return '-'
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억원'
  if (n >= 10_000) return (n / 10_000).toFixed(0) + '만원'
  return n.toLocaleString() + '원'
}

// ─── Section 1: 공지 관리 ─────────────────────────────────
function NoticesSection() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '', content: '', type: 'general', target: 'all', expires_at: '',
  })

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/notices?team=sales')
      const data = await res.json()
      setNotices(data.notices || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.content.trim()) return
    setSubmitting(true)
    try {
      await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          expires_at: form.expires_at || null,
        }),
      })
      setForm({ title: '', content: '', type: 'general', target: 'all', expires_at: '' })
      setShowForm(false)
      load()
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/notices?id=${id}`, { method: 'DELETE' })
      setNotices(prev => prev.filter(n => n.id !== id))
    } catch {
      // silent
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-[#1B2A45] text-base">공지 관리</h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-[#1B2A45] hover:bg-[#1B2A45]/90 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <span className="text-sm leading-none">+</span>
          공지 추가
        </button>
      </div>

      {/* Active notice banners */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-14 rounded-xl bg-[#E8E2D4] animate-pulse" />
          ))}
        </div>
      ) : notices.length === 0 ? (
        <div className="rounded-xl border border-[#E8E2D4] bg-white p-6 text-center text-sm text-[#1B2A45]/40">
          등록된 공지가 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {notices.map(n => (
            <div
              key={n.id}
              className={`border rounded-xl px-4 py-3 flex items-start gap-3 ${NOTICE_STYLES[n.type] ?? NOTICE_STYLES.general}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {NOTICE_TYPE_LABEL[n.type] ?? n.type}
                  </span>
                  {n.expires_at && (
                    <span className="text-[10px] opacity-60">
                      ~ {new Date(n.expires_at).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold leading-snug">{n.title}</p>
                <p className="text-xs mt-0.5 opacity-80 whitespace-pre-wrap">{n.content}</p>
              </div>
              <button
                onClick={() => handleDelete(n.id)}
                disabled={deleting === n.id}
                className="shrink-0 text-xs opacity-50 hover:opacity-100 transition-opacity font-medium px-2 py-0.5 rounded border border-current disabled:opacity-30"
              >
                {deleting === n.id ? '삭제중' : '삭제'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add notice form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[#E8E2D4] rounded-xl p-4 space-y-3"
        >
          <p className="text-sm font-semibold text-[#1B2A45]">새 공지 작성</p>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="제목"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/30"
              required
            />
            <textarea
              placeholder="내용"
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              rows={3}
              className="w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/30 resize-none"
              required
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className="text-xs text-[#1B2A45]/50 mb-1 block">유형</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-[#E8E2D4] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/30"
                >
                  <option value="daily">일별</option>
                  <option value="weekly">주별</option>
                  <option value="monthly">월별</option>
                  <option value="promo">프로모션</option>
                  <option value="general">일반</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[#1B2A45]/50 mb-1 block">대상</label>
                <select
                  value={form.target}
                  onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                  className="w-full border border-[#E8E2D4] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/30"
                >
                  <option value="all">전체</option>
                  <option value="sales">영업팀</option>
                  <option value="ops">관리팀</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-[#1B2A45]/50 mb-1 block">종료일 (선택)</label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full border border-[#E8E2D4] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/30"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 text-sm text-[#1B2A45]/60 hover:text-[#1B2A45] border border-[#E8E2D4] rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-sm bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {submitting ? '등록 중...' : '공지 등록'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

// ─── Section 2: 결제율 공급 기준표 ───────────────────────
function PayRateInfoSection() {
  return (
    <section>
      <h2 className="font-semibold text-[#1B2A45] text-base mb-3">결제율 공급 기준표</h2>
      <div className="bg-[#1B2A45] text-white rounded-xl p-4 text-sm leading-relaxed">
        영업일 기준 2일째까지 5개씩 지급&nbsp;&nbsp;|&nbsp;&nbsp;
        결제율 <strong>20%이상</strong> 6개&nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>17%이상</strong> 5개&nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>15%이상</strong> 4개&nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>13%이상</strong> 2개&nbsp;&nbsp;|&nbsp;&nbsp;
        <strong>13%이하</strong> 0개
      </div>
    </section>
  )
}

// ─── Section 3: 영업팀 전체 고객 현황 ────────────────────
function SalesCustomersSection() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null)
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [cRes, conRes] = await Promise.all([
          fetch('/api/customers'),
          fetch('/api/contracts'),
        ])
        const [cData, conData] = await Promise.all([cRes.json(), conRes.json()])
        setCustomers(cData.customers || [])
        setContracts(conData.contracts || [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const now = new Date()
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Group customers by sales_user_name
  const byPerson = customers.reduce<Record<string, Customer[]>>((acc, c) => {
    const key = c.sales_user_name || '미배정'
    if (!acc[key]) acc[key] = []
    acc[key].push(c)
    return acc
  }, {})

  const people = Object.keys(byPerson).sort()

  if (loading) {
    return (
      <section className="space-y-3">
        <h2 className="font-semibold text-[#1B2A45] text-base">영업팀 전체 고객 현황</h2>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-[#E8E2D4] animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-[#1B2A45] text-base">
        영업팀 전체 고객 현황
        <span className="ml-2 text-sm font-normal text-[#1B2A45]/50">({customers.length}명)</span>
      </h2>

      {people.length === 0 ? (
        <div className="bg-white border border-[#E8E2D4] rounded-xl p-8 text-center text-sm text-[#1B2A45]/40">
          등록된 고객이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {people.map(name => {
            const personCustomers = byPerson[name]
            const personContracts = contracts.filter(c => c.sales_user_name === name)
            const thisMonthContracts = personContracts.filter(c =>
              c.created_at?.slice(0, 7) === thisMonthStr
            )
            const isPersonOpen = expandedPerson === name

            return (
              <div key={name} className="bg-white border border-[#E8E2D4] rounded-xl overflow-hidden">
                {/* Person header card */}
                <button
                  onClick={() => setExpandedPerson(isPersonOpen ? null : name)}
                  className="w-full text-left px-4 py-4 hover:bg-[#FAF8F3] transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#1B2A45] flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-[#1B2A45] text-sm">{name}</p>
                        <p className="text-xs text-[#1B2A45]/50 mt-0.5">영업담당</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-lg font-black text-[#1B2A45]">{personCustomers.length}</p>
                        <p className="text-[10px] text-[#1B2A45]/50">총고객</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-black text-[#1B2A45]">{personContracts.length}</p>
                        <p className="text-[10px] text-[#1B2A45]/50">계약수</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-black text-[#C5A258]">{thisMonthContracts.length}</p>
                        <p className="text-[10px] text-[#1B2A45]/50">이번달계약</p>
                      </div>
                      <span className="text-[#1B2A45]/40 text-sm">
                        {isPersonOpen ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Customer list */}
                {isPersonOpen && (
                  <div className="border-t border-[#E8E2D4]">
                    {personCustomers.length === 0 ? (
                      <p className="text-sm text-[#1B2A45]/40 text-center py-4">담당 고객 없음</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-[#E8E2D4] bg-[#FAF8F3]">
                              {['고객명', '회사', '상태', '연락처', '등록일', ''].map(h => (
                                <th key={h} className="text-left py-2 px-3 text-xs text-[#1B2A45]/50 font-medium whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {personCustomers.map(c => {
                              const isCustOpen = expandedCustomer === c.id
                              return (
                                <>
                                  <tr
                                    key={c.id}
                                    onClick={() => setExpandedCustomer(isCustOpen ? null : c.id)}
                                    className="border-b border-[#E8E2D4]/60 hover:bg-[#FAF8F3] transition-colors cursor-pointer"
                                  >
                                    <td className="py-2.5 px-3 font-medium text-[#1B2A45]">{c.name}</td>
                                    <td className="py-2.5 px-3 text-[#1B2A45]/70">{c.company || '-'}</td>
                                    <td className="py-2.5 px-3">
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                        {STATUS_LABEL[c.status] ?? c.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-[#1B2A45]/60 text-xs">{c.phone || '-'}</td>
                                    <td className="py-2.5 px-3 text-[#1B2A45]/50 text-xs">
                                      {c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR') : '-'}
                                    </td>
                                    <td className="py-2.5 px-3 text-[#1B2A45]/40 text-xs">
                                      {isCustOpen ? '▲' : '▼'}
                                    </td>
                                  </tr>
                                  {isCustOpen && (
                                    <tr key={`${c.id}-detail`} className="bg-[#FAF8F3]">
                                      <td colSpan={6} className="px-4 py-3">
                                        <div className="space-y-2 text-xs text-[#1B2A45]/80">
                                          {c.notes && (
                                            <div>
                                              <span className="font-semibold text-[#1B2A45]">메모: </span>
                                              <span className="whitespace-pre-wrap">{c.notes}</span>
                                            </div>
                                          )}
                                          {c.loan_history && (
                                            <div>
                                              <span className="font-semibold text-[#1B2A45]">대출 이력: </span>
                                              <span className="whitespace-pre-wrap">{c.loan_history}</span>
                                            </div>
                                          )}
                                          {!c.notes && !c.loan_history && (
                                            <span className="text-[#1B2A45]/40">추가 정보 없음</span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── Section 4: 계약 현황 ─────────────────────────────────
function ContractsSection() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/contracts')
      .then(r => r.json())
      .then(d => {
        setContracts(d.contracts || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-[#1B2A45] text-base">
        계약 현황
        <span className="ml-2 text-sm font-normal text-[#1B2A45]/50">({contracts.length}건)</span>
      </h2>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 rounded-xl bg-[#E8E2D4] animate-pulse" />
          ))}
        </div>
      ) : contracts.length === 0 ? (
        <div className="bg-white border border-[#E8E2D4] rounded-xl p-8 text-center text-sm text-[#1B2A45]/40">
          등록된 계약이 없습니다.
        </div>
      ) : (
        <div className="bg-white border border-[#E8E2D4] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E2D4] bg-[#FAF8F3]">
                  {['고객명', '회사', '영업담당', '계약금액', '상태', '계약일'].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs text-[#1B2A45]/50 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map(c => (
                  <tr key={c.id} className="border-b border-[#E8E2D4]/60 hover:bg-[#FAF8F3] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[#1B2A45]">
                      {c.customers?.name || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-[#1B2A45]/70">
                      {c.customers?.company || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-[#1B2A45]/70">
                      {c.sales_user_name || '-'}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#1B2A45]">
                      {fmt(c.contract_amount)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        CONTRACT_STATUS_BADGE[c.status] ?? 'bg-gray-100 text-gray-600'
                      }`}>
                        {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#1B2A45]/50 text-xs">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Main export ──────────────────────────────────────────
export default function SalesCeoTab() {
  return (
    <div className="space-y-8 pb-10">
      <NoticesSection />
      <PayRateInfoSection />
      <SalesCustomersSection />
      <ContractsSection />
    </div>
  )
}
