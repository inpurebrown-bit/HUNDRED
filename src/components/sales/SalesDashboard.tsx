'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import ReportTab from './ReportTab'
import MyProfileTab from '@/components/MyProfileTab'
import CustomerCard, { Customer, CustomerDetails, CardTabType } from './CustomerCard'
import InCallForm, { InCallData } from './InCallForm'
import InCallTableView from './InCallTableView'
import {
  getBusinessDaysInMonth,
  getElapsedBusinessDays,
  getRemainingBusinessDays,
} from '@/lib/businessDays'
import { SUPPLY_RATE_TABLE, calcRecommendedSupply, isActiveRow } from '@/lib/supplyRules'

// ── Types ──────────────────────────────────────────────────────────────
interface Contract {
  id: string
  customer_id: string
  contract_amount: number
  memo: string
  status: string
  ops_user_name?: string
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

// ── Constants ──────────────────────────────────────────────────────────
const MONTHLY_GOALS: Record<string, number> = {
  'hd-sales1': 40,
  'hd-sales2': 20,
}

// All sales users for assignee dropdown
const SALES_USERS = ['hd-sales1', 'hd-sales2', 'hd-sales3']

type SalesTab = 'board' | 'db010' | 'customers' | 'contracted' | 'emotional' | 'trash' | 'revenue' | 'report' | 'profile'

// ── Component ──────────────────────────────────────────────────────────
export default function SalesDashboard({ userId, userName, username }: Props) {
  const [activeTab, setActiveTab] = useState<SalesTab>('board')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installable, setInstallable] = useState(false)

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); setInstallable(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') { setInstallable(false); setInstallPrompt(null) }
  }

  // 토스트 알림
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  // 검색
  const [searchQuery, setSearchQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // New customer form state
  const [showNewForm, setShowNewForm] = useState(false)

  // 010DB form state
  const [show010Form, setShow010Form] = useState(false)

  // ── Data loading ──────────────────────────────────────────────────
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

  // ── Customer CRUD ─────────────────────────────────────────────────
  const patchCustomer = useCallback(async (id: string, patch: Record<string, any>) => {
    setCustomers(prev => prev.map(c => {
      if (c.id !== id) return c
      const mergedDetails = patch.details
        ? { ...(c.details || {}), ...patch.details }
        : c.details
      return { ...c, ...patch, details: mergedDetails }
    }))
    await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
  }, [])

  const moveCustomer = useCallback(async (id: string, newStatus: Customer['status']) => {
    // 계약업체로 이동 시 로컬 state에서도 sub_status 제거 (미제거 시 stale sub_status 재기입 버그)
    setCustomers(prev => prev.map(c => {
      if (c.id !== id) return c
      const updatedDetails: any = { ...(c.details || {}) }
      if (newStatus === 'contracted') {
        delete updatedDetails.sub_status
      } else {
        updatedDetails.sub_status = newStatus
      }
      return { ...c, status: newStatus, details: updatedDetails }
    }))
    await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }, [])

  const deleteCustomer = useCallback(async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    setCustomers(prev => prev.filter(c => c.id !== id))
  }, [])

  const updateCustomer = useCallback(async (id: string, patch: Record<string, any>) => {
    await patchCustomer(id, patch)
  }, [patchCustomer])

  const transferToOps = useCallback(async (customer: Customer) => {
    const details: any = customer.details || {}
    const memo = [
      details.company && `업체: ${details.company}`,
      details.contract_fee && `계약금: ${details.contract_fee}`,
      details.payment_amount && `입금액: ${details.payment_amount}`,
      details.unpaid_amount && `미입금: ${details.unpaid_amount}`,
      details.commission_rate && `수수료율: ${details.commission_rate}`,
      details.tax_invoice && `세금계산서: ${details.tax_invoice}`,
    ].filter(Boolean).join(' / ')

    // ⚡ 핵심 수정: full details 스프레드 금지 → ops_transferred 플래그만 전송
    // (details 스프레드 시 stale sub_status가 DB에 재기입되어 계약업체가 고객DB로 역행하는 버그 발생)
    await patchCustomer(customer.id, { details: { ops_transferred: true } })

    const anyDetails = details as any
    const revenue = parseInt(String(anyDetails.my_revenue || '0').replace(/[^0-9]/g, ''), 10) || 0

    await fetch('/api/ops-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // API가 기대하는 필드명으로 전송 (progress_stage → stage, progress_memo → memo)
        customer_name: (anyDetails.company as string) || customer.company || customer.name || '',
        phone: customer.phone || '',
        stage: '서류받는중',
        memo,
        revenue,
      }),
    })
    await loadAll()
  }, [patchCustomer])

  // ── 인콜 데이터 → API 페이로드 변환 ────────────────────────────────
  function buildPayload(data: InCallData, status: string) {
    const { name, phone, company, notes, ...rest } = data
    return {
      name, phone, company, notes, status,
      details: {
        corp_type: rest.corp_type,
        region: rest.region,
        business_reg_no: rest.business_reg_no,
        assignee: rest.assignee,
        reception_date: rest.reception_date,
        business_type: rest.business_type,
        years_in_business: rest.years_in_business,
        employee_count: rest.employee_count,
        loan_policy: rest.loan_policy,
        loan_credit: rest.loan_credit,
        revenue_2026: rest.revenue_2026,
        revenue_2025: rest.revenue_2025,
        revenue_2024: rest.revenue_2024,
        revenue_2023: rest.revenue_2023,
        credit_score: rest.credit_score,
        tax_delinquency: rest.tax_delinquency,
        assets: rest.assets,
        required_funds: rest.required_funds,
        sensitivity: rest.sensitivity,
      },
    }
  }

  // ── New customer form ─────────────────────────────────────────────
  async function submitNew(data: InCallData) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(data, 'lead')),
      })
      const json = await res.json()
      if (res.ok) {
        setShowNewForm(false)
        showToast(`✅ "${data.company || data.name}" 고객 DB 등록 완료!`)
        loadAll()
      } else {
        showToast(`❌ 등록 실패: ${json.error || '알 수 없는 오류'}`, 'error')
      }
    } catch (e: any) {
      showToast(`❌ 네트워크 오류: ${e.message}`, 'error')
    }
    setSubmitting(false)
  }

  // ── 010DB form ────────────────────────────────────────────────────
  async function submit010(data: InCallData) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(data, 'db010')),
      })
      const json = await res.json()
      if (res.ok) {
        setShow010Form(false)
        showToast(`✅ "${data.company || data.name}" 010DB 등록 완료!`)
        loadAll()
      } else {
        showToast(`❌ 등록 실패: ${json.error || '알 수 없는 오류'}`, 'error')
      }
    } catch (e: any) {
      showToast(`❌ 네트워크 오류: ${e.message}`, 'error')
    }
    setSubmitting(false)
  }

  // ── Derived values ────────────────────────────────────────────────
  const now = new Date()
  const thisMonth = now.toISOString().slice(0, 7)
  const monthContracts = contracts.filter(c => c.created_at?.slice(0, 7) === thisMonth)
  const monthContractCount = monthContracts.length

  const monthlyGoal = MONTHLY_GOALS[username] ?? 30
  const yr = now.getFullYear()
  const mo = now.getMonth()
  const dayOfMonth = now.getDate()
  const bizTotal = getBusinessDaysInMonth(yr, mo)
  const bizElapsed = getElapsedBusinessDays(yr, mo, dayOfMonth)
  const bizRemaining = getRemainingBusinessDays(yr, mo, dayOfMonth)
  const achievementRate = Math.min(100, Math.round(monthContractCount / monthlyGoal * 100))
  const remaining = Math.max(0, monthlyGoal - monthContractCount)
  const dailyPaceNeeded = bizRemaining > 0 ? (remaining / bizRemaining).toFixed(1) : '0'
  const onPaceCount = bizTotal > 0 ? Math.round((monthlyGoal / bizTotal) * bizElapsed) : 0
  const isAhead = monthContractCount >= onPaceCount

  const supplyNotice = notices.find(n => n.notice_type === 'supply_count')
  const todaySupply = supplyNotice ? parseInt(supplyNotice.content) || 0 : 0
  const contractRate = todaySupply > 0 ? Math.round(monthContractCount / todaySupply * 100) : 0
  const tomorrowSupplyNeeded = calcRecommendedSupply(contractRate, bizElapsed)

  // ── Filtered lists ────────────────────────────────────────────────
  const db010List = customers.filter(c => c.status === 'db010')
  const activeCustomers = customers.filter(c => ['lead', 'consulting'].includes(c.status))
  const contractedCustomers = customers.filter(c => c.status === 'contracted')
  const emotionalCustomers = customers.filter(c => c.status === 'emotional')
  const trashCustomers = customers.filter(c => c.status === 'trash')
  const revenueCustomers = customers.filter(c => c.status === 'contracted' && c.details?.ops_transferred === true)

  const generalNotices = notices.filter(n => n.notice_type !== 'supply_count')

  // ── 검색 ────────────────────────────────────────────────────────────
  const STATUS_TAB: Record<string, SalesTab> = {
    db010: 'db010', lead: 'customers', consulting: 'customers',
    contracted: 'contracted', emotional: 'emotional', trash: 'trash',
  }
  const STATUS_LABEL: Record<string, string> = {
    db010: '010DB', lead: '신규고객', consulting: '신규고객',
    contracted: '계약업체', emotional: '감성톡', trash: '자체거절',
  }
  const q = searchQuery.trim().toLowerCase()
  const searchResults = q.length >= 1
    ? customers.filter(c =>
        c.company?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.phone?.replace(/-/g, '').includes(q.replace(/-/g, '')) ||
        c.details?.business_type?.toLowerCase().includes(q) ||
        c.details?.region?.toLowerCase().includes(q)
      )
    : []

  // Revenue tab totals
  const totalRevenue = revenueCustomers
    .filter(c => !c.details?.is_cancelled)
    .reduce((sum, c) => sum + parseFloat(c.details?.contract_fee?.replace(/[^0-9.]/g, '') || '0'), 0)
  const cancelledCount = revenueCustomers.filter(c => c.details?.is_cancelled).length

  // ── Tabs ──────────────────────────────────────────────────────────
  const tabs: { key: SalesTab; label: string; count?: number }[] = [
    { key: 'board',      label: '🏠 메인보드' },
    { key: 'db010',      label: '📞 010DB',      count: db010List.length },
    { key: 'customers',  label: '👤 신규 고객',   count: activeCustomers.length },
    { key: 'contracted', label: '✅ 계약 업체',   count: contractedCustomers.length },
    { key: 'emotional',  label: '💬 감성톡(거절업체)',      count: emotionalCustomers.length },
    { key: 'trash',      label: '🗑 자체거절',    count: trashCustomers.length },
    { key: 'revenue',    label: '💰 매출',        count: revenueCustomers.length },
    { key: 'report',     label: '📝 보고' },
    { key: 'profile',    label: '👤 사원정보' },
  ]

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      {/* ── 토스트 알림 ── */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white transition-all animate-bounce-once max-w-sm text-center ${
          toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-[#1B2A45] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="relative h-8 w-24 shrink-0 block">
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain object-left brightness-0 invert" unoptimized />
        </Link>
        <span className="text-white/60 text-xs font-medium hidden md:block">
          {tabs.find(t => t.key === activeTab)?.label ?? '영업팀 대시보드'} · {userName}
        </span>
        <div className="flex items-center gap-2 relative">
          {/* 항상 표시되는 검색창 */}
          <div className="relative">
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="업체명·이름·연락처..."
              className="bg-white/10 text-white placeholder-white/40 text-xs px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:bg-white/20 w-36 md:w-52"
            />
            <button
              onClick={() => setSearchQuery(searchQuery)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-[10px]"
              title="검색하기">
              검색
            </button>
            {/* 검색 결과 드롭다운 */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 w-80 max-h-80 overflow-y-auto">
                <p className="text-[10px] text-gray-400 px-3 pt-2.5 pb-1 font-semibold">{searchResults.length}건 검색됨</p>
                {searchResults.map(c => (
                  <button key={c.id}
                    onClick={() => {
                      const tab = STATUS_TAB[c.status] ?? 'customers'
                      setActiveTab(tab)
                      setSearchQuery('')
                    }}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2 border-t border-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{c.company || '(업체명 없음)'}</p>
                      <p className="text-[11px] text-gray-400 truncate">{c.name} · {c.phone}</p>
                    </div>
                    <span className="shrink-0 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {q.length >= 1 && searchResults.length === 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 w-72 px-4 py-3 text-xs text-gray-400">
                검색 결과 없음
              </div>
            )}
          </div>
          {/* 대시보드로 돌아가기 */}
          <button
            onClick={() => setActiveTab('board')}
            className="text-white/50 hover:text-white text-[10px] px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap hidden md:block">
            🏠 홈
          </button>
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
                {/* 사용자 카드 */}
                <div className="px-4 py-3 border-b border-[#E8E2D4] mb-1">
                  <p className="text-[10px] text-[#C5A258] font-bold tracking-wide uppercase mb-0.5">영업팀</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#1B2A45]">{userName}</p>
                    <button
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition-colors font-medium"
                    >로그아웃</button>
                  </div>
                  {installable && (
                    <button
                      onClick={() => { handleInstall(); setMenuOpen(false) }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs border border-[#1B2A45]/20 hover:border-[#C5A258]/60 text-[#1B2A45]/60 hover:text-[#C5A258] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      📲 앱 설치
                    </button>
                  )}
                </div>
                {tabs.map(tab => (
                  <button key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setMenuOpen(false) }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                      activeTab === tab.key
                        ? 'text-[#C5A258] font-semibold bg-[#C5A258]/8'
                        : 'text-[#1B2A45]/65 hover:bg-[#FAF8F3]'
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
                    <span className={`text-4xl font-black ${isAhead ? 'text-emerald-600' : achievementRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                      {monthContractCount}
                    </span>
                    <span className="text-lg text-gray-400 font-medium">/ {monthlyGoal}건</span>
                    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${isAhead ? 'bg-emerald-100 text-emerald-700' : achievementRate >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                      {achievementRate}%
                    </span>
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
                <div
                  className={`h-full rounded-full transition-all duration-700 ${isAhead ? 'bg-emerald-500' : achievementRate >= 70 ? 'bg-amber-500' : 'bg-red-400'}`}
                  style={{ width: `${Math.min(100, achievementRate)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>남은 목표 <strong className="text-gray-800">{remaining}건</strong></span>
                <span>페이스 기준 <strong className={isAhead ? 'text-emerald-600' : 'text-red-500'}>{onPaceCount}건</strong> 위치</span>
                <span>남은 영업일 <strong className="text-gray-800">{bizRemaining}일</strong></span>
              </div>
              <p className={`text-xs font-semibold mt-2 text-center ${isAhead ? 'text-emerald-600' : achievementRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                {achievementRate >= 100
                  ? '🎉 목표 달성! 초과 달성 중입니다!'
                  : isAhead
                  ? '💪 잘 하고 있습니다! 이 페이스 유지하면 목표 달성!'
                  : achievementRate >= 70
                  ? `👊 조금만 더! 하루 ${dailyPaceNeeded}건씩 하면 됩니다`
                  : achievementRate >= 40
                  ? `⚡ 분발이 필요합니다. 하루 ${dailyPaceNeeded}건 목표!`
                  : `🚨 목표 대비 부진 — 하루 ${dailyPaceNeeded}건 이상 필수!`}
              </p>
            </div>

            {/* 공급 현황 + 계약율 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '금일 공급 (대표 배정)', value: todaySupply > 0 ? `${todaySupply}개` : '미배정', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
                { label: '이번달 계약', value: `${monthContractCount}건`, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                { label: '공급 대비 계약율', value: todaySupply > 0 ? `${contractRate}%` : '—', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
                { label: '내일 필요 공급(3계약 기준)', value: tomorrowSupplyNeeded > 0 ? `${tomorrowSupplyNeeded}개` : '—', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-100' },
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
                <span className="text-[10px] text-gray-400">결제율 기준 내일 공급 권장</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">기준</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-[#C5A258] text-center">권장 공급</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {SUPPLY_RATE_TABLE.map(row => {
                    const isActive = isActiveRow(row, contractRate, bizElapsed)
                    return (
                      <tr key={row.condition} className={isActive ? 'bg-amber-50' : ''}>
                        <td className={`px-4 py-2.5 text-xs ${isActive ? 'font-bold text-amber-700' : 'text-gray-600'}`}>
                          {isActive && <span className="mr-1">▶</span>}{row.condition}
                        </td>
                        <td className={`px-4 py-2.5 text-center font-bold ${row.supply === 0 ? 'text-red-500' : isActive ? 'text-amber-600 text-base' : 'text-gray-700'}`}>
                          {row.supply}개
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 공지사항 */}
            {generalNotices.length > 0 ? (
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
            ) : (
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
              <h2 className="text-sm font-bold text-gray-700">
                010 DB <span className="text-gray-400 font-normal">({db010List.length}건)</span>
              </h2>
              <button onClick={() => setShow010Form(v => !v)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {show010Form ? '✕ 취소' : '+ 010DB 등록'}
              </button>
            </div>

            {show010Form && (
              <InCallForm
                title="010DB 인콜일지 등록"
                salesUsers={SALES_USERS}
                submitting={submitting}
                onSubmit={submit010}
                onCancel={() => setShow010Form(false)}
              />
            )}

            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : db010List.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                010 DB가 없습니다.
              </div>
            ) : (
              <InCallTableView
                customers={db010List}
                allCustomers={customers}
                tabType="db010"
                salesUsers={SALES_USERS}
                userName={userName}
                onUpdate={updateCustomer}
                onStatusChange={async (id, status) => moveCustomer(id, status as any)}
                onDelete={async (id) => deleteCustomer(id)}
              />
            )}
          </div>
        )}

        {/* ══════════ 신규 고객 ══════════ */}
        {activeTab === 'customers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700">
                고객 DB <span className="text-gray-400 font-normal">({activeCustomers.length}건)</span>
              </h2>
              <button onClick={() => setShowNewForm(v => !v)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {showNewForm ? '✕ 취소' : '+ 고객 등록'}
              </button>
            </div>

            {showNewForm && (
              <InCallForm
                title="고객 DB 인콜일지 등록"
                salesUsers={SALES_USERS}
                submitting={submitting}
                onSubmit={submitNew}
                onCancel={() => setShowNewForm(false)}
              />
            )}

            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : activeCustomers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                고객 DB가 없습니다.
              </div>
            ) : (
              <InCallTableView
                customers={activeCustomers}
                allCustomers={customers}
                opsContracts={contracts}
                tabType="lead"
                salesUsers={SALES_USERS}
                userName={userName}
                onUpdate={updateCustomer}
                onStatusChange={async (id, status) => moveCustomer(id, status as any)}
                onDelete={async (id) => deleteCustomer(id)}
              />
            )}
          </div>
        )}

        {/* ══════════ 계약 업체 ══════════ */}
        {activeTab === 'contracted' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">
              계약 업체 <span className="text-gray-400 font-normal">({contractedCustomers.length}건)</span>
            </h2>

            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : contractedCustomers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                계약 업체가 없습니다.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-400 mb-0.5">이번달 계약</p>
                    <p className="text-2xl font-black text-emerald-700">{monthContractCount}건</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-gray-400 mb-0.5">전체 계약</p>
                    <p className="text-2xl font-black text-gray-700">{contractedCustomers.length}건</p>
                  </div>
                </div>
                <InCallTableView
                  customers={contractedCustomers}
                  allCustomers={customers}
                  tabType="contracted"
                  salesUsers={SALES_USERS}
                  userName={userName}
                  onUpdate={updateCustomer}
                  onStatusChange={async (id, status) => moveCustomer(id, status as any)}
                  onDelete={async (id) => deleteCustomer(id)}
                  onTransferToOps={transferToOps as any}
                />
              </>
            )}
          </div>
        )}

        {/* ══════════ 감성톡 관리 ══════════ */}
        {activeTab === 'emotional' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">
              💬 감성톡 관리 업체 <span className="text-gray-400 font-normal">({emotionalCustomers.length}건)</span>
            </h2>
            <p className="text-xs text-gray-400 bg-violet-50 border border-violet-100 rounded-lg px-4 py-2">
              일단 거절했지만 감성적 접근이 가능한 업체 관리 · 장기 육성 대상
            </p>

            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : emotionalCustomers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                감성톡 관리 업체가 없습니다.
              </div>
            ) : (
              <InCallTableView
                customers={emotionalCustomers}
                allCustomers={customers}
                tabType="emotional"
                salesUsers={SALES_USERS}
                userName={userName}
                onUpdate={updateCustomer}
                onStatusChange={async (id, status) => moveCustomer(id, status as any)}
                onDelete={async (id) => deleteCustomer(id)}
              />
            )}
          </div>
        )}

        {/* ══════════ 자체거절 ══════════ */}
        {activeTab === 'trash' && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700">
              🗑 자체거절 업체 <span className="text-gray-400 font-normal">({trashCustomers.length}건)</span>
            </h2>
            <p className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-4 py-2">
              스스로 판단하여 진행 불가로 분류한 업체 · 복구 가능
            </p>

            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : trashCustomers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                자체거절 업체가 없습니다.
              </div>
            ) : (
              <InCallTableView
                customers={trashCustomers}
                allCustomers={customers}
                tabType="trash"
                salesUsers={SALES_USERS}
                userName={userName}
                onUpdate={updateCustomer}
                onStatusChange={async (id, status) => moveCustomer(id, status as any)}
                onDelete={async (id) => deleteCustomer(id)}
              />
            )}
          </div>
        )}

        {/* ══════════ 매출 ══════════ */}
        {activeTab === 'revenue' && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-700">
              💰 매출 현황 <span className="text-gray-400 font-normal">({revenueCustomers.length}건 전송)</span>
            </h2>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">전송건수</p>
                <p className="text-2xl font-black text-emerald-700">{revenueCustomers.length}건</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">총 계약금</p>
                <p className="text-xl font-black text-blue-700">
                  {totalRevenue > 0 ? `${(totalRevenue / 10000).toFixed(0)}만원` : '—'}
                </p>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                <p className="text-[10px] text-gray-400 mb-0.5">취소건수</p>
                <p className="text-2xl font-black text-red-600">{cancelledCount}건</p>
              </div>
            </div>

            {/* Revenue list */}
            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : revenueCustomers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                관리팀으로 전송된 계약 업체가 없습니다.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="grid grid-cols-6 gap-2 text-[10px] font-semibold text-gray-500">
                    <span className="col-span-2">업체명</span>
                    <span>계약금</span>
                    <span>수수료율</span>
                    <span>세금계산서</span>
                    <span>상태</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {revenueCustomers.map(c => {
                    const cancelled = c.details?.is_cancelled
                    return (
                      <div key={c.id} className={`px-5 py-3 grid grid-cols-6 gap-2 items-center ${cancelled ? 'bg-gray-50' : ''}`}>
                        <div className="col-span-2 min-w-0">
                          <p className={`text-sm font-semibold truncate ${cancelled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {c.company || '(업체명 없음)'}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{c.name}</p>
                        </div>
                        <p className={`text-xs ${cancelled ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {c.details?.contract_fee || '—'}
                        </p>
                        <p className={`text-xs ${cancelled ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {c.details?.commission_rate || '—'}
                        </p>
                        <p className={`text-xs ${cancelled ? 'text-gray-400' : c.details?.tax_invoice === '발급' ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>
                          {c.details?.tax_invoice || '—'}
                        </p>
                        <div>
                          {cancelled ? (
                            <span className="inline-block bg-red-100 text-red-600 text-[10px] font-semibold px-2 py-0.5 rounded-full">취소</span>
                          ) : (
                            <span className="inline-block bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">정상</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ 보고 ══════════ */}
        {activeTab === 'report' && (
          <ReportTab userId={userId} userName={userName} />
        )}

        {/* ══════════ 사원정보 ══════════ */}
        {activeTab === 'profile' && (
          <MyProfileTab />
        )}

      </div>
    </div>
  )
}
