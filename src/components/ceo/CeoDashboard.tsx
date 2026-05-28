'use client'

import { useState, useRef, useEffect, FormEvent, ReactNode } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Image from 'next/image'
import Link from 'next/link'
import MinutesTab from './MinutesTab'
import CalendarTab from './CalendarTab'
import { PnlSubView } from './PayRateTab'
import PayrollTab from './PayrollTab'
import PayslipTab from './PayslipTab'
import FreelancerTab from './FreelancerTab'
import AssignBoard from './AssignBoard'
import OverviewTabNew from './OverviewTabNew'
import SalesCeoTab from './SalesCeoTab'
import OpsCeoTab from './OpsCeoTab'
import PinManageTab from './PinManageTab'
import MyProfileTab from '@/components/MyProfileTab'
import DbManageTab from './DbManageTab'
import PersonalFinanceTab from './PersonalFinanceTab'
import PullToRefresh from '@/components/ui/PullToRefresh'

// ── 공통 서브탭 바 컴포넌트 ────────────────────────────────────
function SubTabBar<T extends string>({ tabs, active, onChange }: {
  tabs: { key: T; label: string }[]
  active: T
  onChange: (key: T) => void
}) {
  return (
    <div className="flex border-b border-gray-200 mb-6 overflow-x-auto print-hide">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${
            active === t.key
              ? 'text-[#1B2A45] font-semibold'
              : 'text-[#1B2A45]/45 hover:text-[#1B2A45]/75'
          }`}>
          {t.label}
          {active === t.key && (
            <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#C5A258] rounded-full" />
          )}
        </button>
      ))}
    </div>
  )
}

// 손익·급여 통합 탭
function AnalyticsTab() {
  const [sub, setSub] = useState<'revenue' | 'payroll' | 'payslip' | 'personal'>('revenue')
  return (
    <div>
      <SubTabBar
        tabs={[
          { key: 'revenue'  as const, label: '매출 관리' },
          { key: 'payroll'  as const, label: '급여·손익' },
          { key: 'payslip'  as const, label: '급여명세서' },
          { key: 'personal' as const, label: '개인재무' },
        ]}
        active={sub} onChange={setSub}
      />
      {sub === 'revenue'  && <RevenueTab />}
      {sub === 'payroll'  && <PayrollTab />}
      {sub === 'payslip'  && <PayslipTab />}
      {sub === 'personal' && <PersonalFinanceTab />}
    </div>
  )
}

// 회의록·보고함 통합 탭
function MinutesReportsTab() {
  const [sub, setSub] = useState<'minutes' | 'reports'>('reports')
  return (
    <div>
      <SubTabBar
        tabs={[
          { key: 'reports' as const, label: '보고함' },
          { key: 'minutes' as const, label: '회의록' },
        ]}
        active={sub} onChange={setSub}
      />
      {sub === 'reports' && <ReportsTab isCeo={true} />}
      {sub === 'minutes' && <MinutesTab />}
    </div>
  )
}

// 직원관리 통합 탭
function StaffManageTab() {
  const [sub, setSub] = useState<'employees' | 'freelancer' | 'profile'>('employees')
  return (
    <div>
      <SubTabBar
        tabs={[
          { key: 'employees'  as const, label: '직원 관리' },
          { key: 'freelancer' as const, label: '프리랜서 관리대장' },
          { key: 'profile'    as const, label: '사원정보' },
        ]}
        active={sub} onChange={setSub}
      />
      {sub === 'employees' && <EmployeeManageSection />}
      {sub === 'freelancer' && <FreelancerTab />}
      {sub === 'profile' && <div className="space-y-8"><MyProfileTab /><PinManageTab /></div>}
    </div>
  )
}

interface Message {
  role: 'user' | 'model'
  parts: { text: string }[]
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

interface OpsUser {
  id: string
  name: string
}

export default function CeoDashboard() {
  const { data: session } = useSession()
  const ceoName = session?.user?.name ?? '대표'
  const ceoId = (session?.user as any)?.id ?? ''
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'ops' | 'assign' | 'analytics' | 'staffmanage' | 'minutesreports' | 'calendar' | 'ailogs' | 'trash' | 'dbmanage' | 'profile'>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [salesInitialView, setSalesInitialView] = useState<'customers' | 'inspection' | 'as' | 'transfer' | 'diary' | undefined>(undefined)
  const [salesInitialStatusTab, setSalesInitialStatusTab] = useState<'all' | 'lead' | 'db010' | 'contracted' | 'emotional' | 'trash' | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [allCustomersCache, setAllCustomersCache] = useState<any[]>([])
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installable, setInstallable] = useState(false)
  // 검색 결과 클릭 시 빠른 조회 드로어
  const [quickViewCustomer, setQuickViewCustomer] = useState<any | null>(null)
  // ── 메모장 ──────────────────────────────────────────────
  const [notepadOpen, setNotepadOpen] = useState(false)
  const [notepadOpacity, setNotepadOpacity] = useState(90)
  const [notepadSize, setNotepadSize] = useState({ w: 300, h: 480 })
  const [notepadInput, setNotepadInput] = useState('')
  const [addPeriod, setAddPeriod] = useState<'today' | 'week' | 'month'>('today')
  const [memoText, setMemoText] = useState(() => {
    if (typeof window !== 'undefined') { try { return localStorage.getItem('ceo-notepad-memo') || '' } catch { return '' } }
    return ''
  })
  const notepadResizeRef = useRef({ active: false, startX: 0, startY: 0, startW: 0, startH: 0 })
  function onNotepadResizeStart(e: React.MouseEvent) {
    e.preventDefault()
    notepadResizeRef.current = { active: true, startX: e.clientX, startY: e.clientY, startW: notepadSize.w, startH: notepadSize.h }
    function onMove(ev: MouseEvent) {
      if (!notepadResizeRef.current.active) return
      setNotepadSize({
        w: Math.max(240, Math.min(640, notepadResizeRef.current.startW + ev.clientX - notepadResizeRef.current.startX)),
        h: Math.max(300, Math.min(900, notepadResizeRef.current.startH + ev.clientY - notepadResizeRef.current.startY)),
      })
    }
    function onUp() {
      notepadResizeRef.current.active = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  const [ceoTodos, setCeoTodos] = useState<{id: string; text: string; checked: boolean; period: 'today' | 'week' | 'month'}[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('ceo-daily-todos') || '[]')
        return saved.map((t: any) => ({ ...t, period: t.period || 'today' }))
      } catch { return [] }
    }
    return []
  })
  function saveCeoTodos(next: typeof ceoTodos) {
    setCeoTodos(next)
    if (typeof window !== 'undefined') localStorage.setItem('ceo-daily-todos', JSON.stringify(next))
  }
  function addCeoTodo(text: string, period: 'today' | 'week' | 'month' = 'today') {
    if (!text.trim()) return
    saveCeoTodos([...ceoTodos, { id: Date.now().toString(), text: text.trim(), checked: false, period }])
    setNotepadInput('')
  }
  function toggleCeoTodo(id: string) { saveCeoTodos(ceoTodos.map(t => t.id === id ? { ...t, checked: !t.checked } : t)) }
  function deleteCeoTodo(id: string) { saveCeoTodos(ceoTodos.filter(t => t.id !== id)) }

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

  // 삭제 요청 카운트
  const [deleteReqCount, setDeleteReqCount] = useState(0)

  // 검색용 고객 캐시 초기 로드 + 삭제요청 카운트
  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => {
      const all = d.customers || []
      setAllCustomersCache(all)
      setDeleteReqCount(all.filter((c: any) => c.status === 'db010' && c.details?.delete_requested).length)
    }).catch(() => {})
  }, [])

  function handleSearch(q: string) {
    setSearchQuery(q)
    if (q.trim().length < 1) { setSearchResults([]); return }
    const lower = q.trim().toLowerCase()
    const clean = lower.replace(/-/g, '')
    setSearchResults(
      allCustomersCache.filter((c: any) =>
        // 업체명, 대표자명, 연락처만 검색
        (c.details?.company || c.company || '').toLowerCase().includes(lower) ||
        c.name?.toLowerCase().includes(lower) ||
        (c.phone || '').replace(/-/g, '').includes(clean)
      ).slice(0, 15)
    )
  }

  const tabs = [
    { key: 'overview',       label: '전체 현황' },
    { key: 'assign',         label: '계약 배정' },
    { key: 'sales',          label: '영업팀' },
    { key: 'ops',            label: '관리팀' },
    { key: 'analytics',      label: '손익·급여' },
    { key: 'staffmanage',    label: '직원관리' },
    { key: 'minutesreports', label: '회의록·보고' },
    { key: 'calendar',       label: '일정관리' },
    { key: 'ailogs',         label: 'AI 로그' },
    { key: 'trash',          label: deleteReqCount > 0 ? `DB 쓰레기통 (${deleteReqCount})` : 'DB 쓰레기통' },
  ]

  return (
    <PullToRefresh onRefresh={async () => { window.location.reload() }}>
    <div className="min-h-screen page-bg">
      {/* ── 헤더 ── */}
      <header className="bg-[#1B2A45] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <Link href="/" className="relative h-8 w-24 shrink-0 block">
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain object-left brightness-0 invert" unoptimized />
        </Link>
        <span className="text-white/50 text-xs font-medium hidden md:block">
          {tabs.find(t => t.key === activeTab)?.label ?? '대표 대시보드'}
        </span>
        <div className="flex items-center gap-2 relative">
          {/* 검색창 */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="업체명·이름·연락처..."
              className="bg-white/10 text-white placeholder-white/40 text-xs px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:bg-white/20 w-32 md:w-48"
            />
            {searchQuery.length >= 1 && (
              <button onClick={() => { setSearchQuery(''); setSearchResults([]) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs">✕</button>
            )}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 w-80 max-h-80 overflow-y-auto">
                <p className="text-[10px] text-gray-400 px-3 pt-2.5 pb-1 font-semibold">{searchResults.length}건 검색됨</p>
                {searchResults.map((c: any) => {
                  const company = c.details?.company || c.company || '(업체명 없음)'
                  const statusLabel: Record<string, string> = { lead: '신규', consulting: '상담중', contracted: '계약', db010: '010DB', emotional: '감성톡', trash: '거절' }
                  return (
                    <button key={c.id}
                      onClick={() => {
                        setQuickViewCustomer(c)
                        setSearchQuery(''); setSearchResults([])
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2 border-t border-gray-50">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{company}</p>
                        <p className="text-[11px] text-gray-400 truncate">{c.name} · {c.phone} · {c.details?.sales_user_name || c.sales_user_name || '-'}</p>
                      </div>
                      <span className="shrink-0 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                        {statusLabel[c.status] || c.status}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            {searchQuery.length >= 1 && searchResults.length === 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 w-72 px-4 py-3 text-xs text-gray-400">
                검색 결과 없음
              </div>
            )}
          </div>
          {/* 창분할 버튼 */}
          <button
            onClick={() => window.open('/split', '_blank', 'noopener')}
            className="text-[11px] px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap font-medium hidden md:block text-white/50 hover:text-white hover:bg-white/10"
            title="창 분할 — 새 탭에서 좌우 두 패널을 독립적으로 사용">
            ⊞ 분할
          </button>
          {/* 홈 버튼 */}
          <button
            onClick={() => setActiveTab('overview')}
            className="text-white/50 hover:text-white text-[11px] px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap hidden md:block font-medium">
            홈
          </button>
          {/* 메모장 버튼 */}
          <button
            onClick={() => setNotepadOpen(v => !v)}
            className={`text-[11px] px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap font-medium ${notepadOpen ? 'bg-[#C5A258]/80 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
            title="메모장">
            메모
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="메뉴"
            className={`flex flex-col gap-[5px] p-2 rounded-lg transition-colors ${menuOpen ? 'bg-white/20' : 'hover:bg-white/10'}`}
          >
            <span className={`block w-5 h-0.5 bg-white/80 transition-all origin-center ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white/80 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white/80 transition-all origin-center ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-full right-0 mt-2 bg-white border border-[#E8E2D4] rounded-2xl shadow-2xl z-50 py-2 min-w-[220px] max-h-[80vh] overflow-y-auto">
                {/* 사용자 카드 */}
                <div className="px-4 py-3 border-b border-[#E8E2D4] mb-1">
                  <p className="text-[10px] text-[#C5A258] font-bold tracking-wide uppercase mb-0.5">대표</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#1B2A45]">{ceoName}</p>
                    <button
                      onClick={async () => { try { sessionStorage.removeItem('pin_verified'); sessionStorage.removeItem('pin_user_id'); sessionStorage.removeItem('pin_last_activity') } catch {} await signOut({ redirect: false }); window.location.replace('/login') }}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition-colors font-medium"
                    >로그아웃</button>
                  </div>
                  {installable && (
                    <button
                      onClick={() => { handleInstall(); setMenuOpen(false) }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs border border-[#1B2A45]/20 hover:border-[#C5A258]/60 text-[#1B2A45]/60 hover:text-[#C5A258] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      앱 설치
                    </button>
                  )}
                </div>
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key as any); setMenuOpen(false) }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 ${
                      activeTab === tab.key
                        ? 'text-[#C5A258] font-semibold bg-[#C5A258]/8'
                        : 'text-[#1B2A45]/65 hover:text-[#1B2A45] hover:bg-[#FAF8F3]'
                    }`}
                  >
                    {activeTab === tab.key && <span className="w-1.5 h-1.5 rounded-full bg-[#C5A258] shrink-0" />}
                    {activeTab !== tab.key && <span className="w-1.5 h-1.5 shrink-0" />}
                    {tab.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── 데스크탑 탭바 ── */}
      <div className="hidden md:flex bg-white border-b border-gray-200 sticky top-[52px] z-20 px-6 overflow-x-auto shadow-sm">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`relative px-4 py-3 text-sm whitespace-nowrap shrink-0 transition-colors font-medium ${
              activeTab === tab.key
                ? 'text-[#1B2A45]'
                : 'text-[#1B2A45]/45 hover:text-[#1B2A45]/75'
            }`}>
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#C5A258] rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="px-4 md:px-6 pt-5 pb-10">

        {activeTab === 'overview'       && <OverviewTabNew onNavigate={(tab, subView) => {
          setActiveTab(tab as any)
          if (subView === 'db010') {
            setSalesInitialStatusTab('db010')
            setSalesInitialView(undefined)
          } else if (subView) {
            setSalesInitialView(subView as any)
            setSalesInitialStatusTab(undefined)
          }
        }} />}
        {activeTab === 'assign'         && <AssignBoard />}
        {activeTab === 'sales'          && <SalesCeoTab initialView={salesInitialView} initialStatusTab={salesInitialStatusTab} />}
        {activeTab === 'ops'            && <OpsCeoTab />}
        {activeTab === 'analytics'      && <AnalyticsTab />}
        {activeTab === 'staffmanage'    && <StaffManageTab />}
        {activeTab === 'minutesreports' && <MinutesReportsTab />}
        {activeTab === 'calendar'       && <CalendarTab />}
        {activeTab === 'ailogs'         && <AiLogsTab />}
        {activeTab === 'trash'          && <TrashOnlyTab />}
        {activeTab === 'dbmanage'       && <DuplicateOnlyTab />}
      </div>

      {/* 검색 빠른 조회 드로어 */}
      {quickViewCustomer && (
        <CustomerQuickDrawer
          customer={quickViewCustomer}
          onClose={() => setQuickViewCustomer(null)}
        />
      )}

      {/* ── 플로팅 메모장 ── */}
      {notepadOpen && (
        <div
          className="fixed top-14 right-4 z-[300] bg-amber-50 border border-amber-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none"
          style={{ width: notepadSize.w, height: notepadSize.h, opacity: notepadOpacity / 100 }}
        >
          <div className="flex items-center justify-between px-3 py-2 bg-amber-400 rounded-t-2xl shrink-0">
            <span className="text-[11px] font-bold text-white">메모장</span>
            <button onClick={() => setNotepadOpen(false)} className="text-white/80 hover:text-white text-sm leading-none">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col">
            <div className="px-2.5 pt-2 pb-2 border-b border-amber-200 shrink-0">
              <div className="flex gap-1 mb-1.5">
                {(['today', 'week', 'month'] as const).map(p => {
                  const lbl = { today: '오늘', week: '이번주', month: '이번달' }[p]
                  return (
                    <button key={p} type="button" onClick={() => setAddPeriod(p)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${addPeriod === p ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}>
                      {lbl}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-1">
                <input value={notepadInput} onChange={e => setNotepadInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCeoTodo(notepadInput, addPeriod) }}
                  placeholder={`${addPeriod === 'today' ? '오늘' : addPeriod === 'week' ? '이번주' : '이번달'} 할일 추가...`}
                  className="flex-1 text-xs bg-white border border-amber-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400/50" />
                <button onClick={() => addCeoTodo(notepadInput, addPeriod)}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded font-semibold">+</button>
              </div>
            </div>
            <div className="px-2.5 py-2 space-y-3 shrink-0">
              {(['today', 'week', 'month'] as const).map(p => {
                const sectionLabel = { today: '오늘', week: '이번주', month: '이번달' }[p]
                const items = ceoTodos.filter(t => t.period === p)
                return (
                  <div key={p}>
                    <p className="text-[9px] font-bold text-amber-600 mb-1">{sectionLabel}</p>
                    {items.length === 0 ? (
                      <p className="text-[10px] text-amber-200 italic pl-1">없음</p>
                    ) : (
                      <div className="space-y-0.5">
                        {items.map(t => (
                          <div key={t.id} className="flex items-center gap-1.5 group py-0.5">
                            <input type="checkbox" checked={t.checked} onChange={() => toggleCeoTodo(t.id)}
                              className="w-3.5 h-3.5 accent-amber-500 cursor-pointer shrink-0" />
                            <span className={`text-xs flex-1 ${t.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.text}</span>
                            <button onClick={() => deleteCeoTodo(t.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-[10px] transition-opacity shrink-0">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="border-t border-amber-200 px-2.5 pt-2 pb-3 flex flex-col flex-1" style={{ minHeight: 120 }}>
              <p className="text-[9px] font-bold text-amber-600 mb-1.5">자유 메모</p>
              <textarea value={memoText}
                onChange={e => { setMemoText(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('ceo-notepad-memo', e.target.value) }}
                placeholder="자유롭게 메모하세요..."
                className="flex-1 w-full text-xs bg-white border border-amber-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-amber-400/50 resize-none"
                style={{ minHeight: 80 }} />
            </div>
          </div>
          <div className="px-3 py-1.5 border-t border-amber-200 flex items-center gap-2 shrink-0">
            <span className="text-[9px] text-amber-600 font-semibold shrink-0">투명도</span>
            <input type="range" min={20} max={100} value={notepadOpacity}
              onChange={e => setNotepadOpacity(Number(e.target.value))}
              className="flex-1 h-1 accent-amber-400" />
            <span className="text-[9px] text-amber-600 font-semibold w-6 text-right">{notepadOpacity}%</span>
          </div>
          <div onMouseDown={onNotepadResizeStart}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10 flex items-end justify-end pb-0.5 pr-0.5" title="드래그하여 크기 조절">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 1L1 9M9 5L5 9M9 9" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  )
}

// ─── 검색 빠른 조회 드로어 ────────────────────────────────
function CustomerQuickDrawer({ customer, onClose }: { customer: any; onClose: () => void }) {
  const [opsCase, setOpsCase]       = useState<any | null>(null)
  const [loading, setLoading]       = useState(true)
  const [tlText, setTlText]         = useState('')
  const [tlSaving, setTlSaving]     = useState(false)
  const [activeTab, setActiveTab]   = useState<'incall' | 'ops'>('incall')

  const company  = customer.details?.company || customer.company || customer.name || '—'
  const ownerName = customer.details?.sales_user_name || customer.sales_user_name || '-'
  const d = customer.details || {}

  useEffect(() => {
    // ops_case 조회 (customer_id 우선, 없으면 전화번호 fallback)
    setLoading(true)
    const normPhone = (p: string) => (p || '').replace(/[^0-9]/g, '')
    const custPhone = normPhone(customer.phone || '')
    fetch('/api/ops-cases')
      .then(r => r.json())
      .then(data => {
        const found = (data.cases || []).find((c: any) =>
          (c.customer_id && c.customer_id === customer.id) ||
          (custPhone && normPhone(c.phone || '') === custPhone)
        )
        setOpsCase(found || null)
        // ops_case 있으면 관리팀 탭 먼저 보여주기
        if (found) setActiveTab('ops')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [customer.id])

  async function addTimeline() {
    if (!tlText.trim() || !opsCase) return
    setTlSaving(true)
    const entry = { user: 'CEO', content: tlText.trim(), created_at: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00' }
    const updated = [...(opsCase.timeline || []), entry]
    await fetch(`/api/ops-cases/${opsCase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeline: updated }),
    })
    setOpsCase((prev: any) => ({ ...prev, timeline: updated }))
    setTlText('')
    setTlSaving(false)
  }

  const INCALL_FIELDS = [
    ['업체명', d.company],
    ['지역', d.region],
    ['접수일', d.reception_date],
    ['업종', d.business_type],
    ['실제업무', d.real_work],
    ['업력', d.years_in_business],
    ['매출(25)', d.revenue_2025],
    ['매출(24)', d.revenue_2024],
    ['기보대출', d.loan_kibo],
    ['신보대출', d.loan_shinbo],
    ['재단대출', d.loan_jaedan],
    ['기타대출', d.loan_other],
    ['KCB점수', d.credit_kcb],
    ['NICE점수', d.credit_nice],
    ['세금체납', d.tax_status],
    ['필요자금', d.required_funds],
    ['솔루션', d.solution],
  ].filter(([, v]) => v)

  const statusLabel: Record<string, string> = { lead: '신규', db010: '010DB', contracted: '계약', emotional: '감성톡', trash: '거절' }
  const statusColor: Record<string, string> = { lead: 'bg-sky-100 text-sky-700', db010: 'bg-violet-100 text-violet-700', contracted: 'bg-emerald-100 text-emerald-700', emotional: 'bg-pink-100 text-pink-700', trash: 'bg-gray-100 text-gray-500' }

  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute top-0 bottom-0 right-0 w-full md:w-[480px] bg-white shadow-2xl flex flex-col overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="font-bold text-[#1B2A45] text-base leading-tight">{company}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-gray-400">{customer.name} · {customer.phone}</span>
              <span className="text-xs text-gray-400">담당: {ownerName}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusColor[customer.status] || 'bg-gray-100 text-gray-500'}`}>
                {statusLabel[customer.status] || customer.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1 mt-0.5">✕</button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-100 shrink-0">
          <button onClick={() => setActiveTab('incall')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'incall' ? 'border-[#1B2A45] text-[#1B2A45]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            인콜일지
          </button>
          <button onClick={() => setActiveTab('ops')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'ops' ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            관리팀 타임라인 {opsCase ? '' : loading ? '…' : '(없음)'}
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── 인콜일지 ── */}
          {activeTab === 'incall' && (
            <div className="space-y-3">
              {/* 기본 연락처 */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['대표명', customer.name],
                  ['연락처', customer.phone],
                  ...INCALL_FIELDS,
                ].filter(([, v]) => v).map(([label, val]) => (
                  <div key={label as string} className="bg-[#F8F6F1] rounded-lg px-3 py-2">
                    <p className="text-[10px] text-[#1B2A45]/40 mb-0.5">{label}</p>
                    <p className="text-xs font-semibold text-[#1B2A45] break-words">{String(val)}</p>
                  </div>
                ))}
              </div>
              {INCALL_FIELDS.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">인콜일지 데이터가 없습니다</p>
              )}
              {customer.memo && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-amber-600 font-semibold mb-1">메모</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{customer.memo || customer.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── 관리팀 타임라인 ── */}
          {activeTab === 'ops' && (
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
              ) : !opsCase ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400">관리팀 진행 내역이 없습니다</p>
                  <p className="text-xs text-gray-300 mt-1">계약 후 관리팀 배정 시 표시됩니다</p>
                </div>
              ) : (
                <>
                  {/* 기관·단계 요약 */}
                  <div className="bg-violet-50 rounded-lg px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-[10px] text-violet-500 font-semibold mb-0.5">담당 기관</p>
                      <p className="text-sm font-bold text-[#1B2A45]">{opsCase.institution || '미배정'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-violet-500 font-semibold mb-0.5">단계</p>
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold text-white bg-violet-500">
                        {opsCase.progress_stage || opsCase.stage || '—'}
                      </span>
                    </div>
                    {opsCase.ops_user_name && (
                      <div className="text-right">
                        <p className="text-[10px] text-violet-500 font-semibold mb-0.5">담당자</p>
                        <p className="text-xs font-semibold text-[#1B2A45]">{opsCase.ops_user_name}</p>
                      </div>
                    )}
                  </div>

                  {/* 재무 정보 */}
                  {[
                    ['승인금액', opsCase.details?.approval_amount],
                    ['계약금', opsCase.details?.contract_amount],
                    ['입금액', opsCase.details?.deposit_amount],
                    ['방문일정', opsCase.details?.visit_date],
                    ['계약일', opsCase.details?.contract_date],
                  ].filter(([, v]) => v).length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['승인금액', opsCase.details?.approval_amount],
                        ['계약금', opsCase.details?.contract_amount],
                        ['입금액', opsCase.details?.deposit_amount],
                        ['방문일정', opsCase.details?.visit_date],
                        ['계약일', opsCase.details?.contract_date],
                      ].filter(([, v]) => v).map(([label, val]) => (
                        <div key={label as string} className="bg-gray-50 rounded-lg px-3 py-2">
                          <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                          <p className="text-xs font-semibold text-gray-800">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 타임라인 입력 */}
                  <div className="flex gap-2">
                    <input value={tlText} onChange={e => setTlText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTimeline()}
                      placeholder="타임라인 메모 추가..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400" />
                    <button onClick={addTimeline} disabled={tlSaving || !tlText.trim()}
                      className="bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                      {tlSaving ? '…' : '추가'}
                    </button>
                  </div>

                  {/* 타임라인 목록 */}
                  {(!opsCase.timeline || opsCase.timeline.length === 0) ? (
                    <p className="text-xs text-gray-400 text-center py-4">타임라인이 없습니다</p>
                  ) : (
                    <div className="relative pl-4 border-l-2 border-violet-200 space-y-2">
                      {[...(opsCase.timeline || [])].reverse().map((entry: any, i: number) => {
                        const isAuto = entry.user === '자동기록'
                        const d2 = new Date(entry.created_at || entry.date || '')
                        const dateStr = isNaN(d2.getTime()) ? '' : d2.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }) + ' ' + d2.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })
                        return (
                          <div key={i} className="relative">
                            <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${isAuto ? 'bg-violet-300' : 'bg-[#1B2A45]'}`} />
                            <div className={`rounded-lg px-3 py-2 ${isAuto ? 'bg-violet-50' : 'bg-gray-50'}`}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[10px] font-semibold ${isAuto ? 'text-violet-600' : 'text-[#1B2A45]'}`}>{entry.user || '—'}</span>
                                <span className="text-[10px] text-gray-400">{dateStr}</span>
                              </div>
                              <p className="text-xs text-gray-700">{entry.content || entry.text}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {opsCase.progress_memo && (
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gray-400 font-semibold mb-1">진행 메모</p>
                      <p className="text-xs text-gray-700">{opsCase.progress_memo}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 전체 현황 ───────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState({ customers: 0, contracts: 0, opsCases: 0, revenue: 0 })

  useEffect(() => {
    async function load() {
      const [cRes, conRes, opsRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/contracts'),
        fetch('/api/ops-cases'),
      ])
      const [cData, conData, opsData] = await Promise.all([cRes.json(), conRes.json(), opsRes.json()])
      const revenue = (opsData.cases || []).reduce((s: number, c: any) => s + (c.revenue || 0), 0)
      const inProgress = (opsData.cases || []).filter((c: any) => !['completed', 'rejected'].includes(c.progress_stage)).length
      setStats({
        customers: cData.customers?.length || 0,
        contracts: conData.contracts?.length || 0,
        opsCases: inProgress,
        revenue,
      })
    }
    load()
  }, [])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[
        { label: '전체 고객', value: stats.customers + '명' },
        { label: '총 계약', value: stats.contracts + '건' },
        { label: '관리팀 진행 중', value: stats.opsCases + '건' },
        { label: '누적 매출', value: stats.revenue > 0 ? (stats.revenue / 10000).toFixed(0) + '만원' : '-' },
      ].map((s) => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">{s.label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── 계약 배정 ───────────────────────────────────────────
function AssignTab() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [opsUsers, setOpsUsers] = useState<OpsUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOps, setSelectedOps] = useState<Record<string, string>>({})
  const [assigning, setAssigning] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [cRes, uRes] = await Promise.all([
      fetch('/api/assign'),
      fetch('/api/users?role=ops'),
    ])
    const [cData, uData] = await Promise.all([cRes.json(), uRes.json()])
    setContracts(cData.contracts || [])
    setOpsUsers(uData.users || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function assign(contractId: string) {
    const opsUserId = selectedOps[contractId]
    if (!opsUserId) return alert('관리팀 담당자를 선택해주세요')
    const opsUser = opsUsers.find(u => u.id === opsUserId)
    setAssigning(contractId)
    await fetch('/api/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract_id: contractId, ops_user_id: opsUserId, ops_user_name: opsUser?.name }),
    })
    setAssigning(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">미배정 계약 목록</h2>
        <span className="text-xs text-gray-400">{contracts.length}건 대기 중</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">불러오는 중...</div>
      ) : contracts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          배정 대기 중인 계약이 없습니다.
        </div>
      ) : (
        contracts.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{c.customers?.name}</span>
                  {c.customers?.company && <span className="text-gray-400 text-xs">{c.customers.company}</span>}
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">배정 대기</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>{c.customers?.phone}</span>
                  {c.contract_amount > 0 && <span>{c.contract_amount.toLocaleString()}원</span>}
                  <span>영업: {c.sales_user_name}</span>
                  <span>{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                {c.memo && <p className="text-xs text-gray-500 mt-2 bg-gray-50 px-3 py-2 rounded-lg">{c.memo}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={selectedOps[c.id] || ''}
                  onChange={e => setSelectedOps(prev => ({ ...prev, [c.id]: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">담당자 선택</option>
                  {opsUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => assign(c.id)}
                  disabled={assigning === c.id || !selectedOps[c.id]}
                  className="bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  {assigning === c.id ? '배정 중...' : '배정'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── 영업팀 현황 ─────────────────────────────────────────
function SalesTab() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => {
      setCustomers(d.customers || [])
      setLoading(false)
    })
  }, [])

  const byStatus = {
    lead: customers.filter(c => c.status === 'lead').length,
    consulting: customers.filter(c => c.status === 'consulting').length,
    contracted: customers.filter(c => c.status === 'contracted').length,
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 mb-2">
        {[
          { label: '신규 리드', count: byStatus.lead, color: 'text-sky-600' },
          { label: '상담 중', count: byStatus.consulting, color: 'text-amber-600' },
          { label: '계약 완료', count: byStatus.contracted, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">전체 고객 목록 ({customers.length})</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">등록된 고객이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {customers.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">{c.name}</span>
                  {c.company && <span className="text-xs text-gray-400 ml-2">{c.company}</span>}
                  <p className="text-xs text-gray-400">{c.phone} · {c.sales_user_name}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.status === 'lead' ? 'bg-sky-100 text-sky-700' :
                  c.status === 'consulting' ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {c.status === 'lead' ? '신규 리드' : c.status === 'consulting' ? '상담 중' : '계약 완료'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 관리팀 현황 ─────────────────────────────────────────
function OpsTab() {
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ops-cases').then(r => r.json()).then(d => {
      setCases(d.cases || [])
      setLoading(false)
    })
  }, [])

  const STAGE_LABEL: Record<string, string> = {
    assigned: '배정 완료', doc_collect: '서류 수집', reviewing: '심사 중',
    approved: '승인 완료', executing: '자금 집행', completed: '완료', rejected: '거절/보류',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">전체 케이스 ({cases.length})</h3>
      </div>
      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">불러오는 중...</div>
      ) : cases.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">배정된 케이스가 없습니다.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {cases.map(c => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900">{c.customers?.name}</span>
                {c.customers?.company && <span className="text-xs text-gray-400 ml-2">{c.customers.company}</span>}
                <p className="text-xs text-gray-400">{c.ops_user_name} · {c.institution || '기관 미정'}</p>
              </div>
              <div className="flex items-center gap-2">
                {c.revenue > 0 && <span className="text-xs text-emerald-600 font-medium">{c.revenue.toLocaleString()}원</span>}
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {STAGE_LABEL[c.progress_stage] || c.progress_stage}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 매출 관리 ───────────────────────────────────────────
function RevenueTab() {
  const [data, setData] = useState<any>(null)
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pnlMonth, setPnlMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [pnlData, setPnlData] = useState<any>(null)
  const [pnlLoading, setPnlLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/revenue').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
    ]).then(([revData, custData]) => {
      setData(revData)
      setCustomers(custData.customers || [])
      setLoading(false)
    })
  }, [])

  // Load P&L when month changes
  useEffect(() => {
    setPnlLoading(true)
    fetch(`/api/payroll?year_month=${pnlMonth}`).then(r => r.json()).then(json => {
      setPnlData(json.record || null)
      setPnlLoading(false)
    }).catch(() => { setPnlLoading(false) })
  }, [pnlMonth])

  const fmt = (n: number) => {
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '억'
    if (n >= 10000) return (n / 10000).toFixed(0) + '만'
    return n.toLocaleString()
  }

  // 이번 달 성과 계산
  const now = new Date()
  const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

  const thisMonthRevenue = data?.monthly?.find((m: any) => m.fullMonth === thisMonthStr)?.합계 ?? 0
  const lastMonthRevenue = data?.monthly?.find((m: any) => m.fullMonth === lastMonthStr)?.합계 ?? 0
  const revenueChange = lastMonthRevenue > 0
    ? (((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1)
    : null

  const thisMonthSales: any[] = data?.thisMonthSales || []
  const thisMonthOps:   any[] = data?.thisMonthOps   || []
  const thisMonthSalesTotal = thisMonthSales.reduce((s: number, e: any) => s + (e.amount || 0), 0)
  const thisMonthOpsTotal   = thisMonthOps.reduce((s: number, e: any) => s + (e.amount || 0), 0)

  const totalCustomers = customers.length
  const contractedCustomers = customers.filter((c: any) => c.status === 'contracted').length
  const conversionRate = totalCustomers > 0
    ? ((contractedCustomers / totalCustomers) * 100).toFixed(1)
    : '0.0'

  const totalContractCount = data?.salesByUser?.reduce((s: number, u: any) => s + (u.count || 0), 0) || 0
  const totalSalesAmt = data?.salesByUser?.reduce((s: number, u: any) => s + (u.amount || 0), 0) || 0
  const avgContractValue = totalContractCount > 0 ? Math.round(totalSalesAmt / totalContractCount) : 0

  // P&L 계산
  let pnl: { totalRevenue: number; laborCost: number; otherTotal: number; netProfit: number } | null = null
  if (pnlData?.employees) {
    const emps = pnlData.employees
    const opsEmps: any[] = emps.ops_employees || []
    const salesEmps: any[] = emps.sales_employees || []
    const otherCosts: Record<string, number> = emps.other_costs || {}

    const calcOpsLocal = (emp: any) => {
      const contractIncentive = Math.round(Number(emp.contract_revenue || 0) * 0.5)
      const feeIncentive = Math.round(Number(emp.fee_revenue || 0) * 0.1)
      const beforeDeduction = Number(emp.base_salary || 0) + contractIncentive + feeIncentive + Number(emp.performance_bonus || 0) - Number(emp.deduction || 0)
      return beforeDeduction
    }
    const calcSalesLocal = (emp: any) => {
      const contractIncentiveAmt = Math.round(Number(emp.contract_revenue || 0) * Number(emp.contract_incentive_rate || 0) / 100)
      return contractIncentiveAmt + Number(emp.fee_incentive || 0) + Number(emp.performance_bonus || 0) - Number(emp.deduction || 0)
    }

    const totalRevenue =
      opsEmps.reduce((s: number, e: any) => s + Number(e.contract_revenue || 0) + Number(e.fee_revenue || 0), 0) +
      salesEmps.reduce((s: number, e: any) => s + Number(e.contract_revenue || 0), 0)
    const tax = Math.round(totalRevenue * 0.10)
    const laborCost =
      opsEmps.reduce((s: number, e: any) => s + calcOpsLocal(e), 0) +
      salesEmps.reduce((s: number, e: any) => s + calcSalesLocal(e), 0)
    const otherTotal = Object.values(otherCosts).reduce((s: number, v: unknown) => s + Number(v), 0)
    const netProfit = totalRevenue - tax - laborCost - otherTotal
    pnl = { totalRevenue, laborCost, otherTotal, netProfit }
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
  if (!data) return null

  return (
    <div className="space-y-6 pb-8">

      {/* ── 이달 매출 상단 요약 ── */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-[#263d66] rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] text-white/60 font-medium">{thisMonthStr.replace('-', '년 ')}월 매출</p>
            <p className="text-3xl font-black mt-0.5">{fmt(thisMonthSalesTotal + thisMonthOpsTotal)}원</p>
          </div>
          {revenueChange !== null && (
            <div className={`text-center px-3 py-1.5 rounded-xl ${Number(revenueChange) >= 0 ? 'bg-emerald-500/30' : 'bg-red-400/30'}`}>
              <p className="text-lg font-black">{Number(revenueChange) >= 0 ? '▲' : '▼'}{Math.abs(Number(revenueChange))}%</p>
              <p className="text-[10px] text-white/70">전월 대비</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] text-white/60 mb-1">영업팀 ({thisMonthSales.length}건)</p>
            <p className="text-xl font-black">{fmt(thisMonthSalesTotal)}원</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] text-white/60 mb-1">관리팀 ({thisMonthOps.length}건)</p>
            <p className="text-xl font-black">{fmt(thisMonthOpsTotal)}원</p>
          </div>
        </div>
      </div>

      {/* ── 이달 매출 내역 상세 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 영업팀 이달 계약 */}
        <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <p className="text-xs font-bold text-blue-800">영업팀 이달 계약 매출</p>
            <span className="text-[10px] text-blue-600">{thisMonthSales.length}건 · {fmt(thisMonthSalesTotal)}원</span>
          </div>
          {thisMonthSales.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">이달 계약 없음</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {thisMonthSales.map((e: any) => (
                <div key={e.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{e.company}</p>
                    <p className="text-[10px] text-gray-400">{e.sales_user_name} · {e.date?.slice(0, 10)}</p>
                  </div>
                  <span className="text-sm font-black text-blue-600">{fmt(e.amount)}원</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* 관리팀 이달 수수료 */}
        <div className="bg-white rounded-xl border border-violet-100 overflow-hidden">
          <div className="px-4 py-3 bg-violet-50 border-b border-violet-100 flex items-center justify-between">
            <p className="text-xs font-bold text-violet-800">관리팀 이달 수수료 매출</p>
            <span className="text-[10px] text-violet-600">{thisMonthOps.length}건 · {fmt(thisMonthOpsTotal)}원</span>
          </div>
          {thisMonthOps.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">이달 수수료 없음</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {thisMonthOps.map((e: any) => (
                <div key={e.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{e.company}</p>
                    <p className="text-[10px] text-gray-400">{e.ops_user_name} · {e.date?.slice(0, 10)}</p>
                  </div>
                  <span className="text-sm font-black text-violet-600">{fmt(e.amount)}원</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 이번 달 성과 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">이번 달 성과</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">이번 달 총 매출</p>
            <p className="text-xl font-black text-gray-900">{fmt(thisMonthRevenue)}원</p>
            {revenueChange !== null && (
              <p className={`text-xs mt-1 font-medium ${Number(revenueChange) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {Number(revenueChange) >= 0 ? '▲' : '▼'} {Math.abs(Number(revenueChange))}% 전월 대비
              </p>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">리드→계약 전환율</p>
            <p className="text-xl font-black text-gray-900">{conversionRate}%</p>
            <p className="text-xs text-gray-400 mt-1">{contractedCustomers}명 / 전체 {totalCustomers}명</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">평균 계약 금액</p>
            <p className="text-xl font-black text-gray-900">{fmt(avgContractValue)}원</p>
            <p className="text-xs text-gray-400 mt-1">총 {totalContractCount}건 계약</p>
          </div>
        </div>
      </div>

      {/* 총계 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '영업팀 총 매출', value: data.totalSales, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '관리팀 총 매출', value: data.totalOps, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: '통합 총 매출', value: data.total, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5 text-center`}>
            <p className={`text-2xl font-black ${s.color}`}>{fmt(s.value)}원</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 월별 차트 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">월별 매출 추이 (최근 6개월)</h3>
        {data.monthly.every((m: any) => m.합계 === 0) ? (
          <p className="text-center text-gray-400 text-sm py-8">아직 매출 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 11 }} width={55} />
              <Tooltip formatter={(v: number) => v.toLocaleString() + '원'} />
              <Legend />
              <Bar dataKey="영업팀" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="관리팀" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 월별 손익 연동 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-sm font-semibold text-gray-800">월별 손익 연동</h3>
          <input
            type="month"
            value={pnlMonth}
            onChange={e => setPnlMonth(e.target.value)}
            className="border border-gray-200 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {pnlLoading && <span className="text-xs text-gray-400">불러오는 중...</span>}
        </div>
        {!pnlData ? (
          <p className="text-center text-gray-400 text-sm py-6">
            {pnlLoading ? '불러오는 중...' : `${pnlMonth} 급여 데이터가 없습니다.`}
          </p>
        ) : pnl && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '총매출', value: pnl.totalRevenue, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: '인건비', value: pnl.laborCost, color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: '운영비', value: pnl.otherTotal, color: 'text-violet-700', bg: 'bg-violet-50' },
              {
                label: '순이익',
                value: pnl.netProfit,
                color: pnl.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700',
                bg: pnl.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50',
              },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-lg p-4 text-center`}>
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-lg font-black ${s.color}`}>{fmt(s.value)}원</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 직원별 실적 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 영업팀 직원별 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">영업팀 직원별 실적</h3>
          {data.salesByUser.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-4">데이터 없음</p>
          ) : (
            <div className="space-y-2">
              {data.salesByUser
                .sort((a: any, b: any) => b.amount - a.amount)
                .map((u: any) => (
                  <div key={u.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                        {u.name?.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.count}건</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">{fmt(u.amount)}원</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* 관리팀 직원별 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">관리팀 직원별 실적</h3>
          {data.opsByUser.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-4">데이터 없음</p>
          ) : (
            <div className="space-y-2">
              {data.opsByUser
                .sort((a: any, b: any) => b.amount - a.amount)
                .map((u: any) => (
                  <div key={u.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                        {u.name?.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.count}건</span>
                    </div>
                    <span className="text-sm font-semibold text-violet-600">{fmt(u.amount)}원</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── 거절 DB 쓰레기통 전용 탭 ────────────────────────────────
function TrashOnlyTab() {
  return <DbManageTab initialView="delete_requests" />
}

// ─── 중복 DB 전용 탭 ──────────────────────────────────────
function DuplicateOnlyTab() {
  return <DbManageTab initialView="duplicate" />
}

// ─── 직원 관리 섹션 (생성·수정·팀이관) ──────────────────────
interface EmpRow { id: string; name: string; username: string; role: string }
function EmployeeManageSection() {
  const [employees, setEmployees] = useState<EmpRow[]>([])
  const [loading, setLoading] = useState(false)
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; username: string; password: string; role: string }>({ name: '', username: '', password: '', role: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', username: '', password: '', role: 'sales' as 'sales' | 'ops' })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const roleLabel: Record<string, string> = { sales: '영업팀', ops: '관리팀', ceo: '대표' }
  const roleBg: Record<string, string> = { sales: 'bg-sky-100 text-sky-700', ops: 'bg-violet-100 text-violet-700', ceo: 'bg-amber-100 text-amber-700' }

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/users')
    const data = await res.json()
    setEmployees((data.users || []).filter((u: EmpRow) => u.role !== 'ceo'))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function openEdit(emp: EmpRow) {
    setEditId(emp.id)
    setEditForm({ name: emp.name, username: emp.username, password: '', role: emp.role })
    setEditError('')
  }

  async function saveEdit() {
    if (!editId) return
    setEditSaving(true)
    setEditError('')
    const patch: Record<string, any> = {}
    if (editForm.name) patch.name = editForm.name
    if (editForm.username) patch.username = editForm.username
    if (editForm.password) patch.password = editForm.password
    if (editForm.role) patch.role = editForm.role

    const res = await fetch(`/api/users/${editId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (!res.ok) { setEditError(data.error || '저장 실패'); setEditSaving(false); return }

    if (data.customersUnassigned) {
      alert(`팀이관 완료: ${editForm.name}의 담당 고객 DB가 전부 미배정으로 변경됐습니다.\n다른 영업사원에게 재배정해주세요.`)
    }
    setEmployees(p => p.map(e => e.id === editId ? { ...e, ...data.user } : e))
    setEditId(null)
    setEditSaving(false)
  }

  async function deleteEmployee(emp: EmpRow) {
    if (!confirm(`${emp.name} (${emp.username}) 직원을 삭제하시겠습니까?`)) return
    const res = await fetch(`/api/users/${emp.id}`, { method: 'DELETE' })
    if (res.ok) setEmployees(p => p.filter(e => e.id !== emp.id))
    else { const d = await res.json(); alert(`삭제 실패: ${d.error}`) }
  }

  async function createEmployee() {
    setCreateError('')
    if (!createForm.name.trim() || !createForm.username.trim() || !createForm.password.trim()) {
      setCreateError('이름, 아이디, 비밀번호를 모두 입력해주세요'); return
    }
    setCreating(true)
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    })
    const data = await res.json()
    if (!res.ok) { setCreateError(data.error || '생성 실패'); setCreating(false); return }
    setEmployees(p => [...p, data.user])
    setNewlyCreatedId(data.user.id)
    setCreateForm({ name: '', username: '', password: '', role: 'sales' })
    setShowCreate(false)
    setCreating(false)
    setTimeout(() => setNewlyCreatedId(null), 5000)
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">직원 관리</h3>
          <p className="text-xs text-gray-400 mt-0.5">이름·아이디·비밀번호 수정, 팀이관, 계정 삭제</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-xl hover:border-gray-400 transition-colors">새로고침</button>
          <button onClick={() => { setShowCreate(v => !v); setCreateError('') }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors ${showCreate ? 'bg-gray-100 text-gray-600 border-gray-200' : 'bg-[#1B2A45] text-white border-[#1B2A45]'}`}>
            {showCreate ? '✕ 취소' : '➕ 직원 추가'}
          </button>
        </div>
      </div>

      {/* 직원 생성 폼 */}
      {showCreate && (
        <div className="bg-white border border-[#1B2A45]/20 rounded-xl p-5 space-y-4">
          <p className="text-sm font-bold text-[#1B2A45]">새 직원 계정 만들기</p>
          <div className="flex gap-2">
            {(['sales', 'ops'] as const).map(r => (
              <button key={r} onClick={() => setCreateForm(f => ({ ...f, role: r }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${createForm.role === r ? (r === 'sales' ? 'bg-sky-500 text-white border-sky-500' : 'bg-violet-500 text-white border-violet-500') : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                {r === 'sales' ? '영업팀' : '관리팀'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3">
            {[['이름 (실명)', 'name', 'text', '예) 홍길동'], ['아이디 (로그인 ID)', 'username', 'text', '예) hong2024'], ['초기 비밀번호', 'password', 'text', '4자 이상']].map(([label, key, type, ph]) => (
              <div key={key}>
                <label className="text-xs text-gray-500 font-medium mb-1 block">{label}</label>
                <input type={type} placeholder={ph}
                  value={(createForm as any)[key]}
                  onChange={e => setCreateForm(f => ({ ...f, [key]: key === 'username' ? e.target.value.trim() : e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#1B2A45]/50 focus:ring-1 focus:ring-[#1B2A45]/20" />
              </div>
            ))}
          </div>
          {createError && <p className="text-xs text-red-500 font-medium">{createError}</p>}
          <button onClick={createEmployee} disabled={creating}
            className="w-full py-2.5 bg-[#1B2A45] hover:bg-[#1B2A45]/90 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
            {creating ? '생성 중...' : `${createForm.role === 'sales' ? '영업팀' : '관리팀'} 직원 계정 생성`}
          </button>
        </div>
      )}

      {/* 직원 목록 */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
      ) : employees.length === 0 ? (
        <div className="bg-white border border-[#E8E2D4] rounded-xl p-12 text-center text-sm text-gray-400">직원이 없습니다</div>
      ) : (
        <div className="bg-white border border-[#E8E2D4] rounded-xl overflow-hidden">
          {employees.map(emp => (
            <div key={emp.id} className={`border-b border-gray-50 last:border-b-0 ${emp.id === newlyCreatedId ? 'bg-green-50' : ''}`}>
              {editId === emp.id ? (
                /* 수정 폼 */
                <div className="px-5 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {[['이름', 'name', 'text'], ['아이디', 'username', 'text'], ['새 비밀번호', 'password', 'text']].map(([label, key, type]) => (
                      <div key={key}>
                        <label className="text-[10px] text-gray-400 font-medium block mb-1">{label}</label>
                        <input type={type}
                          placeholder={key === 'password' ? '변경 안 하면 비워두세요' : ''}
                          value={(editForm as any)[key]}
                          onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B2A45]/50" />
                      </div>
                    ))}
                    <div>
                      <label className="text-[10px] text-gray-400 font-medium block mb-1">팀 (이관 시 DB 미배정 처리)</label>
                      <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#1B2A45]/50">
                        <option value="sales">영업팀</option>
                        <option value="ops">관리팀</option>
                      </select>
                    </div>
                  </div>
                  {editForm.role !== emp.role && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-amber-700 font-semibold">팀이관 시 {emp.name}의 담당 고객 DB가 모두 미배정으로 변경됩니다</p>
                    </div>
                  )}
                  {editError && <p className="text-xs text-red-500">{editError}</p>}
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={editSaving}
                      className="flex-1 py-2 bg-[#1B2A45] text-white text-sm font-semibold rounded-xl disabled:opacity-50">
                      {editSaving ? '저장 중...' : '저장'}
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200">
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                /* 기본 행 */
                <div className="flex items-center gap-4 px-5 py-4">
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
                      {emp.id === newlyCreatedId && <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">방금 생성</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openEdit(emp)}
                      className="text-xs text-[#1B2A45] hover:text-[#1B2A45]/80 px-3 py-1.5 rounded-xl hover:bg-[#1B2A45]/10 border border-transparent hover:border-[#1B2A45]/20 transition-colors font-medium">
                      수정
                    </button>
                    <button onClick={() => deleteEmployee(emp)}
                      className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-xl hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors font-medium">
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 보고함 ──────────────────────────────────────────────
function ReportsTab({ isCeo = false }: { isCeo?: boolean }) {
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'morning' | 'daily'>('all')
  const [viewReport, setViewReport] = useState<any | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const loadReports = () => {
    setLoading(true)
    fetch('/api/reports').then(r => r.json()).then(d => {
      setReports(d.reports || [])
      setLoading(false)
    })
  }

  useEffect(() => { loadReports() }, [])

  const morningReports = reports.filter(r => r.report_type === 'morning')
  const dailyReports   = reports.filter(r => r.report_type === 'daily')
  const filtered = filter === 'all' ? reports : reports.filter(r => r.report_type === filter)
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayMorning = morningReports.filter(r => r.report_date === todayStr)
  const todayDaily   = dailyReports.filter(r => r.report_date === todayStr)

  // 날짜별 그룹핑
  const groupedByDate = filtered.reduce((acc: Record<string, any[]>, r: any) => {
    const d = r.report_date || r.created_at?.slice(0,10) || '날짜없음'
    if (!acc[d]) acc[d] = []
    acc[d].push(r)
    return acc
  }, {})
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))

  const pct = (n: number, d: number) => d === 0 ? '—' : (n / d * 100).toFixed(1) + '%'

  // 오전보고 통계 (전체 누적)
  const morningStats = {
    total_calls: morningReports.reduce((s, r) => s + Number(r.data?.total_calls || 0), 0),
    no_connect:  morningReports.reduce((s, r) => s + Number(r.data?.no_connect || 0), 0),
    connected:   morningReports.reduce((s, r) => s + Number(r.data?.connected || 0), 0),
    db_secured:  morningReports.reduce((s, r) => s + Number(r.data?.db_secured || 0), 0),
    outbound_contracts: morningReports.reduce((s, r) => s + Number(r.data?.outbound_contracts || 0), 0),
  }
  // 마감보고 통계
  const dailyStats = {
    today_contracts: dailyReports.reduce((s, r) => s + Number(r.data?.today_contracts || 0), 0),
    month_contracts: dailyReports.filter(r => r.report_date?.slice(0, 7) === todayStr.slice(0, 7))
      .reduce((s, r) => s + Number(r.data?.today_contracts || 0), 0),
    supply_decided: dailyReports.reduce((s, r) => s + (r.data?.supply_db || []).filter((i: any) => i.is_decided).length, 0),
    outbound_decided: dailyReports.reduce((s, r) => s + (r.data?.outbound || []).filter((i: any) => i.is_decided).length, 0),
  }

  // 선택 삭제
  async function deleteSelected() {
    if (selected.size === 0) return
    if (!confirm(`선택한 ${selected.size}건을 삭제하시겠습니까?`)) return
    setDeleting(true)
    await Promise.all([...selected].map(id =>
      fetch(`/api/reports/${id}`, { method: 'DELETE' })
    ))
    setSelected(new Set())
    setDeleting(false)
    loadReports()
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(r => r.id)))
  }

  return (
    <div className="space-y-5 pb-8">
      {/* 오늘 현황 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-semibold mb-1">오늘 오전보고</p>
          {todayMorning.length === 0 ? <p className="text-sm text-amber-400">아직 제출 없음</p> : (
            <div className="space-y-1">
              {todayMorning.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-800">{r.user_name}</span>
                  <button onClick={() => setViewReport(r)} className="text-xs text-amber-600 hover:text-amber-800">보기</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-semibold mb-1">오늘 마감보고</p>
          {todayDaily.length === 0 ? <p className="text-sm text-blue-400">아직 제출 없음</p> : (
            <div className="space-y-1">
              {todayDaily.map(r => (
                <div key={r.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-800">{r.user_name}</span>
                  <button onClick={() => setViewReport(r)} className="text-xs text-blue-600 hover:text-blue-800">보기</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all',     label: `전체 (${reports.length})` },
          { key: 'morning', label: `오전보고 (${morningReports.length})` },
          { key: 'daily',   label: `마감보고 (${dailyReports.length})` },
        ].map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key as any); setSelected(new Set()) }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-[#1B2A45] text-white' : 'bg-white text-[#1B2A45]/60 border border-[#E8E2D4]'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── 통계 카드 ── */}
      {filter === 'morning' && morningReports.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs text-amber-700 font-bold mb-3">오전보고 누적 통계 ({morningReports.length}건)</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {([
              { label: '총 콜', value: morningStats.total_calls, rate: null, rateLabel: '' },
              { label: '연결안됨', value: morningStats.no_connect, rate: pct(morningStats.no_connect, morningStats.total_calls), rateLabel: '미연결율' },
              { label: '연결됨', value: morningStats.connected, rate: pct(morningStats.connected, morningStats.total_calls), rateLabel: '연결율' },
              { label: 'DB확보', value: morningStats.db_secured, rate: pct(morningStats.db_secured, morningStats.total_calls), rateLabel: '확보율' },
              { label: '아웃계약', value: morningStats.outbound_contracts, rate: pct(morningStats.outbound_contracts, morningStats.total_calls), rateLabel: '계약율' },
            ] as const).map(s => (
              <div key={s.label} className="bg-white rounded-lg p-2.5 text-center border border-amber-100">
                <p className="text-[10px] text-gray-400 mb-0.5">{s.label}</p>
                <p className="text-xl font-black text-amber-700">{s.value}<span className="text-xs font-normal text-gray-400">건</span></p>
                {s.rate !== null && (
                  <p className="text-[11px] font-semibold text-amber-500 mt-0.5">{s.rate} <span className="text-[10px] text-gray-400 font-normal">{s.rateLabel}</span></p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {filter === 'daily' && dailyReports.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-700 font-bold mb-3">마감보고 누적 통계 ({dailyReports.length}건)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: '누적 계약', value: dailyStats.today_contracts + '건', sub: null },
              { label: '이번달 계약', value: dailyStats.month_contracts + '건', sub: null },
              { label: '공급DB 결정', value: dailyStats.supply_decided + '건', sub: null },
              { label: '아웃바운딩 결정', value: dailyStats.outbound_decided + '건', sub: null },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-lg p-2.5 text-center border border-blue-100">
                <p className="text-[10px] text-gray-400 mb-0.5">{s.label}</p>
                <p className="text-xl font-black text-blue-700">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 삭제 툴바 — CEO만 */}
      {isCeo && filtered.length > 0 && (
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-2.5">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleAll}
              className="w-4 h-4 rounded" />
            전체선택
            {selected.size > 0 && <span className="text-xs text-gray-400">({selected.size}개 선택됨)</span>}
          </label>
          {selected.size > 0 && (
            <button onClick={deleteSelected} disabled={deleting}
              className="text-xs bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-lg transition-colors">
              {deleting ? '삭제 중...' : `${selected.size}건 삭제`}
            </button>
          )}
        </div>
      )}

      {/* 목록 — 날짜별 그룹핑 */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-12 text-center text-gray-400 text-sm">
          제출된 보고가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDates.map(date => {
            const dayItems = groupedByDate[date]
            const isToday = date === todayStr
            const morning = dayItems.filter((r:any) => r.report_type === 'morning')
            const daily   = dayItems.filter((r:any) => r.report_type === 'daily')
            // 전체 직원 이름 (모든 보고자)
            const names = [...new Set(dayItems.map((r:any) => r.user_name))] as string[]
            return (
              <div key={date} className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
                {/* 날짜 헤더 */}
                <div className={`px-4 py-2.5 flex items-center justify-between ${isToday ? 'bg-[#1B2A45]' : 'bg-[#FAF8F3]'}`}>
                  <div className="flex items-center gap-3">
                    {isToday && <span className="text-xs bg-[#C5A258] text-white px-2 py-0.5 rounded-full font-bold">오늘</span>}
                    <span className={`text-sm font-bold ${isToday ? 'text-white' : 'text-[#1B2A45]'}`}>
                      {date} ({['일','월','화','수','목','금','토'][new Date(date).getDay()]})
                    </span>
                    <div className="flex gap-1">
                      {morning.length > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">오전 {morning.length}건</span>}
                      {daily.length > 0   && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">마감 {daily.length}건</span>}
                    </div>
                  </div>
                  {isCeo && (
                    <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${isToday ? 'text-white/60' : 'text-gray-400'}`}>
                      <input type="checkbox"
                        checked={dayItems.every((r:any) => selected.has(r.id))}
                        onChange={() => {
                          const allSelected = dayItems.every((r:any) => selected.has(r.id))
                          setSelected(prev => {
                            const n = new Set(prev)
                            dayItems.forEach((r:any) => allSelected ? n.delete(r.id) : n.add(r.id))
                            return n
                          })
                        }}
                        className="w-3.5 h-3.5 rounded" />
                      전체
                    </label>
                  )}
                </div>
                {/* 직원별 요약 행 */}
                <div className="divide-y divide-[#E8E2D4]/40">
                  {names.map(name => {
                    const mr = morning.find((r:any) => r.user_name === name)
                    const dr = daily.find((r:any) => r.user_name === name)
                    const tc = Number(mr?.data?.total_calls || 0)
                    const cn = Number(mr?.data?.connected || 0)
                    const oc = Number(mr?.data?.outbound_contracts || 0)
                    const db = Number(mr?.data?.db_secured || 0)
                    return (
                      <div key={name} className={`px-4 py-3 flex items-center gap-2 ${selected.has(mr?.id||'') || selected.has(dr?.id||'') ? 'bg-red-50' : 'hover:bg-[#FAF8F3]'} transition-colors`}>
                        {isCeo && (
                          <div className="flex gap-1 shrink-0">
                            {mr && <input type="checkbox" checked={selected.has(mr.id)} onChange={() => toggleSelect(mr.id)} className="w-3.5 h-3.5 rounded" />}
                            {dr && <input type="checkbox" checked={selected.has(dr.id)} onChange={() => toggleSelect(dr.id)} className="w-3.5 h-3.5 rounded" />}
                          </div>
                        )}
                        {/* 이름 */}
                        <div className="w-20 shrink-0">
                          <span className="text-sm font-bold text-[#1B2A45]">{name}</span>
                        </div>
                        {/* 오전보고 요약 */}
                        <div className="flex-1 min-w-0">
                          {mr ? (
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-[10px] text-amber-600 font-bold">오전</span>
                              <span className="text-xs text-gray-600">콜 <b>{tc}</b></span>
                              <span className="text-xs text-gray-600">연결 <b className="text-amber-600">{cn}</b>{tc>0&&<span className="text-gray-400">({(cn/tc*100).toFixed(0)}%)</span>}</span>
                              <span className="text-xs text-gray-600">DB <b>{db}</b></span>
                              <span className="text-xs text-gray-600">계약 <b className="text-emerald-600">{oc}</b></span>
                              <button onClick={() => setViewReport(mr)} className="text-[10px] text-blue-500 hover:underline ml-auto shrink-0">상세</button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 italic">오전보고 미제출</span>
                          )}
                          {dr ? (
                            <div className="flex items-center gap-3 flex-wrap mt-0.5">
                              <span className="text-[10px] text-blue-600 font-bold">마감</span>
                              <span className="text-xs text-gray-600">당일 <b className="text-blue-600">{dr.data?.today_contracts||0}</b>건</span>
                              <span className="text-xs text-gray-600">월누적 <b>{dr.data?.month_contracts||0}</b>건</span>
                              <span className="text-xs text-gray-600">목표 <b>{dr.data?.goal||0}</b>건</span>
                              <button onClick={() => setViewReport(dr)} className="text-[10px] text-blue-500 hover:underline ml-auto shrink-0">상세</button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 italic mt-0.5 block">마감보고 미제출</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 상세보기 모달 */}
      {viewReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">
                  {viewReport.report_type === 'morning' ? '오전보고' : '마감보고'}
                </h3>
                <p className="text-xs text-gray-400">{viewReport.user_name} · {viewReport.report_date}</p>
              </div>
              <button onClick={() => setViewReport(null)} className="text-gray-400 hover:text-gray-700 text-lg">✕</button>
            </div>
            <div className="p-6">
              {viewReport.report_type === 'morning' ? (
                <MorningDetail data={viewReport.data} />
              ) : (
                <DailyDetail data={viewReport.data} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MorningDetail({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: '총 콜 수', value: data?.total_calls },
        { label: '연결안됨', value: data?.no_connect },
        { label: '연결됨', value: data?.connected },
        { label: 'DB확보 (결정업체)', value: data?.db_secured },
        { label: '아웃바운딩 계약', value: data?.outbound_contracts },
      ].map(f => (
        <div key={f.label} className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-400">{f.label}</p>
          <p className="text-xl font-black text-gray-900">{f.value || '0'}</p>
        </div>
      ))}
    </div>
  )
}

function DailyDetail({ data }: { data: any }) {
  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <div className="mb-4">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</h4>
      {children}
    </div>
  )

  return (
    <div className="space-y-4 text-sm">
      <Section title="계약 현황">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: '당일 계약', value: data?.today_contracts + '건' },
            { label: '이번달 누적', value: data?.month_contracts + '건' },
            { label: '월 목표', value: data?.goal + '건' },
            { label: '남은 목표', value: data?.goal && data?.month_contracts ? Math.max(0, Number(data.goal) - Number(data.month_contracts)) + '건' : '-' },
          ].map(f => (
            <div key={f.label} className="bg-gray-50 rounded-lg p-2.5">
              <p className="text-xs text-gray-400">{f.label}</p>
              <p className="text-lg font-black text-gray-900">{f.value}</p>
            </div>
          ))}
        </div>
      </Section>

      {[
        { key: 'supply_db', title: '공급DB 상담결과' },
        { key: 'outbound', title: '아웃바운딩 상담결과' },
      ].map(s => (
        <Section key={s.key} title={s.title}>
          {data?.[s.key] === null ? (
            <p className="text-gray-400 text-xs">해당 없음</p>
          ) : (data?.[s.key] || []).length === 0 ? (
            <p className="text-gray-400 text-xs">항목 없음</p>
          ) : (
            (data[s.key] as any[]).map((item: any, i: number) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">{item.company}</span>
                  {item.is_decided && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">결정</span>}
                </div>
                <p className="text-xs text-gray-500">{item.content}</p>
              </div>
            ))
          )}
        </Section>
      ))}

      <Section title="고민관리업체">
        {data?.worried === null ? <p className="text-gray-400 text-xs">해당 없음</p>
          : (data?.worried || []).length === 0 ? <p className="text-gray-400 text-xs">항목 없음</p>
          : (() => {
              const probOrder: Record<string, number> = { '상': 0, '중': 1, '하': 2 }
              const sorted = [...(data.worried as any[])].sort((a, b) =>
                (probOrder[a.probability] ?? 3) - (probOrder[b.probability] ?? 3)
              )
              const groups = ['상', '중', '하'] as const
              return groups.map(grade => {
                const items = sorted.filter((w: any) => w.probability === grade)
                if (items.length === 0) return null
                const gradeStyle = grade === '상' ? 'bg-red-100 text-red-700' : grade === '중' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                // 전체 sorted 기준으로 연번 계산
                return (
                  <div key={grade} className="mb-3">
                    <p className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mb-1.5 ${gradeStyle}`}>감도 {grade} ({items.length}건)</p>
                    {items.map((item: any) => {
                      const globalIdx = sorted.indexOf(item)
                      return (
                        <div key={globalIdx} className="bg-gray-50 rounded-lg p-3 mb-1.5 flex gap-2 items-start">
                          <span className="text-xs font-black text-gray-400 w-5 shrink-0 pt-0.5">{globalIdx + 1}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-semibold text-gray-800 text-sm">{item.company}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${gradeStyle}`}>{item.probability}</span>
                            </div>
                            {item.content && <p className="text-xs text-gray-600">{item.content}</p>}
                            {item.reason && <p className="text-xs text-gray-400 mt-0.5">사유: {item.reason}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })
            })()
        }
      </Section>

      <Section title="결정업체">
        {data?.decided === null ? <p className="text-gray-400 text-xs">해당 없음</p>
          : (data?.decided || []).length === 0 ? <p className="text-gray-400 text-xs">항목 없음</p>
          : (data.decided as any[]).map((item: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2">
              <span className="font-semibold text-gray-800 block mb-1">{item.company}</span>
              <p className="text-xs text-gray-500">{item.content}</p>
              <p className="text-xs text-blue-600 mt-1">현재: {item.current_progress}</p>
              <p className="text-xs text-emerald-600">다음: {item.next_action}</p>
            </div>
          ))
        }
      </Section>

      <Section title="미팅업체">
        {data?.meetings === null ? <p className="text-gray-400 text-xs">해당 없음</p>
          : (data?.meetings || []).length === 0 ? <p className="text-gray-400 text-xs">항목 없음</p>
          : (data.meetings as any[]).map((item: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2 grid grid-cols-2 gap-1 text-xs">
              <span className="font-semibold text-gray-800 col-span-2">{item.company}</span>
              <span className="text-gray-500">{item.date}</span>
              <span className="text-gray-500">{item.time}</span>
              <span className="text-gray-500 col-span-2">{item.location}</span>
            </div>
          ))
        }
      </Section>

      <Section title="입금대기 업체">
        {data?.payment_waiting === null ? <p className="text-gray-400 text-xs">해당 없음</p>
          : (data?.payment_waiting || []).length === 0 ? <p className="text-gray-400 text-xs">항목 없음</p>
          : (data.payment_waiting as any[]).map((item: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 mb-2 grid grid-cols-2 gap-1 text-xs">
              <span className="font-semibold text-gray-800 col-span-2">{item.company}</span>
              <span className="text-gray-500">대표: {item.ceo_name}</span>
              <span className="text-gray-500">{item.phone}</span>
              <span className="text-gray-500 col-span-2">첫콜: {item.first_call_date}</span>
            </div>
          ))
        }
      </Section>
    </div>
  )
}

// ─── AI 질문 로그 ────────────────────────────────────────
function AiLogsTab() {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ai-logs').then(r => r.json()).then(d => {
      setLogs(d.logs || [])
      setTotal(d.total || 0)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const filtered = search.trim()
    ? logs.filter(l => l.question?.includes(search) || l.answer?.includes(search))
    : logs

  return (
    <div className="space-y-4 pb-8">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-indigo-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-indigo-600">{total}</p>
          <p className="text-xs text-gray-500 mt-1">총 질문 수</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-amber-600">
            {logs.filter(l => {
              const d = new Date(l.created_at)
              const now = new Date()
              return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
            }).length}
          </p>
          <p className="text-xs text-gray-500 mt-1">오늘 질문</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-emerald-600">
            {new Set(logs.map(l => l.visitor_ip)).size}
          </p>
          <p className="text-xs text-gray-500 mt-1">방문자 수 (IP)</p>
        </div>
      </div>

      {/* 검색 */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="질문 또는 답변 내용 검색..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <span className="text-xs text-gray-400 shrink-0">{filtered.length}건</span>
      </div>

      {/* 로그 목록 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-4xl mb-3"></p>
          <p className="text-gray-400 text-sm">아직 홈페이지 AI 질문이 없습니다.</p>
          <p className="text-xs text-gray-300 mt-1">홈페이지 방문자가 AI에 질문하면 여기 저장됩니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filtered.map(log => (
              <div key={log.id} className="px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium shrink-0">Q</span>
                      <p className="text-sm font-medium text-gray-900 truncate">{log.question}</p>
                    </div>
                    {expanded !== log.id && (
                      <p className="text-xs text-gray-400 truncate pl-7">{log.answer}</p>
                    )}
                    {expanded === log.id && (
                      <div className="mt-3 pl-7 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5">A</span>
                          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{log.answer}</p>
                        </div>
                        <p className="text-[10px] text-gray-300 pl-7">IP: {log.visitor_ip}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-gray-400">
                      {new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-gray-300">{expanded === log.id ? '▲ 닫기' : '▼ 답변 보기'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AI 비서 ────────────────────────────────────────────
function AiTab() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMessage: Message = { role: 'user', parts: [{ text: input }] }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, history: messages }),
      })
      const data = await res.json()
      setMessages([...newMessages, {
        role: 'model',
        parts: [{ text: data.reply || ('오류: ' + (data.error || '알 수 없는 오류')) }],
      }])
    } catch {
      setMessages([...newMessages, { role: 'model', parts: [{ text: '서버 연결 오류가 발생했습니다.' }] }])
    } finally {
      setLoading(false)
    }
  }

  const suggestions = ['2024년 소상공인 정책자금 종류 알려줘', '정책자금 신청 시 필요한 서류는?', '기술보증기금과 신용보증기금 차이점']

  return (
    <div className="bg-white rounded-xl border border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">AI</span>
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">헌드레드 AI 비서</p>
          <p className="text-xs text-gray-400">정책자금 전문 · Gemini 3.1 Flash</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-8">
            <p className="text-gray-400 text-sm mb-6">무엇이든 물어보세요</p>
            <div className="flex flex-col gap-2 items-center">
              {suggestions.map((s) => (
                <button key={s} onClick={() => setInput(s)}
                  className="text-sm text-indigo-600 border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-colors max-w-xs">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
              msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              {msg.parts[0].text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={sendMessage} className="px-4 py-4 border-t border-gray-100">
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="정책자금, 고객 분석, 업무 관련 무엇이든..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading} />
          <button type="submit" disabled={loading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            전송
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── 공지사항 탭 ────────────────────────────────────────────
function NoticesTab() {
  const [notices, setNotices] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [targetTeam, setTargetTeam] = useState<'all' | 'sales' | 'ops'>('all')
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { loadNotices() }, [])

  async function loadNotices() {
    setLoading(true)
    try {
      const res = await fetch('/api/notices')
      const data = await res.json()
      setNotices((data.notices || []).filter((n: any) => n.notice_type !== 'supply_count'))
    } catch {}
    setLoading(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function handlePost(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setPosting(true)
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          notice_type: 'general',
          target_team: targetTeam,
          is_active: true,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTitle('')
        setContent('')
        setTargetTeam('all')
        const teamLabel = targetTeam === 'all' ? '전 직원' : targetTeam === 'sales' ? '영업팀' : '관리팀'
        showToast(`공지 등록 완료! ${teamLabel}에게 알림 발송됐습니다.`)
        loadNotices()
      } else {
        showToast(`${data.error || '등록 실패'}`)
      }
    } catch {
      showToast('네트워크 오류')
    }
    setPosting(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('이 공지를 삭제할까요?')) return
    await fetch(`/api/notices?id=${id}`, { method: 'DELETE' })
    loadNotices()
  }

  const teamLabel = (t: string) =>
    t === 'sales' ? '영업팀' : t === 'ops' ? '관리팀' : '전체'

  return (
    <div className="max-w-2xl mx-auto pb-20">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white bg-emerald-500">
          {toast}
        </div>
      )}

      {/* 공지 작성 폼 */}
      <div className="bg-white rounded-2xl border border-[#E8E2D4] p-5 mb-6 shadow-sm">
        <h2 className="text-base font-bold text-[#1B2A45] mb-1 flex items-center gap-2">
          새 공지사항 작성
        </h2>
        <p className="text-xs text-gray-400 mb-4">등록하면 대상 직원 핸드폰으로 즉시 알림이 발송됩니다</p>
        <form onSubmit={handlePost} className="space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="공지 제목 *"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258]"
            required
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="공지 내용 (선택)"
            rows={4}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A258] resize-none"
          />
          {/* 대상 선택 */}
          <div className="flex gap-2">
            {(['all', 'sales', 'ops'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTargetTeam(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  targetTeam === t
                    ? 'bg-[#1B2A45] text-white border-[#1B2A45]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {t === 'all' ? '전 직원' : t === 'sales' ? '영업팀만' : '관리팀만'}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={posting || !title.trim()}
            className="w-full bg-[#1B2A45] hover:bg-[#243860] disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            {posting ? '발송 중...' : '공지 등록 + 알림 발송'}
          </button>
        </form>
      </div>

      {/* 공지 목록 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500">공지 내역</h3>
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
        ) : notices.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">등록된 공지가 없습니다</p>
        ) : (
          notices.map(n => (
            <div key={n.id} className="bg-white rounded-xl border border-[#E8E2D4] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-semibold text-[#1B2A45] truncate">{n.title}</p>
                  <span className="shrink-0 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                    {teamLabel(n.target_team)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-gray-400">
                    {new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="text-gray-300 hover:text-red-400 text-xs transition-colors"
                  >✕</button>
                </div>
              </div>
              {n.content && <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{n.content}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
