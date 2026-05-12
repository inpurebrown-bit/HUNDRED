'use client'

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react'
import { signOut } from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'

// ── KST Utils ──────────────────────────────────────────────────────────
function nowKST() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00'
}
function formatKST(isoStr: string) {
  if (!isoStr) return { date: '', time: '' }
  const d = new Date(isoStr)
  const date = d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit' }).replace('. ', '/').replace('.', '')
  const time = d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
  return { date, time }
}

// ── Types ──────────────────────────────────────────────────────────────
interface OpsCase {
  id: string
  customer_id: string
  ops_user_id: string
  ops_user_name: string
  contract_id?: string
  institution: string
  solution_type: string
  progress_stage: string
  progress_memo: string
  revenue: number
  is_refund?: boolean
  is_completed?: boolean
  timeline?: any[]
  institution_credentials?: Record<string, any>
  details?: Record<string, any>
  updated_at: string
  created_at: string
  customers: {
    name: string
    phone: string
    company: string
    loan_history?: string
    details?: Record<string, any>
  }
}

// ── Pipeline stages ────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: '서류받는중', label: '서류받는중', color: 'bg-gray-500',   light: 'bg-gray-50 border-gray-200' },
  { key: '접수전',     label: '접수전',     color: 'bg-sky-500',    light: 'bg-sky-50 border-sky-200' },
  { key: '신청완료',   label: '신청완료',   color: 'bg-blue-500',   light: 'bg-blue-50 border-blue-200' },
  { key: '반려보정',   label: '반려보정',   color: 'bg-orange-500', light: 'bg-orange-50 border-orange-200' },
  { key: '실사대기',   label: '실사대기',   color: 'bg-amber-500',  light: 'bg-amber-50 border-amber-200' },
  { key: '실사완료',   label: '실사완료',   color: 'bg-yellow-500', light: 'bg-yellow-50 border-yellow-200' },
  { key: '승인대기',   label: '승인대기',   color: 'bg-violet-500', light: 'bg-violet-50 border-violet-200' },
  { key: '승인',       label: '승인',       color: 'bg-emerald-500',light: 'bg-emerald-50 border-emerald-200' },
  { key: '부결',       label: '부결',       color: 'bg-red-500',    light: 'bg-red-50 border-red-200' },
  { key: '입금전',     label: '입금전',     color: 'bg-teal-500',   light: 'bg-teal-50 border-teal-200' },
  { key: '홀딩',       label: '홀딩',       color: 'bg-slate-400',  light: 'bg-slate-50 border-slate-200' },
  // 기존 호환
  { key: '검토중',     label: '검토중',     color: 'bg-gray-400',   light: 'bg-gray-50 border-gray-200' },
  { key: '접수',       label: '접수',       color: 'bg-sky-400',    light: 'bg-sky-50 border-sky-200' },
  { key: '진행중',     label: '진행중',     color: 'bg-blue-400',   light: 'bg-blue-50 border-blue-200' },
]

const ACTIVE_STAGE_KEYS = new Set([
  '서류받는중','접수전','신청완료','반려보정','실사대기','실사완료',
  '승인대기','승인','부결','입금전','홀딩','검토중','접수','진행중',
  'assigned','absorbed','doc_collect','reviewing','approved','executing','rejected',
])
const REFUND_STAGE_KEYS = new Set(['환불', 'refunded'])
const COMPLETED_STAGE_KEYS = new Set(['종료', '완료', 'completed'])

// ── 기관 목록 ──────────────────────────────────────────────────────────
const INST_DIRECT = ['중진공', '소진공(혁신)', '소진공(신취)', '소진공(재도전)', '서민금융(미소)']
const INST_INDIRECT = ['기보', '신보', '재단']
const INDIRECT_SET = new Set(INST_INDIRECT)

const INDIRECT_SCRIPT_TEMPLATE = (company: string, name: string, inst: string, visitDate: string, visitTime: string) =>
`안녕하세요, ${company} ${name} 대표님. 헌드레드컨설팅입니다.
${inst} 보증서 심사를 위해 고객님이 직접 방문하셔야 합니다.

■ 방문 일정: ${visitDate || '(날짜 미정)'} ${visitTime || ''}
■ 방문 기관: ${inst}
■ 지참 서류: 사업자등록증, 신분증, 법인등기부등본(해당 시)

방문 전 미리 연락 주시면 감사하겠습니다.`

// ── 기관ID/PW 목록 ─────────────────────────────────────────────────────
const CRED_INSTITUTIONS = ['소진공', '중진공', '기보', '신보', '재단', '크래딧포유', '아이핀', '소진공지식배움터']

interface Props {
  userId: string
  userName: string
}

const opsTabs = [
  { key: 'cases', label: '📋 담당 케이스' },
  { key: 'report', label: '📝 보고' },
]

const inp = 'w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/50 bg-white'
const lbl = 'text-[10px] text-gray-400 mb-0.5 block font-medium'

// ── Detail Tab Types ────────────────────────────────────────────────────
const DETAIL_TABS = ['진행현황', '고객정보', '기관ID/PW', '인콜일지', '💰 입금/계약'] as const
type DetailTab = typeof DETAIL_TABS[number]

// ── OpsDetailPanel ─────────────────────────────────────────────────────
function OpsDetailPanel({ c, onSave }: { c: OpsCase; onSave: (id: string, patch: Record<string, any>) => void }) {
  const [local, setLocal] = useState<OpsCase>({ ...c })
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('진행현황')
  const [incallData, setIncallData] = useState<any>(null)
  const [incallLoading, setIncallLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pwVisible, setPwVisible] = useState<Record<string, boolean>>({})

  // sync from parent if c changes
  useEffect(() => { setLocal({ ...c }) }, [c.id])

  // 인콜일지 탭 클릭 시 데이터 로드
  useEffect(() => {
    if (activeDetailTab === '인콜일지' && !incallData && c.customer_id) {
      setIncallLoading(true)
      fetch(`/api/customers/${c.customer_id}`)
        .then(r => r.json())
        .then(d => { setIncallData(d.customer || d); setIncallLoading(false) })
        .catch(() => setIncallLoading(false))
    }
  }, [activeDetailTab, c.customer_id])

  function field<K extends keyof OpsCase>(key: K, val: OpsCase[K]) {
    const next = { ...local, [key]: val }
    setLocal(next)
    schedule({ [key]: val })
  }

  function detailField(key: string, val: any) {
    const next = { ...local, details: { ...(local.details || {}), [key]: val } }
    setLocal(next)
    schedule({ details: { ...(local.details || {}), [key]: val } })
  }

  function toggleDetail(key: string) {
    const cur = local.details?.[key]
    detailField(key, !cur)
  }

  function toggleInstitution(inst: string) {
    const current = (local.institution || '').split(',').map((s: string) => s.trim()).filter(Boolean)
    const next = current.includes(inst) ? current.filter((s: string) => s !== inst) : [...current, inst]
    const val = next.join(', ')
    const nextCase = { ...local, institution: val }
    setLocal(nextCase)
    schedule({ institution: val })
  }

  async function handleVisitDate(val: string) {
    detailField('visit_date', val)
    if (!val) return
    const selectedInst = (local.institution || '').split(',').map((s: string) => s.trim()).filter(Boolean)
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `[방문] ${c.customers?.details?.company || c.customers?.name} — ${selectedInst.join(', ') || '기관미정'}`,
          start_date: val,
          end_date: val,
          start_time: local.details?.visit_time || null,
          description: `${c.customers?.name} / ${c.customers?.phone}\n기관: ${selectedInst.join(', ')}`,
          color: 'violet',
          is_allday: !local.details?.visit_time,
        }),
      })
    } catch (e) { /* 무시 */ }
  }

  // 진행단계 변경 → 타임라인 자동기록
  function handleStageChange(nextStage: string) {
    const prevStage = local.progress_stage
    const autoEntry = {
      user: '자동기록',
      content: `단계 변경: ${prevStage} → ${nextStage}`,
      created_at: nowKST(),
    }
    const updatedTimeline = [...(local.timeline || []), autoEntry]
    const next = { ...local, progress_stage: nextStage, timeline: updatedTimeline }
    setLocal(next)
    schedule({ progress_stage: nextStage, timeline: updatedTimeline })
  }

  function schedule(patch: Record<string, any>) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onSave(c.id, patch)
    }, 1500)
  }

  const d = local.details || {}
  const cd = local.customers?.details || {}
  const selectedInstitutions = (local.institution || '').split(',').map((s: string) => s.trim()).filter(Boolean)
  const hasIndirect = selectedInstitutions.some((i: string) => INDIRECT_SET.has(i))
  const indirectList = selectedInstitutions.filter((i: string) => INDIRECT_SET.has(i))

  return (
    <div className="space-y-3">
      {/* 탭 네비게이션 */}
      <div className="flex border-b border-gray-100 overflow-x-auto">
        {DETAIL_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveDetailTab(tab)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeDetailTab === tab
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── 탭: 진행현황 ── */}
      {activeDetailTab === '진행현황' && (
        <div className="space-y-4">
          {/* 흡수 버튼 (신규배정일 때만) */}
          {local.progress_stage === 'assigned' && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-indigo-800">📥 신규 배정 업체</p>
                <p className="text-xs text-indigo-600 mt-0.5">내용 확인 및 고객과 통화 후 흡수 처리해주세요</p>
              </div>
              <button
                onClick={() => field('progress_stage', 'absorbed')}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                ✅ 흡수 완료
              </button>
            </div>
          )}

          {/* 진행 현황 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">진행 현황</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-2">
              <div>
                <label className={lbl}>진행 단계</label>
                <select
                  value={local.progress_stage}
                  onChange={e => handleStageChange(e.target.value)}
                  className={inp}
                >
                  {[...PIPELINE_STAGES, { key: '환불', label: '환불' }, { key: '종료', label: '종료' }].map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <label className={lbl}>담당 기관 (복수 선택 가능)</label>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] text-blue-500 font-medium w-12">직접자금</span>
                    {INST_DIRECT.map(inst => (
                      <button key={inst} type="button"
                        onClick={() => toggleInstitution(inst)}
                        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                          selectedInstitutions.includes(inst)
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}>
                        {inst}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] text-violet-500 font-medium w-12">간접자금</span>
                    {INST_INDIRECT.map(inst => (
                      <button key={inst} type="button"
                        onClick={() => toggleInstitution(inst)}
                        className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                          selectedInstitutions.includes(inst)
                            ? 'bg-violet-500 text-white border-violet-500'
                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                        }`}>
                        {inst}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className={lbl}>이후 진행 예정</label>
                <input type="text" value={d.next_inst || ''} onChange={e => detailField('next_inst', e.target.value)} className={inp} placeholder="다음 기관" />
              </div>
              <div>
                <label className={lbl}>현재 진행 상태</label>
                <input type="text" value={d.current_status || ''} onChange={e => detailField('current_status', e.target.value)} className={inp} placeholder="상태 메모" />
              </div>
              <div>
                <label className={lbl}>신청 필수 확인</label>
                <input type="text" value={d.required_checks || ''} onChange={e => detailField('required_checks', e.target.value)} className={inp} placeholder="필수 체크사항" />
              </div>
              <div>
                <label className={lbl}>자금 디테일</label>
                <input type="text" value={d.fund_detail || ''} onChange={e => detailField('fund_detail', e.target.value)} className={inp} placeholder="자금 상세" />
              </div>
              {/* 방문 일정 */}
              <div>
                <label className={lbl}>방문 일정 📅</label>
                <div className="flex gap-1">
                  <input type="date" value={d.visit_date || ''}
                    onChange={e => handleVisitDate(e.target.value)}
                    className={inp + ' flex-1'} />
                  <input type="time" value={d.visit_time || ''}
                    onChange={e => detailField('visit_time', e.target.value)}
                    className={inp + ' w-20'} />
                </div>
                {d.visit_date && (
                  <p className="text-[10px] text-emerald-600 mt-0.5">✅ 캘린더에 자동 등록됨</p>
                )}
              </div>
              <div>
                <label className={lbl}>계약 날짜</label>
                <input type="date" value={d.contract_date || ''} onChange={e => detailField('contract_date', e.target.value)} className={inp} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>계약 특이사항</label>
                <input type="text" value={d.contract_notes || ''} onChange={e => detailField('contract_notes', e.target.value)} className={inp} placeholder="계약 관련 특이사항" />
              </div>
            </div>

            {/* 간접자금 스크립트 */}
            {hasIndirect && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold text-amber-700">📜 간접자금 방문 안내 스크립트 ({indirectList.join(', ')})</p>
                  <button
                    type="button"
                    onClick={() => {
                      const script = d.indirect_script || INDIRECT_SCRIPT_TEMPLATE(
                        c.customers?.details?.company || c.customers?.name || '', c.customers?.name || '',
                        indirectList.join(', '), d.visit_date || '', d.visit_time || ''
                      )
                      navigator.clipboard?.writeText(script)
                    }}
                    className="text-xs text-amber-700 font-semibold px-2 py-0.5 rounded border border-amber-300 hover:bg-amber-100 transition-colors">
                    📋 복사
                  </button>
                </div>
                <textarea
                  value={d.indirect_script || INDIRECT_SCRIPT_TEMPLATE(
                    c.customers?.details?.company || c.customers?.name || '', c.customers?.name || '',
                    indirectList.join(', '), d.visit_date || '', d.visit_time || ''
                  )}
                  onChange={e => detailField('indirect_script', e.target.value)}
                  rows={6}
                  className="w-full text-xs bg-white border border-amber-200 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>
            )}
          </div>

          {/* 재무 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">재무</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-4 gap-x-2 gap-y-2">
              <div>
                <label className={lbl}>승인금액</label>
                <input type="text" value={d.approval_amount || ''} onChange={e => detailField('approval_amount', e.target.value)} className={inp} placeholder="0원" />
              </div>
              <div>
                <label className={lbl}>수수료%</label>
                <input type="text" value={d.fee_rate || ''} onChange={e => detailField('fee_rate', e.target.value)} className={inp} placeholder="%" />
              </div>
              <div>
                <label className={lbl}>수수료</label>
                <input type="text" value={d.fee_amount || ''} onChange={e => detailField('fee_amount', e.target.value)} className={inp} placeholder="0원" />
              </div>
              <div>
                <label className={lbl}>미입금액</label>
                <input type="text" value={d.unpaid_amount || ''} onChange={e => detailField('unpaid_amount', e.target.value)} className={inp} placeholder="0원" />
              </div>
              <div>
                <label className={lbl}>계약금(VAT포함)</label>
                <input type="text" value={d.contract_amount_vat || ''} onChange={e => detailField('contract_amount_vat', e.target.value)} className={inp} placeholder="0원" />
              </div>
              <div>
                <label className={lbl}>계약금(VAT제외)</label>
                <input type="text" value={d.contract_amount || ''} onChange={e => detailField('contract_amount', e.target.value)} className={inp} placeholder="0원" />
              </div>
              <div>
                <label className={lbl}>입금액(VAT포함)</label>
                <input type="text" value={d.deposit_amount_vat || ''} onChange={e => detailField('deposit_amount_vat', e.target.value)} className={inp} placeholder="0원" />
              </div>
              <div>
                <label className={lbl}>입금액(VAT제외)</label>
                <input type="text" value={d.deposit_amount || ''} onChange={e => detailField('deposit_amount', e.target.value)} className={inp} placeholder="0원" />
              </div>
              <div className="col-span-2">
                <label className={lbl}>소진공 확인서</label>
                <input type="text" value={d.sojin_confirmation || ''} onChange={e => detailField('sojin_confirmation', e.target.value)} className={inp} placeholder="소진공 확인서 내용" />
              </div>
              <div className="col-span-4">
                <label className={lbl}>결제방식</label>
                <div className="flex gap-2">
                  {[
                    { key: 'has_invoice', label: '계산서' },
                    { key: 'has_cash', label: '현금' },
                    { key: 'has_card', label: '카드' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => toggleDetail(opt.key)}
                      className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                        d[opt.key]
                          ? 'bg-violet-500 text-white border-violet-500'
                          : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 처리 메모 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">처리 메모</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <textarea
              value={local.progress_memo || ''}
              onChange={e => field('progress_memo', e.target.value)}
              rows={3}
              placeholder="진행 상황, 특이사항, 다음 액션 등"
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/50 bg-white resize-none"
            />
          </div>

          {/* 타임라인 */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">타임라인</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <TimelineSection initialTimeline={local.timeline || []} onSchedule={schedule} />
          </div>

          <p className="text-[10px] text-gray-300 text-right">
            마지막 수정: {new Date(c.updated_at).toLocaleString('ko-KR')}
          </p>
        </div>
      )}

      {/* ── 탭: 고객정보 ── */}
      {activeDetailTab === '고객정보' && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">고객 기본 정보</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-2 bg-gray-50 rounded-lg p-3">
            {[
              ['업체명', c.customers?.details?.company || c.customers?.name],
              ['대표자명', c.customers?.name],
              ['연락처', c.customers?.phone],
              ['지역', cd.region],
              ['업종', cd.business_type],
              ['업력', cd.years_in_business],
              ['직원수', cd.employee_count],
              ['기대출(정책)', cd.loan_policy],
              ['기대출(신용)', cd.loan_credit],
              ['매출2026', cd.revenue_2026],
              ['매출2025', cd.revenue_2025],
              ['매출2024', cd.revenue_2024],
              ['매출2023', cd.revenue_2023],
              ['신용점수', cd.credit_score],
              ['세금체납', cd.tax_delinquency],
              ['자산', cd.assets],
              ['필요자금', cd.required_funds],
            ].map(([label, val]) => (
              <div key={label as string}>
                <p className="text-[10px] text-gray-400">{label}</p>
                <p className="text-xs text-gray-700 font-medium">{val || '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 탭: 기관ID/PW ── */}
      {activeDetailTab === '기관ID/PW' && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">기관별 ID / PW</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          {CRED_INSTITUTIONS.map(inst => {
            const idKey = `cred_${inst}_id`
            const pwKey = `cred_${inst}_pw`
            const isPwVisible = pwVisible[inst] || false
            return (
              <div key={inst} className="bg-gray-50 rounded-lg p-3">
                <p className="text-[11px] font-bold text-gray-600 mb-2">{inst}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={lbl}>ID</label>
                    <input
                      type="text"
                      value={d[idKey] || ''}
                      onChange={e => detailField(idKey, e.target.value)}
                      className={inp}
                      placeholder={`${inst} 아이디`}
                    />
                  </div>
                  <div>
                    <label className={lbl}>PW</label>
                    <div className="relative">
                      <input
                        type={isPwVisible ? 'text' : 'password'}
                        value={d[pwKey] || ''}
                        onChange={e => detailField(pwKey, e.target.value)}
                        className={inp + ' pr-7'}
                        placeholder={`${inst} 비밀번호`}
                      />
                      <button
                        type="button"
                        onClick={() => setPwVisible(prev => ({ ...prev, [inst]: !isPwVisible }))}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[11px]"
                      >
                        {isPwVisible ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 탭: 인콜일지 ── */}
      {activeDetailTab === '인콜일지' && (
        <div className="space-y-4">
          {incallLoading ? (
            <div className="text-center py-8 text-gray-400 text-xs">불러오는 중...</div>
          ) : incallData ? (
            <>
              {/* 고객 details 읽기전용 그리드 */}
              {incallData.details && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">고객 상세정보</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 bg-gray-50 rounded-lg p-3">
                    {Object.entries(incallData.details as Record<string, any>).map(([key, val]) => (
                      <div key={key}>
                        <p className="text-[10px] text-gray-400">{key}</p>
                        <p className="text-xs text-gray-700 font-medium">{String(val || '—')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 메모(result_memo) */}
              {incallData.result_memo && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">메모</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap">
                    {incallData.result_memo}
                  </div>
                </div>
              )}

              {/* call_timeline 읽기전용 */}
              {incallData.call_timeline && incallData.call_timeline.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">콜 타임라인</span>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="space-y-1.5">
                    {[...incallData.call_timeline].reverse().map((entry: any, i: number) => {
                      const kst = formatKST(entry.created_at || entry.date || '')
                      const user = entry.user || entry.author || ''
                      const content = entry.content || entry.text || ''
                      const avatar = user ? user.slice(-2) : '기록'
                      return (
                        <div key={i} className="flex gap-2 items-start bg-gray-50 rounded-lg px-2 py-1.5">
                          <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                            {avatar}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold text-gray-600">{user || '—'}</span>
                              <span className="text-[10px] text-gray-300">{kst.date} {kst.time}</span>
                            </div>
                            <p className="text-xs text-gray-700 mt-0.5">{content}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-400 text-xs">인콜일지 데이터가 없습니다.</div>
          )}
        </div>
      )}

      {/* ── 탭: 입금/계약 ── */}
      {activeDetailTab === '💰 입금/계약' && (
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">입금 / 계약 정보</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <div>
              <label className={lbl}>승인금액</label>
              <input type="text" value={d.approval_amount || ''} onChange={e => detailField('approval_amount', e.target.value)} className={inp} placeholder="0원" />
            </div>
            <div>
              <label className={lbl}>수수료%</label>
              <input type="text" value={d.fee_rate || ''} onChange={e => detailField('fee_rate', e.target.value)} className={inp} placeholder="%" />
            </div>
            <div>
              <label className={lbl}>수수료</label>
              <input type="text" value={d.fee_amount || ''} onChange={e => detailField('fee_amount', e.target.value)} className={inp} placeholder="0원" />
            </div>
            <div>
              <label className={lbl}>미입금액</label>
              <input type="text" value={d.unpaid_amount || ''} onChange={e => detailField('unpaid_amount', e.target.value)} className={inp} placeholder="0원" />
            </div>
            <div>
              <label className={lbl}>계약금(VAT포함)</label>
              <input type="text" value={d.contract_amount_vat || ''} onChange={e => detailField('contract_amount_vat', e.target.value)} className={inp} placeholder="0원" />
            </div>
            <div>
              <label className={lbl}>계약금(VAT제외)</label>
              <input type="text" value={d.contract_amount || ''} onChange={e => detailField('contract_amount', e.target.value)} className={inp} placeholder="0원" />
            </div>
            <div>
              <label className={lbl}>입금액(VAT포함)</label>
              <input type="text" value={d.deposit_amount_vat || ''} onChange={e => detailField('deposit_amount_vat', e.target.value)} className={inp} placeholder="0원" />
            </div>
            <div>
              <label className={lbl}>입금액(VAT제외)</label>
              <input type="text" value={d.deposit_amount || ''} onChange={e => detailField('deposit_amount', e.target.value)} className={inp} placeholder="0원" />
            </div>
            <div className="col-span-2">
              <label className={lbl}>소진공 확인서</label>
              <input type="text" value={d.sojin_confirmation || ''} onChange={e => detailField('sojin_confirmation', e.target.value)} className={inp} placeholder="소진공 확인서 내용" />
            </div>
            <div>
              <label className={lbl}>계약 날짜</label>
              <input type="date" value={d.contract_date || ''} onChange={e => detailField('contract_date', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>계약 특이사항</label>
              <input type="text" value={d.contract_notes || ''} onChange={e => detailField('contract_notes', e.target.value)} className={inp} placeholder="계약 관련 특이사항" />
            </div>
          </div>
          <div>
            <label className={lbl}>결제방식</label>
            <div className="flex gap-2 mt-1">
              {[
                { key: 'has_invoice', label: '계산서' },
                { key: 'has_cash', label: '현금' },
                { key: 'has_card', label: '카드' },
              ].map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleDetail(opt.key)}
                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    d[opt.key]
                      ? 'bg-violet-500 text-white border-violet-500'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Timeline Section ────────────────────────────────────────────────────
function TimelineSection({ initialTimeline, onSchedule }: {
  initialTimeline: any[]
  onSchedule: (patch: Record<string, any>) => void
}) {
  const [tl, setTl] = useState<any[]>(initialTimeline || [])
  const [text, setText] = useState('')

  function add() {
    if (!text.trim()) return
    const entry = {
      user: '수동입력',
      content: text.trim(),
      created_at: nowKST(),
    }
    const updated = [...tl, entry]
    setTl(updated)
    onSchedule({ timeline: updated })
    setText('')
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="타임라인 내용 입력..."
          className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400/50" />
        <button onClick={add}
          className="text-xs bg-violet-500 text-white px-2 py-1 rounded hover:bg-violet-600">
          추가
        </button>
      </div>
      {tl.length === 0 ? (
        <p className="text-[10px] text-gray-300 text-center py-1">타임라인이 없습니다</p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {[...tl].reverse().map((entry: any, i: number) => {
            const isAuto = entry.user === '자동기록'
            const kst = formatKST(entry.created_at || entry.date || '')
            const user = entry.user || entry.author || ''
            const content = entry.content || entry.text || ''
            const avatar = user ? user.slice(-2) : '기록'
            return (
              <div key={i} className={`flex gap-2 items-start rounded-lg px-2 py-1.5 ${isAuto ? 'bg-violet-50' : 'bg-gray-50'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${isAuto ? 'bg-violet-400' : 'bg-gray-400'}`}>
                  {avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold ${isAuto ? 'text-violet-600' : 'text-gray-600'}`}>{user || '—'}</span>
                    <span className="text-[10px] text-gray-300">{kst.date} {kst.time}</span>
                  </div>
                  <p className="text-xs text-gray-700 mt-0.5">{content}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── OpsTableRow ────────────────────────────────────────────────────────
function OpsTableRow({
  c,
  isOpen,
  onToggle,
}: {
  c: OpsCase
  isOpen: boolean
  onToggle: (id: string) => void
}) {
  const stage = PIPELINE_STAGES.find(s => s.key === c.progress_stage) || PIPELINE_STAGES[0]

  return (
    <tr
      className={`hover:bg-gray-50/60 transition-colors cursor-pointer border-b border-gray-50 ${isOpen ? 'bg-violet-50/40' : ''}`}
      onClick={() => onToggle(c.id)}
    >
      {/* 업체명 */}
      <td className="px-3 py-2.5">
        <span className="font-semibold text-gray-800 text-xs truncate block max-w-[150px]">
          {c.customers?.details?.company || c.customers?.name}
        </span>
        <span className="text-[10px] text-gray-400">{c.customers?.name}</span>
      </td>
      {/* 지역 */}
      <td className="px-3 py-2.5 text-[11px] text-gray-500">
        {c.customers?.details?.region || '—'}
      </td>
      {/* 업종 */}
      <td className="px-3 py-2.5 text-[11px] text-gray-500 truncate max-w-[100px]">
        {c.customers?.details?.business_type || '—'}
      </td>
      {/* 기관 */}
      <td className="px-3 py-2.5 text-[11px] text-gray-600 truncate max-w-[120px]">
        {c.institution || '—'}
      </td>
      {/* 현재상태 */}
      <td className="px-3 py-2.5">
        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold text-white ${stage.color}`}>
          {stage.label}
        </span>
      </td>
      {/* 승인금액 */}
      <td className="px-3 py-2.5 text-[11px] text-gray-700 font-medium">
        {c.details?.approval_amount || '—'}
      </td>
      {/* 수수료% */}
      <td className="px-3 py-2.5 text-[11px] text-gray-500">
        {c.details?.fee_rate || '—'}
      </td>
      {/* 재통화/메모 */}
      <td className="px-3 py-2.5 text-[11px] text-gray-400 truncate max-w-[150px]">
        {c.details?.contract_date || (c.progress_memo ? c.progress_memo.slice(0, 30) + (c.progress_memo.length > 30 ? '…' : '') : '—')}
      </td>
      {/* 업데이트 */}
      <td className="px-3 py-2.5 text-[10px] text-gray-300 whitespace-nowrap">
        {new Date(c.updated_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
      </td>
      {/* 화살표 */}
      <td className="px-3 py-2.5 text-gray-300 text-sm w-6">
        {isOpen ? '◀' : '▶'}
      </td>
    </tr>
  )
}

// ── Main OpsDashboard ──────────────────────────────────────────────────
export default function OpsDashboard({ userId, userName }: Props) {
  const [activeTab, setActiveTab] = useState<'cases' | 'report'>('cases')
  const [menuOpen, setMenuOpen] = useState(false)
  const [cases, setCases] = useState<OpsCase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installable, setInstallable] = useState(false)
  const [openPanelIds, setOpenPanelIds] = useState<string[]>([])

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); setInstallable(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') { setInstallable(false); setInstallPrompt(null) }
  }

  async function loadCases() {
    setLoading(true)
    const res = await fetch('/api/ops-cases')
    const data = await res.json()
    setCases(data.cases || [])
    setLoading(false)
  }

  useEffect(() => { loadCases() }, [])

  function togglePanel(id: string) {
    setOpenPanelIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      const next = [...prev, id]
      return next.length > 2 ? next.slice(1) : next
    })
  }

  const handleSave = useCallback((id: string, patch: Record<string, any>) => {
    // Optimistic update
    setCases(prev => prev.map(c => {
      if (c.id !== id) return c
      const mergedDetails = patch.details
        ? { ...(c.details || {}), ...patch.details }
        : c.details
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

  const q = searchQuery.trim().toLowerCase()
  const filteredCases = q.length >= 1
    ? cases.filter(c =>
        c.customers?.details?.company || c.customers?.name?.toLowerCase().includes(q) ||
        c.customers?.name?.toLowerCase().includes(q) ||
        c.customers?.phone?.replace(/-/g, '').includes(q.replace(/-/g, '')) ||
        c.institution?.toLowerCase().includes(q)
      )
    : cases

  const [caseView, setCaseView] = useState<'active' | 'refund' | 'completed'>('active')

  const now = new Date()
  const months = [0, 1, 2].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    return {
      label: `${d.getMonth() + 1}월 승인`,
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    }
  })
  const monthlyApprovals = months.map(m => ({
    ...m,
    total: cases
      .filter(c => (c.details?.contract_date || c.created_at || '').startsWith(m.month))
      .reduce((sum, c) => {
        const amt = parseFloat((c.details?.approval_amount || '0').replace(/[^0-9.]/g, ''))
        return sum + (isNaN(amt) ? 0 : amt)
      }, 0),
  }))
  const completedCount = cases.filter(c => COMPLETED_STAGE_KEYS.has(c.progress_stage)).length
  const refundCount = cases.filter(c => REFUND_STAGE_KEYS.has(c.progress_stage) || c.is_refund).length
  const inProgressCount = cases.filter(c => ACTIVE_STAGE_KEYS.has(c.progress_stage)).length

  const viewCases = filteredCases.filter(c => {
    if (caseView === 'refund') return REFUND_STAGE_KEYS.has(c.progress_stage) || c.is_refund
    if (caseView === 'completed') return COMPLETED_STAGE_KEYS.has(c.progress_stage) || c.is_completed
    return ACTIVE_STAGE_KEYS.has(c.progress_stage) ||
      (!REFUND_STAGE_KEYS.has(c.progress_stage) && !COMPLETED_STAGE_KEYS.has(c.progress_stage) && !c.is_refund && !c.is_completed)
  })

  const groupedCases = PIPELINE_STAGES.map(stage => ({
    stage,
    items: viewCases.filter(c => c.progress_stage === stage.key),
  })).filter(g => g.items.length > 0)

  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      {/* Header */}
      <header className="bg-[#1B2A45] px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <Link href="/" className="relative h-8 w-24 shrink-0 block">
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain object-left brightness-0 invert" unoptimized />
        </Link>
        <span className="text-white/60 text-xs font-medium hidden md:block">
          {opsTabs.find(t => t.key === activeTab)?.label ?? '관리팀 대시보드'}
        </span>
        <div className="flex items-center gap-2 relative">
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
          <button
            onClick={() => setActiveTab('cases')}
            className="text-white/50 hover:text-white text-[10px] px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors whitespace-nowrap hidden md:block">
            🏠 홈
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
                <div className="px-4 py-3 border-b border-[#E8E2D4] mb-1">
                  <p className="text-[10px] text-[#C5A258] font-bold tracking-wide uppercase mb-0.5">자금팀</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#1B2A45]">{userName}</p>
                    <button
                      onClick={() => signOut({ callbackUrl: '/login' })}
                      className="text-[10px] text-gray-400 hover:text-red-500 transition-colors font-medium"
                    >로그아웃</button>
                  </div>
                  {installable && (
                    <button
                      onClick={() => { handleInstall(); setMenuOpen(false) }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs border border-[#1B2A45]/20 hover:border-[#C5A258]/60 text-[#1B2A45]/60 hover:text-[#C5A258] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      📲 앱 설치
                    </button>
                  )}
                </div>
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

      <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
        {/* Report tab */}
        {activeTab === 'report' && (
          <OpsReportTab userId={userId} userName={userName} />
        )}

        {/* Cases tab */}
        {activeTab === 'cases' && (
          <div className="space-y-5">
            {/* View selector */}
            <div className="flex gap-2">
              {[
                { key: 'active',    label: '진행업체',   count: inProgressCount },
                { key: 'refund',    label: '환불업체',   count: refundCount },
                { key: 'completed', label: '종료업체',   count: completedCount },
              ].map(m => (
                <button key={m.key} onClick={() => setCaseView(m.key as any)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
                    caseView === m.key
                      ? 'bg-[#1B2A45] text-white border-[#1B2A45]'
                      : 'bg-white text-gray-600 border-[#E8E2D4] hover:border-[#1B2A45]/30'
                  }`}>
                  {m.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    caseView === m.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>{m.count}</span>
                </button>
              ))}
            </div>
            {/* Stats bar */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { label: '담당케이스', value: cases.length + '건', color: 'text-[#C5A258]' },
                { label: '진행중', value: inProgressCount + '건', color: 'text-amber-600' },
                { label: '완료', value: completedCount + '건', color: 'text-emerald-600' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-[#E8E2D4] p-4 text-center">
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-[#1B2A45]/40 mt-0.5">{s.label}</p>
                </div>
              ))}
              {monthlyApprovals.map(m => (
                <div key={m.month} className="bg-white rounded-xl border border-[#E8E2D4] p-4 text-center">
                  <p className="text-xl font-black text-violet-600">{m.total > 0 ? (m.total / 10000).toFixed(0) + '만원' : '—'}</p>
                  <p className="text-xs text-[#1B2A45]/40 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-16 text-[#1B2A45]/40 text-sm">불러오는 중...</div>
            ) : groupedCases.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E8E2D4] p-14 text-center text-[#1B2A45]/40 text-sm">
                {cases.length === 0
                  ? '대표님이 배정한 케이스가 여기에 나타납니다.'
                  : '해당 단계의 케이스가 없습니다.'}
              </div>
            ) : (
              <div className="space-y-4">
                {groupedCases.map(({ stage, items }) => {
                  return (
                    <div key={stage.key} className={`rounded-xl border overflow-hidden ${stage.light}`}>
                      {/* Group header */}
                      <div className={`px-4 py-2.5 flex items-center gap-3 border-b ${stage.light}`}>
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${stage.color}`} />
                        <span className="font-bold text-sm text-gray-700">{stage.label}</span>
                        <span className="text-xs text-gray-400 font-medium">{items.length}건</span>
                      </div>
                      {/* Table */}
                      <div className="overflow-x-auto bg-white">
                        <table className="w-full text-xs min-w-[900px]">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="px-3 py-2 text-left text-gray-500 font-semibold">업체명</th>
                              <th className="px-3 py-2 text-left text-gray-500 font-semibold">지역</th>
                              <th className="px-3 py-2 text-left text-gray-500 font-semibold">업종</th>
                              <th className="px-3 py-2 text-left text-gray-500 font-semibold">기관</th>
                              <th className="px-3 py-2 text-left text-gray-500 font-semibold">현재상태</th>
                              <th className="px-3 py-2 text-left text-gray-500 font-semibold">승인금액</th>
                              <th className="px-3 py-2 text-left text-gray-500 font-semibold">수수료%</th>
                              <th className="px-3 py-2 text-left text-gray-500 font-semibold">재통화/메모</th>
                              <th className="px-3 py-2 text-left text-gray-500 font-semibold">수정일</th>
                              <th className="px-3 py-2 w-6"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {items.map(c => (
                              <OpsTableRow
                                key={c.id}
                                c={c}
                                isOpen={openPanelIds.includes(c.id)}
                                onToggle={togglePanel}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 슬라이드 드로어 패널 (최대 2개) ── */}
      {openPanelIds.map((id, panelIndex) => {
        const c = cases.find(x => x.id === id)
        if (!c) return null
        const isLast = panelIndex === openPanelIds.length - 1
        const rightOffset = panelIndex === 0 ? 'right-0 md:right-0' : 'right-0 md:right-[530px]'
        return (
          <div
            key={id}
            className="fixed inset-0 z-[100]"
            style={{ pointerEvents: isLast ? 'auto' : 'none' }}
          >
            {/* 백드롭 (마지막 드로어에만) */}
            {isLast && (
              <div
                className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
                onClick={() => togglePanel(id)}
              />
            )}
            {/* 드로어 패널 */}
            <div className={`absolute top-0 bottom-0 ${rightOffset} w-full md:w-[520px] bg-white shadow-2xl overflow-y-auto pointer-events-auto`}>
              {/* 헤더 */}
              <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between z-10">
                <div>
                  <p className="font-bold text-[#1B2A45] text-sm">{c.customers?.details?.company || c.customers?.name}</p>
                  <p className="text-[10px] text-gray-400">{c.customers?.name} · {c.customers?.phone}</p>
                </div>
                <button
                  onClick={() => togglePanel(id)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
                >
                  ✕
                </button>
              </div>
              {/* 상세 패널 */}
              <div className="p-4">
                <OpsDetailPanel c={c} onSave={handleSave} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 관리팀 보고 탭 ─────────────────────────────────────────────────────
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
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>❌ {submitError}</span>
          <button onClick={() => setSubmitError(null)} className="text-red-400 hover:text-red-600 ml-3 shrink-0">✕</button>
        </div>
      )}
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
