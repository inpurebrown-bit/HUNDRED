'use client'

import React, { useState, useEffect, useMemo } from 'react'
import InCallTableView from '@/components/sales/InCallTableView'
import type { Customer } from '@/components/sales/InCallTableView'

// ── DB 이동 모드 컴포넌트 ─────────────────────────────────
type TransferDir = 'sales_to_sales' | 'sales_to_ops' | 'ops_to_sales' | 'ops_to_ops'

const DIR_CONFIG: Record<TransferDir, { label: string; icon: string; from: string; to: string; color: string; bg: string }> = {
  sales_to_sales: { label: '영업↔영업',   icon: '🔄', from: '영업팀', to: '영업팀', color: 'text-blue-700',   bg: 'bg-blue-500' },
  sales_to_ops:   { label: '영업→관리팀', icon: '📤', from: '영업팀', to: '관리팀', color: 'text-violet-700', bg: 'bg-violet-500' },
  ops_to_sales:   { label: '관리팀→영업', icon: '↩️', from: '관리팀', to: '영업팀', color: 'text-amber-700',  bg: 'bg-amber-500' },
  ops_to_ops:     { label: '관리팀↔관리팀', icon: '🔀', from: '관리팀', to: '관리팀', color: 'text-emerald-700', bg: 'bg-emerald-500' },
}

const STATUS_LABEL_MAP: Record<string, string> = {
  lead: '고객DB', consulting: '고객DB', db010: '010DB',
  contracted: '계약', emotional: '감성톡', trash: '거절',
}
const STATUS_COLOR_MAP: Record<string, string> = {
  lead: 'bg-sky-100 text-sky-700', consulting: 'bg-sky-100 text-sky-700',
  db010: 'bg-violet-100 text-violet-700', contracted: 'bg-emerald-100 text-emerald-700',
  emotional: 'bg-pink-100 text-pink-700', trash: 'bg-gray-100 text-gray-500',
}

function nowKST2() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00'
}

function TransferModeView({
  customers,
  salesPeople,
  onClose,
  onTransferDone,
}: {
  customers: Customer[]
  salesPeople: string[]
  onClose: () => void
  onTransferDone: (updated: Customer[]) => void
}) {
  const [dir, setDir] = useState<TransferDir>('sales_to_sales')
  const [opsCases, setOpsCases] = useState<any[]>([])
  const [opsUsers, setOpsUsers] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPerson, setFilterPerson] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [targetUser, setTargetUser] = useState<string>('')
  const [customUser, setCustomUser] = useState<string>('')
  const [isPuto, setIsPuto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: number; fail: number } | null>(null)

  useEffect(() => {
    fetch('/api/ops-cases').then(r => r.json()).then(d => {
      const cases = d.cases || []
      setOpsCases(cases)
      const names = Array.from(new Set(cases.map((c: any) => c.ops_user_name).filter(Boolean))) as string[]
      setOpsUsers(names)
    }).catch(() => {})
  }, [])

  function changeDir(d: TransferDir) {
    setDir(d)
    setSelectedIds(new Set())
    setFilterPerson('all')
    setSearchQuery('')
    setTargetUser('')
    setCustomUser('')
    setIsPuto(false)
    setResult(null)
  }

  const isOpsSrc = dir === 'ops_to_sales' || dir === 'ops_to_ops'
  const isOpsDest = dir === 'sales_to_ops' || dir === 'ops_to_ops'
  const sourcePeople = isOpsSrc ? opsUsers : salesPeople

  const sourceList = useMemo(() => {
    let list: any[] = isOpsSrc ? opsCases : customers

    if (filterPerson !== 'all') {
      list = list.filter((c: any) =>
        isOpsSrc
          ? c.ops_user_name === filterPerson
          : (c.details?.sales_user_name || c.sales_user_name || '') === filterPerson
      )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((c: any) => {
        const company = isOpsSrc
          ? (c.details?.company || c.customer_name || '')
          : (c.details?.company || c.company || c.name || '')
        const name = isOpsSrc ? (c.customer_name || '') : (c.name || '')
        return company.toLowerCase().includes(q) || name.toLowerCase().includes(q)
      })
    }

    return list
  }, [dir, customers, opsCases, filterPerson, searchQuery, isOpsSrc])

  function toggleOne(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll() { setSelectedIds(new Set(sourceList.map((c: any) => c.id))) }
  function clearAll() { setSelectedIds(new Set()) }

  const dest = customUser.trim() || targetUser

  async function handleTransfer() {
    if (selectedIds.size === 0 || !dest) return
    setLoading(true)
    setResult(null)
    let ok = 0, fail = 0

    for (const id of Array.from(selectedIds)) {
      try {
        if (dir === 'sales_to_sales') {
          const c = customers.find(x => x.id === id)!
          const r = await fetch(`/api/customers/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              details: {
                ...(c as any).details,
                sales_user_name: dest,
                transfer_history: [
                  ...((c as any).details?.transfer_history || []),
                  { from: (c as any).details?.sales_user_name || '—', to: dest, at: new Date().toISOString().slice(0, 10), by: 'CEO' },
                ],
              },
            }),
          })
          r.ok ? ok++ : fail++

        } else if (dir === 'sales_to_ops') {
          const stage = isPuto ? 'new_db' : 'assigned'
          const msg = isPuto ? `대표 뿌토DB 배정 → ${dest}` : `대표 강제 배정 → ${dest}`
          const r = await fetch('/api/ops-cases', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_id: id, ops_user_name: dest, progress_stage: stage,
              details: { forced_assign: !isPuto, is_puto: isPuto, forced_by: 'CEO', forced_at: nowKST2() },
              timeline: [{ user: 'CEO', content: msg, created_at: nowKST2() }],
            }),
          })
          r.ok ? ok++ : fail++

        } else if (dir === 'ops_to_sales') {
          const oc = opsCases.find(x => x.id === id)!
          const [r1, r2] = await Promise.all([
            fetch(`/api/ops-cases/${id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                progress_stage: '영업복귀',
                timeline: [...(oc.timeline || []), { user: 'CEO', content: `관리팀→영업팀 복귀 → ${dest}`, created_at: nowKST2() }],
              }),
            }),
            fetch(`/api/customers/${oc.customer_id}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: 'lead',
                details: { sales_user_name: dest, transfer_history: [{ from: '관리팀', to: dest, at: new Date().toISOString().slice(0, 10), by: 'CEO' }] },
              }),
            }),
          ])
          r1.ok && r2.ok ? ok++ : fail++

        } else if (dir === 'ops_to_ops') {
          const oc = opsCases.find(x => x.id === id)!
          const r = await fetch(`/api/ops-cases/${id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ops_user_name: dest,
              timeline: [...(oc.timeline || []), { user: 'CEO', content: `관리팀 담당 변경: ${oc.ops_user_name || '—'} → ${dest}`, created_at: nowKST2() }],
            }),
          })
          r.ok ? ok++ : fail++
        }
      } catch { fail++ }
    }

    setResult({ ok, fail })
    setLoading(false)
    setSelectedIds(new Set())

    const [cRes, oRes] = await Promise.all([fetch('/api/customers'), fetch('/api/ops-cases')])
    const [cData, oData] = await Promise.all([cRes.json(), oRes.json()])
    onTransferDone(cData.customers || [])
    setOpsCases(oData.cases || [])
  }

  const cfg = DIR_CONFIG[dir]

  return (
    <div className="space-y-4">
      {/* 헤더 + 방향 탭 */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-blue-700 rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-base">🔀 DB 이동 모드</h3>
            <p className="text-white/60 text-xs mt-0.5">이동 방향 선택 → 업체 선택 → 대상 지정 (대표 전용)</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-sm px-3 py-1.5 border border-white/20 rounded-lg">✕ 닫기</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.entries(DIR_CONFIG) as [TransferDir, typeof DIR_CONFIG[TransferDir]][]).map(([key, c]) => (
            <button key={key} onClick={() => changeDir(key)}
              className={`rounded-lg py-2 px-2 text-center transition-all text-xs font-semibold ${dir === key ? 'bg-white text-[#1B2A45] shadow' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
              <div className="text-base">{c.icon}</div>
              <div className="mt-0.5">{c.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 검색 + 직원 필터 + 일괄 선택 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        {/* 검색창 */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
            <input
              type="text"
              placeholder="업체명 검색..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSelectedIds(new Set()) }}
              className="w-full pl-9 pr-8 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
            )}
          </div>
          <span className="text-xs text-gray-400 shrink-0 font-semibold">{sourceList.length}건</span>
        </div>

        {/* 직원 필터 */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 mb-1.5">
            {isOpsSrc ? '👤 관리팀 직원 필터' : '👤 영업팀 직원 필터'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => { setFilterPerson('all'); clearAll() }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterPerson === 'all' ? 'bg-[#1B2A45] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              전체
            </button>
            {sourcePeople.map(name => (
              <button key={name} onClick={() => { setFilterPerson(name); clearAll() }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterPerson === name ? 'bg-[#1B2A45] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* 일괄 선택 */}
        <div className="flex gap-2">
          <button onClick={selectAll}
            className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold py-2 rounded-lg border border-blue-200 transition-colors">
            ☑️ {sourceList.length}건 전체선택
          </button>
          <button onClick={clearAll}
            className="px-4 bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs font-semibold py-2 rounded-lg border border-gray-200 transition-colors">
            해제 ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* 이동 대상 설정 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <p className="text-sm font-bold text-gray-700">
          🎯 이동 대상 —{' '}
          <span className={cfg.color}>{cfg.to}</span> 담당자
        </p>

        {/* sales_to_ops 전용 뿌토 옵션 */}
        {dir === 'sales_to_ops' && (
          <label className="flex items-center gap-3 cursor-pointer bg-sky-50 rounded-lg px-4 py-3 border border-sky-200">
            <input type="checkbox" checked={isPuto} onChange={e => setIsPuto(e.target.checked)} className="w-4 h-4 accent-sky-500" />
            <div>
              <p className="text-sm font-semibold text-sky-800">🆕 뿌토 DB로 전송</p>
              <p className="text-[10px] text-sky-500">관리팀 신규DB탭에 배정</p>
            </div>
            {isPuto && <span className="ml-auto text-[10px] bg-sky-500 text-white px-2 py-0.5 rounded-full font-bold">뿌토</span>}
          </label>
        )}

        {/* 담당자 선택 */}
        <div className="flex flex-wrap gap-1.5">
          {(isOpsDest ? opsUsers : salesPeople).map(u => (
            <button key={u} onClick={() => { setTargetUser(u); setCustomUser('') }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${targetUser === u && !customUser ? `${cfg.bg} text-white border-transparent` : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
              {u}
            </button>
          ))}
          <input
            placeholder="직접 입력"
            value={customUser}
            onChange={e => { setCustomUser(e.target.value); setTargetUser('') }}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* 결과 메시지 */}
      {result && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${result.fail === 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          ✅ 이동 완료: {result.ok}건 성공{result.fail > 0 ? `, ${result.fail}건 실패` : ''}
        </div>
      )}

      {/* 업체 목록 (스크롤 고정) */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-500">
            {cfg.icon} {cfg.from} 업체 목록 · <span className="text-blue-600">{selectedIds.size}건 선택</span>
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cfg.bg} text-white`}>{sourceList.length}건</span>
        </div>
        <div className="max-h-[400px] overflow-y-auto divide-y divide-gray-100">
          {sourceList.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-400">해당 조건의 데이터 없음</div>
          ) : isOpsSrc ? (
            sourceList.map((oc: any) => {
              const sel = selectedIds.has(oc.id)
              const company = oc.details?.company || oc.customer_name || '—'
              const owner = oc.ops_user_name || '—'
              const stage = oc.progress_stage || '—'
              return (
                <div key={oc.id} onClick={() => toggleOne(oc.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${sel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${sel ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                    {sel && <span className="text-white text-[10px] font-bold">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#1B2A45] text-sm">{company}</span>
                      <span className="text-[10px] text-violet-500 font-medium">{owner}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{stage}</div>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold shrink-0">관리중</span>
                </div>
              )
            })
          ) : (
            sourceList.map((c: any) => {
              const sel = selectedIds.has(c.id)
              const company = c.details?.company || c.company || c.name || '—'
              const owner = c.details?.sales_user_name || c.sales_user_name || '—'
              return (
                <div key={c.id} onClick={() => toggleOne(c.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${sel ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${sel ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                    {sel && <span className="text-white text-[10px] font-bold">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#1B2A45] text-sm">{company}</span>
                      <span className="text-[10px] text-gray-400">{c.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{c.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-violet-500 font-medium">{owner}</span>
                      {c.details?.transfer_history?.length > 0 && (
                        <span className="text-[10px] text-amber-500">이동{c.details.transfer_history.length}회</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_COLOR_MAP[c.status] || 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL_MAP[c.status] || c.status}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 실행 버튼 */}
      <div className="sticky bottom-4 z-20 pb-2">
        <button
          onClick={handleTransfer}
          disabled={loading || selectedIds.size === 0 || !dest}
          className="w-full bg-[#C5A258] hover:bg-[#C5A258]/90 disabled:opacity-40 text-white py-3.5 rounded-xl text-sm font-bold shadow-lg transition-colors"
        >
          {loading ? '이동 중...' : `${cfg.icon} 선택된 ${selectedIds.size}건 → ${dest || '대상 미선택'} 으로 이동`}
        </button>
      </div>
    </div>
  )
}

type StatusKey = 'lead' | 'db010' | 'contracted' | 'emotional' | 'trash'

const STATUS_TABS = [
  { key: 'lead' as StatusKey,       label: '고객 DB',   color: 'text-sky-600',     bg: 'bg-sky-500' },
  { key: 'db010' as StatusKey,      label: '010 DB',    color: 'text-violet-600',  bg: 'bg-violet-500' },
  { key: 'contracted' as StatusKey, label: '계약 업체', color: 'text-emerald-600', bg: 'bg-emerald-500' },
  { key: 'emotional' as StatusKey,  label: '감성톡(거절업체)',    color: 'text-pink-600',    bg: 'bg-pink-500' },
  { key: 'trash' as StatusKey,      label: '자체거절',  color: 'text-gray-500',    bg: 'bg-gray-400' },
]

type CeoView = 'customers' | 'inspection' | 'as' | 'transfer'

export default function SalesCeoTab() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [ceoView, setCeoView] = useState<CeoView>('customers')
  const [personTab, setPersonTab] = useState<string>('all')
  const [statusTab, setStatusTab] = useState<StatusKey>('lead')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/customers')
        const data = await res.json()
        setCustomers(data.customers || [])
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const salesPeople = useMemo(() => {
    const names = Array.from(
      new Set(
        customers
          .map((c: any) => (c.details?.sales_user_name || c.sales_user_name || '').trim())
          .filter(Boolean)
      )
    ).sort() as string[]
    return names
  }, [customers])

  const personCustomers = useMemo(() => {
    if (personTab === 'all') return customers
    return customers.filter((c: any) => (c.details?.sales_user_name || c.sales_user_name || '').trim() === personTab)
  }, [customers, personTab])

  const statusCustomers = useMemo(() => {
    if (statusTab === 'lead') return personCustomers.filter(c => ['lead', 'consulting'].includes(c.status))
    return personCustomers.filter(c => c.status === statusTab)
  }, [personCustomers, statusTab])

  // 심사요청 대기 중인 업체
  const pendingInspections = useMemo(() =>
    customers.filter(c => c.details?.inspection_status === 'pending'),
  [customers])

  // A/S 요청 대기 중인 업체
  const pendingAsRequests = useMemo(() =>
    customers.filter(c => c.details?.as_requested === true && !c.details?.as_resolved),
  [customers])

  async function resolveAsRequest(id: string) {
    await updateCustomer(id, { details: { as_resolved: true, as_resolve_date: new Date().toISOString().slice(0, 10) } })
  }

  const personStats = useMemo(() => salesPeople.map(name => {
    const mine = customers.filter((c: any) => (c.details?.sales_user_name || c.sales_user_name || '').trim() === name)
    return {
      name,
      total: mine.length,
      lead: mine.filter((c: any) => ['lead', 'consulting'].includes(c.status)).length,
      db010: mine.filter((c: any) => c.status === 'db010').length,
      contracted: mine.filter((c: any) => c.status === 'contracted').length,
    }
  }), [customers, salesPeople])

  const counts = useMemo(() => ({
    lead:       personCustomers.filter(c => ['lead', 'consulting'].includes(c.status)).length,
    db010:      personCustomers.filter(c => c.status === 'db010').length,
    contracted: personCustomers.filter(c => c.status === 'contracted').length,
    emotional:  personCustomers.filter(c => c.status === 'emotional').length,
    trash:      personCustomers.filter(c => c.status === 'trash').length,
  }), [personCustomers])

  async function updateCustomer(id: string, patch: Record<string, any>) {
    const existing = customers.find(c => c.id === id)
    const mergedPatch = { ...patch }
    if (patch.details) mergedPatch.details = { ...(existing?.details || {}), ...patch.details }
    await fetch('/api/customers/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mergedPatch),
    })
    setCustomers(prev => prev.map(c => {
      if (c.id !== id) return c
      if (patch.details) return { ...c, details: { ...(c.details || {}), ...patch.details } }
      return { ...c, ...patch }
    }))
  }

  async function changeStatus(id: string, status: string) {
    await fetch('/api/customers/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  async function deleteCustomer(id: string) {
    await fetch('/api/customers/' + id, { method: 'DELETE' })
    setCustomers(prev => prev.filter(c => c.id !== id))
  }

  // 심사 승인/반려
  async function handleInspection(id: string, result: 'approved' | 'rejected') {
    await updateCustomer(id, {
      details: {
        inspection_status: result,
        inspection_result_date: new Date().toISOString().slice(0, 10),
      },
    })
  }

  if (loading) return (
    <div className="space-y-3 py-8 animate-pulse">
      {[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-gray-100" />)}
    </div>
  )

  return (
    <div className="space-y-5 pb-12 max-w-5xl mx-auto">

      {/* ── 상단 뷰 탭 ── */}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => setCeoView('customers')}
          className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors " + (
            ceoView === 'customers' ? 'bg-[#1B2A45] text-white border-[#1B2A45]' : 'bg-white text-gray-600 border-[#E8E2D4] hover:border-[#1B2A45]/40'
          )}>
          📋 고객관리
          <span className={"text-xs px-1.5 py-0.5 rounded-full font-bold " + (ceoView === 'customers' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500')}>
            {customers.length}
          </span>
        </button>
        <button type="button" onClick={() => setCeoView('inspection')}
          className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors " + (
            ceoView === 'inspection' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200 hover:border-amber-400'
          )}>
          🔍 심사요청
          {pendingInspections.length > 0 && (
            <span className={"text-xs px-1.5 py-0.5 rounded-full font-bold " + (ceoView === 'inspection' ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-700')}>
              {pendingInspections.length}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setCeoView('as')}
          className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors " + (
            ceoView === 'as' ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-orange-700 border-orange-200 hover:border-orange-400'
          )}>
          🔧 A/S 요청
          {pendingAsRequests.length > 0 && (
            <span className={"text-xs px-1.5 py-0.5 rounded-full font-bold " + (ceoView === 'as' ? 'bg-white/30 text-white' : 'bg-orange-100 text-orange-700')}>
              {pendingAsRequests.length}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setCeoView('transfer')}
          className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors " + (
            ceoView === 'transfer' ? 'bg-[#C5A258] text-white border-[#C5A258]' : 'bg-white text-[#C5A258] border-[#C5A258]/40 hover:border-[#C5A258]'
          )}>
          🔀 DB 이동
        </button>
      </div>

      {/* ── 심사요청 전용 뷰 ── */}
      {ceoView === 'inspection' && (
        <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <span className="text-sm font-bold text-amber-800">🔍 심사 요청 대기</span>
            <span className="text-[10px] text-amber-600">{pendingInspections.length}건 · 영업팀에서 심사를 요청했습니다</span>
          </div>
          {pendingInspections.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">심사 요청 없음</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingInspections.map(c => {
                const owner = (c as any).details?.sales_user_name || (c as any).sales_user_name || '—'
                return (
                  <div key={c.id} className="px-5 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-gray-900 text-sm">{c.company || c.name}</p>
                        <span className="text-[10px] text-gray-400">{c.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{c.phone}</span>
                        <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">{owner}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 mb-1">
                        <span>요청일: <b>{c.details?.inspection_date || '—'}</b></span>
                        {c.details?.business_type && <span>업종: {c.details.business_type}</span>}
                        {c.details?.required_funds && <span>필요자금: {c.details.required_funds}</span>}
                        {c.details?.credit_nice && <span>NICE: {c.details.credit_nice}</span>}
                      </div>
                      {c.details?.result_memo && (
                        <p className="text-[11px] text-gray-600 bg-gray-50 rounded px-2 py-1 mt-1">{c.details.result_memo}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      <button type="button" onClick={() => handleInspection(c.id, 'approved')}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors">
                        ✅ 승인
                      </button>
                      <button type="button" onClick={() => handleInspection(c.id, 'rejected')}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg border border-red-200 transition-colors">
                        ❌ 반려
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── A/S 요청 전용 뷰 ── */}
      {ceoView === 'as' && (
        <div className="bg-white border border-orange-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
            <span className="text-sm font-bold text-orange-800">🔧 A/S 요청 대기</span>
            <span className="text-[10px] text-orange-600">{pendingAsRequests.length}건 · 영업팀에서 A/S를 요청했습니다</span>
          </div>
          {pendingAsRequests.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">A/S 요청 없음</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingAsRequests.map(c => {
                const owner = (c as any).details?.sales_user_name || (c as any).sales_user_name || '—'
                return (
                  <div key={c.id} className="px-5 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-gray-900 text-sm">{c.company || c.name}</p>
                        <span className="text-[10px] text-gray-400">{c.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{c.phone}</span>
                        <span className="text-[10px] bg-orange-50 border border-orange-200 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">{owner}</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mb-1">요청일: <b>{c.details?.as_request_date || '—'}</b></p>
                      {c.details?.result_memo && (
                        <p className="text-[11px] text-gray-600 bg-gray-50 rounded px-2 py-1">{c.details.result_memo}</p>
                      )}
                    </div>
                    <button type="button" onClick={() => resolveAsRequest(c.id)}
                      className="shrink-0 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors mt-1">
                      ✅ 처리완료
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── DB 이동 뷰 ── */}
      {ceoView === 'transfer' && (
        <TransferModeView
          customers={customers}
          salesPeople={salesPeople}
          onClose={() => setCeoView('customers')}
          onTransferDone={(updated) => setCustomers(updated)}
        />
      )}

      {/* ── 고객관리 뷰 ── */}
      {ceoView === 'customers' && (<>

      {/* ── 영업사원 탭 ── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">영업사원</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPersonTab('all')}
            className={"flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all border " + (
              personTab === 'all'
                ? 'bg-[#1B2A45] text-white border-[#1B2A45] shadow'
                : 'bg-white text-gray-600 border-[#E8E2D4] hover:border-[#1B2A45]/40'
            )}
          >
            📊 전체
            <span className={"text-xs px-1.5 py-0.5 rounded-full font-bold " + (
              personTab === 'all' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
            )}>{customers.length}</span>
          </button>

          {personStats.map(p => (
            <button
              key={p.name}
              type="button"
              onClick={() => setPersonTab(p.name)}
              className={"flex flex-col items-start px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all border min-w-[150px] " + (
                personTab === p.name
                  ? 'bg-[#1B2A45] text-white border-[#1B2A45] shadow'
                  : 'bg-white text-[#1B2A45] border-[#E8E2D4] hover:border-[#1B2A45]/40'
              )}
            >
              <div className="flex items-center gap-2 w-full justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={"w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold " + (
                    personTab === p.name ? 'bg-white/20' : 'bg-[#1B2A45] text-white'
                  )}>{p.name.charAt(0)}</div>
                  <span>{p.name.replace(' 수석팀장', '')}</span>
                </div>
                <span className={"text-xs px-1.5 py-0.5 rounded-full font-bold " + (
                  personTab === p.name ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                )}>{p.total}</span>
              </div>
              <div className={"flex gap-2 mt-1.5 text-[10px] " + (personTab === p.name ? 'text-white/70' : 'text-gray-400')}>
                <span>DB {p.lead}</span><span>·</span>
                <span>계약 {p.contracted}</span><span>·</span>
                <span>010 {p.db010}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── 상태 탭 ── */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatusTab(t.key)}
            className={"px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors " + (
              statusTab === t.key
                ? t.bg + ' text-white shadow-sm'
                : 'bg-white border border-[#E8E2D4] ' + t.color + ' hover:border-gray-300'
            )}
          >
            {t.label} <span className={statusTab === t.key ? 'text-white/80' : 'text-gray-400'}>{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {/* ── 고객 테이블 ── */}
      {statusCustomers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E2D4] p-12 text-center text-sm text-gray-400">
          해당하는 고객 데이터가 없습니다
        </div>
      ) : (
        <InCallTableView
          customers={statusCustomers}
          allCustomers={customers}
          tabType={statusTab}
          salesUsers={salesPeople}
          userName="ceo"
          showOwner={personTab === 'all'}
          onUpdate={updateCustomer}
          onStatusChange={changeStatus}
          onDelete={deleteCustomer}
        />
      )}
      </>)}
    </div>
  )
}
