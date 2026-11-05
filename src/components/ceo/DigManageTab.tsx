'use client'

import { useState, useEffect, useCallback } from 'react'
import { bizDays } from '@/lib/digStats'

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
  const [queue, setQueue] = useState<{ prospect_id: string; assigned_to_name: string; release_at: string }[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [bulkTarget, setBulkTarget] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  // 심사 화면에서 접수 내용 바로 수정 / AI 분석 다시 돌리기
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, any>>({})
  const [reanalyzing, setReanalyzing] = useState<string | null>(null)
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
    setQueue(prosData.queue || [])
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

  const thisMonth = today.slice(0, 7) // "YYYY-MM"
  const DAILY_GOAL   = 8
  const monthBiz     = bizDays(thisMonth).total
  const MONTHLY_GOAL = monthBiz * DAILY_GOAL   // 1인당 월 목표 = 영업일 × 일 8건 (초과분부터 1건당 1만원)

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
  })

  // 이번달 승인 건수 (dig 직원별)
  const monthApproved = prospects.filter(p =>
    (p.status === 'approved' || p.status === 'assigned') && p.call_date?.startsWith(thisMonth)
  )
  const byUserMonth: Record<string, { name: string; count: number }> = {}
  monthApproved.forEach(p => {
    if (!byUserMonth[p.dig_user_id]) {
      byUserMonth[p.dig_user_id] = { name: p.dig_user_name, count: 0 }
    }
    byUserMonth[p.dig_user_id].count++
  })
  const monthTotal = monthApproved.length
  const monthPct   = Math.min(100, Math.round((monthTotal / MONTHLY_GOAL) * 100))

  // 직원별 이번 달 통계 — 접수·승인·부결·대기, 목표 달성률, 니즈(상/중/하)·AI 점수
  const monthAll = prospects.filter(p => p.call_date?.startsWith(thisMonth))
  const statMap: Record<string, { name: string; submitted: number; approved: number; rejected: number; pending: number; needs: { 상: number; 중: number; 하: number }; scoreSum: number; scoreN: number }> = {}
  monthAll.forEach(p => {
    const k = p.dig_user_id
    if (!statMap[k]) statMap[k] = { name: p.dig_user_name, submitted: 0, approved: 0, rejected: 0, pending: 0, needs: { 상: 0, 중: 0, 하: 0 }, scoreSum: 0, scoreN: 0 }
    const s = statMap[k]
    s.submitted++
    if (p.status === 'approved' || p.status === 'assigned') s.approved++
    else if (p.status === 'rejected') s.rejected++
    else s.pending++
    const lv = p.recording_analysis?.needs_level
    if (lv === '상' || lv === '중' || lv === '하') s.needs[lv as '상' | '중' | '하']++
    const sc = Number(p.recording_analysis?.overall_score)
    if (!isNaN(sc) && p.recording_analysis?.overall_score != null) { s.scoreSum += sc; s.scoreN++ }
  })
  // 니즈 점수: 상 3 · 중 2 · 하 1 평균 (높을수록 좋은 가망을 따오는 사람)
  const needsAvg = (s: { needs: { 상: number; 중: number; 하: number } }) => {
    const n = s.needs.상 + s.needs.중 + s.needs.하
    return n ? (s.needs.상 * 3 + s.needs.중 * 2 + s.needs.하) / n : 0
  }
  const statRows = Object.entries(statMap).map(([id, s]) => ({ id, ...s })).sort((a, b) => b.approved - a.approved)
  const bestNeeds = [...statRows].filter(r => r.needs.상 + r.needs.중 + r.needs.하 >= 3).sort((a, b) => needsAvg(b) - needsAvg(a))[0]

  async function clearUrgent(id: string) {
    const res = await fetch(`/api/dig-prospects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear_urgent' }) })
    if (res.ok) { showToast('긴급 표시를 뺐어요'); await load() } else showToast('오류', 'error')
  }

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

  function startEdit(p: Prospect) {
    setEditId(p.id)
    setEditForm({
      company: p.company || '', ceo_name: p.ceo_name || '', phone_010: p.phone_010 || '',
      business_age: p.business_age || '', annual_revenue: p.annual_revenue || '', industry: p.industry || '',
      credit_score: p.credit_score || '', required_fund: p.required_fund || '',
      has_delinquency: !!p.has_delinquency, memo: p.memo || '', preferred_call_time: p.preferred_call_time || '',
    })
  }

  async function saveEdit(id: string) {
    setProcessing(id)
    const res = await fetch(`/api/dig-prospects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'edit', fields: editForm }) })
    if (res.ok) { showToast('수정했어요'); setEditId(null); await load() }
    else { const d = await res.json().catch(() => ({})); showToast(d.error || '수정 실패', 'error') }
    setProcessing(null)
  }

  async function reanalyze(id: string) {
    setReanalyzing(id)
    const res = await fetch(`/api/dig-prospects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reanalyze' }) })
    if (res.ok) { showToast('AI 분석을 다시 했어요'); await load() }
    else { const d = await res.json().catch(() => ({})); showToast(d.error || 'AI 재분석 실패', 'error') }
    setReanalyzing(null)
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

  const releaseLabel = (iso: string) => {
    const d = new Date(iso)
    const k = new Date(d.getTime() + 9 * 3600 * 1000)
    const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
    const day = k.toISOString().slice(0, 10)
    return `${day === today ? '오늘' : day.slice(5).replace('-', '/')} ${String(k.getUTCHours()).padStart(2, '0')}:00`
  }

  async function cancelQueued(id: string) {
    const res = await fetch(`/api/dig-prospects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel_queue' }) })
    if (res.ok) { showToast('예약을 취소했어요'); await load() } else showToast('오류', 'error')
  }

  async function bulkAssign(mode: 'schedule' | 'now') {
    if (checked.size === 0) { showToast('배정할 건을 체크해주세요', 'error'); return }
    if (!bulkTarget) { showToast('배정할 영업팀 직원을 선택해주세요', 'error'); return }
    const su = salesUsers.find(u => u.id === bulkTarget)
    setBulkBusy(true)
    const res = await fetch('/api/dig-prospects/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [...checked], assigned_to: bulkTarget, assigned_to_name: su?.name || '', mode }) })
    const d = await res.json().catch(() => ({}))
    if (res.ok) {
      showToast(mode === 'now' ? `${su?.name}에게 ${d.ok}건 즉시 배정했어요` : `${su?.name}에게 ${d.ok}건 예약 — ${releaseLabel(d.release_at)}에 공급DB로 들어가요`)
      setChecked(new Set())
      await load()
    } else showToast(d.error || '오류', 'error')
    setBulkBusy(false)
  }

  async function assign(id: string, mode: 'schedule' | 'now' = 'schedule') {
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
        mode,
      }),
    })
    if (res.ok) {
      const d = await res.json().catch(() => ({}))
      showToast(d.queued ? `${salesUser?.name}에게 예약 — ${releaseLabel(d.release_at)}에 공급DB로 들어가요` : `${salesUser?.name}에게 즉시 배정 완료 — 공급DB로 이동됐어요`)
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
        {p.urgent_assign && (
          <div className="bg-red-500 text-white px-4 py-1.5 text-xs font-black flex items-center gap-2">
            🚨 {p.status === 'approved' ? '긴급 배정 요청' : '긴급 (영업팀 확인 전)'}
            {p.preferred_call_time && (
              <span className="font-normal opacity-90">— 통화 희망: {p.preferred_call_time}</span>
            )}
            <button type="button" onClick={() => { if (confirm('긴급 표시를 뺄까요? (직원이 실수로 누른 경우)')) clearUrgent(p.id) }}
              className="ml-auto bg-white/90 text-red-600 text-[11px] font-bold px-2.5 py-0.5 rounded-full hover:bg-white">긴급 빼기</button>
          </div>
        )}

        {p.status === 'approved' && (() => {
          const q = queue.find(x => x.prospect_id === p.id)
          return q ? (
            <div className="bg-sky-50 border-b border-sky-100 px-4 py-1.5 text-[11px] text-sky-800 flex items-center gap-2">
              ⏰ <b>{q.assigned_to_name}</b> 예약 · {releaseLabel(q.release_at)} 공급DB 자동 입고
              <button type="button" onClick={() => cancelQueued(p.id)} className="ml-auto text-sky-600 underline">예약 취소</button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-4 pt-2 text-[11px] text-gray-400 cursor-pointer select-none">
              <input type="checkbox" checked={checked.has(p.id)} onChange={e => setChecked(prev => { const n = new Set(prev); if (e.target.checked) n.add(p.id); else n.delete(p.id); return n })} className="w-3.5 h-3.5 accent-[#1B2A45]" />
              일괄 배정에 선택
            </label>
          )
        })()}

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
                {p.recording_url && !(p.recording_analysis?.needs_level && p.recording_analysis?.checklist && !p.recording_analysis?.parse_error) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">AI 분석 없음</span>
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
            {/* 접수 내용 간단 수정 (직원이 잘못 입력해서 수정 요청한 경우) */}
            {editId === p.id ? (
              <div className="border-2 border-[#C5A258]/50 bg-[#FAF8F3] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#1B2A45]">✏️ 접수 내용 수정</p>
                  <button type="button" onClick={() => setEditId(null)} className="text-[11px] text-gray-400">취소</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['company', '업체명'], ['ceo_name', '대표자'], ['phone_010', '010 번호'], ['business_age', '업력'],
                    ['annual_revenue', '연매출'], ['industry', '업종'], ['credit_score', '신용점수'], ['required_fund', '필요자금'],
                  ] as const).map(([k, label]) => (
                    <label key={k} className="block">
                      <span className="text-[10px] text-gray-400">{label}</span>
                      <input value={editForm[k] ?? ''} onChange={e => setEditForm(prev => ({ ...prev, [k]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#1B2A45]" />
                    </label>
                  ))}
                  <label className="block">
                    <span className="text-[10px] text-gray-400">통화 희망시간</span>
                    <input type="datetime-local" value={editForm.preferred_call_time ?? ''} onChange={e => setEditForm(prev => ({ ...prev, preferred_call_time: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#1B2A45]" />
                  </label>
                  <div>
                    <span className="text-[10px] text-gray-400">연체·체납</span>
                    <div className="grid grid-cols-2 gap-1 mt-0.5">
                      {[false, true].map(v => (
                        <button key={String(v)} type="button" onClick={() => setEditForm(prev => ({ ...prev, has_delinquency: v }))}
                          className={`py-1.5 rounded-lg text-xs font-bold border ${editForm.has_delinquency === v ? (v ? 'bg-red-500 text-white border-red-500' : 'bg-emerald-500 text-white border-emerald-500') : 'bg-white text-gray-400 border-gray-200'}`}>
                          {v ? '있음' : '없음'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <label className="block">
                  <span className="text-[10px] text-gray-400">메모 (체납 내용 등)</span>
                  <input value={editForm.memo ?? ''} onChange={e => setEditForm(prev => ({ ...prev, memo: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:border-[#1B2A45]" />
                </label>
                <button type="button" disabled={processing === p.id} onClick={() => saveEdit(p.id)}
                  className="w-full bg-[#1B2A45] text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50">{processing === p.id ? '저장 중…' : '저장'}</button>
                {p.status === 'assigned' && <p className="text-[10px] text-gray-400">이미 영업팀에 배정된 건이라 고객 카드에도 같이 반영됩니다.</p>}
              </div>
            ) : (
              <div className="flex justify-end -mb-2">
                <button type="button" onClick={() => startEdit(p)} className="text-[11px] font-bold text-[#1B2A45]/70 border border-[#1B2A45]/20 rounded-full px-3 py-1 hover:bg-[#FAF8F3]">✏️ 내용 수정</button>
              </div>
            )}

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
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                {(Array.isArray(p.recording_analysis?.recordings) && p.recording_analysis.recordings.length > 1
                  ? p.recording_analysis.recordings as { url: string; name: string }[]
                  : [{ url: p.recording_url, name: p.recording_filename }]
                ).map((r, i, arr) => (
                  <div key={r.url}>
                    <p className="text-[11px] text-slate-600 font-semibold mb-2">녹취 파일{arr.length > 1 ? ` ${i + 1}/${arr.length}` : ''} — {r.name}</p>
                    <audio controls src={r.url} className="w-full" />
                  </div>
                ))}
              </div>
            )}

            {/* AI 분석이 비어 있는 건 — 다시 분석 */}
            {p.recording_url && !(p.recording_analysis?.needs_level && p.recording_analysis?.checklist && !p.recording_analysis?.parse_error) && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-xs text-amber-800 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-bold">AI 분석(니즈·리포트)이 비어 있어요</p>
                  <p className="opacity-80 mt-0.5">AI 서버 일시 오류로 빠진 건입니다. 다시 분석하면 채워집니다 (1분 정도 걸릴 수 있어요).</p>
                </div>
                <button type="button" disabled={reanalyzing === p.id} onClick={() => reanalyze(p.id)}
                  className="shrink-0 bg-amber-500 text-white font-bold px-3 py-2 rounded-lg disabled:opacity-50">{reanalyzing === p.id ? '분석 중…' : '🔄 AI 재분석'}</button>
              </div>
            )}

            {/* AI 분석 실패 fallback */}
            {p.recording_analysis?.parse_error && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
                <p className="font-bold mb-1">⚠ 자동 분석 미완료 — 직접 녹취 확인 필요</p>
                <p className="text-amber-700 opacity-80">녹취는 정상 업로드됐습니다. 위 플레이어로 직접 들어보고 승인/거절 판단해주세요.</p>
              </div>
            )}

            {/* 직원 입력 vs AI 추출 비교표 */}
            {p.recording_analysis && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-700">직원 입력 vs AI 분석 비교</p>
                  <p className="text-xs text-gray-400">황색 = 불일치 항목</p>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="py-1.5 px-3 text-left text-gray-400 font-medium w-1/4">항목</th>
                      <th className="py-1.5 px-3 text-left text-gray-600 font-semibold">직원 입력</th>
                      <th className="py-1.5 px-3 text-left text-gray-400 font-medium">AI 추출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const ci = p.recording_analysis?.customer_info || {}
                      const rows = [
                        { label: '회사명',   emp: p.company,        ai: ci.company },
                        { label: '대표자',   emp: p.ceo_name,       ai: ci.ceo_name },
                        { label: '연락처',   emp: p.phone_010,      ai: ci.phone_010 },
                        { label: '업력',     emp: p.business_age,   ai: ci.business_age },
                        { label: '연매출',   emp: p.annual_revenue, ai: ci.annual_revenue },
                        { label: '업종',     emp: p.industry,       ai: ci.industry },
                        { label: '신용점수', emp: p.credit_score,   ai: ci.credit_score },
                        { label: '필요자금', emp: p.required_fund,  ai: ci.required_fund },
                        { label: '연체여부', emp: p.has_delinquency ? '있음' : '없음', ai: ci.has_delinquency == null ? '-' : ci.has_delinquency ? '있음' : '없음' },
                      ]
                      return rows.map(({ label, emp, ai }) => {
                        const mismatch = emp && ai && ai !== '-' && emp !== ai
                        return (
                          <tr key={label} className={`border-b border-gray-50 ${mismatch ? 'bg-amber-50' : ''}`}>
                            <td className="py-1.5 px-3 text-gray-400">{label}</td>
                            <td className="py-1.5 px-3 text-gray-800 font-medium">{emp || <span className="text-gray-300">미입력</span>}</td>
                            <td className={`py-1.5 px-3 ${mismatch ? 'text-amber-700 font-semibold' : 'text-gray-400'}`}>{ai || '-'}</td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => assign(p.id, 'schedule')}
                    disabled={processing === p.id || !assignTarget[p.id]}
                    className="py-2.5 bg-[#1B2A45] hover:bg-[#1B2A45]/90 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors">
                    ⏰ 예약 배정 (다음 영업일 아침 자동 입고)
                  </button>
                  <button
                    onClick={() => assign(p.id, 'now')}
                    disabled={processing === p.id || !assignTarget[p.id]}
                    className={`py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors ${p.urgent_assign ? 'bg-red-500 hover:bg-red-600' : 'bg-red-400/90 hover:bg-red-500'}`}>
                    {processing === p.id ? '배정 중...' : '🚨 즉시 배정'}
                  </button>
                </div>
              </div>
            )}

            {/* 배정 완료 */}
            {p.status === 'assigned' && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                <p className="font-semibold">→ {p.assigned_to_name} 배정 완료 (영업팀 공급DB)</p>
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

      {/* 성과 요약 */}
      <div className="bg-[#1B2A45] rounded-xl px-5 py-4 space-y-4">
        {/* 이번달 전체 진행률 */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-white/50 text-[11px]">{thisMonth} · 이번달 총 목표</p>
            <p className="text-white text-xs font-bold">{monthTotal} / {MONTHLY_GOAL}건</p>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${monthPct >= 100 ? 'bg-emerald-400' : monthPct >= 70 ? 'bg-[#C5A258]' : 'bg-white/40'}`}
              style={{ width: `${monthPct}%` }}
            />
          </div>
          <p className="text-white/40 text-[10px] mt-1">{monthPct}% 달성 · 남은 목표 {Math.max(0, MONTHLY_GOAL - monthTotal)}건</p>
        </div>

        {/* 직원별 이번 달 통계 */}
        <div>
          <p className="text-white/40 text-[10px] mb-2">직원별 이번 달 통계 · 1인 목표 {MONTHLY_GOAL}건 (영업일 {monthBiz}일 × {DAILY_GOAL}건) · {MONTHLY_GOAL + 1}건부터 1건당 1만원 인센</p>
          {statRows.length === 0 ? (
            <p className="text-white/30 text-xs">이번 달 접수된 가망이 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] text-white/80 min-w-[640px]">
                <thead>
                  <tr className="text-white/40 text-[10px] text-right">
                    <th className="text-left font-normal pb-1">직원</th>
                    <th className="font-normal pb-1">접수</th>
                    <th className="font-normal pb-1">승인</th>
                    <th className="font-normal pb-1">부결</th>
                    <th className="font-normal pb-1">대기</th>
                    <th className="font-normal pb-1">목표 달성</th>
                    <th className="font-normal pb-1">승인율</th>
                    <th className="font-normal pb-1">니즈 상/중/하</th>
                    <th className="font-normal pb-1">니즈 점수</th>
                    <th className="font-normal pb-1">AI 평균</th>
                    <th className="font-normal pb-1">인센</th>
                  </tr>
                </thead>
                <tbody>
                  {statRows.map(r => {
                    const rate = r.approved + r.rejected > 0 ? Math.round((r.approved / (r.approved + r.rejected)) * 100) : null
                    const bonus = Math.max(0, r.approved - MONTHLY_GOAL) * 10000
                    const na = needsAvg(r)
                    return (
                      <tr key={r.id} className="text-right border-t border-white/10">
                        <td className="text-left py-1.5 font-bold text-white">{r.name}{bestNeeds?.id === r.id ? ' ⭐' : ''}</td>
                        <td>{r.submitted}</td>
                        <td className="text-emerald-300 font-bold">{r.approved}</td>
                        <td className={r.rejected > 0 ? 'text-red-300 font-bold' : ''}>{r.rejected}</td>
                        <td>{r.pending}</td>
                        <td>{r.approved}/{MONTHLY_GOAL} <span className="text-white/40">({Math.round((r.approved / MONTHLY_GOAL) * 100)}%)</span></td>
                        <td>{rate === null ? '-' : `${rate}%`}</td>
                        <td>{r.needs.상}/{r.needs.중}/{r.needs.하}</td>
                        <td className={na >= 2.3 ? 'text-emerald-300 font-bold' : na > 0 && na < 1.7 ? 'text-red-300' : ''}>{na ? na.toFixed(1) : '-'}</td>
                        <td>{r.scoreN ? Math.round(r.scoreSum / r.scoreN) : '-'}</td>
                        <td className="text-[#C5A258]">{bonus > 0 ? `+${bonus.toLocaleString()}원` : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-white/30 text-[10px] mt-1.5">니즈 점수 = 상 3 · 중 2 · 하 1 평균 (⭐ = 접수 3건 이상 중 니즈가 가장 좋은 직원) · 승인율 = 승인 ÷ (승인+부결)</p>
            </div>
          )}
        </div>

        {/* 오늘 현황 */}
        <div>
          <p className="text-white/40 text-[10px] mb-2">오늘 {today} · 일별 목표 {DAILY_GOAL}건</p>
          {Object.keys(byUser).length === 0 ? (
            <p className="text-white/30 text-xs">오늘 승인된 가망이 없습니다</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(byUser).map(([uid, info]) => (
                <div key={uid} className="bg-white/10 rounded-lg px-3 py-1.5">
                  <p className="text-white text-xs font-bold">{info.name}</p>
                  <p className="text-white/60 text-[11px]">오늘 {info.count}건 / {DAILY_GOAL}건</p>
                </div>
              ))}
            </div>
          )}
        </div>
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
            {approvedList.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 px-3 py-2.5 mb-3 flex flex-wrap items-center gap-2">
                <button type="button" className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 font-semibold"
                  onClick={() => { const free = approvedList.filter(p => !queue.some(q => q.prospect_id === p.id)).map(p => p.id); setChecked(prev => prev.size >= free.length ? new Set() : new Set(free)) }}>
                  전체 선택/해제
                </button>
                <span className="text-[11px] text-gray-500">선택 <b className="text-[#1B2A45]">{checked.size}</b>건</span>
                <select value={bulkTarget} onChange={e => setBulkTarget(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                  <option value="">배정할 직원...</option>
                  {salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <button type="button" disabled={bulkBusy || checked.size === 0 || !bulkTarget} onClick={() => bulkAssign('schedule')}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-[#1B2A45] text-white disabled:opacity-40">⏰ 일괄 예약 배정</button>
                <button type="button" disabled={bulkBusy || checked.size === 0 || !bulkTarget} onClick={() => bulkAssign('now')}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500 text-white disabled:opacity-40">🚨 일괄 즉시 배정</button>
              </div>
            )}
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
