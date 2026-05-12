'use client'

import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────
interface TimelineEntry {
  date: string
  text: string
}

interface OpsCase {
  id: string
  customer_name: string
  phone: string
  stage: string
  memo: string
  next_plan: string
  required_checks: string
  fund_solution: string
  institution_type: string
  institution: string | null
  timeline: TimelineEntry[]
  institution_credentials: Record<string, { id: string; pw: string }>
  deposit_date: string | null
  contract_fee: number
  paid_amount: number
  invoice_issued: boolean
  payment_cash: boolean
  payment_card: boolean
  absorbed: boolean
  sojin_cert_youth: boolean
  sojin_cert_general: boolean
  sojin_cert_disabled: boolean
  concurrent_institutions: string[]
  approved_amount: number
  commission_amount: number
  revenue: number
  is_refund: boolean
  is_completed: boolean
  owner_id: string
  // alias fields from API
  progress_stage?: string
  progress_memo?: string
  customers?: { name: string; phone: string; details?: any }
}

// ─── Constants ────────────────────────────────────────────
const NEW_STAGES = [
  '서류받는중', '접수전', '신청완료', '반려보정',
  '실사대기', '실사완료', '승인대기', '승인',
  '부결', '입금전', '홀딩', '환불', '종료',
]

const STAGE_COLORS: Record<string, string> = {
  '서류받는중': 'bg-gray-100 text-gray-700',
  '접수전':     'bg-sky-100 text-sky-700',
  '신청완료':   'bg-blue-100 text-blue-700',
  '반려보정':   'bg-orange-100 text-orange-700',
  '실사대기':   'bg-amber-100 text-amber-700',
  '실사완료':   'bg-yellow-100 text-yellow-700',
  '승인대기':   'bg-violet-100 text-violet-700',
  '승인':       'bg-emerald-100 text-emerald-700',
  '부결':       'bg-red-100 text-red-700',
  '입금전':     'bg-teal-100 text-teal-700',
  '홀딩':       'bg-slate-100 text-slate-700',
  '환불':       'bg-rose-100 text-rose-700',
  '종료':       'bg-neutral-100 text-neutral-700',
}

const INSTITUTION_OPTIONS = [
  { value: 'new',          label: '미배정' },
  { value: 'jungzin',      label: '중진공' },
  { value: 'sojin_new',    label: '소진공(신취)' },
  { value: 'sojin_innov',  label: '소진공(혁신)' },
  { value: 'sojin_retry',  label: '소진공(재도전)' },
  { value: 'kibo',         label: '기보' },
  { value: 'shinbo',       label: '신보' },
  { value: 'foundation',   label: '재단' },
  { value: 'miso',         label: '미소' },
  { value: 'alt_handling', label: '대안없이핸들링' },
]

const INST_LABEL: Record<string, string> = Object.fromEntries(
  INSTITUTION_OPTIONS.map(o => [o.value, o.label])
)

function fmt(n: number) {
  if (!n) return '-'
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + '억'
  if (n >= 10_000) return Math.round(n / 10_000) + '만'
  return n.toLocaleString()
}

// ─── Single case detail modal ─────────────────────────────
function CaseModal({
  c,
  onUpdate,
  onClose,
}: {
  c: OpsCase
  onUpdate: (id: string, patch: Partial<OpsCase>) => Promise<void>
  onClose: () => void
}) {
  const [local, setLocal] = useState<OpsCase>({ ...c })
  const [saving, setSaving] = useState(false)
  const [newTimeline, setNewTimeline] = useState('')
  const [activeTab, setActiveTab] = useState<'main' | 'finance' | 'timeline' | 'credentials'>('main')

  // 계산된 미입금액
  const unpaidAmount = (local.contract_fee || 0) - (local.paid_amount || 0)

  function setField<K extends keyof OpsCase>(key: K, val: OpsCase[K]) {
    setLocal(prev => ({ ...prev, [key]: val }))
  }

  async function save() {
    setSaving(true)
    await onUpdate(c.id, {
      stage: local.stage,
      memo: local.memo,
      next_plan: local.next_plan,
      required_checks: local.required_checks,
      fund_solution: local.fund_solution,
      institution_type: local.institution_type,
      timeline: local.timeline,
      institution_credentials: local.institution_credentials,
      deposit_date: local.deposit_date,
      contract_fee: local.contract_fee,
      paid_amount: local.paid_amount,
      invoice_issued: local.invoice_issued,
      payment_cash: local.payment_cash,
      payment_card: local.payment_card,
      absorbed: local.absorbed,
      sojin_cert_youth: local.sojin_cert_youth,
      sojin_cert_general: local.sojin_cert_general,
      sojin_cert_disabled: local.sojin_cert_disabled,
      concurrent_institutions: local.concurrent_institutions,
      approved_amount: local.approved_amount,
      revenue: local.revenue,
      is_refund: local.stage === '환불',
      is_completed: local.stage === '종료',
    } as any)
    setSaving(false)
    onClose()
  }

  function addTimeline() {
    if (!newTimeline.trim()) return
    const entry: TimelineEntry = {
      date: new Date().toISOString().slice(0, 10),
      text: newTimeline.trim(),
    }
    setField('timeline', [...(local.timeline || []), entry])
    setNewTimeline('')
  }

  const credKey = local.institution_type || 'new'
  const cred = local.institution_credentials?.[credKey] || { id: '', pw: '' }

  function updateCred(field: 'id' | 'pw', val: string) {
    const updated = {
      ...(local.institution_credentials || {}),
      [credKey]: { ...cred, [field]: val },
    }
    setField('institution_credentials', updated)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* 모달 헤더 */}
        <div className="bg-[#1B2A45] px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-white font-bold text-base">{c.customer_name}</h3>
            <p className="text-white/50 text-xs mt-0.5">{c.phone || '-'}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STAGE_COLORS[local.stage] || 'bg-gray-100 text-gray-600'}`}>
              {local.stage || '-'}
            </span>
            <button onClick={onClose} className="text-white/60 hover:text-white text-lg">✕</button>
          </div>
        </div>

        {/* 서브탭 */}
        <div className="flex border-b border-gray-100 shrink-0 bg-white">
          {[
            { key: 'main', label: '기본정보' },
            { key: 'finance', label: '💰 입금/계약' },
            { key: 'timeline', label: '📅 타임라인' },
            { key: 'credentials', label: '🔑 기관ID/PW' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === t.key
                  ? 'border-b-2 border-[#1B2A45] text-[#1B2A45]'
                  : 'text-gray-400 hover:text-gray-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 내용 */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {activeTab === 'main' && (
            <>
              {/* 단계 */}
              <div>
                <label className="text-xs text-gray-500 block mb-1.5 font-medium">진행 단계</label>
                <div className="flex flex-wrap gap-1.5">
                  {NEW_STAGES.map(s => (
                    <button key={s} onClick={() => setField('stage', s)}
                      className={`text-xs px-3 py-1 rounded-full font-medium border transition-all ${
                        local.stage === s
                          ? (STAGE_COLORS[s] || 'bg-gray-200 text-gray-700') + ' ring-2 ring-offset-1 ring-current'
                          : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* 기관 */}
              <div>
                <label className="text-xs text-gray-500 block mb-1 font-medium">담당 기관</label>
                <div className="flex flex-wrap gap-1.5">
                  {INSTITUTION_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setField('institution_type', opt.value)}
                      className={`text-xs px-3 py-1 rounded-full border transition-all ${
                        local.institution_type === opt.value
                          ? 'bg-[#1B2A45] text-white border-[#1B2A45]'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#1B2A45]/40'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 체크리스트 */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-500 mb-2">체크리스트</p>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={local.absorbed || false}
                      onChange={e => setField('absorbed', e.target.checked)}
                      className="w-4 h-4 rounded" />
                    <span className="text-xs text-gray-700">흡수 완료</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={local.sojin_cert_youth || false}
                      onChange={e => setField('sojin_cert_youth', e.target.checked)}
                      className="w-4 h-4 rounded" />
                    <span className="text-xs text-gray-700">소진공 확인서 — 청년</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={local.sojin_cert_general || false}
                      onChange={e => setField('sojin_cert_general', e.target.checked)}
                      className="w-4 h-4 rounded" />
                    <span className="text-xs text-gray-700">소진공 확인서 — 일반</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={local.sojin_cert_disabled || false}
                      onChange={e => setField('sojin_cert_disabled', e.target.checked)}
                      className="w-4 h-4 rounded" />
                    <span className="text-xs text-gray-700">소진공 확인서 — 장애인</span>
                  </label>
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="text-xs text-gray-500 block mb-1 font-medium">진행 메모</label>
                <textarea value={local.memo || ''}
                  onChange={e => setField('memo', e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/20 resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1 font-medium">이후 진행 계획</label>
                <textarea value={local.next_plan || ''}
                  onChange={e => setField('next_plan', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/20 resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1 font-medium">신청전 필수 확인</label>
                <textarea value={local.required_checks || ''}
                  onChange={e => setField('required_checks', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/20 resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1 font-medium">자금 솔루션</label>
                <textarea value={local.fund_solution || ''}
                  onChange={e => setField('fund_solution', e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/20 resize-none" />
              </div>
            </>
          )}

          {activeTab === 'finance' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-medium">계약금 (원)</label>
                  <input type="number" value={local.contract_fee || ''}
                    onChange={e => setField('contract_fee', Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-medium">입금액 (원)</label>
                  <input type="number" value={local.paid_amount || ''}
                    onChange={e => setField('paid_amount', Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-medium">미입금액 (자동계산)</label>
                  <div className={`border rounded-lg px-3 py-2 text-sm font-semibold ${
                    unpaidAmount > 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-500'
                  }`}>
                    {unpaidAmount > 0 ? `-${fmt(unpaidAmount)}원` : '0'}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-medium">승인금액 (원)</label>
                  <input type="number" value={local.approved_amount || ''}
                    onChange={e => setField('approved_amount', Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-medium">매출 (원)</label>
                  <input type="number" value={local.revenue || ''}
                    onChange={e => setField('revenue', Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-medium">입금일</label>
                  <input type="date" value={local.deposit_date || ''}
                    onChange={e => setField('deposit_date', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-500 mb-2">결제 방식</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={local.invoice_issued || false}
                      onChange={e => setField('invoice_issued', e.target.checked)}
                      className="w-4 h-4 rounded" />
                    <span className="text-xs text-gray-700">계산서</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={local.payment_cash || false}
                      onChange={e => setField('payment_cash', e.target.checked)}
                      className="w-4 h-4 rounded" />
                    <span className="text-xs text-gray-700">현금</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={local.payment_card || false}
                      onChange={e => setField('payment_card', e.target.checked)}
                      className="w-4 h-4 rounded" />
                    <span className="text-xs text-gray-700">카드</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {activeTab === 'timeline' && (
            <>
              <div className="flex gap-2">
                <input
                  value={newTimeline}
                  onChange={e => setNewTimeline(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTimeline()}
                  placeholder="타임라인 내용 입력 후 Enter 또는 추가"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button onClick={addTimeline}
                  className="bg-[#1B2A45] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#243552]">
                  추가
                </button>
              </div>
              {(local.timeline || []).length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">타임라인이 없습니다</div>
              ) : (
                <div className="relative pl-4 border-l-2 border-gray-200 space-y-3">
                  {[...(local.timeline || [])].reverse().map((entry, i) => (
                    <div key={i} className="relative">
                      <div className="absolute -left-[21px] top-1.5 w-3 h-3 rounded-full bg-[#1B2A45] border-2 border-white" />
                      <div className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-gray-400 mb-0.5">{entry.date}</p>
                        <p className="text-sm text-gray-800">{entry.text}</p>
                      </div>
                      <button
                        onClick={() => {
                          const idx = (local.timeline || []).length - 1 - i
                          setField('timeline', (local.timeline || []).filter((_, j) => j !== idx))
                        }}
                        className="absolute top-2 right-2 text-[10px] text-red-400 hover:text-red-600">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'credentials' && (
            <>
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 mb-3">
                현재 선택된 기관 <b>{INST_LABEL[local.institution_type] || '미배정'}</b>의 ID/PW를 저장합니다.
                기관 변경은 기본정보 탭에서 하세요.
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-medium">
                    {INST_LABEL[local.institution_type] || '기관'} 아이디
                  </label>
                  <input
                    value={cred.id}
                    onChange={e => updateCred('id', e.target.value)}
                    placeholder="기관 포털 아이디"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-medium">
                    {INST_LABEL[local.institution_type] || '기관'} 비밀번호
                  </label>
                  <input
                    type="text"
                    value={cred.pw}
                    onChange={e => updateCred('pw', e.target.value)}
                    placeholder="기관 포털 비밀번호"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                  />
                </div>
              </div>
              {/* 모든 기관 ID/PW 요약 */}
              {Object.keys(local.institution_credentials || {}).filter(k =>
                local.institution_credentials[k]?.id || local.institution_credentials[k]?.pw
              ).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-gray-500 mb-2">저장된 기관 로그인 정보</p>
                  <div className="space-y-1.5">
                    {Object.entries(local.institution_credentials || {}).map(([k, v]) => (
                      (v.id || v.pw) ? (
                        <div key={k} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 text-xs">
                          <span className="font-semibold text-gray-700 w-20 shrink-0">
                            {INST_LABEL[k] || k}
                          </span>
                          <span className="text-gray-600 flex-1">{v.id}</span>
                          <span className="text-gray-400 font-mono">{v.pw}</span>
                        </div>
                      ) : null
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 저장 버튼 */}
        <div className="shrink-0 px-5 py-3 border-t border-gray-100 flex gap-2 bg-white">
          <button onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
            취소
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-[#1B2A45] text-white py-2 rounded-lg text-sm font-semibold hover:bg-[#243552] disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Case Row (list item) ─────────────────────────────────
function CaseRow({ c, onUpdate }: { c: OpsCase; onUpdate: (id: string, patch: Partial<OpsCase>) => Promise<void> }) {
  const [showModal, setShowModal] = useState(false)
  const stage = c.stage || c.progress_stage || '-'
  const name = c.customer_name || c.customers?.name || '-'
  const inst = INST_LABEL[c.institution_type] || '미배정'
  const unpaid = (c.contract_fee || 0) - (c.paid_amount || 0)

  const checklist: string[] = [
    c.absorbed ? '흡수' : '',
    c.sojin_cert_youth ? '소진공(청년)' : '',
    c.sojin_cert_general ? '소진공(일반)' : '',
    c.sojin_cert_disabled ? '소진공(장애)' : '',
  ].filter(Boolean)

  return (
    <>
      <div
        className="bg-white border border-[#E8E2D4] rounded-xl px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:border-[#1B2A45]/30 transition-colors"
        onClick={() => setShowModal(true)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#1B2A45] text-sm">{name}</span>
              <span className="text-xs text-gray-400">{c.phone || '-'}</span>
              {checklist.map(ch => (
                <span key={ch} className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">{ch}</span>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-500">{inst}</span>
              {(c.timeline || []).length > 0 && (
                <span className="text-[10px] text-gray-400">
                  📅 {c.timeline[c.timeline.length - 1].date}: {c.timeline[c.timeline.length - 1].text.slice(0, 30)}
                </span>
              )}
              {unpaid > 0 && (
                <span className="text-[10px] text-red-600 font-medium">미입금 {fmt(unpaid)}원</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {c.paid_amount ? <span className="text-[10px] text-emerald-600 font-medium">{fmt(c.paid_amount)}원</span> : null}
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600'}`}>
            {stage}
          </span>
          <span className="text-gray-300 text-xs">›</span>
        </div>
      </div>

      {showModal && (
        <CaseModal c={c} onUpdate={onUpdate} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}

// ─── Institution Section ──────────────────────────────────
const INSTITUTION_SECTIONS = [
  { key: 'new',          label: '미배정',          values: ['new', '', null] as (string | null)[] },
  { key: 'jungzin',     label: '중진공',           values: ['jungzin'] },
  { key: 'sojin_new',   label: '소진공(신취)',     values: ['sojin_new'] },
  { key: 'sojin_innov', label: '소진공(혁신)',     values: ['sojin_innov'] },
  { key: 'sojin_retry', label: '소진공(재도전)',   values: ['sojin_retry'] },
  { key: 'kibo',        label: '기보',             values: ['kibo'] },
  { key: 'shinbo',      label: '신보',             values: ['shinbo'] },
  { key: 'foundation',  label: '재단',             values: ['foundation'] },
  { key: 'miso',        label: '미소',             values: ['miso'] },
  { key: 'alt_handling',label: '대안없이핸들링',   values: ['alt_handling'] },
]

function InstitutionView({
  cases,
  onUpdate,
}: {
  cases: OpsCase[]
  onUpdate: (id: string, patch: Partial<OpsCase>) => Promise<void>
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <div className="space-y-3">
      {INSTITUTION_SECTIONS.map(sec => {
        const secCases = cases.filter(c => {
          const it = c.institution_type
          if (sec.key === 'new') return !it || it === '' || it === 'new'
          return sec.values.includes(it as string | null)
        })
        if (secCases.length === 0) return null
        const isOpen = !collapsed[sec.key]
        return (
          <div key={sec.key}>
            <button
              onClick={() => setCollapsed(p => ({ ...p, [sec.key]: !p[sec.key] }))}
              className="w-full flex items-center justify-between py-2 px-4 bg-[#1B2A45] rounded-xl hover:bg-[#1B2A45]/90 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm">{sec.label}</span>
                <span className="bg-[#C5A258] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {secCases.length}
                </span>
              </div>
              <span className="text-white/60 text-xs">{isOpen ? '▲' : '▼'}</span>
            </button>
            {isOpen && (
              <div className="space-y-2 pl-1">
                {secCases.map(c => <CaseRow key={c.id} c={c} onUpdate={onUpdate} />)}
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
  const [view, setView] = useState<'institution' | 'active' | 'refund' | 'completed'>('institution')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/ops-cases')
    const data = await res.json()
    setCases((data.cases || []).map((c: any) => ({
      ...c,
      stage: c.stage || c.progress_stage || '',
      timeline: Array.isArray(c.timeline) ? c.timeline : [],
      institution_credentials: c.institution_credentials || {},
      concurrent_institutions: Array.isArray(c.concurrent_institutions) ? c.concurrent_institutions : [],
    })))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function onUpdate(id: string, patch: Partial<OpsCase>) {
    const res = await fetch(`/api/ops-cases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (res.ok) {
      const { case: updated } = await res.json()
      setCases(prev => prev.map(c => c.id === id ? {
        ...c, ...updated,
        stage: updated.stage || updated.progress_stage || c.stage,
        timeline: Array.isArray(updated.timeline) ? updated.timeline : c.timeline,
        institution_credentials: updated.institution_credentials || c.institution_credentials,
      } : c))
    }
  }

  // 필터
  const activeStages = NEW_STAGES.filter(s => s !== '환불' && s !== '종료')
  const refundCases = cases.filter(c => c.stage === '환불' || c.is_refund)
  const completedCases = cases.filter(c => c.stage === '종료' || c.is_completed)
  const activeCases = cases.filter(c => !refundCases.includes(c) && !completedCases.includes(c))

  const filtered = (list: OpsCase[]) =>
    search.trim()
      ? list.filter(c =>
          (c.customer_name || '').includes(search) ||
          (c.phone || '').includes(search) ||
          (c.memo || '').includes(search)
        )
      : list

  // 통계
  const totalRevenue = activeCases.reduce((s, c) => s + (c.revenue || 0), 0)
  const totalApproved = activeCases.reduce((s, c) => s + (c.approved_amount || 0), 0)

  const MENU = [
    { key: 'institution', label: '기관별 보기', count: activeCases.length },
    { key: 'active',      label: '진행업체',   count: activeCases.length },
    { key: 'refund',      label: '환불업체',   count: refundCases.length },
    { key: 'completed',   label: '종료업체',   count: completedCases.length },
  ] as const

  return (
    <div className="space-y-4 pb-8 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="bg-[#1B2A45] rounded-xl px-5 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-bold text-white text-base">⚙️ 자금팀 현황</h2>
          <div className="flex items-center gap-2">
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
            <p className="text-white/50 text-[10px]">총 매출</p>
            <p className="text-white font-black text-lg">{fmt(totalRevenue)}원</p>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <p className="text-white/50 text-[10px]">총 승인금액</p>
            <p className="text-white font-black text-lg">{fmt(totalApproved)}원</p>
          </div>
        </div>
        {/* 뷰 탭 */}
        <div className="flex gap-1.5">
          {MENU.map(m => (
            <button key={m.key} onClick={() => setView(m.key as any)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                view === m.key
                  ? 'bg-white text-[#1B2A45]'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}>
              {m.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                view === m.key ? 'bg-[#1B2A45] text-white' : 'bg-white/20 text-white'
              }`}>{m.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 검색 */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="업체명, 연락처, 메모로 검색..."
        className="w-full border border-[#E8E2D4] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A45]/20 bg-white"
      />

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">불러오는 중...</div>
      ) : (
        <>
          {view === 'institution' && (
            <InstitutionView cases={filtered(activeCases)} onUpdate={onUpdate} />
          )}
          {view === 'active' && (
            <div className="space-y-2">
              {filtered(activeCases).length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-[#E8E2D4]">
                  진행 중인 업체가 없습니다
                </div>
              ) : (
                filtered(activeCases).map(c => <CaseRow key={c.id} c={c} onUpdate={onUpdate} />)
              )}
            </div>
          )}
          {view === 'refund' && (
            <div className="space-y-2">
              {filtered(refundCases).length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-[#E8E2D4]">
                  환불 업체가 없습니다
                </div>
              ) : (
                filtered(refundCases).map(c => <CaseRow key={c.id} c={c} onUpdate={onUpdate} />)
              )}
            </div>
          )}
          {view === 'completed' && (
            <div className="space-y-2">
              {filtered(completedCases).length === 0 ? (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-[#E8E2D4]">
                  종료 업체가 없습니다
                </div>
              ) : (
                filtered(completedCases).map(c => <CaseRow key={c.id} c={c} onUpdate={onUpdate} />)
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
