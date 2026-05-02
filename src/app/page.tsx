'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const successCases = [
  {
    id: 1,
    contact: '대표 박*호',
    institution: '기보 1억 승인 🎉',
    messages: [
      { type: 'sent', text: '선생님!! 기보 1억 승인 났습니다 🎉🎉🎉!!!! 정말 감사합니다요!!! 덕분에 올해 투자 다 진행할 수 있겠어요 진짜로요ㅠㅠ' },
      { type: 'sent', text: '화환 보내드리고 싶은데 주소 알려주세요 ㅋㅋ 정말 감사합니다요!!' },
      { type: 'recv', text: '대표님 축하드립니다!! 잘 됐네요 😊 화환은 마음만 받겠습니다~ 앞으로도 잘 부탁드려요!' },
    ],
    date: '2025.03.14',
    color: 'bg-[#4A9B6F]',
  },
  {
    id: 2,
    contact: '대표 이*진',
    institution: '중진공 1억 5천 승인 🥹',
    messages: [
      { type: 'sent', text: '중진공 1억 5천 승인됐어요!!!! 진짜 안될줄 알았는데 🥹🥹' },
      { type: 'sent', text: '다른데서 두번 거절당하고 포기할뻔 했는데 헌드레드 믿기 잘한것 같아요' },
      { type: 'recv', text: '정말 수고 많으셨습니다 대표님!! 이번에 서류 꼼꼼히 잘 챙겨주셔서 가능했어요 🙏' },
    ],
    date: '2025.02.28',
    color: 'bg-[#3B7AB5]',
  },
  {
    id: 3,
    contact: '대표 최*민',
    institution: '소진공 1억 승인 💰',
    messages: [
      { type: 'sent', text: '소진공 1억 나왔습니다!!! 💰💰' },
      { type: 'sent', text: '준비하던 2호점 오픈 이제 할 수 있을 것 같아요ㅠ 진짜 감사해요' },
      { type: 'recv', text: '대표님 2호점 개업 진심으로 응원합니다!! 🎊 항상 잘 되실 거예요!' },
    ],
    date: '2025.01.22',
    color: 'bg-[#7B5EA7]',
  },
  {
    id: 4,
    contact: '대표 김*수',
    institution: '신보 3억 승인 😭',
    messages: [
      { type: 'sent', text: '신보 3억 승인!!! 와 이건 정말 꿈에도 생각 못했는데' },
      { type: 'sent', text: '직원들한테 성과급도 드릴 수 있겠네요 😭😭 너무 감사합니다' },
      { type: 'recv', text: '대표님 사업 규모에 딱 맞게 됐네요!! 앞으로도 잘 부탁드립니다 😊' },
    ],
    date: '2024.12.11',
    color: 'bg-[#D4872F]',
  },
  {
    id: 5,
    contact: '대표 정*훈',
    institution: '기보 5억 승인 🔥',
    messages: [
      { type: 'sent', text: '기보 5억 ㅋㅋㅋㅋ 이게 실화냐고요' },
      { type: 'sent', text: '다른 컨설팅 3군데서 안된다고 했는데 헌드레드가 해냈네요 진짜' },
      { type: 'sent', text: '다음에 또 부탁드립니다 ㅎㅎ 주변에도 많이 소개해드릴게요!' },
    ],
    date: '2024.11.05',
    color: 'bg-[#4A9B6F]',
  },
  {
    id: 6,
    contact: '대표 오*영',
    institution: '재단 1억 승인 🙏',
    messages: [
      { type: 'sent', text: '재단 1억 나왔어요~ 생각보다 빨리 됐네요! 감사합니다 🙏' },
      { type: 'recv', text: '대표님 서류 빠르게 잘 보내주셔서 처리가 빨랐어요! 축하드립니다 🎉' },
    ],
    date: '2024.10.18',
    color: 'bg-[#3B7AB5]',
  },
  {
    id: 7,
    contact: '대표 윤*현',
    institution: '이노비즈 인증 완료 ✅',
    messages: [
      { type: 'sent', text: '이노비즈 인증 드디어 됐습니다!! 이게 이렇게 어려운거였는지 몰랐는데' },
      { type: 'sent', text: '덕분에 다음 대출 금리도 확 낮아졌어요 ㅎㅎ 최고십니다' },
    ],
    date: '2024.09.30',
    color: 'bg-[#7B5EA7]',
  },
  {
    id: 8,
    contact: '대표 한*준',
    institution: '벤처인증 + 정책자금 동시 승인 🎊',
    messages: [
      { type: 'sent', text: '벤처인증이랑 정책자금이랑 같이 다 됐어요!!! 🎊🎊🎊' },
      { type: 'sent', text: '작년에 포기하려다가 선생님 만나서 진짜 잘된것 같아요 눈물이..' },
      { type: 'recv', text: '대표님 고생 많으셨어요!! 앞으로 더 크게 성장하실 거예요 화이팅!! 💪' },
    ],
    date: '2024.09.07',
    color: 'bg-[#D4872F]',
  },
]

const reviews = [
  { name: '대표 김*훈', industry: '제조업', text: '다른 곳에서 두 번 거절당한 후 헌드레드를 찾았는데, 한 번에 기보 2억 승인을 받았습니다. 서류 하나하나 꼼꼼하게 봐주시는 전문성이 달랐어요.' },
  { name: '대표 이*아', industry: 'IT 스타트업', text: '벤처인증부터 정책자금까지 원스톱으로 해결했습니다. 혼자였으면 몇 달은 걸렸을 텐데 한 달 만에 끝났어요. 강력 추천!' },
  { name: '대표 박*성', industry: '요식업', text: '자영업자도 받을 수 있는 소진공 지원금이 이렇게 많은 줄 몰랐어요. 헌드레드 덕분에 처음 알고 받게 됐습니다.' },
  { name: '대표 최*준', industry: '무역업', text: '메인비즈 인증에 이어 중진공까지 한 번에 처리해주셨어요. 바쁜 대표님들은 이런 전문가에게 맡기는 게 맞는 것 같아요.' },
  { name: '대표 강*민', industry: '건설업', text: '처음엔 반신반의했는데 신보 2억 승인 이후로 완전 신뢰가 생겼습니다. 투명하고 정직하게 진행해주셔서 더 좋았어요.' },
  { name: '대표 윤*서', industry: '뷰티', text: '특허 출원과 법인 설립까지 함께 처리해주셨는데 정말 편했어요. 뭐든 물어보면 친절하게 답해주시는 것도 큰 장점이에요.' },
]

const services = [
  { icon: '🏆', title: '정책자금 컨설팅', desc: '기보·신보·중진공·소진공·재단 등 기업 맞춤형 정책자금 최적화 솔루션', flagship: true },
  { icon: '🔬', title: '이노비즈 인증', desc: '혁신형 중소기업 인증으로 가점 및 금리 혜택 확보' },
  { icon: '📊', title: '메인비즈 인증', desc: '경영혁신형 중소기업 인증으로 정부 지원 우대' },
  { icon: '💰', title: '무상지원금', desc: '상환 없이 받는 정부 무상 지원금 발굴 및 신청 대행' },
  { icon: '🚀', title: '벤처기업 인증', desc: '벤처 인증으로 세제 혜택 및 투자 유치 유리한 위치 확보' },
  { icon: '🏛', title: '법인설립', desc: '사업 확장과 절세를 위한 최적의 법인 구조 설계' },
  { icon: '📝', title: '특허·가출원', desc: '핵심 기술 보호와 경쟁력 확보를 위한 지식재산권 전략' },
  { icon: '📣', title: '광고·마케팅', desc: '온·오프라인 전반의 마케팅 전략 수립 및 실행' },
  { icon: '🏪', title: '자영업 컨설팅', desc: '자영업에 이루어지는 모든 경영 문제 원스톱 해결' },
]

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', phone: '', company: '', inquiry: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      setSubmitted(true)
    } catch {
      alert('전송 중 오류가 발생했습니다. 전화로 문의해주세요.')
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[#0D1520] text-white overflow-x-hidden">

      {/* ── 네비게이션 ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0D1520]/90 backdrop-blur-md border-b border-[#C5A258]/10">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative w-9 h-9">
              <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain" unoptimized />
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-black tracking-[0.15em] text-[#C5A258] leading-none">HUNDRED</p>
              <p className="text-[8px] tracking-[0.3em] text-white/40 leading-none mt-0.5">CONSULTANCY</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {['서비스', '성공사례', '대표소개', '문의하기'].map((label) => (
              <a key={label} href={`#${label}`}
                className="text-xs text-white/50 hover:text-[#C5A258] transition-colors tracking-wide">
                {label}
              </a>
            ))}
            <a href="tel:18442599" className="text-xs text-[#C5A258] font-bold">📞 1844-2599</a>
          </div>

          <div className="flex items-center gap-2">
            <a href="#문의하기" className="hidden md:inline-flex text-xs bg-[#C5A258] hover:bg-[#D4B568] text-[#0D1520] font-bold px-4 py-2 rounded-lg transition-colors">
              무료 상담
            </a>
            <Link href="/login" className="text-xs text-white/40 hover:text-white border border-white/10 px-3 py-1.5 rounded-lg transition-colors hidden md:inline-flex">
              직원 로그인
            </Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-white/70 flex flex-col gap-1">
              <span className={`block w-5 h-0.5 bg-current transition-all origin-center ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all origin-center ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-[#0D1520] border-t border-white/5 px-4 py-4 space-y-3">
            {['서비스', '성공사례', '대표소개', '문의하기'].map((label) => (
              <a key={label} href={`#${label}`} onClick={() => setMenuOpen(false)}
                className="block text-sm text-white/70 hover:text-[#C5A258] py-1.5 border-b border-white/5">
                {label}
              </a>
            ))}
            <a href="tel:18442599" className="block text-sm text-[#C5A258] font-bold py-1.5">📞 1844-2599</a>
            <Link href="/login" className="block text-sm text-white/40 py-1.5">직원 로그인</Link>
          </div>
        )}
      </nav>

      {/* ── 히어로 섹션 ── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0D1520] via-[#1B2A45]/50 to-[#0D1520]" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#C5A258]/5 to-transparent" />
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, #C5A258 0, #C5A258 1px, transparent 0, transparent 50%)', backgroundSize: '24px 24px' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-12">

          {/* 왼쪽 */}
          <div className="space-y-6 order-2 md:order-1">
            <div className="inline-flex items-center gap-2 border border-[#C5A258]/30 rounded-full px-4 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C5A258] animate-pulse" />
              <span className="text-xs text-[#C5A258] tracking-widest font-medium">The complete solution for business success</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black leading-[1.2] tracking-tight">
              <span className="italic text-white">당신이 그곳을</span><br />
              <span className="italic text-white">어떻게 이룬지</span><br />
              <span className="italic text-[#C5A258]" style={{ textDecoration: 'underline', textDecorationColor: 'rgba(197,162,88,0.4)', textUnderlineOffset: '6px' }}>알기에</span>
            </h1>

            <ul className="space-y-1.5">
              {[
                { p: '前', t: '법무법인 혜안 소속' },
                { p: '前', t: 'PUREBROWN 대표이사' },
                { p: '前', t: '㈜나라감정평가법인 소속' },
                { p: '前', t: 'GIGGLY 대표이사' },
                { p: '現', t: '세계탈장연맹본부(WDF) 전문의원' },
                { p: '現', t: 'HUNDRED consulting 대표' },
              ].map((item) => (
                <li key={item.t} className="flex items-center gap-2.5 text-sm text-white/55">
                  <span className={`text-xs font-bold w-5 shrink-0 ${item.p === '現' ? 'text-[#C5A258]' : 'text-white/25'}`}>{item.p}</span>
                  {item.t}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3 pt-2">
              <a href="#문의하기"
                className="inline-flex items-center gap-2 bg-[#C5A258] hover:bg-[#D4B568] text-[#0D1520] font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-[#C5A258]/20">
                무료 상담 신청 →
              </a>
              <a href="#서비스"
                className="inline-flex items-center gap-2 border border-white/15 hover:border-[#C5A258]/40 text-white/60 hover:text-white px-6 py-3 rounded-xl text-sm transition-all">
                서비스 보기
              </a>
            </div>
          </div>

          {/* 오른쪽 */}
          <div className="order-1 md:order-2 flex flex-col items-center md:items-end gap-4">
            <div className="text-center md:text-right">
              <p className="text-[10px] tracking-[0.25em] text-[#C5A258]/60 uppercase mb-0.5">HUNDRED CONSULTING 대표</p>
              <p className="text-2xl font-black text-white tracking-wide">백 승 혁</p>
            </div>

            <div className="relative w-full max-w-[300px] md:max-w-[360px]" style={{ aspectRatio: '3/4' }}>
              <Image
                src="/images/ceo-main.png"
                alt="백승혁 대표"
                fill
                className="object-cover object-top rounded-2xl"
                unoptimized
              />
            </div>

            <div className="bg-[#1B2A45]/80 border border-[#C5A258]/20 rounded-xl p-4 max-w-[300px] space-y-2">
              <p className="text-xs text-white/65 leading-relaxed">상위 20%가 전세계 84%의 돈을 보유하고 살고 있고,</p>
              <p className="text-xs text-white/65 leading-relaxed">하위 40%가 전세계 4%의 돈을 나눠서 살고 있습니다.</p>
              <p className="text-xs text-[#C5A258] font-semibold leading-relaxed">아직도 당신의 돈을 제대로 다루고 있다고 생각하십니까?</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 통계 바 ── */}
      <div className="bg-[#1B2A45] border-y border-[#C5A258]/10">
        <div className="max-w-5xl mx-auto px-4 py-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '500억+', label: '누적 승인금액' },
            { value: '1,200+', label: '계약 고객 수' },
            { value: '94%', label: '성공 승인율' },
            { value: '10년+', label: '전문 경력' },
          ].map((s, i) => (
            <div key={s.label} className={`text-center py-2 ${i < 3 ? 'md:border-r border-[#C5A258]/10' : ''}`}>
              <p className="text-2xl md:text-3xl font-black text-[#C5A258]">{s.value}</p>
              <p className="text-xs text-white/40 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 서비스 섹션 ── */}
      <section id="서비스" className="py-20 md:py-28 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase mb-3">SERVICES</p>
            <h2 className="text-2xl md:text-4xl font-black text-white mb-3">비즈니스의 모든 것을 함께합니다</h2>
            <p className="text-sm text-white/40">정책자금은 그 중 우리가 가장 잘하는 것일 뿐</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s) => (
              <div key={s.title}
                className={`relative group rounded-2xl p-6 border transition-all cursor-default
                  ${s.flagship
                    ? 'bg-gradient-to-br from-[#C5A258]/15 to-[#1B2A45]/60 border-[#C5A258]/40 shadow-lg shadow-[#C5A258]/10'
                    : 'bg-[#1B2A45]/40 border-white/5 hover:border-[#C5A258]/20 hover:bg-[#1B2A45]/60'
                  }`}
              >
                {s.flagship && (
                  <div className="absolute top-4 right-4 bg-[#C5A258] text-[#0D1520] text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full">
                    FLAGSHIP
                  </div>
                )}
                <div className="text-3xl mb-3">{s.icon}</div>
                <h3 className={`font-bold mb-2 ${s.flagship ? 'text-[#C5A258]' : 'text-white'}`}>{s.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 성공사례 섹션 ── */}
      <section id="성공사례" className="py-20 md:py-28 px-4 md:px-8 bg-[#0a101a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase mb-3">SUCCESS CASES</p>
            <h2 className="text-2xl md:text-4xl font-black text-white mb-3">실제 승인 성공 사례</h2>
            <p className="text-sm text-white/40 mb-6">고객의 진심 어린 감사 메시지</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['💐 화환을 보내주셨습니다', '🎊 승인을 축하드립니다', '🌸 함께해서 영광입니다'].map((t) => (
                <span key={t} className="text-xs text-[#C5A258]/70 border border-[#C5A258]/20 rounded-full px-3 py-1">{t}</span>
              ))}
            </div>
          </div>

          <div className="columns-1 sm:columns-2 gap-4">
            {successCases.map((c) => (
              <div key={c.id} className="break-inside-avoid mb-4">
                <div className="rounded-2xl overflow-hidden shadow-xl border border-white/5">
                  <div className={`${c.color} px-4 py-2.5 flex items-center gap-2`}>
                    <div className="w-7 h-7 rounded-full bg-[#FAE300] flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-[#3C1E1E]">K</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{c.contact}</p>
                      <p className="text-[10px] text-white/70 truncate">{c.institution}</p>
                    </div>
                    <span className="text-[10px] text-white/50 shrink-0">{c.date}</span>
                  </div>
                  <div className="bg-[#B2C7D9] px-3 py-4 space-y-2">
                    {c.messages.map((msg, mi) => (
                      <div key={mi} className={`flex ${msg.type === 'sent' ? 'justify-end' : 'justify-start'}`}>
                        {msg.type === 'recv' && (
                          <div className="w-6 h-6 rounded-full bg-[#4A9B6F] flex items-center justify-center mr-2 shrink-0 mt-0.5">
                            <span className="text-[9px] font-bold text-white">H</span>
                          </div>
                        )}
                        <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm
                          ${msg.type === 'sent' ? 'bg-[#FAE300] text-[#1a1a1a] rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 후기 섹션 ── */}
      <section className="py-20 md:py-28 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase mb-3">REVIEWS</p>
            <h2 className="text-2xl md:text-4xl font-black text-white">고객 후기</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.map((r) => (
              <div key={r.name} className="bg-[#1B2A45]/50 border border-white/5 hover:border-[#C5A258]/20 rounded-2xl p-5 transition-all">
                <div className="flex mb-3">
                  {[...Array(5)].map((_, i) => <span key={i} className="text-[#C5A258]">★</span>)}
                </div>
                <p className="text-xs text-white/60 leading-relaxed mb-4">&ldquo;{r.text}&rdquo;</p>
                <div className="flex items-center gap-2 border-t border-white/5 pt-3">
                  <div className="w-7 h-7 rounded-full bg-[#C5A258]/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-[#C5A258] font-bold">{r.name.charAt(3)}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{r.name}</p>
                    <p className="text-[10px] text-white/30">{r.industry}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CEO 소개 ── */}
      <section id="대표소개" className="py-20 md:py-28 px-4 md:px-8 bg-[#0a101a] overflow-hidden">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 order-2 md:order-1">
            <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase">ABOUT CEO</p>
            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">대표 백승혁</h2>
            <p className="text-lg text-[#C5A258] font-semibold">&ldquo;당신의 성공이 우리의 성공입니다&rdquo;</p>
            <p className="text-sm text-white/50 leading-relaxed">
              10년이 넘는 법률·금융·경영 분야 경력을 바탕으로, 단순한 자금 알선이 아닌
              기업의 근본적인 성장을 함께 설계합니다. 법무법인부터 세계 기관까지,
              다양한 현장에서 쌓은 실전 경험이 고객의 성공을 만듭니다.
            </p>
            <div className="space-y-2.5 pt-2">
              {[
                { p: '前', t: '법무법인 혜안 소속' },
                { p: '前', t: 'PUREBROWN 대표이사' },
                { p: '前', t: '㈜나라감정평가법인 소속' },
                { p: '前', t: 'GIGGLY 대표이사' },
                { p: '現', t: '세계탈장연맹본부(WDF) 전문의원' },
                { p: '現', t: 'HUNDRED consulting 대표' },
              ].map((item) => (
                <div key={item.t} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0
                    ${item.p === '現' ? 'bg-[#C5A258] text-[#0D1520]' : 'bg-white/8 text-white/30'}`}>
                    {item.p}
                  </span>
                  <span className="text-sm text-white/60">{item.t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="order-1 md:order-2 flex justify-center md:justify-end">
            <div className="relative w-full max-w-[340px] rounded-2xl overflow-hidden border-2 border-[#C5A258]/20" style={{ aspectRatio: '3/4' }}>
              <Image src="/images/ceo-stand.png" alt="백승혁 대표" fill className="object-cover object-top" unoptimized />
            </div>
          </div>
        </div>
      </section>

      {/* ── 문의 섹션 ── */}
      <section id="문의하기" className="py-20 md:py-28 px-4 md:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div>
              <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase mb-3">CONTACT</p>
              <h2 className="text-2xl md:text-4xl font-black text-white mb-3">무료 상담 신청</h2>
              <p className="text-sm text-white/40">남겨주신 정보로 담당자가 빠르게 연락드립니다.</p>
            </div>
            <div className="space-y-4">
              {[
                { icon: '📍', label: '주소', value: '서울특별시 구로구 디지털로 243 지하이시티 911호' },
                { icon: '📞', label: '전화', value: '1844-2599' },
                { icon: '✉️', label: '이메일', value: '100-house@naver.com' },
                { icon: '🕐', label: '운영시간', value: '평일 09:00 – 18:00 (토/일 휴무)' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className="text-lg mt-0.5 shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-[10px] text-white/30 mb-0.5">{item.label}</p>
                    <p className="text-sm text-white/70">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {[{ l: '카카오톡', e: '💬' }, { l: '인스타그램', e: '📸' }, { l: '유튜브', e: '▶️' }].map((s) => (
                <span key={s.l} className="flex items-center gap-1.5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/40">
                  {s.e} {s.l}
                </span>
              ))}
            </div>
          </div>

          <div>
            {submitted ? (
              <div className="bg-[#1B2A45]/60 border border-[#C5A258]/30 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-lg font-bold text-white mb-2">상담 신청이 완료됐습니다!</h3>
                <p className="text-sm text-white/50">담당자가 빠른 시간 내에 연락드리겠습니다.</p>
                <p className="text-xs text-[#C5A258] mt-4">📞 급하신 분은 1844-2599로 바로 연락주세요</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-[#1B2A45]/40 border border-white/5 rounded-2xl p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">이름 *</label>
                    <input type="text" required value={formData.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#C5A258]/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors"
                      placeholder="홍길동" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">연락처 *</label>
                    <input type="tel" required value={formData.phone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 focus:border-[#C5A258]/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors"
                      placeholder="010-0000-0000" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">회사명</label>
                  <input type="text" value={formData.company}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#C5A258]/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors"
                    placeholder="(주)홍길동상사" />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">문의 유형</label>
                  <select value={formData.inquiry}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, inquiry: e.target.value }))}
                    className="w-full bg-[#1B2A45] border border-white/10 focus:border-[#C5A258]/50 rounded-xl px-3 py-2.5 text-sm text-white/70 outline-none transition-colors">
                    <option value="">선택해주세요</option>
                    {['정책자금', '이노비즈/메인비즈 인증', '무상지원금', '벤처기업 인증', '법인설립', '특허/가출원', '광고·마케팅', '자영업 컨설팅', '기타'].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">문의 내용</label>
                  <textarea rows={4} value={formData.message}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 focus:border-[#C5A258]/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none transition-colors resize-none"
                    placeholder="필요한 자금 규모나 현재 상황을 간단히 적어주세요." />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-50 text-[#0D1520] font-bold py-3.5 rounded-xl text-sm transition-all">
                  {submitting ? '전송 중...' : '상담 신청하기 →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="bg-[#090e17] border-t border-[#C5A258]/10 py-10 px-4 md:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative w-9 h-9">
                <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain" unoptimized />
              </div>
              <div>
                <p className="text-xs font-black tracking-[0.15em] text-[#C5A258]">HUNDRED</p>
                <p className="text-[8px] tracking-[0.3em] text-white/30">CONSULTANCY</p>
              </div>
            </div>
            <p className="text-xs text-white/30 leading-relaxed">기업의 성공을 위한<br />모든 솔루션을 제공합니다.</p>
          </div>
          <div>
            <p className="text-xs text-[#C5A258] font-bold tracking-widest mb-3">QUICK LINKS</p>
            <div className="space-y-2">
              {['서비스', '성공사례', '대표소개', '문의하기'].map((label) => (
                <a key={label} href={`#${label}`} className="block text-xs text-white/40 hover:text-[#C5A258] transition-colors">{label}</a>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-[#C5A258] font-bold tracking-widest mb-3">CONTACT</p>
            <div className="space-y-1.5 text-xs text-white/40">
              <p>📞 1844-2599</p>
              <p>✉️ 100-house@naver.com</p>
              <p>📍 서울 구로구 디지털로 243 지하이시티 911호</p>
              <p>🕐 평일 09:00 – 18:00</p>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[10px] text-white/20">© 2025 HUNDRED Consultancy. All rights reserved.</p>
          <Link href="/login" className="text-[10px] text-white/20 hover:text-white/50 transition-colors">직원 로그인</Link>
        </div>
      </footer>
    </div>
  )
}
