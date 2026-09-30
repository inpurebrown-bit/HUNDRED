'use client'

import { useEffect, useState } from 'react'

const SLIDES = [
  {
    tab: '자금 전략',
    en: 'Funding Strategy',
    title: '기업의 성장 단계에 맞는\n자금 전략을 설계합니다',
    desc: '정밀한 재무·기술성 진단을 바탕으로 기관별 요건을 꼼꼼히 검토하고,\n성장 단계에 맞는 정책자금 전략을 제안합니다.',
    img: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=2000&q=75',
  },
  {
    tab: '지원사업',
    en: 'Opportunity Map',
    title: '놓치기 쉬운 지원의 기회,\n먼저 찾아 준비합니다',
    desc: '창업·R&D·수출·고용 등 기업 단계별 정부지원사업을 발굴하고\n공고 일정에 맞춰 준비 방향을 함께 정리합니다.',
    img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=2000&q=75',
  },
  {
    tab: '기업 인증',
    en: 'Trust & Credentials',
    title: '기업의 신뢰를 높이는\n인증 컨설팅',
    desc: '벤처기업확인·이노비즈·메인비즈·기업부설연구소 등\n인증 요건을 사전 진단하고 취득 로드맵을 제안합니다.',
    img: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=2000&q=75',
  },
  {
    tab: '성장 로드맵',
    en: 'Growth Roadmap',
    title: '사업에서 기업으로,\n다음 단계를 함께 그립니다',
    desc: '법인 전환 시점 검토부터 마케팅 전략까지,\n성장에 필요한 과제를 한 곳에서 설계합니다.',
    img: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=2000&q=75',
  },
]
const INTERVAL = 6500

export default function HeroSlider() {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => { setIdx(i => (i + 1) % SLIDES.length); setTick(k => k + 1) }, INTERVAL)
    return () => clearTimeout(t)
  }, [idx, playing, tick])

  const go = (n: number) => { setIdx((n + SLIDES.length) % SLIDES.length); setTick(k => k + 1) }
  const s = SLIDES[idx]

  return (
    <section className="relative h-[100svh] min-h-[600px] max-h-[920px] overflow-hidden bg-[#05080f] text-white">
      <style>{`
        @keyframes hsZoom { from { transform: scale(1.02) } to { transform: scale(1.12) } }
        @keyframes hsBar { from { width: 0 } to { width: 100% } }
        @keyframes hsUp { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
        .hs-zoom { animation: hsZoom 9s ease-out forwards; }
        .hs-up { opacity: 0; animation: hsUp .9s ease-out forwards; }
      `}</style>

      {SLIDES.map((sl, i) => (
        <div key={sl.en} className={`absolute inset-0 transition-opacity duration-[1400ms] ${i === idx ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`absolute inset-0 bg-cover bg-center ${i === idx ? 'hs-zoom' : ''}`}
            style={{ backgroundImage: `url(${sl.img})`, filter: 'grayscale(35%) contrast(1.05)' }} />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-[#03060c] via-[#03060c]/85 to-[#03060c]/35" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#03060c]/70 via-transparent to-[#03060c]/85" />
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#C5A258 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      {/* 문구: 왼쪽 정렬 */}
      <div className="relative z-10 h-full max-w-6xl mx-auto px-5 md:px-8 flex items-center">
        <div key={idx} className="max-w-2xl pt-10">
          <div className="hs-up flex items-center gap-3 mb-6" style={{ animationDelay: '0.1s' }}>
            <span className="text-[#C5A258] font-black text-sm tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
            <span className="w-10 h-px bg-[#C5A258]/70" />
            <span className="text-[11px] md:text-xs font-semibold tracking-[0.3em] uppercase text-white/70">{s.en}</span>
          </div>
          <h1 className="hs-up text-3xl sm:text-4xl md:text-6xl font-black leading-[1.25] whitespace-pre-line tracking-tight" style={{ animationDelay: '0.25s' }}>
            {s.title}
          </h1>
          <p className="hs-up mt-6 md:mt-8 text-sm md:text-base text-white/65 leading-relaxed whitespace-pre-line" style={{ animationDelay: '0.5s' }}>
            {s.desc}
          </p>
          <div className="hs-up mt-9 flex flex-wrap gap-3" style={{ animationDelay: '0.7s' }}>
            <a href="#문의하기" className="bg-[#C5A258] hover:bg-[#D4B568] text-[#0b1220] font-bold px-7 py-3 rounded-md text-sm transition-colors">무료 상담 신청</a>
            <a href="#서비스" className="border border-white/25 hover:border-white/60 text-white/90 font-medium px-7 py-3 rounded-md text-sm transition-colors">서비스 살펴보기 →</a>
          </div>
        </div>
      </div>

      {/* 하단: 번호 탭(진행 바 포함) + 사각 화살표 */}
      <div className="absolute z-10 bottom-0 left-0 right-0">
        <div className="max-w-6xl mx-auto px-5 md:px-8 pb-7 md:pb-9 flex items-end justify-between gap-6">
          <div className="grid grid-cols-4 gap-3 md:gap-5 flex-1 max-w-2xl">
            {SLIDES.map((sl, i) => (
              <button key={sl.en} onClick={() => go(i)} className="text-left group">
                <div className="h-[2px] bg-white/20 overflow-hidden mb-2.5">
                  {i === idx
                    ? <div key={`${tick}-${playing}`} className="h-full bg-[#C5A258]" style={playing ? { animation: `hsBar ${INTERVAL}ms linear forwards` } : { width: '100%' }} />
                    : <div className={`h-full bg-[#C5A258]/60 ${i < idx ? 'w-full' : 'w-0'}`} />}
                </div>
                <p className={`text-[10px] tabular-nums transition-colors ${i === idx ? 'text-[#C5A258]' : 'text-white/35 group-hover:text-white/60'}`}>{String(i + 1).padStart(2, '0')}</p>
                <p className={`text-[11px] md:text-xs font-semibold transition-colors ${i === idx ? 'text-white' : 'text-white/45 group-hover:text-white/75'}`}>{sl.tab}</p>
              </button>
            ))}
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <button onClick={() => setPlaying(p => !p)} className="text-[10px] tracking-[0.2em] text-white/50 hover:text-white px-3 py-2">{playing ? 'PAUSE' : 'PLAY'}</button>
            <button onClick={() => go(idx - 1)} aria-label="이전" className="w-10 h-10 border border-white/25 hover:bg-white/10 flex items-center justify-center text-sm">←</button>
            <button onClick={() => go(idx + 1)} aria-label="다음" className="w-10 h-10 border border-white/25 hover:bg-white/10 flex items-center justify-center text-sm">→</button>
          </div>
        </div>
      </div>
    </section>
  )
}
