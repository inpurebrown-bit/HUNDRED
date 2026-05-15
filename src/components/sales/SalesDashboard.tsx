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
import { SUPPLY_RATE_TABLE, calcRecommendedSupply, isActiveRow, contractWeight } from '@/lib/supplyRules'

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

type SalesTab = 'board' | 'db010' | 'customers' | 'contracted' | 'emotional' | 'trash' | 'revenue' | 'report' | 'profile'

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
  const [goalEditOpen, setGoalEditOpen] = useState(false)
  const [goalEditValue, setGoalEditValue] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)

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
  // 관리팀 전송 모달 상태
  const [opsTransferModal, setOpsTransferModal] = useState<{ customer: Customer | null; opsUserId: string; opsUserName: string }>({
    customer: null, opsUserId: '', opsUserName: '',
  })
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

    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  // ── 대표 결제율 불러오기 ──────────────────────────────────────────────
  useEffect(() => {
    async function loadPayRate() {
      try {
        const res = await fetch('/api/payrate')
        if (!res.ok) return
        const json = await res.json()
        const record = json.record
        if (!record?.employee_details) return
        const row = record.employee_details.find((e: any) => e.name === userName)
        if (!row) return
        const supCnt = Number(row.supply_count) || 0
        if (supCnt === 0) return
        const rate = (Number(row.supply_payment) + Number(row.direct_payment)) / supCnt * 100
        setCeoPayRate(Math.round(rate * 100) / 100)
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
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    setCustomers(prev => prev.filter(c => c.id !== id))
  }, [])

  const updateCustomer = useCallback(async (id: string, patch: Record<string, any>) => {
    await patchCustomer(id, patch)
  }, [patchCustomer])

  // 내부 실제 전송 함수 (owner_id 포함)
  const doTransferToOps = useCallback(async (customer: Customer, opsUserId?: string, opsUserName?: string) => {
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
    if (opsUserList.length > 0) {
      setOpsTransferModal({ customer, opsUserId: '', opsUserName: '' })
    } else {
      // ops 직원 없으면 미배정으로 바로 전송
      await doTransferToOps(customer)
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
        showToast(`✅ "${data.company || data.name}" 직가DB 등록 완료!`)
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
  // 가중 계약수 (입금액 33만원 이하 = 0.5개)
  const myDbContracted = thisMonthContracted.reduce(
    (sum, c) => sum + contractWeight((c as any).details?.payment_amount), 0
  )
  const myTotalContracted = mySupplyCfg ? mySupplyCfg.base + myDbContracted : myDbContracted

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
  const activeCustomers = customers.filter(c => ['lead', 'consulting'].includes(c.status))
  const contractedCustomers = customers.filter(c => c.status === 'contracted')
  const emotionalCustomers = customers.filter(c => c.status === 'emotional')
  const trashCustomers = customers.filter(c => c.status === 'trash')
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
  const thisMonthContractCount = thisMonthRevenue.reduce((sum, c) => sum + contractWeight((c as any).details?.payment_amount), 0)

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
    { key: 'board',      label: '🏠 메인보드' },
    { key: 'db010',      label: '🏷️ 직가DB',      count: db010List.length },
    { key: 'customers',  label: '📋 공가DB',       count: activeCustomers.length },
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
      {/* ── 관리팀 전송 담당자 선택 모달 ── */}
      {opsTransferModal.customer && (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpsTransferModal({ customer: null, opsUserId: '', opsUserName: '' }) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-[#1B2A45] text-sm">📤 관리팀 담당자 배정</h2>
                <p className="text-[11px] text-gray-400 mt-0.5">{(opsTransferModal.customer as any).details?.company || opsTransferModal.customer.company || opsTransferModal.customer.name}</p>
              </div>
              <button onClick={() => setOpsTransferModal({ customer: null, opsUserId: '', opsUserName: '' })}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-500 font-medium">담당 관리팀 직원을 선택하세요</p>
              <div className="flex flex-wrap gap-2">
                {opsUserList.map(u => (
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
              {opsUserList.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">등록된 관리팀 직원이 없습니다<br />(미배정으로 전송됩니다)</p>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setOpsTransferModal({ customer: null, opsUserId: '', opsUserName: '' })}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                취소
              </button>
              <button
                onClick={async () => {
                  const { customer, opsUserId, opsUserName } = opsTransferModal
                  if (!customer) return
                  setOpsTransferModal({ customer: null, opsUserId: '', opsUserName: '' })
                  await doTransferToOps(customer, opsUserId || undefined, opsUserName || undefined)
                  showToast('✅ 관리팀 전송 완료!')
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                📤 {opsTransferModal.opsUserId ? `${opsTransferModal.opsUserName}에게 전송` : '미배정으로 전송'}
              </button>
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
          {/* 메모장 버튼 */}
          <button
            onClick={() => setNotepadOpen(v => !v)}
            className={`text-[11px] px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap ${notepadOpen ? 'bg-amber-400/80 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
            title="오늘 할일 메모장">
            📝
          </button>
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
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs font-semibold text-gray-500">{thisMonth} 월간 목표</p>
                    {/* 목표 인라인 편집 */}
                    {!goalEditOpen ? (
                      <button
                        onClick={() => { setGoalEditValue(String(monthlyGoal)); setGoalEditOpen(true) }}
                        className="text-[10px] text-gray-400 hover:text-blue-500 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors font-medium"
                      >✏️ 목표 설정</button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={goalEditValue}
                          onChange={e => setGoalEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setGoalEditOpen(false) }}
                          className="w-14 text-xs border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-800"
                          autoFocus
                        />
                        <button onClick={saveGoal} disabled={goalSaving}
                          className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded font-semibold hover:bg-blue-600 disabled:opacity-50">
                          {goalSaving ? '…' : '저장'}
                        </button>
                        <button onClick={() => setGoalEditOpen(false)}
                          className="text-[10px] text-gray-400 hover:text-gray-600 px-1">✕</button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-4xl font-black ${isAhead ? 'text-emerald-600' : achievementRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                      {Number.isInteger(monthContractCount) ? monthContractCount : monthContractCount.toFixed(1)}
                    </span>
                    <span className="text-lg text-gray-400 font-medium">/ {monthlyGoal}개</span>
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
                <span>남은 목표 <strong className="text-gray-800">{remaining % 1 === 0 ? remaining : remaining.toFixed(1)}개</strong></span>
                <span>페이스 기준 <strong className={isAhead ? 'text-emerald-600' : 'text-red-500'}>{onPaceCount}개</strong> 위치</span>
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

            {/* 공급 현황 + 계약율 — 항상 상세뷰 (설정 없으면 displayCfg 기본값 사용) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-700">📊 내 이번달 공급 현황</p>
                <span className="text-[10px] text-gray-400">{thisMonth}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 공급 현황 카드 */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 mb-1">공급 현황</p>
                  <p className="text-xl font-black text-blue-700">
                    {displayCfg.supplied > 0 ? `${displayCfg.supplied}개` : '미배정'}
                    {displayCfg.supplied > 0 && <span className="text-[11px] font-normal text-gray-400"> 이달</span>}
                  </p>
                  {todaySupply > 0 && <p className="text-[10px] text-blue-500 font-semibold mt-0.5">금일 {todaySupply}개 배정</p>}
                </div>
                {/* 결제수 */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 mb-1">결제수</p>
                  <p className="text-xl font-black text-emerald-700">{myTotalContracted.toFixed(1)}개</p>
                  {displayCfg.base > 0 && <p className="text-[9px] text-gray-400 mt-0.5">기존 {displayCfg.base} + DB {myDbContracted.toFixed(1)}</p>}
                </div>
                {/* 결제율 (대표 입력) */}
                {(() => {
                  const rate = ceoPayRate
                  const rateColor = rate === null ? 'text-gray-400' : rate >= 17 ? 'text-emerald-700' : rate >= 13 ? 'text-amber-700' : 'text-red-600'
                  const rateBg    = rate === null ? 'bg-gray-50'   : rate >= 17 ? 'bg-emerald-50'   : rate >= 13 ? 'bg-amber-50'   : 'bg-red-50'
                  const rateBd    = rate === null ? 'border-gray-100' : rate >= 17 ? 'border-emerald-100' : rate >= 13 ? 'border-amber-100' : 'border-red-100'
                  return (
                    <div className={`${rateBg} border ${rateBd} rounded-xl p-3`}>
                      <p className="text-[10px] text-gray-400 mb-1">결제율 <span className="text-[9px] bg-gray-200 text-gray-600 rounded-full px-1">대표입력</span></p>
                      <p className={`text-xl font-black ${rateColor}`}>{rate !== null ? `${rate.toFixed(2)}%` : '미입력'}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">공급 대비 계약율 {contractRate.toFixed(2)}%</p>
                    </div>
                  )
                })()}
                {/* 공급예정 */}
                {(() => {
                  const baseRate = ceoPayRate ?? contractRate
                  const needed = calcRecommendedSupply(baseRate, bizElapsed)
                  return (
                    <div className="bg-violet-50 border border-violet-100 rounded-xl p-3">
                      <p className="text-[10px] text-gray-400 mb-1">결제율 대비 공급예정</p>
                      <p className="text-xl font-black text-violet-700">{needed > 0 ? `${needed}개` : '공급 중단'}</p>
                    </div>
                  )
                })()}
              </div>
              {/* 목표 달성 바 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500">목표 달성 ({myTotalContracted.toFixed(1)} / {displayCfg.goal}개)</span>
                  <span className="text-[10px] font-bold text-gray-700">
                    {displayCfg.goal > 0 ? Math.round(myTotalContracted / displayCfg.goal * 100) : 0}%
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${displayCfg.goal > 0 ? Math.min(100, Math.round(myTotalContracted / displayCfg.goal * 100)) : 0}%` }} />
                </div>
              </div>
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

        {/* ══════════ 직가 DB ══════════ */}
        {activeTab === 'db010' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-gray-700 mr-auto">
                직가 DB <span className="text-gray-400 font-normal">({db010List.length}건)</span>
              </h2>
              <button onClick={() => setShow010Form(v => !v)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                {show010Form ? '✕ 취소' : '+ 직가DB 등록'}
              </button>
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
                onUpdate={updateCustomer}
                onStatusChange={async (id, status) => moveCustomer(id, status as any)}
                onDelete={async (id) => deleteCustomer(id)}
              />
            )}
          </div>
        )}

        {/* ══════════ 공가 DB ══════════ */}
        {activeTab === 'customers' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700">
                공가 DB <span className="text-gray-400 font-normal">({activeCustomers.length}건)</span>
              </h2>
              <button onClick={() => setShowNewForm(v => !v)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
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
                  salesUsers={salesUserNames}
                  userName={userName}
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
            <h2 className="text-sm font-bold text-gray-700">
              💬 감성톡 관리 업체 <span className="text-gray-400 font-normal">({emotionalCustomers.length}건)</span>
            </h2>

            {/* 오늘 재통화 업체 미니맵 */}
            {(() => {
              const today = new Date().toISOString().slice(0, 10)
              const todayCallbacks = emotionalCustomers.filter(c => (c as any).details?.follow_up_date === today)
              if (todayCallbacks.length === 0) return null
              return (
                <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
                  <p className="text-[11px] font-bold text-sky-700 mb-2">📞 오늘 재통화 업체 ({todayCallbacks.length}건)</p>
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
                salesUsers={salesUserNames}
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
            <h2 className="text-sm font-bold text-gray-700">💰 매출 현황</h2>

            {/* ── 이번달 요약 카드 ── */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">📅 {thisMonth} 이번달</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: '계약 갯수', value: thisMonthContractCount % 1 === 0 ? `${thisMonthContractCount}개` : `${thisMonthContractCount.toFixed(1)}개`, color: 'text-[#C5A258]' },
                  { label: '본인 매출', value: fmtWon(thisMonthTotalRevenue), color: 'text-emerald-600' },
                  { label: '총 입금액', value: fmtWon(thisMonthTotalPaid), color: 'text-sky-600' },
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
                  const mCount    = list.filter(c => !c.details?.is_cancelled).reduce((s, c) => s + contractWeight((c as any).details?.payment_amount), 0)
                  const isThisM   = month === thisMonth
                  return (
                    <div key={month} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      {/* 월 헤더 */}
                      <div className={`px-5 py-3 flex items-center justify-between border-b ${isThisM ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${isThisM ? 'text-emerald-700' : 'text-gray-600'}`}>
                            {month === '날짜미입력' ? '📌 계약일 미입력' : `📅 ${month}`}
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
                          const weight = contractWeight((c as any).details?.payment_amount)
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
                                  }`}>{weight}개</span>
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
                                  <p className="text-[9px] text-gray-400 mb-0.5">입금액</p>
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
            <span className="text-[11px] font-bold text-white">📝 메모장</span>
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
                const sectionLabel = { today: '📅 오늘', week: '📆 이번주', month: '🗓 이번달' }[p]
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
                <p className="text-[10px] font-bold text-sky-700 mb-1.5">📞 오늘 재통화 ({todayCallbackCustomers.length}건)</p>
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
    </div>
  )
}
