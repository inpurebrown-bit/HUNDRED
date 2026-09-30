'use client'

import { useEffect, useState } from 'react'

const SLIDES = [
  {
    en: 'Policy Fund Consulting',
    title: '기업의 성장 단계에 맞는\n자금 전략을 설계합니다',
    desc: '정밀한 재무·기술성 진단을 바탕으로 기관별 요건을 꼼꼼히 검토하고,\n성장 단계에 맞는 정책자금 전략을 제안합니다.',
    img: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=2000&q=75',
  },
  {
    en: 'Government Support Program',
    title: '놓치기 쉬운 지원의 기회,\n먼저 찾아 준비합니다',
    desc: '창업·R&D·수출·고용 등 기업 단계별 정부지원사업을 발굴하고\n공고 일정에 맞춰 준비 방향을 함께 정리합니다.',
    img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=2000&q=75',
  },
  {
    en: 'Certification Consulting',
    title: '기업의 신뢰를 높이는\n인증 컨설팅',
    desc: '벤처기업확인·이노비즈·메인비즈·기업부설연구소 등\n인증 요건을 사전 진단하고 취득 로드맵을 제안합니다.',
    img: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=2000&q=75',
  },
  {
    en: 'Business Growth',
    title: '사업에서 기업으로,\n다음 단계를 함께 그립니다',
    desc: '법인 전환 시점 검토부터 마케팅 전략까지,\n성장에 필요한 과제를 한 곳에서 설계합니다.',
    img: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=2000&q=75',
  },
]
const INTERVAL = 6500

export default function HeroSlider() {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [tick, setTick] = useState(0) // 진행 바 재시작용

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => { setIdx(i => (i + 1) % SLIDES.length); setTick(k => k + 1) }, INTERVAL)
    return () => clearTimeout(t)
  }, [idx, playing, tick])

  const go = (n: number) => { setIdx((n + SLIDES.length) % SLIDES.length); setTick(k => k + 1) }

  return (
    <section className="relative h-[100svh] min-h-[560px] max-h-[900px] overflow-hidden bg-[#05080f] text-white">
      <style>{`
        @keyframes hsZoom { from { transform: scale(1.02) } to { transform: scale(1.12) } }
        @keyframes hsBar { from { width: 0 } to { width: 100% } }
        @keyframes hsUp { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: translateY(0) } }
        .hs-zoom { animation: hsZoom 9s ease-out forwards; }
        .hs-up { opacity: 0; animation: hsUp .9s ease-out forwards; }
      `}</style>

      {/* 배경 이미지: 어둡게 깔고 건물 윤곽만 언뜻 보이도록 */}
      {SLIDES.map((s, i) => (
        <div key={s.en} className={`absolute inset-0 transition-opacity duration-[1400ms] ${i === idx ? 'opacity-100' : 'opacity-0'}`}>
          <div className={`absolute inset-0 bg-cover bg-center ${i === idx ? 'hs-zoom' : ''}`}
            style={{ backgroundImage: `url(${s.img})`, filter: 'grayscale(35%) contrast(1.05)' }} />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-[#03060c] via-[#03060c]/85 to-[#03060c]/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#03060c]/70 via-transparent to-[#03060c]/80" />
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'radial-gradient(#C5A258 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      {/* 문구 */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-5">
        <div key={idx} className="max-w-3xl">
          <p className="hs-up text-xs md:text-sm font-bold tracking-[0.4em] text-[#C5A258] mb-5" style={{ animationDelay: '0.1s' }}>{SLIDES[idx].en.toUpperCase()}</p>
          <div className="hs-up w-10 h-px bg-[#C5A258]/70 mx-auto mb-6" style={{ animationDelay: '0.2s' }} />
          <h1 className="hs-up text-3xl sm:text-4xl md:text-6xl font-black leading-[1.25] whitespace-pre-line tracking-tight" style={{ animationDelay: '0.3s' }}>
            {SLIDES[idx].title}
          </h1>
          <p className="hs-up mt-6 md:mt-8 text-sm md:text-base text-white/70 leading-relaxed whitespace-pre-line" style={{ animationDelay: '0.55s' }}>
            {SLIDES[idx].desc}
          </p>
          <div className="hs-up mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: '0.75s' }}>
            <a href="#문의하기" className="bg-[#C5A258] hover:bg-[#D4B568] text-white font-bold px-7 py-3 rounded-lg text-sm transition-colors">무료 상담 신청</a>
            <a href="#서비스" className="border border-white/30 hover:bg-white/10 text-white font-semibold px-7 py-3 rounded-lg text-sm transition-colors">서비스 살펴보기</a>
          </div>
        </div>
      </div>

      {/* 컨트롤: 진행 바 + 이전/일시정지/다음 */}
      <div className="absolute z-10 bottom-8 md:bottom-12 left-0 right-0 flex items-center justify-center gap-6 px-5">
        <div className="hidden sm:block w-40 md:w-52 h-[3px] bg-white/20 rounded overflow-hidden">
          <div key={`${idx}-${tick}-${playing}`} className="h-full bg-white"
            style={playing ? { animation: `hsBar ${INTERVAL}ms linear forwards` } : { width: '100%' }} />
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => go(idx - 1)} aria-label="이전" className="w-10 h-10 rounded-full border border-white/40 hover:bg-white/15 flex items-center justify-center text-lg">‹</button>
          <button onClick={() => setPlaying(p => !p)} aria-label={playing ? '일시정지' : '재생'} className="w-11 h-11 rounded-full bg-white text-[#0b1220] flex items-center justify-center text-sm font-black">
            {playing ? '❚❚' : '▶'}
          </button>
          <button onClick={() => go(idx + 1)} aria-label="다음" className="w-10 h-10 rounded-full border border-white/40 hover:bg-white/15 flex items-center justify-center text-lg">›</button>
        </div>
        <p className="hidden sm:block text-xs text-white/50 tabular-nums w-16">{String(idx + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</p>
      </div>
    </section>
  )
}
