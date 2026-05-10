'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────
interface OpsCase {
  id: string
  customer_id: string
  ops_user_name: string
  institution: string | null
  progress_stage: string
  progress_memo: string
  in_call_manager: string
  visit_schedule: string
  next_plan: string
  is_refund: boolean
  is_completed: boolean
  refund_reason: string
  approved_amount: number
  commission_amount: number
  revenue: number
  created_at: string
  updated_at: string
  customers: {
    name: string
    details?: Record<string, any>
    phone: string
  }
}

// ─── Constants ────────────────────────────────────────────
const INSTITUTION_SECTIONS = [
  { key: 'new',          label: '신규업체',        values: ['new', '', null] as (string | null)[] },
  { key: 'jungzin',     label: '중진공',           values: ['jungzin'] },
  { key: 'sojin_new',   label: '소진공(신취)',     values: ['sojin_new'] },
  { key: 'sojin_innov', label: '소진공(혁신)',     values: ['sojin_innov'] },
  { key: 'sojin_retry', label: '소진공(재도전)',   values: ['sojin_retry'] },
  { key: 'kibo',        label: '기보',             values: ['kibo'] },
  { key: 'shinbo',      label: '신보',             values: ['shinbo'] },
  { key: 'foundation',  label: '재단',             values: ['foundation'] },
]

const INSTITUTION_OPTIONS = [
  { value: 'new',          label: '신규업체' },
  { value: 'jungzin',     label: '중진공' },
  { value: 'sojin_new',   label: '소진공(신취)' },
  { value: 'sojin_innov', label: '소진공(혁신)' },
  { value: 'sojin_retry', label: '소진공(재도전)' },
  { value: 'kibo',        label: '기보' },
  { value: 'shinbo',      label: '신보' },
  { value: 'foundation',  label: '재단' },
]

const STAGE_OPTIONS = [
  '서류받는중', '접수준비완료', '신청완료', '반려', '실사중',
  '승인', '부결', '수수료입금전', '홀딩', '환불', '종료',
]

const STAGE_COLORS: Record<string, string> = {
  '서류받는중':  'bg-slate-100 text-slate-700',
  '접수준비완료':'bg-blue-100 text-blue-700',
  '신청완료':    'bg-violet-100 text-violet-700',
  '반려':        'bg-red-100 text-red-700',
  '실사중':      'bg-amber-100 text-amber-700',
  '승인':        'bg-emerald-100 text-emerald-700',
  '부결':        'bg-red-100 text-red-700',
  '수수료입금전':'bg-orange-100 text-orange-700',
  '홀딩':        'bg-gray-100 text-gray-600',
  '환불':        'bg-rose-100 text-rose-700',
  '종료':        'bg-green-100 text-green-700',
}

function fmt(n: number) {
  if (!n) return '-'
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억원'
  if (n >= 10_000) return Math.round(n / 10_000) + '만원'
  return n.toLocaleString() + '원'
}

// ─── Single case card ─────────────────────────────────────
interface CaseCardProps {
  c: OpsCase
  onUpdate: (id: string, patch: Partial<OpsCase>) => Promise<void>
}

function CaseCard({ c, onUpdate }: CaseCardProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localInstitution, setLocalInstitution] = useState(c.institution ?? 'new')
  const [localStage, setLocalStage] = useState(c.progress_stage ?? '')

  async function handleInstitutionChange(val: string) {
    setLocalInstitution(val)
    setSaving(true)
    await onUpdate(c.id, { institution: val })
    setSaving(false)
  }

  async function handleStageChange(val: string) {
    setLocalStage(val)
    setSaving(true)
    await onUpdate(c.id, { progress_stage: val })
    setSaving(false)
  }

  const stageBadge = STAGE_COLORS[localStage] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="bg-white border border-[#E8E2D4] rounded-xl overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-4 py-3 hover:bg-[#FAF8F3] transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[#1B2A45] text-sm">{c.customers?.name || '-'}</span>
                {(c.customers?.details?.company || c.customers?.name) && (
                  <span className="text-xs text-[#1B2A45]/50">{(c.customers?.details?.company || c.customers?.name)}</span>
                )}
                {c.ops_user_name && (
                  <span className="text-xs text-[#1B2A45]/40">{c.ops_user_name}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageBadge}`}>
              {localStage || '단계미설정'}
            </span>
            {saving && <span className="text-[10px] text-[#C5A258]">저장중...</span>}
            <span className="text-[#1B2A45]/40 text-xs">{open ? '▲' : '▼'}</span>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-[#E8E2D4] px-4 py-4 space-y-3 bg-[#FAF8F3]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {c.in_call_manager && (
              <div>
                <span className="text-xs text-[#1B2A45]/50 block mb-0.5">인콜담당자</span>
                <span className="text-[#1B2A45]">{c.in_call_manager}</span>
              </div>
            )}
            {c.visit_schedule && (
              <div>
                <span className="text-xs text-[#1B2A45]/50 block mb-0.5">방문일정</span>
                <span className="text-[#1B2A45]">{c.visit_schedule}</span>
              </div>
            )}
          </div>

          {c.progress_memo && (
            <div>
              <span className="text-xs text-[#1B2A45]/50 block mb-0.5">진행현황</span>
              <p className="text-sm text-[#1B2A45] whitespace-pre-wrap bg-white border border-[#E8E2D4] rounded-lg px-3 py-2">
                {c.progress_memo}
              </p>
            </div>
          )}

          {c.next_plan && (
            <div>
              <span className="text-xs text-[#1B2A45]/50 block mb-0.5">이후 진행 계획</span>
              <p className="text-sm text-[#1B2A45] whitespace-pre-wrap bg-white border border-[#E8E2D4] rounded-lg px-3 py-2">
                {c.next_plan}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Institution type dropdown */}
            <div>
              <label className="text-xs text-[#1B2A45]/50 block mb-1">기관 변경</label>
              <select
                value={localInstitution}
                onChange={e => handleInstitutionChange(e.target.value)}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/30 bg-white"
              >
                {INSTITUTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Stage dropdown */}
            <div>
              <label className="text-xs text-[#1B2A45]/50 block mb-1">단계 변경</label>
              <select
                value={localStage}
                onChange={e => handleStageChange(e.target.value)}
                className="w-full border border-[#E8E2D4] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/30 bg-white"
              >
                <option value="">단계 선택</option>
                {STAGE_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Special action buttons */}
          <div className="flex gap-2 flex-wrap">
            {localStage === '환불' && (
              <button
                onClick={() => onUpdate(c.id, { is_refund: true })}
                className="text-xs bg-rose-100 hover:bg-rose-200 text-rose-700 font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                환불섹션으로 이동
              </button>
            )}
            {localStage === '종료' && (
              <button
                onClick={() => onUpdate(c.id, { is_completed: true })}
                className="text-xs bg-green-100 hover:bg-green-200 text-green-700 font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                종료섹션으로 이동
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section 1: 기관별 진행업체 ──────────────────────────
interface InstitutionSectionProps {
  cases: OpsCase[]
  onUpdate: (id: string, patch: Partial<OpsCase>) => Promise<void>
}

function InstitutionSection({ cases, onUpdate }: InstitutionSectionProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggleSection(key: string) {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-[#1B2A45] text-base">기관별 진행업체</h2>
      <div className="space-y-4">
        {INSTITUTION_SECTIONS.map(sec => {
          const sectionCases = cases.filter(c => {
            const it = c.institution
            if (sec.key === 'new') {
              return !it || it === '' || it === 'new'
            }
            return sec.values.includes(it)
          })

          const isCollapsed = collapsed[sec.key]

          return (
            <div key={sec.key} className="space-y-2">
              <button
                onClick={() => toggleSection(sec.key)}
                className="w-full flex items-center justify-between py-2 px-3 bg-[#1B2A45] rounded-xl hover:bg-[#1B2A45]/90 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm">{sec.label}</span>
                  <span className="bg-[#C5A258] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {sectionCases.length}
                  </span>
                </div>
                <span className="text-white/60 text-xs">{isCollapsed ? '▼' : '▲'}</span>
              </button>

              {!isCollapsed && (
                <div className="space-y-2 pl-1">
                  {sectionCases.length === 0 ? (
                    <div className="bg-white border border-[#E8E2D4] rounded-xl px-4 py-4 text-center text-sm text-[#1B2A45]/40">
                      해당 업체 없음
                    </div>
                  ) : (
                    sectionCases.map(c => (
                      <CaseCard key={c.id} c={c} onUpdate={onUpdate} />
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Section 2: 환불업체 ─────────────────────────────────
interface RefundSectionProps {
  cases: OpsCase[]
  onUpdate: (id: string, patch: Partial<OpsCase>) => Promise<void>
}

function RefundSection({ cases, onUpdate }: RefundSectionProps) {
  const [editingReason, setEditingReason] = useState<Record<string, string>>({})
  const [savingReason, setSavingReason] = useState<string | null>(null)

  const refundPending  = cases.filter(c => c.is_refund && c.progress_stage !== '환불완료')
  const refundComplete = cases.filter(c => c.is_refund && c.progress_stage === '환불완료')

  async function saveReason(id: string) {
    const reason = editingReason[id]
    if (reason === undefined) return
    setSavingReason(id)
    await onUpdate(id, { refund_reason: reason })
    setSavingReason(null)
  }

  function renderCase(c: OpsCase) {
    const reason = editingReason[c.id] !== undefined ? editingReason[c.id] : (c.refund_reason ?? '')
    return (
      <div key={c.id} className="bg-white border border-[#E8E2D4] rounded-xl px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold text-[#1B2A45] text-sm">{c.customers?.name || '-'}</span>
            {(c.customers?.details?.company || c.customers?.name) && (
              <span className="text-xs text-[#1B2A45]/50 ml-2">{(c.customers?.details?.company || c.customers?.name)}</span>
            )}
            {c.ops_user_name && (
              <span className="text-xs text-[#1B2A45]/40 ml-2">{c.ops_user_name}</span>
            )}
          </div>
          {c.commission_amount > 0 && (
            <span className="text-xs font-medium text-rose-600">{fmt(c.commission_amount)}</span>
          )}
        </div>
        <div>
          <label className="text-xs text-[#1B2A45]/50 block mb-1">환불사유</label>
          <div className="flex gap-2">
            <textarea
              value={reason}
              onChange={e => setEditingReason(prev => ({ ...prev, [c.id]: e.target.value }))}
              rows={2}
              placeholder="환불 사유를 입력하세요"
              className="flex-1 border border-[#E8E2D4] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/30 resize-none"
            />
            <button
              onClick={() => saveReason(c.id)}
              disabled={savingReason === c.id}
              className="self-end text-xs bg-[#1B2A45] hover:bg-[#1B2A45]/90 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {savingReason === c.id ? '저장중' : '저장'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <h2 className="font-semibold text-[#1B2A45] text-base">
        환불업체
        <span className="ml-2 text-sm font-normal text-[#1B2A45]/50">({cases.length}건)</span>
      </h2>

      <div className="space-y-4">
        {/* 환불예정 */}
        <div>
          <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide mb-2">
            환불예정 ({refundPending.length})
          </p>
          {refundPending.length === 0 ? (
            <div className="bg-white border border-[#E8E2D4] rounded-xl px-4 py-4 text-center text-sm text-[#1B2A45]/40">
              환불 예정 업체 없음
            </div>
          ) : (
            <div className="space-y-2">
              {refundPending.map(renderCase)}
            </div>
          )}
        </div>

        {/* 환불완료 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            환불완료 ({refundComplete.length})
          </p>
          {refundComplete.length === 0 ? (
            <div className="bg-white border border-[#E8E2D4] rounded-xl px-4 py-4 text-center text-sm text-[#1B2A45]/40">
              환불 완료 업체 없음
            </div>
          ) : (
            <div className="space-y-2">
              {refundComplete.map(renderCase)}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ─── Section 3: 종료업체 ─────────────────────────────────
interface CompletedSectionProps {
  cases: OpsCase[]
}

function CompletedSection({ cases }: CompletedSectionProps) {
  const totalApproved   = cases.reduce((s, c) => s + (c.approved_amount   || 0), 0)
  const totalCommission = cases.reduce((s, c) => s + (c.commission_amount || 0), 0)

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-[#1B2A45] text-base">
        종료업체
        <span className="ml-2 text-sm font-normal text-[#1B2A45]/50">({cases.length}건)</span>
      </h2>

      {cases.length === 0 ? (
        <div className="bg-white border border-[#E8E2D4] rounded-xl px-4 py-8 text-center text-sm text-[#1B2A45]/40">
          종료된 업체 없음
        </div>
      ) : (
        <div className="bg-white border border-[#E8E2D4] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E8E2D4] bg-[#FAF8F3]">
                  {['업체명', '담당자', '승인금액', '수수료'].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs text-[#1B2A45]/50 font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.map(c => (
                  <tr key={c.id} className="border-b border-[#E8E2D4]/60 hover:bg-[#FAF8F3] transition-colors">
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-[#1B2A45]">{c.customers?.name || '-'}</span>
                      {(c.customers?.details?.company || c.customers?.name) && (
                        <span className="text-xs text-[#1B2A45]/50 ml-2">{(c.customers?.details?.company || c.customers?.name)}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#1B2A45]/70">{c.ops_user_name || '-'}</td>
                    <td className="py-2.5 px-3 font-medium text-[#1B2A45]">{fmt(c.approved_amount)}</td>
                    <td className="py-2.5 px-3 font-medium text-[#C5A258]">{fmt(c.commission_amount)}</td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="bg-[#1B2A45]">
                  <td colSpan={2} className="py-2.5 px-3 text-white font-semibold text-sm">합계</td>
                  <td className="py-2.5 px-3 text-white font-bold">{fmt(totalApproved)}</td>
                  <td className="py-2.5 px-3 text-[#C5A258] font-bold">{fmt(totalCommission)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Section 4: 관리팀 매출 요약 ─────────────────────────
interface RevenueSummaryProps {
  cases: OpsCase[]
}

function RevenueSummary({ cases }: RevenueSummaryProps) {
  const completedCases = cases.filter(c => c.is_completed || c.progress_stage === '종료')
  const totalRevenue    = completedCases.reduce((s, c) => s + (c.revenue           || 0), 0)
  const totalCommission = completedCases.reduce((s, c) => s + (c.commission_amount || 0), 0)
  const totalApproved   = completedCases.reduce((s, c) => s + (c.approved_amount   || 0), 0)

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-[#1B2A45] text-base">관리팀 매출 요약</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 text-center">
          <p className="text-xs text-emerald-600 font-semibold mb-1">총 완료 매출</p>
          <p className="text-2xl font-black text-emerald-700">{fmt(totalRevenue)}</p>
          <p className="text-xs text-emerald-500 mt-1">{completedCases.length}건 완료</p>
        </div>
        <div className="bg-[#C5A258]/10 border border-[#C5A258]/20 rounded-xl p-5 text-center">
          <p className="text-xs text-[#C5A258] font-semibold mb-1">총 수수료</p>
          <p className="text-2xl font-black text-[#1B2A45]">{fmt(totalCommission)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center">
          <p className="text-xs text-blue-600 font-semibold mb-1">총 승인금액</p>
          <p className="text-2xl font-black text-blue-700">{fmt(totalApproved)}</p>
        </div>
      </div>
    </section>
  )
}

// ─── Main export ──────────────────────────────────────────
export default function OpsCeoTab() {
  const [cases, setCases] = useState<OpsCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadCases() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ops-cases')
      const data = await res.json()
      if (!res.ok) {
        setError(`API 오류: ${data.error || res.status}`)
        return
      }
      setCases(data.cases || [])
    } catch (e: any) {
      setError(`네트워크 오류: ${e?.message || e}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCases() }, [])

  async function handleUpdate(id: string, patch: Partial<OpsCase>) {
    try {
      await fetch(`/api/ops-cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      // Optimistically update local state
      setCases(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
    } catch {
      // silent — user can retry
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-10">
        <div className="h-8 w-40 bg-[#E8E2D4] rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 rounded-xl bg-[#E8E2D4] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-[#1B2A45]/60 text-sm">{error}</p>
        <button
          onClick={loadCases}
          className="mt-4 text-sm bg-[#1B2A45] text-white px-4 py-2 rounded-lg hover:bg-[#1B2A45]/90 transition-colors"
        >
          다시 시도
        </button>
      </div>
    )
  }

  // Derive sub-lists
  const activeCases  = cases.filter(c => !c.is_refund && !c.is_completed && c.progress_stage !== '환불' && c.progress_stage !== '종료')
  const refundCases  = cases.filter(c => c.is_refund || c.progress_stage === '환불' || c.progress_stage === '환불완료')
  const completedCases = cases.filter(c => c.is_completed || c.progress_stage === '종료')

  return (
    <div className="space-y-10 pb-10">
      <RevenueSummary cases={cases} />
      <InstitutionSection cases={activeCases} onUpdate={handleUpdate} />
      <RefundSection     cases={refundCases}  onUpdate={handleUpdate} />
      <CompletedSection  cases={completedCases} />
    </div>
  )
}


