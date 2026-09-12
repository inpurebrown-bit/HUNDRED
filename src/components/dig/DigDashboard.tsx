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

const CHECKLIST_ITEMS = [
  { key: 'needs_check',       label: '정책자금 니즈 확인',  desc: '"혹시 정책자금 알아보신 적 있으시거나 필요하세요?"' },
  { key: 'basic_info',        label: '기본 정보 수집',      desc: '업력 / 연매출 / 업종 / 연체·체납 / 신용점수 / 대표자 성함' },
  { key: 'purpose_explained', label: '취지 설명',           desc: '무료 컨설팅, 들어보고 좋으면 비용 지불, 아니면 자료만 받아도 됨' },
  { key: 'closing_done',      label: '클로징 멘트',         desc: '"저희 매니저님이 내일 연락드려서 무료 상담 진행해드릴 겁니다"' },
  { key: 'phone_secured',     label: '010 번호 확보',       desc: '통화 가능한 010 번호 확보 필수' },
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
    label: 'STEP 1 — 도입부', color: 'blue' as const,
    content: [
      { bold: true,  text: '"안녕하세요 대표님~ 000 기업 대표님 맞으실까요~?"' },
      { bold: false, text: '(대표 아닌 경우) → "아 그러세요~ 그럼 다음에 연락드릴게요~"' },
      { bold: false, text: '"최근 정부에서 사업가·기업들을 대상으로 여러 지원 혜택들이 많이 나와서 연락드렸습니다. 저희는 헌드레드컨설팅이라는 경영자문 회사입니다."' },
      { bold: false, text: '"최근 000 업종에 대해서 나라에서 많은 지원을 해주고 있는데요! 정책자금이 업종별로 하반기 막받이라서 혜택 못 받고 지나치시는 분들이 많아서 안내드리고 있거든요~"' },
      { bold: true,  text: '"혹시 지금 정책자금 알아보신 적 있으시거나 사용하고 계신 게 있으세요?"' },
    ],
  },
  {
    label: '초반 반론 대응', color: 'red' as const,
    rows: [
      { q: '바빠요 / 됐어요',  a: '"아 바쁘시죠~ 연락처만 주시면 편한 시간에 매니저가 연락드릴게요."' },
      { q: '필요없어요',        a: '"무료라서 자료만 받아보셔도 되시구요~ 미리 진단만 받아 놓으셔도 나중에 정부자금 사용하실 때 큰 도움이 됩니다!"' },
      { q: '이미 쓰고 있어요', a: '"기관마다 중복으로 추가 가능한 것도 있어서 보통 1년에 3~4번씩 받아가신다고 하는데요~"' },
      { q: '사기 같아요',       a: '"먼저 무료 컨설팅이고 진행 원하실 때만 비용 발생해요~ 결정은 자금이 나올 수 있는지 듣고 결정하시는 거라서 마음 편하실 거에요~"' },
      { q: '문자 남겨주세요',   a: '"문자로는 정확한 안내가 어려워서요~ 연락처 주시면 상담사가 딱 5분만 설명드릴게요."' },
    ],
  },
  {
    label: 'STEP 2 — 니즈 분기 & 정보 수집', color: 'green' as const,
    content: [
      { bold: false, text: '(니즈 있을 때) "아 그러세요~ 그럼 혹시 어디서 받으셨어요? 기관마다 추가로 활용 가능 자금도 많이있거든요~"' },
      { bold: false, text: '(니즈 없을 때) "시중 은행보다도 금리가 낮은 정부정책자금을 활용하시면 1년에 수백만 원 이자비용 아끼실 수 있어요~"' },
      { bold: true,  text: '순서: 업력 → 연매출 → 연체·체납 → 업종 → 필요자금 → 신용점수' },
    ],
  },
  {
    label: 'STEP 3 — 취지 설명 + 번호 확보', color: 'purple' as const,
    content: [
      { bold: false, text: '"말씀 감사드려요~ 우선 대표님이 정책자금 어떤 기관에서 어떤 상품으로 들어가고, 한도는 얼마나 나올 것 같은지, 금리는 몇%대로 나올 것 같은지에 대해 저희 컨설턴트님이 자세히 무료상담 도와드릴거에요!"' },
      { bold: true,  text: '"저희 전문 컨설턴트님이 내일 오후에 자세히 안내드릴건데, 받아보실 번호가 010에 몇번이실까요?"' },
      { bold: true,  text: '"아 그리고 대표님 성함은 어떻게 되세요~?"' },
    ],
  },
]

const SCRIPT_COLOR: Record<string, { header: string; border: string }> = {
  blue:   { header: 'bg-blue-50 text-blue-800',     border: 'border-blue-200' },
  red:    { header: 'bg-red-50 text-red-800',        border: 'border-red-200' },
  green:  { header: 'bg-emerald-50 text-emerald-800', border: 'border-emerald-200' },
  purple: { header: 'bg-purple-50 text-purple-800', border: 'border-purple-200' },
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
  const fileRef = useRef<HTMLInputElement>(null)

  const [phoneSearch, setPhoneSearch]       = useState('')
  const [phoneResults, setPhoneResults]     = useState<any[] | null>(null)
  const [phoneSearching, setPhoneSearching] = useState(false)

  const [form, setForm] = useState({
    company: '', ceo_name: '', phone: '', phone_010: '',
    business_age: '', annual_revenue: '', industry: '',
    delinquency_detail: '', credit_score: '', required_fund: '',
  })
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    needs_check: false, basic_info: false, purpose_explained: false,
    closing_done: false, phone_secured: false,
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

  async function doPhoneSearch() {
    const clean = phoneSearch.replace(/[^0-9]/g, '')
    if (clean.length < 9) { showToast('번호를 9자리 이상 입력하세요', 'error'); return }
    setPhoneSearching(true)
    setPhoneResults(null)
    try {
      const res  = await fetch(`/api/phone-search?phone=${clean}`)
      const data = await res.json()
      setPhoneResults(data.results || [])
    } catch { showToast('검색 중 오류', 'error') }
    setPhoneSearching(false)
  }

  function fillFromSearch(r: any) {
    setForm(p => ({
      ...p,
      phone_010: r.phone_010 || p.phone_010,
      company:   r.company   || p.company,
      ceo_name:  r.ceo_name  || p.ceo_name,
    }))
    setPhoneResults(null)
    setPhoneSearch('')
    showToast('폼에 자동 입력됐습니다')
  }

  async function handleRecordingChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
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
        if (data.analysis && !data.analysis.parse_error) {
          setAnalysis(data.analysis)
          if (data.analysis.checklist)     setChecklist(prev => ({ ...prev, ...data.analysis.checklist }))
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
          showToast('AI 분석 완료! 체크리스트·정보가 자동 입력됐습니다')
        } else {
          showToast('AI 분석 실패 — 직접 입력해주세요', 'error')
        }
      } catch { showToast('AI 분석 중 오류 — 직접 입력해주세요', 'error') }
      setAnalyzing(false)
    }
  }

  function handleSubmitClick(e: React.FormEvent) {
    e.preventDefault()
    if (!form.phone_010.trim()) { showToast('010 번호는 필수입니다', 'error'); return }
    setRecordingFile(null); setAnalysis(null)
    if (fileRef.current) fileRef.current.value = ''
    setShowRecordingModal(true)
  }

  async function handleFinalSubmit() {
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
          required_fund: form.required_fund, memo: form.delinquency_detail.trim(), checklist,
          recording_url, recording_filename, recording_analysis: analysis || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('가망 등록 완료! 대표님 심사를 기다려주세요')
        setForm({ company: '', ceo_name: '', phone: '', phone_010: '', business_age: '', annual_revenue: '', industry: '', delinquency_detail: '', credit_score: '', required_fund: '' })
        setChecklist({ needs_check: false, basic_info: false, purpose_explained: false, closing_done: false, phone_secured: false })
        setRecordingFile(null); setAnalysis(null)
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
        <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/60">
          <div className="bg-white rounded-t-2xl w-full max-w-lg px-5 pt-5 pb-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1B2A45]">녹취 파일 첨부</h3>
                <p className="text-xs text-gray-400 mt-0.5">첨부 시 AI 분석 + 대표님 심사에 활용됩니다 (선택)</p>
              </div>
              <button type="button" onClick={() => setShowRecordingModal(false)} className="text-gray-400 hover:text-gray-600 text-xl p-1">✕</button>
            </div>
            <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg" onChange={handleRecordingChange} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 text-center hover:border-[#1B2A45]/30 transition-colors">
              {recordingFile
                ? <span className="text-sm text-gray-700 font-medium">{recordingFile.name}</span>
                : <><p className="text-sm text-gray-400">+ 녹취 파일 선택</p><p className="text-xs text-gray-300 mt-0.5">mp3, m4a, wav, aac 등</p></>}
            </button>
            {analyzing && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-blue-700">AI가 통화 내용 분석 중...</p>
              </div>
            )}
            {analysis && !analysis.parse_error && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                <p className="text-xs font-bold text-emerald-700">AI 분석 결과</p>
                <p className="text-sm text-gray-700">{analysis.summary}</p>
                {analysis.feedback && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{analysis.feedback}</p>}
                <p className={`text-xs font-semibold ${analysis.all_passed ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {analysis.all_passed ? '✅ 모든 체크리스트 통과' : '⚠ 일부 체크리스트 미완료'}
                </p>
              </div>
            )}
            <button type="button" onClick={handleFinalSubmit} disabled={submitting || analyzing}
              className="w-full py-4 bg-[#1B2A45] text-white text-sm font-bold rounded-xl hover:bg-[#1B2A45]/90 transition-colors disabled:opacity-50">
              {uploading ? '업로드 중...' : submitting ? '제출 중...' : recordingFile ? '녹취 포함 제출' : '녹취 없이 제출'}
            </button>
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
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-3 text-base font-semibold transition-colors relative ${activeTab === t.key ? 'text-[#1B2A45]' : 'text-gray-400 hover:text-gray-600'}`}>
            {t.label}
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
                  <label className={lblCls}>010 번호 <span className="text-red-500">*</span></label>
                  <input value={form.phone_010} onChange={e => setForm(p => ({ ...p, phone_010: e.target.value }))}
                    placeholder="010-0000-0000" required type="tel" className={inputCls} />
                </div>
                <div>
                  <label className={lblCls}>대표 성함</label>
                  <input value={form.ceo_name} onChange={e => setForm(p => ({ ...p, ceo_name: e.target.value }))}
                    placeholder="홍길동" className={inputCls} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'business_age',     label: '업력',     ph: '3년' },
                    { key: 'annual_revenue',   label: '연매출',   ph: '5억' },
                    { key: 'industry',         label: '업종',     ph: '제조업' },
                    { key: 'credit_score',     label: '신용점수', ph: '780점' },
                    { key: 'delinquency_detail', label: '연체·체납', ph: '없음 / 500만원' },
                    { key: 'required_fund',    label: '필요자금', ph: '1억' },
                  ] as const).map(f => (
                    <div key={f.key}>
                      <label className={lblCls}>{f.label}</label>
                      <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.ph} className={inputCls} />
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
                  {CHECKLIST_ITEMS.map(item => (
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

                <button type="submit" disabled={!form.phone_010.trim()}
                  className={`w-full py-4 rounded-xl font-black text-sm transition-colors ${
                    !form.phone_010.trim()
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : checklistAllDone
                        ? 'bg-[#1B2A45] text-white hover:bg-[#1B2A45]/90'
                        : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}>
                  {checklistAllDone ? '전송 →' : '전송 (체크리스트 미완료)'}
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
                    onChange={e => { setPhoneSearch(e.target.value); setPhoneResults(null) }}
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
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <p className="text-emerald-700 font-bold text-sm">✅ 없는 번호입니다</p>
                      <p className="text-emerald-600 text-xs mt-0.5">바로 인콜 진행 가능!</p>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                      <p className="text-red-700 font-bold text-xs">⚠️ 이미 DB에 있음 ({phoneResults.length}건)</p>
                      {phoneResults.map((r, i) => (
                        <div key={i} className="bg-white border border-red-100 rounded-lg px-3 py-2">
                          <p className="font-bold text-xs text-gray-800 truncate">{r.company || '(업체명 없음)'}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                            {r.source === 'customer' ? '영업 고객' : '발굴 가망'} · {r.phone_010}
                          </p>
                          <p className="text-[11px] text-gray-400">{r.status}</p>
                          <button onClick={() => fillFromSearch(r)}
                            className="mt-1 text-[10px] text-[#1B2A45] border border-[#1B2A45]/30 rounded px-2 py-0.5 hover:bg-[#1B2A45]/10">
                            폼에 입력
                          </button>
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
  icon, label, count, colorCls, headerCls, textCls, dotCls, items, showComment,
}: {
  icon: string; label: string; count: number
  colorCls: string; headerCls: string; textCls: string; dotCls: string
  items: { id: string; company: string; ceo_name: string; phone_010: string; ceo_comment?: string }[]
  showComment?: boolean
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
            <div key={p.id} className="flex items-start gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dotCls}`} />
              <div className="min-w-0">
                <p className="text-xs text-gray-700 truncate">{p.company || p.ceo_name || p.phone_010}</p>
                {showComment && p.ceo_comment && (
                  <p className="text-[10px] text-red-400 truncate">{p.ceo_comment}</p>
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
