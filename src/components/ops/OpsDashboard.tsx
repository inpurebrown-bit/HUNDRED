'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { signOut } from 'next-auth/react'

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

export default function OpsDashboard({ userId, userName }: Props) {
  const [cases, setCases] = useState<OpsCase[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saved' | 'saving' | 'unsaved'>>({})
  const [filterStage, setFilterStage] = useState<string>('all')
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

  const filtered = filterStage === 'all' ? cases : cases.filter(c => c.progress_stage === filterStage)

  // 통계
  const totalRevenue = cases.reduce((sum, c) => sum + (c.revenue || 0), 0)
  const completedCount = cases.filter(c => c.progress_stage === 'completed').length
  const inProgressCount = cases.filter(c => !['completed', 'rejected'].includes(c.progress_stage)).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{userName.charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">관리팀 대시보드</h1>
            <p className="text-xs text-gray-400">{userName} 님</p>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-xs text-gray-400 hover:text-gray-700">
          로그아웃
        </button>
      </header>

      <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto">
        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: '담당 케이스', value: cases.length + '건', color: 'text-violet-600' },
            { label: '진행 중', value: inProgressCount + '건', color: 'text-amber-600' },
            { label: '완료', value: completedCount + '건', color: 'text-emerald-600' },
            { label: '누적 매출', value: totalRevenue > 0 ? (totalRevenue / 10000).toFixed(0) + '만원' : '-', color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 단계 필터 */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setFilterStage('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStage === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200'
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
                  filterStage === s.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 border border-gray-200'
                }`}
              >
                {s.label} ({count})
              </button>
            )
          })}
        </div>

        {/* 케이스 목록 */}
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-14 text-center text-gray-400 text-sm">
            {cases.length === 0
              ? '대표님이 배정한 케이스가 여기에 나타납니다.'
              : '해당 단계의 케이스가 없습니다.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => {
              const stage = STAGES.find(s => s.key === c.progress_stage) || STAGES[0]
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
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
      </div>
    </div>
  )
}
