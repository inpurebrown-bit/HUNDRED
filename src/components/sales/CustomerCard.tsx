'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

// ── Types ────────────────────────────────────────────────────────────
export type CustomerStatus = 'lead' | 'consulting' | 'contracted' | 'emotional' | 'trash' | 'db010'
export type CardTabType = 'db010' | 'lead' | 'contracted' | 'emotional' | 'trash'

export interface CustomerDetails {
  reception_date?: string
  assignee?: string
  corp_type?: string
  region?: string
  business_reg_no?: string
  business_type?: string
  years_in_business?: string
  employee_count?: string
  loan_policy?: string
  loan_credit?: string
  revenue_2026?: string
  revenue_2025?: string
  revenue_2024?: string
  revenue_2023?: string
  credit_score?: string
  tax_delinquency?: string
  assets?: string
  required_funds?: string
  as_request?: string
  sensitivity?: '상' | '중' | '하'
  progress_status?: string
  callback_date?: string
  contract_fee?: string
  payment_amount?: string
  unpaid_amount?: string
  tax_invoice?: string
  commission_rate?: string
  ops_transferred?: boolean
  is_cancelled?: boolean
}

export interface CallEntry {
  id: string
  time: string
  author: string
  content: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  company: string
  loan_history?: string
  notes?: string
  status: CustomerStatus
  sales_user_name: string
  updated_at: string
  details?: CustomerDetails
  call_timeline?: CallEntry[]
}

interface CustomerCardProps {
  customer: Customer
  tabType: CardTabType
  userName: string
  salesUsers: string[]
  onStatusChange: (newStatus: CustomerStatus) => Promise<void>
  onUpdate: (patch: Record<string, any>) => Promise<void>
  onDelete: () => Promise<void>
  onTransferToOps?: () => Promise<void>
}

// ── Style constants ──────────────────────────────────────────────────
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50'
const lbl = 'text-xs text-gray-400 mb-0.5 block'

// ── Helpers ──────────────────────────────────────────────────────────
function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${mo}-${day} ${h}:${min}`
  } catch {
    return isoString
  }
}

function progressChipClass(active: boolean, color: 'blue' | 'emerald' | 'violet' | 'red' | 'amber' | 'gray') {
  const colorMap: Record<string, { on: string; off: string }> = {
    blue:    { on: 'bg-blue-500 text-white',    off: 'bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700' },
    emerald: { on: 'bg-emerald-500 text-white',  off: 'bg-gray-100 text-gray-600 hover:bg-emerald-50 hover:text-emerald-700' },
    violet:  { on: 'bg-violet-500 text-white',   off: 'bg-gray-100 text-gray-600 hover:bg-violet-50 hover:text-violet-700' },
    red:     { on: 'bg-red-500 text-white',      off: 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-700' },
    amber:   { on: 'bg-amber-500 text-white',    off: 'bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700' },
    gray:    { on: 'bg-gray-500 text-white',     off: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
  }
  return `px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${active ? colorMap[color].on : colorMap[color].off}`
}

// ── Component ────────────────────────────────────────────────────────
export default function CustomerCard({
  customer,
  tabType,
  userName,
  salesUsers,
  onStatusChange,
  onUpdate,
  onDelete,
  onTransferToOps,
}: CustomerCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

  // Local editable state
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(customer.phone)
  const [company, setCompany] = useState(customer.company)
  const [notes, setNotes] = useState(customer.notes ?? '')
  const [details, setDetails] = useState<CustomerDetails>(customer.details ?? {})
  const [callTimeline, setCallTimeline] = useState<CallEntry[]>(customer.call_timeline ?? [])
  const [newMemo, setNewMemo] = useState('')

  // Refs for debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestStateRef = useRef({ name, phone, company, notes, details })

  // Keep latest state ref updated
  useEffect(() => {
    latestStateRef.current = { name, phone, company, notes, details }
  }, [name, phone, company, notes, details])

  // Sync from prop changes (e.g. after server reload)
  useEffect(() => {
    setName(customer.name)
    setPhone(customer.phone)
    setCompany(customer.company)
    setNotes(customer.notes ?? '')
    setDetails(customer.details ?? {})
    setCallTimeline(customer.call_timeline ?? [])
  }, [customer.id])

  const triggerAutosave = useCallback(() => {
    setSaveStatus('unsaved')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      const s = latestStateRef.current
      await onUpdate({
        name: s.name,
        phone: s.phone,
        company: s.company,
        notes: s.notes,
        details: s.details,
      })
      setSaveStatus('saved')
    }, 1200)
  }, [onUpdate])

  function setDetailField<K extends keyof CustomerDetails>(key: K, value: CustomerDetails[K]) {
    setDetails(prev => {
      const next = { ...prev, [key]: value }
      latestStateRef.current = { ...latestStateRef.current, details: next }
      return next
    })
    triggerAutosave()
  }

  function handleNameChange(v: string) { setName(v); latestStateRef.current = { ...latestStateRef.current, name: v }; triggerAutosave() }
  function handlePhoneChange(v: string) { setPhone(v); latestStateRef.current = { ...latestStateRef.current, phone: v }; triggerAutosave() }
  function handleCompanyChange(v: string) { setCompany(v); latestStateRef.current = { ...latestStateRef.current, company: v }; triggerAutosave() }
  function handleNotesChange(v: string) { setNotes(v); latestStateRef.current = { ...latestStateRef.current, notes: v }; triggerAutosave() }

  // ── Progress chip helpers ──────────────────────────────────────────
  function db010ProgressChip(label: string) {
    const active = details.progress_status === label
    if (label === '감성톡관리') {
      return (
        <button key={label} onClick={() => onStatusChange('emotional')}
          className={progressChipClass(active, 'violet')}>
          {label}
        </button>
      )
    }
    if (label === '계약결정') {
      return (
        <button key={label} onClick={() => onStatusChange('contracted')}
          className={progressChipClass(active, 'emerald')}>
          {label}
        </button>
      )
    }
    return (
      <button key={label} onClick={() => setDetailField('progress_status', label)}
        className={progressChipClass(active, 'blue')}>
        {label}
      </button>
    )
  }

  function leadProgressChip(label: string) {
    const active = details.progress_status === label
    if (label === '계약결정') {
      return (
        <button key={label} onClick={() => onStatusChange('contracted')}
          className={progressChipClass(active, 'emerald')}>
          {label}
        </button>
      )
    }
    if (label === '거절') {
      return (
        <button key={label} onClick={() => onStatusChange('emotional')}
          className={progressChipClass(active, 'violet')}>
          {label}
        </button>
      )
    }
    if (label === '자체거절') {
      return (
        <button key={label} onClick={() => onStatusChange('trash')}
          className={progressChipClass(active, 'red')}>
          {label}
        </button>
      )
    }
    return (
      <button key={label} onClick={() => setDetailField('progress_status', label)}
        className={progressChipClass(active, 'blue')}>
        {label}
      </button>
    )
  }

  // ── Add call memo ──────────────────────────────────────────────────
  async function addMemo() {
    const content = newMemo.trim()
    if (!content) return
    const entry: CallEntry = {
      id: Date.now().toString(),
      time: new Date().toISOString(),
      author: userName,
      content,
    }
    const updated = [entry, ...callTimeline]
    setCallTimeline(updated)
    setNewMemo('')
    await onUpdate({ call_timeline: updated })
  }

  // ── Progress chip for status display in header ─────────────────────
  function progressChipLabel(): string {
    if (details.progress_status) return details.progress_status
    if (details.sensitivity) return `감도 ${details.sensitivity}`
    return ''
  }

  const chipLabel = progressChipLabel()

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ── Collapsed header ── */}
      <button
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <p className="font-semibold text-gray-800 text-sm truncate max-w-[130px]">{company || '(업체명 없음)'}</p>
          <span className="text-gray-400 text-xs shrink-0">{name}</span>
          <span className="text-gray-300 text-[11px] shrink-0 hidden sm:inline">{phone}</span>
          {chipLabel && (
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium shrink-0">
              {chipLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {saveStatus === 'saving' && <span className="text-[10px] text-amber-500">저장중</span>}
          {saveStatus === 'unsaved' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />}
          <span className="text-gray-300 text-[10px]">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-5">

          {/* ── Section: 기본 정보 ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1.5">
              <span>📋 기본 정보</span>
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>접수일자</label>
                <input type="date" value={details.reception_date ?? ''} onChange={e => setDetailField('reception_date', e.target.value)}
                  className={inp} />
              </div>
              <div>
                <label className={lbl}>담당자</label>
                <select value={details.assignee ?? ''} onChange={e => setDetailField('assignee', e.target.value)}
                  className={inp}>
                  <option value="">-- 선택 --</option>
                  {salesUsers.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>상호명</label>
                <input type="text" value={company} onChange={e => handleCompanyChange(e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>법인/개인</label>
                <div className="flex gap-2">
                  {(['법인', '개인'] as const).map(opt => (
                    <button key={opt}
                      onClick={() => setDetailField('corp_type', opt)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        details.corp_type === opt
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}>
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>지역</label>
                <input type="text" value={details.region ?? ''} onChange={e => setDetailField('region', e.target.value)}
                  className={inp} placeholder="서울 강남" />
              </div>
              <div>
                <label className={lbl}>사업자등록번호</label>
                <input type="text" value={details.business_reg_no ?? ''} onChange={e => setDetailField('business_reg_no', e.target.value)}
                  className={inp} placeholder="000-00-00000" />
              </div>
              <div>
                <label className={lbl}>고객명</label>
                <input type="text" value={name} onChange={e => handleNameChange(e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>연락처</label>
                <input type="tel" value={phone} onChange={e => handlePhoneChange(e.target.value)} className={inp} />
              </div>
            </div>
          </section>

          {/* ── Section: 사업 정보 ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 mb-3">🏢 사업 정보</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>업종</label>
                <input type="text" value={details.business_type ?? ''} onChange={e => setDetailField('business_type', e.target.value)}
                  className={inp} placeholder="음식업, 제조업 등" />
              </div>
              <div>
                <label className={lbl}>업력</label>
                <input type="text" value={details.years_in_business ?? ''} onChange={e => setDetailField('years_in_business', e.target.value)}
                  className={inp} placeholder="3년" />
              </div>
              <div>
                <label className={lbl}>직원수</label>
                <input type="text" value={details.employee_count ?? ''} onChange={e => setDetailField('employee_count', e.target.value)}
                  className={inp} placeholder="5명" />
              </div>
              <div>
                <label className={lbl}>기대출(정책자금)</label>
                <input type="text" value={details.loan_policy ?? ''} onChange={e => setDetailField('loan_policy', e.target.value)}
                  className={inp} placeholder="소진공 5천" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>기대출(신용/담보)</label>
                <input type="text" value={details.loan_credit ?? ''} onChange={e => setDetailField('loan_credit', e.target.value)}
                  className={inp} placeholder="국민은행 1억" />
              </div>
            </div>
          </section>

          {/* ── Section: 재무 정보 ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 mb-3">💰 재무 정보</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>26년 매출</label>
                <input type="text" value={details.revenue_2026 ?? ''} onChange={e => setDetailField('revenue_2026', e.target.value)}
                  className={inp} placeholder="0원" />
              </div>
              <div>
                <label className={lbl}>25년 매출</label>
                <input type="text" value={details.revenue_2025 ?? ''} onChange={e => setDetailField('revenue_2025', e.target.value)}
                  className={inp} placeholder="0원" />
              </div>
              <div>
                <label className={lbl}>24년 매출</label>
                <input type="text" value={details.revenue_2024 ?? ''} onChange={e => setDetailField('revenue_2024', e.target.value)}
                  className={inp} placeholder="0원" />
              </div>
              <div>
                <label className={lbl}>23년 매출</label>
                <input type="text" value={details.revenue_2023 ?? ''} onChange={e => setDetailField('revenue_2023', e.target.value)}
                  className={inp} placeholder="0원" />
              </div>
              <div>
                <label className={lbl}>신용점수</label>
                <input type="text" value={details.credit_score ?? ''} onChange={e => setDetailField('credit_score', e.target.value)}
                  className={inp} placeholder="700" />
              </div>
              <div>
                <label className={lbl}>세금체납</label>
                <input type="text" value={details.tax_delinquency ?? ''} onChange={e => setDetailField('tax_delinquency', e.target.value)}
                  className={inp} placeholder="없음" />
              </div>
              <div>
                <label className={lbl}>자산</label>
                <input type="text" value={details.assets ?? ''} onChange={e => setDetailField('assets', e.target.value)}
                  className={inp} placeholder="부동산 2억" />
              </div>
              <div>
                <label className={lbl}>필요자금</label>
                <input type="text" value={details.required_funds ?? ''} onChange={e => setDetailField('required_funds', e.target.value)}
                  className={inp} placeholder="5천만원" />
              </div>
            </div>
          </section>

          {/* ── Section: A/S 요청 ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 mb-3">📝 A/S 요청</h3>
            <textarea
              value={details.as_request ?? ''}
              onChange={e => setDetailField('as_request', e.target.value)}
              rows={3}
              placeholder="A/S 요청 내용을 입력하세요..."
              className={`${inp} resize-none`}
            />
          </section>

          {/* ── Section: Tab-specific ── */}
          {tabType === 'db010' && (
            <section>
              <h3 className="text-xs font-bold text-gray-500 mb-3">📊 영업 현황</h3>
              <div className="space-y-3">
                {/* 감도 */}
                <div>
                  <label className={lbl}>감도</label>
                  <div className="flex gap-2">
                    {([
                      { val: '상' as const, color: 'emerald' },
                      { val: '중' as const, color: 'amber' },
                      { val: '하' as const, color: 'red' },
                    ] as const).map(({ val, color }) => (
                      <button key={val}
                        onClick={() => setDetailField('sensitivity', val)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          details.sensitivity === val
                            ? color === 'emerald' ? 'bg-emerald-500 text-white border-emerald-500'
                            : color === 'amber'   ? 'bg-amber-500 text-white border-amber-500'
                            :                       'bg-red-500 text-white border-red-500'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}>
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 진행현황 */}
                <div>
                  <label className={lbl}>진행현황</label>
                  <div className="flex flex-wrap gap-2">
                    {['고민', '제안서 송부', '감성톡관리', '계약결정'].map(label => db010ProgressChip(label))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {tabType === 'lead' && (
            <section>
              <h3 className="text-xs font-bold text-gray-500 mb-3">📊 진행현황</h3>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {['클로징대기', '재통화예정', '고민중', '부재', 'A/S요청', '거절', '자체거절', '계약결정'].map(label => leadProgressChip(label))}
                </div>
                {details.progress_status === '재통화예정' && (
                  <div>
                    <label className={lbl}>재통화 예정일</label>
                    <input type="date" value={details.callback_date ?? ''} onChange={e => setDetailField('callback_date', e.target.value)}
                      className={inp} />
                  </div>
                )}
              </div>
            </section>
          )}

          {tabType === 'contracted' && (
            <section>
              <h3 className="text-xs font-bold text-gray-500 mb-3">🤝 계약 정보</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className={details.is_cancelled ? 'opacity-50' : ''}>
                    <label className={lbl}>계약금</label>
                    <input type="text"
                      value={details.contract_fee ?? ''}
                      onChange={e => setDetailField('contract_fee', e.target.value)}
                      className={`${inp} ${details.is_cancelled ? 'line-through' : ''}`}
                      placeholder="0원"
                      disabled={details.is_cancelled} />
                  </div>
                  <div className={details.is_cancelled ? 'opacity-50' : ''}>
                    <label className={lbl}>입금액</label>
                    <input type="text"
                      value={details.payment_amount ?? ''}
                      onChange={e => setDetailField('payment_amount', e.target.value)}
                      className={`${inp} ${details.is_cancelled ? 'line-through' : ''}`}
                      placeholder="0원"
                      disabled={details.is_cancelled} />
                  </div>
                  <div className={details.is_cancelled ? 'opacity-50' : ''}>
                    <label className={lbl}>미입금액</label>
                    <input type="text"
                      value={details.unpaid_amount ?? ''}
                      onChange={e => setDetailField('unpaid_amount', e.target.value)}
                      className={`${inp} ${details.is_cancelled ? 'line-through' : ''}`}
                      placeholder="0원"
                      disabled={details.is_cancelled} />
                  </div>
                  <div>
                    <label className={lbl}>수수료율</label>
                    <input type="text"
                      value={details.commission_rate ?? ''}
                      onChange={e => setDetailField('commission_rate', e.target.value)}
                      className={inp}
                      placeholder="10%" />
                  </div>
                </div>

                {/* 세금계산서 */}
                <div>
                  <label className={lbl}>세금계산서발급</label>
                  <div className="flex gap-2">
                    {(['발급', '미발급'] as const).map(opt => (
                      <button key={opt}
                        onClick={() => setDetailField('tax_invoice', opt)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          details.tax_invoice === opt
                            ? opt === '발급' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-gray-500 text-white border-gray-500'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 관리팀 전송 */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {details.ops_transferred ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-semibold">
                        ✅ 관리팀 전송 완료
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">환불/취소</label>
                        <button
                          onClick={() => setDetailField('is_cancelled', !details.is_cancelled)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            details.is_cancelled ? 'bg-red-500' : 'bg-gray-200'
                          }`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            details.is_cancelled ? 'translate-x-5' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => onTransferToOps?.()}
                      className="inline-flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
                      🚀 관리팀으로 전송
                    </button>
                  )}
                  {details.is_cancelled && (
                    <span className="inline-flex items-center bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-full text-xs font-semibold">
                      환불/취소
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}

          {tabType === 'emotional' && (
            <section>
              <h3 className="text-xs font-bold text-gray-500 mb-3">💬 감성톡 관리</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onStatusChange('lead')}
                  className="inline-flex items-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
                  ↩️ 신규고객 복귀
                </button>
                <button
                  onClick={() => onStatusChange('trash')}
                  className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
                  🗑 자체거절로 이동
                </button>
              </div>
            </section>
          )}

          {tabType === 'trash' && (
            <section>
              <h3 className="text-xs font-bold text-gray-500 mb-3">🗑 자체거절</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onStatusChange('lead')}
                  className="inline-flex items-center gap-1 bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
                  ↩️ 신규고객 복귀
                </button>
              </div>
            </section>
          )}

          {/* ── Section: 통화메모 ── */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 mb-3">💬 통화메모</h3>
            {/* Input area */}
            <div className="flex gap-2 mb-3">
              <textarea
                value={newMemo}
                onChange={e => setNewMemo(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    addMemo()
                  }
                }}
                rows={2}
                placeholder="통화 내용 입력 (Enter로 추가, Shift+Enter 줄바꿈)"
                className={`${inp} resize-none flex-1`}
              />
              <button
                onClick={addMemo}
                disabled={!newMemo.trim()}
                className="shrink-0 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                메모<br />추가
              </button>
            </div>

            {/* Timeline */}
            {callTimeline.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">통화 메모가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {callTimeline.map(entry => (
                  <div key={entry.id} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-gray-400">{formatTime(entry.time)}</span>
                      <span className="text-[10px] font-semibold text-blue-600">{entry.author}</span>
                    </div>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{entry.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Bottom row ── */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <button
              onClick={onDelete}
              className="text-xs text-red-400 hover:text-red-600 transition-colors">
              삭제
            </button>
            <p className="text-[10px] text-gray-300">수정: {new Date(customer.updated_at).toLocaleString('ko-KR')}</p>
          </div>

        </div>
      )}
    </div>
  )
}
