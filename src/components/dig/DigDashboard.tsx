'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { signOut } from 'next-auth/react'

interface Props {
  userId: string
  userName: string
  username: string
}

type Tab = 'submit' | 'mylist' | 'script'

const DAILY_GOAL = 8
const BONUS_PER_EXTRA = 10000

const CHECKLIST_ITEMS = [
  { key: 'needs_check', label: '정책자금 니즈 확인', shortLabel: '니즈 확인', desc: '"혹시 지금 정책자금 알아보신 적 있으시거나 필요하세요?"' },
  { key: 'basic_info', label: '기본 정보 수집', shortLabel: '정보 수집', desc: '업력 / 연매출 / 업종 / 연체·체납 / 신용점수 / 대표자 성함' },
  { key: 'purpose_explained', label: '취지 설명', shortLabel: '취지 설명', desc: '무료 컨설팅, 들어보고 좋으면 비용 지불, 아니면 자료만 받아도 됨' },
  { key: 'closing_done', label: '클로징 멘트', shortLabel: '클로징', desc: '"저희 컨설팅 매니저님이 내일 연락드려서 무료 상담 진행해드릴 겁니다"' },
  { key: 'phone_secured', label: '010 번호 확보', shortLabel: '010 확보', desc: '통화 가능한 010 번호 확보' },
]

const SCRIPT_SECTIONS = [
  {
    title: '도입부',
    color: 'blue',
    content: `"안녕하세요 대표님~ 000 기업 대표님 맞으실까요~?"

(대표 아닌 경우) → "아 그러세요~ 그럼 다음에 연락드릴게요~"
(대표자 확인) → 아래 이어서 진행

"최근 정부에서 사업가·기업들을 대상으로 여러 지원 혜택들이 많이 나와서 연락드렸습니다.
저희는 헌드레드컨설팅이라는 경영자문 회사입니다.

최근 000 업종에 대해서 나라에서 많은 지원을 해주고 있는데요!
요즘 정책자금이 업종별로 하반기 막받이라서 혜택 못 받고 지나치시는 분들이 많아서 안내드리고 있거든요~

정책자금은 사업자분들 대상으로 은행보다도 낮은 금리에 담보 없이도 사업자만 보고 주는 자금들이 있고요,
보통 최소 1천만 원에서 1억 이상까지도 나오는데

혹시 지금 정책자금 알아보신 적 있으시거나 사용하고 계신 게 있으세요?"`
  },
  {
    title: '니즈 있을 때',
    color: 'green',
    content: `"아 그러세요~ 그럼 혹시 어디서 받으셨어요?
아아 잘하셨네요~! ㅎㅎ 근데 한번 받으신다고 더 못받는게 아니라, 기관마다 추가로 활용 가능 자금도 많이있거든요~
보통 저희 대표님들은 1년에 3~4번도 타가시는분들 많습니다 ㅎㅎ"`
  },
  {
    title: '니즈 없을 때',
    color: 'orange',
    content: `"아 그러시군요~ 대부분 사업하시면서 자금이 많이 필요하실텐데 캐피탈 같은 고금리가 아니라 시중 은행보다도 금리가 낮은 정부정책자금을 활용하시면 1년에 수백만 원 이자비용 아끼시기 때문에 활용하시는 거거든요~?"

→ 아래 순서대로 질문:
• "혹시 사업 시작하신 지 얼마나 되셨어요?" (업력)
• "연매출은 대략 어느 정도 되세요?"
• "혹시 세금 체납이나 대출 연체, 카드연체 같은 건 없으시죠?"
• "그럼 업종이 000 맞나요?"
• "필요하신 자금은 얼마 정도이실까요?"
• "신용점수는 대략 몇점이실까요~?"`
  },
  {
    title: '취지 설명 + 번호 확보',
    color: 'purple',
    content: `"말씀 감사드려요~ 우선 대표님이 정책자금 어떤 기관에서 어떤 상품으로 들어가고,
한도는 얼마나 나올 것 같은지, 금리는 몇%대로 나올 것 같은지에 대해
저희가 컨설팅 매니저님이 자세히 무료상담 도와드릴거에요!

저희 전문 컨설턴트님이 내일 오후에 자세히 안내드릴건데, 받아보실 번호가 010에 몇번이실까요?

"네 제가 문자로 저희 회사 자료 남겨드릴테니, 한번 검토해주시고 내일 오후에 안내 잘 받아보십쇼! ㅎㅎ
아 그리고 대표님 성함은 어떻게 되세요~?"`
  },
  {
    title: '반론 대응',
    color: 'red',
    content: `▶ "바빠요 / 됐어요"
"아 바쁘시죠~ 연락처만 주시면 편한 시간에 매니저가 연락드릴게요. 010~"

▶ "필요없어요 / 관심없어요"
"아 그러세요~ 무료라서 자료만 받아보셔도 되시구요~ 미리 진단만 받아 놓으셔도 나중에 자금 필요하실 때 고금리가 아니라 정부자금 사용하시는 게 금리도 낮고 부담이 없으시기 때문에 도움이 무조건 되실 겁니다!"

▶ "이미 쓰고 있어요"
"아 사용하고 계시군요~ 기관마다 중복으로 추가 가능한 것도 있어서 보통 1년 동안 3~4번씩 받아가신다고 하는데요~"

▶ "사기 같아요"
"먼저 무료 컨설팅이고 진행 원하실 때만 비용 발생해요~ 결정은 자금이 나올 수 있는지 듣고 결정하시는 거라서 마음 편하실 거에요~"

▶ "문자 남겨주세요"
"문자로는 정확한 안내가 어려워서요~ 연락처 주시면 상담사가 딱 5분만 설명드릴게요."`
  },
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

export default function DigDashboard({ userId, userName, username }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('submit')
  const [menuOpen, setMenuOpen] = useState(false)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [scriptOpen, setScriptOpen] = useState<number | null>(null)
  const [showRecordingModal, setShowRecordingModal] = useState(false)

  const [form, setForm] = useState({
    company: '', ceo_name: '', phone: '', phone_010: '',
    business_age: '', annual_revenue: '', industry: '',
    has_delinquency: false, credit_score: '', required_fund: '', memo: '',
  })
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    needs_check: false, basic_info: false, purpose_explained: false,
    closing_done: false, phone_secured: false,
  })
  const [recordingFile, setRecordingFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadProspects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dig-prospects')
      const data = await res.json()
      setProspects(data.prospects || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadProspects() }, [loadProspects])
  useEffect(() => { if (activeTab === 'mylist') loadProspects() }, [activeTab, loadProspects])

  const today = new Date().toISOString().slice(0, 10)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const todayApproved = prospects.filter(p => p.call_date === today && (p.status === 'approved' || p.status === 'assigned')).length
  const monthApproved = prospects.filter(p => p.call_date?.startsWith(currentMonth) && (p.status === 'approved' || p.status === 'assigned')).length
  const bonusCount = Math.max(0, todayApproved - DAILY_GOAL)
  const bonusAmount = bonusCount * BONUS_PER_EXTRA
  const checklistAllDone = Object.values(checklist).every(Boolean)

  async function handleRecordingChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setRecordingFile(file)
    setAnalysis(null)

    if (file.size > 50 * 1024 * 1024) {
      showToast('파일이 너무 큽니다 (최대 50MB)', 'error')
      return
    }

    if (file.size <= 20 * 1024 * 1024) {
      setAnalyzing(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/analyze-recording', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.analysis && !data.analysis.parse_error) {
          setAnalysis(data.analysis)
          if (data.analysis.checklist) {
            setChecklist(prev => ({ ...prev, ...data.analysis.checklist }))
          }
          if (data.analysis.customer_info) {
            const ci = data.analysis.customer_info
            setForm(prev => ({
              ...prev,
              company: ci.company || prev.company,
              ceo_name: ci.ceo_name || prev.ceo_name,
              phone_010: ci.phone_010 || prev.phone_010,
              business_age: ci.business_age || prev.business_age,
              annual_revenue: ci.annual_revenue || prev.annual_revenue,
              industry: ci.industry || prev.industry,
              credit_score: ci.credit_score || prev.credit_score,
              required_fund: ci.required_fund || prev.required_fund,
              has_delinquency: ci.has_delinquency ?? prev.has_delinquency,
            }))
          }
          showToast('AI 분석 완료! 체크리스트·정보가 자동 입력됐습니다')
        } else {
          showToast('AI 분석 실패 — 직접 입력해주세요', 'error')
        }
      } catch {
        showToast('AI 분석 중 오류 — 직접 입력해주세요', 'error')
      }
      setAnalyzing(false)
    }
  }

  function handleSubmitClick(e: React.FormEvent) {
    e.preventDefault()
    if (!form.phone_010.trim()) {
      showToast('010 번호는 필수입니다', 'error')
      return
    }
    setRecordingFile(null)
    setAnalysis(null)
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
        const res = await fetch('/api/upload-recording', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.url) {
          recording_url = data.url
          recording_filename = data.filename
        } else {
          showToast(data.error || '녹취 업로드 실패', 'error')
          setSubmitting(false)
          setUploading(false)
          return
        }
      } catch {
        showToast('녹취 업로드 중 오류', 'error')
        setSubmitting(false)
        setUploading(false)
        return
      }
      setUploading(false)
    }

    try {
      const res = await fetch('/api/dig-prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          checklist,
          recording_url,
          recording_filename,
          recording_analysis: analysis || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast('가망 등록 완료! 대표님 심사를 기다려주세요')
        setForm({
          company: '', ceo_name: '', phone: '', phone_010: '',
          business_age: '', annual_revenue: '', industry: '',
          has_delinquency: false, credit_score: '', required_fund: '', memo: '',
        })
        setChecklist({
          needs_check: false, basic_info: false, purpose_explained: false,
          closing_done: false, phone_secured: false,
        })
        setRecordingFile(null)
        setAnalysis(null)
        if (fileRef.current) fileRef.current.value = ''
        setShowRecordingModal(false)
      } else {
        showToast(data.error || '등록 실패', 'error')
      }
    } catch {
      showToast('등록 중 오류 발생', 'error')
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white max-w-sm text-center ${
          toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* 녹취 파일 첨부 모달 */}
      {showRecordingModal && (
        <div className="fixed inset-0 z-[9998] flex items-end justify-center bg-black/60">
          <div className="bg-white rounded-t-2xl w-full max-w-lg px-5 pt-5 pb-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1B2A45]">녹취 파일 첨부</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">첨부 시 AI 분석 + 대표님 심사에 활용됩니다 (선택)</p>
              </div>
              <button type="button" onClick={() => setShowRecordingModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1">✕</button>
            </div>

            <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
              onChange={handleRecordingChange} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 text-center hover:border-[#1B2A45]/30 transition-colors">
              {recordingFile ? (
                <span className="text-sm text-gray-700 font-medium">{recordingFile.name}</span>
              ) : (
                <>
                  <p className="text-sm text-gray-400">+ 녹취 파일 선택</p>
                  <p className="text-[11px] text-gray-300 mt-0.5">mp3, m4a, wav, aac 등</p>
                </>
              )}
            </button>

            {analyzing && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-blue-700">AI가 통화 내용 분석 중...</p>
              </div>
            )}

            {analysis && !analysis.parse_error && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                <p className="text-[11px] font-bold text-emerald-700">AI 분석 결과</p>
                <p className="text-sm text-gray-700">{analysis.summary}</p>
                {analysis.feedback && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{analysis.feedback}</p>
                )}
                <p className={`text-[11px] font-semibold ${analysis.all_passed ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {analysis.all_passed ? '✅ 모든 체크리스트 통과' : '⚠ 일부 체크리스트 미완료'}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button type="button"
                onClick={handleFinalSubmit}
                disabled={submitting || analyzing}
                className="flex-1 py-4 bg-[#1B2A45] text-white text-sm font-bold rounded-xl hover:bg-[#1B2A45]/90 transition-colors disabled:opacity-50">
                {uploading ? '업로드 중...' : submitting ? '제출 중...' : recordingFile ? '녹취 포함 제출' : '녹취 없이 제출'}
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
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`flex flex-col gap-[5px] p-2 rounded-lg transition-colors ${menuOpen ? 'bg-white/20' : 'hover:bg-white/10'}`}>
          <span className={`block w-5 h-0.5 bg-white/80 transition-all origin-center ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white/80 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white/80 transition-all origin-center ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-2 min-w-[180px]">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[10px] text-[#C5A258] font-bold tracking-wide uppercase mb-0.5">발굴팀</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#1B2A45]">{userName}</p>
                  <button
                    onClick={async () => {
                      try { sessionStorage.removeItem('pin_verified') } catch {}
                      await signOut({ redirect: false })
                      window.location.replace('/login')
                    }}
                    className="text-[10px] text-gray-400 hover:text-red-500 transition-colors font-medium">
                    로그아웃
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      {/* 탭바 */}
      <div className="bg-white border-b border-gray-200 flex sticky top-[52px] z-20 shadow-sm">
        {([
          { key: 'submit' as Tab, label: '가망 등록' },
          { key: 'mylist' as Tab, label: '내 가망 목록' },
          { key: 'script' as Tab, label: '스크립트' },
        ] as const).map(t => (
          <button key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === t.key ? 'text-[#1B2A45]' : 'text-gray-400 hover:text-gray-600'
            }`}>
            {t.label}
            {activeTab === t.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B2A45] rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      <main className="max-w-xl mx-auto px-4 py-4 space-y-3">

        {/* ══════════ 가망 등록 탭 ══════════ */}
        {activeTab === 'submit' && (
          <>
            {/* 오늘 현황 배너 */}
            <div className="bg-[#1B2A45] rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-white/50 text-[10px] mb-0.5">오늘 {today}</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-2xl font-black text-white">{todayApproved}</p>
                  <p className="text-white/40 text-sm">/ {DAILY_GOAL}</p>
                </div>
                {todayApproved >= DAILY_GOAL
                  ? <p className="text-emerald-400 text-[10px] mt-0.5 font-semibold">목표 달성!</p>
                  : <p className="text-white/30 text-[10px] mt-0.5">목표까지 {DAILY_GOAL - todayApproved}건</p>
                }
              </div>
              {bonusCount > 0 && (
                <div className="bg-[#C5A258]/20 border border-[#C5A258]/40 rounded-xl px-3 py-2 text-right">
                  <p className="text-[#C5A258] text-[10px]">인센티브</p>
                  <p className="text-[#C5A258] text-lg font-black">+{bonusAmount.toLocaleString()}원</p>
                  <p className="text-[#C5A258]/70 text-[9px]">{bonusCount}건 × 1만원</p>
                </div>
              )}
            </div>

            {/* 절대 금지 / 가망 인정 기준 배너 (compact) */}
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-red-700 mb-1">⚠ 절대 금지</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  {['"지원금·공짜" 후킹', '니즈 없는 고객 확보', '번호만 받는 유도', '"100% 된다" 확정'].map((txt, i) => (
                    <p key={i} className="text-[9px] text-red-600 flex items-start gap-0.5 leading-tight">
                      <span className="shrink-0">❌</span>{txt}
                    </p>
                  ))}
                </div>
              </div>
              <div className="w-px bg-red-200 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-emerald-700 mb-1">✅ 가망 기준</p>
                <p className="text-[9px] text-emerald-700 leading-tight">모든 인폼 + 상담사 연결 동의</p>
                <p className="text-[9px] text-emerald-700 leading-tight mt-0.5">번호만 → 다음날 재통화 확정</p>
              </div>
            </div>

            <form onSubmit={handleSubmitClick} className="space-y-3">
              {/* 업체정보 + 체크리스트 2열 */}
              <div className="flex gap-2 items-start">
                {/* 업체정보 (left) — 2열 그리드로 한눈에 */}
                <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 p-3">
                  <h3 className="text-xs font-bold text-[#1B2A45] mb-2">업체 정보</h3>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                    {/* 업체명 — 전체 폭 */}
                    <div className="col-span-2">
                      <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">업체명</label>
                      <input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
                        placeholder="업체명" className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30" />
                    </div>
                    {/* 업력 */}
                    <div>
                      <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">업력</label>
                      <input value={form.business_age} onChange={e => setForm(p => ({ ...p, business_age: e.target.value }))}
                        placeholder="3년" className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30" />
                    </div>
                    {/* 연매출 */}
                    <div>
                      <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">연매출</label>
                      <input value={form.annual_revenue} onChange={e => setForm(p => ({ ...p, annual_revenue: e.target.value }))}
                        placeholder="5억" className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30" />
                    </div>
                    {/* 업종 */}
                    <div>
                      <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">업종</label>
                      <input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
                        placeholder="제조업" className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30" />
                    </div>
                    {/* 신용점수 */}
                    <div>
                      <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">신용점수</label>
                      <input value={form.credit_score} onChange={e => setForm(p => ({ ...p, credit_score: e.target.value }))}
                        placeholder="780점" className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30" />
                    </div>
                    {/* 연체·체납 */}
                    <div className="flex items-center gap-1.5 pt-3">
                      <input type="checkbox" checked={form.has_delinquency}
                        onChange={e => setForm(p => ({ ...p, has_delinquency: e.target.checked }))}
                        className="w-3.5 h-3.5 accent-red-500 shrink-0" id="delinquency" />
                      <label htmlFor="delinquency" className="text-[10px] text-gray-600 cursor-pointer font-medium">연체·체납</label>
                    </div>
                    {/* 010 번호 — 전체 폭 */}
                    <div className="col-span-2">
                      <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">010 번호 <span className="text-red-400">*</span></label>
                      <input value={form.phone_010} onChange={e => setForm(p => ({ ...p, phone_010: e.target.value }))}
                        placeholder="010-0000-0000" required
                        className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30" />
                    </div>
                    {/* 대표이름 */}
                    <div>
                      <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">대표 성함</label>
                      <input value={form.ceo_name} onChange={e => setForm(p => ({ ...p, ceo_name: e.target.value }))}
                        placeholder="홍길동" className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30" />
                    </div>
                    {/* 기존 DB 번호 */}
                    <div>
                      <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">기존 DB</label>
                      <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="DB 번호" className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30" />
                    </div>
                    {/* 필요자금 */}
                    <div>
                      <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">필요자금</label>
                      <input value={form.required_fund} onChange={e => setForm(p => ({ ...p, required_fund: e.target.value }))}
                        placeholder="1억" className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30" />
                    </div>
                    {/* 메모 — 전체 폭 */}
                    <div className="col-span-2">
                      <label className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">메모</label>
                      <textarea value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
                        rows={2} placeholder="재통화 요청, 기타..."
                        className="mt-0.5 w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30 resize-none" />
                    </div>
                  </div>
                </div>

                {/* 체크리스트 (right) — 상세 내용 포함 */}
                <div className="w-[148px] shrink-0 bg-white rounded-xl border border-gray-100 p-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-[#1B2A45]">체크리스트</h3>
                    {checklistAllDone
                      ? <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">완료</span>
                      : <span className="text-[8px] text-gray-300">{Object.values(checklist).filter(Boolean).length}/5</span>
                    }
                  </div>
                  <div className="space-y-1">
                    {CHECKLIST_ITEMS.map(item => (
                      <label key={item.key} className={`block cursor-pointer rounded-lg p-1.5 border transition-colors ${
                        checklist[item.key]
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={checklist[item.key]}
                            onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                            className="w-3.5 h-3.5 accent-emerald-600 shrink-0"
                          />
                          <span className={`text-[10px] font-bold leading-tight ${checklist[item.key] ? 'text-emerald-700' : 'text-gray-600'}`}>
                            {item.shortLabel}
                          </span>
                        </div>
                        <p className="text-[8px] text-gray-400 leading-tight mt-0.5 pl-[18px] line-clamp-2">
                          {item.desc}
                        </p>
                      </label>
                    ))}
                  </div>
                  {!checklistAllDone && (
                    <p className="text-[8px] text-amber-600 mt-1.5 leading-tight text-center">
                      미완료 시 심사 불리
                    </p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!form.phone_010.trim()}
                className={`w-full py-4 rounded-xl font-bold text-sm transition-colors ${
                  !form.phone_010.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : checklistAllDone
                      ? 'bg-[#1B2A45] text-white hover:bg-[#1B2A45]/90'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}>
                {checklistAllDone ? '가망 제출 →' : '가망 제출 (체크리스트 미완료)'}
              </button>
            </form>
          </>
        )}

        {/* ══════════ 내 가망 목록 탭 ══════════ */}
        {activeTab === 'mylist' && (
          <div className="space-y-3">
            {/* 데일리 / 이번달 통계 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1B2A45] rounded-xl px-4 py-3">
                <p className="text-white/50 text-[10px] mb-1">오늘 승인</p>
                <p className="text-2xl font-black text-white">
                  {todayApproved}
                  <span className="text-sm font-normal text-white/40"> / {DAILY_GOAL}</span>
                </p>
                {bonusCount > 0
                  ? <p className="text-[#C5A258] text-[10px] mt-0.5">+{bonusAmount.toLocaleString()}원</p>
                  : <p className="text-white/30 text-[10px] mt-0.5">목표까지 {Math.max(0, DAILY_GOAL - todayApproved)}건</p>
                }
              </div>
              <div className="bg-[#1B2A45] rounded-xl px-4 py-3">
                <p className="text-white/50 text-[10px] mb-1">이번달 승인</p>
                <p className="text-2xl font-black text-white">
                  {monthApproved}
                  <span className="text-sm font-normal text-white/40">건</span>
                </p>
                <p className="text-white/30 text-[10px] mt-0.5">{currentMonth.replace('-', '년 ')}월</p>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : prospects.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                등록한 가망이 없습니다.
              </div>
            ) : (
              prospects.map(p => (
                <ProspectCard key={p.id} prospect={p} />
              ))
            )}
          </div>
        )}

        {/* ══════════ 스크립트 탭 ══════════ */}
        {activeTab === 'script' && (
          <div className="space-y-3">
            <div className="bg-[#1B2A45] rounded-xl px-5 py-4">
              <h2 className="text-sm font-bold text-white">가망 인폼 스크립트</h2>
              <p className="text-white/50 text-[11px] mt-1">헌드레드컨설팅 · 발굴팀 TM 전용</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-[11px] font-bold text-amber-700 mb-2">통화 전 필수 체크리스트 — 통화 종료 전 모두 확인</p>
              {CHECKLIST_ITEMS.map((item, i) => (
                <div key={item.key} className="flex items-start gap-2 py-1.5">
                  <span className="text-amber-400 text-sm shrink-0">{i + 1}.</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">{item.label}</p>
                    <p className="text-[11px] text-amber-600 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {SCRIPT_SECTIONS.map((section, i) => {
              const colorMap: Record<string, string> = {
                blue: 'bg-blue-50 border-blue-200 text-blue-800',
                green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
                orange: 'bg-orange-50 border-orange-200 text-orange-800',
                purple: 'bg-purple-50 border-purple-200 text-purple-800',
                red: 'bg-red-50 border-red-200 text-red-800',
                'red-dark': 'bg-red-100 border-red-300 text-red-900',
              }
              const headerColor: Record<string, string> = {
                blue: 'text-blue-700', green: 'text-emerald-700', orange: 'text-orange-700',
                purple: 'text-purple-700', red: 'text-red-700', 'red-dark': 'text-red-900',
              }
              return (
                <div key={i} className={`border rounded-xl overflow-hidden ${colorMap[section.color]}`}>
                  <button
                    type="button"
                    onClick={() => setScriptOpen(scriptOpen === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3">
                    <span className={`text-sm font-bold ${headerColor[section.color]}`}>{section.title}</span>
                    <span className="text-gray-400 text-sm">{scriptOpen === i ? '▲' : '▼'}</span>
                  </button>
                  {scriptOpen === i && (
                    <div className="px-4 pb-4 text-sm whitespace-pre-wrap leading-relaxed text-gray-700 border-t border-current/10">
                      {section.content}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function ProspectCard({ prospect: p }: { prospect: Prospect }) {
  const statusConfig = {
    pending: { label: '심사 대기', color: 'bg-amber-100 text-amber-700' },
    approved: { label: '승인됨', color: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: '거절됨', color: 'bg-red-100 text-red-600' },
    assigned: { label: '배정 완료', color: 'bg-blue-100 text-blue-700' },
  }
  const sc = statusConfig[p.status] || statusConfig.pending
  const checkCount = Object.values(p.checklist || {}).filter(Boolean).length
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">{p.company || '(업체명 없음)'}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{p.ceo_name} · {p.phone_010} · {p.call_date}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sc.color}`}>{sc.label}</span>
            <span className="text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2">
          {(['needs_check', 'basic_info', 'purpose_explained', 'closing_done', 'phone_secured'] as const).map(k => (
            <span key={k} className={`w-2 h-2 rounded-full ${(p.checklist?.[k]) ? 'bg-emerald-400' : 'bg-gray-200'}`} />
          ))}
          <span className="text-[10px] text-gray-400 ml-1">{checkCount}/5 체크</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2 text-xs text-gray-600">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {p.business_age && <p><span className="text-gray-400">업력</span> {p.business_age}</p>}
            {p.annual_revenue && <p><span className="text-gray-400">연매출</span> {p.annual_revenue}</p>}
            {p.industry && <p><span className="text-gray-400">업종</span> {p.industry}</p>}
            <p><span className="text-gray-400">연체·체납</span> {p.has_delinquency ? '있음' : '없음'}</p>
            {p.credit_score && <p><span className="text-gray-400">신용점수</span> {p.credit_score}</p>}
            {p.required_fund && <p><span className="text-gray-400">필요자금</span> {p.required_fund}</p>}
          </div>
          {p.memo && <p className="text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{p.memo}</p>}
          {p.recording_url && (
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-gray-400 mb-1">녹취 파일</p>
              <audio controls src={p.recording_url} className="w-full h-8" />
            </div>
          )}
          {p.recording_analysis?.summary && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <p className="text-[10px] text-emerald-600 font-semibold mb-1">AI 분석 요약</p>
              <p className="text-gray-700">{p.recording_analysis.summary}</p>
            </div>
          )}
          {p.ceo_comment && (
            <div className={`rounded-lg px-3 py-2 ${p.status === 'rejected' ? 'bg-red-50 border border-red-100' : 'bg-blue-50 border border-blue-100'}`}>
              <p className={`text-[10px] font-semibold mb-0.5 ${p.status === 'rejected' ? 'text-red-500' : 'text-blue-600'}`}>대표님 코멘트</p>
              <p>{p.ceo_comment}</p>
            </div>
          )}
          {p.status === 'assigned' && p.assigned_to_name && (
            <p className="text-blue-600 font-semibold">→ {p.assigned_to_name} 배정 완료</p>
          )}
        </div>
      )}
    </div>
  )
}
