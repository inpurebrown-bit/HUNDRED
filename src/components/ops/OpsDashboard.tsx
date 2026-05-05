'use client'

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'

interface OpsCase {
  id: string
  customer_id: string
  ops_user_id: string
  ops_user_name: string
  institution: string       // 담당 기관 (기보, 신보, 소진공 등)
  solution_type: string     // 솔루션 종류
  progress_stage: string    // 진행 단계
  progress_memo: string     // 처리 메모
  revenue: number           // 발생 매출
  updated_at: string
  created_at: string
  customers: {
    name: string
    phone: string
    company: string
    loan_history: string
  }
}

const STAGES = [
  { key: 'assigned',    label: '배정 완료',   color: 'bg-slate-100 text-slate-600' },
  { key: 'doc_collect', label: '서류 수집',   color: 'bg-blue-100 text-blue-700' },
  { key: 'reviewing',   label: '심사 중',     color: 'bg-amber-100 text-amber-700' },
  { key: 'approved',    label: '승인 완료',   color: 'bg-violet-100 text-violet-700' },
  { key: 'executing',   label: '자금 집행',   color: 'bg-cyan-100 text-cyan-700' },
  { key: 'completed',   label: '완료',        color: 'bg-emerald-100 text-emerald-700' },
  { key: 'rejected',    label: '거절/보류',   color: 'bg-red-100 text-red-600' },
]

const INSTITUTIONS = ['기술보증기금(기보)', '신용보증기금(신보)', '소상공인시장진흥공단', '중소벤처기업진흥공단', '산업은행', '기업은행', '농협', '직접 대출', '기타']

interface Props {
  userId: string
  userName: string
}

const opsTabs = [
  { key: 'cases', label: '📋 담당 케이스' },
  { key: 'report', label: '📝 보고' },
]

export default function OpsDashboard({ userId, userName }: Props) {
  const [activeTab, setActiveTab] = useState<'cases' | 'report'>('cases')
  const [menuOpen, setMenuOpen] = useState(false)
  const [cases, setCases] = useState<OpsCase[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saved' | 'saving' | 'unsaved'>>({})
  const [filterStage, setFilterStage] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  async function loadCases() {
    setLoading(true)
    const res = await fetch('/api/ops-cases')
    const data = await res.json()
    setCases(data.cases || [])
    setLoading(false)
  }

  useEffect(() => { loadCases() }, [])

  // 자동저장 debounce 1.2초
  const autoSave = useCallback((id: string, patch: Partial<OpsCase>) => {
    setSaveStatus(prev => ({ ...prev, [id]: 'unsaved' }))
    if (autoSaveTimers.current[id]) clearTimeout(autoSaveTimers.current[id])
    autoSaveTimers.current[id] = setTimeout(async () => {
      setSaveStatus(prev => ({ ...prev, [id]: 'saving' }))
      await fetch(`/api/ops-cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      setSaveStatus(prev => ({ ...prev, [id]: 'saved' }))
    }, 1200)
  }, [])

  function updateCase(id: string, field: keyof OpsCase, value: string | number) {
    setCases(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
    autoSave(id, { [field]: value })
  }

  const q = searchQuery.trim().toLowerCase()
  const filteredByStage = filterStage === 'all' ? cases : cases.filter(c => c.progress_stage === filterStage)
  const filtered = q.length >= 1
    ? filteredByStage.filter(c =>
        c.customers?.company?.toLowerCase().includes(q) ||
        c.customers?.name?.toLowerCase().includes(q) ||
        c.customers?.phone?.replace(/-/g, '').includes(q.replace(/-/g, '')) ||
        c.institution?.toLowerCase().includes(q)
      )
    : filteredByStage

  // 통계
  const totalRevenue = cases.reduce((sum, c) => sum + (c.revenue || 0), 0)
  const completedCount = cases.filter(c => c.progress_stage === 'completed').length
  const inProgressCount = cases.filter(c => !['completed', 'rejected'].includes(c.progress_stage)).length

  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      {/* ── 헤더 ── */}
      <header className="bg-[#1B2A45] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="relative h-8 w-24 shrink-0 block">
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain object-left brightness-0 invert" unoptimized />
        </Link>
        <span className="text-white/60 text-xs font-medium hidden md:block">
          {opsTabs.find(t => t.key === activeTab)?.label ?? '관리팀 대시보드'}
        </span>
        <div className="flex items-center gap-2 relative">
          {/* 항상 표시되는 검색창 */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="업체명·이름·기관..."
              className="bg-white/10 text-white placeholder-white/40 text-xs px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:bg-white/20 w-32 md:w-44"
            />
            {q.length >= 1 && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-xs">✕</button>
            )}
          </div>
          {/* 대시보드(케이스탭)로 돌아가기 */}
          <button
            onClick={() => setActiveTab('cases')}
            className="text-white/50 hover:text-white text-[10px] px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap hidden md:block">
            🏠 홈
          </button>
          <button onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-white/40 hover:text-white/80 text-xs transition-colors">
            로그아웃
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
              <div className="absolute top-full right-0 mt-2 bg-white border border-[#E8E2D4] rounded-2xl shadow-2xl z-50 py-2 min-w-[200px]">
                {opsTabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key as any); setMenuOpen(false) }}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 ${
                      activeTab === tab.key
                        ? 'text-[#C5A258] font-semibold bg-[#C5A258]/8'
                        : 'text-[#1B2A45]/65 hover:text-[#1B2A45] hover:bg-[#FAF8F3]'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeTab === tab.key ? 'bg-[#C5A258]' : 'bg-transparent'}`} />
                    {tab.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </header>

      <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto">

        {/* ── 보고 탭 ── */}
        {activeTab === 'report' && (
          <OpsReportTab userId={userId} userName={userName} />
        )}

        {/* ── 케이스 탭 ── */}
        {activeTab === 'cases' && (<>
        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: '담당 케이스', value: cases.length + '건', color: 'text-[#C5A258]' },
            { label: '진행 중', value: inProgressCount + '건', color: 'text-amber-600' },
            { label: '완료', value: completedCount + '건', color: 'text-emerald-600' },
            { label: '누적 매출', value: totalRevenue > 0 ? (totalRevenue / 10000).toFixed(0) + '만원' : '-', color: 'text-[#1B2A45]' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-[#E8E2D4] p-4 text-center">
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#1B2A45]/40 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 단계 필터 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterStage('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStage === 'all' ? 'bg-[#1B2A45] text-white' : 'bg-white text-[#1B2A45]/60 border border-[#E8E2D4]'
            }`}
          >
            전체 ({cases.length})
          </button>
          {STAGES.map(s => {
            const count = cases.filter(c => c.progress_stage === s.key).length
            if (count === 0) return null
            return (
              <button
                key={s.key}
                onClick={() => setFilterStage(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStage === s.key ? 'bg-[#1B2A45] text-white' : 'bg-white text-[#1B2A45]/60 border border-[#E8E2D4]'
                }`}
              >
                {s.label} ({count})
              </button>
            )
          })}
        </div>

        {/* 케이스 목록 */}
        {loading ? (
          <div className="text-center py-16 text-[#1B2A45]/40 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E2D4] p-14 text-center text-[#1B2A45]/40 text-sm">
            {cases.length === 0
              ? '대표님이 배정한 케이스가 여기에 나타납니다.'
              : '해당 단계의 케이스가 없습니다.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => {
              const stage = STAGES.find(s => s.key === c.progress_stage) || STAGES[0]
              return (
                <div key={c.id} className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
                  {/* 카드 헤더 */}
                  <div
                    className="px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setEditingId(editingId === c.id ? null : c.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center text-violet-600 font-bold text-sm">
                        {c.customers?.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">{c.customers?.name}</span>
                          {c.customers?.company && (
                            <span className="text-gray-400 text-xs">{c.customers.company}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {c.institution && (
                            <span className="text-xs text-gray-400">{c.institution}</span>
                          )}
                          {c.solution_type && (
                            <span className="text-xs text-gray-300">· {c.solution_type}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stage.color}`}>
                        {stage.label}
                      </span>
                      {saveStatus[c.id] === 'saving' && <span className="text-xs text-amber-500">저장 중...</span>}
                      {saveStatus[c.id] === 'saved' && <span className="text-xs text-emerald-500">✓ 저장됨</span>}
                      <span className="text-gray-300 text-sm">{editingId === c.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* 카드 상세 */}
                  {editingId === c.id && (
                    <div className="px-5 pb-5 border-t border-gray-50 pt-4 space-y-4">
                      {/* 고객 기본 정보 (읽기 전용) */}
                      <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-400">연락처</p>
                          <p className="text-sm text-gray-700 font-medium">{c.customers?.phone || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">기대출 내역</p>
                          <p className="text-sm text-gray-700">{c.customers?.loan_history || '-'}</p>
                        </div>
                      </div>

                      {/* 관리팀 입력 필드 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">담당 기관</label>
                          <select
                            value={c.institution}
                            onChange={e => updateCase(c.id, 'institution', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          >
                            <option value="">선택하세요</option>
                            {INSTITUTIONS.map(inst => (
                              <option key={inst} value={inst}>{inst}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">솔루션 종류</label>
                          <input
                            value={c.solution_type}
                            onChange={e => updateCase(c.id, 'solution_type', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            placeholder="예: 운전자금, 시설자금, 보증서 발급"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">진행 단계</label>
                          <select
                            value={c.progress_stage}
                            onChange={e => updateCase(c.id, 'progress_stage', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                          >
                            {STAGES.map(s => (
                              <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">발생 매출 (원)</label>
                          <input
                            type="number"
                            value={c.revenue || ''}
                            onChange={e => updateCase(c.id, 'revenue', Number(e.target.value))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            placeholder="예: 3000000"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">처리 메모</label>
                        <textarea
                          value={c.progress_memo}
                          onChange={e => updateCase(c.id, 'progress_memo', e.target.value)}
                          rows={3}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                          placeholder="진행 상황, 특이사항, 다음 액션 등"
                        />
                      </div>

                      <p className="text-xs text-gray-300 text-right">
                        마지막 수정: {new Date(c.updated_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        </>)}
      </div>
    </div>
  )
}

// ── 관리팀 보고 탭 ─────────────────────────────────────────
function OpsReportTab({ userId, userName }: { userId: string; userName: string }) {
  const [reportType, setReportType] = useState<'morning' | 'daily'>('morning')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitType, setSubmitType] = useState<'morning' | 'daily'>('morning')
  const [pastReports, setPastReports] = useState<any[]>([])
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => setPastReports(d.reports || []))
  }, [submitted])

  const morningReports = pastReports.filter(r => r.report_type === 'morning')
  const dailyReports = pastReports.filter(r => r.report_type === 'daily')
  const pct = (n: number, d: number) => d === 0 ? '—' : (n / d * 100).toFixed(1) + '%'
  const morningStats = {
    total_calls: morningReports.reduce((s: number, r: any) => s + Number(r.data?.total_calls || 0), 0),
    no_connect:  morningReports.reduce((s: number, r: any) => s + Number(r.data?.no_connect || 0), 0),
    connected:   morningReports.reduce((s: number, r: any) => s + Number(r.data?.connected || 0), 0),
    db_secured:  morningReports.reduce((s: number, r: any) => s + Number(r.data?.db_secured || 0), 0),
    outbound_contracts: morningReports.reduce((s: number, r: any) => s + Number(r.data?.outbound_contracts || 0), 0),
  }
  const dailyStats = {
    today_contracts: dailyReports.reduce((s: number, r: any) => s + Number(r.data?.today_contracts || 0), 0),
    month_contracts: dailyReports.filter((r: any) => r.report_date?.slice(0, 7) === today.slice(0, 7))
      .reduce((s: number, r: any) => s + Number(r.data?.today_contracts || 0), 0),
  }

  // 오전보고 폼
  const [morning, setMorning] = useState({
    total_calls: '', no_connect: '', connected: '', db_secured: '', outbound_contracts: '',
  })

  const [submitError, setSubmitError] = useState<string | null>(null)

  async function submitMorning(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: 'morning',
          report_date: today,
          data: {
            total_calls: Number(morning.total_calls),
            no_connect: Number(morning.no_connect),
            connected: Number(morning.connected),
            db_secured: Number(morning.db_secured),
            outbound_contracts: Number(morning.outbound_contracts),
          },
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setSubmitType('morning')
        setSubmitted(true)
      } else {
        setSubmitError(`전송 실패: ${json.error || '서버 오류'}`)
      }
    } catch (err: any) {
      setSubmitError(`네트워크 오류: ${err.message}`)
    }
    setSubmitting(false)
  }

  // 마감보고 폼 (간단 버전)
  const [daily, setDaily] = useState({ today_contracts: '', month_contracts: '', goal: '', memo: '' })

  async function submitDaily(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: 'daily',
          report_date: today,
          data: {
            today_contracts: Number(daily.today_contracts),
            month_contracts: Number(daily.month_contracts),
            goal: Number(daily.goal),
            memo: daily.memo,
          },
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setSubmitType('daily')
        setSubmitted(true)
      } else {
        setSubmitError(`전송 실패: ${json.error || '서버 오류'}`)
      }
    } catch (err: any) {
      setSubmitError(`네트워크 오류: ${err.message}`)
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-4">
      {/* ── 전송 실패 에러 ── */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>❌ {submitError}</span>
          <button onClick={() => setSubmitError(null)} className="text-red-400 hover:text-red-600 ml-3 shrink-0">✕</button>
        </div>
      )}
      {/* ── 전송 완료 팝업 모달 ── */}
      {submitted && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] px-6">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">
              {submitType === 'morning' ? '오전보고 완료!' : '마감보고 완료!'}
            </h2>
            <p className="text-sm text-gray-500 mb-1">대표님께 성공적으로 전송되었습니다.</p>
            <p className="text-xs text-gray-400 mb-7">{today} · {userName}</p>
            <button
              onClick={() => setSubmitted(false)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors">
              확인
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        {[{ key: 'morning', label: '☀️ 오전보고' }, { key: 'daily', label: '📋 마감보고' }].map(t => (
          <button key={t.key} onClick={() => setReportType(t.key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              reportType === t.key ? 'bg-[#1B2A45] text-white' : 'bg-white text-[#1B2A45]/60 border border-[#E8E2D4]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 통계 카드 ── */}
      {reportType === 'morning' && morningReports.length > 0 && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs text-amber-700 font-bold mb-3">☀️ 내 오전보고 누적 통계 ({morningReports.length}건)</p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {([
              { label: '총 콜', value: morningStats.total_calls, rate: null, rateLabel: '' },
              { label: '연결안됨', value: morningStats.no_connect, rate: pct(morningStats.no_connect, morningStats.total_calls), rateLabel: '미연결율' },
              { label: '연결됨', value: morningStats.connected, rate: pct(morningStats.connected, morningStats.total_calls), rateLabel: '연결율' },
              { label: 'DB확보', value: morningStats.db_secured, rate: pct(morningStats.db_secured, morningStats.total_calls), rateLabel: '확보율' },
              { label: '아웃계약', value: morningStats.outbound_contracts, rate: pct(morningStats.outbound_contracts, morningStats.total_calls), rateLabel: '계약율' },
            ] as const).map((s: any) => (
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
      {reportType === 'daily' && dailyReports.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs text-blue-700 font-bold mb-3">📋 내 마감보고 누적 통계 ({dailyReports.length}건)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '누적 계약', value: dailyStats.today_contracts + '건' },
              { label: '이번달 계약', value: dailyStats.month_contracts + '건' },
            ].map((s: any) => (
              <div key={s.label} className="bg-white rounded-lg p-2.5 text-center border border-blue-100">
                <p className="text-[10px] text-gray-400 mb-0.5">{s.label}</p>
                <p className="text-xl font-black text-blue-700">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {reportType === 'morning' && (
        <form onSubmit={submitMorning} className="bg-white rounded-2xl border border-[#E8E2D4] p-5 space-y-4">
          <h3 className="font-semibold text-[#1B2A45]">오전보고 — {today}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'total_calls', label: '총 콜 수' },
              { key: 'no_connect', label: '연결 안됨' },
              { key: 'connected', label: '연결됨' },
              { key: 'db_secured', label: 'DB 확보' },
              { key: 'outbound_contracts', label: '아웃바운딩 계약' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-[#1B2A45]/50 mb-1 block">{f.label}</label>
                <input type="number" min="0"
                  value={morning[f.key as keyof typeof morning]}
                  onChange={e => setMorning(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-3 py-2 text-sm outline-none bg-[#FAF8F3]"
                  placeholder="0" />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={submitting}
              className="bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors">
              {submitting ? '제출 중...' : '보고 제출'}
            </button>
          </div>
        </form>
      )}

      {reportType === 'daily' && (
        <form onSubmit={submitDaily} className="bg-white rounded-2xl border border-[#E8E2D4] p-5 space-y-4">
          <h3 className="font-semibold text-[#1B2A45]">마감보고 — {today}</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'today_contracts', label: '당일 계약' },
              { key: 'month_contracts', label: '이번달 누적' },
              { key: 'goal', label: '월 목표' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-[#1B2A45]/50 mb-1 block">{f.label}</label>
                <input type="number" min="0"
                  value={daily[f.key as keyof typeof daily] as string}
                  onChange={e => setDaily(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-3 py-2 text-sm outline-none bg-[#FAF8F3]"
                  placeholder="0" />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs text-[#1B2A45]/50 mb-1 block">특이사항 / 메모</label>
            <textarea value={daily.memo} onChange={e => setDaily(p => ({ ...p, memo: e.target.value }))} rows={3}
              className="w-full border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-3 py-2 text-sm outline-none bg-[#FAF8F3] resize-none"
              placeholder="오늘의 업무 특이사항, 내일 예정 업무 등" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={submitting}
              className="bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors">
              {submitting ? '제출 중...' : '보고 제출'}
            </button>
          </div>
        </form>
      )}

      {/* ── 누적 히스토리 ── */}
      {reportType === 'morning' && morningReports.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E8E2D4] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E8E2D4]/60 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1B2A45]">지난 오전보고 누적</h3>
            <span className="text-xs text-[#1B2A45]/40">{morningReports.length}건</span>
          </div>
          <div className="divide-y divide-[#E8E2D4]/40">
            {morningReports.slice(0, 50).map((r: any) => {
              const tc = Number(r.data?.total_calls || 0)
              const cn = Number(r.data?.connected || 0)
              const connRate = tc > 0 ? (cn / tc * 100).toFixed(0) + '%' : '—'
              const dbRate = tc > 0 ? (Number(r.data?.db_secured || 0) / tc * 100).toFixed(0) + '%' : '—'
              const ctRate = tc > 0 ? (Number(r.data?.outbound_contracts || 0) / tc * 100).toFixed(0) + '%' : '—'
              return (
                <div key={r.id} className="px-5 py-3 flex items-center justify-between hover:bg-[#FAF8F3]">
                  <div>
                    <span className="text-sm font-medium text-[#1B2A45]">{r.report_date}</span>
                    <p className="text-xs text-[#1B2A45]/40 mt-0.5">
                      총콜 {tc}건 · 연결 {cn}건 <span className="text-amber-500 font-semibold">({connRate} 연결율)</span> · DB {r.data?.db_secured || 0}건 <span className="text-amber-400">({dbRate})</span> · 계약 {r.data?.outbound_contracts || 0}건 <span className="text-green-500 font-semibold">({ctRate})</span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {reportType === 'daily' && dailyReports.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E8E2D4] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E8E2D4]/60 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1B2A45]">지난 마감보고 누적</h3>
            <span className="text-xs text-[#1B2A45]/40">{dailyReports.length}건</span>
          </div>
          <div className="divide-y divide-[#E8E2D4]/40">
            {dailyReports.slice(0, 50).map((r: any) => (
              <div key={r.id} className="px-5 py-3 hover:bg-[#FAF8F3]">
                <span className="text-sm font-medium text-[#1B2A45]">{r.report_date}</span>
                <p className="text-xs text-[#1B2A45]/40 mt-0.5">
                  당일계약 {r.data?.today_contracts || 0}건 · 월누적 {r.data?.month_contracts || 0}건 · 목표 {r.data?.goal || 0}건
                  {r.data?.memo ? <span className="ml-2">· {r.data.memo}</span> : null}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
