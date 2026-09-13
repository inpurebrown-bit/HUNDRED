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
  preferred_call_time: string
  urgent_assign: boolean
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
  identity_disclosed:  '소속 고지',
  purpose_disclosed:   '목적 고지',
  source_disclosed:    '출처 고지',
  needs_check:         '니즈 확인',
  basic_info:          '기본정보',
  cancel_checked:      '캔슬확인',
  check_requirements:  '체크요건',
  closing_done:        '클로징',
  phone_secured:       '010 확보',
}

type ViewTab = 'pending' | 'approved' | 'rejected'

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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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

  // 긴급배정 건 도착 시 브라우저 알림
  useEffect(() => {
    const urgentUnassigned = prospects.filter(p => p.urgent_assign && p.status === 'approved')
    if (urgentUnassigned.length > 0 && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(`🚨 긴급 배정 요청 ${urgentUnassigned.length}건`, {
          body: urgentUnassigned.map(p => `${p.company} (${p.ceo_name})`).join(', '),
          tag: 'urgent-assign',
        })
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission()
      }
    }
  }, [prospects])

  // 탭별 필터 (approved탭 = approved + assigned 둘 다, 긴급배정 최상단 정렬)
  const pendingList  = prospects.filter(p => p.status === 'pending')
  const approvedListRaw = prospects.filter(p => p.status === 'approved')
  const assignedList = prospects.filter(p => p.status === 'assigned')
  const rejectedList = prospects.filter(p => p.status === 'rejected')

  // 긴급배정 건을 맨 위로
  const approvedList = [
    ...approvedListRaw.filter(p => p.urgent_assign),
    ...approvedListRaw.filter(p => !p.urgent_assign),
  ]

  const filtered = viewTab === 'pending'  ? pendingList
                 : viewTab === 'approved' ? [...approvedList, ...assignedList]
                 : rejectedList

  const counts = {
    pending:  pendingList.length,
    approved: approvedList.length + assignedList.length,
    rejected: rejectedList.length,
  }

  // 긴급 미배정 건수
  const urgentCount = approvedList.filter(p => p.urgent_assign).length

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
      setExpanded(null)
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
      setExpanded(null)
      await load()
    } else {
      const d = await res.json()
      showToast(d.error || '오류', 'error')
    }
    setProcessing(null)
  }

  async function deleteProspect(id: string) {
    setProcessing(id)
    const res = await fetch(`/api/dig-prospects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('삭제 완료')
      setExpanded(null)
      setDeleteConfirm(null)
      await load()
    } else {
      const d = await res.json()
      showToast(d.error || '삭제 실패', 'error')
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
      setExpanded(null)
      await load()
    } else {
      const d = await res.json()
      showToast(d.error || '오류', 'error')
    }
    setProcessing(null)
  }

  function renderCard(p: Prospect) {
    const checkCount = Object.values(p.checklist || {}).filter(Boolean).length
    const totalItems = Object.keys(CHECKLIST_LABELS).length
    const allPassed = checkCount === totalItems
    const isExpanded = expanded === p.id

    return (
      <div key={p.id} className={`bg-white rounded-xl border overflow-hidden ${
        p.urgent_assign && p.status === 'approved' ? 'border-red-400 ring-2 ring-red-300' : 'border-gray-100'
      }`}>
        {/* 긴급배정 배너 */}
        {p.urgent_assign && p.status === 'approved' && (
          <div className="bg-red-500 text-white px-4 py-1.5 text-xs font-black flex items-center gap-2">
            🚨 긴급 배정 요청
            {p.preferred_call_time && (
              <span className="font-normal opacity-90">— 통화 희망: {p.preferred_call_time}</span>
            )}
          </div>
        )}

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
                {p.urgent_assign && (
                  <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-black">🚨 긴급</span>
                )}
                {allPassed ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">체크리스트 완료</span>
                ) : (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{checkCount}/{totalItems} 완료</span>
                )}
                {p.recording_url && (
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">녹취 있음</span>
                )}
                {p.recording_analysis?.needs_level && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    p.recording_analysis.needs_level === '상' ? 'bg-red-100 text-red-700' :
                    p.recording_analysis.needs_level === '중' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    니즈 {p.recording_analysis.needs_level}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {p.ceo_name} · {p.phone_010} · {p.call_date}
                {p.preferred_call_time && !p.urgent_assign && (
                  <span className="ml-1 text-gray-500">· 통화희망: {p.preferred_call_time}</span>
                )}
              </p>
            </div>
            <span className="text-gray-300 text-xs shrink-0">{isExpanded ? '▲' : '▼'}</span>
          </div>

          {/* 체크리스트 도트 */}
          <div className="flex items-center gap-1 mt-2 flex-wrap">
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
              {p.preferred_call_time && <p><span className="text-gray-400">통화희망</span> {p.preferred_call_time}</p>}
              <p><span className="text-gray-400">연체·체납</span> {p.has_delinquency ? '있음' : '없음'}</p>
              {p.phone && <p><span className="text-gray-400">원번호</span> {p.phone}</p>}
            </div>

            {/* AI 코멘트 (심사 대기에서 미흡 항목 보고) */}
            {p.status === 'pending' && p.ceo_comment && (
              <div className={`rounded-lg px-3 py-2 text-xs ${
                p.ceo_comment.startsWith('AI 검토 필요')
                  ? 'bg-amber-50 border border-amber-200 text-amber-800'
                  : 'bg-blue-50 border border-blue-100 text-blue-700'
              }`}>
                <p className="font-semibold mb-0.5">AI 리포트</p>
                {p.ceo_comment}
              </div>
            )}

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
            {p.recording_analysis && !p.recording_analysis.parse_error && (() => {
              const ra = p.recording_analysis
              const verdict = ra.verdict || ''
              const verdictColor = verdict === '통과' ? 'emerald' : verdict === '재교육 필요' ? 'amber' : 'red'
              const timelineTypeStyle: Record<string, { bg: string; text: string; icon: string }> = {
                legal_violation: { bg: 'bg-red-100', text: 'text-red-700', icon: '🚨' },
                risk:            { bg: 'bg-red-50',  text: 'text-red-600', icon: '⚠️' },
                script_miss:     { bg: 'bg-amber-50', text: 'text-amber-700', icon: '📋' },
                audio_issue:     { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🎙️' },
                good:            { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: '✅' },
              }
              return (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* 헤더 — 종합 판정 */}
                  <div className={`px-4 py-3 flex items-center justify-between ${
                    verdictColor === 'emerald' ? 'bg-emerald-500' :
                    verdictColor === 'amber'   ? 'bg-amber-500' : 'bg-red-500'
                  } text-white`}>
                    <div>
                      <p className="text-xs font-black">통화 심사 리포트</p>
                      {verdict && <p className="text-sm font-black mt-0.5">{verdict}</p>}
                    </div>
                    <div className="text-right">
                      {ra.overall_score != null && (
                        <p className="text-2xl font-black">{ra.overall_score}<span className="text-sm font-normal">점</span></p>
                      )}
                      {ra.needs_level && (
                        <p className="text-xs font-semibold opacity-90">니즈 {ra.needs_level}</p>
                      )}
                    </div>
                  </div>

                  <div className="p-3 space-y-3">
                    {/* 총평 */}
                    {ra.ceo_comment && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-gray-400 mb-0.5 font-semibold">총평</p>
                        <p className="text-xs text-gray-800 font-medium">{ra.ceo_comment}</p>
                      </div>
                    )}

                    {/* 요약 */}
                    {ra.summary && (
                      <p className="text-xs text-gray-600 leading-relaxed">{ra.summary}</p>
                    )}

                    {/* 체크리스트 */}
                    {ra.checklist && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 mb-1">체크리스트</p>
                        <div className="grid grid-cols-3 gap-1">
                          {Object.entries(CHECKLIST_LABELS).map(([k, label]) => {
                            const passed = ra.checklist[k]
                            return (
                              <div key={k} className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-500'}`}>
                                <span>{passed ? '✅' : '❌'}</span>
                                <span className="font-medium truncate">{label}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* 타임라인 */}
                    {ra.timeline && ra.timeline.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 mb-1.5">타임라인 분석</p>
                        <div className="space-y-1.5">
                          {ra.timeline.map((item: any, i: number) => {
                            const style = timelineTypeStyle[item.type] || timelineTypeStyle.audio_issue
                            return (
                              <div key={i} className={`${style.bg} rounded-lg px-3 py-2`}>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-[10px] font-black text-gray-500 tabular-nums shrink-0">{item.time}</span>
                                  <span className="text-[10px]">{style.icon}</span>
                                  <span className={`text-[10px] font-bold ${style.text} truncate`}>{item.label}</span>
                                </div>
                                {item.detail && (
                                  <p className={`text-[10px] ${style.text} opacity-80 leading-snug pl-10`}>{item.detail}</p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* 심사 대기: 승인/거절 액션 */}
            {p.status === 'pending' && (
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

            {/* 승인됨 (배정 대기): 영업팀 배정 */}
            {p.status === 'approved' && (
              <div className={`space-y-3 border-t pt-3 ${p.urgent_assign ? 'border-red-200' : 'border-gray-100'}`}>
                <p className={`text-xs font-semibold ${p.urgent_assign ? 'text-red-600' : 'text-gray-700'}`}>
                  {p.urgent_assign ? '🚨 긴급 — 즉시 배정 필요 → 공급DB 이동' : '영업팀 직원 배정 → 공급DB로 이동'}
                </p>
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
                  className={`w-full py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors ${
                    p.urgent_assign ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1B2A45] hover:bg-[#1B2A45]/90'
                  }`}>
                  {processing === p.id ? '배정 중...' : '배정 확정 → 영업팀 직가DB 이동'}
                </button>
              </div>
            )}

            {/* 배정 완료 */}
            {p.status === 'assigned' && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                <p className="font-semibold">→ {p.assigned_to_name} 배정 완료 (영업팀 직가DB)</p>
              </div>
            )}

            {/* 거절됨: 코멘트 표시 */}
            {p.status === 'rejected' && p.ceo_comment && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
                <p className="font-semibold mb-0.5">거절 사유</p>
                {p.ceo_comment}
              </div>
            )}

            {/* 삭제 (CEO 전용, 모든 상태) */}
            <div className="border-t border-gray-100 pt-3">
              {deleteConfirm === p.id ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-red-600 font-semibold flex-1">정말 삭제하시겠습니까?</p>
                  <button
                    onClick={() => deleteProspect(p.id)}
                    disabled={processing === p.id}
                    className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 disabled:opacity-50">
                    {processing === p.id ? '삭제 중...' : '삭제 확인'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(p.id)}
                  className="text-xs text-gray-400 hover:text-red-500 font-medium transition-colors">
                  🗑 DB 삭제
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
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

      {/* 긴급배정 알림 배너 */}
      {urgentCount > 0 && (
        <div
          className="bg-red-500 text-white rounded-xl px-5 py-3.5 flex items-center gap-3 cursor-pointer shadow-lg"
          onClick={() => setViewTab('approved')}>
          <span className="text-2xl">🚨</span>
          <div className="flex-1">
            <p className="font-black text-sm">긴급 배정 요청 {urgentCount}건</p>
            <p className="text-red-100 text-xs mt-0.5">즉시 배정이 필요한 가망입니다 — 탭을 눌러 확인하세요</p>
          </div>
          <span className="text-red-200 text-xs font-semibold">승인됨 탭 →</span>
        </div>
      )}

      {/* 오늘 성과 요약 */}
      <div className="bg-[#1B2A45] rounded-xl px-5 py-4">
        <p className="text-white/50 text-[11px] mb-3">오늘 {today} · 발굴팀 성과</p>
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
          { key: 'pending',  label: '심사 대기', activeCls: 'bg-amber-500 text-white' },
          { key: 'approved', label: `승인됨 (미배정 ${approvedList.length} / 배정완료 ${assignedList.length})`, activeCls: 'bg-emerald-500 text-white' },
          { key: 'rejected', label: '거절됨',    activeCls: 'bg-red-500 text-white' },
        ] as const).map(t => (
          <button key={t.key}
            onClick={() => setViewTab(t.key)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors relative ${
              viewTab === t.key ? t.activeCls : 'text-gray-500 hover:bg-gray-50'
            }`}>
            {t.label}
            {t.key !== 'approved' && counts[t.key] > 0 && (
              <span className={`ml-1 ${viewTab === t.key ? 'text-white/80' : 'text-gray-400'}`}>
                ({counts[t.key]})
              </span>
            )}
            {/* 긴급 뱃지 */}
            {t.key === 'approved' && urgentCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                🚨{urgentCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
      ) : viewTab === 'approved' ? (
        <div className="space-y-5">
          {/* 미배정 섹션 */}
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs font-black text-emerald-700">▶ 배정 대기 ({approvedList.length}건)</span>
              <span className="text-[10px] text-gray-400">— 영업팀 배정 전</span>
              {urgentCount > 0 && (
                <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-black">🚨 긴급 {urgentCount}건</span>
              )}
            </div>
            {approvedList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-6 text-center text-gray-400 text-sm">배정 대기 중인 가망이 없습니다</div>
            ) : (
              <div className="space-y-3">
                {approvedList.map(p => renderCard(p))}
              </div>
            )}
          </div>
          {/* 배정완료 섹션 */}
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="text-xs font-black text-blue-600">▶ 배정 완료 ({assignedList.length}건)</span>
              <span className="text-[10px] text-gray-400">— 영업팀으로 이동됨</span>
            </div>
            {assignedList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 px-4 py-6 text-center text-gray-400 text-sm">배정 완료된 가망이 없습니다</div>
            ) : (
              <div className="space-y-3">
                {assignedList.map(p => renderCard(p))}
              </div>
            )}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          {viewTab === 'pending' ? '심사 대기 중인 가망이 없습니다' : '거절된 가망이 없습니다'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => renderCard(p))}
        </div>
      )}
    </div>
  )
}
