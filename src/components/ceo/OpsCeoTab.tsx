'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { OpsDetailPanel, OpsCase } from '@/components/ops/OpsDashboard'

// ─── Constants ─────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: '서류받는중', label: '서류받는중', color: 'bg-gray-500'    },
  { key: '접수전',     label: '접수전',     color: 'bg-sky-500'     },
  { key: '신청완료',   label: '신청완료',   color: 'bg-blue-500'    },
  { key: '반려보정',   label: '반려보정',   color: 'bg-orange-500'  },
  { key: '실사대기',   label: '실사대기',   color: 'bg-amber-500'   },
  { key: '실사완료',   label: '실사완료',   color: 'bg-yellow-500'  },
  { key: '승인대기',   label: '승인대기',   color: 'bg-violet-500'  },
  { key: '승인',       label: '승인',       color: 'bg-emerald-500' },
  { key: '부결',       label: '부결',       color: 'bg-red-500'     },
  { key: '입금전',     label: '입금전',     color: 'bg-teal-500'    },
  { key: '홀딩',       label: '홀딩',       color: 'bg-slate-400'   },
  { key: '검토중',     label: '검토중',     color: 'bg-gray-400'    },
  { key: '접수',       label: '접수',       color: 'bg-sky-400'     },
  { key: '진행중',     label: '진행중',     color: 'bg-blue-400'    },
  { key: '환불',       label: '환불',       color: 'bg-rose-500'    },
  { key: '종료',       label: '종료',       color: 'bg-neutral-400' },
  { key: '환불예정',   label: '환불예정',   color: 'bg-rose-400'    },
  { key: '종료예정',   label: '종료예정',   color: 'bg-orange-400'  },
]
const OVERALL_STAGES = [
  { key: '서류받는중', label: '서류받는중', color: 'bg-gray-500'  },
  { key: '진행중',     label: '진행중',     color: 'bg-blue-500'  },
  { key: '홀딩',       label: '홀딩',       color: 'bg-slate-400' },
]
const INST_DIRECT    = ['중진공','소진공(혁신)','소진공(신취)','소진공(재도전)','서민금융(미소)']
const INST_INDIRECT  = ['기보','신보','재단']
const INDIRECT_SET   = new Set(INST_INDIRECT)
const ALL_INST_ORDER = [...INST_DIRECT, ...INST_INDIRECT]

const ACTIVE_STAGE_KEYS    = new Set(['서류받는중','접수전','신청완료','반려보정','실사대기','실사완료','승인대기','승인','부결','입금전','홀딩','검토중','접수','진행중','assigned','absorbed','doc_collect','reviewing','approved','executing','rejected','환불예정','종료예정'])
const REFUND_STAGE_KEYS    = new Set(['환불','refunded'])
const COMPLETED_STAGE_KEYS = new Set(['종료','완료','completed'])
const PENDING_REFUND_KEYS  = new Set(['환불예정'])
const PENDING_DONE_KEYS    = new Set(['종료예정'])
const NEWDB_STAGE_KEYS     = new Set(['new_db'])

function formatKST(isoStr: string) {
  if (!isoStr) return { date: '', time: '' }
  const d = new Date(isoStr)
  const date = d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')
  const time = d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
  return { date, time }
}

function fmtMoney(n: number) {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
  if (n >= 10_000) return Math.round(n / 10_000) + '만원'
  return n.toLocaleString() + '원'
}

// ─── Case Card (grid) ─────────────────────────────────────
function CeoCaseCard({ c, isOpen, onToggle, onScriptToggle, onApprove }: {
  c: OpsCase; isOpen: boolean
  onToggle: (id: string) => void
  onScriptToggle: (id: string, val: boolean) => void
  onApprove?: (id: string, action: 'approve' | 'reject') => void
}) {
  const allStages     = [...PIPELINE_STAGES, ...OVERALL_STAGES]
  const companyName   = c.customers?.details?.company || c.customers?.name || '—'
  const overallStage  = allStages.find(s => s.key === c.progress_stage)
  const directStage   = c.details?.direct_stage  || ''
  const indirectStage = c.details?.indirect_stage || ''
  const directInfo    = allStages.find(s => s.key === directStage)
  const indirectInfo  = allStages.find(s => s.key === indirectStage)
  const scriptSent    = c.details?.script_sent || false
  const allInstitutions = (c.institution || '').split(',').map((s: string) => s.trim()).filter(Boolean)

  return (
    <div
      onClick={() => onToggle(c.id)}
      className={`bg-white border rounded-xl p-2.5 cursor-pointer hover:shadow-md transition-all text-center ${
        isOpen ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-200 hover:border-violet-300'
      }`}
    >
      <p className="font-bold text-[#1B2A45] text-[11px] leading-snug"
        style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
        {companyName}
      </p>
      {c.customers?.name && c.customers.name !== companyName && (
        <p className="text-[10px] text-gray-400 mt-0.5">{c.customers.name}</p>
      )}
      <p className="text-[9px] text-gray-400 mt-0.5 font-mono">{c.customers?.phone}</p>
      {c.ops_user_name && <p className="text-[9px] text-violet-500 mt-0.5">{c.ops_user_name}</p>}

      {allInstitutions.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5 justify-center">
          {allInstitutions.map(inst => (
            <span key={inst} className={`text-[8px] px-1 py-0.5 rounded font-medium ${
              INDIRECT_SET.has(inst) ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
            }`}>{inst}</span>
          ))}
        </div>
      )}

      <div className="mt-1.5">
        {overallStage ? (
          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-white ${overallStage.color}`}>{overallStage.label}</span>
        ) : c.progress_stage ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-gray-400">{c.progress_stage}</span>
        ) : null}
      </div>

      {directStage && (
        <div className="mt-0.5">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold text-white ${directInfo?.color || 'bg-blue-400'}`}>
            직: {directStage}
          </span>
        </div>
      )}
      {indirectStage && (
        <div className="mt-0.5">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold text-white ${indirectInfo?.color || 'bg-violet-400'}`}>
            간: {indirectStage}
          </span>
        </div>
      )}

      {(c.details?.handling_no_contact || c.details?.handling_no_fit || c.details?.handling_mindless) && (
        <div className="mt-0.5 flex flex-wrap gap-0.5 justify-center">
          {c.details?.handling_no_contact && <span className="text-[8px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">📵연락안됨</span>}
          {c.details?.handling_no_fit     && <span className="text-[8px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-bold">🚫곳없음</span>}
          {c.details?.handling_mindless   && <span className="text-[8px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-bold">🔄무지성</span>}
        </div>
      )}

      {c.details?.is_holding && (
        <div className="mt-0.5">
          <span className="text-[8px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">🔒홀딩</span>
        </div>
      )}

      {/* 승인 대기 — 빠른 승인/반려 버튼 */}
      {onApprove && (c.progress_stage === '환불예정' || c.progress_stage === '종료예정') && (
        <div className="mt-2 flex gap-1" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onApprove(c.id, 'approve')}
            className={`flex-1 text-[9px] font-bold py-1 rounded-lg text-white transition-colors ${
              c.progress_stage === '환불예정' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-orange-500 hover:bg-orange-600'
            }`}>
            ✅ {c.progress_stage === '환불예정' ? '환불' : '종료'}
          </button>
          <button
            onClick={() => onApprove(c.id, 'reject')}
            className="flex-1 text-[9px] font-bold py-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors">
            ❌ 반려
          </button>
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
        <input type="checkbox" id={`ceo-script-${c.id}`} checked={scriptSent}
          onChange={e => onScriptToggle(c.id, e.target.checked)}
          className="w-3 h-3 accent-violet-500 cursor-pointer" />
        <label htmlFor={`ceo-script-${c.id}`}
          className={`text-[9px] cursor-pointer select-none ${scriptSent ? 'text-violet-600 font-semibold line-through' : 'text-gray-400'}`}>
          스크립트 발송
        </label>
      </div>
    </div>
  )
}

// ─── CaseListRow (환불/종료/신규DB 리스트) ────────────────
function CeoCaseListRow({ c, isOpen, onToggle }: { c: OpsCase; isOpen: boolean; onToggle: (id: string) => void }) {
  const companyName = c.customers?.details?.company || c.customers?.name || '—'
  const stage = c.progress_stage || '—'
  const stageInfo = PIPELINE_STAGES.find(s => s.key === stage)
  const latestTl = c.timeline && c.timeline.length > 0 ? c.timeline[c.timeline.length - 1] : null

  return (
    <div onClick={() => onToggle(c.id)}
      className={`bg-white border rounded-xl px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:border-violet-300 transition-colors ${
        isOpen ? 'ring-2 ring-violet-400 border-violet-300' : 'border-gray-200'
      }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-[#1B2A45] text-sm" style={{ wordBreak: 'break-all' }}>{companyName}</span>
          {c.customers?.name && c.customers.name !== companyName && (
            <span className="text-xs text-gray-400">{c.customers.name}</span>
          )}
          {c.ops_user_name && <span className="text-[10px] text-violet-500">{c.ops_user_name}</span>}
        </div>
        {(c.institution || latestTl) && (
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {c.institution && <span className="text-[10px] text-gray-500">🏦 {c.institution}</span>}
            {latestTl && (
              <span className="text-[10px] text-gray-400">
                {formatKST(latestTl.created_at || latestTl.date || '').date} — {(latestTl.content || latestTl.text || '').slice(0, 30)}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {stageInfo ? (
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold text-white ${stageInfo.color}`}>{stageInfo.label}</span>
        ) : (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">{stage}</span>
        )}
        <span className="text-gray-300 text-xs">›</span>
      </div>
    </div>
  )
}

// ─── Institution Grouped View (진행중) ────────────────────
function InstitutionGroupedView({ cases, openPanelIds, onToggle, onScriptToggle, onApprove }: {
  cases: OpsCase[]
  openPanelIds: string[]
  onToggle: (id: string) => void
  onScriptToggle: (id: string, val: boolean) => void
  onApprove: (id: string, action: 'approve' | 'reject') => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const isHolding  = (c: OpsCase) => !!(c.details?.is_holding)
  const isHandling = (c: OpsCase) =>
    !!(c.details?.handling_no_contact || c.details?.handling_no_fit || c.details?.handling_mindless)

  // 승인 대기 (환불예정/종료예정) — 최상단 별도 그룹
  const pendingCases  = cases.filter(c => PENDING_REFUND_KEYS.has(c.progress_stage) || PENDING_DONE_KEYS.has(c.progress_stage))
  const holdingCases  = cases.filter(c => !PENDING_REFUND_KEYS.has(c.progress_stage) && !PENDING_DONE_KEYS.has(c.progress_stage) && isHolding(c))
  const handlingCases = cases.filter(c => !PENDING_REFUND_KEYS.has(c.progress_stage) && !PENDING_DONE_KEYS.has(c.progress_stage) && !isHolding(c) && isHandling(c))
  const regularCases  = cases.filter(c => !PENDING_REFUND_KEYS.has(c.progress_stage) && !PENDING_DONE_KEYS.has(c.progress_stage) && !isHolding(c) && !isHandling(c))

  const instGroups: { inst: string; items: OpsCase[] }[] = ALL_INST_ORDER.map(inst => ({
    inst,
    items: regularCases.filter(c =>
      (c.institution || '').split(',').map((s: string) => s.trim()).includes(inst)
    ),
  })).filter(g => g.items.length > 0)

  const unassigned = regularCases.filter(c => !c.institution || c.institution.trim() === '')
  if (unassigned.length > 0)    instGroups.unshift({ inst: '신규유입', items: unassigned })
  if (handlingCases.length > 0) instGroups.push({ inst: '🔧 핸들링', items: handlingCases })
  if (holdingCases.length > 0)  instGroups.push({ inst: '🔒 홀딩', items: holdingCases })
  if (pendingCases.length > 0)  instGroups.unshift({ inst: '⏳ 대표 승인 대기', items: pendingCases })

  if (instGroups.length === 0) {
    return <div className="bg-white rounded-xl border border-[#E8E2D4] p-12 text-center text-[#1B2A45]/40 text-sm">진행중인 업체가 없습니다</div>
  }

  return (
    <div className="space-y-4">
      {instGroups.map(({ inst, items }) => {
        const isIndirect = INDIRECT_SET.has(inst)
        const isPending  = inst === '⏳ 대표 승인 대기'
        const isHoldingG = inst === '🔒 홀딩'
        const isOpen = !collapsed[inst]
        return (
          <div key={inst}>
            <button onClick={() => setCollapsed(p => ({ ...p, [inst]: !p[inst] }))}
              className={`w-full flex items-center justify-between py-2.5 px-4 rounded-xl mb-2 transition-colors ${
                isPending   ? 'bg-rose-500 hover:bg-rose-600'
                : isHoldingG ? 'bg-indigo-600 hover:bg-indigo-700'
                : isIndirect ? 'bg-violet-600 hover:bg-violet-700'
                : inst === '신규유입'  ? 'bg-emerald-500 hover:bg-emerald-600'
                : inst === '🔧 핸들링' ? 'bg-slate-500 hover:bg-slate-600'
                : 'bg-[#1B2A45] hover:bg-[#1B2A45]/90'
              }`}>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">{inst}</span>
                <span className="bg-[#C5A258] text-white text-xs font-bold px-2 py-0.5 rounded-full">{items.length}</span>
                {isIndirect && <span className="text-white/60 text-[10px]">간접자금</span>}
              </div>
              <span className="text-white/60 text-xs">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {items.map(c => (
                  <CeoCaseCard key={`${inst}-${c.id}`} c={c} isOpen={openPanelIds.includes(c.id)} onToggle={onToggle} onScriptToggle={onScriptToggle} onApprove={isPending ? onApprove : undefined} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── CEO Ops Revenue View ──────────────────────────────────
function CeoOpsRevenueView() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    fetch('/api/revenue')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const now = new Date()
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const allEntries: { company: string; amount: number; date: string; userName: string }[] =
    (data?.thisMonthOps || []).map((e: any) => ({
      company: e.company || '—',
      amount: e.amount || 0,
      date: e.date || '',
      userName: e.ops_user_name || '—',
    }))
  const totalThis = allEntries.reduce((s, e) => s + e.amount, 0)

  // 담당자별 합산
  const byUser: Record<string, number> = {}
  allEntries.forEach(e => {
    byUser[e.userName] = (byUser[e.userName] || 0) + e.amount
  })

  const monthly: { month: string; amount: number }[] = (data?.monthly || []).map((m: any) => ({
    month: m.month,
    amount: m.관리팀 || 0,
  }))

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[#1B2A45] text-base">💰 관리팀 매출 현황</h3>
        <button onClick={load} className="text-xs bg-white border border-[#E8E2D4] text-[#1B2A45]/60 px-3 py-1.5 rounded-lg hover:border-[#1B2A45]/30">🔄 새로고침</button>
      </div>

      {/* 이달 총 */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
        <p className="text-emerald-100 text-xs font-semibold mb-1">{now.getMonth() + 1}월 관리팀 수수료 수입 (전체)</p>
        <p className="text-3xl font-black">{fmtMoney(totalThis)}</p>
        <p className="text-emerald-200 text-xs mt-1">{allEntries.length}건</p>
      </div>

      {/* 담당자별 합산 */}
      {Object.keys(byUser).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500">담당자별 이달 수수료</p>
          </div>
          <div className="divide-y divide-gray-50">
            {Object.entries(byUser).sort((a, b) => b[1] - a[1]).map(([name, amt]) => (
              <div key={name} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-[#1B2A45]">{name}</span>
                <span className="text-base font-black text-emerald-600">{fmtMoney(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 이달 건별 내역 */}
      {allEntries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-bold text-gray-500">이달 수수료 내역 (전체)</p>
          </div>
          <div className="divide-y divide-gray-50">
            {allEntries.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[#1B2A45]">{e.company}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{e.userName}{e.date ? ` · ${e.date}` : ''}</p>
                </div>
                <span className="text-base font-black text-emerald-600">{fmtMoney(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {allEntries.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">이달 수수료 내역이 없습니다</div>
      )}

      {/* 월별 추이 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500">월별 관리팀 수수료 추이</p>
        </div>
        <div className="p-4 space-y-2">
          {monthly.map((m, i) => {
            const max = Math.max(...monthly.map(x => x.amount), 1)
            const pct = Math.round((m.amount / max) * 100)
            const isCurrent = m.month === String(now.getMonth() + 1).padStart(2, '0') + '월'
            return (
              <div key={i} className="flex items-center gap-3">
                <span className={`text-[11px] w-10 shrink-0 font-medium ${isCurrent ? 'text-emerald-600' : 'text-gray-400'}`}>{m.month}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className={`h-full rounded-full ${isCurrent ? 'bg-emerald-500' : 'bg-teal-300'}`} style={{ width: pct + '%' }} />
                </div>
                <span className={`text-xs font-bold w-16 text-right ${isCurrent ? 'text-emerald-700' : 'text-gray-600'}`}>
                  {m.amount > 0 ? fmtMoney(m.amount) : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────
type OpsView = 'active' | 'refund' | 'completed' | 'newdb' | 'revenue'

export default function OpsCeoTab() {
  const [cases, setCases] = useState<OpsCase[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<OpsView>('active')
  const [search, setSearch] = useState('')
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([])
  const [closingPanelIds, setClosingPanelIds] = useState<string[]>([])
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  async function load() {
    setLoading(true)
    const res = await fetch('/api/ops-cases')
    const data = await res.json()
    setCases((data.cases || []).map((c: any) => ({
      ...c,
      progress_stage: c.progress_stage || c.stage || '',
      timeline: Array.isArray(c.timeline) ? c.timeline : [],
      institution: c.institution || '',
    })) as OpsCase[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ⚡ details 머지 버그 수정: 패치 시 기존 details와 머지
  const handleSave = useCallback((id: string, patch: Record<string, any>) => {
    setCases(prev => prev.map(c => {
      if (c.id !== id) return c
      const mergedDetails = patch.details ? { ...(c.details || {}), ...patch.details } : c.details
      const mergedTimeline = patch.timeline !== undefined ? patch.timeline : c.timeline
      return { ...c, ...patch, details: mergedDetails, timeline: mergedTimeline }
    }))
    if (autoSaveTimers.current[id]) clearTimeout(autoSaveTimers.current[id])
    autoSaveTimers.current[id] = setTimeout(async () => {
      await fetch(`/api/ops-cases/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
    }, 1500)
  }, [])

  useEffect(() => {
    if (openPanelIds.length > 0) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [openPanelIds])

  function closePanel(id: string) {
    setClosingPanelIds(prev => [...prev, id])
    setTimeout(() => {
      setOpenPanelIds(prev => prev.filter(x => x !== id))
      setClosingPanelIds(prev => prev.filter(x => x !== id))
    }, 300)
  }
  function closeAllPanels() {
    setClosingPanelIds([...openPanelIds])
    setTimeout(() => { setOpenPanelIds([]); setClosingPanelIds([]) }, 300)
  }
  function togglePanel(id: string) {
    if (openPanelIds.includes(id)) {
      closePanel(id)
    } else {
      setOpenPanelIds(prev => {
        const next = [...prev, id]
        return next.length > 2 ? next.slice(1) : next
      })
    }
  }
  function handleScriptToggle(id: string, val: boolean) {
    const c = cases.find(x => x.id === id)
    if (!c) return
    handleSave(id, { details: { ...(c.details || {}), script_sent: val } })
  }

  // 환불예정/종료예정 → 대표 승인(환불/종료) 또는 반려(진행중)
  function handleApprove(id: string, action: 'approve' | 'reject') {
    const c = cases.find(x => x.id === id)
    if (!c) return
    const nextStage = action === 'approve'
      ? (c.progress_stage === '환불예정' ? '환불' : '종료')
      : '진행중'
    handleSave(id, { progress_stage: nextStage })
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? cases.filter(c =>
        (c.customers?.details?.company || c.customers?.name || '').toLowerCase().includes(q) ||
        (c.customers?.phone || '').replace(/-/g, '').includes(q.replace(/-/g, '')) ||
        (c.institution || '').toLowerCase().includes(q) ||
        (c.ops_user_name || '').toLowerCase().includes(q)
      )
    : cases

  const newdbCases     = filtered.filter(c => NEWDB_STAGE_KEYS.has(c.progress_stage))
  const activeCases    = filtered.filter(c =>
    !NEWDB_STAGE_KEYS.has(c.progress_stage) && (
      ACTIVE_STAGE_KEYS.has(c.progress_stage) ||
      (!REFUND_STAGE_KEYS.has(c.progress_stage) && !COMPLETED_STAGE_KEYS.has(c.progress_stage) && !c.is_refund && !c.is_completed)
    )
  )
  const refundCases    = filtered.filter(c => REFUND_STAGE_KEYS.has(c.progress_stage) || c.is_refund)
  const completedCases = filtered.filter(c => COMPLETED_STAGE_KEYS.has(c.progress_stage) || c.is_completed)

  const MENU = [
    { key: 'active' as OpsView,    label: '🔄 진행중업체', count: activeCases.length },
    { key: 'refund' as OpsView,    label: '💸 환불업체',   count: refundCases.length },
    { key: 'completed' as OpsView, label: '✅ 종료업체',   count: completedCases.length },
    { key: 'newdb' as OpsView,     label: '🆕 신규DB',     count: newdbCases.length },
    { key: 'revenue' as OpsView,   label: '💰 매출현황',   count: null },
  ] as const

  const viewCases = view === 'refund' ? refundCases : view === 'completed' ? completedCases : view === 'newdb' ? newdbCases : activeCases

  return (
    <div className="space-y-4 pb-8 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="bg-[#1B2A45] rounded-xl px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-bold text-white text-base">⚙️ 자금팀 현황</h2>
          <div className="flex items-center gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="업체·담당자·기관 검색..."
              className="bg-white/10 text-white placeholder-white/40 text-xs px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:bg-white/20 w-36" />
            <button onClick={load}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">
              🔄 새로고침
            </button>
          </div>
        </div>
        {/* 통계 */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-white/10 rounded-lg px-2 py-2 text-center">
            <p className="text-white/50 text-[9px]">진행업체</p>
            <p className="text-white font-black text-lg">{activeCases.length}</p>
          </div>
          <div className="bg-white/10 rounded-lg px-2 py-2 text-center">
            <p className="text-white/50 text-[9px]">신규DB</p>
            <p className="text-white font-black text-lg">{newdbCases.length}</p>
          </div>
          <div className="bg-white/10 rounded-lg px-2 py-2 text-center">
            <p className="text-white/50 text-[9px]">환불</p>
            <p className="text-white font-black text-lg">{refundCases.length}</p>
          </div>
          <div className="bg-white/10 rounded-lg px-2 py-2 text-center">
            <p className="text-white/50 text-[9px]">종료</p>
            <p className="text-white font-black text-lg">{completedCases.length}</p>
          </div>
        </div>
        {/* 뷰 탭 */}
        <div className="flex gap-1.5 flex-wrap">
          {MENU.map(m => (
            <button key={m.key} onClick={() => setView(m.key)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                view === m.key ? 'bg-white text-[#1B2A45]' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}>
              {m.label}
              {m.count !== null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  view === m.key ? 'bg-[#1B2A45] text-white' : 'bg-white/20 text-white'
                }`}>{m.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      {view === 'revenue' ? (
        <CeoOpsRevenueView />
      ) : loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : view === 'active' ? (
        <InstitutionGroupedView cases={activeCases} openPanelIds={openPanelIds} onToggle={togglePanel} onScriptToggle={handleScriptToggle} onApprove={handleApprove} />
      ) : (
        <div className="space-y-2">
          {viewCases.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8E2D4] p-12 text-center text-gray-400 text-sm">
              {view === 'refund' ? '환불 업체가 없습니다' : view === 'newdb' ? '신규 DB가 없습니다' : '종료 업체가 없습니다'}
            </div>
          ) : (
            viewCases.map(c => (
              <CeoCaseListRow key={c.id} c={c} isOpen={openPanelIds.includes(c.id)} onToggle={togglePanel} />
            ))
          )}
        </div>
      )}

      {/* 배경 오버레이 */}
      {openPanelIds.length > 0 && (
        <div className="fixed inset-0 bg-black/40 z-[99] transition-opacity duration-300" onClick={closeAllPanels} />
      )}

      {/* 우측 슬라이딩 패널 */}
      {openPanelIds.map((id, panelIndex) => {
        const c = cases.find(x => x.id === id)
        if (!c) return null
        const rightOffset = panelIndex === 0 ? 'right-0' : 'right-0 md:right-[530px]'
        const isClosing = closingPanelIds.includes(id)
        return (
          <div key={id}
            className={`fixed top-0 bottom-0 ${rightOffset} w-full md:w-[520px] bg-white shadow-2xl overflow-y-auto z-[100] transition-transform duration-300 ease-in-out ${isClosing ? 'translate-x-full' : 'translate-x-0'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between z-10">
              <div>
                <p className="font-bold text-[#1B2A45] text-sm">{c.customers?.details?.company || c.customers?.name}</p>
                <p className="text-[10px] text-gray-400">{c.customers?.name} · {c.customers?.phone}</p>
              </div>
              <button onClick={() => closePanel(id)} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">✕</button>
            </div>
            <div className="p-4">
              <OpsDetailPanel c={c} onSave={handleSave} userRole="ceo" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
