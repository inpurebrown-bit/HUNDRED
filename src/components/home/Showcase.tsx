'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'
import Image from 'next/image'
import { CERTS, SITE_PHOTOS, TEAM, REVIEWS } from '@/lib/showcase'

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
    if (hold || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => step(1), 4000)
    return () => clearInterval(id)
  }, [hold])
  return (
    <div className="relative" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} onTouchStart={() => setHold(true)}>
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

export default function Showcase() {
  const [zoom, setZoom] = useState<string | null>(null)
  return (
    <>
      {CERTS.length > 0 && (
        <section id="지원사례" className="py-20 md:py-24 px-4 md:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <Head kicker="CERTIFICATION" title="인증 지원 사례" desc="고객 기업이 받은 확인서입니다. 개인정보와 문서번호는 가렸습니다." />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {CERTS.map(c => (
                <button key={c.img} type="button" onClick={() => setZoom(c.img)} className="group text-left bg-[#FAF8F3] border border-[#E8E2D4] rounded-2xl p-4 hover:shadow-xl hover:-translate-y-1 transition-all">
                  <div className="relative aspect-[3/4] bg-white rounded-lg shadow-md overflow-hidden">
                    <Image src={c.img} alt={`${c.title} 확인서 (개인정보 가림)`} fill className="object-contain" unoptimized />
                  </div>
                  <p className="text-base font-black mt-4">{c.title}</p>
                  <p className="text-xs text-[#1B2A45]/55 mt-1">{c.date} · {c.org}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#1B2A45]/40 text-center mt-6">※ 인증·확인 가능 여부는 기업의 요건과 해당 기관의 심사에 따라 달라집니다.</p>
          </div>
        </section>
      )}

      {SITE_PHOTOS.length > 0 && (
        <section id="현장" className="py-20 md:py-24 px-4 md:px-8 bg-[#0d1626]">
          <div className="max-w-6xl mx-auto">
            <Head dark kicker="ON SITE" title="현장에서 확인합니다" desc="서류만 보지 않고 사업장의 설비와 작업 흐름을 직접 확인합니다." />
            <Slider label="현장 사진">
              {SITE_PHOTOS.map(p => (
                <figure key={p.img} className="relative w-64 md:w-80 aspect-[3/4] shrink-0 snap-start rounded-2xl overflow-hidden">
                  <Image src={p.img} alt={p.label} fill className="object-cover" unoptimized />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-4 text-sm font-bold text-white">{p.label}</figcaption>
                </figure>
              ))}
            </Slider>
          </div>
        </section>
      )}

      {TEAM.length > 0 && (
        <section id="구성원" className="py-20 md:py-24 px-4 md:px-8 bg-[#FAF8F3]">
          <div className="max-w-6xl mx-auto">
            <Head kicker="OUR TEAM" title="함께하는 사람들" desc="상담부터 사후관리까지 담당자가 이어서 맡습니다." />
            <Slider label="구성원 사진">
              {TEAM.map(m => (
                <figure key={m.img} className="w-56 md:w-64 shrink-0 snap-start rounded-2xl overflow-hidden bg-white border border-[#E8E2D4]">
                  <div className="relative aspect-[3/4]"><Image src={m.img} alt={`${m.name} ${m.role}`} fill className="object-cover" unoptimized /></div>
                  <figcaption className="px-4 py-3"><p className="text-sm font-black">{m.name}</p><p className="text-xs text-[#1B2A45]/55">{m.role}</p></figcaption>
                </figure>
              ))}
            </Slider>
          </div>
        </section>
      )}

      {REVIEWS.length > 0 && (
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

      {zoom && (
        <div role="dialog" aria-modal="true" onClick={() => setZoom(null)} className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4 cursor-zoom-out">
          <img src={zoom} alt="확인서 확대 (개인정보 가림)" className="max-h-full max-w-full rounded-lg shadow-2xl" />
        </div>
      )}
    </>
  )
}
