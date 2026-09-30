'use client'

import { useRef, useState } from 'react'
import { HOME_VIDEO } from '@/lib/companyInfo'

export default function IntroVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [playing, setPlaying] = useState(true)
  if (!HOME_VIDEO.src) return null

  return (
    <section className="relative bg-black overflow-hidden">
      <video ref={ref} src={HOME_VIDEO.src} poster={HOME_VIDEO.poster || undefined}
        autoPlay muted loop playsInline preload="metadata"
        className="w-full h-[56vh] md:h-[82vh] object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/5 to-black/10 pointer-events-none" />
      <div className="absolute left-0 right-0 top-0 p-5 md:p-10 pt-20 md:pt-24 flex items-start justify-between gap-4">
        <div className="text-white drop-shadow">
          <p className="text-[11px] md:text-xs tracking-[0.35em] text-[#C5A258] font-bold mb-2">{HOME_VIDEO.label}</p>
          <p className="text-lg md:text-3xl font-black leading-snug">{HOME_VIDEO.title}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => { const v = ref.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted) }}
            className="w-10 h-10 rounded-full bg-white/90 text-[#0b1220] text-base flex items-center justify-center" aria-label="소리">{muted ? '🔇' : '🔊'}</button>
          <button onClick={() => { const v = ref.current; if (!v) return; if (v.paused) { v.play(); setPlaying(true) } else { v.pause(); setPlaying(false) } }}
            className="w-10 h-10 rounded-full bg-white/90 text-[#0b1220] text-xs font-black flex items-center justify-center" aria-label="재생/정지">{playing ? '❚❚' : '▶'}</button>
        </div>
      </div>
    </section>
  )
}
