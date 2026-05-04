'use client'

import { useState } from 'react'

// ── Types ──────────────────────────────────────────────────────────────
export interface InCallData {
  // 기본
  name: string
  phone: string
  company: string
  corp_type: string
  region: string
  business_reg_no: string
  assignee: string
  reception_date: string
  // 사업
  business_type: string
  years_in_business: string
  employee_count: string
  loan_policy: string
  loan_credit: string
  // 재무
  revenue_2026: string
  revenue_2025: string
  revenue_2024: string
  revenue_2023: string
  credit_score: string
  tax_delinquency: string
  assets: string
  required_funds: string
  // 상담
  sensitivity: '' | '상' | '중' | '하'
  notes: string
}

export function emptyInCallData(): InCallData {
  return {
    name: '', phone: '', company: '', corp_type: '', region: '',
    business_reg_no: '', assignee: '', reception_date: new Date().toISOString().slice(0, 10),
    business_type: '', years_in_business: '', employee_count: '',
    loan_policy: '', loan_credit: '',
    revenue_2026: '', revenue_2025: '', revenue_2024: '', revenue_2023: '',
    credit_score: '', tax_delinquency: '', assets: '', required_funds: '',
    sensitivity: '', notes: '',
  }
}

interface Props {
  title: string
  salesUsers: string[]
  submitting: boolean
  onSubmit: (data: InCallData) => Promise<void>
  onCancel: () => void
}

const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50'
const lbl = 'text-xs text-gray-400 mb-0.5 block'
const sec = 'text-xs font-bold text-gray-500 mb-3 mt-1 flex items-center gap-1.5'

export default function InCallForm({ title, salesUsers, submitting, onSubmit, onCancel }: Props) {
  const [d, setD] = useState<InCallData>(emptyInCallData())

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
      <div className="bg-[#1B2A45] px-5 py-3 flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">📋 {title}</h3>
        <button type="button" onClick={onCancel} className="text-white/50 hover:text-white text-lg leading-none">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">

        {/* ── 기본 정보 ── */}
        <section>
          <p className={sec}>📋 기본 정보</p>
          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <label className={lbl}>상호명 *</label>
              <input type="text" value={d.company} onChange={e => f('company', e.target.value)}
                className={inp} placeholder="ABC주식회사" />
            </div>
            <div>
              <label className={lbl}>법인 / 개인</label>
              <div className="flex gap-2">
                {(['법인', '개인'] as const).map(opt => (
                  <button key={opt} type="button"
                    onClick={() => f('corp_type', d.corp_type === opt ? '' : opt)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      d.corp_type === opt ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
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
              <label className={lbl}>사업자등록번호</label>
              <input type="text" value={d.business_reg_no} onChange={e => f('business_reg_no', e.target.value)}
                className={inp} placeholder="000-00-00000" />
            </div>
          </div>
        </section>

        {/* ── 사업 정보 ── */}
        <section>
          <p className={sec}>🏢 사업 정보</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>업종</label>
              <input type="text" value={d.business_type} onChange={e => f('business_type', e.target.value)}
                className={inp} placeholder="음식업, 제조업 등" />
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
            <div>
              <label className={lbl}>기대출 (정책자금)</label>
              <input type="text" value={d.loan_policy} onChange={e => f('loan_policy', e.target.value)}
                className={inp} placeholder="소진공 5천" />
            </div>
            <div className="col-span-2">
              <label className={lbl}>기대출 (신용/담보)</label>
              <input type="text" value={d.loan_credit} onChange={e => f('loan_credit', e.target.value)}
                className={inp} placeholder="국민은행 1억, 기업은행 5천" />
            </div>
          </div>
        </section>

        {/* ── 재무 정보 ── */}
        <section>
          <p className={sec}>💰 재무 정보</p>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
        </section>

        {/* ── 상담 메모 ── */}
        <section>
          <p className={sec}>💬 상담 메모</p>
          <div className="space-y-3">
            <div>
              <label className={lbl}>감도</label>
              <div className="flex gap-2">
                {(['상', '중', '하'] as const).map(opt => (
                  <button key={opt} type="button"
                    onClick={() => f('sensitivity', d.sensitivity === opt ? '' : opt)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                      d.sensitivity === opt
                        ? opt === '상' ? 'bg-emerald-500 text-white border-emerald-500'
                          : opt === '중' ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-red-400 text-white border-red-400'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>통화 메모</label>
              <textarea value={d.notes} onChange={e => f('notes', e.target.value)}
                rows={3} placeholder="인콜 내용, 반응, 특이사항 등..."
                className={`${inp} resize-none`} />
            </div>
          </div>
        </section>

        {/* 버튼 */}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors">
            취소
          </button>
          <button type="submit" disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-[#1B2A45] hover:bg-[#253B5E] disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {submitting ? '등록 중...' : '✓ 등록'}
          </button>
        </div>
      </form>
    </div>
  )
}
