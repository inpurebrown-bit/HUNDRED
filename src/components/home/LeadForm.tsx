'use client'

import { useState, ChangeEvent, FormEvent } from 'react'
import { COMPANY } from '@/lib/companyInfo'
import { LEGAL_TEXTS, LEGAL_TITLES, LegalKey } from '@/lib/legalTexts'

const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
const INQUIRY_TYPES = ['정책자금', '정부지원사업', '기업인증(벤처·이노비즈·메인비즈)', '연구소·특허', '법인설립·전환', '광고·마케팅', '자영업 컨설팅', '기타']
const inputCls = 'w-full bg-white border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-3 py-2.5 text-sm text-[#1B2A45] placeholder-[#1B2A45]/25 outline-none transition-colors'

export function LegalModal({ kind, onClose }: { kind: LegalKey | null; onClose: () => void }) {
  if (!kind) return null
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E2D4]">
          <h3 className="text-sm font-bold text-[#1B2A45]">{LEGAL_TITLES[kind]}</h3>
          <button type="button" onClick={onClose} className="text-[#1B2A45]/40 hover:text-[#1B2A45] text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-4 overflow-y-auto text-xs leading-relaxed text-[#1B2A45]/75 whitespace-pre-wrap">{LEGAL_TEXTS[kind]}</div>
        <div className="px-5 py-3 border-t border-[#E8E2D4] text-right">
          <button type="button" onClick={onClose} className="bg-[#1B2A45] text-white text-xs font-bold px-5 py-2 rounded-lg">확인</button>
        </div>
      </div>
    </div>
  )
}

export default function LeadForm() {
  const [f, setF] = useState({ name: '', region: '', phone: '', company: '', message: '', taxStatus: '없음', website: '' })
  const [types, setTypes] = useState<string[]>([])
  const [agree, setAgree] = useState({ collect: false, third: false, marketing: false })
  const [modal, setModal] = useState<LegalKey | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const allChecked = agree.collect && agree.third && agree.marketing
  const canSubmit = agree.collect && agree.third && !submitting

  function toggleAll(v: boolean) { setAgree({ collect: v, third: v, marketing: v }) }
  function setField<K extends keyof typeof f>(k: K, v: string) { setF(p => ({ ...p, [k]: v })) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!agree.collect || !agree.third) { setError('필수 약관에 동의해 주세요.'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, inquiryTypes: types, consent: { collect: agree.collect, third: agree.third, marketing: agree.marketing } }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || `서버 오류 (${res.status})`)
      }
      setSubmitted(true)
    } catch (err: any) {
      setError(`전송 중 오류가 발생했습니다. 전화(${COMPANY.phone})로 문의해 주세요. (${err.message})`)
    }
    setSubmitting(false)
  }

  if (submitted) {
    return (
      <div className="bg-[#FAF8F3] border border-[#C5A258]/30 rounded-2xl p-8 text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-[#C5A258]/10 flex items-center justify-center mx-auto text-3xl">🤝</div>
        <div>
          <p className="text-xs font-bold text-[#C5A258] tracking-widest uppercase mb-2">신청 접수 완료</p>
          <h3 className="text-xl font-black text-[#1B2A45] leading-snug">상담 신청이 접수되었습니다.</h3>
        </div>
        <div className="bg-white rounded-xl px-5 py-4 text-left border border-[#E8E2D4]">
          <p className="text-sm text-[#1B2A45]/75 leading-relaxed">
            남겨주신 연락처로 담당 컨설턴트가 <span className="font-bold text-[#1B2A45]">영업일 기준 순차적으로</span> 연락드립니다.
          </p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-left text-xs text-red-600 leading-relaxed">
          ⚠️ 정부·공공기관을 사칭하거나 승인을 보장한다며 선입금을 요구하는 연락에 주의하세요. 당사는 정부·공공기관이 아닌 민간 경영컨설팅 업체입니다.
        </div>
        <p className="text-xs text-[#1B2A45]/40">급하신 분은 <a href={COMPANY.phoneHref} className="font-bold text-[#C5A258]">📞 {COMPANY.phone}</a></p>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={submit} className="bg-[#FAF8F3] border border-[#E8E2D4] rounded-2xl p-6 space-y-4">
        {/* 봇 방지 함정 필드 */}
        <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={e => setField('website', e.target.value)}
          className="hidden" aria-hidden="true" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#1B2A45]/50 mb-1.5 font-medium">이름 *</label>
            <input type="text" required value={f.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('name', e.target.value)} className={inputCls} placeholder="홍길동" />
          </div>
          <div>
            <label className="block text-xs text-[#1B2A45]/50 mb-1.5 font-medium">지역</label>
            <select value={f.region} onChange={(e: ChangeEvent<HTMLSelectElement>) => setField('region', e.target.value)} className={inputCls}>
              <option value="">선택</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#1B2A45]/50 mb-1.5 font-medium">연락처 *</label>
            <input type="tel" required value={f.phone} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('phone', e.target.value)} className={inputCls} placeholder="010-0000-0000" />
          </div>
          <div>
            <label className="block text-xs text-[#1B2A45]/50 mb-1.5 font-medium">회사명</label>
            <input type="text" value={f.company} onChange={(e: ChangeEvent<HTMLInputElement>) => setField('company', e.target.value)} className={inputCls} placeholder="(주)홍길동상사" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-[#1B2A45]/50 mb-2 font-medium">문의 유형 (복수 선택 가능)</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {INQUIRY_TYPES.map(t => {
              const on = types.includes(t)
              return (
                <label key={t} className={`flex items-center gap-2 border rounded-lg px-2.5 py-2 cursor-pointer transition-all text-xs ${on ? 'border-[#C5A258] bg-[#C5A258]/10 text-[#C5A258] font-semibold' : 'border-[#E8E2D4] text-[#1B2A45]/60 hover:border-[#C5A258]/40 bg-white'}`}>
                  <input type="checkbox" checked={on} onChange={() => setTypes(p => on ? p.filter(x => x !== t) : [...p, t])} className="hidden" />
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'border-[#C5A258] bg-[#C5A258]' : 'border-current'}`}>
                    {on && <span className="text-white text-[8px]">✓</span>}
                  </span>
                  <span className="leading-tight">{t}</span>
                </label>
              )
            })}
          </div>
        </div>
        <div>
          <label className="block text-xs text-[#1B2A45]/50 mb-2 font-medium">세금체납 여부</label>
          <div className="flex flex-wrap gap-4">
            {['없음', '있음(납부예정)', '있음(현재체납)'].map(opt => (
              <label key={opt} className={`flex items-center gap-2 cursor-pointer text-sm ${f.taxStatus === opt ? 'text-[#C5A258] font-semibold' : 'text-[#1B2A45]/60'}`}>
                <input type="radio" name="taxStatus" value={opt} checked={f.taxStatus === opt} onChange={() => setField('taxStatus', opt)} className="accent-[#C5A258]" />
                {opt}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-[#1B2A45]/50 mb-1.5 font-medium">문의 내용</label>
          <textarea rows={3} value={f.message} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setField('message', e.target.value)}
            className={inputCls + ' resize-none'} placeholder="현재 사업 상황과 필요하신 지원을 간단히 적어주세요." />
        </div>

        {/* 약관 동의 */}
        <div className="bg-white border border-[#E8E2D4] rounded-xl p-3.5 space-y-2.5">
          <label className="flex items-center gap-2 cursor-pointer pb-2 border-b border-[#E8E2D4]">
            <input type="checkbox" checked={allChecked} onChange={e => toggleAll(e.target.checked)} className="accent-[#C5A258] w-4 h-4" />
            <span className="text-sm font-bold text-[#1B2A45]">전체 동의</span>
          </label>
          {([
            ['collect', '[필수] 개인정보 수집·이용 동의'],
            ['third', '[필수] 개인정보 제3자 제공 동의'],
            ['marketing', '[선택] 마케팅·광고성 정보 수신 동의'],
          ] as [keyof typeof agree, string][]).map(([k, label]) => (
            <div key={k} className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[#1B2A45]/75">
                <input type="checkbox" checked={agree[k]} onChange={e => setAgree(p => ({ ...p, [k]: e.target.checked }))} className="accent-[#C5A258] w-4 h-4" />
                {label}
              </label>
              <button type="button" onClick={() => setModal(k)} className="text-[11px] text-[#1B2A45]/45 underline hover:text-[#C5A258] shrink-0">보기</button>
            </div>
          ))}
          <p className="text-[10px] text-[#1B2A45]/40 leading-relaxed pt-1">
            동의를 거부할 수 있으며, 필수 항목 미동의 시 상담 신청이 제한됩니다. 자세한 내용은{' '}
            <button type="button" onClick={() => setModal('privacy')} className="underline">개인정보 처리방침</button>을 확인하세요.
          </p>
        </div>

        {error && <p className="text-xs text-red-500 leading-relaxed">{error}</p>}
        <button type="submit" disabled={!canSubmit}
          className="w-full bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl text-sm transition-all">
          {submitting ? '전송 중...' : '상담 신청하기 →'}
        </button>
      </form>
      <LegalModal kind={modal} onClose={() => setModal(null)} />
    </>
  )
}
