'use client'

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import ReportTab from './ReportTab'
import {
  getBusinessDaysInMonth,
  getElapsedBusinessDays,
  getRemainingBusinessDays,
} from '@/lib/businessDays'

// ── 타입 ───────────────────────────────────────────────────
interface Customer {
  id: string
  name: string
  phone: string
  company: string
  loan_history: string
  notes: string
  status: 'lead' | 'consulting' | 'contracted' | 'emotional' | 'trash' | 'db010'
  sales_user_name: string
  updated_at: string
}
interface Contract {
  id: string
  customer_id: string
  contract_amount: number
  memo: string
  status: string
  created_at: string
  customers: { name: string; phone: string; company: string }
}
interface Notice {
  id: string
  title: string
  content: string
  notice_type: string
  target_team: string
  created_at: string
}
interface Props {
  userId: string
  userName: string
  username: string
}

// ── 상수 ───────────────────────────────────────────────────
const MONTHLY_GOALS: Record<string, number> = {
  'hd-sales1': 40,
  'hd-sales2': 20,
}

type SalesTab = 'board' | 'db010' | 'customers' | 'contracted' | 'emotional' | 'trash' | 'report'

// ── 공급기준표 (고정) ─────────────────────────────────────
const SUPPLY_RATE_TABLE = [
  { supply: 10, r10: 1, r20: 2, r30: 3 },
  { supply: 20, r10: 2, r20: 4, r30: 6 },
  { supply: 30, r10: 3, r20: 6, r30: 9 },
  { supply: 50, r10: 5, r20: 10, r30: 15 },
  { supply: 100, r10: 10, r20: 20, r30: 30 },
]

export default function SalesDashboard({ userId, userName, username }: Props) {
  const [activeTab, setActiveTab] = useState<SalesTab>('board')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saved' | 'saving' | 'unsaved'>>({})
  const [contractModal, setContractModal] = useState<Customer | null>(null)
  const [contractAmount, setContractAmount] = useState('')
  const [contractMemo, setContractMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [show010Form, setShow010Form] = useState(false)
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  async function loadAll() {
    setLoading(true)
    const [cRes, conRes, nRes] = await Promise.all([
      fetch('/api/customers'),
      fetch('/api/contracts'),
      fetch('/api/notices?team=sales'),
    ])
    const [cData, conData, nData] = await Promise.all([cRes.json(), conRes.json(), nRes.json()])
    setCustomers(cData.customers || [])
    setContracts(conData.contracts || [])
    setNotices(nData.notices || [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  // ── 고객 CRUD ──────────────────────────────────────────
  const autoSave = useCallback((id: string, patch: Partial<Customer>) => {
    setSaveStatus(p => ({ ...p, [id]: 'unsaved' }))
    if (autoSaveTimers.current[id]) clearTimeout(autoSaveTimers.current[id])
    autoSaveTimers.current[id] = setTimeout(async () => {
      setSaveStatus(p => ({ ...p, [id]: 'saving' }))
      await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      setSaveStatus(p => ({ ...p, [id]: 'saved' }))
    }, 1200)
  }, [])

  function updateField(id: string, field: keyof Customer, value: string) {
    setCustomers(p => p.map(c => c.id === id ? { ...c, [field]: value } : c))
    autoSave(id, { [field]: value })
  }

  async function moveCustomer(id: string, newStatus: Customer['status']) {
    setCustomers(p => p.map(c => c.id === id ? { ...c, status: newStatus } : c))
    await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  async function deleteCustomer(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    setCustomers(p => p.filter(c => c.id !== id))
  }

  // ── 신규 고객 등록 ──────────────────────────────────────
  const [newForm, setNewForm] = useState({ name: '', phone: '', company: '', loan_history: '', notes: '' })
  async function submitNew(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newForm, status: 'lead' }),
    })
    if (res.ok) { setNewForm({ name: '', phone: '', company: '', loan_history: '', notes: '' }); setShowNewForm(false); loadAll() }
    setSubmitting(false)
  }

  // ── 010DB 등록 ─────────────────────────────────────────
  const [form010, setForm010] = useState({ name: '', phone: '', company: '', loan_history: '', notes: '' })
  async function submit010(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form010, status: 'db010' }),
    })
    if (res.ok) { setForm010({ name: '', phone: '', company: '', loan_history: '', notes: '' }); setShow010Form(false); loadAll() }
    setSubmitting(false)
  }

  // ── 계약 처리 ──────────────────────────────────────────
  async function submitContract() {
    if (!contractModal) return
    setSubmitting(true)
    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: contractModal.id,
        contract_amount: Number(contractAmount.replace(/,/g, '')),
        memo: contractMemo,
      }),
    })
    if (res.ok) {
      await moveCustomer(contractModal.id, 'contracted')
      setContractModal(null); setContractAmount(''); setContractMemo('')
      loadAll()
    }
    setSubmitting(false)
  }

  // ── 파생값 ────────────────────────────────────────────
  const now = new Date()
  const thisMonth = now.toISOString().slice(0, 7)
  const totalRevenue = contracts.reduce((s, c) => s + (c.contract_amount || 0), 0)
  const monthContracts = contracts.filter(c => c.created_at?.slice(0, 7) === thisMonth)
  const monthRevenue = monthContracts.reduce((s, c) => s + (c.contract_amount || 0), 0)
  const monthContractCount = monthContracts.length

  const monthlyGoal = MONTHLY_GOALS[username] ?? 30
  const yr = now.getFullYear()
  const mo = now.getMonth()
  const dayOfMonth = now.getDate()
  const bizTotal    = getBusinessDaysInMonth(yr, mo)
  const bizElapsed  = getElapsedBusinessDays(yr, mo, dayOfMonth)
  const bizRemaining = getRemainingBusinessDays(yr, mo, dayOfMonth)
  const achievementRate = Math.min(100, Math.round(monthContractCount / monthlyGoal * 100))
  const remaining = Math.max(0, monthlyGoal - monthContractCount)
  const dailyPaceNeeded = bizRemaining > 0 ? (remaining / bizRemaining).toFixed(1) : '0'
  const onPaceCount = bizTotal > 0 ? Math.round((monthlyGoal / bizTotal) * bizElapsed) : 0
  const isAhead = monthContractCount >= onPaceCount

  // 공급 관련 notice
  const supplyNotice = notices.find(n => n.notice_type === 'supply_count')
  const todaySupply = supplyNotice ? parseInt(supplyNotice.content) || 0 : 0
  const contractRate = todaySupply > 0 ? Math.round(monthContractCount / todaySupply * 100) : 0
  const tomorrowSupplyNeeded = contractRate > 0 ? Math.ceil(3 / (contractRate / 100)) : 0

  // 고객 필터링
  const db010List = customers.filter(c => c.status === 'db010')
  const activeCustomers = customers.filter(c => ['lead', 'consulting'].includes(c.status))
  const contractedCustomers = customers.filter(c => c.status === 'contracted')
  const emotionalCustomers = customers.filter(c => c.status === 'emotional')
  const trashCustomers = customers.filter(c => c.status === 'trash')

  // 공지사항 (공급 제외)
  const generalNotices = notices.filter(n => n.notice_type !== 'supply_count')

  const tabs: { key: SalesTab; label: string; count?: number }[] = [
    { key: 'board',      label: '🏠 메인보드' },
    { key: 'db010',      label: `📞 010DB`, count: db010List.length },
    { key: 'customers',  label: `👤 신규 고객`, count: activeCustomers.length },
    { key: 'contracted', label: `✅ 계약 업체`, count: contractedCustomers.length },
    { key: 'emotional',  label: `💬 감성톡`, count: emotionalCustomers.length },
    { key: 'trash',      label: `🗑 자체거절`, count: trashCustomers.length },
    { key: 'report',     label: '📝 보고' },
  ]

  // ── 공통 고객 카드 ──────────────────────────────────────
  function CustomerCard({ c, actions }: { c: Customer; actions: React.ReactNode }) {
    const expanded = expandedId === c.id
    const ss = saveStatus[c.id]
    return (
      <div className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
        <button
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#FAF8F3] transition-colors"
          onClick={() => setExpandedId(expanded ? null : c.id)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-left min-w-0">
              <p className="font-semibold text-[#1B2A45] text-sm truncate">{c.name}</p>
              <p className="text-xs text-[#1B2A45]/40 mt-0.5 truncate">{c.company || c.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ss === 'saving' && <span className="text-[10px] text-amber-500">저장 중...</span>}
            {ss === 'saved' && <span className="text-[10px] text-emerald-500">✓ 저장됨</span>}
            <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
          </div>
        </button>
        {expanded && (
          <div className="px-5 pb-5 space-y-3 border-t border-[#E8E2D4]/50 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-0.5 block">업체명</label>
                <input value={c.company} onChange={e => updateField(c.id, 'company', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258]/50" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-0.5 block">대표자명</label>
                <input value={c.name} onChange={e => updateField(c.id, 'name', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258]/50" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-0.5 block">연락처</label>
                <input value={c.phone} onChange={e => updateField(c.id, 'phone', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258]/50" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-0.5 block">기대출 내역</label>
                <input value={c.loan_history} onChange={e => updateField(c.id, 'loan_history', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258]/50" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-0.5 block">
                {c.status === 'db010' ? '📋 인콜일지 (날짜별 통화 내용)' : '상담 메모'}
              </label>
              <textarea value={c.notes} onChange={e => updateField(c.id, 'notes', e.target.value)}
                rows={4}
                placeholder={c.status === 'db010'
                  ? '예)\n05-04 10:30 - 대표 통화, 관심 있음, 5월 중 미팅 요청\n05-05 09:00 - 부재중, 문자 발송'
                  : '상담 내용을 입력하세요...'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258]/50 resize-none" />
            </div>
            {/* 액션 버튼 */}
            <div className="flex items-center justify-between pt-1">
              <button onClick={() => deleteCustomer(c.id)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors">삭제</button>
              <div className="flex gap-2 flex-wrap justify-end">
                {actions}
              </div>
            </div>
            <p className="text-xs text-gray-300 text-right">수정: {new Date(c.updated_at).toLocaleString('ko-KR')}</p>
          </div>
        )}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      {/* 헤더 */}
      <header className="bg-[#1B2A45] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="relative h-8 w-24 shrink-0 block">
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain object-left brightness-0 invert" unoptimized />
        </Link>
        <span className="text-white/60 text-xs font-medium hidden md:block">
          {tabs.find(t => t.key === activeTab)?.label ?? '영업팀 대시보드'} · {userName}
        </span>
        <div className="flex items-center gap-3 relative">
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-white/40 hover:text-white/80 text-xs transition-colors">로그아웃</button>
          <button onClick={() => setMenuOpen(!menuOpen)} aria-label="메뉴"
            className={`flex flex-col gap-[5px] p-2 rounded-lg transition-colors ${menuOpen ? 'bg-white/20' : 'hover:bg-white/10'}`}>
            <span className={`block w-5 h-0.5 bg-white/80 transition-all origin-center ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white/80 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white/80 transition-all origin-center ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-full right-0 mt-2 bg-white border border-[#E8E2D4] rounded-2xl shadow-2xl z-50 py-2 min-w-[200px]">
                {tabs.map(tab => (
                  <button key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setMenuOpen(false) }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                      activeTab === tab.key ? 'text-[#C5A258] font-semibold bg-[#C5A258]/8' : 'text-[#1B2A45]/65 hover:bg-[#FAF8F3]'
                    }`}>
                    <span className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${activeTab === tab.key ? 'bg-[#C5A258]' : 'bg-transparent'}`} />
                      {tab.label}
                    </span>
                    {tab.count !== undefined && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="px-4 md:px-6 py-5 max-w-5xl mx-auto">

        {/* ══════════ 메인보드 ══════════ */}
        {activeTab === 'board' && (
          <div className="space-y-4">
            {/* 월 목표 달성 배너 */}
            <div className={`rounded-2xl p-5 border ${isAhead ? 'bg-emerald-50 border-emerald-200' : achievementRate >= 70 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-0.5">{thisMonth} 월간 목표</p>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-black ${isAhead ? 'text-emerald-600' : achievementRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{monthContractCount}</span>
                    <span className="text-lg text-gray-400 font-medium">/ {monthlyGoal}건</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${isAhead ? 'bg-emerald-100 text-emerald-700' : achievementRate >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{achievementRate}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">영업일 {bizElapsed}일째 / {bizTotal}일</p>
                  <p className={`text-sm font-bold mt-0.5 ${isAhead ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isAhead ? '🔥 목표 페이스 초과' : `⚡ 하루 ${dailyPaceNeeded}건 필요`}
                  </p>
                </div>
              </div>
              <div className="bg-white/60 rounded-full h-3 overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all duration-700 ${isAhead ? 'bg-emerald-500' : achievementRate >= 70 ? 'bg-amber-500' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(100, achievementRate)}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>남은 목표 <strong className="text-gray-800">{remaining}건</strong></span>
                <span>페이스 기준 <strong className={isAhead ? 'text-emerald-600' : 'text-red-500'}>{onPaceCount}건</strong> 위치</span>
                <span>남은 영업일 <strong className="text-gray-800">{bizRemaining}일</strong></span>
              </div>
              <p className={`text-xs font-semibold mt-2 text-center ${isAhead ? 'text-emerald-600' : achievementRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                {achievementRate >= 100 ? '🎉 목표 달성! 초과 달성 중입니다!'
                  : isAhead ? '💪 잘 하고 있습니다! 이 페이스 유지하면 목표 달성!'
                  : achievementRate >= 70 ? `👊 조금만 더! 하루 ${dailyPaceNeeded}건씩 하면 됩니다`
                  : achievementRate >= 40 ? `⚡ 분발이 필요합니다. 하루 ${dailyPaceNeeded}건 목표!`
                  : `🚨 목표 대비 부진 — 하루 ${dailyPaceNeeded}건 이상 필수!`}
              </p>
            </div>

            {/* 공급 현황 + 계약율 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '금일 공급 (대표 배정)', value: todaySupply > 0 ? todaySupply + '개' : '미배정', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
                { label: '이번달 계약', value: monthContractCount + '건', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                { label: '공급 대비 계약율', value: todaySupply > 0 ? contractRate + '%' : '—', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
                { label: '내일 필요 공급(3계약 기준)', value: tomorrowSupplyNeeded > 0 ? tomorrowSupplyNeeded + '개' : '—', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-3.5`}>
                  <p className="text-[10px] text-gray-400 mb-1">{s.label}</p>
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* 공급기준표 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-700">📊 공급기준표</h3>
                <span className="text-[10px] text-gray-400">공급 건수 대비 예상 계약 수</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">공급 수</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-blue-500 text-center">계약율 10%</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-amber-500 text-center">계약율 20%</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-green-500 text-center">계약율 30%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {SUPPLY_RATE_TABLE.map(row => (
                      <tr key={row.supply} className={todaySupply === row.supply ? 'bg-amber-50' : ''}>
                        <td className="px-4 py-2.5 font-semibold text-gray-800">{row.supply}개</td>
                        <td className="px-4 py-2.5 text-center text-blue-600 font-medium">{row.r10}건</td>
                        <td className="px-4 py-2.5 text-center text-amber-600 font-medium">{row.r20}건</td>
                        <td className="px-4 py-2.5 text-center text-green-600 font-medium">{row.r30}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 공지사항 */}
            {generalNotices.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-gray-700">📢 공지사항</h3>
                {generalNotices.map(n => (
                  <div key={n.id} className="bg-white border border-[#E8E2D4] rounded-xl px-5 py-4">
                    <p className="font-semibold text-[#1B2A45] text-sm">{n.title}</p>
                    {n.content && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{n.content}</p>}
                    <p className="text-xs text-gray-300 mt-2">{new Date(n.created_at).toLocaleDateString('ko-KR')}</p>
                  </div>
                ))}
              </div>
            )}
            {generalNotices.length === 0 && (
              <div className="bg-white border border-[#E8E2D4] rounded-xl p-6 text-center text-gray-400 text-sm">
                공지사항 없음
              </div>
            )}
          </div>
        )}

        {/* ══════════ 010 DB ══════════ */}
        {activeTab === 'db010' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700">010 DB <span className="text-gray-400 font-normal">({db010List.length}건)</span></h2>
              <button onClick={() => setShow010Form(!show010Form)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {show010Form ? '✕ 취소' : '+ DB 추가'}
              </button>
            </div>
            {show010Form && (
              <form onSubmit={submit010} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm mb-1">신규 DB 등록</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'company', label: '업체명', placeholder: 'ABC주식회사' },
                    { key: 'name', label: '대표자명', placeholder: '홍길동' },
                    { key: 'phone', label: '연락처', placeholder: '010-0000-0000' },
                    { key: 'loan_history', label: '기대출 내역', placeholder: '예) 국민은행 1억' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-gray-400 mb-0.5 block">{f.label}</label>
                      <input value={form010[f.key as keyof typeof form010]}
                        onChange={e => setForm010(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-0.5 block">인콜일지 초기 메모</label>
                  <textarea value={form010.notes} onChange={e => setForm010(p => ({ ...p, notes: e.target.value }))} rows={2}
                    placeholder="첫 통화 메모..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                  {submitting ? '등록 중...' : '+ DB 등록'}
                </button>
              </form>
            )}
            {loading ? <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
              : db010List.length === 0 ? <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">010 DB가 없습니다.</div>
              : db010List.map(c => (
                <CustomerCard key={c.id} c={c} actions={<>
                  <button onClick={() => moveCustomer(c.id, 'lead')}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    신규 고객으로 이동
                  </button>
                  <button onClick={() => moveCustomer(c.id, 'trash')}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    자체거절
                  </button>
                </>} />
              ))
            }
          </div>
        )}

        {/* ══════════ 신규 고객 ══════════ */}
        {activeTab === 'customers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700">신규 고객 <span className="text-gray-400 font-normal">({activeCustomers.length}건)</span></h2>
              <button onClick={() => setShowNewForm(!showNewForm)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {showNewForm ? '✕ 취소' : '+ 신규 고객 등록'}
              </button>
            </div>
            {showNewForm && (
              <form onSubmit={submitNew} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 text-sm mb-1">신규 고객 등록</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'name', label: '대표자명', placeholder: '홍길동', req: true },
                    { key: 'phone', label: '연락처', placeholder: '010-0000-0000', req: true },
                    { key: 'company', label: '업체명', placeholder: 'ABC주식회사', req: false },
                    { key: 'loan_history', label: '기대출 내역', placeholder: '예) 국민은행 1억', req: false },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-gray-400 mb-0.5 block">{f.label}{f.req && ' *'}</label>
                      <input value={newForm[f.key as keyof typeof newForm]} required={f.req}
                        onChange={e => setNewForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-0.5 block">상담 메모</label>
                  <textarea value={newForm.notes} onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                    placeholder="초기 상담 내용..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                  {submitting ? '등록 중...' : '+ 고객 등록'}
                </button>
              </form>
            )}
            {loading ? <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
              : activeCustomers.length === 0 ? <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">신규 고객이 없습니다.</div>
              : activeCustomers.map(c => (
                <CustomerCard key={c.id} c={c} actions={<>
                  <button onClick={() => moveCustomer(c.id, 'emotional')}
                    className="bg-violet-100 hover:bg-violet-200 text-violet-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    💬 감성톡
                  </button>
                  <button onClick={() => moveCustomer(c.id, 'trash')}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    🗑 자체거절
                  </button>
                  <button onClick={() => { setContractModal(c); setContractAmount(''); setContractMemo('') }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    🤝 계약
                  </button>
                </>} />
              ))
            }
          </div>
        )}

        {/* ══════════ 계약 업체 ══════════ */}
        {activeTab === 'contracted' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">계약 업체 <span className="text-gray-400 font-normal">({contractedCustomers.length}건)</span></h2>
            {loading ? <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
              : contractedCustomers.length === 0 ? <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">계약 업체가 없습니다.</div>
              : <>
                {/* 계약 금액 요약 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-400 mb-0.5">이번달 계약</p>
                    <p className="text-2xl font-black text-emerald-700">{monthContractCount}건</p>
                    <p className="text-xs text-gray-400">{monthRevenue > 0 ? (monthRevenue / 10000).toFixed(0) + '만원' : '-'}</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-400 mb-0.5">전체 계약</p>
                    <p className="text-2xl font-black text-gray-700">{contractedCustomers.length}건</p>
                    <p className="text-xs text-gray-400">{totalRevenue > 0 ? (totalRevenue / 10000).toFixed(0) + '만원' : '-'}</p>
                  </div>
                </div>
                {contractedCustomers.map(c => (
                  <CustomerCard key={c.id} c={c} actions={<>
                    <button onClick={() => moveCustomer(c.id, 'lead')}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                      신규 고객으로 복귀
                    </button>
                  </>} />
                ))}
              </>
            }
          </div>
        )}

        {/* ══════════ 감성톡 관리 업체 ══════════ */}
        {activeTab === 'emotional' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">💬 감성톡 관리 업체 <span className="text-gray-400 font-normal">({emotionalCustomers.length}건)</span></h2>
            <p className="text-xs text-gray-400 bg-violet-50 border border-violet-100 rounded-lg px-4 py-2">
              일단 거절했지만 감성적 접근이 가능한 업체 관리 · 장기 육성 대상
            </p>
            {loading ? <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
              : emotionalCustomers.length === 0 ? <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">감성톡 관리 업체가 없습니다.</div>
              : emotionalCustomers.map(c => (
                <CustomerCard key={c.id} c={c} actions={<>
                  <button onClick={() => moveCustomer(c.id, 'lead')}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    신규 고객 복귀
                  </button>
                  <button onClick={() => moveCustomer(c.id, 'trash')}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    🗑 자체거절
                  </button>
                  <button onClick={() => { setContractModal(c); setContractAmount(''); setContractMemo('') }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    🤝 계약
                  </button>
                </>} />
              ))
            }
          </div>
        )}

        {/* ══════════ 자체거절 업체 ══════════ */}
        {activeTab === 'trash' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">🗑 자체거절 업체 <span className="text-gray-400 font-normal">({trashCustomers.length}건)</span></h2>
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-4 py-2">
              스스로 판단하여 진행 불가로 분류한 업체 · 복구 가능
            </p>
            {loading ? <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
              : trashCustomers.length === 0 ? <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">자체거절 업체가 없습니다.</div>
              : trashCustomers.map(c => (
                <CustomerCard key={c.id} c={c} actions={<>
                  <button onClick={() => moveCustomer(c.id, 'lead')}
                    className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    신규 고객 복귀
                  </button>
                  <button onClick={() => moveCustomer(c.id, 'emotional')}
                    className="bg-violet-100 hover:bg-violet-200 text-violet-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                    💬 감성톡으로 이동
                  </button>
                </>} />
              ))
            }
          </div>
        )}

        {/* ══════════ 보고 ══════════ */}
        {activeTab === 'report' && (
          <ReportTab userId={userId} userName={userName} />
        )}
      </div>

      {/* 계약 처리 모달 */}
      {contractModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-1">계약 처리</h3>
            <p className="text-sm text-gray-400 mb-5">
              <strong className="text-gray-700">{contractModal.name}</strong> ({contractModal.company})을 계약 완료로 전환합니다.
            </p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">계약 금액 (원)</label>
                <input type="text" value={contractAmount}
                  onChange={e => setContractAmount(e.target.value.replace(/[^0-9,]/g, ''))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">메모</label>
                <textarea value={contractMemo} onChange={e => setContractMemo(e.target.value)} rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setContractModal(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium">취소</button>
              <button onClick={submitContract} disabled={submitting}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-bold transition-colors">
                {submitting ? '처리 중...' : '🤝 계약 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
