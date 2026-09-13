'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import MyProfileTab from '@/components/MyProfileTab'

interface Props {
  userId: string
  userName: string
  username: string
}

type Tab = 'dig' | 'profile'

const DAILY_GOAL        = 8
const BONUS_PER_EXTRA   = 10000

// 통화 전 체크리스트 (9항목 전부 필수)
const CHECKLIST_ITEMS = [
  { key: 'identity_disclosed',  label: '소속 고지',         desc: '✅ "저희는 헌드레드컨설팅 OOO입니다" — 이름·소속 반드시 먼저 고지', legal: true },
  { key: 'purpose_disclosed',   label: '목적 고지',         desc: '✅ "정책자금 관련 무료 상담 안내차 연락드렸습니다" — 목적 고지', legal: true },
  { key: 'source_disclosed',    label: '출처 고지',         desc: '✅ "연락처는 네이버를 통해 확인했습니다" — 수집 경로 고지', legal: true },
  { key: 'needs_check',         label: '니즈 확인',         desc: '"혹시 정책자금 알아보신 적 있으시거나 사용하고 계신 게 있으세요?"' },
  { key: 'basic_info',          label: '기본 정보 수집',    desc: '업력 / 연매출 / 업종 / 연체·체납 여부 / 신용점수 / 대표자 성함 (5가지 이상)' },
  { key: 'cancel_checked',      label: '캔슬조건 확인',     desc: '❌ 거절 의사 1회라도 → 즉시 종료 | 단순 호기심 → 대환/캐피탈 여부 체크 후 판단' },
  { key: 'check_requirements',  label: '체크요건 확인',     desc: '① 통화 희망 시간대 확인 ② 실제 자금 필요 여부 확인 (대환 포함)' },
  { key: 'closing_done',        label: '클로징 멘트',       desc: '"내일 전문 컨설턴트가 결과 안내드릴 건데, 통화 편한 시간이 언제이실까요?"' },
  { key: 'phone_secured',       label: '010 번호 확보',     desc: '통화 가능한 010 번호 확보 (문자·카카오톡 발송 금지 — 유선 통화만)' },
]

interface Prospect {
  id: string
  company: string
  ceo_name: string
  phone_010: string
  business_age: string
  annual_revenue: string
  industry: string
  has_delinquency: boolean
  credit_score: string
  required_fund: string
  checklist: Record<string, boolean>
  memo: string
  recording_url: string
  recording_filename: string
  recording_analysis: any
  status: 'pending' | 'approved' | 'rejected' | 'assigned'
  ceo_comment: string
  assigned_to_name: string
  created_at: string
  call_date: string
}

const SCRIPT_SECTIONS = [
  {
    label: 'STEP 1 — 도입부 (소속·목적·출처 고지 필수)', color: 'blue' as const,
    content: [
      { bold: true,  text: '"안녕하세요 대표님~ (회사명) 대표님 맞으실까요~?"' },
      { bold: false, text: '(대표 아닌 경우) → "아 네ㅎㅎ~ 그럼 다음에 연락드릴게요~"' },
      { bold: true,  text: '⚠ 법적 필수 — 반드시 순서대로 고지:' },
      { bold: true,  text: '"저희는 헌드레드컨설팅이라는 경영자문회사 OOO입니다."  ← 소속+이름' },
      { bold: true,  text: '"네이버 보고 대표님 업체에 해당되는 정책자금 관련 무료 상담 도와드리려 전화드렸는데 잠깐 통화 괜찮으실까요?"  ← 목적+출처' },
      { bold: false, text: '(통화 가능 확인 후) "요새 나라 경제가 많이 어렵잖아요.. 최근 정부에서 사업자들 대상으로 지원 혜택들이 4000개 넘게 나오고 있는데 대표님 업종도 해당되는 게 많은 거 알고 계실까요? 이런 게 있는지 몰라서 못 받으시거나, 절차가 어렵고 까다로워서 못 하시는 분들이 많아서 그런 대표님들께 무료 자문을 도와드리고 있거든요~"' },
      { bold: true,  text: '"혹시 지금 정책자금 알아보신 적 있으시거나 사용하고 계신 게 있으세요?"' },
    ],
  },
  {
    label: 'STEP 2 — 니즈 분기 & 정보 수집', color: 'green' as const,
    content: [
      { bold: false, text: '▶ 있다고 할 경우: "아~ 그럼 어디서 어떻게 받으셨는지 잘 기억 안 나시죠ㅎㅎ (너무 딥하게 파악 X, 인폼 진행이 더 중요) 한번 받았다고 더 못 받는 게 아니라, 기관마다 추가로 가능한 게 다 다르거든요~"' },
      { bold: false, text: '▶ 없다/모른다: "아~ 사업하시면서 자금이 계속 필요하실 텐데, 캐피탈 같은 고금리가 아니라 시중 은행보다 금리가 낮은 정책자금을 활용하시면 이자비용을 아끼실 수 있거든요~"' },
      { bold: true,  text: '정보 수집 순서: 업력 → 연매출 → 연체·체납 → 업종 → 필요자금 → 신용점수' },
      { bold: false, text: '"혹시 사업 시작하신 지 얼마나 되셨어요?" / "연매출은 대략 어느 정도 되세요?" / "세금 체납이나 대출·카드 연체 같은 건 없으시죠?" / "업종이 OOO 맞나요?" / "필요하신 자금은 얼마 정도이실까요?" / "신용점수는 대략 몇 점이실까요~?"' },
      { bold: true,  text: '▶ 니즈 불명확 시 반드시 확인:' },
      { bold: false, text: '[대환 체크] "혹시 지금 쓰고 계신 대출을 더 낮은 금리로 갈아타실 목적이신가요, 아니면 새로 필요하신 건가요?"' },
      { bold: false, text: '[캐피탈 체크] "혹시 캐피탈이나 카드론 같은 것도 쓰고 계신 게 있으실까요?"' },
      { bold: true,  text: '→ 대환 or 캐피탈 사용 중이면 니즈 있는 것으로 보고 인폼 이어가기. 둘 다 해당 없고 실제 니즈도 없으면 캔슬조건 처리.' },
    ],
  },
  {
    label: 'STEP 3 — 취지 설명 + 번호 확보 + 통화시간', color: 'purple' as const,
    content: [
      { bold: false, text: '"말씀 감사드려요~ 우선 대표님이 정책자금 어떤 기관에서 어떤 상품으로 들어가고, 한도는 얼마나 나올 것 같은지, 금리는 몇%대로 나올 것 같은지에 대해 저희 컨설팅 매니저님이 자세히 무료 상담을 도와드릴 거예요! 대신 안내받아 보시고 요건이 되셔서 컨설팅을 맡기고 싶으시면 그때 문의 주시면 됩니다~"' },
      { bold: false, text: '(갑자기 끊으려 할 때) "당장 계약하자는 게 아니라, 우선 가능한 정책자금이 있는지 무료 진단받아 보신 후에 조건 들어보시고 결정하셔도 되니까 걱정 마세요~"' },
      { bold: false, text: '(수수료 물어볼 때) "다 들어보신 후에 진행하신다고 하시면 그때 업종·자금마다 착수금이 달라서 안내드립니다."' },
      { bold: true,  text: '"저희 전문 컨설턴트님이 내일 자세히 안내드릴 건데, 받아보실 번호가 010에 몇 번이실까요?"' },
      { bold: true,  text: '"내일 통화 편하신 시간대가 언제쯤이실까요?" ← 체크요건 ① 통화 희망시간 반드시 확인' },
      { bold: true,  text: '"대표님 성함은 어떻게 되실까요~? 네, 알겠습니다! 좋은 하루 보내세요~"' },
      { bold: false, text: '※ 문자·카카오톡으로 자료를 전송하지 않습니다. 후속 연락은 확보한 시간대에 유선으로만 진행합니다.' },
    ],
  },
  {
    label: '반론 대응', color: 'red' as const,
    rows: [
      { q: '바빠요 / 됐어요',     a: '"아 바쁘시죠~ 연락처만 주시면 편한 시간에 매니저가 연락드릴게요. 010~"' },
      { q: '필요없어요',           a: '"아 그러세요~ 무료로 진단만 받아 놓으셔도 나중에 필요하실 때 도움이 되실 거예요." → 한 번이라도 명확히 거절 시 캔슬조건 ①' },
      { q: '이미 쓰고 있어요',    a: '"기관마다 중복으로 추가 가능한 것도 있어서 무료 진단 한번 받아보시면 좋은 정보 얻으실 거예요!"' },
      { q: '사기 같아요',          a: '"무료 컨설팅이고 진행 원하실 때만 비용 발생해요~ 부담 없이 상담만 받아보세요."' },
      { q: '문자 남겨주세요',      a: '"문자로는 정확한 안내가 어려워서요~ 연락처 주시면 상담사가 5분만 설명드릴게요."' },
      { q: '나중에요',             a: '"아 그러세요~ 언제가 편하세요? 그때 맞춰서 연락드릴게요. 010~"' },
      { q: '모르는 질문',          a: '"그 부분은 제가 전문적으로 답변드리기 어려워서요~ 상담사분이 정확히 설명드릴 수 있어요."' },
      { q: '비용 물어볼 때',       a: '"비용은 업종·상황에 따라 달라지는데요, 우선 무료 컨설팅이니 받아보시고 상담 이후에 정확하게 안내드릴 거예요."' },
      { q: '안 된다던데',          a: '"자금마다 기준이 달라서요~ 무료니까 일단 상담만 받아보시면 정확히 확인해드려요."' },
    ],
  },
  {
    label: '🚫 캔슬조건 — 해당 시 즉시 가망 등록 금지', color: 'cancel' as const,
    content: [
      { bold: true,  text: '① 대표님이 "안 한다 / 필요 없다" 취지의 말을 한 번이라도 한 경우 → 즉시 종료' },
      { bold: true,  text: '② 확실하게 정책자금이 필요하지 않다고 판단되는 경우' },
      { bold: true,  text: '③ 단순 호기심 / 가볍게 알아보는 경우 → 아래 두 가지 체크 후에도 니즈 없으면 캔슬' },
      { bold: false, text: '  ③-1. 대환(기존 대출 금리 갈아타기) 목적 여부 확인' },
      { bold: false, text: '  ③-2. 캐피탈·카드론 사용 여부 확인' },
      { bold: true,  text: '④ 어거지로 유도해서 가망 등록하는 것 금지 — 자발적 답변만 인정' },
    ],
  },
  {
    label: '⚠ 주의사항 — 절대 하면 안 되는 행동', color: 'warning' as const,
    content: [
      { bold: true,  text: '❌ 지원금·공짜 표현으로 후킹하는 것' },
      { bold: true,  text: '❌ 정책자금 니즈 없는 고객을 억지로 확보하는 것' },
      { bold: true,  text: '❌ 두리뭉실한 유도 질문으로 번호만 받는 것' },
      { bold: true,  text: '❌ 확정·과장 표현 — "무조건 나옵니다", "100% 된다" 등 금지' },
      { bold: true,  text: '❌ 문자·카카오톡으로 자료·안내 전송 — 후속 연락은 반드시 유선 통화로만' },
      { bold: true,  text: '❌ 소속·목적·출처 고지를 생략하거나 얼버무리는 것' },
    ],
  },
]

const SCRIPT_COLOR: Record<string, { header: string; border: string }> = {
  blue:    { header: 'bg-blue-50 text-blue-800',       border: 'border-blue-200' },
  red:     { header: 'bg-red-50 text-red-800',          border: 'border-red-200' },
  green:   { header: 'bg-emerald-50 text-emerald-800',  border: 'border-emerald-200' },
  purple:  { header: 'bg-purple-50 text-purple-800',    border: 'border-purple-200' },
  cancel:  { header: 'bg-red-100 text-red-900',         border: 'border-red-400' },
  warning: { header: 'bg-orange-50 text-orange-800',    border: 'border-orange-300' },
}

export default function DigDashboard({ userId, userName, username }: Props) {
  const [activeTab, setActiveTab]   = useState<Tab>('dig')
  const [menuOpen, setMenuOpen]     = useState(false)
  const [prospects, setProspects]   = useState<Prospect[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showRecordingModal, setShowRecordingModal] = useState(false)
  const [openScriptIdx, setOpenScriptIdx]           = useState<number | null>(null)
  const [recordingFile, setRecordingFile]           = useState<File | null>(null)
  const [analyzing, setAnalyzing]   = useState(false)
  const [analysis, setAnalysis]     = useState<any>(null)
  const [urgentAssign, setUrgentAssign] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [resubmitProspect, setResubmitProspect] = useState<Prospect | null>(null)
  const [resubmitFile, setResubmitFile]         = useState<File | null>(null)
  const [resubmitAnalysis, setResubmitAnalysis] = useState<any>(null)
  const [resubmitAnalyzing, setResubmitAnalyzing] = useState(false)
  const [resubmitting, setResubmitting]         = useState(false)
  const resubmitFileRef = useRef<HTMLInputElement>(null)

  const [phoneSearch, setPhoneSearch]       = useState('')
  const [phoneResults, setPhoneResults]     = useState<any[] | null>(null)
  const [phoneSearching, setPhoneSearching] = useState(false)
  const [phoneVerified, setPhoneVerified]   = useState(false)

  // 직원정보 탭 비밀번호 게이트
  const [profileUnlocked, setProfileUnlocked] = useState(false)
  const [showPwGate, setShowPwGate]           = useState(false)
  const [pwGateInput, setPwGateInput]         = useState('')
  const [pwGateError, setPwGateError]         = useState('')
  const [pwGateLoading, setPwGateLoading]     = useState(false)

  const [form, setForm] = useState({
    company: '', ceo_name: '', phone: '', phone_010: '',
    business_age: '', annual_revenue: '', industry: '',
    delinquency_detail: '', credit_score: '', required_fund: '',
    preferred_call_time: '',
  })
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    identity_disclosed: false, purpose_disclosed: false, source_disclosed: false,
    needs_check: false, basic_info: false, cancel_checked: false,
    check_requirements: false, closing_done: false, phone_secured: false,
  })

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadProspects = useCallback(async () => {
    try {
      const res  = await fetch('/api/dig-prospects')
      const data = await res.json()
      setProspects(data.prospects || [])
    } catch {}
  }, [])

  useEffect(() => { loadProspects() }, [loadProspects])

  const today        = new Date().toISOString().slice(0, 10)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const dateLabel    = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  const pendingList   = prospects.filter(p => p.status === 'pending')
  const approvedList  = prospects.filter(p => p.status === 'approved' || p.status === 'assigned')
  const rejectedList  = prospects.filter(p => p.status === 'rejected')
  const todayApproved = prospects.filter(p => p.call_date === today && (p.status === 'approved' || p.status === 'assigned')).length
  const bonusCount    = Math.max(0, todayApproved - DAILY_GOAL)
  const bonusAmount   = bonusCount * BONUS_PER_EXTRA
  const checkDoneCount   = Object.values(checklist).filter(Boolean).length
  const checklistAllDone = checkDoneCount === CHECKLIST_ITEMS.length

  function handleTabClick(key: Tab) {
    if (key === 'profile' && !profileUnlocked) {
      setPwGateInput('')
      setPwGateError('')
      setShowPwGate(true)
      return
    }
    setActiveTab(key)
  }

  async function verifyPwGate() {
    if (!pwGateInput) { setPwGateError('비밀번호를 입력하세요'); return }
    setPwGateLoading(true)
    setPwGateError('')
    try {
      const res  = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwGateInput }),
      })
      if (res.ok) {
        setProfileUnlocked(true)
        setShowPwGate(false)
        setActiveTab('profile')
      } else {
        const d = await res.json()
        setPwGateError(d.error || '비밀번호가 틀렸습니다')
      }
    } catch { setPwGateError('서버 오류가 발생했습니다') }
    setPwGateLoading(false)
  }

  async function doPhoneSearch() {
    const clean = phoneSearch.replace(/[^0-9]/g, '')
    if (clean.length < 9) { showToast('번호를 9자리 이상 입력하세요', 'error'); return }
    setPhoneSearching(true)
    setPhoneResults(null)
    setPhoneVerified(false)
    try {
      const res  = await fetch(`/api/phone-search?phone=${clean}`)
      const data = await res.json()
      const results = data.results || []
      setPhoneResults(results)
      if (results.length === 0) {
        // 중복 없음 → 폼 010번호 자동 입력 + 활성화
        setPhoneVerified(true)
        const formatted = clean.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3')
        setForm(p => ({ ...p, phone_010: formatted || clean }))
      }
    } catch { showToast('검색 중 오류', 'error') }
    setPhoneSearching(false)
  }

  async function processRecordingFile(file: File) {
    setRecordingFile(file)
    setAnalysis(null)
    if (file.size > 50 * 1024 * 1024) { showToast('파일이 너무 큽니다 (최대 50MB)', 'error'); return }
    if (file.size <= 20 * 1024 * 1024) {
      setAnalyzing(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res  = await fetch('/api/analyze-recording', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.analysis) {
          setAnalysis(data.analysis)
          if (!data.analysis.parse_error) {
            // 정상 파싱 — 체크리스트·고객정보 자동 입력
            if (data.analysis.checklist) setChecklist(prev => ({ ...prev, ...data.analysis.checklist }))
            if (data.analysis.customer_info) {
              const ci = data.analysis.customer_info
              setForm(prev => ({
                ...prev,
                company:            ci.company        || prev.company,
                ceo_name:           ci.ceo_name       || prev.ceo_name,
                phone_010:          ci.phone_010       || prev.phone_010,
                business_age:       ci.business_age   || prev.business_age,
                annual_revenue:     ci.annual_revenue  || prev.annual_revenue,
                industry:           ci.industry        || prev.industry,
                credit_score:       ci.credit_score    || prev.credit_score,
                required_fund:      ci.required_fund   || prev.required_fund,
                delinquency_detail: ci.has_delinquency != null ? (ci.has_delinquency ? '있음' : '없음') : prev.delinquency_detail,
              }))
            }
            // 부분 체크리스트 복구된 경우에도 적용
            showToast('녹취 처리 완료')
          } else {
            if (data.analysis.checklist) setChecklist(prev => ({ ...prev, ...data.analysis.checklist }))
            showToast('녹취 업로드 완료')
          }
        }
      } catch { showToast('녹취 처리 중 오류가 발생했습니다', 'error') }
      setAnalyzing(false)
    }
  }

  function handleRecordingChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    processRecordingFile(file)
  }

  function handleRecordingDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    // 오디오 파일이 아닌 경우 거부
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|aac|ogg|mp4|wma)$/i.test(file.name)) {
      showToast('오디오 파일만 업로드 가능합니다 (mp3, m4a, wav 등)', 'error')
      return
    }
    processRecordingFile(file)
  }

  async function handleResubmitFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResubmitFile(file)
    setResubmitAnalysis(null)
    if (file.size > 50 * 1024 * 1024) { showToast('파일이 너무 큽니다 (최대 50MB)', 'error'); return }
    if (file.size <= 20 * 1024 * 1024) {
      setResubmitAnalyzing(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/analyze-recording', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.analysis && !data.analysis.parse_error) {
          setResubmitAnalysis(data.analysis)
          showToast('처리 완료!')
        } else {
          showToast('처리 실패 — 그대로 재제출 가능합니다', 'error')
        }
      } catch { showToast('처리 중 오류', 'error') }
      setResubmitAnalyzing(false)
    }
  }

  async function handleResubmitSubmit() {
    if (!resubmitProspect) return
    setResubmitting(true)
    let recording_url: string | null = resubmitProspect.recording_url || null
    let recording_filename: string | null = resubmitProspect.recording_filename || null
    let recording_analysis: any = resubmitAnalysis || resubmitProspect.recording_analysis || null

    if (resubmitFile) {
      try {
        const fd = new FormData()
        fd.append('file', resubmitFile)
        const res = await fetch('/api/upload-recording', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.url) {
          recording_url = data.url
          recording_filename = data.filename
        } else {
          showToast(data.error || '녹취 업로드 실패', 'error')
          setResubmitting(false)
          return
        }
      } catch { showToast('녹취 업로드 중 오류', 'error'); setResubmitting(false); return }
    }

    const res = await fetch(`/api/dig-prospects/${resubmitProspect.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resubmit', recording_url, recording_filename, recording_analysis }),
    })
    if (res.ok) {
      showToast('재심사 제출 완료! 대표님 심사를 기다려주세요')
      setResubmitProspect(null)
      setResubmitFile(null)
      setResubmitAnalysis(null)
      if (resubmitFileRef.current) resubmitFileRef.current.value = ''
      loadProspects()
    } else {
      const d = await res.json()
      showToast(d.error || '재제출 실패', 'error')
    }
    setResubmitting(false)
  }

  function handleSubmitClick(e: React.FormEvent) {
    e.preventDefault()
    if (!form.phone_010.trim()) { showToast('010 번호는 필수입니다', 'error'); return }
    setRecordingFile(null); setAnalysis(null)
    if (fileRef.current) fileRef.current.value = ''
    setShowRecordingModal(true)
  }

  async function handleFinalSubmit() {
    if (!recordingFile) {
      showToast('녹취 파일을 반드시 첨부해주세요', 'error')
      return
    }
    setSubmitting(true)
    let recording_url = ''
    let recording_filename = ''
    if (recordingFile) {
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', recordingFile)
        const res  = await fetch('/api/upload-recording', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.url) { recording_url = data.url; recording_filename = data.filename }
        else { showToast(data.error || '녹취 업로드 실패', 'error'); setSubmitting(false); setUploading(false); return }
      } catch { showToast('녹취 업로드 중 오류', 'error'); setSubmitting(false); setUploading(false); return }
      setUploading(false)
    }
    try {
      const res  = await fetch('/api/dig-prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: form.company, ceo_name: form.ceo_name, phone: form.phone, phone_010: form.phone_010,
          business_age: form.business_age, annual_revenue: form.annual_revenue, industry: form.industry,
          has_delinquency: !!form.delinquency_detail.trim(), credit_score: form.credit_score,
          required_fund: form.required_fund, preferred_call_time: form.preferred_call_time,
          urgent_assign: urgentAssign,
          memo: form.delinquency_detail.trim(), checklist,
          recording_url, recording_filename, recording_analysis: analysis || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        const autoApproved = data.auto_approved
        showToast(autoApproved ? '✅ 승인 처리됐습니다!' : '가망 등록 완료! 대표님 심사를 기다려주세요')
        setForm({ company: '', ceo_name: '', phone: '', phone_010: '', business_age: '', annual_revenue: '', industry: '', delinquency_detail: '', credit_score: '', required_fund: '', preferred_call_time: '' })
        setChecklist({ identity_disclosed: false, purpose_disclosed: false, source_disclosed: false, needs_check: false, basic_info: false, cancel_checked: false, check_requirements: false, closing_done: false, phone_secured: false })
        setRecordingFile(null); setAnalysis(null)
        setUrgentAssign(false)
        if (fileRef.current) fileRef.current.value = ''
        setShowRecordingModal(false)
        loadProspects()
      } else {
        showToast(data.error || '등록 실패', 'error')
      }
    } catch { showToast('등록 중 오류 발생', 'error') }
    setSubmitting(false)
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/30 bg-white'
  const lblCls   = 'block text-xs font-semibold text-gray-500 mb-1'

  return (
    <div className="min-h-screen bg-[#F7F6F2]">

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white max-w-xs text-center ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* 녹취 모달 */}
      {showRecordingModal && (
        <div
          className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/60"
          onDragOver={e => e.preventDefault()}
          onDrop={handleRecordingDrop}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg px-5 pt-5 pb-8 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#1B2A45]">녹취 파일 첨부 <span className="text-red-500 text-sm">* 필수</span></h3>
              <p className="text-xs text-gray-400 mt-0.5">통화 녹취를 첨부해야 제출할 수 있습니다</p>
            </div>
            <input ref={fileRef} type="file" accept=".mp3,.m4a,.wav,.aac,.ogg,.mp4,.wma,audio/*" onChange={handleRecordingChange} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={handleRecordingDrop}
              className={`w-full border-2 border-dashed rounded-xl py-6 text-center transition-colors ${
                recordingFile ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:border-[#1B2A45]/40'
              }`}>
              {recordingFile
                ? <><p className="text-sm text-emerald-700 font-bold">{recordingFile.name}</p><p className="text-xs text-emerald-500 mt-0.5">✓ 파일 선택됨 — 다시 클릭하면 교체</p></>
                : <><p className="text-sm text-gray-500 font-medium">+ 녹취 파일 선택 또는 여기에 드래그</p><p className="text-xs text-gray-300 mt-1">mp3, m4a, wav, aac 지원 · 최대 50MB</p></>}
            </button>
            {analyzing && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-blue-700">처리 중... 잠시 기다려주세요</p>
              </div>
            )}
            {analysis && !analysis.parse_error && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-emerald-700">검토 완료</p>
                <p className="text-sm text-gray-700">{analysis.summary}</p>
                {analysis.feedback && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{analysis.feedback}</p>}
                <p className={`text-xs font-semibold ${analysis.all_passed ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {analysis.all_passed ? '✅ 모든 체크리스트 통과' : '⚠ 일부 체크리스트 미완료'}
                </p>
              </div>
            )}
            <button type="button" onClick={handleFinalSubmit} disabled={submitting || analyzing || !recordingFile}
              className={`w-full py-4 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50 ${
                recordingFile ? 'bg-[#1B2A45] hover:bg-[#1B2A45]/90' : 'bg-gray-300 cursor-not-allowed'
              }`}>
              {uploading ? '📤 업로드 중...' : submitting ? '제출 중...' : analyzing ? '처리 중 — 잠시 후 제출 가능' : !recordingFile ? '녹취 파일을 먼저 첨부해주세요' : '제출 →'}
            </button>
          </div>
        </div>
      )}

      {/* 재심사 모달 */}
      {resubmitProspect && (
        <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/60">
          <div className="bg-white rounded-t-2xl w-full max-w-lg px-5 pt-5 pb-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1B2A45]">재심사 제출</h3>
                <p className="text-xs text-gray-400 mt-0.5">{resubmitProspect.company || resubmitProspect.ceo_name}</p>
              </div>
              <button type="button" onClick={() => { setResubmitProspect(null); setResubmitFile(null); setResubmitAnalysis(null) }}
                className="text-gray-400 hover:text-gray-600 text-xl p-1">✕</button>
            </div>

            {/* 부결 사유 */}
            {resubmitProspect.ceo_comment && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-[10px] text-red-500 font-bold mb-1">부결 사유</p>
                <p className="text-sm text-red-700">{resubmitProspect.ceo_comment}</p>
              </div>
            )}

            <p className="text-xs text-gray-500">새 녹취 파일을 첨부하면 AI가 재분석합니다. 없이 제출도 가능합니다.</p>

            <input ref={resubmitFileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
              onChange={handleResubmitFileChange} className="hidden" />
            <button type="button" onClick={() => resubmitFileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-center hover:border-[#1B2A45]/30 transition-colors">
              {resubmitFile
                ? <span className="text-sm text-gray-700 font-medium">{resubmitFile.name}</span>
                : <><p className="text-sm text-gray-400">+ 새 녹취 파일 선택 (선택)</p><p className="text-xs text-gray-300 mt-0.5">mp3, m4a, wav, aac 등</p></>}
            </button>

            {resubmitAnalyzing && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-blue-700">AI 재분석 중...</p>
              </div>
            )}
            {resubmitAnalysis && !resubmitAnalysis.parse_error && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-emerald-700">AI 재분석 결과</p>
                  {resubmitAnalysis.needs_level && (
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                      resubmitAnalysis.needs_level === '상' ? 'bg-red-500 text-white' :
                      resubmitAnalysis.needs_level === '중' ? 'bg-orange-400 text-white' :
                      'bg-blue-400 text-white'
                    }`}>니즈 {resubmitAnalysis.needs_level}</span>
                  )}
                </div>
                <p className="text-sm text-gray-700">{resubmitAnalysis.summary}</p>
                <p className={`text-xs font-semibold ${resubmitAnalysis.all_passed ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {resubmitAnalysis.all_passed ? '✅ 모든 체크리스트 통과' : '⚠ 일부 체크리스트 미완료'}
                </p>
              </div>
            )}

            <button type="button" onClick={handleResubmitSubmit} disabled={resubmitting || resubmitAnalyzing}
              className="w-full py-4 bg-[#1B2A45] text-white text-sm font-bold rounded-xl hover:bg-[#1B2A45]/90 transition-colors disabled:opacity-50">
              {resubmitting ? '제출 중...' : '재심사 제출 →'}
            </button>
          </div>
        </div>
      )}

      {/* 직원정보 비밀번호 게이트 모달 */}
      {showPwGate && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div>
              <h3 className="text-base font-black text-[#1B2A45]">🔒 직원정보 확인</h3>
              <p className="text-xs text-gray-400 mt-1">개인정보 보호를 위해 비밀번호를 입력하세요</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">비밀번호</label>
              <input
                type="password"
                value={pwGateInput}
                onChange={e => { setPwGateInput(e.target.value); setPwGateError('') }}
                onKeyDown={e => { if (e.key === 'Enter') verifyPwGate() }}
                placeholder="로그인 비밀번호 입력"
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/30"
              />
              {pwGateError && <p className="text-xs text-red-500 mt-1.5">{pwGateError}</p>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={verifyPwGate}
                disabled={pwGateLoading}
                className="flex-1 py-3 bg-[#1B2A45] text-white text-sm font-bold rounded-xl hover:bg-[#1B2A45]/90 disabled:opacity-50">
                {pwGateLoading ? '확인 중...' : '확인'}
              </button>
              <button
                type="button"
                onClick={() => setShowPwGate(false)}
                className="px-5 py-3 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-[#1B2A45] px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <Link href="/" className="relative h-8 w-24 shrink-0 block">
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain object-left brightness-0 invert" unoptimized />
        </Link>
        <span className="text-white/60 text-xs font-medium">발굴팀 · {userName}</span>
        <button onClick={() => setMenuOpen(!menuOpen)}
          className={`flex flex-col gap-[5px] p-2 rounded-lg transition-colors ${menuOpen ? 'bg-white/20' : 'hover:bg-white/10'}`}>
          <span className={`block w-5 h-0.5 bg-white/80 transition-all origin-center ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white/80 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white/80 transition-all origin-center ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-2 min-w-[160px]">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[10px] text-[#C5A258] font-bold uppercase mb-0.5">발굴팀</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#1B2A45]">{userName}</p>
                  <button onClick={async () => {
                    try { sessionStorage.removeItem('pin_verified') } catch {}
                    await signOut({ redirect: false })
                    window.location.replace('/login')
                  }} className="text-xs text-gray-400 hover:text-red-500 font-medium">로그아웃</button>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      {/* 탭바 */}
      <div className="bg-white border-b border-gray-200 flex sticky top-[52px] z-20 shadow-sm">
        {([
          { key: 'dig'     as Tab, label: '발굴탭' },
          { key: 'profile' as Tab, label: '직원정보' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => handleTabClick(t.key)}
            className={`flex-1 py-3 text-base font-semibold transition-colors relative ${activeTab === t.key ? 'text-[#1B2A45]' : 'text-gray-400 hover:text-gray-600'}`}>
            {t.label}{t.key === 'profile' && !profileUnlocked ? ' 🔒' : ''}
            {activeTab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B2A45] rounded-t-full" />}
          </button>
        ))}
      </div>

      {/* ══════ 직원정보 탭 ══════ */}
      {activeTab === 'profile' && (
        <div className="px-4 py-4"><MyProfileTab /></div>
      )}

      {/* ══════ 발굴탭 ══════ */}
      {activeTab === 'dig' && (
        <div className="p-3 space-y-3">

          {/* 인사 배너 (전체 너비) */}
          <div className="bg-[#1B2A45] rounded-2xl px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-white/50 text-xs">{dateLabel}</p>
              <h2 className="text-white text-lg font-black">{userName}님, 안녕하세요 👋</h2>
            </div>
            {bonusCount > 0 && (
              <div className="text-right">
                <p className="text-[#C5A258] text-xs font-bold">오늘 인센티브</p>
                <p className="text-[#C5A258] text-base font-black">+{bonusAmount.toLocaleString()}원</p>
              </div>
            )}
          </div>

          {/* ⚖️ 법적 고지 배너 */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3">
            <p className="text-amber-800 text-xs font-black mb-1">📢 통화 전 필수 공지사항</p>
            <p className="text-amber-700 text-[11px] leading-relaxed">
              통화 시작 즉시 <strong>소속(헌드레드컨설팅 OOO)·목적(무료 상담 안내)·출처(네이버)</strong>를 반드시 먼저 고지하세요.
              거절 의사 1회라도 표현 시 즉시 통화 종료. 문자·카카오톡 자료 전송 금지. 확정·과장 표현 금지.
            </p>
          </div>

          {/* ─────────── 3컬럼 본문 ─────────── */}
          <div className="grid grid-cols-[3fr_5fr_3fr] gap-3 items-start">

            {/* ━━ 좌 : 현황 박스 ━━ */}
            <div className="space-y-3">

              {/* 오늘 목표 */}
              <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3">
                <p className="text-gray-400 text-xs mb-1.5">오늘 목표 (일 {DAILY_GOAL}건)</p>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div className="bg-emerald-400 h-2.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (todayApproved / DAILY_GOAL) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-black text-gray-700 shrink-0">{todayApproved}/{DAILY_GOAL}</span>
                </div>
                {todayApproved >= DAILY_GOAL
                  ? <p className="text-emerald-600 text-xs font-bold">🎉 오늘 목표 달성!</p>
                  : <p className="text-gray-400 text-xs">목표까지 {DAILY_GOAL - todayApproved}건 남음</p>
                }
              </div>

              {/* 승인요청중 */}
              <StatusBox
                icon="⏳" label="승인요청중" count={pendingList.length}
                colorCls="bg-amber-50 border-amber-200" headerCls="bg-amber-100/60" textCls="text-amber-700"
                dotCls="bg-amber-400" items={pendingList}
              />

              {/* 승인완료 */}
              <StatusBox
                icon="✅" label="승인완료" count={approvedList.length}
                colorCls="bg-emerald-50 border-emerald-200" headerCls="bg-emerald-100/60" textCls="text-emerald-700"
                dotCls="bg-emerald-400" items={approvedList}
              />

              {/* 승인부결 */}
              <StatusBox
                icon="❌" label="승인부결" count={rejectedList.length}
                colorCls="bg-red-50 border-red-200" headerCls="bg-red-100/60" textCls="text-red-600"
                dotCls="bg-red-400" items={rejectedList} showComment
                onItemClick={p => setResubmitProspect(p as Prospect)}
              />

            </div>

            {/* ━━ 중앙 : 등록 폼 ━━ */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <h3 className="text-sm font-black text-[#1B2A45] mb-3">📝 가망 등록</h3>
              <form onSubmit={handleSubmitClick} className="space-y-3">

                <div>
                  <label className={lblCls}>업체명</label>
                  <input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
                    placeholder="(주)헌드레드컨설팅" className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>
                    010 번호 <span className="text-red-500">*</span>
                    {phoneVerified
                      ? <span className="ml-1.5 text-emerald-600 font-bold">✅ 중복검색 완료</span>
                      : <span className="ml-1.5 text-amber-500 font-bold">🔒 우측에서 번호 검색 먼저!</span>
                    }
                  </label>
                  <input
                    value={form.phone_010}
                    readOnly
                    placeholder="→ 우측에서 번호 검색 후 자동 입력"
                    required
                    type="tel"
                    className={`${inputCls} cursor-not-allowed ${!phoneVerified ? 'bg-gray-100 text-gray-400' : 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'}`}
                  />
                </div>
                <div>
                  <label className={lblCls}>대표 성함</label>
                  <input value={form.ceo_name} onChange={e => setForm(p => ({ ...p, ceo_name: e.target.value }))}
                    placeholder="홍길동" className={inputCls} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'business_age',       label: '업력',           ph: '3년' },
                    { key: 'annual_revenue',     label: '연매출',         ph: '5억' },
                    { key: 'industry',           label: '업종',           ph: '제조업' },
                    { key: 'credit_score',       label: '신용점수',       ph: '780점' },
                    { key: 'delinquency_detail', label: '연체·체납',      ph: '없음 / 500만원' },
                    { key: 'required_fund',      label: '필요자금',       ph: '1억' },
                    { key: 'preferred_call_time', label: '통화 희망시간', ph: '내일 오전 10시' },
                  ] as const).map(f => (
                    <div key={f.key} className={f.key === 'preferred_call_time' ? 'col-span-2' : ''}>
                      <label className={lblCls}>{f.label}{f.key === 'preferred_call_time' && <span className="text-amber-500 ml-1">★ 체크요건</span>}</label>
                      <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.ph} className={inputCls} />
                      {f.key === 'preferred_call_time' && (
                        <label className={`mt-2 flex items-center gap-2 cursor-pointer select-none ${urgentAssign ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                          <input
                            type="checkbox"
                            checked={urgentAssign}
                            onChange={e => setUrgentAssign(e.target.checked)}
                            className="w-4 h-4 accent-red-500"
                          />
                          <span className="text-sm">🚨 긴급 배정 요청 — 바로 연락 필요 (대표님께 즉시 알림)</span>
                        </label>
                      )}
                    </div>
                  ))}
                </div>

                {/* 체크리스트 */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-black text-[#1B2A45]">체크리스트</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${checklistAllDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                      {checkDoneCount}/5{checklistAllDone ? ' ✓' : ''}
                    </span>
                  </div>
                  {/* 법적 고지 3항목 (상단 강조) */}
                  <div className="border border-amber-300 rounded-lg px-2 py-1.5 mb-1 bg-amber-50">
                    <p className="text-[10px] text-amber-700 font-black mb-1">⚖️ 법적 필수 — 통화 시작 즉시 고지</p>
                    {CHECKLIST_ITEMS.filter(i => i.legal).map(item => (
                      <label key={item.key} className={`flex items-start gap-2 p-1.5 rounded-lg border cursor-pointer transition-colors mb-1 last:mb-0 ${
                        checklist[item.key] ? 'bg-amber-100 border-amber-400' : 'bg-white border-amber-200'
                      }`}>
                        <input type="checkbox" checked={checklist[item.key]}
                          onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                          className="w-4 h-4 accent-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className={`text-xs font-bold leading-snug ${checklist[item.key] ? 'text-amber-800' : 'text-amber-700'}`}>{item.label}</p>
                          <p className="text-[10px] text-amber-600 leading-snug mt-0.5">{item.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {/* 나머지 체크리스트 항목 */}
                  {CHECKLIST_ITEMS.filter(i => !i.legal).map(item => (
                    <label key={item.key} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                      checklist[item.key] ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200'
                    }`}>
                      <input type="checkbox" checked={checklist[item.key]}
                        onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                        className="w-4 h-4 accent-emerald-600 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className={`text-xs font-bold leading-snug ${checklist[item.key] ? 'text-emerald-700' : 'text-gray-700'}`}>{item.label}</p>
                        <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{item.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {!checklistAllDone && (
                  <p className="text-xs text-amber-600 font-semibold text-center">
                    ⚠ 체크리스트 {checkDoneCount}/{CHECKLIST_ITEMS.length} — 모두 완료해야 전송 가능합니다
                  </p>
                )}
                <button type="submit" disabled={!phoneVerified || !form.phone_010.trim() || !checklistAllDone}
                  className={`w-full py-4 rounded-xl font-black text-sm transition-colors ${
                    !phoneVerified || !form.phone_010.trim() || !checklistAllDone
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-[#1B2A45] text-white hover:bg-[#1B2A45]/90'
                  }`}>
                  {!phoneVerified ? '🔒 번호 중복검색 먼저' : !checklistAllDone ? `🔒 체크리스트 ${checkDoneCount}/${CHECKLIST_ITEMS.length} 미완료` : '전송 →'}
                </button>
              </form>
            </div>

            {/* ━━ 우 : 번호검색 + 스크립트 ━━ */}
            <div className="space-y-3">

              {/* 가망 번호 검색 */}
              <div className="bg-white border-2 border-[#1B2A45]/15 rounded-2xl p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-black text-[#1B2A45]">📞 가망 번호 검색</h3>
                  <p className="text-xs text-gray-400 mt-0.5">통화 전 전체 DB 중복 먼저 확인!</p>
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="tel"
                    value={phoneSearch}
                    onChange={e => { setPhoneSearch(e.target.value); setPhoneResults(null); setPhoneVerified(false) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doPhoneSearch() } }}
                    placeholder="010-0000-0000"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1B2A45]/40 bg-white"
                  />
                  <button type="button" onClick={doPhoneSearch} disabled={phoneSearching}
                    className="w-full py-2.5 bg-[#1B2A45] text-white text-xs font-bold rounded-xl hover:bg-[#1B2A45]/90 disabled:opacity-50">
                    {phoneSearching ? '검색 중...' : '검색'}
                  </button>
                </div>

                {phoneResults !== null && (
                  phoneResults.length === 0 ? (
                    <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl px-4 py-3">
                      <p className="text-emerald-700 font-bold text-sm">✅ 없는 번호 — 등록 가능!</p>
                      <p className="text-emerald-600 text-xs mt-0.5">번호가 좌측 폼에 자동 입력됐습니다.</p>
                    </div>
                  ) : (
                    <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 space-y-2">
                      <p className="text-red-700 font-black text-sm">🚫 등록 불가 — 이미 DB에 있음 ({phoneResults.length}건)</p>
                      <p className="text-red-600 text-xs">이 번호는 등록할 수 없습니다. 다른 번호를 검색하세요.</p>
                      {phoneResults.map((r, i) => (
                        <div key={i} className="bg-white border border-red-200 rounded-lg px-3 py-2">
                          <p className="font-bold text-xs text-gray-800 truncate">{r.company || '(업체명 없음)'}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                            {r.source === 'customer' ? '영업 고객' : '발굴 가망'} · {r.phone_010}
                          </p>
                          <p className="text-[11px] text-gray-400">{r.status}</p>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

              {/* 스크립트 */}
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-black text-[#1B2A45]">📄 TM 스크립트</h3>
                </div>
                <div className="p-3 space-y-2">
                  {SCRIPT_SECTIONS.map((sec, idx) => {
                    const c = SCRIPT_COLOR[sec.color]
                    return (
                      <div key={idx} className={`border rounded-xl overflow-hidden ${c.border}`}>
                        <button type="button" onClick={() => setOpenScriptIdx(openScriptIdx === idx ? null : idx)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-left font-bold text-xs ${c.header}`}>
                          <span>{sec.label}</span>
                          <span>{openScriptIdx === idx ? '▲' : '▼'}</span>
                        </button>
                        {openScriptIdx === idx && (
                          <div className="px-3 py-3 border-t border-gray-100 bg-white space-y-2">
                            {'rows' in sec
                              ? sec.rows!.map((row, i) => (
                                <div key={i} className="flex gap-2 py-1.5 border-b border-gray-50 last:border-0">
                                  <span className="shrink-0 text-xs font-bold text-red-600 w-[72px] leading-snug">{row.q}</span>
                                  <p className="text-xs text-gray-700 leading-snug">{row.a}</p>
                                </div>
                              ))
                              : sec.content!.map((item, i) => (
                                <p key={i} className={`text-xs leading-relaxed ${item.bold ? 'font-bold text-gray-800' : 'text-gray-600'}`}>
                                  {item.text}
                                </p>
                              ))
                            }
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>{/* end 3-col */}
          <div className="h-6" />
        </div>
      )}
    </div>
  )
}

/* 현황 박스 컴포넌트 */
function StatusBox({
  icon, label, count, colorCls, headerCls, textCls, dotCls, items, showComment, onItemClick,
}: {
  icon: string; label: string; count: number
  colorCls: string; headerCls: string; textCls: string; dotCls: string
  items: { id: string; company: string; ceo_name: string; phone_010: string; ceo_comment?: string }[]
  showComment?: boolean
  onItemClick?: (item: { id: string; company: string; ceo_name: string; phone_010: string; ceo_comment?: string }) => void
}) {
  return (
    <div className={`border-2 rounded-2xl overflow-hidden ${colorCls}`}>
      <div className={`px-4 py-3 ${headerCls}`}>
        <p className={`text-xs font-bold uppercase tracking-wide ${textCls}`}>{icon} {label}</p>
        <p className={`text-3xl font-black leading-none mt-0.5 ${textCls}`}>
          {count}<span className="text-sm font-bold ml-1">건</span>
        </p>
      </div>
      <div className="px-4 py-2 space-y-1.5 min-h-[52px]">
        {items.length === 0
          ? <p className={`text-xs py-1 opacity-50 ${textCls}`}>없음</p>
          : items.slice(0, 5).map(p => (
            <div key={p.id}
              className={`flex items-start gap-1.5 ${onItemClick ? 'cursor-pointer group' : ''}`}
              onClick={() => onItemClick?.(p)}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dotCls}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-700 truncate">{p.company || p.ceo_name || p.phone_010}</p>
                {showComment && p.ceo_comment && (
                  <p className="text-[10px] text-red-400 truncate">{p.ceo_comment}</p>
                )}
                {onItemClick && (
                  <p className="text-[10px] text-red-500 font-semibold group-hover:underline">재심사 제출 →</p>
                )}
              </div>
            </div>
          ))
        }
        {items.length > 5 && <p className={`text-xs opacity-50 ${textCls}`}>+{items.length - 5}건 더</p>}
      </div>
    </div>
  )
}
