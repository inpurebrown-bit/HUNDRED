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

const DAILY_GOAL = 8
const BONUS_PER_EXTRA = 10000

const CHECKLIST_ITEMS = [
  { key: 'needs_check',      label: '정책자금 니즈 확인',  desc: '"혹시 정책자금 알아보신 적 있으시거나 필요하세요?"' },
  { key: 'basic_info',       label: '기본 정보 수집',     desc: '업력 / 연매출 / 업종 / 연체·체납 / 신용점수 / 대표자 성함' },
  { key: 'purpose_explained',label: '취지 설명',          desc: '무료 컨설팅, 들어보고 좋으면 비용 지불, 아니면 자료만 받아도 됨' },
  { key: 'closing_done',     label: '클로징 멘트',        desc: '"저희 매니저님이 내일 연락드려서 무료 상담 진행해드릴 겁니다"' },
  { key: 'phone_secured',    label: '010 번호 확보',      desc: '통화 가능한 010 번호 확보 필수' },
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

const STATUS_CONFIG = {
  pending:  { label: '심사 대기', color: 'bg-amber-100 text-amber-700',   icon: '⏳' },
  approved: { label: '승인됨',   color: 'bg-emerald-100 text-emerald-700', icon: '✅' },
  rejected: { label: '거절됨',   color: 'bg-red-100 text-red-600',         icon: '❌' },
  assigned: { label: '배정 완료', color: 'bg-blue-100 text-blue-700',      icon: '📋' },
}

export default function DigDashboard({ userId, userName, username }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('dig')
  const [menuOpen, setMenuOpen] = useState(false)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showRecordingModal, setShowRecordingModal] = useState(false)
  const [showMyList, setShowMyList] = useState(false)
  const [showScript, setShowScript] = useState(false)
  const [openScriptIdx, setOpenScriptIdx] = useState<number | null>(null)
  const [recordingFile, setRecordingFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // 번호 검색
  const [phoneSearch, setPhoneSearch] = useState('')
  const [phoneResults, setPhoneResults] = useState<any[] | null>(null)
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
    setLoading(true)
    try {
      const res = await fetch('/api/dig-prospects')
      const data = await res.json()
      setProspects(data.prospects || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadProspects() }, [loadProspects])

  const today        = new Date().toISOString().slice(0, 10)
  const currentMonth = new Date().toISOString().slice(0, 7)
  const dateLabel    = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  const todayApproved  = prospects.filter(p => p.call_date === today && (p.status === 'approved' || p.status === 'assigned')).length
  const monthApproved  = prospects.filter(p => p.call_date?.startsWith(currentMonth) && (p.status === 'approved' || p.status === 'assigned')).length
  const pendingCount   = prospects.filter(p => p.status === 'pending').length
  const bonusCount     = Math.max(0, todayApproved - DAILY_GOAL)
  const bonusAmount    = bonusCount * BONUS_PER_EXTRA
  const checklistAllDone = Object.values(checklist).every(Boolean)
  const checkDoneCount   = Object.values(checklist).filter(Boolean).length

  // 번호 검색
  async function doPhoneSearch() {
    const clean = phoneSearch.replace(/[^0-9]/g, '')
    if (clean.length < 9) { showToast('번호를 9자리 이상 입력하세요', 'error'); return }
    setPhoneSearching(true)
    setPhoneResults(null)
    try {
      const res = await fetch(`/api/phone-search?phone=${clean}`)
      const data = await res.json()
      setPhoneResults(data.results || [])
    } catch { showToast('검색 중 오류', 'error') }
    setPhoneSearching(false)
  }

  // 번호 검색 결과 → 폼에 자동 입력
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
        const res = await fetch('/api/analyze-recording', { method: 'POST', body: fd })
        const data = await res.json()
        if (data.analysis && !data.analysis.parse_error) {
          setAnalysis(data.analysis)
          if (data.analysis.checklist) setChecklist(prev => ({ ...prev, ...data.analysis.checklist }))
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
        if (data.url) { recording_url = data.url; recording_filename = data.filename }
        else { showToast(data.error || '녹취 업로드 실패', 'error'); setSubmitting(false); setUploading(false); return }
      } catch { showToast('녹취 업로드 중 오류', 'error'); setSubmitting(false); setUploading(false); return }
      setUploading(false)
    }
    try {
      const res = await fetch('/api/dig-prospects', {
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

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/30 bg-white'
  const labelCls = 'block text-sm font-semibold text-gray-600 mb-1'

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white max-w-xs text-center ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
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
                <p className="text-xs text-gray-400 mt-0.5">첨부 시 AI 분석 + 대표님 심사에 활용됩니다 (선택)</p>
              </div>
              <button type="button" onClick={() => setShowRecordingModal(false)} className="text-gray-400 hover:text-gray-600 text-xl p-1">✕</button>
            </div>
            <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg" onChange={handleRecordingChange} className="hidden" />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-5 text-center hover:border-[#1B2A45]/30 transition-colors">
              {recordingFile ? (
                <span className="text-sm text-gray-700 font-medium">{recordingFile.name}</span>
              ) : (
                <>
                  <p className="text-sm text-gray-400">+ 녹취 파일 선택</p>
                  <p className="text-xs text-gray-300 mt-0.5">mp3, m4a, wav, aac 등</p>
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
          { key: 'dig' as Tab,     label: '발굴탭' },
          { key: 'profile' as Tab, label: '직원정보' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-3.5 text-base font-semibold transition-colors relative ${activeTab === t.key ? 'text-[#1B2A45]' : 'text-gray-400 hover:text-gray-600'}`}>
            {t.label}
            {activeTab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B2A45] rounded-t-full" />}
          </button>
        ))}
      </div>

      {/* ══════════ 직원정보 탭 ══════════ */}
      {activeTab === 'profile' && (
        <div className="px-4 py-4">
          <MyProfileTab />
        </div>
      )}

      {/* ══════════ 발굴탭 ══════════ */}
      {activeTab === 'dig' && (
        <div className="px-4 py-4 space-y-4">

          {/* 인사 배너 */}
          <div className="bg-[#1B2A45] rounded-2xl px-5 py-4">
            <p className="text-white/50 text-sm mb-0.5">{dateLabel}</p>
            <h2 className="text-white text-xl font-black">{userName}님, 안녕하세요 👋</h2>
          </div>

          {/* 현황 박스 2개 + 인센티브 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 대기중 */}
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-4 text-center">
              <p className="text-amber-600 text-sm font-bold mb-1">⏳ 승인 대기 중</p>
              <p className="text-4xl font-black text-amber-700">{pendingCount}</p>
              <p className="text-amber-500 text-xs mt-1">건</p>
            </div>
            {/* 이달 승인 */}
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl px-4 py-4 text-center">
              <p className="text-emerald-600 text-sm font-bold mb-1">✅ 이달 승인</p>
              <p className="text-4xl font-black text-emerald-700">{monthApproved}</p>
              <p className="text-emerald-500 text-xs mt-1">건 (목표 {DAILY_GOAL}건/일)</p>
            </div>
          </div>

          {/* 오늘 현황 + 인센티브 */}
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs mb-0.5">오늘 승인</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-[#1B2A45]">{todayApproved}</span>
                <span className="text-gray-400 text-sm">/ {DAILY_GOAL}</span>
              </div>
              {todayApproved >= DAILY_GOAL
                ? <p className="text-emerald-600 text-xs font-bold mt-0.5">🎉 오늘 목표 달성!</p>
                : <p className="text-gray-400 text-xs mt-0.5">목표까지 {DAILY_GOAL - todayApproved}건 남음</p>
              }
            </div>
            {bonusCount > 0 && (
              <div className="bg-[#C5A258]/15 border border-[#C5A258]/40 rounded-xl px-4 py-3 text-right">
                <p className="text-[#C5A258] text-xs font-bold">오늘 인센티브</p>
                <p className="text-[#C5A258] text-xl font-black">+{bonusAmount.toLocaleString()}원</p>
                <p className="text-[#C5A258]/70 text-xs">{bonusCount}건 초과 × 1만원</p>
              </div>
            )}
          </div>

          {/* ── 번호 검색 ── */}
          <div className="bg-white border-2 border-[#1B2A45]/20 rounded-2xl p-4 space-y-3">
            <div>
              <h3 className="text-base font-black text-[#1B2A45] mb-0.5">📞 번호 중복 검색</h3>
              <p className="text-xs text-gray-400">전화하기 전에 먼저 검색해서 중복 여부 확인!</p>
            </div>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneSearch}
                onChange={e => { setPhoneSearch(e.target.value); setPhoneResults(null) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doPhoneSearch() } }}
                placeholder="010-0000-0000"
                className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#1B2A45]/40 bg-white"
              />
              <button
                type="button"
                onClick={doPhoneSearch}
                disabled={phoneSearching}
                className="px-5 py-3 bg-[#1B2A45] text-white text-sm font-bold rounded-xl hover:bg-[#1B2A45]/90 transition-colors disabled:opacity-50 shrink-0">
                {phoneSearching ? '검색 중' : '검색'}
              </button>
            </div>

            {/* 검색 결과 */}
            {phoneResults !== null && (
              phoneResults.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <p className="text-emerald-700 font-bold text-sm">✅ 기존 DB에 없는 번호입니다</p>
                  <p className="text-emerald-600 text-xs mt-0.5">바로 인콜 진행 가능합니다!</p>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                  <p className="text-red-700 font-bold text-sm">⚠️ 이미 DB에 있는 번호 ({phoneResults.length}건)</p>
                  {phoneResults.map((r, i) => (
                    <div key={i} className="bg-white border border-red-100 rounded-lg px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-800 truncate">{r.company || '(업체명 없음)'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {r.source === 'customer' ? '영업 고객' : '발굴 가망'} ·
                            <span className="ml-1">{r.phone_010}</span>
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            r.status === 'contracted' ? 'bg-emerald-100 text-emerald-700' :
                            r.status === 'approved'   ? 'bg-blue-100 text-blue-700' :
                            r.status === 'pending'    ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                          }`}>{r.status || '상태미상'}</span>
                          <button onClick={() => fillFromSearch(r)}
                            className="text-[10px] text-[#1B2A45] border border-[#1B2A45]/30 rounded px-2 py-0.5 hover:bg-[#1B2A45]/10">
                            폼에 입력
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* ── 가망 등록 폼 ── */}
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <h3 className="text-base font-black text-[#1B2A45] mb-4">📝 가망 등록</h3>

            <form onSubmit={handleSubmitClick} className="space-y-4">
              {/* 업체 정보 */}
              <div className="space-y-3">
                {/* 업체명 */}
                <div>
                  <label className={labelCls}>업체명</label>
                  <input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
                    placeholder="(주)헌드레드컨설팅" className={inputCls} />
                </div>
                {/* 010번호 */}
                <div>
                  <label className={labelCls}>010 번호 <span className="text-red-500">*</span></label>
                  <input value={form.phone_010} onChange={e => setForm(p => ({ ...p, phone_010: e.target.value }))}
                    placeholder="010-0000-0000" required type="tel" className={inputCls} />
                </div>
                {/* 대표 성함 */}
                <div>
                  <label className={labelCls}>대표 성함</label>
                  <input value={form.ceo_name} onChange={e => setForm(p => ({ ...p, ceo_name: e.target.value }))}
                    placeholder="홍길동" className={inputCls} />
                </div>
                {/* 2열 그리드 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>업력</label>
                    <input value={form.business_age} onChange={e => setForm(p => ({ ...p, business_age: e.target.value }))}
                      placeholder="3년" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>연매출</label>
                    <input value={form.annual_revenue} onChange={e => setForm(p => ({ ...p, annual_revenue: e.target.value }))}
                      placeholder="5억" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>업종</label>
                    <input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
                      placeholder="제조업" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>신용점수</label>
                    <input value={form.credit_score} onChange={e => setForm(p => ({ ...p, credit_score: e.target.value }))}
                      placeholder="780점" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>연체·체납</label>
                    <input value={form.delinquency_detail} onChange={e => setForm(p => ({ ...p, delinquency_detail: e.target.value }))}
                      placeholder="없음 / 500만원" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>필요자금</label>
                    <input value={form.required_fund} onChange={e => setForm(p => ({ ...p, required_fund: e.target.value }))}
                      placeholder="1억" className={inputCls} />
                  </div>
                </div>
              </div>

              {/* 체크리스트 */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-black text-[#1B2A45]">통화 전 체크리스트</h4>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${checklistAllDone ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                    {checkDoneCount}/5 {checklistAllDone ? '완료 ✓' : ''}
                  </span>
                </div>
                {CHECKLIST_ITEMS.map(item => (
                  <label key={item.key} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    checklist[item.key] ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="checkbox"
                      checked={checklist[item.key]}
                      onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      className="w-5 h-5 accent-emerald-600 shrink-0 mt-0.5"
                    />
                    <div>
                      <p className={`text-sm font-bold leading-snug ${checklist[item.key] ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-500 leading-snug mt-0.5">{item.desc}</p>
                    </div>
                  </label>
                ))}
                {!checklistAllDone && (
                  <p className="text-xs text-amber-600 font-medium text-center pt-1">⚠ 미완료 항목이 있으면 심사에서 불리합니다</p>
                )}
              </div>

              {/* 금지 / 기준 요약 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm font-black text-red-700 mb-2">⚠ 절대 금지</p>
                  {['"지원금·공짜" 표현 후킹', '니즈 없는 고객 억지 확보', '번호만 받는 유도 질문', '"100% 된다" 확정 표현'].map((txt, i) => (
                    <p key={i} className="text-xs text-red-600 flex items-start gap-1 mb-1 leading-snug">
                      <span className="shrink-0">❌</span>{txt}
                    </p>
                  ))}
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-sm font-black text-emerald-700 mb-2">✅ 가망 기준</p>
                  <p className="text-xs text-emerald-700 leading-snug mb-2">모든 인폼 전달 + 상담사 연결 동의</p>
                  <p className="text-xs text-emerald-700 leading-snug">번호만 받은 경우 → 다음날 재통화 확정</p>
                </div>
              </div>

              {/* 제출 버튼 */}
              <button
                type="submit"
                disabled={!form.phone_010.trim()}
                className={`w-full py-5 rounded-2xl font-black text-base transition-colors ${
                  !form.phone_010.trim()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : checklistAllDone
                      ? 'bg-[#1B2A45] text-white hover:bg-[#1B2A45]/90'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}>
                {checklistAllDone ? '가망 제출 →' : '가망 제출 (체크리스트 미완료)'}
              </button>
            </form>
          </div>

          {/* ── 내 가망 목록 (접이식) ── */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => { setShowMyList(v => !v); if (!showMyList) loadProspects() }}
              className="w-full flex items-center justify-between px-4 py-4">
              <span className="text-base font-black text-[#1B2A45]">
                📋 내 가망 목록
                <span className="ml-2 text-sm font-semibold text-gray-400">({prospects.length}건)</span>
              </span>
              <span className="text-gray-400 text-lg">{showMyList ? '▲' : '▼'}</span>
            </button>

            {showMyList && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                {/* 간단 통계 */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([key, cfg]) => {
                    const cnt = prospects.filter(p => p.status === key).length
                    return (
                      <div key={key} className={`rounded-xl p-2 text-center border ${cfg.color.replace('text-', 'border-').replace(/bg-\S+/, '')}`}>
                        <p className="text-lg font-black text-gray-800">{cnt}</p>
                        <p className={`text-[10px] font-bold ${cfg.color.split(' ')[1]}`}>{cfg.label}</p>
                      </div>
                    )
                  })}
                </div>

                {loading ? (
                  <p className="text-center py-8 text-gray-400 text-sm">불러오는 중...</p>
                ) : prospects.length === 0 ? (
                  <p className="text-center py-8 text-gray-400 text-sm">등록한 가망이 없습니다</p>
                ) : (
                  prospects.map(p => <ProspectCard key={p.id} prospect={p} />)
                )}
              </div>
            )}
          </div>

          {/* ── 스크립트 (접이식) ── */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowScript(v => !v)}
              className="w-full flex items-center justify-between px-4 py-4">
              <span className="text-base font-black text-[#1B2A45]">📄 TM 스크립트</span>
              <span className="text-gray-400 text-lg">{showScript ? '▲' : '▼'}</span>
            </button>

            {showScript && (
              <div className="border-t border-gray-100 px-4 py-4 space-y-3">
                {/* 체크리스트 요약 */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-sm font-black text-amber-700 mb-2">통화 종료 전 필수 체크</p>
                  <div className="space-y-1">
                    {CHECKLIST_ITEMS.map((item, i) => (
                      <p key={item.key} className="text-sm text-amber-800 flex items-start gap-1.5 leading-snug">
                        <span className="shrink-0 font-black">{i + 1}.</span>{item.label} — <span className="text-amber-600 font-normal">{item.desc}</span>
                      </p>
                    ))}
                  </div>
                </div>

                {/* 스크립트 섹션들 (accordion) */}
                {[
                  {
                    label: 'STEP 1 — 도입부', color: 'blue',
                    content: (
                      <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
                        <p className="font-bold text-blue-700">"안녕하세요 대표님~ 000 기업 대표님 맞으실까요~?"</p>
                        <p className="text-gray-400 text-xs">(대표 아닌 경우) → "아 그러세요~ 그럼 다음에 연락드릴게요~"</p>
                        <p>"최근 정부에서 사업가·기업들을 대상으로 여러 지원 혜택들이 많이 나와서 연락드렸습니다. 저희는 헌드레드컨설팅이라는 경영자문 회사입니다."</p>
                        <p>"최근 000 업종에 대해서 나라에서 많은 지원을 해주고 있는데요! 요즘 정책자금이 업종별로 하반기 막받이라서 혜택 못 받고 지나치시는 분들이 많아서 안내드리고 있거든요~"</p>
                        <p className="font-bold text-blue-700">"혹시 지금 정책자금 알아보신 적 있으시거나 사용하고 계신 게 있으세요?"</p>
                      </div>
                    ),
                  },
                  {
                    label: '초반 반론 대응', color: 'red',
                    content: (
                      <div className="divide-y divide-gray-100">
                        {[
                          { s: '바빠요 / 됐어요', r: '"아 바쁘시죠~ 연락처만 주시면 편한 시간에 매니저가 연락드릴게요."' },
                          { s: '필요없어요', r: '"무료라서 자료만 받아보셔도 되시구요~ 미리 진단만 받아 놓으셔도 나중에 정부자금 사용하실 때 큰 도움이 됩니다!"' },
                          { s: '이미 쓰고 있어요', r: '"기관마다 중복으로 추가 가능한 것도 있어서 보통 1년 동안 3~4번씩 받아가신다고 하는데요~"' },
                          { s: '사기 같아요', r: '"먼저 무료 컨설팅이고 진행 원하실 때만 비용 발생해요~ 결정은 자금이 나올 수 있는지 듣고 결정하시는 거라서 마음 편하실 거에요~"' },
                          { s: '문자 남겨주세요', r: '"문자로는 정확한 안내가 어려워서요~ 연락처 주시면 상담사가 딱 5분만 설명드릴게요."' },
                        ].map((row, i) => (
                          <div key={i} className="flex gap-0 py-2.5">
                            <span className="w-28 shrink-0 text-sm font-bold text-red-700 leading-snug pt-0.5">{row.s}</span>
                            <p className="text-sm text-gray-700 leading-snug">{row.r}</p>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  {
                    label: 'STEP 2 — 니즈 분기 & 정보 수집', color: 'green',
                    content: (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                            <p className="text-sm font-black text-emerald-700 mb-1.5">✓ 니즈 있을 때</p>
                            <p className="text-sm text-emerald-800 leading-snug">"아 그러세요~ 그럼 혹시 어디서 받으셨어요? 한번 받으신다고 더 못받는게 아니라, 기관마다 추가로 활용 가능 자금도 많이있거든요~"</p>
                          </div>
                          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                            <p className="text-sm font-black text-orange-700 mb-1.5">✗ 니즈 없을 때</p>
                            <p className="text-sm text-orange-800 leading-snug">"캐피탈 같은 고금리가 아니라 시중 은행보다도 금리가 낮은 정부정책자금을 활용하시면 1년에 수백만 원 이자비용 아끼실 수 있어요~"</p>
                          </div>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                          <p className="text-sm font-black text-gray-700">↓ 순서대로 질문</p>
                          {[
                            { tag: '업력',    q: '"혹시 사업 시작하신 지 얼마나 되셨어요?"' },
                            { tag: '연매출',  q: '"연매출은 대략 어느 정도 되세요?"' },
                            { tag: '연체·체납', q: '"혹시 세금 체납이나 대출 연체, 카드연체 같은 건 없으시죠?"' },
                            { tag: '업종',    q: '"그럼 업종이 000 맞나요?"' },
                            { tag: '필요자금', q: '"필요하신 자금은 얼마 정도이실까요?"' },
                            { tag: '신용점수', q: '"신용점수는 대략 몇점이실까요~?"' },
                          ].map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="shrink-0 text-xs font-bold bg-gray-200 text-gray-600 px-2 py-0.5 rounded mt-0.5">{item.tag}</span>
                              <p className="text-sm text-gray-700 leading-snug">{item.q}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  },
                  {
                    label: 'STEP 3 — 취지 설명 + 번호 확보', color: 'purple',
                    content: (
                      <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
                        <p>"말씀 감사드려요~ 우선 대표님이 정책자금 어떤 기관에서 어떤 상품으로 들어가고, 한도는 얼마나 나올 것 같은지, 금리는 몇%대로 나올 것 같은지에 대해 저희가 컨설팅 매니저님이 자세히 무료상담 도와드릴거에요!"</p>
                        <p className="font-bold text-purple-700">"저희 전문 컨설턴트님이 내일 오후에 자세히 안내드릴건데, 받아보실 번호가 010에 몇번이실까요?"</p>
                        <p className="font-bold text-purple-700">"아 그리고 대표님 성함은 어떻게 되세요~?"</p>
                      </div>
                    ),
                  },
                ].map((section, idx) => (
                  <div key={idx} className={`border rounded-xl overflow-hidden ${
                    section.color === 'blue' ? 'border-blue-200' :
                    section.color === 'red' ? 'border-red-200' :
                    section.color === 'green' ? 'border-green-200' : 'border-purple-200'
                  }`}>
                    <button type="button" onClick={() => setOpenScriptIdx(openScriptIdx === idx ? null : idx)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left font-bold text-sm ${
                        section.color === 'blue' ? 'bg-blue-50 text-blue-800' :
                        section.color === 'red' ? 'bg-red-50 text-red-800' :
                        section.color === 'green' ? 'bg-emerald-50 text-emerald-800' : 'bg-purple-50 text-purple-800'
                      }`}>
                      <span>{section.label}</span>
                      <span>{openScriptIdx === idx ? '▲' : '▼'}</span>
                    </button>
                    {openScriptIdx === idx && (
                      <div className="px-4 py-3 border-t border-gray-100 bg-white">
                        {section.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-8" />
        </div>
      )}
    </div>
  )
}

function ProspectCard({ prospect: p }: { prospect: Prospect }) {
  const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending
  const checkCount = Object.values(p.checklist || {}).filter(Boolean).length
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-800">{p.company || '(업체명 없음)'}</p>
            <p className="text-xs text-gray-400 mt-0.5">{p.ceo_name} · {p.phone_010} · {p.call_date}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${sc.color}`}>{sc.icon} {sc.label}</span>
            <span className="text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2">
          {(['needs_check', 'basic_info', 'purpose_explained', 'closing_done', 'phone_secured'] as const).map(k => (
            <span key={k} className={`w-2.5 h-2.5 rounded-full ${(p.checklist?.[k]) ? 'bg-emerald-400' : 'bg-gray-200'}`} />
          ))}
          <span className="text-xs text-gray-400 ml-1">{checkCount}/5</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2 text-sm text-gray-600">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {p.business_age   && <p><span className="text-gray-400">업력</span> {p.business_age}</p>}
            {p.annual_revenue && <p><span className="text-gray-400">연매출</span> {p.annual_revenue}</p>}
            {p.industry       && <p><span className="text-gray-400">업종</span> {p.industry}</p>}
            <p><span className="text-gray-400">연체·체납</span> {p.has_delinquency ? '있음' : '없음'}</p>
            {p.credit_score   && <p><span className="text-gray-400">신용점수</span> {p.credit_score}</p>}
            {p.required_fund  && <p><span className="text-gray-400">필요자금</span> {p.required_fund}</p>}
          </div>
          {p.memo && <p className="text-gray-500 bg-gray-50 rounded-lg px-3 py-2 text-xs">{p.memo}</p>}
          {p.recording_url && (
            <div className="bg-blue-50 rounded-lg p-2">
              <p className="text-xs text-blue-600 font-medium mb-1">녹취 파일</p>
              <audio controls src={p.recording_url} className="w-full h-8" />
            </div>
          )}
          {p.recording_analysis?.summary && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <p className="text-xs text-emerald-600 font-semibold mb-1">AI 분석 요약</p>
              <p className="text-xs text-gray-700">{p.recording_analysis.summary}</p>
            </div>
          )}
          {p.ceo_comment && (
            <div className={`rounded-lg px-3 py-2 ${p.status === 'rejected' ? 'bg-red-50 border border-red-100' : 'bg-blue-50 border border-blue-100'}`}>
              <p className={`text-xs font-semibold mb-0.5 ${p.status === 'rejected' ? 'text-red-500' : 'text-blue-600'}`}>대표님 코멘트</p>
              <p className="text-xs text-gray-700">{p.ceo_comment}</p>
            </div>
          )}
          {p.status === 'assigned' && p.assigned_to_name && (
            <p className="text-xs text-blue-600 font-semibold">→ {p.assigned_to_name} 배정 완료</p>
          )}
        </div>
      )}
    </div>
  )
}
