'use client'

import { useState, useEffect, useRef, ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import FloatingInquiry from '@/components/home/FloatingInquiry'
import HeroSlider from '@/components/home/HeroSlider'
import IntroVideo from '@/components/home/IntroVideo'
import LeadForm, { LegalModal } from '@/components/home/LeadForm'
import { COMPANY } from '@/lib/companyInfo'
import type { LegalKey } from '@/lib/legalTexts'

// ─── 스크롤 등장 효과 ───────────────────────────────────
function Reveal({ children, from = 'bottom', delay = 0, className = '' }: {
  children: ReactNode; from?: 'left' | 'right' | 'bottom'; delay?: number; className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.08 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const t = from === 'left' ? (visible ? 'translate-x-0 opacity-100' : '-translate-x-12 opacity-0')
    : from === 'right' ? (visible ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0')
    : (visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0')
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${t} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

// ─── 콘텐츠 ─────────────────────────────────────────────
const CORE_SERVICES = [
  {
    icon: '01', title: '정책자금 컨설팅', tag: 'POLICY FUNDING',
    lead: '재무·기술성 진단을 바탕으로 기업에 맞는 자금 전략을 설계합니다.',
    points: ['소진공·중진공·신보·기보·지역신용보증재단 요건 검토', '업력·업종·매출·기대출 기준의 자금 적합도 분석', '신청 서류 준비 및 절차 자문'],
  },
  {
    icon: '02', title: '정부지원사업', tag: 'GOVERNMENT PROGRAMS',
    lead: '성장 단계에 맞는 지원사업을 찾고 준비 방향을 함께 정리합니다.',
    points: ['창업·R&D·수출·고용 등 지원사업 탐색', '사업계획서 작성 방향 자문', '공고 일정에 맞춘 준비 로드맵'],
  },
  {
    icon: '03', title: '기업인증', tag: 'CERTIFICATION',
    lead: '인증 취득으로 금융·세제·거래 신뢰도를 높이는 방법을 안내합니다.',
    points: ['벤처기업확인 · 이노비즈 · 메인비즈', '기업부설연구소 · 특허 등 기술 자산 정리', '인증 요건 사전 진단'],
  },
]

const EXTRA_SERVICES = [
  { icon: '+', title: '법인 설립·전환', desc: '매출·이익 규모와 성장 계획에 맞춘 개인사업자 ↔ 법인 구조 검토' },
  { icon: '+', title: '광고·마케팅', desc: '메타·네이버·유튜브 등 채널별 마케팅 전략 수립' },
  { icon: '+', title: '자영업 컨설팅', desc: '매출·비용 구조 점검과 경영 개선 방향 제안' },
]

const STAGES = [
  { n: '01', title: '예비 · 창업 초기', color: '#4A9B6F', items: ['사업계획 정리와 창업 지원사업 탐색', '초기 자금·보증 상품 검토', '사업자 구조(개인/법인) 설계'] },
  { n: '02', title: '초기 창업기업', color: '#3B82C4', items: ['운전·시설자금 전략', '기술개발(R&D) 연계 및 인증 준비', '재무제표·신용 관리 점검'] },
  { n: '03', title: '도약기업', color: '#C5A258', items: ['스케일업 자금 및 투자 연계 검토', '수출·해외 진출 지원사업 탐색', '법인 전환·조직 체계 고도화'] },
  { n: '04', title: '재창업 · 특수', color: '#7B5EA7', items: ['재도전 프로그램과 채무조정 이후 자금 재설계', '신용 회복 단계별 전략', '사업 재편·전환 방향 자문'] },
]

const PROCESS = [
  { n: '1', t: '상담 접수', d: '온라인 신청 또는 전화로 사업 현황과 필요 사항을 확인합니다.' },
  { n: '2', t: '기업 진단', d: '업력·업종·매출·기대출·신용·세금 상태를 종합해 진단합니다.' },
  { n: '3', t: '맞춤 컨설팅 보고서', d: '재무 분석, 자금·인증 전략, 12개월 진행 계획을 보고서로 안내합니다.' },
  { n: '4', t: '요건 검토·서류 준비', d: '각 기관 최신 공고 기준으로 요건과 제출 서류를 점검합니다.' },
  { n: '5', t: '신청 지원', d: '고객 본인 명의의 정확한 자료로 신청 절차를 자문합니다.' },
  { n: '6', t: '후속 컨설팅 제안', d: '인증·법인 전환·마케팅 등 다음 단계를 협의 후 제안합니다.' },
]

const CEO_BIO = [
  { p: '學', t: '자산경영학 전공' },
  { p: '前', t: '법무법인 혜안 소속' },
  { p: '前', t: 'PUREBROWN 대표이사' },
  { p: '前', t: '㈜나라감정평가법인 소속' },
  { p: '前', t: 'GIGGLY 대표이사' },
  { p: '現', t: '세계탐정연맹본부(WDF) 전문위원' },
  { p: '現', t: 'HUNDRED consulting 대표' },
]

// 업종별 상담 카드. quote(고객 후기)와 client(고객 표기)는 실제 고객이 공개에 동의한 내용만 채워 주세요.
// quote가 있으면 카드 하단에 후기가 표시되고, 없으면 주요 상담 분야가 표시됩니다.
const CASES: { photo: string; industry: string; title: string; desc: string; chips: string[]; pos?: string; quote?: string; client?: string }[] = [
  { photo: '/images/consulting/construction.png', industry: '건설업', title: '건설업 컨설팅', desc: '공사 대금 회수 주기와 운전자금, 보증서 발급 요건을 함께 점검합니다.', chips: ['운전자금', '보증', '시설자금'] },
  { photo: '/images/consulting/restaurant.jpg', industry: '요식업', title: '요식업 컨설팅', desc: '매출과 임대료 구조를 살펴 소상공인 자금과 지원 프로그램을 검토합니다.', chips: ['소상공인 자금', '지원사업', '신용관리'] },
  { photo: '/images/consulting/interior.jpg', industry: '인테리어', title: '인테리어업 컨설팅', desc: '프로젝트 단위 현금흐름에 맞는 운전자금과 보증 상품을 검토합니다.', chips: ['운전자금', '보증', '법인전환'], pos: 'center 58%' },
  { photo: '/images/consulting/factory.jpg', industry: '제조업', title: '제조업 컨설팅', desc: '설비 투자 계획에 맞는 시설·운전자금과 기술 인증 방향을 상담합니다.', chips: ['시설자금', '기술인증', '연구소'] },
  { photo: '/images/consulting/retail.jpg', industry: '소매업', title: '소매·유통업 컨설팅', desc: '재고와 매출 흐름을 기준으로 자금 운용과 지원사업을 안내합니다.', chips: ['운전자금', '지원사업', '마케팅'] },
  { photo: '/images/consulting/startup.jpg', industry: '스타트업', title: '스타트업 컨설팅', desc: '업력과 기술성에 맞춰 벤처·이노비즈 인증과 자금 연계를 검토합니다.', chips: ['벤처인증', '이노비즈', 'R&D'], pos: 'center 38%' },
]

const LECTURE_TOPICS = ['정책자금 실전 활용', '소상공인 자금조달', '법인전환 전략', '정부지원사업 공략법', '사업계획서 작성법', '기업 신용관리']

const NAV = [
  { label: '서비스', href: '#서비스' },
  { label: '성장단계', href: '#성장단계' },
  { label: '업종사례', href: '#업종사례' },
  { label: '진행절차', href: '#진행절차' },
  { label: '대표소개', href: '#대표소개' },
  { label: '강의', href: '#강의' },
  { label: '문의하기', href: '#문의하기' },
]

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [legal, setLegal] = useState<LegalKey | null>(null)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  const infoRows: [string, string][] = ([
    ['상호', COMPANY.legalName || COMPANY.brandKo],
    ['대표자', COMPANY.ceo],
    ['사업자등록번호', COMPANY.bizNo],
    ['전화권유판매업', COMPANY.telemarketingNo],
    ['통신판매업 신고번호', COMPANY.commerceNo],
    ['주소', COMPANY.address],
    ['대표전화', COMPANY.phone],
    ['이메일', COMPANY.email],
    ['개인정보 보호책임자', COMPANY.privacyOfficer],
  ] as [string, string][]).filter(([, v]) => !!v)

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#1B2A45] overflow-x-hidden">
      <FloatingInquiry />

      {/* ── 네비게이션 ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md border-b border-[#E8E2D4] shadow-sm' : 'bg-transparent border-b border-white/10'}`}>
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="relative h-12 w-36 shrink-0">
            <Image src="/images/logo.png" alt="HUNDRED Consulting" fill className="object-contain object-left" unoptimized />
          </div>
          <div className="hidden md:flex items-center gap-7">
            {NAV.map(n => (
              <a key={n.label} href={n.href} className={`text-xs hover:text-[#C5A258] transition-colors tracking-wide font-medium ${scrolled ? 'text-[#1B2A45]/60' : 'text-white/85'}`}>{n.label}</a>
            ))}
            <a href={COMPANY.phoneHref} className="text-xs text-[#C5A258] font-bold tracking-wide">📞 {COMPANY.phone}</a>
          </div>
          <div className="flex items-center gap-2">
            <a href="#문의하기" className="hidden md:inline-flex text-xs bg-[#C5A258] hover:bg-[#D4B568] text-white font-bold px-4 py-2 rounded-lg transition-colors">무료 상담</a>
            <Link href="/login" className={`hidden md:block text-xs font-semibold hover:text-[#C5A258] transition-colors px-2 py-2 tracking-widest ${scrolled ? 'text-[#1B2A45]/40' : 'text-white/60'}`}>Login</Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className={`md:hidden p-2 flex flex-col gap-1.5 justify-center ${scrolled ? 'text-[#1B2A45]/70' : 'text-white'}`} aria-label="메뉴">
              <span className={`block w-5 h-0.5 bg-current transition-all origin-center ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all origin-center ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-[#E8E2D4] px-4 py-4 space-y-3">
            {NAV.map(n => (
              <a key={n.label} href={n.href} onClick={() => setMenuOpen(false)} className="block text-sm text-[#1B2A45]/70 py-1.5 border-b border-[#E8E2D4]">{n.label}</a>
            ))}
            <a href={COMPANY.phoneHref} className="block text-sm text-[#C5A258] font-bold py-1.5 border-b border-[#E8E2D4]">📞 {COMPANY.phone}</a>
            <Link href="/login" onClick={() => setMenuOpen(false)} className="block text-sm text-[#1B2A45]/60 py-1.5 font-semibold tracking-widest">Login</Link>
          </div>
        )}
      </nav>

      {/* ── 히어로 슬라이드 ── */}
      <HeroSlider />

      {/* ── 핵심 강점 (버튼형) ── */}
      <section className="bg-[#0b1220] text-white">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 border-x border-white/10">
          {[
            ['01', '정밀 진단', '재무·기술성 기반 분석', '#진행절차'],
            ['02', '맞춤 보고서', '10페이지 컨설팅 보고서', '#진행절차'],
            ['03', '전담 컨설턴트', '1:1 상담 진행', '#대표소개'],
            ['04', '12개월 로드맵', '단계별 진행 계획 제안', '#성장단계'],
          ].map(([n, t, d, href]) => (
            <a key={n} href={href}
              className="group relative px-5 py-6 md:px-7 md:py-8 border-b md:border-b-0 border-r border-white/10 last:border-r-0 hover:bg-[#C5A258] transition-colors duration-300">
              <span className="block text-[11px] tabular-nums text-[#C5A258] group-hover:text-[#0b1220]/70 font-bold transition-colors">{n}</span>
              <span className="block text-sm md:text-base font-bold mt-1.5 group-hover:text-[#0b1220] transition-colors">{t}</span>
              <span className="block text-[11px] text-white/45 mt-1 leading-snug group-hover:text-[#0b1220]/70 transition-colors">{d}</span>
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-white/25 group-hover:text-[#0b1220] group-hover:translate-x-1 transition-all hidden sm:block">→</span>
            </a>
          ))}
        </div>
      </section>

      {/* ── 핵심 서비스 ── */}
      <section id="서비스" className="py-20 md:py-28 px-4 md:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] mb-3">SERVICES</p>
            <h2 className="text-2xl md:text-4xl font-black">세 가지 핵심 서비스</h2>
            <p className="text-sm text-[#1B2A45]/45 mt-3">기업의 현재 위치를 정확히 진단하고, 필요한 순서대로 준비합니다.</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {CORE_SERVICES.map((s, i) => (
              <Reveal key={s.title} delay={i * 100}>
                <div className="h-full bg-[#FAF8F3] border border-[#E8E2D4] rounded-2xl p-6 hover:border-[#C5A258]/50 hover:shadow-lg transition-all">
                  <div className="w-10 h-10 rounded-lg bg-[#1B2A45] text-[#C5A258] text-sm font-black flex items-center justify-center mb-4">{s.icon}</div>
                  <p className="text-[10px] tracking-[0.25em] text-[#C5A258] font-bold">{s.tag}</p>
                  <h3 className="text-lg font-black mt-1 mb-2">{s.title}</h3>
                  <p className="text-sm text-[#1B2A45]/60 leading-relaxed mb-4">{s.lead}</p>
                  <ul className="space-y-1.5">
                    {s.points.map(p => (
                      <li key={p} className="flex gap-2 text-xs text-[#1B2A45]/70 leading-relaxed">
                        <span className="text-[#C5A258] font-bold">✓</span>{p}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mt-6">
            {EXTRA_SERVICES.map(s => (
              <div key={s.title} className="flex gap-3 items-start bg-white border border-[#E8E2D4] rounded-xl p-4">
                <span className="w-8 h-8 shrink-0 rounded-md border border-[#C5A258]/50 text-[#C5A258] font-black text-sm flex items-center justify-center">{s.icon}</span>
                <div>
                  <p className="text-sm font-bold">{s.title}</p>
                  <p className="text-xs text-[#1B2A45]/55 leading-relaxed mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 성장 단계별 ── */}
      <section id="성장단계" className="py-20 md:py-28 px-4 md:px-8 bg-[#F2EFE8]">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] mb-3">GROWTH STAGES</p>
            <h2 className="text-2xl md:text-4xl font-black">기업 성장 단계별 프로그램</h2>
            <p className="text-sm text-[#1B2A45]/45 mt-3">지금 어느 단계에 계신지에 따라 우선순위가 달라집니다.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STAGES.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="h-full bg-white rounded-2xl p-5 border border-[#E8E2D4] relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ background: s.color }} />
                  <p className="text-3xl font-black opacity-20" style={{ color: s.color }}>{s.n}</p>
                  <h3 className="text-base font-black mb-3 -mt-1">{s.title}</h3>
                  <ul className="space-y-2">
                    {s.items.map(t => (
                      <li key={t} className="text-xs text-[#1B2A45]/65 leading-relaxed flex gap-2"><span style={{ color: s.color }}>●</span>{t}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 업종별 현장 사례 (옆으로 흐르는 슬라이드) ── */}
      <section id="업종사례" className="py-20 md:py-24 bg-[#FAF8F3] overflow-hidden">
        <style>{`
          @keyframes hcMarquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
          .hc-track { animation: hcMarquee 45s linear infinite; }
          .hc-wrap:hover .hc-track { animation-play-state: paused; }
        `}</style>
        <Reveal className="text-center mb-10 px-4">
          <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] mb-3">BY INDUSTRY</p>
          <h2 className="text-2xl md:text-4xl font-black">업종별 컨설팅</h2>
          <p className="text-sm text-[#1B2A45]/45 mt-3">업종마다 다른 자금 흐름과 요건에 맞춰 상담합니다.</p>
        </Reveal>
        <div className="hc-wrap relative">
          <div className="hc-track flex gap-4 w-max px-4">
            {[...CASES, ...CASES].map((c, i) => (
              <div key={i} className="w-80 shrink-0 rounded-2xl overflow-hidden shadow-md border border-[#E8E2D4] bg-white flex flex-col">
                <div className="flex gap-3 p-4 items-start">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-[#F2EFE8]">
                    <Image src={c.photo} alt={c.industry} fill className="object-cover" style={{ objectPosition: c.pos || 'center' }} unoptimized />
                  </div>
                  <div className="min-w-0">
                    <span className="inline-block text-[10px] font-black text-[#7B5EA7] bg-[#7B5EA7]/10 px-2 py-0.5 rounded">#{c.industry}</span>
                    <p className="text-sm font-black mt-1 leading-snug">{c.client || c.title}</p>
                    <p className="text-[11px] text-[#1B2A45]/55 leading-relaxed mt-1">{c.desc}</p>
                  </div>
                </div>
                <div className="bg-[#1B2A45] px-4 py-3.5 flex-1 min-h-[84px] flex items-center">
                  {c.quote ? (
                    <p className="text-xs text-white/85 leading-relaxed">&ldquo;{c.quote}&rdquo;</p>
                  ) : (
                    <div>
                      <p className="text-[10px] text-white/40 mb-1.5">주요 상담 분야</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.chips.map(t => <span key={t} className="text-[11px] text-[#E8D080] border border-[#C5A258]/40 rounded-full px-2.5 py-0.5">{t}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 진행 절차 ── */}
      <section id="진행절차" className="py-20 md:py-28 px-4 md:px-8 bg-white">
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-12">
            <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] mb-3">PROCESS</p>
            <h2 className="text-2xl md:text-4xl font-black">이렇게 진행됩니다</h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-4">
            {PROCESS.map((p, i) => (
              <Reveal key={p.n} delay={i * 70}>
                <div className="flex gap-4 items-start bg-[#FAF8F3] border border-[#E8E2D4] rounded-xl p-4">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-[#1B2A45] text-[#C5A258] font-black flex items-center justify-center text-sm">{p.n}</span>
                  <div>
                    <p className="text-sm font-bold">{p.t}</p>
                    <p className="text-xs text-[#1B2A45]/60 leading-relaxed mt-0.5">{p.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* 약속 */}
          <Reveal className="mt-10">
            <div className="bg-[#0f1a2e] text-white rounded-2xl p-6 md:p-9 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#C5A258]/10 blur-3xl" />
              <div className="relative">
                <p className="text-[11px] text-[#C5A258] font-bold tracking-[0.3em] mb-2">OUR PROMISE</p>
                <h3 className="text-xl md:text-2xl font-black leading-snug">헌드레드컨설팅이 약속드립니다</h3>
                <p className="text-sm text-white/60 mt-2 leading-relaxed">정확한 진단과 성실한 준비로, 대표님의 다음 단계를 자신 있게 돕겠습니다.</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {[
                    ['솔직한 진단', '가능한 것과 어려운 것을 구분해 있는 그대로 말씀드립니다.'],
                    ['기준에 맞춘 검토', '각 기관의 최신 공고 기준으로 요건을 하나씩 대조합니다.'],
                    ['투명한 계약', '서비스 범위와 비용은 계약서에 명시하고, 계약 전에 충분히 설명합니다.'],
                    ['끝까지 소통', '진행 상황을 단계별로 공유하고, 다음 성장 과제까지 함께 제안합니다.'],
                  ].map(([t, d], i) => (
                    <div key={t} className="border-t border-[#C5A258]/40 pt-4">
                      <p className="text-xs text-[#C5A258] font-bold tabular-nums">{String(i + 1).padStart(2, '0')}</p>
                      <p className="text-sm font-bold mt-1">{t}</p>
                      <p className="text-xs text-white/55 leading-relaxed mt-1.5">{d}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-white/30 mt-6">※ 승인 여부와 금액은 각 기관의 심사 결과에 따라 결정됩니다.</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 대표 소개 ── */}
      <section id="대표소개" className="relative overflow-hidden bg-[#FAF8F3]">
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[#1B2A45]/90 hidden md:block z-0" />
        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-0 min-h-[560px] items-stretch">
          <Reveal from="left" className="py-20 pr-0 md:pr-12 flex flex-col justify-center space-y-5">
            <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em]">ABOUT CEO</p>
            <h2 className="text-3xl md:text-5xl font-black leading-tight">대표 {COMPANY.ceo}</h2>
            <p className="text-base text-[#C5A258] font-semibold">&ldquo;당신의 성공이 우리의 성공입니다&rdquo;</p>
            <p className="text-sm text-[#1B2A45]/60 leading-relaxed">
              법률·금융·경영 분야의 현장 경험을 바탕으로, 기업의 현재를 정확히 진단하고 근본적인 성장 방향을 함께 설계합니다.
            </p>
            <div className="space-y-2.5">
              {CEO_BIO.map(item => (
                <div key={item.t} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${item.p === '現' ? 'bg-[#C5A258] text-white' : item.p === '學' ? 'bg-[#7B5EA7]/20 text-[#7B5EA7]' : 'bg-[#1B2A45]/10 text-[#1B2A45]/40'}`}>{item.p}</span>
                  <span className="text-sm text-[#1B2A45]/65">{item.t}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal from="right" className="relative flex items-end justify-center md:justify-start py-8 md:py-0">
            <div className="relative w-full max-w-[340px] h-[460px] md:h-full">
              <Image src="/images/ceo-stand.png" alt={`${COMPANY.ceo} 대표`} fill className="object-contain object-bottom" style={{ filter: 'drop-shadow(0 0 30px rgba(197,162,88,0.15))' }} unoptimized />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 대표 인사 영상 (HOME_VIDEO.src 설정 시 표시) ── */}
      <IntroVideo />

      {/* ── 강의·강연 ── */}
      <section id="강의" className="py-20 md:py-28 px-4 md:px-8 bg-[#1B2A45] overflow-hidden">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <Reveal from="left" className="relative">
            <div className="absolute -inset-3 bg-[#C5A258]/5 rounded-3xl" />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#C5A258]/20">
              <Image src="/images/lecture.png" alt={`${COMPANY.ceo} 대표 강의 현장`} width={700} height={500} className="w-full object-cover" unoptimized />
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                <span className="bg-[#C5A258] text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg">📍 소상공인 정책자금 실전 강의</span>
              </div>
            </div>
          </Reveal>
          <Reveal from="right" className="space-y-6 text-white">
            <div>
              <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] mb-3">LECTURE & SEMINAR</p>
              <h2 className="text-3xl md:text-4xl font-black leading-tight mb-4">
                현장에서 쌓은<br /><span className="text-[#C5A258]">실전 노하우를 나눕니다</span>
              </h2>
              <p className="text-sm text-white/60 leading-relaxed">
                정책자금, 법인설립, 경영전략 등 기업 성장에 필요한 주제를 직접 강의합니다. 이론이 아닌, 현장에서 쌓은 경험을 바탕으로 대표님들의 실제 고민에 맞춰 설명드립니다.
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40 mb-3">주요 강의 주제</p>
              <div className="flex flex-wrap gap-2">
                {LECTURE_TOPICS.map(tag => (
                  <span key={tag} className="text-xs border border-[#C5A258]/30 text-[#C5A258]/80 px-3 py-1 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
            <a href="#문의하기" className="inline-flex items-center gap-2 bg-[#C5A258] hover:bg-[#D4B568] text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-[#C5A258]/20">
              강의 문의하기 →
            </a>
          </Reveal>
        </div>
      </section>

      {/* ── 문의하기 ── */}
      <section id="문의하기" className="py-12 md:py-14 px-4 bg-white">
        <div className="max-w-xl mx-auto">
          <Reveal className="text-center mb-5">
            <p className="text-[11px] text-[#C5A258] font-bold tracking-[0.3em] mb-1.5">CONTACT</p>
            <h2 className="text-xl md:text-2xl font-black">무료 상담 신청</h2>
            <p className="text-xs text-[#1B2A45]/45 mt-1.5">남겨주신 연락처로 담당 컨설턴트가 순차적으로 연락드립니다.</p>
            <p className="text-[11px] text-[#1B2A45]/45 mt-2">
              📞 <a href={COMPANY.phoneHref} className="font-bold text-[#C5A258]">{COMPANY.phone}</a>
              <span className="mx-2 text-[#1B2A45]/20">|</span>{COMPANY.hours}
            </p>
          </Reveal>
          <Reveal><LeadForm /></Reveal>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="bg-[#1B2A45] text-white/60 px-4 md:px-8 pt-10 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-start justify-between gap-6 pb-6 border-b border-white/10">
            <div>
              <div className="relative h-8 w-28 mb-3">
                <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain object-left" unoptimized />
              </div>
              <p className="text-xs text-white/50">{COMPANY.brand}</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <button onClick={() => setLegal('terms')} className="hover:text-[#C5A258] transition-colors">이용약관</button>
              <button onClick={() => setLegal('privacy')} className="font-bold text-white/80 hover:text-[#C5A258] transition-colors">개인정보처리방침</button>
              {NAV.slice(0, 6).map(n => <a key={n.label} href={n.href} className="hover:text-[#C5A258] transition-colors">{n.label}</a>)}
            </div>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-[11px] leading-relaxed py-5">
            {infoRows.map(([k, v]) => (
              <div key={k} className="flex gap-2"><dt className="text-white/35 shrink-0">{k}</dt><dd className="text-white/65 break-all">{v}</dd></div>
            ))}
          </dl>
          <p className="text-[10px] text-white/25 pt-4 border-t border-white/10">© {new Date().getFullYear()} {COMPANY.brand}. All rights reserved.</p>
        </div>
      </footer>

      <LegalModal kind={legal} onClose={() => setLegal(null)} />
    </div>
  )
}
