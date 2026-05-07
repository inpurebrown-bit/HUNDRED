'use client'

import { useState, useEffect, useRef, FormEvent, ChangeEvent, ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'

// ─── 스크롤 인트로 컴포넌트 ──────────────────────────────
function Reveal({ children, from = 'bottom', delay = 0, className = '' }: {
  children: ReactNode
  from?: 'left' | 'right' | 'bottom'
  delay?: number
  className?: string
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
  const t = from === 'left' ? (visible ? 'translate-x-0 opacity-100' : '-translate-x-16 opacity-0')
           : from === 'right' ? (visible ? 'translate-x-0 opacity-100' : 'translate-x-16 opacity-0')
           : (visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0')
  return (
    <div ref={ref} className={`transition-all duration-700 ease-out ${t} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

// ─── 데이터 ──────────────────────────────────────────────
const successCases = [
  {
    id: 1, contact: '대표 박*호', institution: '기보 1억 승인 🎉',
    messages: [
      { type: 'sent', text: '선생님!! 기보 1억 승인 났습니다 🎉🎉🎉!!!! 정말 감사합니다요!!! 덕분에 올해 투자 다 진행할 수 있겠어요 진짜로요ㅠㅠ' },
      { type: 'sent', text: '화환 보내드리고 싶은데 주소 알려주세요 ㅋㅋ 정말 감사합니다요!!' },
      { type: 'recv', text: '대표님 축하드립니다!! 잘 됐네요 😊 화환은 마음만 받겠습니다~ 앞으로도 잘 부탁드려요!' },
    ],
    date: '2025.03.14', color: 'bg-[#4A9B6F]',
  },
  {
    id: 2, contact: '대표 이*진', institution: '중진공 1억 5천 승인 🥹',
    messages: [
      { type: 'sent', text: '중진공 1억 5천 승인됐어요!!!! 진짜 안될줄 알았는데 🥹🥹' },
      { type: 'sent', text: '다른데서 두번 거절당하고 포기할뻔 했는데 헌드레드 믿기 잘한것 같아요' },
      { type: 'recv', text: '정말 수고 많으셨습니다 대표님!! 이번에 서류 꼼꼼히 잘 챙겨주셔서 가능했어요 🙏' },
    ],
    date: '2025.02.28', color: 'bg-[#3B7AB5]',
  },
  {
    id: 3, contact: '대표 최*민', institution: '소진공 1억 승인 💰',
    messages: [
      { type: 'sent', text: '소진공 1억 나왔습니다!!! 💰💰' },
      { type: 'sent', text: '준비하던 2호점 오픈 이제 할 수 있을 것 같아요ㅠ 진짜 감사해요' },
      { type: 'recv', text: '대표님 2호점 개업 진심으로 응원합니다!! 🎊 항상 잘 되실 거예요!' },
    ],
    date: '2025.01.22', color: 'bg-[#7B5EA7]',
  },
  {
    id: 4, contact: '대표 김*수', institution: '신보 3억 승인 😭',
    messages: [
      { type: 'sent', text: '신보 3억 승인!!! 와 이건 정말 꿈에도 생각 못했는데' },
      { type: 'sent', text: '직원들한테 성과급도 드릴 수 있겠네요 😭😭 너무 감사합니다' },
      { type: 'recv', text: '대표님 사업 규모에 딱 맞게 됐네요!! 앞으로도 잘 부탁드립니다 😊' },
    ],
    date: '2024.12.11', color: 'bg-[#D4872F]',
  },
  {
    id: 5, contact: '대표 정*훈', institution: '기보 5억 승인 🔥',
    messages: [
      { type: 'sent', text: '기보 5억 ㅋㅋㅋㅋ 이게 실화냐고요' },
      { type: 'sent', text: '다른 컨설팅 3군데서 안된다고 했는데 헌드레드가 해냈네요 진짜' },
      { type: 'sent', text: '다음에 또 부탁드립니다 ㅎㅎ 주변에도 많이 소개해드릴게요!' },
    ],
    date: '2024.11.05', color: 'bg-[#4A9B6F]',
  },
  {
    id: 6, contact: '대표 오*영', institution: '재단 1억 승인 🙏',
    messages: [
      { type: 'sent', text: '재단 1억 나왔어요~ 생각보다 빨리 됐네요! 감사합니다 🙏' },
      { type: 'recv', text: '대표님 서류 빠르게 잘 보내주셔서 처리가 빨랐어요! 축하드립니다 🎉' },
    ],
    date: '2024.10.18', color: 'bg-[#3B7AB5]',
  },
  {
    id: 7, contact: '대표 윤*현', institution: '이노비즈 인증 완료 ✅',
    messages: [
      { type: 'sent', text: '이노비즈 인증 드디어 됐습니다!! 이게 이렇게 어려운거였는지 몰랐는데' },
      { type: 'sent', text: '덕분에 다음 대출 금리도 확 낮아졌어요 ㅎㅎ 최고십니다' },
    ],
    date: '2024.09.30', color: 'bg-[#7B5EA7]',
  },
  {
    id: 8, contact: '대표 한*준', institution: '벤처인증 + 정책자금 동시 승인 🎊',
    messages: [
      { type: 'sent', text: '벤처인증이랑 정책자금이랑 같이 다 됐어요!!! 🎊🎊🎊' },
      { type: 'sent', text: '작년에 포기하려다가 선생님 만나서 진짜 잘된것 같아요 눈물이..' },
      { type: 'recv', text: '대표님 고생 많으셨어요!! 앞으로 더 크게 성장하실 거예요 화이팅!! 💪' },
    ],
    date: '2024.09.07', color: 'bg-[#D4872F]',
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
  { icon: '🧪', title: '연구개발전담부서 및 연구소 설립', desc: '기업 부설 연구소·R&D 전담부서 설립으로 세제 혜택 및 정책자금 우대 확보' },
  { icon: '🏛', title: '법인설립', desc: '사업 확장과 절세를 위한 최적의 법인 구조 설계' },
  { icon: '📝', title: '특허·가출원', desc: '핵심 기술 보호와 경쟁력 확보를 위한 지식재산권 전략' },
  { icon: '📣', title: '광고·마케팅', desc: '온·오프라인 전반의 마케팅 전략 수립 및 실행' },
  { icon: '🏪', title: '자영업 컨설팅', desc: '자영업에 이루어지는 모든 경영 문제 원스톱 해결' },
]

// 수상/표창 — 실제 소유한 증서 형태로 스타일링
const awards = [
  { title: '업무추진 표창', body: '정책자금 컨설팅 분야에서\n탁월한 업무 성과와 기여를 인정하여\n이 표창장을 수여합니다.', year: '2022년', seal: '관' },
  { title: '우수 컨설턴트 상', body: '중소기업 경영 지원 및 자금조달 분야\n전문성과 헌신적 서비스로\n우수한 성과를 달성하였기에 이를 표창합니다.', year: '2023년', seal: '협' },
  { title: '수료증', body: '창업 및 기업경영 전문과정을\n성실히 이수하여 소정의 교육과정을\n완료하였음을 증명합니다.', year: '2021년', seal: '원' },
  { title: '임명장', body: '오랜 경험과 전문성을 바탕으로\n본 기관 전문의원으로 임명하며\n소임을 다할 것을 기대합니다.', year: '2024년', seal: '장' },
]

// ─── 플로팅 AI 위젯 ──────────────────────────────────────
function FloatingAiWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send(e: FormEvent) {
    e.preventDefault()
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch('/api/public-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.reply || '답변을 가져올 수 없습니다.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '서버 연결 오류가 발생했습니다.' }])
    }
    setLoading(false)
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">
      {/* 채팅 패널 */}
      {open && (
        <div className="w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-[#E8E2D4] flex flex-col overflow-hidden"
          style={{ height: 460 }}>
          {/* 헤더 */}
          <div className="bg-[#1B2A45] px-4 py-3 flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-full bg-[#C5A258] flex items-center justify-center shrink-0">
              <span className="text-white text-[11px] font-black">AI</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold">헌드레드 AI 상담</p>
              <p className="text-white/40 text-[10px]">정책자금·경영 전문</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-lg leading-none">✕</button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#FAF8F3]">
            {messages.length === 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-[11px] text-[#1B2A45]/40 text-center">궁금한 것을 물어보세요</p>
                {['정책자금 받을 수 있나요?', '기보 vs 신보 차이는?', '무상지원금도 있나요?'].map(q => (
                  <button key={q} onClick={() => { setInput(q); setTimeout(() => document.getElementById('ai-input')?.focus(), 50) }}
                    className="w-full text-left text-xs text-[#C5A258] border border-[#C5A258]/20 bg-white rounded-xl px-3 py-2 hover:bg-[#C5A258]/5 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-5 h-5 rounded-full bg-[#C5A258] flex items-center justify-center mr-2 shrink-0 mt-0.5">
                    <span className="text-white text-[8px] font-black">AI</span>
                  </div>
                )}
                <div className={`max-w-[82%] text-[12px] leading-relaxed px-3 py-2 rounded-2xl shadow-sm whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'bg-[#1B2A45] text-white rounded-br-sm'
                    : 'bg-white text-[#1B2A45]/80 rounded-bl-sm border border-[#E8E2D4]'
                  }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-5 h-5 rounded-full bg-[#C5A258] flex items-center justify-center mr-2 shrink-0">
                  <span className="text-white text-[8px] font-black">AI</span>
                </div>
                <div className="bg-white border border-[#E8E2D4] px-3 py-2 rounded-2xl rounded-bl-sm flex gap-1">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-1.5 h-1.5 bg-[#C5A258] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <form onSubmit={send} className="px-3 py-3 border-t border-[#E8E2D4] flex gap-2 shrink-0 bg-white">
            <input
              id="ai-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="질문을 입력하세요..."
              disabled={loading}
              className="flex-1 bg-[#FAF8F3] border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-3 py-2 text-xs text-[#1B2A45] placeholder-[#1B2A45]/30 outline-none transition-colors"
            />
            <button type="submit" disabled={loading || !input.trim()}
              className="bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-40 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors shrink-0">
              전송
            </button>
          </form>
        </div>
      )}

      {/* 토글 버튼 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-full bg-[#1B2A45] hover:bg-[#2A3D5E] shadow-2xl flex items-center justify-center transition-all hover:scale-105 group"
        style={{ boxShadow: '0 4px 24px rgba(27,42,69,0.35)' }}
      >
        {open ? (
          <span className="text-white/80 text-lg">✕</span>
        ) : (
          <div className="text-center">
            <span className="text-[#C5A258] text-[11px] font-black block leading-none">AI</span>
            <span className="text-white/50 text-[8px] block leading-none mt-0.5">상담</span>
          </div>
        )}
        {!open && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#C5A258] rounded-full border-2 border-white animate-pulse" />
        )}
      </button>
    </div>
  )
}

export default function HomePage() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', region: '', phone: '', company: '', message: '', taxStatus: '없음' })
  const [inquiryTypes, setInquiryTypes] = useState<string[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [caseIdx, setCaseIdx] = useState(0)
  const [reviewIdx, setReviewIdx] = useState(0)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installable, setInstallable] = useState(false)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
      setInstallable(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setInstallable(false)
      setInstallPrompt(null)
    }
  }

  // 슬라이드 자동재생 제거 — 폼 작성 중 페이지 흔들림 방지
  // 수동 화살표 버튼으로만 이동

  function toggleInquiry(type: string) {
    setInquiryTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, inquiryTypes }),
      })
      setSubmitted(true)
    } catch {
      alert('전송 중 오류가 발생했습니다. 전화로 문의해주세요.')
    }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#1B2A45] overflow-x-hidden">

      {/* ── 플로팅 AI 위젯 ── */}
      <FloatingAiWidget />

      {/* ── 네비게이션 ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E8E2D4] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          {/* 로고만 표시 */}
          <div className="relative h-14 w-40 shrink-0">
            <Image src="/images/logo.png" alt="HUNDRED Consultancy" fill className="object-contain object-left" unoptimized />
          </div>

          <div className="hidden md:flex items-center gap-7">
            {['서비스', '성공사례', '대표소개', '문의하기'].map((label) => (
              <a key={label} href={`#${label}`}
                className="text-xs text-[#1B2A45]/60 hover:text-[#C5A258] transition-colors tracking-wide font-medium">
                {label}
              </a>
            ))}
            <a href="tel:18442599" className="text-xs text-[#C5A258] font-bold tracking-wide">📞 1844-2599</a>
          </div>

          <div className="flex items-center gap-2">
            <a href="#문의하기" className="hidden md:inline-flex text-xs bg-[#C5A258] hover:bg-[#D4B568] text-white font-bold px-4 py-2 rounded-lg transition-colors">
              무료 상담
            </a>
            <Link href="/login" className="hidden md:block text-xs font-semibold text-[#1B2A45]/40 hover:text-[#C5A258] transition-colors px-2 py-2 tracking-widest">
              Login
            </Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-[#1B2A45]/70 flex flex-col gap-1.5 justify-center">
              <span className={`block w-5 h-0.5 bg-current transition-all origin-center ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all origin-center ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-white border-t border-[#E8E2D4] px-4 py-4 space-y-3">
            {['서비스', '성공사례', '대표소개', '문의하기'].map((label) => (
              <a key={label} href={`#${label}`} onClick={() => setMenuOpen(false)}
                className="block text-sm text-[#1B2A45]/70 hover:text-[#C5A258] py-1.5 border-b border-[#E8E2D4]">
                {label}
              </a>
            ))}
            <a href="tel:18442599" className="block text-sm text-[#C5A258] font-bold py-1.5 border-b border-[#E8E2D4]">📞 1844-2599</a>
            <Link href="/login" onClick={() => setMenuOpen(false)}
              className="block text-sm text-[#1B2A45]/60 hover:text-[#C5A258] py-1.5 font-semibold tracking-widest">
              Login
            </Link>
          </div>
        )}
      </nav>

      {/* ── 히어로 섹션 ── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-[#FAF8F3]">
        {/* 빌딩숲 배경 이미지 */}
        <div className="absolute inset-0 z-0" style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1920&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          opacity: 0.28,
        }} />
        {/* ivory 오버레이 */}
        <div className="absolute inset-0 z-0 bg-[#FAF8F3]/82" />
        {/* 금색 점 패턴 */}
        <div className="absolute inset-0 z-0 opacity-[0.05]"
          style={{ backgroundImage: 'radial-gradient(#C5A258 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        {/* 우측 골드 그라데이션 */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#C5A258]/6 to-transparent pointer-events-none z-0" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-0 items-center min-h-[calc(100vh-64px)]">

          {/* 왼쪽 텍스트 */}
          <div className="space-y-7 order-1 md:order-1 py-12">
            <Reveal from="left" className="flex justify-center">
              <div className="inline-flex items-center gap-2 border border-[#C5A258]/40 bg-[#C5A258]/8 rounded-full px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C5A258] animate-pulse" />
                <span className="text-xs text-[#C5A258] tracking-widest font-semibold">The complete solution for business success</span>
              </div>
            </Reveal>

            <Reveal from="left" delay={100}>
              <h1 className="tracking-tight text-center"
                style={{ fontFamily: 'var(--font-noto-serif-kr), Georgia, serif' }}>

                {/* 1단 */}
                <div className="text-[1.5rem] font-bold text-[#3A4A5C] leading-snug">부자들만 오가던</div>
                <div className="text-[1.5rem] font-bold text-[#3A4A5C] leading-snug">추월차선이</div>
                <div className="text-[0.85rem] font-normal text-[#1B2A45]/30 tracking-[0.12em] mt-1 mb-6">따로 있었다면..</div>

                {/* 2단 */}
                <div className="text-[1.5rem] font-bold text-[#3A4A5C] leading-snug">나만 안되던 이유가</div>
                <div className="text-[0.85rem] font-normal text-[#1B2A45]/30 tracking-[0.12em] mt-1 mb-6">따로 있었다면</div>

                {/* 3단 — 필기체 금색 */}
                <div className="text-[2.2rem] text-[#C5A258] leading-snug"
                  style={{
                    fontFamily: 'var(--font-nanum-brush), cursive',
                    textDecoration: 'underline',
                    textDecorationColor: 'rgba(197,162,88,0.25)',
                    textUnderlineOffset: '6px',
                  }}>
                  이번에도 부정하시겠습니까&nbsp;?
                </div>
              </h1>
            </Reveal>

            <Reveal from="left" delay={200}>
              <ul className="space-y-2 flex flex-col items-center">
                {[
                  { p: '學', t: '자산경영학 전공' },
                  { p: '前', t: '법무법인 혜안 소속' },
                  { p: '前', t: 'PUREBROWN 대표이사' },
                  { p: '前', t: '㈜나라감정평가법인 소속' },
                  { p: '前', t: 'GIGGLY 대표이사' },
                  { p: '現', t: '세계탐정연맹본부(WDF) 전문위원' },
                  { p: '現', t: 'HUNDRED consulting 대표' },
                ].map((item) => (
                  <li key={item.t} className="flex items-center gap-2.5 text-sm text-[#1B2A45]/55">
                    <span className={`text-[11px] font-bold w-5 shrink-0 ${item.p === '現' ? 'text-[#C5A258]' : item.p === '學' ? 'text-[#7B5EA7]' : 'text-[#1B2A45]/35'}`}>{item.p}</span>
                    {item.t}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal from="left" delay={300}>
              <div className="flex flex-wrap justify-center gap-3 pt-1">
                <a href="#문의하기"
                  className="inline-flex items-center gap-2 bg-[#C5A258] hover:bg-[#D4B568] text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-[#C5A258]/25 hover:scale-[1.02]">
                  무료 상담 신청 →
                </a>
                <a href="#서비스"
                  className="inline-flex items-center gap-2 border-2 border-[#1B2A45]/15 hover:border-[#C5A258]/50 text-[#1B2A45]/60 hover:text-[#C5A258] px-6 py-3.5 rounded-xl text-sm transition-all font-medium">
                  서비스 보기
                </a>
              </div>
            </Reveal>
          </div>

          {/* 오른쪽 CEO 사진 */}
          <Reveal from="right" className="order-2 md:order-2 flex flex-col items-center md:items-end gap-3 relative pt-28">

            {/* CEO 사진 — 배경제거본이라 자연스럽게 블렌딩 */}
            <div className="relative w-full max-w-[280px] md:max-w-[340px]" style={{ aspectRatio: '3/4' }}>
              {/* 대표 이름 — 사진 바로 위에 절대 위치 */}
              <div className="absolute -top-[5.5rem] left-0 z-10 text-center md:text-left w-full">
                <p className="text-xs tracking-[0.25em] text-[#C5A258] font-bold mb-0.5">헌드레드 지원센터 대표</p>
                <p className="text-[2.6rem] text-[#1B2A45] leading-none"
                  style={{ fontFamily: 'var(--font-nanum-brush), cursive' }}>백승협</p>
              </div>
              <Image
                src="/images/ceo-main.png"
                alt="백승협 대표"
                fill
                className="object-contain object-bottom"
                style={{ filter: 'drop-shadow(0 20px 50px rgba(27,42,69,0.18)) drop-shadow(0 8px 20px rgba(197,162,88,0.12))' }}
                unoptimized
              />
            </div>

            {/* 인용구 박스 */}
            <div className="bg-white border-l-4 border-[#C5A258] rounded-r-2xl rounded-bl-2xl px-5 py-4 w-full shadow-md">
              <p className="text-[13px] text-[#1B2A45]/75 leading-[2.0] font-medium">
                뭐든 필요할 때 찾으면 늦습니다.<br />
                잘될 때 그 기반으로 만들어 놔야,<br />
                힘들 때 움직일 수 있는 원동력이 됩니다.<br />
                <br />
                <span className="text-[#1B2A45]/75">옆 가게가 어려운 상황에도 사업에 투자할 수 있는 건,</span><br />
                <span className="text-[#C5A258] font-bold">시장이 어려운 지금을 기회로 바꿀 준비를 미리 해뒀기 때문입니다.</span>
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 통계 바 ── */}
      <div className="bg-[#1B2A45]">
        <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '500억+', label: '누적 승인금액' },
            { value: '1,200+', label: '계약 고객 수' },
            { value: '94%', label: '성공 승인율' },
            { value: '10년+', label: '전문 경력' },
          ].map((s, i) => (
            <div key={s.label} className={`text-center py-2 ${i < 3 ? 'md:border-r border-[#C5A258]/15' : ''}`}>
              <p className="text-2xl md:text-3xl font-black text-[#C5A258]">{s.value}</p>
              <p className="text-xs text-white/40 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 수상 / 표창 섹션 (실제 증서 스타일) ── */}
      <section className="py-16 md:py-20 px-4 bg-[#FAF8F3]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-10">
              <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase mb-2">AWARDS & CREDENTIALS</p>
              <h2 className="text-2xl md:text-3xl font-black text-[#1B2A45]">수상 및 표창 내역</h2>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {awards.map((a, i) => (
              <Reveal key={a.title} from="bottom" delay={i * 80} className="h-full">
                {/* 증서 프레임 스타일 */}
                <div className="relative bg-[#FEFCF5] border border-[#D4B968]/50 rounded-lg overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col"
                  style={{ boxShadow: '0 2px 8px rgba(197,162,88,0.12), inset 0 0 0 6px rgba(197,162,88,0.06)' }}>
                  {/* 상단 금색 띠 */}
                  <div className="h-2 bg-gradient-to-r from-[#C5A258] via-[#E8D080] to-[#C5A258] shrink-0" />
                  <div className="px-4 py-5 text-center flex flex-col flex-1">
                    {/* 태극/봉황 장식 */}
                    <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-[#C5A258]/40 flex items-center justify-center bg-[#C5A258]/5 shrink-0">
                      <span className="text-lg font-black text-[#C5A258]">{a.seal}</span>
                    </div>
                    <h3 className="text-sm font-black text-[#1B2A45] mb-2 tracking-wide shrink-0"
                      style={{ fontFamily: 'var(--font-noto-serif-kr), Georgia, serif' }}>
                      {a.title}
                    </h3>
                    <p className="text-[10px] text-[#1B2A45]/50 leading-relaxed whitespace-pre-line flex-1 mb-3">{a.body}</p>
                    <div className="border-t border-[#C5A258]/20 pt-2 shrink-0">
                      <span className="text-[10px] text-[#C5A258] font-bold tracking-widest">{a.year}</span>
                    </div>
                  </div>
                  {/* 하단 금색 띠 */}
                  <div className="h-1 bg-gradient-to-r from-[#C5A258] via-[#E8D080] to-[#C5A258] shrink-0" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 서비스 섹션 ── */}
      <section id="서비스" className="py-20 md:py-28 px-4 md:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase mb-3">SERVICES</p>
              <h2 className="text-2xl md:text-4xl font-black text-[#1B2A45] mb-3">비즈니스의 모든 것을 함께합니다</h2>
              <p className="text-sm text-[#1B2A45]/40">정책자금은 그 중 우리가 가장 잘하는 것일 뿐</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s, i) => (
              <Reveal key={s.title} from="bottom" delay={i * 50}>
                <div className={`relative group rounded-2xl p-6 border h-full transition-all cursor-default hover:scale-[1.01]
                  ${s.flagship
                    ? 'bg-gradient-to-br from-[#C5A258]/12 to-[#FAF8F3] border-[#C5A258]/50 shadow-md shadow-[#C5A258]/10'
                    : 'bg-[#FAF8F3] border-[#E8E2D4] hover:border-[#C5A258]/30 hover:shadow-sm'
                  }`}>
                  {s.flagship && (
                    <div className="absolute top-4 right-4 bg-[#C5A258] text-white text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full">
                      FLAGSHIP
                    </div>
                  )}
                  <div className="text-3xl mb-3">{s.icon}</div>
                  <h3 className={`font-bold mb-2 text-sm ${s.flagship ? 'text-[#C5A258]' : 'text-[#1B2A45]'}`}>{s.title}</h3>
                  <p className="text-xs text-[#1B2A45]/40 leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* 서비스 하단 CTA */}
          <Reveal>
            <div className="mt-14 text-center">
              <p className="text-sm text-[#1B2A45]/50 mb-5">어떤 서비스가 내 사업에 맞는지 모르겠다면, 전문가가 직접 분석해드립니다</p>
              <a href="#문의하기"
                className="inline-flex items-center gap-2 bg-[#C5A258] hover:bg-[#D4B568] text-white font-bold px-9 py-4 rounded-xl text-sm transition-all shadow-lg shadow-[#C5A258]/25 hover:scale-[1.02]">
                무료 상담 신청 →
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 성공사례 캐러셀 ── */}
      <section id="성공사례" className="py-20 px-4 bg-[#F2EFE8]">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase mb-3">SUCCESS CASES</p>
              <h2 className="text-2xl md:text-4xl font-black text-[#1B2A45] mb-3">실제 승인 성공 사례</h2>
              <p className="text-sm text-[#1B2A45]/40 mb-5">고객의 진심 어린 감사 메시지</p>
              <div className="flex flex-wrap justify-center gap-2">
                {['💐 화환을 보내주셨습니다', '🎊 승인을 축하드립니다', '🌸 함께해서 영광입니다'].map(t => (
                  <span key={t} className="text-xs text-[#C5A258]/70 border border-[#C5A258]/20 rounded-full px-3 py-1 bg-white">{t}</span>
                ))}
              </div>
            </div>
          </Reveal>

          <div className="relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0, 1].map(offset => {
                const c = successCases[(caseIdx + offset) % successCases.length]
                return (
                  <div key={`${caseIdx}-${offset}`} className="rounded-2xl overflow-hidden shadow-lg transition-all duration-500">
                    <div className={`${c.color} px-4 py-3 flex items-center gap-2`}>
                      <div className="w-7 h-7 rounded-full bg-[#FAE300] flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-[#3C1E1E]">K</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white">{c.contact}</p>
                        <p className="text-[10px] text-white/70">{c.institution}</p>
                      </div>
                      <span className="text-[10px] text-white/50 shrink-0">{c.date}</span>
                    </div>
                    <div className="bg-[#B2C7D9] px-3 py-4 space-y-2 min-h-[160px]">
                      {c.messages.map((msg, mi) => (
                        <div key={mi} className={`flex ${msg.type === 'sent' ? 'justify-end' : 'justify-start'}`}>
                          {msg.type === 'recv' && (
                            <div className="w-6 h-6 rounded-full bg-[#4A9B6F] flex items-center justify-center mr-2 shrink-0 mt-0.5">
                              <span className="text-[9px] font-bold text-white">H</span>
                            </div>
                          )}
                          <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm
                            ${msg.type === 'sent' ? 'bg-[#FAE300] text-[#1a1a1a] rounded-tr-sm' : 'bg-white text-gray-800 rounded-tl-sm'}`}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => setCaseIdx(i => (i - 1 + successCases.length) % successCases.length)}
                className="w-9 h-9 rounded-full bg-white border border-[#E8E2D4] text-[#1B2A45] flex items-center justify-center hover:border-[#C5A258] hover:text-[#C5A258] transition-all text-sm font-bold">←</button>
              <div className="flex gap-1.5">
                {successCases.map((_, i) => (
                  <button key={i} onClick={() => setCaseIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${i === caseIdx % successCases.length ? 'bg-[#C5A258] w-5' : 'bg-[#1B2A45]/20 w-1.5'}`} />
                ))}
              </div>
              <button onClick={() => setCaseIdx(i => (i + 1) % successCases.length)}
                className="w-9 h-9 rounded-full bg-white border border-[#E8E2D4] text-[#1B2A45] flex items-center justify-center hover:border-[#C5A258] hover:text-[#C5A258] transition-all text-sm font-bold">→</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── 후기 캐러셀 ── */}
      <section className="py-20 md:py-28 px-4 md:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase mb-3">REVIEWS</p>
              <h2 className="text-2xl md:text-4xl font-black text-[#1B2A45]">고객 후기</h2>
            </div>
          </Reveal>
          <div className="relative">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map(offset => {
                const r = reviews[(reviewIdx + offset) % reviews.length]
                return (
                  <div key={`${reviewIdx}-${offset}`} className="bg-[#FAF8F3] border border-[#E8E2D4] hover:border-[#C5A258]/40 rounded-2xl p-5 transition-all">
                    <div className="flex mb-3 gap-0.5">
                      {[...Array(5)].map((_, i) => <span key={i} className="text-[#C5A258] text-base">★</span>)}
                    </div>
                    <p className="text-[13px] text-[#1B2A45]/65 leading-relaxed mb-4">&ldquo;{r.text}&rdquo;</p>
                    <div className="flex items-center gap-2 border-t border-[#E8E2D4] pt-3">
                      <div className="w-8 h-8 rounded-full bg-[#C5A258]/15 flex items-center justify-center shrink-0">
                        <span className="text-xs text-[#C5A258] font-bold">{r.name.charAt(3)}</span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#1B2A45]">{r.name}</p>
                        <p className="text-[10px] text-[#1B2A45]/30">{r.industry}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => setReviewIdx(i => (i - 1 + reviews.length) % reviews.length)}
                className="w-9 h-9 rounded-full bg-white border border-[#E8E2D4] text-[#1B2A45] flex items-center justify-center hover:border-[#C5A258] hover:text-[#C5A258] transition-all text-sm font-bold">←</button>
              <div className="flex gap-1.5">
                {reviews.map((_, i) => (
                  <button key={i} onClick={() => setReviewIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${i === reviewIdx % reviews.length ? 'bg-[#C5A258] w-5' : 'bg-[#1B2A45]/20 w-1.5'}`} />
                ))}
              </div>
              <button onClick={() => setReviewIdx(i => (i + 1) % reviews.length)}
                className="w-9 h-9 rounded-full bg-white border border-[#E8E2D4] text-[#1B2A45] flex items-center justify-center hover:border-[#C5A258] hover:text-[#C5A258] transition-all text-sm font-bold">→</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CEO 소개 — 사진 자연스럽게 ── */}
      <section id="대표소개" className="relative overflow-hidden bg-[#FAF8F3]">
        {/* 빌딩숲 배경 이미지 */}
        <div className="absolute inset-0 z-0" style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1920&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          opacity: 0.28,
        }} />
        <div className="absolute inset-0 z-0 bg-[#FAF8F3]/82" />
        {/* 섹션을 좌/우 분할: 좌(텍스트) ivory, 우(사진) dark */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[#1B2A45]/90 hidden md:block z-0" />

        <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-2 gap-0 min-h-[600px] items-stretch">

          {/* 왼쪽 텍스트 */}
          <Reveal from="left" className="py-20 pr-0 md:pr-12 flex flex-col justify-center space-y-5">
            <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase">ABOUT CEO</p>
            <h2 className="text-3xl md:text-5xl font-black text-[#1B2A45] leading-tight">대표 백승협</h2>
            <p className="text-base text-[#C5A258] font-semibold">&ldquo;당신의 성공이 우리의 성공입니다&rdquo;</p>
            <p className="text-sm text-[#1B2A45]/55 leading-relaxed">
              10년이 넘는 법률·금융·경영 분야 경력을 바탕으로, 단순한 자금 알선이 아닌 기업의 근본적인 성장을 함께 설계합니다. 법무법인부터 세계 기관까지 다양한 현장에서 쌓은 실전 경험이 고객의 성공을 만듭니다.
            </p>
            <div className="space-y-2.5">
              {[
                { p: '學', t: '자산경영학 전공' },
                { p: '前', t: '법무법인 혜안 소속' },
                { p: '前', t: 'PUREBROWN 대표이사' },
                { p: '前', t: '㈜나라감정평가법인 소속' },
                { p: '前', t: 'GIGGLY 대표이사' },
                { p: '現', t: '세계탐정연맹본부(WDF) 전문위원' },
                { p: '現', t: 'HUNDRED consulting 대표' },
              ].map(item => (
                <div key={item.t} className="flex items-center gap-3">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0
                    ${item.p === '現' ? 'bg-[#C5A258] text-white' : item.p === '學' ? 'bg-[#7B5EA7]/20 text-[#7B5EA7]' : 'bg-[#1B2A45]/10 text-[#1B2A45]/40'}`}>
                    {item.p}
                  </span>
                  <span className="text-sm text-[#1B2A45]/65">{item.t}</span>
                </div>
              ))}
            </div>
          </Reveal>

          {/* 오른쪽 사진 — 다크 배경에 자연스럽게 */}
          <Reveal from="right" className="relative flex items-end justify-center md:justify-start py-8 md:py-0">
            <div className="relative w-full max-w-[340px] h-[480px] md:h-full">
              <Image
                src="/images/ceo-stand.png"
                alt="백승협 대표"
                fill
                className="object-contain object-bottom"
                style={{ filter: 'drop-shadow(0 0 30px rgba(197,162,88,0.15))' }}
                unoptimized
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 강의·강연 섹션 ── */}
      <section className="py-20 md:py-28 px-4 md:px-8 bg-[#1B2A45] overflow-hidden">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          <Reveal from="left" className="relative">
            <div className="absolute -inset-3 bg-[#C5A258]/5 rounded-3xl" />
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-[#C5A258]/20">
              <Image src="/images/lecture.png" alt="백승협 대표 강의 현장"
                width={700} height={500} className="w-full object-cover" unoptimized />
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                <span className="bg-[#C5A258] text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg">📍 소상공인 정책자금 실전 강의</span>
                <span className="bg-[#1B2A45]/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/10">수강생 200명+ 직강 완료</span>
              </div>
            </div>
          </Reveal>

          <Reveal from="right" className="space-y-6 text-white">
            <div>
              <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase mb-3">LECTURE & SEMINAR</p>
              <h2 className="text-3xl md:text-4xl font-black leading-tight mb-4">
                전국에서<br /><span className="text-[#C5A258]">검증된 전문가</span>
              </h2>
              <p className="text-sm text-white/60 leading-relaxed">
                정책자금, 법인설립, 경영전략 등 기업 성장에 필요한 모든 분야를 전국 각지에서 직접 강의하며 수천 명의 대표님들과 함께했습니다. 책에서 배운 지식이 아닌, 현장에서 쌓은 실전 노하우를 나눕니다.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { num: '50+', label: '누적 강의 횟수' },
                { num: '3,000+', label: '수강 대표님' },
                { num: '15개', label: '강의 지역' },
                { num: '98%', label: '수강생 만족도' },
              ].map(s => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-2xl font-black text-[#C5A258]">{s.num}</p>
                  <p className="text-xs text-white/40 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-white/40 mb-3">주요 강의 주제</p>
              <div className="flex flex-wrap gap-2">
                {['정책자금 실전 활용', '소상공인 자금조달', '법인전환 전략', '정부지원사업 공략법', '사업계획서 작성법', '기업 신용관리'].map(tag => (
                  <span key={tag} className="text-xs border border-[#C5A258]/30 text-[#C5A258]/80 px-3 py-1 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
            <a href="#문의하기"
              className="inline-flex items-center gap-2 bg-[#C5A258] hover:bg-[#D4B568] text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-[#C5A258]/20">
              강의 문의하기 →
            </a>
          </Reveal>
        </div>
      </section>

      {/* ── 현장 컨설팅 섹션 ── */}
      <section className="py-20 px-4 bg-[#F2EFE8]">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase mb-2">FIELD CONSULTING</p>
              <h2 className="text-2xl md:text-4xl font-black text-[#1B2A45] mb-2">현장에서 함께합니다</h2>
              <p className="text-sm text-[#1B2A45]/50">직접 찾아가는 1:1 밀착 컨설팅</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {[
              {
                // 건설현장 — 실제 공사 현장 작업자들
                photo: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&q=80',
                caption: '건설업 대표님과 현장 미팅', badge: '정책자금 3억 승인',
              },
              {
                // 한식당 주방 — 실제 주방 조리 장면
                photo: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
                caption: '요식업 대표님 매장 방문 상담', badge: '소진공 1억 승인',
              },
              {
                // 소규모 사무실 미팅
                photo: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80',
                caption: '인테리어 업체 사무실 방문', badge: '기보 2억 승인',
              },
              {
                // 공장 생산 라인 실제 현장
                photo: 'https://images.unsplash.com/photo-1518314916381-77a37c2a49ae?w=800&q=80',
                caption: '제조업 공장 현장 방문 상담', badge: '신보 5억 승인',
              },
              {
                // 소매점 / 매장 내부
                photo: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80',
                caption: '소매업 대표님 직접 방문', badge: '무상지원금 5천만원',
              },
              {
                // 스타트업 팀 실무 미팅
                photo: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&q=80',
                caption: '스타트업 대표님 사무실 미팅', badge: '벤처인증 + 정책자금',
              },
            ].map((s, i) => (
              <Reveal key={i} from="bottom" delay={i * 60}>
                <div className="relative rounded-2xl overflow-hidden aspect-[4/3] shadow-lg hover:scale-[1.02] transition-transform cursor-default group">
                  {/* 실제 사진 */}
                  <div className="absolute inset-0" style={{
                    backgroundImage: `url(${s.photo})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    transition: 'transform 0.4s ease',
                  }} />
                  {/* 어두운 그라데이션 오버레이 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  {/* 텍스트 */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-xs font-semibold leading-snug mb-1.5 drop-shadow">{s.caption}</p>
                    <span className="text-[10px] bg-[#C5A258] text-white font-bold px-2 py-0.5 rounded-full">{s.badge}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 문의 섹션 ── */}
      <section id="문의하기" className="py-20 md:py-28 px-4 md:px-8 bg-white">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">

          <Reveal from="left" className="space-y-6">
            <div>
              <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] uppercase mb-3">CONTACT</p>
              <h2 className="text-2xl md:text-4xl font-black text-[#1B2A45] mb-2">무료 상담 신청</h2>
              <p className="text-sm text-[#1B2A45]/40">남겨주신 정보로 담당자가 빠르게 연락드립니다.</p>
            </div>
            <div className="space-y-4">
              {[
                { icon: '📍', label: '주소', value: '서울특별시 구로구 디지털로 243 지하이시티 911호' },
                { icon: '📞', label: '전화', value: '1844-2599' },
                { icon: '✉️', label: '이메일', value: '100-house@naver.com' },
                { icon: '🕐', label: '운영시간', value: '평일 09:00 – 18:00 (토/일 휴무)' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <span className="text-lg mt-0.5 shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-[10px] text-[#1B2A45]/30 mb-0.5">{item.label}</p>
                    <p className="text-sm text-[#1B2A45]/70">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* SNS 링크 — 링크 연결 예정 */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { l: '카카오톡', e: '💬', href: 'https://open.kakao.com/' }, // TODO: 실제 카카오톡 링크로 변경
                { l: '인스타그램', e: '📸', href: 'https://instagram.com/' }, // TODO: 실제 인스타그램 링크로 변경
                { l: '유튜브', e: '▶️', href: 'https://youtube.com/' }, // TODO: 실제 유튜브 링크로 변경
              ].map(s => (
                <a key={s.l} href={s.href} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 border border-[#E8E2D4] hover:border-[#C5A258]/40 rounded-lg px-3 py-2 text-xs text-[#1B2A45]/50 hover:text-[#C5A258] transition-all">
                  {s.e} {s.l}
                </a>
              ))}
            </div>
          </Reveal>

          <Reveal from="right">
            {submitted ? (
              <div className="bg-[#FAF8F3] border border-[#C5A258]/30 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-4">✅</div>
                <h3 className="text-lg font-bold text-[#1B2A45] mb-2">상담 신청이 완료됐습니다!</h3>
                <p className="text-sm text-[#1B2A45]/50">담당자가 빠른 시간 내에 연락드리겠습니다.</p>
                <p className="text-xs text-[#C5A258] mt-4">📞 급하신 분은 1844-2599로 바로 연락주세요</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-[#FAF8F3] border border-[#E8E2D4] rounded-2xl p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#1B2A45]/50 mb-1.5 font-medium">이름 *</label>
                    <input type="text" required value={formData.name}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-white border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-3 py-2.5 text-sm text-[#1B2A45] placeholder-[#1B2A45]/20 outline-none transition-colors"
                      placeholder="홍길동" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#1B2A45]/50 mb-1.5 font-medium">지역</label>
                    <select value={formData.region}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData(p => ({ ...p, region: e.target.value }))}
                      className="w-full bg-white border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-3 py-2.5 text-sm text-[#1B2A45] outline-none transition-colors">
                      <option value="">선택</option>
                      {['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#1B2A45]/50 mb-1.5 font-medium">연락처 *</label>
                    <input type="tel" required value={formData.phone}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, phone: e.target.value }))}
                      className="w-full bg-white border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-3 py-2.5 text-sm text-[#1B2A45] placeholder-[#1B2A45]/20 outline-none transition-colors"
                      placeholder="010-0000-0000" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#1B2A45]/50 mb-1.5 font-medium">회사명</label>
                    <input type="text" value={formData.company}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, company: e.target.value }))}
                      className="w-full bg-white border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-3 py-2.5 text-sm text-[#1B2A45] placeholder-[#1B2A45]/20 outline-none transition-colors"
                      placeholder="(주)홍길동상사" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#1B2A45]/50 mb-2 font-medium">문의 유형 (복수 선택 가능)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['정책자금','이노비즈/메인비즈 인증','무상지원금','벤처기업 인증','법인설립','특허/가출원','광고·마케팅','자영업 컨설팅','기타'].map(type => (
                      <label key={type} className={`flex items-center gap-2 border rounded-lg px-2.5 py-2 cursor-pointer transition-all text-xs
                        ${inquiryTypes.includes(type) ? 'border-[#C5A258] bg-[#C5A258]/10 text-[#C5A258] font-semibold' : 'border-[#E8E2D4] text-[#1B2A45]/60 hover:border-[#C5A258]/40 bg-white'}`}>
                        <input type="checkbox" checked={inquiryTypes.includes(type)} onChange={() => toggleInquiry(type)} className="hidden" />
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${inquiryTypes.includes(type) ? 'border-[#C5A258] bg-[#C5A258]' : 'border-current'}`}>
                          {inquiryTypes.includes(type) && <span className="text-white text-[8px]">✓</span>}
                        </span>
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#1B2A45]/50 mb-2 font-medium">세금체납 여부</label>
                  <div className="flex flex-wrap gap-4">
                    {['없음', '있음(납부예정)', '있음(현재체납)'].map(opt => (
                      <label key={opt} className={`flex items-center gap-2 cursor-pointer text-sm ${formData.taxStatus === opt ? 'text-[#C5A258] font-semibold' : 'text-[#1B2A45]/60'}`}>
                        <input type="radio" name="taxStatus" value={opt} checked={formData.taxStatus === opt}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData(p => ({ ...p, taxStatus: e.target.value }))}
                          className="accent-[#C5A258]" />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#1B2A45]/50 mb-1.5 font-medium">문의 내용</label>
                  <textarea rows={3} value={formData.message}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormData(p => ({ ...p, message: e.target.value }))}
                    className="w-full bg-white border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-3 py-2.5 text-sm text-[#1B2A45] placeholder-[#1B2A45]/20 outline-none transition-colors resize-none"
                    placeholder="필요한 자금 규모나 현재 상황을 간단히 적어주세요." />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm transition-all hover:scale-[1.01]">
                  {submitting ? '전송 중...' : '상담 신청하기 →'}
                </button>
              </form>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="bg-[#1B2A45] border-t border-[#C5A258]/10 py-4 px-4 md:px-8">
        <div className="max-w-6xl mx-auto">

          {/* 메인 행: 로고 | contact | 퀵메뉴 */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">

            {/* 로고 */}
            <div className="relative h-7 w-20 shrink-0">
              <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain object-left" unoptimized />
            </div>

            {/* Contact — 모바일에서도 한 줄 */}
            <div className="flex items-center gap-3 text-[11px] text-white/35 flex-wrap">
              <span>📞 1844-2599</span>
              <span className="hidden sm:inline">✉️ 100-house@naver.com</span>
              <span className="hidden lg:inline">📍 서울 구로구 디지털로 243 지하이시티 911호</span>
              <span className="hidden md:inline">🕐 평일 09:00–18:00</span>
            </div>

            {/* 퀵메뉴 */}
            <div className="flex items-center gap-3">
              {['서비스', '성공사례', '대표소개', '문의하기'].map(label => (
                <a key={label} href={`#${label}`}
                  className="text-[11px] text-white/35 hover:text-[#C5A258] transition-colors whitespace-nowrap">
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* 카피라이트 */}
          <p className="text-[10px] text-white/15 text-center mt-3 pt-3 border-t border-white/5">
            © 2025 HUNDRED Consultancy. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
