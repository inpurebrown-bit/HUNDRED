'use client'

import React, { useState, useEffect, useMemo } from 'react'
import InCallTableView from '@/components/sales/InCallTableView'
import type { Customer } from '@/components/sales/InCallTableView'

type StatusKey = 'lead' | 'db010' | 'contracted' | 'emotional' | 'trash'

const STATUS_TABS = [
  { key: 'lead' as StatusKey,       label: '고객 DB',   color: 'text-sky-600',     bg: 'bg-sky-500' },
  { key: 'db010' as StatusKey,      label: '010 DB',    color: 'text-violet-600',  bg: 'bg-violet-500' },
  { key: 'contracted' as StatusKey, label: '계약 업체', color: 'text-emerald-600', bg: 'bg-emerald-500' },
  { key: 'emotional' as StatusKey,  label: '감성톡',    color: 'text-pink-600',    bg: 'bg-pink-500' },
  { key: 'trash' as StatusKey,      label: '자체거절',  color: 'text-gray-500',    bg: 'bg-gray-400' },
]

export default function SalesCeoTab() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
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
      new Set(customers.map((c: any) => c.details?.sales_user_name || c.sales_user_name).filter(Boolean))
    ).sort() as string[]
    return names
  }, [customers])

  const personCustomers = useMemo(() => {
    if (personTab === 'all') return customers
    return customers.filter((c: any) => (c.details?.sales_user_name || c.sales_user_name) === personTab)
  }, [customers, personTab])

  const statusCustomers = useMemo(() => {
    if (statusTab === 'lead') return personCustomers.filter(c => ['lead', 'consulting'].includes(c.status))
    return personCustomers.filter(c => c.status === statusTab)
  }, [personCustomers, statusTab])

  // 심사요청 대기 중인 업체
  const pendingInspections = useMemo(() =>
    customers.filter(c => c.details?.inspection_status === 'pending'),
  [customers])

  const personStats = useMemo(() => salesPeople.map(name => {
    const mine = customers.filter((c: any) => (c.details?.sales_user_name || c.sales_user_name) === name)
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
    <div className="space-y-5 pb-12">

      {/* ── 심사요청 대기 섹션 ── */}
      {pendingInspections.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-amber-800">🔍 심사 요청 대기</span>
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {pendingInspections.length}건
              </span>
            </div>
            <p className="text-[10px] text-amber-600">영업팀에서 심사를 요청한 업체입니다</p>
          </div>
          <div className="divide-y divide-amber-100">
            {pendingInspections.map(c => {
              const owner = (c as any).details?.sales_user_name || (c as any).sales_user_name || '—'
              return (
                <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800 text-sm">{c.company || c.name}</p>
                      <span className="text-[10px] text-gray-400">{c.name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{c.phone}</span>
                      <span className="text-[10px] bg-white border border-amber-200 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                        {owner}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                      <span>요청일: {c.details?.inspection_date || '—'}</span>
                      {c.details?.business_type && <span>업종: {c.details.business_type}</span>}
                      {c.details?.required_funds && <span>필요자금: {c.details.required_funds}</span>}
                    </div>
                    {c.details?.result_memo && (
                      <p className="text-[11px] text-gray-600 mt-1 line-clamp-2">{c.details.result_memo}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleInspection(c.id, 'approved')}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      ✅ 승인
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInspection(c.id, 'rejected')}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition-colors border border-red-200"
                    >
                      ❌ 반려
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
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
          tabType={statusTab}
          salesUsers={salesPeople}
          userName="ceo"
          showOwner={personTab === 'all'}
          onUpdate={updateCustomer}
          onStatusChange={changeStatus}
          onDelete={deleteCustomer}
        />
      )}
    </div>
  )
}
