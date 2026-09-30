'use client'

import { useEffect, useState, FormEvent } from 'react'
import { COMPANY } from '@/lib/companyInfo'
import { LegalModal } from './LeadForm'
import type { LegalKey } from '@/lib/legalTexts'

// 스크롤하면 오른쪽에 나타나는 접이식 간편 상담 신청. 문의 섹션이 보이면 숨깁니다.
export default function FloatingInquiry() {
  const [scrolled, setScrolled] = useState(false)
  const [atForm, setAtForm] = useState(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const [legal, setLegal] = useState<LegalKey | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 320)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const el = document.getElementById('문의하기')
    if (!el) return
    const obs = new IntersectionObserver(([e]) => setAtForm(e.isIntersecting), { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (!agree) { setErr('개인정보 수집·이용에 동의해 주세요.'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, inquiryTypes: ['간편 상담(우측 폼)'], consent: { collect: true, third: true, marketing: false } }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || '전송 실패') }
      setDone(true)
    } catch (e: any) { setErr(e.message || '전송 중 오류가 발생했습니다.') }
    setBusy(false)
  }

  const show = scrolled && !atForm
  return (
    <>
      <div className={`fixed right-3 bottom-5 z-40 flex flex-col items-end gap-2 transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        {open ? (
          <div className="relative w-64 bg-white rounded-2xl shadow-2xl border border-[#E8E2D4] p-3.5">
            <button onClick={() => setOpen(false)} aria-label="닫기"
              className="absolute -top-3 -right-1 w-7 h-7 rounded-full bg-white border border-[#E8E2D4] shadow text-sm text-[#1B2A45]/60">×</button>
            {done ? (
              <div className="py-6 text-center">
                <p className="text-sm font-black text-[#1B2A45]">접수되었습니다</p>
                <p className="text-[11px] text-[#1B2A45]/50 mt-1.5 leading-relaxed">담당 컨설턴트가 순차적으로<br />연락드리겠습니다.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-2">
                <p className="text-center text-xs font-bold bg-[#FAF8F3] rounded-lg py-2 text-[#1B2A45]">상담신청</p>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="이름을 입력하세요"
                  className="w-full border border-[#E8E2D4] focus:border-[#C5A258] rounded-lg px-2.5 py-2 text-xs outline-none" />
                <input value={phone} onChange={e => setPhone(e.target.value)} required type="tel" placeholder="연락처(숫자만 입력)"
                  className="w-full border border-[#E8E2D4] focus:border-[#C5A258] rounded-lg px-2.5 py-2 text-xs outline-none" />
                <label className="flex items-start gap-1.5 text-[10px] text-[#1B2A45]/60 leading-snug cursor-pointer">
                  <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5 accent-[#C5A258]" />
                  <span>개인정보 수집·이용 및 제3자 제공에 동의합니다.{' '}
                    <button type="button" onClick={() => setLegal('collect')} className="underline">수집·이용</button>{' '}
                    <button type="button" onClick={() => setLegal('third')} className="underline">제3자 제공</button></span>
                </label>
                {err && <p className="text-[10px] text-red-500">{err}</p>}
                <button type="submit" disabled={busy || !agree}
                  className="w-full bg-[#0f1a2e] hover:bg-[#1B2A45] disabled:opacity-40 text-white text-xs font-bold py-2.5 rounded-lg">
                  {busy ? '전송 중...' : '신청하기'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            <a href={COMPANY.phoneHref} aria-label="전화 상담"
              className="w-10 h-10 rounded-full bg-white border border-[#E8E2D4] shadow-lg flex items-center justify-center text-base hover:scale-105 transition-transform">📞</a>
            <button onClick={() => { setDone(false); setOpen(true) }}
              className="flex items-center gap-1.5 bg-[#C5A258] hover:bg-[#D4B568] text-white text-xs font-bold pl-3 pr-3.5 py-2.5 rounded-full shadow-lg transition-colors">
              <span className="text-sm">✉</span>문의 남기기
            </button>
          </>
        )}
      </div>
      <LegalModal kind={legal} onClose={() => setLegal(null)} />
    </>
  )
}
