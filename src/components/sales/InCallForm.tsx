'use client'

import { useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────
export interface InCallData {
  name: string
  phone: string
  company: string
  corp_type: string
  region: string
  business_reg_no: string
  assignee: string
  reception_date: string
  business_type: string
  years_in_business: string
  employee_count: string
  loan_policy: string
  loan_kibo: string
  loan_credit: string
  revenue_2026: string
  revenue_2025: string
  revenue_2024: string
  revenue_2023: string
  credit_score: string
  tax_delinquency: string
  assets: string
  required_funds: string
  sensitivity: '' | '상' | '중' | '하'
  notes: string
}

export function emptyInCallData(): InCallData {
  return {
    name: '', phone: '', company: '', corp_type: '', region: '',
    business_reg_no: '', assignee: '', reception_date: new Date().toISOString().slice(0, 10),
    business_type: '', years_in_business: '', employee_count: '',
    loan_policy: '', loan_kibo: '', loan_credit: '',
    revenue_2026: '', revenue_2025: '', revenue_2024: '', revenue_2023: '',
    credit_score: '', tax_delinquency: '', assets: '', required_funds: '',
    sensitivity: '', notes: '',
  }
}

interface Props {
  title: string
  salesUsers: string[]
  submitting: boolean
  initialData?: Partial<InCallData>
  submitLabel?: string
  onSubmit: (data: InCallData) => Promise<void>
  onCancel: () => void
}

const inp = 'w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/50 bg-white'
const lbl = 'text-[10px] text-gray-400 mb-0.5 block font-medium'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-4 flex items-center gap-1.5 pt-1">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{children}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

export default function InCallForm({ title, salesUsers, submitting, initialData, submitLabel, onSubmit, onCancel }: Props) {
  const [d, setD] = useState<InCallData>(() =>
    initialData ? { ...emptyInCallData(), ...initialData } : emptyInCallData()
  )

  function f<K extends keyof InCallData>(key: K, val: InCallData[K]) {
    setD(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSubmit(d)
    setD(emptyInCallData())
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-sky-700 px-4 py-2.5 flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">{title}</h3>
        <button type="button" onClick={onCancel} className="text-white/50 hover:text-white text-base leading-none">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="p-3">
        <div className="grid grid-cols-4 gap-x-2 gap-y-2">

          {/* ── 기본 정보 ── */}
          <SectionTitle>기본 정보</SectionTitle>

          {/* 접수일자 · 담당자 · 상호명 */}
          <div>
            <label className={lbl}>접수일자</label>
            <input type="date" value={d.reception_date} onChange={e => f('reception_date', e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>담당자</label>
            <select value={d.assignee} onChange={e => f('assignee', e.target.value)} className={inp}>
              <option value="">-- 선택 --</option>
              {salesUsers.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={lbl}>상호명 *</label>
            <input type="text" value={d.company} onChange={e => f('company', e.target.value)}
              className={inp} placeholder="ABC주식회사" />
          </div>

          {/* 고객명 · 연락처 · 지역 · 사업자번호 */}
          <div>
            <label className={lbl}>고객명(대표자) *</label>
            <input type="text" value={d.name} onChange={e => f('name', e.target.value)} required
              className={inp} placeholder="홍길동" />
          </div>
          <div>
            <label className={lbl}>연락처 *</label>
            <input type="tel" value={d.phone} onChange={e => f('phone', e.target.value)} required
              className={inp} placeholder="010-0000-0000" />
          </div>
          <div>
            <label className={lbl}>지역</label>
            <input type="text" value={d.region} onChange={e => f('region', e.target.value)}
              className={inp} placeholder="서울 강남" />
          </div>
          <div>
            <label className={lbl}>사업자번호</label>
            <input type="text" value={d.business_reg_no} onChange={e => f('business_reg_no', e.target.value)}
              className={inp} placeholder="000-00-00000" />
          </div>

          {/* ── 사업 정보 ── */}
          <SectionTitle>사업 정보</SectionTitle>

          {/* 법인/개인 · 업종 · 업력 · 직원수 */}
          <div>
            <label className={lbl}>법인 / 개인</label>
            <div className="flex gap-1">
              {(['법인', '개인'] as const).map(opt => (
                <button key={opt} type="button"
                  onClick={() => f('corp_type', d.corp_type === opt ? '' : opt)}
                  className={`flex-1 py-1 rounded text-xs font-medium border transition-colors ${
                    d.corp_type === opt ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={lbl}>업종</label>
            <input type="text" value={d.business_type} onChange={e => f('business_type', e.target.value)}
              className={inp} placeholder="음식업, 제조업" />
          </div>
          <div>
            <label className={lbl}>업력</label>
            <input type="text" value={d.years_in_business} onChange={e => f('years_in_business', e.target.value)}
              className={inp} placeholder="3년" />
          </div>
          <div>
            <label className={lbl}>직원수</label>
            <input type="text" value={d.employee_count} onChange={e => f('employee_count', e.target.value)}
              className={inp} placeholder="5명" />
          </div>

          {/* 기대출 정책 · 기대출 신용/담보 */}
          <div className="col-span-2">
            <label className={lbl}>기대출 (정책자금)</label>
            <input type="text" value={d.loan_kibo || d.loan_policy || ''} onChange={e => f('loan_kibo', e.target.value)}
              className={inp} placeholder="소진공 5천" />
          </div>
          <div className="col-span-2">
            <label className={lbl}>기대출 (신용/담보)</label>
            <input type="text" value={d.loan_credit} onChange={e => f('loan_credit', e.target.value)}
              className={inp} placeholder="국민은행 1억, 기업은행 5천" />
          </div>

          {/* ── 재무 정보 ── */}
          <SectionTitle>재무 정보</SectionTitle>

          {/* 매출 4개 한 줄 */}
          <div>
            <label className={lbl}>26년 매출</label>
            <input type="text" value={d.revenue_2026} onChange={e => f('revenue_2026', e.target.value)}
              className={inp} placeholder="0원" />
          </div>
          <div>
            <label className={lbl}>25년 매출</label>
            <input type="text" value={d.revenue_2025} onChange={e => f('revenue_2025', e.target.value)}
              className={inp} placeholder="0원" />
          </div>
          <div>
            <label className={lbl}>24년 매출</label>
            <input type="text" value={d.revenue_2024} onChange={e => f('revenue_2024', e.target.value)}
              className={inp} placeholder="0원" />
          </div>
          <div>
            <label className={lbl}>23년 매출</label>
            <input type="text" value={d.revenue_2023} onChange={e => f('revenue_2023', e.target.value)}
              className={inp} placeholder="0원" />
          </div>

          {/* 신용·세금·자산·필요자금 한 줄 */}
          <div>
            <label className={lbl}>신용점수</label>
            <input type="text" value={d.credit_score} onChange={e => f('credit_score', e.target.value)}
              className={inp} placeholder="700" />
          </div>
          <div>
            <label className={lbl}>세금체납</label>
            <input type="text" value={d.tax_delinquency} onChange={e => f('tax_delinquency', e.target.value)}
              className={inp} placeholder="없음" />
          </div>
          <div>
            <label className={lbl}>자산</label>
            <input type="text" value={d.assets} onChange={e => f('assets', e.target.value)}
              className={inp} placeholder="부동산 2억" />
          </div>
          <div>
            <label className={lbl}>필요자금</label>
            <input type="text" value={d.required_funds} onChange={e => f('required_funds', e.target.value)}
              className={inp} placeholder="5천만원" />
          </div>

          {/* ── 상담 메모 ── */}
          <SectionTitle>상담 메모</SectionTitle>

          {/* 감도 버튼 + 메모 옆으로 나란히 */}
          <div>
            <label className={lbl}>감도</label>
            <div className="flex gap-1">
              {(['상', '중', '하'] as const).map(opt => (
                <button key={opt} type="button"
                  onClick={() => f('sensitivity', d.sensitivity === opt ? '' : opt)}
                  className={`flex-1 py-1 rounded text-xs font-bold border transition-colors ${
                    d.sensitivity === opt
                      ? opt === '상' ? 'bg-emerald-500 text-white border-emerald-500'
                        : opt === '중' ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-red-400 text-white border-red-400'
                      : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-3">
            <label className={lbl}>통화 메모</label>
            <textarea value={d.notes} onChange={e => f('notes', e.target.value)}
              rows={2} placeholder="인콜 내용, 반응, 특이사항 등..."
              className={`${inp} resize-none`} />
          </div>

        </div>

        {/* 버튼 */}
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button type="submit" disabled={submitting}
            className="flex-1 py-2 rounded-lg bg-[#1B2A45] hover:bg-[#253B5E] disabled:opacity-50 text-white text-xs font-semibold transition-colors">
            {submitting ? '등록 중...' : (submitLabel ?? '✓ 등록')}
          </button>
        </div>
      </form>
    </div>
  )
}
