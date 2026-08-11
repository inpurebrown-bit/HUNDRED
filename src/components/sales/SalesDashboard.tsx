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
import PullToRefresh from '@/components/ui/PullToRefresh'
import SplitView from '@/components/shared/SplitView'
import {
  getBusinessDaysInMonth,
  getElapsedBusinessDays,
  getRemainingBusinessDays,
} from '@/lib/businessDays'
import { SUPPLY_RATE_TABLE, calcRecommendedSupply, isActiveRow, contractWeight } from '@/lib/supplyRules'
import SalesScheduleTab from './SalesScheduleTab'

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

// All sales users for assignee dropdown (legacy — replaced by dynamic salesUserNames)
const SALES_USERS: string[] = []

type SalesTab = 'board' | 'db010' | 'customers' | 'contracted' | 'emotional' | 'trash' | 'revenue' | 'report' | 'schedule' | 'profile'

// ── Component ──────────────────────────────────────────────────────────
export default function SalesDashboard({ userId, userName, username }: Props) {
  const [activeTab, setActiveTab] = useState<SalesTab>('board')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [opsStatusMap, setOpsStatusMap] = useState<Record<string, { stage: string; institution?: string; memo?: string; is_refund?: boolean; is_completed?: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [db010GroupBy, setDb010GroupBy] = useState<'date' | 'mood'>('date')
  const [emotionalGroupBy, setEmotionalGroupBy] = useState<'date' | 'mood'>('mood')
  // ── 메모장 ──────────────────────────────────────────────────────────────
  const [notepadOpen, setNotepadOpen] = useState(false)
  const [notepadOpacity, setNotepadOpacity] = useState(90)
  const [notepadSize, setNotepadSize] = useState({ w: 300, h: 480 })
  const [notepadInput, setNotepadInput] = useState('')
  const [addPeriod, setAddPeriod] = useState<'today' | 'week' | 'month'>('today')
  const [memoText, setMemoText] = useState(() => {
    if (typeof window !== 'undefined') {
      try { return localStorage.getItem('notepad-memo') || '' } catch { return '' }
    }
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
  const [todos, setTodos] = useState<{id: string; text: string; checked: boolean; period: 'today' | 'week' | 'month'}[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('daily-todos') || '[]')
        return saved.map((t: any) => ({ ...t, period: t.period || 'today' }))
      } catch { return [] }
    }
    return []
  })
  function saveTodos(next: typeof todos) {
    setTodos(next)
    if (typeof window !== 'undefined') localStorage.setItem('daily-todos', JSON.stringify(next))
  }
  function addTodo(text: string, period: 'today' | 'week' | 'month' = 'today') {
    if (!text.trim()) return
    saveTodos([...todos, { id: Date.now().toString(), text: text.trim(), checked: false, period }])
    setNotepadInput('')
  }
  function toggleTodo(id: string) {
    saveTodos(todos.map(t => t.id === id ? { ...t, checked: !t.checked } : t))
  }
  function deleteTodo(id: string) {
    saveTodos(todos.filter(t => t.id !== id))
  }
  const [supplyConfig, setSupplyConfig] = useState<Record<string, { supplied: number; goal: number; base: number }> | null>(null)
  const [ceoPayRate, setCeoPayRate] = useState<number | null>(null)
  // 대표 결제율 현황 - 내 직원 행 전체
  const [myPayrateRow, setMyPayrateRow] = useState<{
    target: number; supply_count: number; supply_payment: number
    direct_count: number; direct_payment: number; daily_supplies?: Record<string, number>
  } | null>(null)
  const [goalEditOpen, setGoalEditOpen] = useState(false)
  const [goalEditValue, setGoalEditValue] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([])

  async function saveGoal() {
    const num = parseInt(goalEditValue)
    if (isNaN(num) || num < 0) return
    setGoalSaving(true)
    await fetch('/api/supply-config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selfGoal: num }),
    })
    // 로컬 state 즉시 반영
    setSupplyConfig(prev => prev
      ? { ...prev, [userName]: { ...(prev[userName] || { supplied: 0, base: 0 }), goal: num } }
      : { [userName]: { supplied: 0, goal: num, base: 0 } }
    )
    setGoalSaving(false)
    setGoalEditOpen(false)
  }

  // 영업팀 실제 이름 목록 (DB 트레이드용)
  const [salesUserNames, setSalesUserNames] = useState<string[]>([])
  // 관리팀 직원 목록 (전송 담당자 배정용)
  const [opsUserList, setOpsUserList] = useState<{ id: string; name: string }[]>([])
  // 자금팀 전송 모달 상태
  const [opsTransferModal, setOpsTransferModal] = useState<{ customer: Customer | null; opsUserId: string; opsUserName: string; contractType: string }>({
    customer: null, opsUserId: '', opsUserName: '', contractType: '일반',
  })
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installable, setInstallable] = useState(false)
  const [expandedNoticeId, setExpandedNoticeId] = useState<string | null>(null)

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
  const [splitActive, setSplitActive] = useState(false)
  const [scrollToCustomerId, setScrollToCustomerId] = useState<string | undefined>(undefined)

  // New customer form state
  const [showNewForm, setShowNewForm] = useState(false)

  // 010DB form state
  const [show010Form, setShow010Form] = useState(false)

  // ── Data loading ──────────────────────────────────────────────────
  async function loadAll() {
    setLoading(true)
    const [cRes, conRes, nRes, scRes] = await Promise.all([
      fetch('/api/customers'),
      fetch('/api/contracts'),
      fetch('/api/notices?team=sales&_t=' + Date.now()),
      fetch('/api/supply-config'),
    ])
    const [cData, conData, nData, scData] = await Promise.all([cRes.json(), conRes.json(), nRes.json(), scRes.json()])
    const loadedCustomers: Customer[] = cData.customers || []
    setCustomers(loadedCustomers)
    setContracts(conData.contracts || [])
    setNotices(nData.notices || [])
    const thisMonth = new Date().toISOString().slice(0, 7)
    if (scData.config?.month === thisMonth) {
      setSupplyConfig(scData.config.people || {})
    }

    // 자금팀 전송된 고객들의 진행현황 조회
    const transferredIds = loadedCustomers
      .filter((c: any) => c.details?.ops_transferred)
      .map((c: any) => c.id)
      .filter(Boolean)
    if (transferredIds.length > 0) {
      const osRes = await fetch(`/api/ops-status?ids=${transferredIds.join(',')}`)
      if (osRes.ok) {
        const osData = await osRes.json()
        const map: Record<string, { stage: string; institution?: string; memo?: string; is_refund?: boolean; is_completed?: boolean }> = {}
        for (const s of (osData.statuses || [])) {
          if (s.customer_id) map[s.customer_id] = s
        }
        setOpsStatusMap(map)
      }
    } else {
      setOpsStatusMap({})
    }

    // 2주 일정 미리보기 로드
    try {
      const now = new Date()
      const evRes = await fetch(`/api/events?year=${now.getFullYear()}&month=${now.getMonth() + 1}`)
      const evData = await evRes.json()
      const today = now.toISOString().slice(0, 10)
      const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
      const mine = (evData.events || [])
        .filter((e: any) => e.created_by === userName && e.start_date >= today && e.start_date <= twoWeeks)
        .sort((a: any, b: any) => (a.start_date + (a.start_time || '')).localeCompare(b.start_date + (b.start_time || '')))
      setUpcomingEvents(mine)
    } catch {}

    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    function onVisible() {
      if (document.visibilityState === 'visible') loadAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', loadAll)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', loadAll)
    }
  }, [])

  // ── 대표 결제율 현황 불러오기 ──────────────────────────────────────────────
  useEffect(() => {
    async function loadPayRate() {
      try {
        const res = await fetch('/api/payrate')
        if (!res.ok) return
        const json = await res.json()
        const record = json.record
        if (!record?.employee_details) return
        // 이름 매칭 (수석팀장 등 타이틀 제거 후 비교)
        const cleanName = (s: string) => s.replace(/\s*(수석팀장|팀장|팀원|대리|과장|부장).*/, '').trim()
        const row = record.employee_details.find((e: any) =>
          cleanName(e.name || '') === cleanName(userName)
        )
        if (!row) return
        setMyPayrateRow(row)
        // 기존 결제율 계산 (공급수 기반)
        const ds = row.daily_supplies || {}
        const supCnt = Object.values(ds).reduce((s: number, v: any) => s + Number(v || 0), 0)
        if (supCnt > 0) {
          const rate = (Number(row.supply_payment) + Number(row.direct_payment)) / supCnt * 100
          setCeoPayRate(Math.round(rate * 100) / 100)
        }
      } catch {}
    }
    loadPayRate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName])

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
    const customer = customers.find(c => c.id === id)
    if (!customer) return
    const d = (customer.details as any) || {}
    const company = d.company || customer.name || '해당 업체'
    if (d.delete_requested) {
      showToast('이미 대표님께 삭제 요청이 전송됐습니다. 승인 대기 중입니다.', 'error')
      return
    }
    const reason = window.prompt(`"${company}" 삭제를 대표님께 요청합니다.\n\n사유를 입력해주세요 (선택사항):`, '')
    if (reason === null) return
    const todayIso = new Date().toISOString().slice(0, 10)
    await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        details: {
          delete_requested: true,
          delete_reason: reason.trim() || '사유 없음',
          delete_requested_by: userName,
          delete_requested_at: todayIso,
        },
      }),
    })
    setCustomers(prev => prev.map(c => c.id === id
      ? { ...c, details: { ...(c.details || {}), delete_requested: true, delete_reason: reason.trim() || '사유 없음', delete_requested_by: userName, delete_requested_at: todayIso } }
      : c
    ))
    showToast('대표님께 삭제 요청을 전송했습니다.')
  }, [customers, userName, showToast])

  // 직가DB 전용 삭제요청 — 대표 승인 후 삭제
  const requestDeleteDb010 = useCallback(async (id: string) => {
    const customer = customers.find(c => c.id === id)
    if (!customer) return
    const d = (customer.details as any) || {}
    const company = d.company || customer.name || '해당 업체'

    if (d.delete_requested) {
      showToast('이미 대표님께 삭제 요청이 전송됐습니다. 승인 대기 중입니다.', 'error')
      return
    }

    const reason = window.prompt(
      `"${company}" 직가DB 삭제를 대표님께 요청합니다.\n\n사유를 입력해주세요 (선택사항):`,
      ''
    )
    if (reason === null) return // 취소

    const todayIso = new Date().toISOString().slice(0, 10)
    await fetch(`/api/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        details: {
          delete_requested: true,
          delete_request_reason: reason.trim(),
          delete_requested_at: todayIso,
          delete_requested_by: userName,
        },
      }),
    })
    setCustomers(prev => prev.map(c => c.id === id
      ? { ...c, details: { ...(c.details || {}), delete_requested: true, delete_request_reason: reason.trim(), delete_requested_at: todayIso, delete_requested_by: userName } }
      : c
    ))
    showToast(`📨 "${company}" 삭제 요청이 대표님께 전달됐습니다`)
  }, [customers, userName, showToast])

  const updateCustomer = useCallback(async (id: string, patch: Record<string, any>) => {
    await patchCustomer(id, patch)
  }, [patchCustomer])

  // 내부 실제 전송 함수 (owner_id 포함)
  const doTransferToOps = useCallback(async (customer: Customer, opsUserId?: string, opsUserName?: string, contractType?: string) => {
    const details: any = customer.details || {}
    const memo = [
      details.company && `업체: ${details.company}`,
      details.contract_fee && `계약금: ${details.contract_fee}`,
      details.payment_amount && `입금액: ${details.payment_amount}`,
      details.unpaid_amount && `미입금: ${details.unpaid_amount}`,
      details.commission_rate && `수수료율: ${details.commission_rate}`,
      details.tax_invoice && `세금계산서: ${details.tax_invoice}`,
    ].filter(Boolean).join(' / ')

    const anyDetails = details as any
    const revenue = parseInt(String(anyDetails.my_revenue || '0').replace(/[^0-9]/g, ''), 10) || 0

    const salesTimeline = ((customer as any).call_timeline || []).map((e: any) => ({
      ...e,
      source: 'sales',
    }))

    // ops_case 먼저 생성, 성공하면 ops_transferred 플래그 설정
    const opsRes = await fetch('/api/ops-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: (anyDetails.company as string) || customer.company || customer.name || '',
        phone: customer.phone || '',
        stage: '서류받는중',
        memo,
        revenue,
        owner_id: opsUserId || null,
        ops_user_name: opsUserName || null,
        timeline: salesTimeline.length > 0 ? salesTimeline : undefined,
        customer_id: customer.id,
        details: {
          // 계약 타입
          contract_type: contractType || '일반',
          ...(contractType === '월정기권' ? { monthly_fee: 100000, monthly_months: 12, monthly_total: 1200000 } : {}),
          // 영업팀 세금계산서/결제방식 → 관리팀 착수금 섹션으로 직접 반영
          tax_invoice: anyDetails.tax_invoice === '발급' ? '희망' : anyDetails.tax_invoice === '미발급' ? '미희망' : undefined,
          has_cash: anyDetails.has_cash || false,
          has_card: anyDetails.has_card || false,
          // 카드결제는 자동신고 → 착수금 세금계산서 발급완료 자동 처리
          ...(anyDetails.has_card ? { tax_invoice_completed: true } : {}),
          // 영업팀 계약날짜 → 관리팀 계약날짜로 전달
          ...(anyDetails.contract_date ? { contract_date: anyDetails.contract_date } : {}),
          sales_customer_info: {
            customer_id:      customer.id,
            company:          (anyDetails.company as string) || customer.company || customer.name || '',
            representative:   customer.name || '',
            phone:            customer.phone || '',
            sales_user_name:  anyDetails.sales_user_name || opsUserName || '',
            region:           anyDetails.region || '',
            reception_date:   anyDetails.reception_date || '',
            created_at:       (customer as any).created_at || '',
            business_type:    anyDetails.business_type || '',
            real_work:        anyDetails.real_work || '',
            years_in_business:anyDetails.years_in_business || anyDetails.biz_size || '',
            employee_count:   anyDetails.employee_count || '',
            innovation:       anyDetails.innovation || '',
            // 대출 현황
            loan_history:     customer.loan_history || anyDetails.loan_history || '',
            loan_kibo:        anyDetails.loan_kibo   || anyDetails.loan_policy || '',
            loan_shinbo:      anyDetails.loan_shinbo  || '',
            loan_jaedan:      anyDetails.loan_jaedan  || '',
            loan_jinjong:     anyDetails.loan_jinjong || '',
            loan_sojin:       anyDetails.loan_sojin   || '',
            loan_other:       anyDetails.loan_other   || anyDetails.loan_credit || '',
            loan_total:       anyDetails.loan_total   || '',
            // 신용 / 재무
            credit_kcb:       anyDetails.credit_kcb   || anyDetails.credit_score || '',
            credit_nice:      anyDetails.credit_nice  || '',
            tax_status:       anyDetails.tax_status   || anyDetails.tax_delinquency || '',
            assets:           anyDetails.assets        || '',
            revenue_2026:     anyDetails.revenue_2026  || '',
            revenue_2025:     anyDetails.revenue_2025  || '',
            revenue_2024:     anyDetails.revenue_2024  || '',
            revenue_2023:     anyDetails.revenue_2023  || '',
            required_funds:   anyDetails.required_funds || '',
            solution:         anyDetails.solution       || '',
            // 결과
            call_result:      anyDetails.call_result    || '',
            closing_result:   anyDetails.closing_result || '',
            subcall_date:     anyDetails.subcall_date   || '',
            // 영업팀 계약 정보 → 관리팀 기타재무에 표시
            contract_fee:     anyDetails.contract_fee    || '',
            commission_rate:  anyDetails.commission_rate || '',
            payment_amount:   anyDetails.payment_amount  || '',
            unpaid_amount:    anyDetails.unpaid_amount   || '',
            tax_invoice:      anyDetails.tax_invoice     || '',
            no_refund:        anyDetails.no_refund       || false,
          }
        },
      }),
    })

    if (!opsRes.ok) {
      const errData = await opsRes.json().catch(() => ({}))
      alert(`자금팀 전송 실패: ${errData.error || opsRes.status}\n다시 시도해주세요.`)
      return
    }

    // ops_case 생성 성공 후 전송 완료 플래그 설정
    await patchCustomer(customer.id, { details: { ops_transferred: true } })
    await loadAll()
  }, [patchCustomer])

  // transferToOps — 관리팀 직원 목록이 있으면 담당자 선택 모달 표시
  const transferToOps = useCallback(async (customer: Customer) => {
    // 계약완료 모달에서 저장한 contract_type 자동 읽기 (없으면 '일반')
    const savedType = (customer as any).details?.contract_type === '월정기권' ? '월정기권' : '일반'
    if (opsUserList.length > 0) {
      setOpsTransferModal({ customer, opsUserId: '', opsUserName: '', contractType: savedType })
    } else {
      // ops 직원 없으면 미배정으로 바로 전송
      await doTransferToOps(customer, undefined, undefined, savedType)
    }
  }, [opsUserList, doTransferToOps])

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
        loan_kibo: rest.loan_kibo || rest.loan_policy || '',
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
        // 직가DB 등록 시 등록월 + 직가 플래그 영구 기록 (거절/삭제/계약 후에도 직가 카운팅 유지)
        ...(status === 'db010' ? { db010_month: new Date().toISOString().slice(0, 7), is_direct: true } : {}),
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
        showToast(`"${data.company || data.name}" 고객 DB 등록 완료`)
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
        showToast(`"${data.company || data.name}" 직가DB 등록 완료`)
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

  const yr = now.getFullYear()
  const mo = now.getMonth()
  const dayOfMonth = now.getDate()
  const bizTotal = getBusinessDaysInMonth(yr, mo)
  const bizElapsed = getElapsedBusinessDays(yr, mo, dayOfMonth)
  const bizRemaining = getRemainingBusinessDays(yr, mo, dayOfMonth)

  // ── 공급 설정 기반 통계 ──────────────────────────────────
  const mySupplyCfg = supplyConfig?.[userName] ?? null

  // 이번달 계약: contract_date 기준으로만 (created_at 폴백 없음 → 월 혼입 방지)
  const thisMonthContracted = customers.filter(c =>
    c.status === 'contracted' &&
    (c.sales_user_name === userName || (c as any).details?.sales_user_name === userName) &&
    ((c as any).details?.contract_date || '').slice(0, 7) === thisMonth
  )
  // 가중 계약수 (부가세미포함 기준)
  const myDbContracted = thisMonthContracted.reduce(
    (sum, c) => sum + contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included), 0
  )
  const myTotalContracted = mySupplyCfg ? (Number(mySupplyCfg.base) || 0) + myDbContracted : myDbContracted

  // 월 목표: supply_config.goal 우선, 없으면 MONTHLY_GOALS 폴백
  const monthlyGoal = mySupplyCfg?.goal ?? MONTHLY_GOALS[username] ?? 30
  // 달성률은 가중 계약수 기준
  const monthContractCount = myTotalContracted

  const supplyNotice = notices.find(n => n.notice_type === 'supply_count')
  const todaySupply = supplyNotice ? parseInt(supplyNotice.content) || 0 : 0

  // displayCfg: 공급설정 없으면 기본값 — 두 유저 동일 뷰 보장
  const displayCfg = mySupplyCfg ?? { supplied: todaySupply, goal: monthlyGoal, base: 0 }
  // floor(소수점 2자리 버림) — 반올림 시 12.999...→13.00이 되어 공급 오계산 방지
  const contractRate = displayCfg.supplied > 0
    ? Math.floor(myTotalContracted / displayCfg.supplied * 10000) / 100
    : 0
  const tomorrowSupplyNeeded = calcRecommendedSupply(contractRate, bizElapsed)

  const achievementRate = Math.min(100, Math.round(monthContractCount / monthlyGoal * 100))
  const remaining = Math.max(0, monthlyGoal - monthContractCount)
  const dailyPaceNeeded = bizRemaining > 0 ? (remaining / bizRemaining).toFixed(1) : '0'
  const onPaceCount = bizTotal > 0 ? Math.round((monthlyGoal / bizTotal) * bizElapsed) : 0
  const isAhead = monthContractCount >= onPaceCount

  // ── 영업팀 이름 목록: DB users 테이블 role=sales 기준 (3명 고정) ────
  useEffect(() => {
    fetch('/api/users?role=sales')
      .then(r => r.json())
      .then(d => {
        const names: string[] = (d.users || []).map((u: any) => u.name).filter(Boolean)
        if (!names.includes(userName)) names.push(userName)
        setSalesUserNames(names)
      })
      .catch(() => {
        const names = Array.from(new Set(
          customers.map((c: any) => c.details?.sales_user_name || c.sales_user_name).filter(Boolean)
        )) as string[]
        if (!names.includes(userName)) names.push(userName)
        setSalesUserNames(names)
      })
  }, [userName])

  // 관리팀 직원 목록 로드
  useEffect(() => {
    fetch('/api/users?role=ops')
      .then(r => r.json())
      .then(d => setOpsUserList(d.users || []))
      .catch(() => {})
  }, [])

  // ── Filtered lists ────────────────────────────────────────────────
  const db010List = customers.filter(c => c.status === 'db010')
  const db010PendingDelete = db010List.filter(c => !!(c as any).details?.delete_requested)
  const activeCustomers = customers.filter(c => ['lead', 'consulting'].includes(c.status))
  const contractedCustomers = customers.filter(c => c.status === 'contracted')
  const emotionalCustomers = customers.filter(c => c.status === 'emotional')
  const trashCustomers = customers.filter(c => c.status === 'trash' && !(c as any).details?.employee_deleted)
  const deletedCustomers = customers.filter(c => c.status === 'trash' && !!(c as any).details?.employee_deleted)
  // 매출: 계약 상태인 모든 고객 (ops 전송 여부 무관)
  const revenueCustomers = customers.filter(c => c.status === 'contracted')

  const generalNotices = notices.filter(n => n.notice_type !== 'supply_count' && n.notice_type !== 'supply_config')

  // 오늘 재통화 예정 고객 (전체 탭 통합)
  const todayStr2 = new Date().toISOString().slice(0, 10)
  const todayCallbackCustomers = customers.filter(c => (c as any).details?.follow_up_date === todayStr2)

  // ── 검색 ────────────────────────────────────────────────────────────
  const STATUS_TAB: Record<string, SalesTab> = {
    db010: 'db010', lead: 'customers', consulting: 'customers',
    contracted: 'contracted', emotional: 'emotional', trash: 'trash',
  }
  const STATUS_LABEL: Record<string, string> = {
    db010: '직가DB', lead: '공가DB', consulting: '공가DB',
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

  // ── 매출 집계 ──────────────────────────────────────────────
  function pNum(s: string | number | undefined) {
    return parseInt(String(s || '0').replace(/[^0-9]/g, ''), 10) || 0
  }
  function fmtWon(n: number) {
    if (n <= 0) return '—'
    if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억'
    if (n >= 10000) return Math.round(n / 10000) + '만원'
    return n.toLocaleString() + '원'
  }

  // 이번달 매출 집계 (contract_date 기준)
  const thisMonthRevenue = revenueCustomers.filter(c =>
    !c.details?.is_cancelled &&
    ((c as any).details?.contract_date || '').slice(0, 7) === thisMonth
  )
  const thisMonthTotalRevenue = thisMonthRevenue.reduce((sum, c) => sum + pNum((c as any).details?.my_revenue), 0)
  const thisMonthTotalPaid    = thisMonthRevenue.reduce((sum, c) => sum + pNum((c as any).details?.payment_amount), 0)
  const thisMonthContractCount = thisMonthRevenue.reduce((sum, c) => sum + contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included), 0)

  // 전체 합계
  const totalRevenue = revenueCustomers
    .filter(c => !c.details?.is_cancelled)
    .reduce((sum, c) => sum + pNum((c as any).details?.my_revenue), 0)
  const cancelledCount = revenueCustomers.filter(c => c.details?.is_cancelled).length

  // 월별 그룹 (계약일 기준 내림차순)
  const revenueByMonth = (() => {
    const sorted = [...revenueCustomers].sort((a, b) => {
      const da = (a as any).details?.contract_date || ''
      const db2 = (b as any).details?.contract_date || ''
      return db2.localeCompare(da)
    })
    const groups: Record<string, typeof sorted> = {}
    for (const c of sorted) {
      const month = ((c as any).details?.contract_date || '').slice(0, 7) || '날짜미입력'
      if (!groups[month]) groups[month] = []
      groups[month].push(c)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  })()

  // ── Tabs ──────────────────────────────────────────────────────────
  const tabs: { key: SalesTab; label: string; count?: number }[] = [
    { key: 'board',      label: '메인보드' },
    { key: 'db010',      label: '직가DB',      count: db010List.length },
    { key: 'customers',  label: '공가DB',       count: activeCustomers.length },
    { key: 'contracted', label: '계약 업체',   count: contractedCustomers.length },
    { key: 'emotional',  label: '감성톡',      count: emotionalCustomers.length },
    { key: 'trash',      label: '자체거절',    count: trashCustomers.length },
    { key: 'revenue',    label: '매출',        count: revenueCustomers.length },
    { key: 'report',     label: '보고' },
    { key: 'schedule',   label: '일정' },
    { key: 'profile',    label: '사원정보' },
  ]

  // ── Render ────────────────────────────────────────────────────────
  return (
    <PullToRefresh onRefresh={loadAll}>
    <div className="min-h-screen page-bg">
      {splitActive && <SplitView onClose={() => setSplitActive(false)} />}
      {/* ── 자금팀 전송 담당자 선택 모달 ── */}
      {opsTransferModal.customer && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpsTransferModal({ customer: null, opsUserId: '', opsUserName: '', contractType: '일반' }) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-[#1B2A45] text-sm">관리팀 담당자 배정</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">{(opsTransferModal.customer as any).details?.company || opsTransferModal.customer.company || opsTransferModal.customer.name}</p>
              </div>
              <button onClick={() => setOpsTransferModal({ customer: null, opsUserId: '', opsUserName: '', contractType: '일반' })}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* 계약 타입 선택 */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">계약 타입</p>
                <div className="flex gap-2">
                  {(['일반', '월정기권'] as const).map(type => (
                    <button key={type}
                      onClick={() => setOpsTransferModal(p => ({ ...p, contractType: type }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        opsTransferModal.contractType === type
                          ? type === '월정기권'
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                      }`}>
                      {type}
                      {type === '월정기권' && <span className="block text-[10px] font-normal opacity-80">10만×12개월</span>}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 font-medium">담당 관리팀 직원을 선택하세요</p>
              <div className="flex flex-wrap gap-2">
                {opsUserList.filter(u => u.name !== 'ops-tester').map(u => (
                  <button key={u.id}
                    onClick={() => setOpsTransferModal(p => ({ ...p, opsUserId: u.id, opsUserName: u.name }))}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                      opsTransferModal.opsUserId === u.id
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                    }`}>
                    {u.name}
                  </button>
                ))}
              </div>
              {opsUserList.filter(u => u.name !== 'ops-tester').length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">등록된 관리팀 직원이 없습니다</p>
              )}
            </div>
            <div className="px-5 pb-4 flex gap-2 relative">
              <button onClick={() => setOpsTransferModal({ customer: null, opsUserId: '', opsUserName: '', contractType: '일반' })}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                취소
              </button>
              <button
                onClick={async () => {
                  const { customer, opsUserId, opsUserName, contractType } = opsTransferModal
                  if (!customer || !opsUserId) return
                  setOpsTransferModal({ customer: null, opsUserId: '', opsUserName: '', contractType: '일반' })
                  await doTransferToOps(customer, opsUserId, opsUserName, contractType)
                  showToast('자금팀 전송 완료')
                }}
                disabled={!opsTransferModal.opsUserId}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {opsTransferModal.opsUserId ? `${opsTransferModal.opsUserName}에게 전송` : '담당자 선택 필요'}
              </button>
            </div>
            {/* 테스터 — 우측 하단 작게 */}
            <div className="flex justify-end px-5 pb-4">
              {opsUserList.filter(u => u.name === 'ops-tester').map(u => (
                <button key={u.id}
                  onClick={() => setOpsTransferModal(p => ({ ...p, opsUserId: u.id, opsUserName: u.name }))}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                    opsTransferModal.opsUserId === u.id
                      ? 'bg-gray-400 text-white border-gray-400'
                      : 'text-gray-300 border-gray-200 hover:text-gray-500'
                  }`}>
                  테스터
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 토스트 알림 ── */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white transition-all animate-bounce-once max-w-sm text-center ${
          toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-[#1B2A45] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
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
              className="bg-white/10 text-white placeholder-white/40 text-xs px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:bg-white/20 w-32 md:w-44"
            />
            {searchQuery.length >= 1 && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs">✕</button>
            )}
            {/* 검색 결과 드롭다운 */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 w-80 max-h-80 overflow-y-auto">
                <p className="text-[10px] text-gray-400 px-3 pt-2.5 pb-1 font-semibold">{searchResults.length}건 검색됨</p>
                {searchResults.map(c => (
                  <button key={c.id}
                    onClick={() => {
                      const tab = STATUS_TAB[c.status] ?? 'customers'
                      setActiveTab(tab)
                      setScrollToCustomerId(c.id)
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
          {/* 창분할 버튼 */}
          <button
            onClick={() => setSplitActive(true)}
            className="text-[11px] px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap font-medium hidden md:block text-white/50 hover:text-white hover:bg-white/10"
            title="창 분할 — 화면을 두 패널로 나눠서 독립적으로 사용">
            ⊞ 분할
          </button>
          {/* 메모장 버튼 */}
          <button
            onClick={() => setNotepadOpen(v => !v)}
            className={`text-[11px] px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap font-medium ${notepadOpen ? 'bg-[#C5A258]/80 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
            title="메모장">
            메모
          </button>
          {/* 홈으로 */}
          <button
            onClick={() => setActiveTab('board')}
            className="text-white/50 hover:text-white text-[11px] px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap hidden md:block font-medium">
            홈
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

      {/* ── 데스크탑 탭바 ── */}
      <div className="hidden md:flex bg-white border-b border-gray-200 sticky top-[52px] z-20 px-6 overflow-x-auto shadow-sm">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-3 text-sm whitespace-nowrap shrink-0 transition-colors font-medium flex items-center gap-1.5 ${
              activeTab === tab.key ? 'text-[#1B2A45]' : 'text-[#1B2A45]/45 hover:text-[#1B2A45]/75'
            }`}>
            {tab.label}
            {tab.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === tab.key ? 'bg-[#1B2A45] text-white' : 'bg-gray-100 text-gray-500'
              }`}>{tab.count}</span>
            )}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#C5A258] rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="px-4 md:px-6 py-5 max-w-5xl mx-auto">

        {/* ══════════ 메인보드 ══════════ */}
        {activeTab === 'board' && (
          <div className="space-y-4">
            {/* ── 이번달 공급 현황 (분석 대시보드) ── */}
            {(() => {
              const pr = myPayrateRow
              const ds = pr?.daily_supplies || {}
              const supCnt    = Object.values(ds).reduce((s: number, v: any) => s + Number(v || 0), 0)
              // 공급결제: 공가 출신 계약 완료 건 실시간 집계 (dirPayAuto 방식 동일)
              // 직가 여부 판단 (db010 상태 OR db010_month 기록 OR is_direct 플래그)
              const isDirectFn = (c: any) =>
                c.status === 'db010' || !!c.details?.db010_month || !!c.details?.is_direct
              const supPayAuto = customers
                .filter(c => {
                  const cMonth = ((c as any).details?.contract_date || '').slice(0, 7)
                  return !isDirectFn(c) && c.status === 'contracted' && cMonth === thisMonth
                })
                .reduce((sum, c) => sum + contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included), 0)
              // 공급결제/직접결제 항상 DB 실시간값 사용 (stored 폴백 제거 — 직가↔공가 전환이 즉시 반영)
              const supPay = supPayAuto
              // 직접수: 저장된 값 말고 customers DB에서 이번달 db010 실시간 카운트
              // 직접수: db010_month(신규) 또는 is_direct 플래그 기준 — 거절/삭제 이동 후에도 카운트 유지
              // ⚡ reception_date는 통화접수일(지난달 가능)이므로 폴백에서 제외 → created_at 기준으로만 판단
              const dirCntAuto = customers.filter(c => {
                const regMonth = (c as any).details?.db010_month
                  || ((c as any).created_at || '').slice(0, 7)
                return isDirectFn(c) && regMonth === thisMonth && !(c as any).details?.direct_count_voided
              }).length
              // 직접결제: customers DB에서 직가 출신 계약 완료 건 실시간 집계
              const dirPayAuto = customers
                .filter(c => {
                  const contractMonth = ((c as any).details?.contract_date || (c as any).created_at || '').slice(0, 7)
                  return isDirectFn(c) && c.status === 'contracted' && contractMonth === thisMonth
                })
                .reduce((sum, c) => sum + contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included), 0)
              const dirCnt    = dirCntAuto  // DB 실시간
              const dirPay    = dirPayAuto  // DB 실시간
              const target    = Number(monthlyGoal)
              const total     = supPay + dirPay
              const supRate   = supCnt > 0 ? (supPay / supCnt * 100) : null
              const dirRate   = dirCnt > 0 ? (dirPay / dirCnt * 100) : null
              // 총결제율 = 총계약수(공가+직가) / 공급갯수 × 100
              const totRate   = supCnt > 0 ? (total / supCnt * 100) : null
              const needed    = Math.max(0, target - total)
              // 공급예정: 총결제율 기준 권장 공급 수
              const dailyRec  = totRate !== null ? calcRecommendedSupply(totRate, bizElapsed) : 0
              const supStopped = supRate !== null && dailyRec === 0
              const achievePct = target > 0 ? Math.min(100, Math.round(total / target * 100)) : 0
              const fmtV = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1)
              const fmtP = (v: number | null) => v !== null ? v.toFixed(1) + '%' : '—'
              // 결제율 등급 — top: 최상 기준값, 5% 구간씩 단계 내려감
              const rateGrade = (rate: number | null, top: number) => {
                if (rate === null) return { label: null, numCls: 'text-gray-400' }
                if (rate >= top)        return { label: <span className="text-blue-500 font-bold">최상</span>,      numCls: 'text-blue-700' }
                if (rate >= top - 5)    return { label: <span className="text-cyan-500 font-bold">우수</span>,      numCls: 'text-cyan-700' }
                if (rate >= top - 10)   return { label: <span className="text-emerald-500 font-bold">양호</span>,   numCls: 'text-emerald-700' }
                if (rate >= top - 15)   return { label: <span className="text-amber-500 font-bold">보통</span>,     numCls: 'text-amber-600' }
                if (rate >= top - 20)   return { label: <span className="text-orange-400 font-bold">미흡</span>,   numCls: 'text-orange-500' }
                if (rate >= top - 25)   return { label: <span className="text-orange-600 font-bold">부진</span>,    numCls: 'text-orange-700' }
                return                         { label: <span className="text-red-500 font-bold">위험</span>,       numCls: 'text-red-600' }
              }

              return (
                <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                  {/* 헤더 */}
                  <div className="bg-gradient-to-r from-[#1B2A45] to-sky-700 px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-white/50 font-medium uppercase tracking-widest mb-0.5">이번달 공급 현황</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">{fmtV(total)}</span>
                        <button
                          onClick={() => { setGoalEditValue(String(target)); setGoalEditOpen(true) }}
                          className="text-sm text-white/50 hover:text-white/80 hover:underline transition-colors"
                        >/ {target}개 목표 ✏️</button>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${achievePct >= 100 ? 'bg-emerald-400/20 text-emerald-300' : achievePct >= 60 ? 'bg-blue-400/20 text-blue-300' : 'bg-amber-400/20 text-amber-300'}`}>
                          {achievePct}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/40">{thisMonth} · 영업일 {bizElapsed}/{bizTotal}일</p>
                      <p className="text-xs font-bold text-white/70 mt-0.5">잔여 {bizRemaining}일 · 목표까지 {fmtV(needed)}개</p>
                      <p className="text-[11px] text-[#C5A258] font-black mt-1">
                        {thisMonthTotalRevenue > 0
                          ? (thisMonthTotalRevenue >= 100000000
                            ? (thisMonthTotalRevenue / 100000000).toFixed(1) + '억'
                            : (thisMonthTotalRevenue / 10000).toFixed(0) + '만원')
                          : '매출 없음'}
                      </p>
                    </div>
                  </div>

                  {/* 목표 달성 바 */}
                  <div className="h-1.5 bg-gray-100">
                    <div
                      className={`h-full transition-all duration-700 ${achievePct >= 100 ? 'bg-emerald-500' : achievePct >= 60 ? 'bg-blue-500' : 'bg-amber-400'}`}
                      style={{ width: `${achievePct}%` }}
                    />
                  </div>

                  <div className="p-4 space-y-3">
                    {/* 공급 섹션 */}
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">공급 채널</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-sky-50 p-3 text-center">
                          <p className="text-[9px] text-sky-400 font-semibold mb-1">공급수</p>
                          <p className="text-2xl font-black text-sky-700 leading-none">{supCnt}</p>
                          <p className="text-[8px] text-sky-400 mt-1">이번달 투입</p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 p-3 text-center">
                          <p className="text-[9px] text-emerald-500 font-semibold mb-1">공급결제</p>
                          <p className="text-2xl font-black text-emerald-700 leading-none">{fmtV(supPay)}</p>
                          <p className="text-[8px] text-emerald-400 mt-1">공가 계약</p>
                        </div>
                        <div className="rounded-xl bg-blue-50 p-3 text-center relative">
                          <p className="text-[9px] text-blue-400 font-semibold mb-1">공급결제율</p>
                          <p className={`text-xl font-black leading-none ${rateGrade(supRate, 40).numCls}`}>
                            {fmtP(supRate)}
                          </p>
                          <p className="text-[8px] mt-1">
                            {rateGrade(supRate, 40).label ?? <span className="text-blue-400">—</span>}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 직접 섹션 */}
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">직접 채널</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-violet-50 p-3 text-center">
                          <p className="text-[9px] text-violet-400 font-semibold mb-1">직접수</p>
                          <p className="text-2xl font-black text-violet-700 leading-none">{dirCnt}</p>
                          <p className="text-[8px] text-violet-400 mt-1">직가 DB 등록</p>
                        </div>
                        <div className="rounded-xl bg-purple-50 p-3 text-center">
                          <p className="text-[9px] text-purple-400 font-semibold mb-1">직접결제</p>
                          <p className="text-2xl font-black text-purple-700 leading-none">{fmtV(dirPay)}</p>
                          <p className="text-[8px] text-purple-400 mt-1">직가 계약</p>
                        </div>
                        <div className="rounded-xl bg-pink-50 p-3 text-center">
                          <p className="text-[9px] text-pink-400 font-semibold mb-1">직접결제율</p>
                          <p className="text-xl font-black text-pink-700 leading-none">{fmtP(dirRate)}</p>
                          <p className="text-[8px] text-pink-400 mt-1">&nbsp;</p>
                        </div>
                      </div>
                    </div>

                    {/* 통합 요약 */}
                    <div className="border border-[#C5A258]/30 bg-gradient-to-r from-[#1B2A45]/5 to-[#C5A258]/5 rounded-xl p-3 grid grid-cols-3 divide-x divide-[#C5A258]/20 text-center">
                      <div className="pr-3">
                        <p className="text-[9px] text-[#C5A258] font-bold mb-0.5 tracking-wide">총결제</p>
                        <p className={`text-2xl font-black ${
                          total >= target ? 'text-emerald-500' :
                          achievePct >= 60 ? 'text-[#C5A258]' : 'text-orange-500'
                        }`}>{fmtV(total)}</p>
                        <p className="text-[8px] text-gray-400 mt-0.5">/ {target}개 목표</p>
                      </div>
                      <div className="px-3">
                        <p className="text-[9px] text-teal-500 font-semibold mb-0.5">총결제율</p>
                        <p className={`text-lg font-black ${rateGrade(totRate, 30).numCls}`}>{fmtP(totRate)}</p>
                        <p className="text-[8px] mt-0.5">
                          {rateGrade(totRate, 30).label ?? <span className="text-teal-400">—</span>}
                        </p>
                      </div>
                      <div className="pl-3">
                        {(() => {
                          // 직접결제율 기준으로 목표 달성에 필요한 직가 가망 수
                          if (total >= target) {
                            return (
                              <>
                                <p className="text-[9px] text-emerald-500 font-semibold mb-0.5">직가 목표달성</p>
                                <p className="text-lg font-black text-emerald-600">완료</p>
                              </>
                            )
                          }
                          if (dirRate === null || dirRate <= 0) {
                            return (
                              <>
                                <p className="text-[9px] text-gray-400 font-semibold mb-0.5">직가 추가필요</p>
                                <p className="text-lg font-black text-gray-400">—</p>
                                <p className="text-[8px] text-gray-300">직접결제율 없음</p>
                              </>
                            )
                          }
                          const needMore = Math.ceil(needed / (dirRate / 100))
                          return (
                            <>
                              <p className="text-[9px] text-violet-500 font-semibold mb-0.5">직가 추가필요</p>
                              <p className="text-lg font-black text-violet-700">{needMore}개</p>
                              <p className="text-[8px] text-violet-400">{fmtP(dirRate)} 기준</p>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* 2주 달력 (2줄 × 7일 그리드) */}
            {(() => {
              // KST 기준 오늘 날짜
              const kstNow = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
              const todayS = kstNow.slice(0, 10)
              const myCustomers = customers.filter(c => {
                const d = (c as any).details || {}
                return d.sales_user_name === userName || (c as any).sales_user_name === userName
              })
              const evMap: Record<string, { type: 'recall' | 'meeting'; company: string; time?: string }[]> = {}
              for (const c of myCustomers) {
                const d = (c as any).details || {}
                const company = d.company || c.name || '—'
                const recallDate = d.callback_date || d.follow_up_date
                const recallTime = d.callback_time || d.follow_up_time
                if (recallDate) {
                  if (!evMap[recallDate]) evMap[recallDate] = []
                  evMap[recallDate].push({ type: 'recall', company, time: recallTime })
                }
                if (d.meeting_date) {
                  if (!evMap[d.meeting_date]) evMap[d.meeting_date] = []
                  evMap[d.meeting_date].push({ type: 'meeting', company, time: d.meeting_time })
                }
              }
              // 오늘의 KST 요일 (0=일)
              const todayDow = new Date(todayS + 'T00:00:00+09:00').getDay()
              // 이번 주 일요일 (오늘이 목요일이면 4일 전 일요일부터 시작)
              const weekSundayTs = Date.now() - todayDow * 86400000
              // 2주 = 14일 (일요일부터 시작해 요일 헤더와 정렬)
              const days = Array.from({ length: 14 }, (_, i) => {
                const d = new Date(weekSundayTs + i * 86400000)
                const s = d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10)
                const dow = new Date(s + 'T00:00:00+09:00').getDay()
                const day = parseInt(s.slice(8, 10), 10)
                const isPast = s < todayS
                return { s, day, dow, isPast }
              })
              const week1 = days.slice(0, 7)
              const week2 = days.slice(7, 14)
              function WeekRow({ week }: { week: typeof days }) {
                return (
                  <div className="grid grid-cols-7 gap-1 px-2 py-2">
                    {week.map(({ s, day, dow, isPast }) => {
                      const isToday = s === todayS
                      const evs = (evMap[s] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                      const shown = evs.slice(0, 2)
                      const extra = evs.length - shown.length
                      return (
                        <div key={s} onClick={() => setActiveTab('schedule')}
                          className={`rounded-lg p-1 cursor-pointer min-h-[56px] transition-colors ${
                            isToday ? 'bg-[#1B2A45]/5 ring-1 ring-[#1B2A45]/20' : isPast ? '' : evs.length > 0 ? 'hover:bg-gray-50' : 'hover:bg-gray-50/50'
                          } ${isPast ? 'opacity-35' : ''}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black mb-0.5 mx-auto ${
                            isToday ? 'bg-[#1B2A45] text-white' :
                            dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-600'
                          }`}>{day}</div>
                          <div className="space-y-0.5">
                            {shown.map((e, i) => (
                              <div key={i} className={`rounded px-0.5 py-0.5 leading-tight ${
                                e.type === 'recall' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
                              }`}>
                                <p className="text-[8px] font-bold truncate">{e.company}</p>
                                {e.time && <p className="text-[7px] opacity-70">{e.time}</p>}
                              </div>
                            ))}
                            {extra > 0 && <p className="text-[7px] text-gray-400 text-center">+{extra}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              }
              return (
                <div className="bg-white border border-[#E8E2D4] rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#E8E2D4]">
                    <h3 className="text-sm font-bold text-[#1B2A45]">📅 2주 일정</h3>
                    <button onClick={() => setActiveTab('schedule')} className="text-[11px] text-violet-500 font-semibold hover:underline">전체보기</button>
                  </div>
                  {/* 요일 헤더 */}
                  <div className="grid grid-cols-7 px-2 pt-2 pb-0">
                    {['일','월','화','수','목','금','토'].map((d, i) => (
                      <div key={d} className={`text-center text-[9px] font-bold py-0.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-300'}`}>{d}</div>
                    ))}
                  </div>
                  <WeekRow week={week1} />
                  <div className="border-t border-gray-100" />
                  <WeekRow week={week2} />
                </div>
              )
            })()}

            {/* 공지사항 */}
            {(() => {
              const ntTeamColor = (t: string) => t === 'sales' ? 'bg-blue-100 text-blue-700' : t === 'ops' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'
              const ntTeamLabel = (t: string) => t === 'sales' ? '영업팀' : t === 'ops' ? '관리팀' : '전체'
              const ntFmtDate = (s: string) => {
                const d = new Date(s)
                return `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}. ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
              }
              return generalNotices.length > 0 ? (
                <div className="bg-white border border-[#E8E2D4] rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#E8E2D4] bg-[#FAFAF8]">
                    <h3 className="text-sm font-bold text-[#1B2A45]">📢 공지사항</h3>
                  </div>
                  <div className="divide-y divide-[#F0EBE0]">
                    {generalNotices.map(n => {
                      const isImportant = n.notice_type === 'important'
                      const isExpanded = expandedNoticeId === n.id
                      return (
                        <div key={n.id} className={isImportant ? 'bg-amber-50' : 'bg-white'}>
                          <button
                            type="button"
                            onClick={() => setExpandedNoticeId(isExpanded ? null : n.id)}
                            className="w-full text-left px-4 py-3 flex items-center gap-2 hover:bg-black/[0.02] transition-colors"
                          >
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${ntTeamColor(n.target_team)}`}>
                              {ntTeamLabel(n.target_team)}
                            </span>
                            {isImportant && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-400 text-white shrink-0">⭐ 중요</span>
                            )}
                            <span className={`text-sm font-semibold flex-1 truncate ${isImportant ? 'text-amber-900' : 'text-[#1B2A45]'}`}>
                              {n.title}
                            </span>
                            <span className="text-[10px] text-gray-300 shrink-0">{ntFmtDate(n.created_at)}</span>
                            <span className={`text-[10px] ml-1 shrink-0 ${isExpanded ? 'text-gray-500' : 'text-gray-300'}`}>
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          </button>
                          {isExpanded && n.content && (
                            <div className={`px-4 pb-4 border-t ${isImportant ? 'border-amber-100' : 'border-gray-50'}`}>
                              <div className={`mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed rounded-xl p-4 border ${isImportant ? 'bg-white border-amber-100' : 'bg-[#FAFAF8] border-gray-100'}`}>
                                {n.content}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-[#E8E2D4] rounded-xl p-6 text-center text-gray-400 text-sm">
                  공지사항 없음
                </div>
              )
            })()}
          </div>
        )}

        {/* ══════════ 직가 DB ══════════ */}
        {activeTab === 'db010' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-[#1B2A45] to-blue-600 rounded-xl px-5 py-3.5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">직가 DB</h2>
                <p className="text-white/50 text-[11px] mt-0.5">총 {db010List.length}건</p>
              </div>
              <div className="flex items-center gap-2">
                {/* 보기 방식 토글 */}
                <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/20">
                  <button
                    onClick={() => setDb010GroupBy('date')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      db010GroupBy === 'date' ? 'bg-white text-[#1B2A45]' : 'text-white/60 hover:text-white'
                    }`}>
                    접수일
                  </button>
                  <button
                    onClick={() => setDb010GroupBy('mood')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      db010GroupBy === 'mood' ? 'bg-white text-[#1B2A45]' : 'text-white/60 hover:text-white'
                    }`}>
                    감도
                  </button>
                </div>
                <button onClick={() => setShow010Form(v => !v)}
                  className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors border border-white/20">
                  {show010Form ? '✕ 취소' : '+ 직가DB 등록'}
                </button>
              </div>
            </div>

            {show010Form && (
              <InCallForm
                title="직가DB 인콜일지 등록"
                salesUsers={salesUserNames}
                submitting={submitting}
                onSubmit={submit010}
                onCancel={() => setShow010Form(false)}
              />
            )}

            {/* 삭제 요청 대기 배너 */}
            {db010PendingDelete.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                <span className="text-amber-500 text-base">⏳</span>
                <p className="text-xs text-amber-700 font-medium">
                  삭제 요청 대기 중 <strong>{db010PendingDelete.length}건</strong> — 대표님 승인을 기다리고 있습니다.
                </p>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : db010List.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                직가 DB가 없습니다.
              </div>
            ) : (
              <InCallTableView
                customers={db010List}
                allCustomers={customers}
                tabType="db010"
                salesUsers={salesUserNames}
                userName={userName}
                groupBy={db010GroupBy}
                scrollToId={scrollToCustomerId}
                onUpdate={updateCustomer}
                onStatusChange={async (id, status) => moveCustomer(id, status as any)}
                onDelete={async (id) => requestDeleteDb010(id)}
              />
            )}
          </div>
        )}

        {/* ══════════ 공가 DB ══════════ */}
        {activeTab === 'customers' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-[#1B2A45] to-indigo-600 rounded-xl px-5 py-3.5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">📂 공가 DB</h2>
                <p className="text-white/50 text-[11px] mt-0.5">총 {activeCustomers.length}건</p>
              </div>
              <button onClick={() => setShowNewForm(v => !v)}
                className="bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors border border-white/20">
                {showNewForm ? '✕ 취소' : '+ 공가DB 등록'}
              </button>
            </div>

            {showNewForm && (
              <InCallForm
                title="공가DB 인콜일지 등록"
                salesUsers={salesUserNames}
                submitting={submitting}
                onSubmit={submitNew}
                onCancel={() => setShowNewForm(false)}
              />
            )}

            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : activeCustomers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                공가 DB가 없습니다.
              </div>
            ) : (
              <InCallTableView
                customers={activeCustomers}
                allCustomers={customers}
                opsContracts={contracts}
                tabType="lead"
                salesUsers={salesUserNames}
                userName={userName}
                scrollToId={scrollToCustomerId}
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
            <div className="bg-gradient-to-r from-[#1B2A45] to-emerald-600 rounded-xl px-5 py-3.5">
              <h2 className="text-sm font-bold text-white">계약 업체</h2>
              <p className="text-white/50 text-[11px] mt-0.5">총 {contractedCustomers.length}건</p>
            </div>

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
                  salesUsers={salesUserNames}
                  userName={userName}
                  scrollToId={scrollToCustomerId}
                  onUpdate={updateCustomer}
                  onStatusChange={async (id, status) => moveCustomer(id, status as any)}
                  onDelete={async (id) => deleteCustomer(id)}
                  onTransferToOps={transferToOps as any}
                  opsStatusMap={opsStatusMap}
                />
              </>
            )}
          </div>
        )}

        {/* ══════════ 감성톡 관리 ══════════ */}
        {activeTab === 'emotional' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-r from-[#1B2A45] to-violet-600 rounded-xl px-5 py-3.5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">감성톡 관리 업체</h2>
                <p className="text-white/50 text-[11px] mt-0.5">총 {emotionalCustomers.length}건 · 장기 육성 대상</p>
              </div>
              <div className="flex bg-white/10 rounded-lg p-0.5 border border-white/20">
                <button
                  onClick={() => setEmotionalGroupBy('mood')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    emotionalGroupBy === 'mood' ? 'bg-white text-[#1B2A45]' : 'text-white/60 hover:text-white'
                  }`}>
                  감도
                </button>
                <button
                  onClick={() => setEmotionalGroupBy('date')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    emotionalGroupBy === 'date' ? 'bg-white text-[#1B2A45]' : 'text-white/60 hover:text-white'
                  }`}>
                  등록일
                </button>
              </div>
            </div>

            {/* 오늘 재통화 업체 미니맵 */}
            {(() => {
              const today = new Date().toISOString().slice(0, 10)
              const todayCallbacks = emotionalCustomers.filter(c => (c as any).details?.follow_up_date === today)
              if (todayCallbacks.length === 0) return null
              return (
                <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
                  <p className="text-[11px] font-bold text-sky-700 mb-2">오늘 재통화 업체 ({todayCallbacks.length}건)</p>
                  <div className="flex flex-wrap gap-2">
                    {todayCallbacks.map(c => (
                      <div key={c.id} className="bg-white border border-sky-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded">재통화</span>
                        <span className="text-xs font-medium text-gray-800">{(c as any).details?.company || c.company || c.name}</span>
                        <span className="text-[10px] text-gray-400">{c.phone}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

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
                salesUsers={salesUserNames}
                userName={userName}
                groupBy={emotionalGroupBy}
                scrollToId={scrollToCustomerId}
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
            <div className="bg-gradient-to-r from-[#1B2A45] to-slate-600 rounded-xl px-5 py-3.5">
              <h2 className="text-sm font-bold text-white">🗑 자체거절 업체</h2>
              <p className="text-white/50 text-[11px] mt-0.5">총 {trashCustomers.length}건 · 복구 가능</p>
            </div>

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
                salesUsers={salesUserNames}
                userName={userName}
                scrollToId={scrollToCustomerId}
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
            <div className="bg-gradient-to-r from-[#1B2A45] to-amber-600 rounded-xl px-5 py-3.5">
              <h2 className="text-sm font-bold text-white">매출 현황</h2>
              <p className="text-white/50 text-[11px] mt-0.5">나의 계약 · 입금 현황</p>
            </div>

            {/* ── 이번달 요약 카드 ── */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{thisMonth} 이번달</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: '계약 갯수', value: thisMonthContractCount % 1 === 0 ? `${thisMonthContractCount}개` : `${thisMonthContractCount.toFixed(1)}개`, color: 'text-[#C5A258]' },
                  { label: '본인 매출', value: fmtWon(thisMonthTotalRevenue), color: 'text-emerald-600' },
                  { label: '입금액(VAT포함)', value: fmtWon(thisMonthTotalPaid), color: 'text-sky-600' },
                  { label: '취소건수', value: `${cancelledCount}건`, color: 'text-red-500' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                    <p className="text-[9px] text-gray-400 mb-0.5">{s.label}</p>
                    <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>


            {/* ── 월별 리스트 ── */}
            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : revenueCustomers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                계약 업체가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {revenueByMonth.map(([month, list]) => {
                  const mRevenue  = list.filter(c => !c.details?.is_cancelled).reduce((s, c) => s + pNum((c as any).details?.my_revenue), 0)
                  const mPaid     = list.filter(c => !c.details?.is_cancelled).reduce((s, c) => s + pNum((c as any).details?.payment_amount), 0)
                  const mCount    = list.filter(c => !c.details?.is_cancelled).reduce((s, c) => s + contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included), 0)
                  const isThisM   = month === thisMonth
                  return (
                    <div key={month} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      {/* 월 헤더 */}
                      <div className={`px-5 py-3 flex items-center justify-between border-b ${isThisM ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${isThisM ? 'text-emerald-700' : 'text-gray-600'}`}>
                            {month === '날짜미입력' ? '계약일 미입력' : `${month}`}
                            {isThisM && <span className="ml-1.5 text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">이번달</span>}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-gray-500">
                          <span className="font-semibold text-[#C5A258]">{mCount % 1 === 0 ? mCount : mCount.toFixed(1)}개</span>
                          <span>입금 {fmtWon(mPaid)}</span>
                          <span className="text-emerald-600 font-semibold">매출 {fmtWon(mRevenue)}</span>
                        </div>
                      </div>
                      {/* 행 목록 */}
                      <div className="divide-y divide-gray-50">
                        {list.map(c => {
                          const cancelled = c.details?.is_cancelled
                          const weight = contractWeight((c as any).details?.payment_amount, (c as any).details?.vat_included)
                          const payAmt = pNum((c as any).details?.payment_amount)
                          const myRev  = pNum((c as any).details?.my_revenue)
                          const fee    = pNum((c as any).details?.contract_fee)
                          return (
                            <div key={c.id} className={`px-5 py-3 ${cancelled ? 'bg-gray-50/60' : ''}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-semibold truncate ${cancelled ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                    {(c as any).details?.company || c.company || c.name || '(업체명 없음)'}
                                  </p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {(c as any).details?.contract_date || '날짜미입력'} · 대표 {c.name}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    weight === 0.5 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
                                  }`}>{parseFloat(weight.toFixed(2))}개</span>
                                  {cancelled
                                    ? <span className="text-[10px] bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded-full">취소</span>
                                    : <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded-full">정상</span>
                                  }
                                </div>
                              </div>
                              <div className={`grid grid-cols-3 gap-2 mt-2 text-[11px] ${cancelled ? 'opacity-40' : ''}`}>
                                <div className="bg-gray-50 rounded-lg px-2 py-1.5">
                                  <p className="text-[9px] text-gray-400 mb-0.5">계약금</p>
                                  <p className="font-semibold text-gray-700">{fee > 0 ? fmtWon(fee) : '—'}</p>
                                </div>
                                <div className="bg-sky-50 rounded-lg px-2 py-1.5">
                                  <p className="text-[9px] text-gray-400 mb-0.5">입금액(VAT포함)</p>
                                  <p className="font-semibold text-sky-700">{payAmt > 0 ? fmtWon(payAmt) : '—'}</p>
                                </div>
                                <div className="bg-emerald-50 rounded-lg px-2 py-1.5">
                                  <p className="text-[9px] text-gray-400 mb-0.5">본인 매출</p>
                                  <p className="font-semibold text-emerald-700">{myRev > 0 ? fmtWon(myRev) : '—'}</p>
                                </div>
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
          </div>
        )}

        {/* ══════════ 보고 ══════════ */}
        {activeTab === 'report' && (
          <ReportTab userId={userId} userName={userName} />
        )}

        {/* ══════════ 일정관리 ══════════ */}
        {activeTab === 'schedule' && (
          <SalesScheduleTab customers={customers.filter(c => {
            const d = (c as any).details || {}
            return d.sales_user_name === userName || (c as any).sales_user_name === userName
          })} />
        )}

        {/* ══════════ 사원정보 ══════════ */}
        {activeTab === 'profile' && (
          <MyProfileTab />
        )}

      </div>

      {/* ── 플로팅 메모장 ── */}
      {notepadOpen && (
        <div
          className="fixed top-14 right-4 z-[300] bg-amber-50 border border-amber-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none"
          style={{ width: notepadSize.w, height: notepadSize.h, opacity: notepadOpacity / 100 }}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-3 py-2 bg-amber-400 rounded-t-2xl shrink-0">
            <span className="text-[11px] font-bold text-white">메모장</span>
            <button onClick={() => setNotepadOpen(false)} className="text-white/80 hover:text-white text-sm leading-none">✕</button>
          </div>

          {/* 본문 — 스크롤 */}
          <div className="flex-1 overflow-y-auto flex flex-col">

            {/* 할일 추가 */}
            <div className="px-2.5 pt-2 pb-2 border-b border-amber-200 shrink-0">
              {/* 기간 탭 */}
              <div className="flex gap-1 mb-1.5">
                {(['today', 'week', 'month'] as const).map(p => {
                  const lbl = { today: '오늘', week: '이번주', month: '이번달' }[p]
                  return (
                    <button key={p} type="button" onClick={() => setAddPeriod(p)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                        addPeriod === p ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                      }`}>
                      {lbl}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-1">
                <input
                  value={notepadInput}
                  onChange={e => setNotepadInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { addTodo(notepadInput, addPeriod) } }}
                  placeholder={`${addPeriod === 'today' ? '오늘' : addPeriod === 'week' ? '이번주' : '이번달'} 할일 추가...`}
                  className="flex-1 text-xs bg-white border border-amber-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                />
                <button onClick={() => addTodo(notepadInput, addPeriod)}
                  className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded font-semibold">
                  +
                </button>
              </div>
            </div>

            {/* 할일 목록 — 기간별 그룹 */}
            <div className="px-2.5 py-2 space-y-3 shrink-0">
              {(['today', 'week', 'month'] as const).map(p => {
                const sectionLabel = { today: '오늘', week: '이번주', month: '이번달' }[p]
                const items = todos.filter(t => t.period === p)
                return (
                  <div key={p}>
                    <p className="text-[9px] font-bold text-amber-600 mb-1">{sectionLabel}</p>
                    {items.length === 0 ? (
                      <p className="text-[10px] text-amber-200 italic pl-1">없음</p>
                    ) : (
                      <div className="space-y-0.5">
                        {items.map(t => (
                          <div key={t.id} className="flex items-center gap-1.5 group py-0.5">
                            <input type="checkbox" checked={t.checked} onChange={() => toggleTodo(t.id)}
                              className="w-3.5 h-3.5 accent-amber-500 cursor-pointer shrink-0" />
                            <span className={`text-xs flex-1 ${t.checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.text}</span>
                            <button onClick={() => deleteTodo(t.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-[10px] transition-opacity shrink-0">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 오늘 재통화 업체 */}
            {todayCallbackCustomers.length > 0 && (
              <div className="border-t border-amber-200 px-2.5 py-2 shrink-0">
                <p className="text-[10px] font-bold text-sky-700 mb-1.5">오늘 재통화 ({todayCallbackCustomers.length}건)</p>
                <div className="space-y-0.5">
                  {todayCallbackCustomers.map(c => {
                    const company = (c as any).details?.company || c.name || '—'
                    return (
                      <div key={c.id} className="flex items-center gap-1.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                        <span className="text-xs text-gray-800 font-medium truncate">{company}</span>
                        <span className="text-[9px] text-gray-400 ml-auto font-mono shrink-0">{c.phone || ''}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 자유 메모 */}
            <div className="border-t border-amber-200 px-2.5 pt-2 pb-3 flex flex-col flex-1" style={{ minHeight: 120 }}>
              <p className="text-[9px] font-bold text-amber-600 mb-1.5">✏️ 자유 메모</p>
              <textarea
                value={memoText}
                onChange={e => {
                  setMemoText(e.target.value)
                  if (typeof window !== 'undefined') localStorage.setItem('notepad-memo', e.target.value)
                }}
                placeholder="자유롭게 메모하세요..."
                className="flex-1 w-full text-xs bg-white border border-amber-200 rounded p-2 focus:outline-none focus:ring-1 focus:ring-amber-400/50 resize-none"
                style={{ minHeight: 80 }}
              />
            </div>

          </div>

          {/* 하단 — 투명도 */}
          <div className="px-3 py-1.5 border-t border-amber-200 flex items-center gap-2 shrink-0">
            <span className="text-[9px] text-amber-600 font-semibold shrink-0">투명도</span>
            <input type="range" min={20} max={100} value={notepadOpacity}
              onChange={e => setNotepadOpacity(Number(e.target.value))}
              className="flex-1 h-1 accent-amber-400" />
            <span className="text-[9px] text-amber-600 font-semibold w-6 text-right">{notepadOpacity}%</span>
          </div>

          {/* 리사이즈 핸들 (우하단 모서리) */}
          <div
            onMouseDown={onNotepadResizeStart}
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10 flex items-end justify-end pb-0.5 pr-0.5"
            title="드래그하여 크기 조절"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 1L1 9M9 5L5 9M9 9" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      )}

      {/* 목표 개수 수정 모달 */}
      {goalEditOpen && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={() => setGoalEditOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-[#1B2A45] text-base mb-1">이번달 목표 개수 설정</h3>
            <p className="text-xs text-gray-400 mb-4">본인의 이번달 공급 목표 개수를 입력하세요</p>
            <input
              type="number"
              value={goalEditValue}
              onChange={e => setGoalEditValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveGoal()}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:border-violet-400"
              placeholder="예: 30"
              autoFocus
              min={0}
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setGoalEditOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50"
              >취소</button>
              <button
                onClick={saveGoal}
                disabled={goalSaving}
                className="flex-1 py-2.5 rounded-xl bg-[#1B2A45] text-white text-sm font-bold hover:bg-[#1B2A45]/90 disabled:opacity-50"
              >{goalSaving ? '저장중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  )
}
