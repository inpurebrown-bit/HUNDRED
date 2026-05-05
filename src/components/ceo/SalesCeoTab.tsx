'use client'

import React, { useState, useEffect, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────
interface Customer {
  id: string
  name: string
  company: string
  phone: string
  status: string
  sales_user_id: string
  sales_user_name: string
  notes: string
  loan_history: string
  created_at: string
  details?: Record<string, any>
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
const thisMonth = () => new Date().toISOString().slice(0, 7)

const STATUS_COLOR: Record<string, string> = {
  lead:       'bg-sky-100 text-sky-700',
  consulting: 'bg-amber-100 text-amber-700',
  contracted: 'bg-emerald-100 text-emerald-700',
  db010:      'bg-violet-100 text-violet-700',
  emotional:  'bg-pink-100 text-pink-700',
  trash:      'bg-gray-100 text-gray-500',
}
const STATUS_KO: Record<string, string> = {
  lead: '신규', consulting: '상담중', contracted: '계약', db010: '010DB',
  emotional: '감성관리', trash: '휴지통',
}

function StatCard({ label, value, sub, color = 'bg-white' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className={`${color} rounded-2xl p-4 border border-[#E8E2D4] shadow-sm`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-black text-[#1B2A45]">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────
export default function SalesCeoTab() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [personFilter, setPersonFilter] = useState<string>('all')
  const [searchQ, setSearchQ] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  const mon = thisMonth()

  // ── 전체 통계 ──
  const totalCustomers  = customers.length
  const leads           = customers.filter(c => c.status === 'lead').length
  const consulting      = customers.filter(c => c.status === 'consulting').length
  const contracted      = customers.filter(c => c.status === 'contracted').length
  const db010           = customers.filter(c => c.status === 'db010').length
  const monthContracts  = contracts.filter(c => c.created_at?.slice(0, 7) === mon).length
  const monthAmount     = contracts
    .filter(c => c.created_at?.slice(0, 7) === mon)
    .reduce((s, c) => s + (c.contract_amount || 0), 0)

  // ── 영업사원 목록 ──
  const salesPeople = useMemo(() => {
    const names = Array.from(new Set(customers.map(c => c.sales_user_name).filter(Boolean)))
    return names.sort()
  }, [customers])

  // ── 영업사원별 통계 ──
  const personStats = useMemo(() => salesPeople.map(name => {
    const mine = customers.filter(c => c.sales_user_name === name)
    const myContracts = contracts.filter(c => c.sales_user_name === name)
    const myMonthContracts = myContracts.filter(c => c.created_at?.slice(0, 7) === mon)
    return {
      name,
      total: mine.length,
      lead: mine.filter(c => c.status === 'lead').length,
      consulting: mine.filter(c => c.status === 'consulting').length,
      contracted: mine.filter(c => c.status === 'contracted').length,
      db010: mine.filter(c => c.status === 'db010').length,
      allContracts: myContracts.length,
      monthContracts: myMonthContracts.length,
      monthAmount: myMonthContracts.reduce((s, c) => s + (c.contract_amount || 0), 0),
    }
  }), [customers, contracts, salesPeople, mon])

  // ── 고객 목록 필터 ──
  const filtered = useMemo(() => {
    let list = customers
    if (activeFilter !== 'all') list = list.filter(c => c.status === activeFilter)
    if (personFilter !== 'all') list = list.filter(c => c.sales_user_name === personFilter)
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase()
      list = list.filter(c =>
        c.company?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.phone?.replace(/-/g,'').includes(q.replace(/-/g,''))
      )
    }
    return list
  }, [customers, activeFilter, personFilter, searchQ])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-gray-100" />)}
        </div>
        <div className="h-40 rounded-2xl bg-gray-100" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">

      {/* ── 통합 통계 카드 ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 mb-3">📊 영업팀 전체 현황</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="전체 고객" value={totalCustomers} sub={`신규 ${leads} · 상담 ${consulting}`} />
          <StatCard label="010DB" value={db010} sub="공급 DB" color="bg-violet-50" />
          <StatCard label="이달 계약" value={monthContracts} sub={`총 ${contracts.length}건`} color="bg-emerald-50" />
          <StatCard
            label="이달 계약금액"
            value={monthAmount >= 10000 ? `${(monthAmount/10000).toFixed(0)}만` : `${monthAmount.toLocaleString()}원`}
            sub={`계약 완료 ${contracted}건`}
            color="bg-amber-50"
          />
        </div>
      </div>

      {/* ── 영업사원별 실적 카드 ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 mb-3">👤 영업사원별 실적</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {personStats.map(p => (
            <div key={p.name} className="bg-white rounded-2xl border border-[#E8E2D4] p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#1B2A45] flex items-center justify-center text-white text-sm font-bold">
                    {p.name.charAt(0)}
                  </div>
                  <span className="font-bold text-[#1B2A45] text-sm">{p.name}</span>
                </div>
                <span className="text-xs bg-[#1B2A45]/8 text-[#1B2A45] px-2 py-0.5 rounded-full font-semibold">
                  총 {p.total}명
                </span>
              </div>

              {/* 상태 분포 바 */}
              {p.total > 0 && (
                <div className="flex rounded-full overflow-hidden h-2 mb-3 gap-px">
                  {p.db010 > 0     && <div style={{ width: `${p.db010/p.total*100}%` }}     className="bg-violet-400" title={`010DB ${p.db010}`} />}
                  {p.lead > 0      && <div style={{ width: `${p.lead/p.total*100}%` }}      className="bg-sky-400"    title={`신규 ${p.lead}`} />}
                  {p.consulting > 0 && <div style={{ width: `${p.consulting/p.total*100}%` }} className="bg-amber-400"  title={`상담 ${p.consulting}`} />}
                  {p.contracted > 0 && <div style={{ width: `${p.contracted/p.total*100}%` }} className="bg-emerald-400" title={`계약 ${p.contracted}`} />}
                </div>
              )}

              {/* 수치 그리드 */}
              <div className="grid grid-cols-4 gap-1 text-center">
                <div>
                  <p className="text-xs font-bold text-violet-600">{p.db010}</p>
                  <p className="text-[10px] text-gray-400">010DB</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-sky-600">{p.lead}</p>
                  <p className="text-[10px] text-gray-400">신규</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-600">{p.consulting}</p>
                  <p className="text-[10px] text-gray-400">상담중</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-600">{p.contracted}</p>
                  <p className="text-[10px] text-gray-400">계약</p>
                </div>
              </div>

              <div className="border-t border-gray-100 mt-3 pt-2 flex justify-between text-xs">
                <span className="text-gray-500">이달 계약 <strong className="text-[#1B2A45]">{p.monthContracts}건</strong></span>
                <span className="text-gray-500">전체 <strong className="text-[#1B2A45]">{p.allContracts}건</strong></span>
              </div>
            </div>
          ))}
          {personStats.length === 0 && (
            <div className="col-span-3 text-center text-sm text-gray-400 py-8">등록된 고객 없음</div>
          )}
        </div>
      </div>

      {/* ── 고객 목록 ── */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-bold text-gray-500">📋 고객 목록</h2>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 담당자 필터 */}
            <select
              value={personFilter}
              onChange={e => setPersonFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
            >
              <option value="all">전체 담당자</option>
              {salesPeople.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {/* 검색 */}
            <div className="relative">
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="업체명·이름·연락처"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-36 focus:outline-none focus:ring-2 focus:ring-[#C5A258]/40"
              />
              {searchQ && (
                <button onClick={() => setSearchQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">✕</button>
              )}
            </div>
          </div>
        </div>

        {/* 상태 탭 */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {[
            { key: 'all',        label: `전체 ${customers.length}` },
            { key: 'db010',      label: `010DB ${db010}` },
            { key: 'lead',       label: `신규 ${leads}` },
            { key: 'consulting', label: `상담중 ${consulting}` },
            { key: 'contracted', label: `계약 ${contracted}` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveFilter(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                activeFilter === t.key
                  ? 'bg-[#1B2A45] text-white'
                  : 'bg-white border border-[#E8E2D4] text-gray-500 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 고객 카드 리스트 */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E2D4] p-10 text-center text-sm text-gray-400">
            {searchQ ? `"${searchQ}" 검색 결과 없음` : '해당 고객 없음'}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-400">{filtered.length}건</p>
            {filtered.map(c => {
              const isOpen = expandedId === c.id
              return (
                <div key={c.id} className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : c.id)}
                    className="w-full text-left px-4 py-3 hover:bg-[#FAF8F3] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_KO[c.status] ?? c.status}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1B2A45] truncate">{c.company || c.name}</p>
                          <p className="text-[11px] text-gray-400">{c.name} · {c.phone || '-'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-400 hidden sm:block">{c.sales_user_name}</span>
                        <span className="text-gray-300 text-xs">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[#E8E2D4] bg-[#FAF8F3] px-4 py-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mb-3">
                        <div><span className="text-gray-400">담당자: </span><span className="font-medium">{c.sales_user_name || '-'}</span></div>
                        <div><span className="text-gray-400">연락처: </span><span className="font-medium">{c.phone || '-'}</span></div>
                        <div><span className="text-gray-400">등록일: </span><span className="font-medium">{c.created_at?.slice(0,10) || '-'}</span></div>
                        {c.loan_history && <div className="col-span-full"><span className="text-gray-400">기대출: </span><span>{c.loan_history}</span></div>}
                      </div>
                      {/* 인콜일지 details */}
                      {c.details && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs border-t border-gray-200 pt-3">
                          {c.details.corp_type      && <div><span className="text-gray-400">법인형태: </span>{c.details.corp_type}</div>}
                          {c.details.region         && <div><span className="text-gray-400">지역: </span>{c.details.region}</div>}
                          {c.details.business_type  && <div><span className="text-gray-400">업종: </span>{c.details.business_type}</div>}
                          {c.details.years_in_business && <div><span className="text-gray-400">업력: </span>{c.details.years_in_business}년</div>}
                          {c.details.employee_count && <div><span className="text-gray-400">직원수: </span>{c.details.employee_count}명</div>}
                          {c.details.revenue_2025   && <div><span className="text-gray-400">25년매출: </span>{c.details.revenue_2025}만원</div>}
                          {c.details.revenue_2024   && <div><span className="text-gray-400">24년매출: </span>{c.details.revenue_2024}만원</div>}
                          {c.details.credit_score   && <div><span className="text-gray-400">신용점수: </span>{c.details.credit_score}</div>}
                          {c.details.loan_credit    && <div><span className="text-gray-400">기대출: </span>{c.details.loan_credit}</div>}
                          {c.details.required_funds && <div><span className="text-gray-400">필요자금: </span>{c.details.required_funds}만원</div>}
                          {c.details.sensitivity    && <div><span className="text-gray-400">감도: </span>
                            <span className={c.details.sensitivity==='상'?'text-emerald-600 font-bold':c.details.sensitivity==='중'?'text-amber-600 font-bold':'text-gray-500'}>
                              {c.details.sensitivity}
                            </span>
                          </div>}
                          {c.details.notes && (
                            <div className="col-span-full"><span className="text-gray-400">상담메모: </span><span className="whitespace-pre-wrap">{c.details.notes}</span></div>
                          )}
                        </div>
                      )}
                      {!c.details && c.notes && (
                        <p className="text-xs text-gray-600 whitespace-pre-wrap">{c.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 계약 현황 ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 mb-3">📑 계약 현황 ({contracts.length}건)</h2>
        {contracts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E2D4] p-8 text-center text-sm text-gray-400">
            등록된 계약이 없습니다.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E8E2D4] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E8E2D4] bg-[#FAF8F3]">
                    {['고객·회사', '담당', '계약금액', '상태', '계약일'].map(h => (
                      <th key={h} className="text-left py-2.5 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contracts.map(c => (
                    <tr key={c.id} className="border-b border-[#E8E2D4]/60 hover:bg-[#FAF8F3]">
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-[#1B2A45] text-sm">{c.customers?.company || c.customers?.name || '-'}</p>
                        <p className="text-[11px] text-gray-400">{c.customers?.name}</p>
                      </td>
                      <td className="py-2.5 px-3 text-sm text-gray-600">{c.sales_user_name || '-'}</td>
                      <td className="py-2.5 px-3 font-semibold text-[#1B2A45]">
                        {c.contract_amount ? `${c.contract_amount.toLocaleString()}만원` : '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          c.status === 'pending_assign' ? 'bg-amber-100 text-amber-700' :
                          c.status === 'assigned' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {c.status === 'pending_assign' ? '배정대기' : c.status === 'assigned' ? '배정완료' : c.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-gray-400">
                        {c.created_at?.slice(0, 10) || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
