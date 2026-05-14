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

function SectionHeader({ title, subtitle, count, action }: { title: string; subtitle: string; count?: number; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-lg font-bold text-[#1B2A45]">{title}</h2>
        <p className="text-sm text-[#1B2A45]/50 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        {action}
        {count !== undefined && (
          <span className="text-xs text-[#1B2A45]/40 tabular-nums">{count}건</span>
        )}
      </div>
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
// SECTION 0 — 한경연 DB
// ════════════════════════════════════════════════════════════════════════════

interface HankyungEntry {
  id: string
  company: string
  name: string
  phone: string
  status: string
  sales_user_name: string | null
  sales_user_id: string | null
  created_at: string
  details?: Record<string, any>
}

const EMPTY_HK = {
  company: '', name: '', phone: '',
  business_no: '', industry: '', region: '',
  date: today(), revenue: '', credit: '',
  assign_id: '',
}

function HankyungDBSection({ salesUsers }: { salesUsers: SalesUser[] }) {
  const [entries, setEntries] = useState<HankyungEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_HK })
  const [assignSelect, setAssignSelect] = useState<Record<string, string>>({})
  const [patching, setPatching] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  // 재배정 모드 — 이미 배정된 항목도 담당자 변경 가능
  const [reassignMode, setReassignMode] = useState<Record<string, boolean>>({})

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      const all: HankyungEntry[] = data.customers || []
      // 한경연 DB: db010 상태 전체 + status=lead & db_source=한경연
      setEntries(all.filter(c =>
        c.status === 'db010' ||
        (c.status === 'lead' && (c as any).details?.db_source === '한경연')
      ))
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.company || !form.name || !form.phone) return alert('업체명, 대표명, 연락처는 필수입니다')
    setSubmitting(true)
    try {
      const selectedUser = salesUsers.find(u => u.id === form.assign_id)
      const body: Record<string, any> = {
        name: form.name,
        phone: form.phone,
        company: form.company,
        status: 'lead',
        details: {
          db_source: '한경연',
          business_reg_no: form.business_no,
          business_type: form.industry,
          region: form.region,
          reception_date: form.date,
          revenue_2025: form.revenue,
          credit_nice: form.credit,
        },
      }
      if (selectedUser) {
        body.sales_user_id = form.assign_id
        body.sales_user_name = selectedUser.name
      }
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '등록 실패')
      setForm({ ...EMPTY_HK })
      setShowForm(false)
      const assignedTo = selectedUser ? ` → ${selectedUser.name} 배정` : ' (미배정)'
      setToast(`등록 완료${assignedTo}`)
      setTimeout(() => setToast(null), 3000)
      load()
    } catch (e: any) { alert(e.message) } finally { setSubmitting(false) }
  }

  // 배정 / 재배정 공통 함수
  async function handleAssign(id: string, currentName?: string | null) {
    const userId = assignSelect[id] ?? ''
    if (!userId) { alert('담당자를 선택하세요'); return }
    const selectedUser = salesUsers.find(u => u.id === userId)
    if (!selectedUser) { alert('선택한 담당자를 찾을 수 없습니다'); return }

    const confirmMsg = currentName
      ? `"${currentName}" → "${selectedUser.name}" 으로 변경하시겠습니까?\n(담당자 변경 시 팀장의 010DB 탭에 즉시 반영됩니다)`
      : `"${selectedUser.name}" 에게 배정하시겠습니까?`
    if (!confirm(confirmMsg)) return

    setPatching(id)
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sales_user_id: selectedUser.id,
          sales_user_name: selectedUser.name,
          status: 'lead',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || '배정 실패')
      setReassignMode(p => ({ ...p, [id]: false }))
      setToast(`✅ ${selectedUser.name} 배정 완료`)
      setTimeout(() => setToast(null), 3000)
      load()
    } catch (e: any) { alert(e.message) } finally { setPatching(null) }
  }

  const inp = 'w-full border border-[#E8E2D4] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258]/40 bg-white'
  const lbl = 'block text-[11px] font-semibold text-[#1B2A45]/50 mb-1'

  return (
    <div>
      <SectionHeader
        title="한경연 DB"
        subtitle="내부 DB — 담당자 배정 후 전화 인콜"
        count={entries.length}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed(v => !v)}
              className="px-3 py-2 bg-gray-100 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              {collapsed ? '▼ 펼치기' : '▲ 접기'}
            </button>
            <button
              onClick={() => setShowForm(v => !v)}
              className="px-4 py-2 bg-[#1B2A45] text-white text-xs font-semibold rounded-xl hover:bg-[#2D4070] transition-colors"
            >
              {showForm ? '✕ 닫기' : '+ 한경연 DB 추가'}
            </button>
          </div>
        }
      />

      {toast && (
        <div className="mb-3 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
          ✅ {toast}
        </div>
      )}

      {/* 등록 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E8E2D4] shadow-sm p-5 mb-4">
          <p className="text-xs font-bold text-[#1B2A45] mb-4">📋 한경연 DB 등록</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className={lbl}>업체명 *</label>
              <input className={inp} value={form.company} onChange={e => set('company', e.target.value)} placeholder="업체명" required />
            </div>
            <div>
              <label className={lbl}>대표명 *</label>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="대표자명" required />
            </div>
            <div>
              <label className={lbl}>연락처 *</label>
              <input className={inp} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="010-0000-0000" required />
            </div>
            <div>
              <label className={lbl}>사업자번호</label>
              <input className={inp} value={form.business_no} onChange={e => set('business_no', e.target.value)} placeholder="000-00-00000" />
            </div>
            <div>
              <label className={lbl}>업종</label>
              <input className={inp} value={form.industry} onChange={e => set('industry', e.target.value)} placeholder="업종" />
            </div>
            <div>
              <label className={lbl}>지역</label>
              <input className={inp} value={form.region} onChange={e => set('region', e.target.value)} placeholder="서울/경기 등" />
            </div>
            <div>
              <label className={lbl}>접수일</label>
              <input type="date" className={inp} value={form.date} onChange={e => set('date', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>작년 매출</label>
              <input className={inp} value={form.revenue} onChange={e => set('revenue', e.target.value)} placeholder="예: 3억" />
            </div>
            <div>
              <label className={lbl}>NICE 신용점수</label>
              <input className={inp} value={form.credit} onChange={e => set('credit', e.target.value)} placeholder="예: 720" />
            </div>
          </div>
          {/* 담당자 배정 */}
          <div className="flex items-end gap-3 pt-2 border-t border-[#F0EDE6]">
            <div className="flex-1">
              <label className={lbl}>담당자 배정 <span className="text-red-400 font-normal">(미배정 시 팀장 010DB에 안 들어감)</span></label>
              <select className={inp} value={form.assign_id} onChange={e => set('assign_id', e.target.value)}>
                <option value="">-- 담당자 선택 (필수 권장) --</option>
                {salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 bg-[#1B2A45] text-white text-sm font-semibold rounded-xl hover:bg-[#2D4070] transition-colors disabled:opacity-50"
            >
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      )}

      {/* 목록 */}
      {!collapsed && (loading ? <LoadingBlock /> : entries.length === 0 ? (
        <EmptyBlock message="등록된 한경연 DB가 없습니다." />
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E2D4] shadow-sm overflow-hidden">
          {/* 헤더 */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[#F8F6F1] border-b border-[#E8E2D4] text-[10px] font-semibold text-[#1B2A45]/50">
            <div className="col-span-3">업체명 / 대표</div>
            <div className="col-span-2">연락처</div>
            <div className="col-span-2">업종 / 지역</div>
            <div className="col-span-2">매출 / 신용</div>
            <div className="col-span-3">담당자 배정</div>
          </div>
          <div className="divide-y divide-[#F0EDE6]">
            {entries.map(e => {
              const isReassign = reassignMode[e.id] ?? false
              return (
              <div key={e.id}>
                <div
                  className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-[#FAF8F3] cursor-pointer"
                  onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                >
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm font-semibold text-[#1B2A45] truncate">{(e as any).details?.company || e.company || e.name}</p>
                    <p className="text-[11px] text-[#1B2A45]/50">{e.name}</p>
                  </div>
                  <div className="col-span-2 text-xs text-gray-600">{e.phone}</div>
                  <div className="col-span-2 min-w-0">
                    <p className="text-xs text-gray-600 truncate">{(e as any).details?.business_type || '-'}</p>
                    <p className="text-[11px] text-gray-400">{(e as any).details?.region || '-'}</p>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <p className="text-xs text-gray-600">{(e as any).details?.revenue_2025 || '-'}</p>
                    <p className="text-[11px] text-gray-400">{(e as any).details?.credit_nice || '-'}</p>
                  </div>
                  {/* 담당자 배정 컬럼 */}
                  <div className="col-span-3 flex items-center gap-1.5" onClick={ev => ev.stopPropagation()}>
                    {e.sales_user_name && !isReassign ? (
                      // 이미 배정됨 — 이름 + 변경 버튼
                      <div className="flex items-center gap-1.5 w-full">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold flex-1 text-center">
                          ✓ {e.sales_user_name}
                        </span>
                        <button
                          onClick={() => {
                            setReassignMode(p => ({ ...p, [e.id]: true }))
                            setAssignSelect(p => ({ ...p, [e.id]: '' }))
                          }}
                          className="px-2 py-1 text-[10px] bg-orange-50 text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-100 font-semibold"
                        >
                          변경
                        </button>
                      </div>
                    ) : (
                      // 미배정 또는 재배정 모드
                      <div className="flex items-center gap-1.5 w-full">
                        {isReassign && (
                          <button
                            onClick={() => setReassignMode(p => ({ ...p, [e.id]: false }))}
                            className="text-[10px] text-gray-400 hover:text-gray-600 px-1"
                          >✕</button>
                        )}
                        <select
                          className="flex-1 border border-[#E8E2D4] rounded-lg px-2 py-1.5 text-xs focus:outline-none min-w-0"
                          value={assignSelect[e.id] ?? ''}
                          onChange={ev => setAssignSelect(p => ({ ...p, [e.id]: ev.target.value }))}
                        >
                          <option value="">{isReassign ? '변경할 담당자' : '담당자 선택'}</option>
                          {salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <button
                          onClick={() => handleAssign(e.id, isReassign ? e.sales_user_name : null)}
                          disabled={!assignSelect[e.id] || patching === e.id}
                          className={"px-3 py-1.5 text-white text-xs font-semibold rounded-lg disabled:opacity-40 " + (isReassign ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#1B2A45] hover:bg-[#2D4070]')}
                        >
                          {patching === e.id ? '...' : isReassign ? '변경' : '배정'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* 상세 */}
                {expandedId === e.id && (
                  <div className="px-4 pb-3 grid grid-cols-4 gap-2 bg-[#FAF8F3] text-[11px]">
                    {[
                      ['사업자번호', (e as any).details?.business_reg_no],
                      ['업종', (e as any).details?.business_type],
                      ['지역', (e as any).details?.region],
                      ['접수일', (e as any).details?.reception_date],
                      ['작년매출', (e as any).details?.revenue_2025],
                      ['NICE점수', (e as any).details?.credit_nice],
                    ].map(([label, val]) => (
                      <div key={label as string} className="bg-white rounded-lg px-3 py-2 border border-[#E8E2D4]">
                        <p className="text-[10px] text-[#1B2A45]/40 mb-0.5">{label}</p>
                        <p className="font-semibold text-[#1B2A45]">{val || '-'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </div>
      ))}
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
        status: 'lead',  // #8: 대표 공급 DB는 신규업체(lead) 탭으로
        details: { ...data, db_source: 'ceo_supply' },
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
  const [migrating, setMigrating] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function toast_(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '불러오기 실패')
      const all: LeadCustomer[] = data.customers || []
      // 홈페이지 문의 유입만 표시 (source='lead_form' 또는 details.db_source='홈페이지문의')
      setLeads(all.filter(c =>
        c.status === 'lead' && (
          (c as any).source === 'lead_form' ||
          (c as any).details?.db_source === '홈페이지문의' ||
          // 기존 데이터 호환: db_source가 없는 lead는 일단 포함
          !(c as any).details?.db_source
        )
      ))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // 단건 한경연DB로 이동
  async function moveToHankyung(id: string) {
    setPatching(id)
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'db010',
          details: { db_source: '한경연', sub_status: 'db010' },
        }),
      })
      if (!res.ok) throw new Error('이동 실패')
      toast_('✅ 한경연DB로 이동 완료')
      load()
    } catch (e: any) { alert(e.message) } finally { setPatching(null) }
  }

  // 전체 이동
  async function migrateAllToHankyung() {
    if (!leads.length) return
    if (!confirm(`리드폼 ${leads.length}건을 모두 한경연DB로 이동하시겠습니까?`)) return
    setMigrating(true)
    let ok = 0
    for (const lead of leads) {
      try {
        await fetch(`/api/customers/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'db010',
            details: { db_source: '한경연', sub_status: 'db010' },
          }),
        })
        ok++
      } catch {}
    }
    setMigrating(false)
    toast_(`✅ ${ok}건 한경연DB로 이동 완료`)
    load()
  }

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
      {toast && (
        <div className="mb-3 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
          {toast}
        </div>
      )}
      <SectionHeader
        title="리드폼 DB"
        subtitle="홈페이지 상담신청 유입 DB"
        count={leads.length}
        action={leads.length > 0 ? (
          <button
            onClick={migrateAllToHankyung}
            disabled={migrating}
            className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-40 transition-colors"
          >
            {migrating ? '이동 중...' : `전체 한경연DB로 이동 (${leads.length}건)`}
          </button>
        ) : undefined}
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
                      <button
                        onClick={() => moveToHankyung(lead.id)}
                        disabled={patching === lead.id}
                        className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium disabled:opacity-40 transition-colors"
                      >
                        한경연DB로 이동
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
      {/* Section 0: 한경연 DB (최상단) */}
      <HankyungDBSection salesUsers={usersLoading ? [] : salesUsers} />

      <Divider />

      {/* Section 1: 직접 공급 DB */}
      <SupplyDBSection salesUsers={usersLoading ? [] : salesUsers} />

      <Divider />

      {/* Section 2: 리드폼 DB (홈페이지 유입) */}
      <LeadDBSection salesUsers={usersLoading ? [] : salesUsers} />

      <Divider />

    </div>
  )
}
