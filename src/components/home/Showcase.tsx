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

// 인증 예시 두 장마다 현장 사진 한 장을 섞는다
const MIXED = (() => {
  const out: { img: string; title: string; kind: '예시' | '현장' }[] = []
  let s = 0
  CERT_EXAMPLES.forEach((c, i) => {
    out.push({ img: c.img, title: c.title, kind: '예시' })
    if (i % 2 === 1 && SITE_PHOTOS[s]) { out.push({ img: SITE_PHOTOS[s].img, title: SITE_PHOTOS[s].label, kind: '현장' }); s++ }
  })
  SITE_PHOTOS.slice(s).forEach(p => out.push({ img: p.img, title: p.label, kind: '현장' }))
  return out
})()

export default function Showcase() {
  const [zoom, setZoom] = useState<string | null>(null)
  return (
    <>
      {MIXED.length > 0 && (
        <section id="지원사례" className="py-20 md:py-24 px-4 md:px-8 bg-white">
          <div className="max-w-6xl mx-auto">
            <Head kicker="CERTIFICATION & ON SITE" title="준비할 수 있는 인증, 직접 보는 현장" desc="어떤 인증을 준비할 수 있는지 예시로 보여 드리고, 사업장은 직접 확인합니다." />
            <Slider label="인증 예시와 현장 사진">
              {MIXED.map(m => (
                <button key={m.img} type="button" onClick={() => setZoom(m.img)} className="relative w-64 md:w-72 aspect-[3/4] shrink-0 snap-start rounded-2xl overflow-hidden border border-[#E8E2D4] bg-[#FAF8F3] text-left">
                  <span className={`absolute left-3 top-3 z-10 text-[11px] font-black rounded-full px-2.5 py-1 ${m.kind === '예시' ? 'bg-[#1B2A45] text-white' : 'bg-[#C5A258] text-white'}`}>{m.kind}</span>
                  <div className={m.kind === '예시' ? 'absolute inset-x-3 top-12 bottom-14' : 'absolute inset-0'}>
                    <Image src={m.img} alt={m.kind === '예시' ? `${m.title} 예시 (개인정보 가림)` : m.title} fill className={m.kind === '예시' ? 'object-contain' : 'object-cover'} unoptimized />
                  </div>
                  <span className={`absolute inset-x-0 bottom-0 px-4 pb-3.5 pt-8 text-sm font-bold ${m.kind === '예시' ? 'text-[#1B2A45]' : 'text-white bg-gradient-to-t from-black/80 to-transparent'}`}>{m.title}</span>
                </button>
              ))}
            </Slider>
            <p className="text-[11px] text-[#1B2A45]/55 text-center mt-5">※ "예시" 표시는 인증서·명패의 형태를 보여 주는 견본이며 당사의 지원 실적이 아닙니다. 취득 가능 여부는 기업 요건과 해당 기관의 심사에 따라 달라집니다.</p>
          </div>
        </section>
      )}

      {TEAM.length > 0 && (
        <section id="구성원" className="py-20 md:py-24 px-4 md:px-8 bg-[#0d1626]">
          <div className="max-w-6xl mx-auto">
            <Head dark kicker="OUR TEAM" title="함께하는 사람들" desc="상담부터 사후관리까지 담당자가 이어서 맡습니다." />
            <Slider label="구성원 사진">
              {TEAM.map(m => (
                <figure key={m.img} className="relative w-[85%] md:w-[48%] aspect-[4/3] shrink-0 snap-start rounded-2xl overflow-hidden">
                  <Image src={m.img} alt={m.label} fill className="object-cover" unoptimized />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-4 text-sm font-bold text-white">{m.label}</figcaption>
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
          <img src={zoom} alt="확대 보기" className="max-h-full max-w-full rounded-lg shadow-2xl" />
        </div>
      )}
    </>
  )
}
