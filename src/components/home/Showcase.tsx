'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'
import Image from 'next/image'
import { CERT_EXAMPLES, SITE_PHOTOS, TEAM, REVIEWS } from '@/lib/showcase'

// 옆으로 넘기는 슬라이드: 4초마다 한 칸, 마우스를 올리거나 손으로 넘기는 동안은 멈춘다
function Slider({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hold, setHold] = useState(false)
  const step = (dir: number) => {
    const el = ref.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    const w = (card?.offsetWidth || 300) + 16
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8
    el.scrollTo({ left: dir > 0 && end ? 0 : el.scrollLeft + dir * w, behavior: 'smooth' })
  }
  useEffect(() => {
    if (hold) return
    const id = setInterval(() => step(1), 4000)
    return () => clearInterval(id)
  }, [hold])
  return (
    <div className="relative" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onTouchStart={() => setHold(true)} onTouchEnd={() => setTimeout(() => setHold(false), 4000)}>
      <div ref={ref} aria-label={label} className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
      <button type="button" onClick={() => step(-1)} aria-label="이전" className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg border border-[#E8E2D4] text-[#1B2A45] font-black">‹</button>
      <button type="button" onClick={() => step(1)} aria-label="다음" className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-white shadow-lg border border-[#E8E2D4] text-[#1B2A45] font-black">›</button>
    </div>
  )
}

function Head({ kicker, title, desc, dark }: { kicker: string; title: string; desc: string; dark?: boolean }) {
  return (
    <div className="text-center mb-10">
      <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] mb-3">{kicker}</p>
      <h2 className={`text-2xl md:text-4xl font-black ${dark ? 'text-white' : ''}`}>{title}</h2>
      <p className={`text-sm mt-3 ${dark ? 'text-white/55' : 'text-[#1B2A45]/45'}`}>{desc}</p>
    </div>
  )
}

// 끊김 없이 옆으로 흐르는 줄. 목록을 두 번 이어 붙여 반 바퀴마다 처음과 맞물린다. 마우스를 올리면 잠시 멈춘다
function Marquee({ children, seconds, reverse }: { children: ReactNode; seconds: number; reverse?: boolean }) {
  return (
    <div className="hc-mq overflow-hidden">
      <div className="hc-mq-track flex w-max" style={{ ['--hc-sec' as string]: `${seconds}s`, animationDirection: reverse ? 'reverse' : 'normal' }}>
        {[0, 1].map(k => <div key={k} className="flex" aria-hidden={k === 1}>{children}</div>)}
      </div>
    </div>
  )
}

export default function Showcase({ part }: { part: 'site' | 'team' | 'cert' }) {
  return (
    <>
      <style>{`
        @keyframes hcMq { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        /* 전체의 '움직임 줄이기' 규칙보다 우선: 이 두 줄은 항상 흐른다(마우스를 올리면 멈춤) */
        .hc-mq .hc-mq-track { animation-name: hcMq; animation-timing-function: linear; animation-duration: var(--hc-sec) !important; animation-iteration-count: infinite !important; }
        .hc-mq:hover .hc-mq-track { animation-play-state: paused; }
      `}</style>

      {part === 'cert' && CERT_EXAMPLES.length > 0 && (
        <section id="지원사례" className="py-20 md:py-24 bg-[#FAF8F3]">
          <div className="px-4"><Head kicker="CERTIFICATION" title="준비할 수 있는 인증" desc="어떤 인증을 준비할 수 있는지 보여 드립니다." /></div>
          <Marquee seconds={60}>
            {CERT_EXAMPLES.map(c => (
              <div key={c.img} className="relative mr-4 w-52 md:w-60 aspect-[3/4] shrink-0 rounded-2xl overflow-hidden border border-[#E8E2D4] bg-white text-left">
                <div className="absolute inset-x-3 top-4 bottom-14">
                  <Image src={c.img} alt={`${c.title} (개인정보 가림)`} fill className="object-contain" unoptimized />
                </div>
                <span className="absolute inset-x-0 bottom-0 px-4 pb-3.5 text-sm font-bold text-[#1B2A45]">{c.title}</span>
              </div>
            ))}
          </Marquee>
        </section>
      )}

      {part === 'site' && SITE_PHOTOS.length > 0 && (
        <section id="현장" className="py-20 md:py-24 bg-[#0d1626]">
          <div className="px-4"><Head dark kicker="ON SITE" title="현장에서 확인합니다" desc="서류만 보지 않고 사업장의 설비와 작업 흐름을 직접 확인합니다." /></div>
          <Marquee seconds={55} reverse>
            {SITE_PHOTOS.map(p => (
              <div key={p.img} className="relative mr-4 w-56 md:w-72 aspect-[3/4] shrink-0 rounded-2xl overflow-hidden text-left">
                <Image src={p.img} alt={p.label} fill className="object-cover" unoptimized />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-4 text-sm font-bold text-white">{p.label}</span>
              </div>
            ))}
          </Marquee>
        </section>
      )}

      {part === 'team' && TEAM.length > 0 && (
        <section id="구성원" className="py-20 md:py-24 px-4 md:px-8 bg-[#FAF8F3]">
          <div className="max-w-6xl mx-auto">
            <Head kicker="OUR TEAM" title="함께하는 사람들" desc="상담부터 사후관리까지 담당자가 이어서 맡습니다." />
            <div className="space-y-12 md:space-y-16">
              {TEAM.map((m, i) => (
                <div key={m.img} className="grid md:grid-cols-2 gap-6 md:gap-12 items-center">
                  <div className={`relative aspect-[4/3] w-full rounded-2xl overflow-hidden shadow-xl ${i % 2 ? 'md:order-2' : ''}`}>
                    <Image src={m.img} alt={m.title} fill className="object-cover" unoptimized />
                  </div>
                  <div>
                    <p className="text-xs text-[#C5A258] font-bold tracking-[0.3em] mb-3">{m.kicker}</p>
                    <h3 className="text-xl md:text-3xl font-black leading-snug break-keep">{m.title}</h3>
                    <div className="w-12 h-1 bg-[#C5A258] rounded my-5" />
                    <div className="space-y-3">
                      {m.body.map(p => <p key={p} className="text-sm md:text-base text-[#1B2A45]/70 leading-relaxed break-keep">{p}</p>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {part === 'team' && REVIEWS.length > 0 && (
        <section id="후기" className="py-20 md:py-24 px-4 md:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <Head kicker="VOICE" title="대표님들의 이야기" desc="공개에 동의해 주신 분들의 말씀입니다. 개인의 경험이며 결과는 기업마다 다릅니다." />
            <Slider label="고객 후기">
              {REVIEWS.map((r, i) => (
                <blockquote key={i} className="w-72 md:w-96 shrink-0 snap-start rounded-2xl bg-[#1B2A45] text-white p-6">
                  <p className="text-sm leading-relaxed text-white/85">&ldquo;{r.text}&rdquo;</p>
                  <footer className="mt-4 text-xs text-[#C5A258] font-bold">{r.name} · {r.industry}</footer>
                </blockquote>
              ))}
            </Slider>
          </div>
        </section>
      )}

    </>
  )
}
