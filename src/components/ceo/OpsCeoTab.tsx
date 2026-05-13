'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────
interface OpsCase {
  id: string
  customer_id?: string
  ops_user_name?: string
  institution: string
  progress_stage: string
  progress_memo?: string
  revenue?: number
  is_refund?: boolean
  is_completed?: boolean
  timeline?: any[]
  details?: Record<string, any>
  updated_at?: string
  customers?: { name: string; phone: string; details?: any }
  // legacy fields
  customer_name?: string
  phone?: string
  stage?: string
  institution_type?: string
}

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
]
const STAGE_COLOR: Record<string, string> = Object.fromEntries(PIPELINE_STAGES.map(s => [s.key, s.color]))

const INST_DIRECT   = ['중진공','소진공(혁신)','소진공(신취)','소진공(재도전)','서민금융(미소)']
const INST_INDIRECT = ['기보','신보','재단']
const INDIRECT_SET  = new Set(INST_INDIRECT)
const ALL_INST_ORDER = [...INST_DIRECT, ...INST_INDIRECT]

const ACTIVE_STAGE_KEYS    = new Set(['서류받는중','접수전','신청완료','반려보정','실사대기','실사완료','승인대기','승인','부결','입금전','홀딩','검토중','접수','진행중','assigned','absorbed','doc_collect','reviewing','approved','executing','rejected'])
const REFUND_STAGE_KEYS    = new Set(['환불','refunded'])
const COMPLETED_STAGE_KEYS = new Set(['종료','완료','completed'])

function fmt(n: number) {
  if (!n) return '-'
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
  if (n >= 10_000) return Math.round(n / 10_000) + '만'
  return n.toLocaleString()
}
function formatKST(isoStr: string) {
  if (!isoStr) return { date: '', time: '' }
  const d = new Date(isoStr)
  const date = d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')
  const time = d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
  return { date, time }
}

// ─── Timeline Drawer ──────────────────────────────────────
function TimelineDrawer({ c, onClose, onSave }: {
  c: OpsCase
  onClose: () => void
  onSave: (id: string, patch: Record<string, any>) => void
}) {
  const [tl, setTl] = useState<any[]>(c.timeline || [])
  const [text, setText] = useState('')
  const [view, setView] = useState<'timeline' | 'info'>('timeline')
  const companyName = c.customers?.details?.company || c.customers?.name || c.customer_name || '—'
  const stage = c.progress_stage || c.stage || '—'

  function add() {
    if (!text.trim()) return
    const entry = { user: 'CEO', content: text.trim(), created_at: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00' }
    const updated = [...tl, entry]
    setTl(updated)
    onSave(c.id, { timeline: updated })
    setText('')
  }

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute top-0 bottom-0 right-0 w-full md:w-[500px] bg-white shadow-2xl overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between z-10">
          <div>
            <p className="font-bold text-[#1B2A45] text-sm">{companyName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] text-gray-400">{c.customers?.name} · {c.customers?.phone}</p>
              {c.ops_user_name && <span className="text-[10px] text-violet-500 font-medium">{c.ops_user_name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold text-white ${STAGE_COLOR[stage] || 'bg-gray-400'}`}>{stage}</span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">✕</button>
          </div>
        </div>

        {/* 서브탭 */}
        <div className="flex border-b border-gray-100 px-5">
          {[{ key: 'timeline', label: '📋 타임라인' }, { key: 'info', label: 'ℹ️ 진행정보' }].map(t => (
            <button key={t.key} onClick={() => setView(t.key as any)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                view === t.key ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>{t.label}</button>
          ))}
        </div>

        <div className="p-5">
          {view === 'timeline' && (
            <div className="space-y-3">
              {/* 타임라인 입력 */}
              <div className="flex gap-2">
                <input value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && add()}
                  placeholder="타임라인 메모 추가..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400" />
                <button onClick={add} className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium">추가</button>
              </div>

              {tl.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">타임라인이 없습니다</p>
              ) : (
                <div className="relative pl-4 border-l-2 border-violet-200 space-y-3">
                  {[...tl].reverse().map((entry: any, i: number) => {
                    const isAuto = entry.user === '자동기록'
                    const kst = formatKST(entry.created_at || entry.date || '')
                    const user = entry.user || entry.author || ''
                    const content = entry.content || entry.text || ''
                    return (
                      <div key={i} className="relative">
                        <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${isAuto ? 'bg-violet-400' : 'bg-[#1B2A45]'}`} />
                        <div className={`rounded-lg px-3 py-2 ${isAuto ? 'bg-violet-50' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-semibold ${isAuto ? 'text-violet-600' : 'text-[#1B2A45]'}`}>{user || '—'}</span>
                            <span className="text-[10px] text-gray-400">{kst.date} {kst.time}</span>
                          </div>
                          <p className="text-sm text-gray-700">{content}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {view === 'info' && (
            <div className="space-y-4">
              {/* 기관 정보 */}
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">🏦 담당 기관</p>
                {c.institution ? (
                  <div className="flex flex-wrap gap-1">
                    {c.institution.split(',').map((inst: string) => {
                      const s = inst.trim()
                      return (
                        <span key={s} className={`text-xs px-3 py-1 rounded-full font-medium ${
                          INDIRECT_SET.has(s) ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                        }`}>{s}</span>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">기관 미배정</p>
                )}
              </div>

              {/* 메모 */}
              {c.progress_memo && (
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-1">📝 진행 메모</p>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{c.progress_memo}</p>
                </div>
              )}

              {/* 재무 */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: '승인금액', value: c.details?.approval_amount },
                  { label: '수수료', value: c.details?.fee_amount },
                  { label: '계약금(VAT제외)', value: c.details?.contract_amount },
                  { label: '입금액', value: c.details?.deposit_amount },
                  { label: '방문 일정', value: c.details?.visit_date },
                  { label: '계약일', value: c.details?.contract_date },
                ].filter(item => item.value).map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 mb-0.5">{item.label}</p>
                    <p className="text-sm font-semibold text-gray-800">{item.value}</p>
                  </div>
                ))}
              </div>

              {c.updated_at && (
                <p className="text-[10px] text-gray-300 text-right">마지막 수정: {new Date(c.updated_at).toLocaleString('ko-KR')}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Case Card (8-col grid) ───────────────────────────────
function CeoCaseCard({ c, isOpen, onToggle }: { c: OpsCase; isOpen: boolean; onToggle: (id: string) => void }) {
  const companyName = c.customers?.details?.company || c.customers?.name || c.customer_name || '—'
  const stage = c.progress_stage || c.stage || ''
  const stageInfo = PIPELINE_STAGES.find(s => s.key === stage)
  const allInstitutions = (c.institution || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const hasMultiple = allInstitutions.length > 1
  const nextInst = c.details?.next_inst || ''
  const nextDate = c.details?.visit_date || ''

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
      <p className="text-[10px] text-gray-400 mt-0.5">{c.customers?.name || c.customer_name}</p>
      <p className="text-[9px] text-gray-400 mt-0.5 font-mono">{c.customers?.phone || c.phone}</p>
      {c.ops_user_name && <p className="text-[9px] text-violet-500 mt-0.5">{c.ops_user_name}</p>}

      <div className="mt-1.5">
        {stageInfo ? (
          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-white ${stageInfo.color}`}>{stageInfo.label}</span>
        ) : stage ? (
          <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-gray-400">{stage}</span>
        ) : null}
      </div>

      {hasMultiple && (
        <div className="mt-1 flex flex-wrap gap-0.5 justify-center">
          {allInstitutions.map(inst => (
            <span key={inst} className={`text-[8px] px-1 py-0.5 rounded font-medium ${
              INDIRECT_SET.has(inst) ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
            }`}>{inst}</span>
          ))}
        </div>
      )}

      {(nextInst || nextDate) && (
        <div className="mt-1.5 flex items-center justify-center gap-1 flex-wrap">
          {nextInst && <span className="text-[8px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">→ {nextInst}</span>}
          {nextDate && <span className="text-[8px] text-sky-500 font-medium">📅 {nextDate.slice(5)}</span>}
        </div>
      )}
    </div>
  )
}

// ─── CaseListRow (환불/종료 리스트) ───────────────────────
function CeoCaseListRow({ c, isOpen, onToggle }: { c: OpsCase; isOpen: boolean; onToggle: (id: string) => void }) {
  const companyName = c.customers?.details?.company || c.customers?.name || c.customer_name || '—'
  const stage = c.progress_stage || c.stage || '—'
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
          <span className="text-xs text-gray-400">{c.customers?.name || c.customer_name}</span>
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
function InstitutionGroupedView({ cases, openId, onToggle }: {
  cases: OpsCase[]
  openId: string | null
  onToggle: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const instGroups = ALL_INST_ORDER.map(inst => ({
    inst,
    items: cases.filter(c =>
      (c.institution || '').split(',').map((s: string) => s.trim()).includes(inst)
    ),
  })).filter(g => g.items.length > 0)

  const unassigned = cases.filter(c => !c.institution || c.institution.trim() === '')
  if (unassigned.length > 0) instGroups.push({ inst: '미배정', items: unassigned })

  if (instGroups.length === 0) {
    return <div className="bg-white rounded-xl border border-[#E8E2D4] p-12 text-center text-[#1B2A45]/40 text-sm">진행중인 업체가 없습니다</div>
  }

  return (
    <div className="space-y-4">
      {instGroups.map(({ inst, items }) => {
        const isIndirect = INDIRECT_SET.has(inst)
        const isOpen = !collapsed[inst]
        return (
          <div key={inst}>
            <button onClick={() => setCollapsed(p => ({ ...p, [inst]: !p[inst] }))}
              className={`w-full flex items-center justify-between py-2.5 px-4 rounded-xl mb-2 transition-colors ${
                isIndirect ? 'bg-violet-600 hover:bg-violet-700'
                  : inst === '미배정' ? 'bg-gray-400 hover:bg-gray-500'
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
                  <CeoCaseCard key={`${inst}-${c.id}`} c={c} isOpen={openId === c.id} onToggle={onToggle} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────
export default function OpsCeoTab() {
  const [cases, setCases] = useState<OpsCase[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'active' | 'refund' | 'completed'>('active')
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  async function load() {
    setLoading(true)
    const res = await fetch('/api/ops-cases')
    const data = await res.json()
    setCases((data.cases || []).map((c: any) => ({
      ...c,
      stage: c.stage || c.progress_stage || '',
      progress_stage: c.progress_stage || c.stage || '',
      timeline: Array.isArray(c.timeline) ? c.timeline : [],
      institution: c.institution || '',
      customer_name: c.customers?.name || c.customer_name || '',
      phone: c.customers?.phone || c.phone || '',
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = useCallback((id: string, patch: Record<string, any>) => {
    setCases(prev => prev.map(c => {
      if (c.id !== id) return c
      const mergedTimeline = patch.timeline !== undefined ? patch.timeline : c.timeline
      return { ...c, ...patch, timeline: mergedTimeline }
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

  function toggleOpen(id: string) {
    setOpenId(prev => prev === id ? null : id)
  }

  // 필터
  const q = search.trim().toLowerCase()
  const filtered = q
    ? cases.filter(c =>
        (c.customers?.details?.company || c.customers?.name || c.customer_name || '').toLowerCase().includes(q) ||
        (c.customers?.phone || c.phone || '').replace(/-/g, '').includes(q.replace(/-/g, '')) ||
        (c.institution || '').toLowerCase().includes(q) ||
        (c.ops_user_name || '').toLowerCase().includes(q)
      )
    : cases

  const activeCases    = filtered.filter(c => ACTIVE_STAGE_KEYS.has(c.progress_stage || c.stage || '') || (!REFUND_STAGE_KEYS.has(c.progress_stage || '') && !COMPLETED_STAGE_KEYS.has(c.progress_stage || '') && !c.is_refund && !c.is_completed))
  const refundCases    = filtered.filter(c => REFUND_STAGE_KEYS.has(c.progress_stage || c.stage || '') || c.is_refund)
  const completedCases = filtered.filter(c => COMPLETED_STAGE_KEYS.has(c.progress_stage || c.stage || '') || c.is_completed)

  const viewCases = view === 'refund' ? refundCases : view === 'completed' ? completedCases : activeCases

  // 통계
  const totalRevenue = activeCases.reduce((s, c) => s + (c.revenue || 0), 0)

  const MENU = [
    { key: 'active',    label: '진행중업체', count: activeCases.length },
    { key: 'refund',    label: '환불업체',   count: refundCases.length },
    { key: 'completed', label: '종료업체',   count: completedCases.length },
  ] as const

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
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-white/50 text-[10px]">진행업체</p>
            <p className="text-white font-black text-xl">{activeCases.length}</p>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-white/50 text-[10px]">환불</p>
            <p className="text-white font-black text-xl">{refundCases.length}</p>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-white/50 text-[10px]">종료</p>
            <p className="text-white font-black text-xl">{completedCases.length}</p>
          </div>
        </div>
        {/* 뷰 탭 */}
        <div className="flex gap-1.5">
          {MENU.map(m => (
            <button key={m.key} onClick={() => setView(m.key)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                view === m.key ? 'bg-white text-[#1B2A45]' : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}>
              {m.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                view === m.key ? 'bg-[#1B2A45] text-white' : 'bg-white/20 text-white'
              }`}>{m.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : view === 'active' ? (
        <InstitutionGroupedView cases={activeCases} openId={openId} onToggle={toggleOpen} />
      ) : (
        <div className="space-y-2">
          {viewCases.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#E8E2D4] p-12 text-center text-gray-400 text-sm">
              {view === 'refund' ? '환불 업체가 없습니다' : '종료 업체가 없습니다'}
            </div>
          ) : (
            viewCases.map(c => (
              <CeoCaseListRow key={c.id} c={c} isOpen={openId === c.id} onToggle={toggleOpen} />
            ))
          )}
        </div>
      )}

      {/* 드로어 */}
      {openId && (() => {
        const c = cases.find(x => x.id === openId)
        if (!c) return null
        return <TimelineDrawer c={c} onClose={() => setOpenId(null)} onSave={handleSave} />
      })()}
    </div>
  )
}
