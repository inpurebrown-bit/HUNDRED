'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Customer {
  id: string
  name: string
  phone: string
  status: string
  created_at: string
  updated_at?: string
  details?: Record<string, any>
  owner_id?: string
  sales_user_name?: string
}

interface Employee {
  id: string
  name: string
  username: string
  role: string
}

// ──────────────────────────────────────────────────────────────────────────────
// DbManageTab — CEO 전용 DB 관리 탭
// ──────────────────────────────────────────────────────────────────────────────
export default function DbManageTab({ initialView = 'trash' }: { initialView?: 'trash' | 'duplicate' | 'employees' | 'delete_requests' }) {
  const [view, setView] = useState<'trash' | 'duplicate' | 'employees' | 'delete_requests'>(initialView)

  // ── 쓰레기통 ──────────────────────────────────────────────────────────────
  const [trashList, setTrashList] = useState<Customer[]>([])
  const [trashLoading, setTrashLoading] = useState(false)
  const [trashSelected, setTrashSelected] = useState<Set<string>>(new Set())

  const loadTrash = useCallback(async () => {
    setTrashLoading(true)
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      const all: Customer[] = data.customers || []
      setTrashList(all.filter(c => c.status === 'trash'))
    } catch {}
    setTrashLoading(false)
  }, [])

  // ── 중복 DB ──────────────────────────────────────────────────────────────
  const [dupList, setDupList] = useState<Customer[][]>([])
  const [dupLoading, setDupLoading] = useState(false)

  const loadDuplicates = useCallback(async () => {
    setDupLoading(true)
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      const all: Customer[] = data.customers || []
      // 전화번호 기준 중복 그룹화
      const phoneMap: Record<string, Customer[]> = {}
      all.forEach(c => {
        const key = (c.phone || '').replace(/[^0-9]/g, '')
        if (!key) return
        if (!phoneMap[key]) phoneMap[key] = []
        phoneMap[key].push(c)
      })
      setDupList(Object.values(phoneMap).filter(g => g.length > 1))
    } catch {}
    setDupLoading(false)
  }, [])

  // ── 직원 관리 ──────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState<Employee[]>([])
  const [empLoading, setEmpLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', username: '', password: '', role: 'sales' as 'sales' | 'ops' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null)

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true)
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setEmployees((data.users || []).filter((u: Employee) => u.role !== 'ceo'))
    } catch {}
    setEmpLoading(false)
  }, [])

  // ── 직가DB 삭제 요청 ──────────────────────────────────────────────────────
  const [deleteReqList, setDeleteReqList] = useState<Customer[]>([])
  const [delReqLoading, setDelReqLoading] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const loadDeleteRequests = useCallback(async () => {
    setDelReqLoading(true)
    try {
      const res = await fetch('/api/customers')
      const data = await res.json()
      const all: Customer[] = data.customers || []
      setDeleteReqList(all.filter(c => c.status === 'db010' && c.details?.delete_requested))
    } catch {}
    setDelReqLoading(false)
  }, [])

  // 수락: 삭제DB로 이동
  async function approveDeleteRequest(id: string) {
    setProcessingId(id)
    const todayIso = new Date().toISOString().slice(0, 10)
    const customer = deleteReqList.find(c => c.id === id)
    const d = customer?.details || {}
    await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'trash',
        details: {
          employee_deleted: true,
          deleted_at: todayIso,
          deleted_by: d.delete_requested_by || '',
          delete_approved_at: todayIso,
          delete_requested: false,
        },
      }),
    })
    setDeleteReqList(prev => prev.filter(c => c.id !== id))
    setProcessingId(null)
  }

  // 거절: 요청 플래그 초기화 → 직가DB 원복
  async function rejectDeleteRequest(id: string) {
    setProcessingId(id)
    await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        details: {
          delete_requested: false,
          delete_request_reason: null,
          delete_requested_at: null,
          delete_requested_by: null,
        },
      }),
    })
    setDeleteReqList(prev => prev.filter(c => c.id !== id))
    setProcessingId(null)
  }

  useEffect(() => {
    if (view === 'trash') loadTrash()
    else if (view === 'duplicate') loadDuplicates()
    else if (view === 'employees') loadEmployees()
    else if (view === 'delete_requests') loadDeleteRequests()
  }, [view, loadTrash, loadDuplicates, loadEmployees, loadDeleteRequests])

  // ── 쓰레기통 고객 영구삭제 ──────────────────────────────────────────────
  async function hardDeleteSelected() {
    if (trashSelected.size === 0) return
    if (!confirm(`선택한 ${trashSelected.size}개의 고객을 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return
    const ids = Array.from(trashSelected)
    for (const id of ids) {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    }
    setTrashList(p => p.filter(c => !trashSelected.has(c.id)))
    setTrashSelected(new Set())
  }

  // ── 중복 고객 삭제 ──────────────────────────────────────────────────────
  async function deleteDuplicate(id: string) {
    if (!confirm('이 중복 고객을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setDupList(prev => {
        const next = prev.map(g => g.filter(c => c.id !== id)).filter(g => g.length > 1)
        return next
      })
    }
  }

  // ── 직원 생성 ──────────────────────────────────────────────────────────────
  async function createEmployee() {
    setCreateError('')
    if (!createForm.name.trim() || !createForm.username.trim() || !createForm.password.trim()) {
      setCreateError('이름, 아이디, 비밀번호를 모두 입력해주세요')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error || '생성 실패'); setCreating(false); return }
      setEmployees(p => [...p, data.user])
      setNewlyCreatedId(data.user.id)
      setCreateForm({ name: '', username: '', password: '', role: 'sales' })
      setShowCreateForm(false)
      setTimeout(() => setNewlyCreatedId(null), 5000)
    } catch { setCreateError('네트워크 오류') }
    setCreating(false)
  }

  // ── 직원 삭제 ──────────────────────────────────────────────────────────────
  async function deleteEmployee(emp: Employee) {
    if (!confirm(`${emp.name} (${emp.username}) 직원을 삭제하시겠습니까?\n해당 직원의 모든 데이터가 영향받을 수 있습니다.`)) return
    const res = await fetch(`/api/users/${emp.id}`, { method: 'DELETE' })
    if (res.ok) {
      setEmployees(p => p.filter(e => e.id !== emp.id))
    } else {
      const data = await res.json()
      alert(`삭제 실패: ${data.error || '알 수 없는 오류'}`)
    }
  }

  const roleLabel: Record<string, string> = { sales: '영업팀', ops: '관리팀', ceo: '대표' }
  const roleBg: Record<string, string> = { sales: 'bg-sky-100 text-sky-700', ops: 'bg-violet-100 text-violet-700', ceo: 'bg-amber-100 text-amber-700' }

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'delete_requests' as const, label: '📨 직가DB 삭제요청' },
          { key: 'trash' as const,           label: '🗑 거절 DB 쓰레기통' },
          { key: 'duplicate' as const,       label: '♻️ 중복 DB 감지' },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              view === v.key
                ? 'bg-[#1B2A45] text-white border-[#1B2A45]'
                : 'bg-white text-gray-600 border-[#E8E2D4] hover:border-[#1B2A45]/40'
            }`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* ── 직가DB 삭제 요청 검토 ── */}
      {view === 'delete_requests' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">📨 직가DB 삭제 요청</h3>
              <p className="text-xs text-gray-400 mt-0.5">직원이 요청한 직가DB 삭제 — 수락 시 삭제DB로 이동, 거절 시 원복</p>
            </div>
            <button onClick={loadDeleteRequests}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-xl hover:border-gray-400 transition-colors">
              🔄 새로고침
            </button>
          </div>

          {delReqLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
          ) : deleteReqList.length === 0 ? (
            <div className="bg-white border border-[#E8E2D4] rounded-xl p-12 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-gray-400">대기 중인 삭제 요청이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {deleteReqList.map(c => {
                const d = c.details || {}
                const company = d.company || c.name || '—'
                const isPending = processingId === c.id
                return (
                  <div key={c.id} className="bg-white border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-800 text-sm">{company}</span>
                          <span className="text-xs text-gray-400">{c.name}</span>
                          <span className="text-xs text-gray-400">{c.phone}</span>
                          <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">삭제요청</span>
                        </div>
                        <div className="mt-1.5 text-xs text-gray-500 space-y-0.5">
                          <div><span className="text-gray-400">요청자:</span> <span className="font-medium">{d.delete_requested_by || '—'}</span></div>
                          <div><span className="text-gray-400">요청일:</span> <span>{d.delete_requested_at || '—'}</span></div>
                          {d.delete_request_reason && (
                            <div><span className="text-gray-400">사유:</span> <span className="text-gray-700">"{d.delete_request_reason}"</span></div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          disabled={isPending}
                          onClick={() => approveDeleteRequest(c.id)}
                          className="px-3 py-2 text-xs font-bold bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl transition-colors">
                          {isPending ? '처리중...' : '✅ 수락'}
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => rejectDeleteRequest(c.id)}
                          className="px-3 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 rounded-xl transition-colors">
                          {isPending ? '처리중...' : '❌ 거절'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 거절 DB 쓰레기통 ── */}
      {view === 'trash' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">🗑 거절 DB 쓰레기통</h3>
              <p className="text-xs text-gray-400 mt-0.5">자체거절/감성톡 이후 삭제된 고객 DB — 영구 삭제 가능</p>
            </div>
            <div className="flex gap-2">
              {trashSelected.size > 0 && (
                <button onClick={hardDeleteSelected}
                  className="px-3 py-1.5 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors">
                  🗑 선택 {trashSelected.size}개 영구삭제
                </button>
              )}
              <button onClick={loadTrash}
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-xl hover:border-gray-400 transition-colors">
                🔄 새로고침
              </button>
            </div>
          </div>

          {trashLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
          ) : trashList.length === 0 ? (
            <div className="bg-white border border-[#E8E2D4] rounded-xl p-12 text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm text-gray-400">거절 DB가 없습니다</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E8E2D4] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
                <input type="checkbox"
                  checked={trashSelected.size === trashList.length && trashList.length > 0}
                  onChange={e => setTrashSelected(e.target.checked ? new Set(trashList.map(c => c.id)) : new Set())}
                  className="w-4 h-4 accent-red-500" />
                <span className="text-xs text-gray-500 font-medium">전체 선택 ({trashList.length}개)</span>
              </div>
              <div className="divide-y divide-gray-50">
                {trashList.map(c => {
                  const company = c.details?.company || c.name || '—'
                  const reason = c.details?.self_rejection_reason || c.details?.rejection_reason || ''
                  const rejectDate = (c.updated_at || c.created_at || '').slice(0, 10)
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                      <input type="checkbox"
                        checked={trashSelected.has(c.id)}
                        onChange={e => {
                          const next = new Set(trashSelected)
                          if (e.target.checked) { next.add(c.id) } else { next.delete(c.id) }
                          setTrashSelected(next)
                        }}
                        className="w-4 h-4 accent-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{company}</span>
                          <span className="text-xs text-gray-400">{c.name}</span>
                          <span className="text-xs font-mono text-gray-400">{c.phone}</span>
                          {c.sales_user_name && (
                            <span className="text-[10px] bg-sky-50 text-sky-600 border border-sky-200 px-1.5 py-0.5 rounded-full">{c.sales_user_name}</span>
                          )}
                        </div>
                        {reason && <p className="text-[10px] text-gray-400 mt-0.5 truncate">거절 사유: {reason}</p>}
                      </div>
                      <span className="text-[10px] text-gray-300 shrink-0">{rejectDate}</span>
                      <button onClick={() => {
                        if (confirm(`${company} 을 영구 삭제하시겠습니까?`)) {
                          fetch(`/api/customers/${c.id}`, { method: 'DELETE' })
                            .then(() => setTrashList(p => p.filter(x => x.id !== c.id)))
                        }
                      }}
                        className="shrink-0 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                        삭제
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 중복 DB 감지 ── */}
      {view === 'duplicate' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">♻️ 중복 DB 감지</h3>
              <p className="text-xs text-gray-400 mt-0.5">동일 전화번호로 등록된 중복 고객 — {dupList.length}건의 중복 발견</p>
            </div>
            <button onClick={loadDuplicates}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-xl hover:border-gray-400 transition-colors">
              🔄 재검사
            </button>
          </div>

          {dupLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">분석 중...</div>
          ) : dupList.length === 0 ? (
            <div className="bg-white border border-[#E8E2D4] rounded-xl p-12 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm text-gray-400">중복 DB 없음</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dupList.map((group, gi) => (
                <div key={gi} className="bg-white border border-amber-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
                    <span className="text-xs font-bold text-amber-700">⚠️ 동일 번호 {group.length}개: {group[0]?.phone}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {group.map((c, i) => {
                      const company = c.details?.company || c.name || '—'
                      const statusLabel: Record<string, string> = {
                        lead: '신규', db010: '010DB', contracted: '계약',
                        emotional: '감성톡', trash: '거절'
                      }
                      return (
                        <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="text-[10px] text-gray-300 shrink-0 w-4">#{i+1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800">{company}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                                {statusLabel[c.status] || c.status}
                              </span>
                              {c.sales_user_name && (
                                <span className="text-[10px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded-full">{c.sales_user_name}</span>
                              )}
                              <span className="text-[10px] text-gray-300">{(c.created_at || '').slice(0, 10)}</span>
                            </div>
                          </div>
                          <button onClick={() => deleteDuplicate(c.id)}
                            className="shrink-0 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                            삭제
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 직원 관리 ── */}
      {view === 'employees' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">👤 직원 관리</h3>
              <p className="text-xs text-gray-400 mt-0.5">직원 계정 조회·생성·삭제 (대표 계정 제외)</p>
            </div>
            <div className="flex gap-2">
              <button onClick={loadEmployees}
                className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-xl hover:border-gray-400 transition-colors">
                🔄 새로고침
              </button>
              <button onClick={() => { setShowCreateForm(v => !v); setCreateError('') }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${
                  showCreateForm
                    ? 'bg-gray-100 text-gray-600 border-gray-200'
                    : 'bg-[#1B2A45] text-white border-[#1B2A45] hover:bg-[#1B2A45]/90'
                }`}>
                {showCreateForm ? '✕ 취소' : '➕ 직원 추가'}
              </button>
            </div>
          </div>

          {/* 직원 생성 폼 */}
          {showCreateForm && (
            <div className="bg-white border border-[#1B2A45]/20 rounded-xl p-5 space-y-4">
              <p className="text-sm font-bold text-[#1B2A45]">새 직원 계정 만들기</p>

              {/* 역할 선택 */}
              <div className="flex gap-2">
                {(['sales', 'ops'] as const).map(r => (
                  <button key={r} onClick={() => setCreateForm(f => ({ ...f, role: r }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      createForm.role === r
                        ? r === 'sales'
                          ? 'bg-sky-500 text-white border-sky-500'
                          : 'bg-violet-500 text-white border-violet-500'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}>
                    {r === 'sales' ? '📞 영업팀' : '🗂 관리팀'}
                  </button>
                ))}
              </div>

              {/* 입력 필드 */}
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">이름 (실명)</label>
                  <input
                    type="text"
                    placeholder="예) 홍길동"
                    value={createForm.name}
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B2A45]/50 focus:ring-1 focus:ring-[#1B2A45]/20"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">아이디 (로그인 ID)</label>
                  <input
                    type="text"
                    placeholder="예) hong2024"
                    value={createForm.username}
                    onChange={e => setCreateForm(f => ({ ...f, username: e.target.value.trim() }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B2A45]/50 focus:ring-1 focus:ring-[#1B2A45]/20 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">초기 비밀번호</label>
                  <input
                    type="text"
                    placeholder="4자 이상"
                    value={createForm.password}
                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B2A45]/50 focus:ring-1 focus:ring-[#1B2A45]/20 font-mono"
                  />
                </div>
              </div>

              {/* 역할별 안내 */}
              <div className={`rounded-xl p-3 text-xs leading-relaxed ${
                createForm.role === 'sales' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'
              }`}>
                {createForm.role === 'sales' ? (
                  <>
                    <p className="font-semibold mb-1">📞 영업팀 권한</p>
                    <p>• 고객 DB 등록·조회·수정 (본인 담당 고객)</p>
                    <p>• 인콜일지 작성, 콜 타임라인 기록</p>
                    <p>• 오전/마감 보고서 제출</p>
                    <p>• 매출 입력, 재통화 관리</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold mb-1">🗂 관리팀 권한</p>
                    <p>• 흡수 업체 배정·진행현황 관리</p>
                    <p>• 정책자금 기관·솔루션 배정</p>
                    <p>• 환불·종료 처리 (대표 승인 후 확정)</p>
                    <p>• 오전/마감 보고서 제출</p>
                  </>
                )}
              </div>

              {createError && (
                <p className="text-xs text-red-500 font-medium">⚠️ {createError}</p>
              )}

              <button
                onClick={createEmployee}
                disabled={creating}
                className="w-full py-2.5 bg-[#1B2A45] hover:bg-[#1B2A45]/90 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                {creating ? '생성 중...' : `✅ ${createForm.role === 'sales' ? '영업팀' : '관리팀'} 직원 계정 생성`}
              </button>
            </div>
          )}

          {empLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
          ) : employees.length === 0 ? (
            <div className="bg-white border border-[#E8E2D4] rounded-xl p-12 text-center">
              <p className="text-sm text-gray-400">직원이 없습니다</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E8E2D4] rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-50">
                {employees.map(emp => (
                  <div key={emp.id} className={`flex items-center gap-4 px-5 py-4 transition-colors ${emp.id === newlyCreatedId ? 'bg-green-50' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-[#1B2A45]/10 flex items-center justify-center text-sm font-bold text-[#1B2A45] shrink-0">
                      {emp.name?.slice(-2) || '??'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#1B2A45] text-sm">{emp.name}</span>
                        <span className="text-xs text-gray-400 font-mono">{emp.username}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${roleBg[emp.role] || 'bg-gray-100 text-gray-600'}`}>
                          {roleLabel[emp.role] || emp.role}
                        </span>
                        {emp.id === newlyCreatedId && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">✨ 방금 생성</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteEmployee(emp)}
                      className="shrink-0 text-sm text-red-400 hover:text-red-600 px-3 py-1.5 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors font-medium">
                      🗑 삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
