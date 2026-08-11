'use client'

import { useState, useEffect, useCallback } from 'react'

interface Prospect {
  id: string
  dig_user_id: string
  dig_user_name: string
  company: string
  ceo_name: string
  phone: string
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
  assigned_to: string
  assigned_to_name: string
  created_at: string
  call_date: string
}

interface SalesUser {
  id: string
  name: string
  username: string
}

const CHECKLIST_LABELS: Record<string, string> = {
  needs_check: '니즈 확인',
  basic_info: '기본정보',
  purpose_explained: '취지 설명',
  closing_done: '클로징',
  phone_secured: '010 확보',
}

type ViewTab = 'pending' | 'approved' | 'rejected' | 'assigned'

export default function DigManageTab() {
  const [viewTab, setViewTab] = useState<ViewTab>('pending')
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [commentMap, setCommentMap] = useState<Record<string, string>>({})
  const [assignTarget, setAssignTarget] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState<string | null>(null)

  // 오늘 날짜
  const today = new Date().toISOString().slice(0, 10)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const [prosRes, usersRes] = await Promise.all([
      fetch('/api/dig-prospects?status=all'),
      fetch('/api/users?role=sales'),
    ])
    const prosData = await prosRes.json()
    const usersData = await usersRes.json()
    setProspects(prosData.prospects || [])
    setSalesUsers(usersData.users || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = prospects.filter(p => p.status === viewTab)

  // 탭별 카운트
  const counts = {
    pending: prospects.filter(p => p.status === 'pending').length,
    approved: prospects.filter(p => p.status === 'approved').length,
    rejected: prospects.filter(p => p.status === 'rejected').length,
    assigned: prospects.filter(p => p.status === 'assigned').length,
  }

  // 오늘 승인 건수 (dig 직원별)
  const todayApproved = prospects.filter(p =>
    (p.status === 'approved' || p.status === 'assigned') && p.call_date === today
  )
  const byUser: Record<string, { name: string; count: number; bonus: number }> = {}
  todayApproved.forEach(p => {
    if (!byUser[p.dig_user_id]) {
      byUser[p.dig_user_id] = { name: p.dig_user_name, count: 0, bonus: 0 }
    }
    byUser[p.dig_user_id].count++
    byUser[p.dig_user_id].bonus = Math.max(0, byUser[p.dig_user_id].count - 8) * 10000
  })

  async function approve(id: string) {
    setProcessing(id)
    const res = await fetch(`/api/dig-prospects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', ceo_comment: commentMap[id] || '' }),
    })
    if (res.ok) {
      showToast('승인 완료')
      await load()
    } else {
      const d = await res.json()
      showToast(d.error || '오류', 'error')
    }
    setProcessing(null)
  }

  async function reject(id: string) {
    if (!commentMap[id]?.trim()) {
      showToast('거절 사유를 입력해주세요', 'error')
      return
    }
    setProcessing(id)
    const res = await fetch(`/api/dig-prospects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', ceo_comment: commentMap[id] }),
    })
    if (res.ok) {
      showToast('거절 처리됨')
      await load()
    } else {
      const d = await res.json()
      showToast(d.error || '오류', 'error')
    }
    setProcessing(null)
  }

  async function assign(id: string) {
    const salesId = assignTarget[id]
    if (!salesId) {
      showToast('배정할 영업팀 직원을 선택해주세요', 'error')
      return
    }
    const salesUser = salesUsers.find(u => u.id === salesId)
    setProcessing(id)
    const res = await fetch(`/api/dig-prospects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'assign',
        assigned_to: salesId,
        assigned_to_name: salesUser?.name || '',
      }),
    })
    if (res.ok) {
      showToast(`${salesUser?.name}에게 배정 완료 — 직가DB로 이동됩니다`)
      await load()
    } else {
      const d = await res.json()
      showToast(d.error || '오류', 'error')
    }
    setProcessing(null)
  }

  return (
    <div className="space-y-5">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold text-white max-w-sm text-center ${
          toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* 오늘 성과 요약 */}
      <div className="bg-[#1B2A45] rounded-xl px-5 py-4">
        <p className="text-white/50 text-[11px] mb-3">오늘 {today} · 1차 발굴팀 성과</p>
        {Object.keys(byUser).length === 0 ? (
          <p className="text-white/40 text-sm">오늘 승인된 가망이 없습니다</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(byUser).map(([uid, info]) => (
              <div key={uid} className="bg-white/10 rounded-xl px-4 py-2.5">
                <p className="text-white text-sm font-bold">{info.name}</p>
                <p className="text-white/60 text-[11px]">승인 {info.count}건 / 목표 8건</p>
                {info.bonus > 0 && (
                  <p className="text-[#C5A258] text-[11px] font-semibold">인센티브 +{info.bonus.toLocaleString()}원</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 뷰 탭 */}
      <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden">
        {([
          { key: 'pending', label: '심사 대기', color: 'amber' },
          { key: 'approved', label: '승인됨', color: 'emerald' },
          { key: 'rejected', label: '거절됨', color: 'red' },
          { key: 'assigned', label: '배정 완료', color: 'blue' },
        ] as const).map(t => (
          <button key={t.key}
            onClick={() => setViewTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${
              viewTab === t.key
                ? t.key === 'pending' ? 'bg-amber-500 text-white'
                  : t.key === 'approved' ? 'bg-emerald-500 text-white'
                  : t.key === 'rejected' ? 'bg-red-500 text-white'
                  : 'bg-blue-500 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}>
            {t.label}
            {counts[t.key] > 0 && (
              <span className={`ml-1 ${viewTab === t.key ? 'text-white/80' : 'text-gray-400'}`}>
                ({counts[t.key]})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          {viewTab === 'pending' ? '심사 대기 중인 가망이 없습니다' :
           viewTab === 'approved' ? '승인된 가망이 없습니다' :
           viewTab === 'rejected' ? '거절된 가망이 없습니다' :
           '배정 완료된 가망이 없습니다'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const checkCount = Object.values(p.checklist || {}).filter(Boolean).length
            const allPassed = checkCount === 5
            const isExpanded = expanded === p.id

            return (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {/* 카드 헤더 */}
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : p.id)}
                  className="w-full text-left px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-800">{p.company || '(업체명 없음)'}</p>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{p.dig_user_name}</span>
                        {allPassed ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">체크리스트 완료</span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{checkCount}/5 완료</span>
                        )}
                        {p.recording_url && (
                          <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">녹취 있음</span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {p.ceo_name} · {p.phone_010} · {p.call_date}
                      </p>
                    </div>
                    <span className="text-gray-300 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {/* 체크리스트 도트 */}
                  <div className="flex items-center gap-1 mt-2">
                    {Object.entries(CHECKLIST_LABELS).map(([k, label]) => (
                      <span key={k} title={label}
                        className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                          p.checklist?.[k] ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                        {label}
                      </span>
                    ))}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                    {/* 업체 정보 */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      {p.business_age && <p><span className="text-gray-400">업력</span> {p.business_age}</p>}
                      {p.annual_revenue && <p><span className="text-gray-400">연매출</span> {p.annual_revenue}</p>}
                      {p.industry && <p><span className="text-gray-400">업종</span> {p.industry}</p>}
                      {p.credit_score && <p><span className="text-gray-400">신용점수</span> {p.credit_score}</p>}
                      {p.required_fund && <p><span className="text-gray-400">필요자금</span> {p.required_fund}</p>}
                      <p><span className="text-gray-400">연체·체납</span> {p.has_delinquency ? '있음' : '없음'}</p>
                      {p.phone && <p><span className="text-gray-400">원번호</span> {p.phone}</p>}
                    </div>

                    {p.memo && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
                        <p className="text-[10px] text-gray-400 mb-0.5">메모</p>
                        {p.memo}
                      </div>
                    )}

                    {/* 녹취 플레이어 */}
                    {p.recording_url && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <p className="text-[11px] text-slate-600 font-semibold mb-2">녹취 파일 — {p.recording_filename}</p>
                        <audio controls src={p.recording_url} className="w-full" />
                      </div>
                    )}

                    {/* AI 분석 결과 */}
                    {p.recording_analysis && !p.recording_analysis.parse_error && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                        <p className="text-[11px] font-bold text-emerald-700">AI 통화 분석 결과</p>
                        {p.recording_analysis.summary && (
                          <p className="text-xs text-gray-700">{p.recording_analysis.summary}</p>
                        )}
                        {p.recording_analysis.feedback && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">{p.recording_analysis.feedback}</p>
                        )}
                        {p.recording_analysis.all_passed !== undefined && (
                          <p className={`text-[11px] font-semibold ${p.recording_analysis.all_passed ? 'text-emerald-700' : 'text-red-600'}`}>
                            {p.recording_analysis.all_passed ? '✅ AI 체크: 모든 항목 통과' : '⚠️ AI 체크: 일부 항목 미완료'}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 심사 대기: 승인/거절 액션 */}
                    {viewTab === 'pending' && (
                      <div className="space-y-3 border-t border-gray-100 pt-3">
                        <textarea
                          value={commentMap[p.id] || ''}
                          onChange={e => setCommentMap(prev => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="코멘트 입력 (거절 시 필수)"
                          rows={2}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/20 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => approve(p.id)}
                            disabled={processing === p.id}
                            className="flex-1 py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                            {processing === p.id ? '처리 중...' : '✓ 승인'}
                          </button>
                          <button
                            onClick={() => reject(p.id)}
                            disabled={processing === p.id}
                            className="flex-1 py-2.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors">
                            {processing === p.id ? '처리 중...' : '✗ 거절'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 승인됨: 영업팀 배정 */}
                    {viewTab === 'approved' && (
                      <div className="space-y-3 border-t border-gray-100 pt-3">
                        <p className="text-xs font-semibold text-gray-700">영업팀 직원 배정 → 직가DB로 이동</p>
                        <select
                          value={assignTarget[p.id] || ''}
                          onChange={e => setAssignTarget(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                          <option value="">배정할 직원 선택...</option>
                          {salesUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => assign(p.id)}
                          disabled={processing === p.id || !assignTarget[p.id]}
                          className="w-full py-2.5 bg-[#1B2A45] text-white text-sm font-bold rounded-xl hover:bg-[#1B2A45]/90 disabled:opacity-50 transition-colors">
                          {processing === p.id ? '배정 중...' : '배정 확정 → 영업팀 직가DB 이동'}
                        </button>
                      </div>
                    )}

                    {/* 거절됨: 코멘트 표시 */}
                    {viewTab === 'rejected' && p.ceo_comment && (
                      <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
                        <p className="font-semibold mb-0.5">거절 사유</p>
                        {p.ceo_comment}
                      </div>
                    )}

                    {/* 배정 완료 */}
                    {viewTab === 'assigned' && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                        <p className="font-semibold">→ {p.assigned_to_name} 배정 완료 (영업팀 직가DB)</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
