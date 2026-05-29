'use client'

import React, { useState, useEffect, useMemo } from 'react'
import InCallTableView from '@/components/sales/InCallTableView'
import type { Customer } from '@/components/sales/InCallTableView'
import InCallForm, { emptyInCallData, InCallData } from '@/components/sales/InCallForm'
import { SUPPLY_RATE_TABLE, calcRecommendedSupply, isActiveRow, contractWeight } from '@/lib/supplyRules'
import { getElapsedBusinessDays } from '@/lib/businessDays'

// ── DB 이동 모드 컴포넌트 ─────────────────────────────────
type TransferDir = 'sales_to_sales' | 'sales_to_ops' | 'ops_to_sales' | 'ops_to_ops'

const DIR_CONFIG: Record<TransferDir, { label: string; icon: string; from: string; to: string; color: string; bg: string }> = {
  sales_to_sales: { label: '영업↔영업',   icon: '🔄', from: '영업팀', to: '영업팀', color: 'text-blue-700',   bg: 'bg-blue-500' },
  sales_to_ops:   { label: '영업→관리팀', icon: '', from: '영업팀', to: '관리팀', color: 'text-violet-700', bg: 'bg-violet-500' },
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

function parseNum(s: string | number | undefined): number {
  if (!s) return 0
  return parseInt(String(s).replace(/[^0-9]/g, ''), 10) || 0
}

function fmtWon(n: number): string {
  if (n === 0) return '0'
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억'
  if (n >= 10000) return (n / 10000).toFixed(0) + '만'
  return n.toLocaleString()
}

function toTabType(status: string): 'lead' | 'db010' | 'contracted' | 'emotional' | 'trash' {
  if (status === 'db010') return 'db010'
  if (status === 'contracted') return 'contracted'
  if (status === 'emotional') return 'emotional'
  if (status === 'trash') return 'trash'
  return 'lead'
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
  // ops 유저 ID 맵 { 이름: UUID }
  const [opsUserIdMap, setOpsUserIdMap] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPerson, setFilterPerson] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [targetUser, setTargetUser] = useState<string>('')
  const [customUser, setCustomUser] = useState<string>('')
  const [isPuto, setIsPuto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: number; fail: number } | null>(null)

  useEffect(() => {
    // ops 케이스 목록 로드
    fetch('/api/ops-cases').then(r => r.json()).then(d => {
      const cases = d.cases || []
      setOpsCases(cases)
      const names = Array.from(new Set(cases.map((c: any) => c.ops_user_name).filter(Boolean))) as string[]
      setOpsUsers(names)
    }).catch(() => {})
    // ops 직원 ID 맵 로드 (owner_id 배정용)
    fetch('/api/users?role=ops').then(r => r.json()).then(d => {
      const map: Record<string, string> = {}
      ;(d.users || []).forEach((u: any) => { if (u.name && u.id) map[u.name] = u.id })
      setOpsUserIdMap(map)
      setOpsUsers(prev => {
        const fromUsers = Object.keys(map)
        const merged = Array.from(new Set([...prev, ...fromUsers]))
        return merged
      })
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
          const ownerId = opsUserIdMap[dest] || null
          const r = await fetch('/api/ops-cases', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer_id: id,
              ops_user_name: dest,
              owner_id: ownerId,
              stage,
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
            {isOpsSrc ? '관리팀 직원 필터' : '영업팀 직원 필터'}
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
          이동 대상 —{' '}
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
          이동 완료: {result.ok}건 성공{result.fail > 0 ? `, ${result.fail}건 실패` : ''}
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

// ── 이름 불일치 데이터 정리 컴포넌트 ─────────────────────────
function UnknownOwnerCleanup({
  unknownOwners,
  officialUsers,
  customers,
  onReassignDone,
}: {
  unknownOwners: string[]
  officialUsers: string[]
  customers: any[]
  onReassignDone: (updated: any[]) => void
}) {
  const [reassignMap, setReassignMap] = useState<Record<string, string>>({})
  const [reassigning, setReassigning] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function doReassign(oldName: string) {
    const newName = reassignMap[oldName]
    if (!newName) return alert('이동할 담당자를 선택하세요')
    const targets = customers.filter((c: any) =>
      (c.details?.sales_user_name || c.sales_user_name || '').normalize('NFC').trim() === oldName.normalize('NFC').trim()
    )
    if (!targets.length) return
    if (!confirm(`"${oldName}" ${targets.length}건을 "${newName}"으로 재배정하시겠습니까?`)) return
    setReassigning(oldName)
    let updated = [...customers]
    for (const c of targets) {
      try {
        await fetch(`/api/customers/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sales_user_name: newName }),
        })
        updated = updated.map(x => x.id === c.id
          ? { ...x, sales_user_name: newName, details: { ...(x.details || {}), sales_user_name: newName } }
          : x
        )
      } catch {}
    }
    onReassignDone(updated)
    setReassigning(null)
  }

  const countByOwner = (name: string) => customers.filter((c: any) =>
    (c.details?.sales_user_name || c.sales_user_name || '').normalize('NFC').trim() === name.normalize('NFC').trim()
  ).length

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-100/50 transition-colors">
        <span className="text-xs font-bold text-amber-700">
          등록되지 않은 담당자 이름 {unknownOwners.length}개 발견 — 재배정 필요
        </span>
        <span className="text-amber-600 text-xs">{expanded ? '▲ 닫기' : '▼ 펼치기'}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {unknownOwners.map(name => (
            <div key={name} className="bg-white rounded-lg border border-amber-100 px-3 py-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-700">"{name}"</span>
              <span className="text-[10px] text-gray-400">{countByOwner(name)}건</span>
              <span className="text-gray-300 text-xs">→</span>
              <select
                value={reassignMap[name] || ''}
                onChange={e => setReassignMap(prev => ({ ...prev, [name]: e.target.value }))}
                className="flex-1 min-w-[120px] border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
              >
                <option value="">이동할 담당자 선택</option>
                {officialUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <button
                onClick={() => doReassign(name)}
                disabled={!reassignMap[name] || reassigning === name}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
              >
                {reassigning === name ? '...' : '재배정'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

type StatusKey = 'all' | 'lead' | 'db010' | 'contracted' | 'emotional' | 'trash'

const STATUS_TABS = [
  { key: 'all' as StatusKey,        label: '전체DB',    color: 'text-gray-600',    bg: 'bg-gray-500' },
  { key: 'db010' as StatusKey,      label: '직가DB',    color: 'text-violet-600',  bg: 'bg-violet-500' },
  { key: 'lead' as StatusKey,       label: '공급DB',    color: 'text-sky-600',     bg: 'bg-sky-500' },
  { key: 'contracted' as StatusKey, label: '계약업체',  color: 'text-emerald-600', bg: 'bg-emerald-500' },
  { key: 'emotional' as StatusKey,  label: '거절업체',  color: 'text-pink-600',    bg: 'bg-pink-500' },
  { key: 'trash' as StatusKey,      label: '자체거절',  color: 'text-gray-500',    bg: 'bg-gray-400' },
]

type CeoView = 'customers' | 'inspection' | 'as' | 'transfer' | 'diary'

// ── 공급 설정 타입 ──────────────────────────────────────
interface PersonSupply {
  supplied: number   // 이번달 총 공급수 (대표 입력)
  goal:     number   // 이번달 목표 결제수 (대표 입력)
  base:     number   // 기존 결제 오프셋 (시스템 전 계약수 수동 입력)
}
type SupplyConfig = Record<string, PersonSupply>

// ════════════════════════════════════════════════════════════════════════════════
const DIARY_TESTER = 'sales-tester'

// 고객 배열에서 월별 인별 계약수 실시간 계산
function buildLivePayMap(customers: Customer[], ym: string): Record<string, { supply: number; direct: number }> {
  const map: Record<string, { supply: number; direct: number }> = {}
  for (const c of customers) {
    if (c.status !== 'contracted') continue
    const contractMonth = ((c as any).details?.contract_date || (c as any).created_at || '').slice(0, 7)
    if (contractMonth !== ym) continue
    const name = ((c as any).details?.sales_user_name || '').trim()
    if (!name || name === DIARY_TESTER) continue
    const w = contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included)
    const isDirectType = (c as any).status === 'db010' || !!(c as any).details?.db010_month || !!(c as any).details?.is_direct
    if (!map[name]) map[name] = { supply: 0, direct: 0 }
    if (isDirectType) map[name].direct += w
    else              map[name].supply += w
  }
  return map
}

//  영업일지: 월별 아카이브 뷰
// ════════════════════════════════════════════════════════════════════════════════
function SalesDiaryView({ customers }: { customers: Customer[] }) {
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/payrate?list=true')
      .then(r => r.json())
      .then(json => {
        setRecords(json.records || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const thisMonth = new Date().toISOString().slice(0, 7)
  // 이번달 실시간 계약수 맵 (contractWeight 기준)
  const livePayMap = useMemo(() => buildLivePayMap(customers, thisMonth), [customers, thisMonth])

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
      불러오는 중…
    </div>
  )
  if (records.length === 0) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
      아직 저장된 영업일지가 없습니다
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">📒 영업일지</h2>
        <p className="text-[11px] text-gray-400">월별 결제율 현황 · 자동 저장</p>
      </div>
      {records.map((rec: any) => {
        const ym = rec.year_month || (rec.record_date as string).slice(0, 7)
        const isCurrent = ym === thisMonth
        const isOpen = expandedMonth === ym
        const emps: any[] = rec.employee_details || []

        return (
          <div key={ym} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button
              className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedMonth(isOpen ? null : ym)}
            >
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-800 text-sm">{ym.replace('-', '년 ')}월</span>
                {isCurrent && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">이번달</span>}
                <span className="text-[11px] text-gray-400">직원 {emps.filter((e: any) => e.name).length}명</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-emerald-600 font-bold">
                  결제 {(rec.payment_count ?? 0) % 1 === 0 ? rec.payment_count ?? 0 : Number(rec.payment_count ?? 0).toFixed(1)}건
                </span>
                <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && emps.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {emps.filter((e: any) => e.name && e.name !== DIARY_TESTER).map((e: any, ei: number) => {
                    const ds = e.daily_supplies || {}
                    const supplyCount = Object.values(ds).reduce((s: number, v: any) => s + Number(v || 0), 0)
                    // 이번달: 실시간 contractWeight 값 우선, 과거달: 저장값
                    const live = isCurrent ? livePayMap[e.name] : undefined
                    const supplyPay = live ? Math.max(Number(e.supply_payment || 0), live.supply) : Number(e.supply_payment || 0)
                    const directPay = live ? Math.max(Number(e.direct_payment || 0), live.direct) : Number(e.direct_payment || 0)
                    const total = supplyPay + directPay
                    const supplyRate = supplyCount > 0 ? (supplyPay / supplyCount * 100) : null
                    const achievePct = Number(e.target) > 0 ? Math.round(total / Number(e.target) * 100) : 0
                    const daysArr = Object.entries(ds).filter(([, v]) => Number(v) > 0)

                    return (
                      <div key={ei} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#1B2A45] text-white flex items-center justify-center text-xs font-bold">
                              {(e.name || '?').charAt(0)}
                            </div>
                            <span className="font-bold text-gray-800 text-sm">{e.name}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            achievePct >= 100 ? 'bg-emerald-100 text-emerald-700' :
                            achievePct >= 60  ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>달성 {achievePct}%</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 text-center">
                          <div className="bg-white rounded-lg py-1.5">
                            <p className="text-[8px] text-gray-400">공급수</p>
                            <p className="text-sm font-black text-sky-700">{supplyCount}</p>
                          </div>
                          <div className="bg-white rounded-lg py-1.5">
                            <p className="text-[8px] text-gray-400">총결제</p>
                            <p className="text-sm font-black text-emerald-700">{total % 1 === 0 ? total : total.toFixed(1)}</p>
                          </div>
                          <div className="bg-white rounded-lg py-1.5">
                            <p className="text-[8px] text-gray-400">공급결제율</p>
                            <p className="text-sm font-black text-blue-700">{supplyRate !== null ? supplyRate.toFixed(1) + '%' : '—'}</p>
                            {isCurrent && live && <p className="text-[7px] text-blue-400 mt-0.5">실시간</p>}
                          </div>
                          <div className="bg-white rounded-lg py-1.5">
                            <p className="text-[8px] text-gray-400">목표</p>
                            <p className="text-sm font-black text-gray-700">{e.target || 0}</p>
                          </div>
                        </div>
                        {/* 일별 공급 기록 */}
                        {daysArr.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {daysArr.map(([day, val]) => (
                              <span key={day} className="text-[9px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-medium">
                                {day}일: {String(val)}개
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function SalesCeoTab({ initialView, initialStatusTab }: { initialView?: CeoView; initialStatusTab?: StatusKey }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [ceoView, setCeoView] = useState<CeoView>(initialView ?? 'customers')
  const [supplyBannerDismissed, setSupplyBannerDismissed] = useState(false)
  const [personTab, setPersonTab] = useState<string>('all')
  const [statusTab, setStatusTab] = useState<StatusKey>(initialStatusTab ?? 'all')
  const [inspDetail, setInspDetail] = useState<Customer | null>(null)
  const [opsUsers, setOpsUsers] = useState<string[]>([])
  const [supplyConfig, setSupplyConfig] = useState<SupplyConfig>({})
  const [supplyEditMode, setSupplyEditMode] = useState(false)
  const [supplyDraft, setSupplyDraft] = useState<Record<string, { supplied: string; goal: string; base: string }>>({})
  const [supplySaving, setSupplySaving] = useState(false)
  // 실제 영업팀 사용자 목록 (DB의 users 테이블 기준)
  const [officialSalesUsers, setOfficialSalesUsers] = useState<string[]>([])
  // 대표 직가업체 추가 폼
  const [showCeoDirectForm, setShowCeoDirectForm] = useState(false)
  const [ceoDirectSaving, setCeoDirectSaving] = useState(false)
  // 직가업체 등록 후 자동 관리팀 전송 대기
  const [ceoDirectTransferQueue, setCeoDirectTransferQueue] = useState<Customer | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [cRes, oRes, scRes, uRes] = await Promise.all([
          fetch('/api/customers'),
          fetch('/api/ops-cases'),
          fetch('/api/supply-config'),
          fetch('/api/users?role=sales'),
        ])
        const [cData, oData, scData, uData] = await Promise.all([cRes.json(), oRes.json(), scRes.json(), uRes.json()])
        setCustomers(cData.customers || [])
        // 실제 영업팀 사용자 이름 목록 저장
        const salesUserNames = (uData.users || []).map((u: any) => u.name).filter(Boolean) as string[]
        setOfficialSalesUsers(salesUserNames)
        // ops_user_name이 없는 경우 owner_id(이름 저장)로 fallback
        const names = Array.from(new Set(
          (oData.cases || []).map((c: any) => c.ops_user_name || c.owner_id).filter((v: any) => v && typeof v === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))
        )) as string[]
        setOpsUsers(names)
        // 공급 설정 로드 (이번달 것만 사용)
        const thisMonth = new Date().toISOString().slice(0, 7)
        if (scData.config?.month === thisMonth) {
          setSupplyConfig(scData.config.people || {})
        } else {
          // 이번달 설정 없음 → 기본값으로 초기화 (손제후 27/40, 김윤지 12/20)
          const defaultPeople: SupplyConfig = {
            '손제후': { supplied: 27, goal: 40, base: 3.5 },
            '김윤지': { supplied: 12, goal: 20, base: 0.5 },
          }
          // 자동 저장
          fetch('/api/supply-config', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month: thisMonth, people: defaultPeople }),
          })
          setSupplyConfig(defaultPeople)
        }
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const salesPeople = useMemo(() => {
    if (officialSalesUsers.length > 0) {
      // 실제 users 테이블에 있는 영업팀 이름만 표시 (TESTER 제외, 가나다순)
      return [...officialSalesUsers].filter(n => n !== DIARY_TESTER).sort()
    }
    // fallback: 고객 데이터에서 유니코드 정규화 후 추출 (TESTER 제외)
    const names = Array.from(
      new Set(
        customers
          .map((c: any) => (c.details?.sales_user_name || c.sales_user_name || '').normalize('NFC').trim())
          .filter(n => Boolean(n) && n !== DIARY_TESTER)
      )
    ).sort() as string[]
    return names
  }, [customers, officialSalesUsers])

  // 공식 영업팀 외 이름이 있는 이상한 데이터 감지
  const unknownOwners = useMemo(() => {
    if (officialSalesUsers.length === 0) return []
    const officialSet = new Set(officialSalesUsers.map(n => n.normalize('NFC').trim()))
    const unknown = Array.from(new Set(
      customers
        .map((c: any) => (c.details?.sales_user_name || c.sales_user_name || '').normalize('NFC').trim())
        .filter(name => name && !officialSet.has(name))
    )) as string[]
    return unknown
  }, [customers, officialSalesUsers])

  const personCustomers = useMemo(() => {
    if (personTab === 'all') return customers
    return customers.filter((c: any) =>
      (c.details?.sales_user_name || c.sales_user_name || '').normalize('NFC').trim() === personTab.normalize('NFC').trim()
    )
  }, [customers, personTab])

  const statusCustomers = useMemo(() => {
    let list: Customer[]
    if (statusTab === 'all') {
      list = personCustomers
    } else if (statusTab === 'lead') {
      list = personCustomers.filter(c => ['lead', 'consulting'].includes(c.status))
    } else {
      list = personCustomers.filter(c => c.status === statusTab)
    }
    // 전체DB 탭은 최신 등록순(created_at 내림차순) 정렬
    if (statusTab === 'all') {
      return [...list].sort((a, b) =>
        ((b as any).created_at || '').localeCompare((a as any).created_at || '')
      )
    }
    return list
  }, [personCustomers, statusTab])

  // 심사요청 대기 중인 업체
  const pendingInspections = useMemo(() =>
    customers.filter(c => c.details?.inspection_status === 'pending'),
  [customers])

  // A/S 요청 대기 중인 업체
  const pendingAsRequests = useMemo(() =>
    customers.filter(c => (c as any).details?.as_requested === true && !(c as any).details?.as_resolved),
  [customers])

  const asApprovedList = useMemo(() =>
    customers.filter(c => (c as any).details?.as_approved === true),
  [customers])

  // 공급수 1 차감 헬퍼
  async function decrementSupplyForUser(ownerName: string) {
    if (!ownerName || !supplyConfig[ownerName]) return
    const cfg = supplyConfig[ownerName]
    const newSupplied = Math.max(0, (cfg.supplied || 0) - 1)
    const updatedPeople: SupplyConfig = { ...supplyConfig, [ownerName]: { ...cfg, supplied: newSupplied } }
    await fetch('/api/supply-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: new Date().toISOString().slice(0, 7), people: updatedPeople }),
    })
    setSupplyConfig(updatedPeople)
  }

  // A/S 완료 — DB쓰레기통 이동 + 공급수 -1
  async function approveAs(id: string) {
    const c = customers.find(x => x.id === id)
    const ownerName = (c as any)?.details?.sales_user_name || (c as any)?.sales_user_name || ''
    await updateCustomer(id, {
      status: 'trash',
      details: { as_approved: true, as_resolved: true, as_approve_date: new Date().toISOString().slice(0, 10) },
    })
    await decrementSupplyForUser(ownerName)
  }

  // A/S 비해당 — 결과 기록 (DB이동 없음)
  async function notApplicableAs(id: string) {
    const today = new Date().toISOString().slice(0, 10)
    await updateCustomer(id, {
      details: {
        as_not_applicable: true,
        as_resolved: true,
        as_not_applicable_date: today,
      },
    })
  }

  // ── 공급 현황 계산 ──────────────────────────────────────
  const now = new Date()
  const thisMonthStr = now.toISOString().slice(0, 7)
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

  const personStats = useMemo(() => salesPeople.map(name => {
    const mine = customers.filter((c: any) => (c.details?.sales_user_name || c.sales_user_name || '').trim() === name)
    const contracted = mine.filter((c: any) => c.status === 'contracted')
    return {
      name,
      total: mine.length,
      lead: mine.filter((c: any) => ['lead', 'consulting'].includes(c.status)).length,
      db010: mine.filter((c: any) => {
        const m = (c as any).details?.db010_month || ((c as any).details?.is_direct ? ((c as any).created_at || '').slice(0, 7) : null)
        return m === thisMonthStr
      }).length,
      contracted: contracted.reduce((sum, c) => sum + contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included), 0),
      revenue: contracted.reduce((sum, c) => sum + parseNum((c as any).details?.my_revenue), 0),
    }
  }), [customers, salesPeople, thisMonthStr])

  const totalRevenue = useMemo(() =>
    customers.filter(c => c.status === 'contracted')
      .reduce((sum, c) => sum + parseNum((c as any).details?.my_revenue), 0),
  [customers])

  // ── 이번달 / 저번달 매출 · 계약 수 ──────────────────────
  const thisMonthContracted = useMemo(() =>
    customers.filter(c => c.status === 'contracted' &&
      ((c as any).details?.contract_date || '').slice(0, 7) === thisMonthStr),
  [customers, thisMonthStr])

  const lastMonthContracted = useMemo(() =>
    customers.filter(c => c.status === 'contracted' &&
      ((c as any).details?.contract_date || c.created_at || '').slice(0, 7) === lastMonthStr),
  [customers, lastMonthStr])

  const thisMonthRevenue = useMemo(() =>
    thisMonthContracted.reduce((s, c) => s + parseNum((c as any).details?.my_revenue), 0),
  [thisMonthContracted])

  const lastMonthRevenue = useMemo(() =>
    lastMonthContracted.reduce((s, c) => s + parseNum((c as any).details?.my_revenue), 0),
  [lastMonthContracted])

  const thisMonthContractCount = useMemo(() =>
    thisMonthContracted.reduce((s, c) => s + contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included), 0),
  [thisMonthContracted])

  const lastMonthContractCount = useMemo(() =>
    lastMonthContracted.reduce((s, c) => s + contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included), 0),
  [lastMonthContracted])

  // 인별 이번달 매출
  const personThisMonth = useMemo(() => salesPeople.map(name => {
    const mine = thisMonthContracted.filter(
      c => (c as any).details?.sales_user_name === name || c.sales_user_name === name
    )
    // 이번달 직가DB 등록 수 (status 무관 — db010_month 기준, 거절/계약 이동해도 유지)
    const db010 = customers.filter((c: any) => {
      const owner = (c.details?.sales_user_name || c.sales_user_name || '').trim()
      if (owner !== name) return false
      const m = c.details?.db010_month || (c.details?.is_direct ? (c.created_at || '').slice(0, 7) : null)
      return m === thisMonthStr
    }).length
    return {
      name,
      revenue: mine.reduce((s, c) => s + parseNum((c as any).details?.my_revenue), 0),
      payment: mine.reduce((s, c) => s + parseNum((c as any).details?.payment_amount), 0),
      count:   mine.reduce((s, c) => s + contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included), 0),
      db010,
    }
  }), [salesPeople, thisMonthContracted, customers, thisMonthStr])
  const bizElapsed = getElapsedBusinessDays(now.getFullYear(), now.getMonth(), now.getDate())

  const supplyStats = useMemo(() => {
    return salesPeople.map(name => {
      const cfg = supplyConfig[name] || { supplied: 0, goal: 30, base: 0 }
      // 전체 계약된 고객 중 해당 영업사원의 계약 가중치 합산 (월 필터 없음)
      const dbContracted = customers
        .filter(c =>
          c.status === 'contracted' &&
          (c.sales_user_name === name || (c as any).details?.sales_user_name === name)
        )
        .reduce((sum, c) => sum + contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included), 0)
      const totalContracted = cfg.base + dbContracted
      // floor(소수점 2자리 버림) — 반올림 시 12.999...→13.00이 되어 공급 오계산 방지
      const rate = cfg.supplied > 0 ? Math.floor(totalContracted / cfg.supplied * 10000) / 100 : 0
      const recommended = calcRecommendedSupply(rate, bizElapsed)
      const achievePct = cfg.goal > 0 ? Math.floor(totalContracted / cfg.goal * 10000) / 100 : 0
      return { name, cfg, dbContracted, totalContracted, rate, recommended, achievePct }
    })
  }, [salesPeople, supplyConfig, customers, thisMonthStr, bizElapsed])

  const counts = useMemo(() => ({
    all:        personCustomers.length,
    lead:       personCustomers.filter(c => ['lead', 'consulting'].includes(c.status)).length,
    db010:      personCustomers.filter(c => {
      const m = (c as any).details?.db010_month || ((c as any).details?.is_direct ? ((c as any).created_at || '').slice(0, 7) : null)
      return m === thisMonthStr
    }).length,
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

  // ── 공급 설정 저장 ──────────────────────────────────────
  async function saveSupplyConfig() {
    setSupplySaving(true)
    const thisMonth = new Date().toISOString().slice(0, 7)
    const people: SupplyConfig = {}
    for (const name of Object.keys(supplyDraft)) {
      people[name] = {
        supplied: parseFloat(supplyDraft[name].supplied) || 0,
        goal:     parseFloat(supplyDraft[name].goal) || 0,
        base:     parseFloat(supplyDraft[name].base) || 0,
      }
    }
    await fetch('/api/supply-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: thisMonth, people }),
    })
    setSupplyConfig(people)
    setSupplyEditMode(false)
    setSupplySaving(false)
  }

  function openSupplyEdit() {
    const draft: Record<string, { supplied: string; goal: string; base: string }> = {}
    for (const name of salesPeople) {
      const cfg = supplyConfig[name] || { supplied: 0, goal: 30, base: 0 }
      draft[name] = {
        supplied: String(cfg.supplied),
        goal:     String(cfg.goal),
        base:     String(cfg.base),
      }
    }
    setSupplyDraft(draft)
    setSupplyEditMode(true)
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

  // ── 카드 한 장 DB 이동 (대표 전용) ──────────────────────────────────
  async function handleCeoTransfer(id: string, destPerson: string, destBucket: string, destRole: 'sales' | 'ops') {
    if (destRole === 'sales') {
      // 1. 담당자 변경
      await updateCustomer(id, {
        details: {
          sales_user_name: destPerson,
          transfer_history: [
            ...((customers.find(x => x.id === id) as any)?.details?.transfer_history || []),
            { from: (customers.find(x => x.id === id) as any)?.details?.sales_user_name || '—', to: destPerson, at: new Date().toISOString().slice(0, 10), by: 'CEO' },
          ],
        },
      })
      // 2. 상태(버킷) 변경
      if (destBucket) await changeStatus(id, destBucket)
    } else {
      // 관리팀으로 이동: ops_case 생성
      const c = customers.find(x => x.id === id)!
      const details: any = c.details || {}
      const isNewDb = destBucket === 'new_db'
      const revenue = parseInt(String(details.my_revenue || '0').replace(/[^0-9]/g, ''), 10) || 0
      const salesTimeline = ((c as any).call_timeline || []).map((e: any) => ({ ...e, source: 'sales' }))
      await fetch('/api/ops-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: details.company || c.company || c.name || '',
          phone: c.phone || '',
          stage: isNewDb ? 'new_db' : destBucket,
          memo: `대표 배정 → ${destPerson}`,
          revenue,
          owner_id: destPerson,
          customer_id: c.id,
          timeline: salesTimeline.length > 0 ? salesTimeline : undefined,
          details: {
            sales_customer_info: {
              customer_id:       c.id,
              company:           details.company || c.company || c.name || '',
              representative:    c.name || '',
              phone:             c.phone || '',
              sales_user_name:   details.sales_user_name || '',
              region:            details.region || '',
              reception_date:    details.reception_date || '',
              created_at:        (c as any).created_at || '',
              business_type:     details.business_type || '',
              real_work:         details.real_work || '',
              years_in_business: details.years_in_business || details.biz_size || '',
              employee_count:    details.employee_count || '',
              innovation:        details.innovation || '',
              loan_history:      (c as any).loan_history || details.loan_history || '',
              loan_kibo:         details.loan_kibo   || details.loan_policy || '',
              loan_shinbo:       details.loan_shinbo  || '',
              loan_jaedan:       details.loan_jaedan  || '',
              loan_jinjong:      details.loan_jinjong || '',
              loan_sojin:        details.loan_sojin   || '',
              loan_other:        details.loan_other   || details.loan_credit || '',
              loan_total:        details.loan_total   || '',
              credit_kcb:        details.credit_kcb   || details.credit_score || '',
              credit_nice:       details.credit_nice  || '',
              tax_status:        details.tax_status   || details.tax_delinquency || '',
              assets:            details.assets        || '',
              revenue_2025:      details.revenue_2025  || '',
              revenue_2024:      details.revenue_2024  || '',
              revenue_2023:      details.revenue_2023  || '',
              required_funds:    details.required_funds || '',
              solution:          details.solution       || '',
              call_result:       details.call_result    || '',
              closing_result:    details.closing_result || '',
              subcall_date:      details.subcall_date   || '',
              contract_fee:      details.contract_fee    || '',
              commission_rate:   details.commission_rate || '',
              payment_amount:    details.payment_amount  || '',
              unpaid_amount:     details.unpaid_amount   || '',
              tax_invoice:       details.tax_invoice     || '',
            },
          },
        }),
      })
      await updateCustomer(id, { details: { ops_transferred: true } })
    }
    // 데이터 갱신
    const res = await fetch('/api/customers')
    const data = await res.json()
    setCustomers(data.customers || [])
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

  // 공가 → 직가 전환 (대표 전용, 기존 고객 소급 처리)
  async function handleMarkDirect(id: string) {
    const c = customers.find(x => x.id === id)
    const details = (c as any)?.details || {}
    const thisMonth = new Date().toISOString().slice(0, 7)
    await updateCustomer(id, {
      details: {
        is_direct: true,
        db010_month: details.db010_month || details.reception_date?.slice(0, 7) || thisMonth,
      },
    })
  }

  // 대표 직가업체 등록 (InCallForm으로 받은 데이터)
  async function submitCeoDirect(data: InCallData) {
    setCeoDirectSaving(true)
    try {
      const now = new Date()
      const db010Month = now.toISOString().slice(0, 7)
      const payload = {
        name:    data.name,
        phone:   data.phone,
        company: data.company,
        notes:   data.notes,
        status:  'db010',
        details: {
          company:          data.company,
          corp_type:        data.corp_type,
          region:           data.region,
          business_reg_no:  data.business_reg_no,
          assignee:         data.assignee,
          reception_date:   data.reception_date || now.toISOString().slice(0, 10),
          business_type:    data.business_type,
          years_in_business: data.years_in_business,
          employee_count:   data.employee_count,
          loan_kibo:        data.loan_kibo || data.loan_policy,
          loan_policy:      data.loan_policy,
          loan_credit:      data.loan_credit,
          revenue_2026:     data.revenue_2026,
          revenue_2025:     data.revenue_2025,
          revenue_2024:     data.revenue_2024,
          revenue_2023:     data.revenue_2023,
          credit_score:     data.credit_score,
          tax_delinquency:  data.tax_delinquency,
          assets:           data.assets,
          required_funds:   data.required_funds,
          sensitivity:      data.sensitivity,
          sales_user_name:  'CEO직가',
          db010_month:      db010Month,
          is_direct:        true,
          ceo_direct:       true,   // 대표 직접 등록 마커
        },
      }
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const json = await res.json()
        const newCustomer = json.customer || json
        setCustomers(prev => [newCustomer, ...prev])
        setShowCeoDirectForm(false)
        // 등록 직후 관리팀 전송 대기 (인콜카드 생성)
        setCeoDirectTransferQueue(newCustomer)
        setCeoView('customers')
        setStatusTab('db010')
      }
    } catch {}
    setCeoDirectSaving(false)
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
          고객관리
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
        <button type="button" onClick={() => setCeoView('diary')}
          className={"flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors " + (
            ceoView === 'diary' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200 hover:border-emerald-400'
          )}>
          📒 영업일지
        </button>
        <button type="button" onClick={() => setShowCeoDirectForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors bg-violet-600 text-white border-violet-600 hover:bg-violet-700">
          ➕ 직가업체
        </button>
      </div>

      {/* ── 대표 직가업체 등록 모달 (전체 인콜일지 폼) ── */}
      {showCeoDirectForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl">
            <div className="bg-violet-600 rounded-t-2xl px-5 py-3 flex items-center justify-between">
              <span className="text-white font-bold text-sm">➕ 직가업체 인콜일지 등록 (대표)</span>
              <button onClick={() => setShowCeoDirectForm(false)} className="text-white/70 hover:text-white text-lg">✕</button>
            </div>
            <div className="bg-violet-50 px-5 py-2.5 text-xs text-violet-700 border-x border-violet-200">
              직가DB로 분류 · <b>CEO직가</b>로 저장 · 등록 후 관리팀 전송하여 인콜카드 생성
            </div>
            <InCallForm
              title="직가업체 인콜일지"
              salesUsers={['CEO직가', ...salesPeople]}
              submitting={ceoDirectSaving}
              submitLabel="직가업체 등록 + 관리팀 전송 대기"
              onSubmit={submitCeoDirect}
              onCancel={() => setShowCeoDirectForm(false)}
            />
          </div>
        </div>
      )}

      {/* ── 직가업체 등록 완료 → 관리팀 전송 배너 ── */}
      {ceoDirectTransferQueue && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border border-violet-300 shadow-2xl rounded-2xl px-5 py-4 flex items-center gap-4 max-w-lg w-full mx-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-violet-700">직가업체 등록 완료!</p>
            <p className="text-xs text-gray-600 mt-0.5 truncate">
              <b>{(ceoDirectTransferQueue as any).details?.company || ceoDirectTransferQueue.company || ceoDirectTransferQueue.name}</b> — 지금 관리팀으로 전송하여 인콜카드를 생성하세요
            </p>
          </div>
          <button
            onClick={() => {
              const c = ceoDirectTransferQueue
              setCeoDirectTransferQueue(null)
              // 해당 고객 카드를 열고 DB 이동 모달 트리거
              setCeoView('transfer')
            }}
            className="shrink-0 px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition-colors">
            관리팀 전송
          </button>
          <button onClick={() => setCeoDirectTransferQueue(null)} className="text-gray-400 hover:text-gray-600 shrink-0">✕</button>
        </div>
      )}

      {/* ── 심사요청 전용 뷰 ── */}
      {ceoView === 'inspection' && (
        <div className="space-y-3">
          <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <span className="text-sm font-bold text-amber-800">🔍 심사 요청 대기</span>
              <span className="text-[10px] text-amber-600">{pendingInspections.length}건 · 업체 클릭 → 인콜일지 확인 후 승인/반려</span>
            </div>
            {pendingInspections.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">심사 요청 없음</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingInspections.map(c => {
                  const owner = (c as any).details?.sales_user_name || (c as any).sales_user_name || '—'
                  const isOpen = inspDetail?.id === c.id
                  return (
                    <div key={c.id}>
                      {/* 요약 행 — 클릭 시 인콜일지 펼침 */}
                      <div
                        onClick={() => setInspDetail(isOpen ? null : c)}
                        className={`px-5 py-4 flex items-start justify-between gap-4 cursor-pointer transition-colors ${isOpen ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-bold text-gray-900 text-sm">{(c as any).details?.company || c.company || c.name}</p>
                            <span className="text-[10px] text-gray-400">{c.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{c.phone}</span>
                            <span className="text-[10px] bg-amber-50 border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">{owner}</span>
                          </div>
                          <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
                            <span>요청일: <b>{(c as any).details?.inspection_date || '—'}</b></span>
                            {(c as any).details?.business_type && <span>업종: {(c as any).details.business_type}</span>}
                            {(c as any).details?.required_funds && <span>필요자금: {(c as any).details.required_funds}</span>}
                            {(c as any).details?.credit_nice && <span>NICE: {(c as any).details.credit_nice}</span>}
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-lg border font-medium shrink-0 transition-colors ${isOpen ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {isOpen ? '▲ 닫기' : '인콜일지 보기'}
                        </span>
                      </div>

                      {/* 인콜일지 + 승인/반려 버튼 */}
                      {isOpen && (
                        <div className="border-t border-amber-100 bg-amber-50/30">
                          {/* 승인/반려 버튼 바 */}
                          <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-amber-100">
                            <p className="text-xs text-gray-500 flex-1">타임라인에 메모 작성 후 완료 또는 반려하세요. 완료 시 담당자에게 알림이 전송됩니다.</p>
                            <button type="button" onClick={async () => { await handleInspection(c.id, 'approved'); setInspDetail(null) }}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors">
                              심사완료
                            </button>
                            <button type="button" onClick={async () => { await handleInspection(c.id, 'rejected'); setInspDetail(null) }}
                              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg border border-red-200 transition-colors">
                              ❌ 반려
                            </button>
                          </div>
                          {/* 인콜일지 전체 렌더 */}
                          <div className="p-3">
                            <InCallTableView
                              customers={[customers.find(x => x.id === c.id) || c]}
                              allCustomers={customers}
                              tabType={toTabType(c.status)}
                              salesUsers={salesPeople}
                              userName="ceo"
                              showOwner={true}
                              onUpdate={async (id, patch) => {
                                await updateCustomer(id, patch)
                                // inspDetail 동기화
                                setInspDetail(prev => prev?.id === id ? { ...prev, ...(patch.details ? { details: { ...(prev.details || {}), ...patch.details } } : patch) } : prev)
                              }}
                              onStatusChange={changeStatus}
                              onDelete={deleteCustomer}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── A/S 요청 전용 뷰 ── */}
      {ceoView === 'as' && (
        <div className="space-y-4">
          {/* 대기 중인 A/S 요청 */}
          <div className="bg-white border border-orange-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-orange-50 border-b border-orange-200 flex items-center justify-between">
              <span className="text-sm font-bold text-orange-800">🔧 A/S 요청 대기</span>
              <span className="text-[10px] text-orange-600">{pendingAsRequests.length}건 · A/S 승인 또는 불가 처리</span>
            </div>
            {pendingAsRequests.length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">A/S 요청 없음</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pendingAsRequests.map(c => {
                  const owner = (c as any).details?.sales_user_name || (c as any).sales_user_name || '—'
                  return (
                    <div key={c.id} className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-bold text-gray-900 text-sm">{(c as any).details?.company || c.company || c.name}</p>
                          <span className="text-[10px] text-gray-400">{c.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{c.phone}</span>
                          <span className="text-[10px] bg-orange-50 border border-orange-200 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">{owner}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mb-1">
                          요청일: <b>{(c as any).details?.as_request_date || '—'}</b>
                        </p>
                        {(c as any).details?.as_memo && (
                          <p className="text-[11px] text-gray-600 bg-gray-50 rounded px-2 py-1">{(c as any).details.as_memo}</p>
                        )}
                        {(c as any).details?.result_memo && (
                          <p className="text-[11px] text-gray-600 bg-gray-50 rounded px-2 py-1 mt-1">{(c as any).details.result_memo}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0 pt-1">
                        <button type="button" onClick={() => approveAs(c.id)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap">
                          A/S완료
                        </button>
                        <button type="button" onClick={() => notApplicableAs(c.id)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg border border-gray-200 transition-colors whitespace-nowrap">
                          ⛔ A/S비해당
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* A/S 승인된 업체 목록 */}
          <div className="bg-white border border-emerald-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-800">A/S 승인 업체</span>
              <span className="text-[10px] text-emerald-600">{asApprovedList.length}건 · 나중에 재활용 가능한 DB</span>
            </div>
            {asApprovedList.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">승인된 A/S 없음</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {asApprovedList.map(c => {
                  const owner = (c as any).details?.sales_user_name || (c as any).sales_user_name || '—'
                  return (
                    <div key={c.id} className="px-5 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 text-sm">{(c as any).details?.company || c.company || c.name}</p>
                          <span className="text-[10px] text-gray-400">{c.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{c.phone}</span>
                          <span className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">{owner}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          요청일: {(c as any).details?.as_request_date || '—'} · 승인일: {(c as any).details?.as_approve_date || '—'}
                        </p>
                      </div>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold shrink-0">A/S 완료</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 영업일지 뷰 ── */}
      {ceoView === 'diary' && <SalesDiaryView customers={customers} />}

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

      {/* ── 매출 통계 패널 ── */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-blue-800 rounded-2xl px-5 py-4 text-white">
        <p className="text-xs font-bold text-white/60 uppercase tracking-wide mb-3">영업팀 매출 현황</p>

        {/* 이번달 / 저번달 나란히 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/10 rounded-xl px-4 py-3">
            <p className="text-[10px] text-white/50 mb-1">이번달 ({now.getMonth() + 1}월)</p>
            <p className="text-2xl font-black text-[#C5A258]">{fmtWon(thisMonthRevenue)}</p>
            <p className="text-xs text-white/50 mt-0.5">
              계약 {thisMonthContractCount % 1 === 0 ? thisMonthContractCount : thisMonthContractCount.toFixed(1)}건
            </p>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-3">
            <p className="text-[10px] text-white/50 mb-1">저번달 ({lastMonthDate.getMonth() + 1}월)</p>
            <p className="text-2xl font-black text-white/70">{fmtWon(lastMonthRevenue)}</p>
            <p className="text-xs text-white/50 mt-0.5">
              계약 {lastMonthContractCount % 1 === 0 ? lastMonthContractCount : lastMonthContractCount.toFixed(1)}건
            </p>
          </div>
        </div>

        {/* 인별 이번달 매출 */}
        {personThisMonth.length === 0 ? (
          <p className="text-white/40 text-xs">등록된 영업사원 없음</p>
        ) : (
          <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {personThisMonth.filter(p => p.name !== DIARY_TESTER).map(p => (
              <div key={p.name} className="bg-white/10 rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">{p.name.charAt(0)}</div>
                  <span className="text-xs font-semibold text-white/90 truncate">{p.name.replace(' 수석팀장', '')}</span>
                </div>
                <p className="text-base font-black text-[#C5A258]">{fmtWon(p.revenue)}</p>
                <p className="text-[10px] text-white/40 mt-0.5">계약 {p.count % 1 === 0 ? p.count : p.count.toFixed(1)}건</p>
                {(p as any).db010 > 0 && (
                  <p className="text-[10px] text-violet-300 font-semibold mt-0.5">직가 {(p as any).db010}개</p>
                )}
                <div className="mt-0.5 text-[9px] text-white/30 leading-relaxed">
                  <span>입금 {p.payment > 0 ? fmtWon(p.payment) : '—'}</span>
                  <span className="mx-0.5 text-white/15">·</span>
                  <span>매출 {p.revenue > 0 ? fmtWon(p.revenue) : '—'}</span>
                </div>
              </div>
            ))}
          </div>
          {/* TESTER 계정 — 테스트용, 별도 표시 */}
          {personThisMonth.some(p => p.name === DIARY_TESTER) && (
            <div className="flex items-center gap-2 mt-1 opacity-40">
              <span className="text-[9px] text-white/50 border border-white/20 rounded px-1.5 py-0.5">테스트 계정</span>
              {personThisMonth.filter(p => p.name === DIARY_TESTER).map(p => (
                <span key={p.name} className="text-[9px] text-white/40">
                  TESTER · 매출 {p.revenue > 0 ? fmtWon(p.revenue) : '—'} · 계약 {p.count % 1 === 0 ? p.count : p.count.toFixed(1)}건
                </span>
              ))}
            </div>
          )}
          </>
        )}

        {/* 전체 합계 (부가 표시) */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
          <span className="text-[10px] text-white/30">전체 누적</span>
          <span className="text-xs text-white/40 font-medium">{fmtWon(totalRevenue)}</span>
          <span className="text-[10px] text-white/20 ml-1">·</span>
          <span className="text-[10px] text-white/30">계약 {customers.filter(c => c.status === 'contracted').length}개</span>
        </div>
      </div>

      {/* ── A/S 승인 → 공급 DB 보충 알림 배너 ── */}
      {asApprovedList.length > 0 && !supplyBannerDismissed && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl font-bold text-amber-500">!</span>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">공급 DB 보충 필요</p>
            <p className="text-xs text-amber-600">A/S 승인 {asApprovedList.length}건 확인됨 · 소진된 DB {asApprovedList.length}개를 보충해주세요</p>
          </div>
          <button
            type="button"
            onClick={() => setCeoView('as')}
            className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-amber-600 transition-colors"
          >
            A/S 확인
          </button>
          <button
            type="button"
            onClick={() => setSupplyBannerDismissed(true)}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
            title="닫기"
          >
            ✕
          </button>
        </div>
      )}

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
            전체
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
              {(() => {
                const tm = personThisMonth.find(m => m.name === p.name)
                const tmRevenue = tm?.revenue || 0
                const tmCount = tm?.count || 0
                return (
                  <div className={"flex flex-wrap gap-2 mt-1.5 text-[10px] " + (personTab === p.name ? 'text-white/70' : 'text-gray-400')}>
                    <span>이번달 매출 <b className={personTab === p.name ? 'text-[#C5A258]' : 'text-emerald-600'}>{fmtWon(tmRevenue)}</b></span>
                    <span>·</span>
                    <span>계약 {tmCount % 1 === 0 ? tmCount : tmCount.toFixed(1)}</span>
                    {p.db010 > 0 && (
                      <>
                        <span>·</span>
                        <span>직가 <b className={personTab === p.name ? 'text-violet-300' : 'text-violet-500'}>{p.db010}</b></span>
                      </>
                    )}
                  </div>
                )
              })()}
            </button>
          ))}
        </div>
      </div>

      {/* 등록되지 않은 담당자 배너 제거됨 */}

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
          tabType={statusTab === 'all' ? 'lead' : statusTab}
          salesUsers={salesPeople}
          opsUsers={opsUsers}
          userName="ceo"
          showOwner={personTab === 'all'}
          onUpdate={updateCustomer}
          onStatusChange={changeStatus}
          onDelete={deleteCustomer}
          onCeoTransfer={handleCeoTransfer}
          onMarkDirect={handleMarkDirect}
        />
      )}
      </>)}
    </div>
  )
}
