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
export default function DbManageTab() {
  const [view, setView] = useState<'trash' | 'duplicate' | 'employees'>('trash')

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

  const loadEmployees = useCallback(async () => {
    setEmpLoading(true)
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setEmployees((data.users || []).filter((u: Employee) => u.role !== 'ceo'))
    } catch {}
    setEmpLoading(false)
  }, [])

  useEffect(() => {
    if (view === 'trash') loadTrash()
    else if (view === 'duplicate') loadDuplicates()
    else if (view === 'employees') loadEmployees()
  }, [view, loadTrash, loadDuplicates, loadEmployees])

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
          { key: 'trash' as const,     label: '🗑 거절 DB 쓰레기통' },
          { key: 'duplicate' as const, label: '♻️ 중복 DB 감지' },
          { key: 'employees' as const, label: '👤 직원 관리' },
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
              <p className="text-xs text-gray-400 mt-0.5">직원 계정 조회 및 삭제 (대표 계정 제외)</p>
            </div>
            <button onClick={loadEmployees}
              className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-xl hover:border-gray-400 transition-colors">
              🔄 새로고침
            </button>
          </div>

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
                  <div key={emp.id} className="flex items-center gap-4 px-5 py-4">
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
