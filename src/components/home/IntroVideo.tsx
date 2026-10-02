'use client'

import { useRef, useState } from 'react'
import { HOME_VIDEO } from '@/lib/companyInfo'

// 영상 위에는 아무것도 얹지 않고(얼굴 가림 방지), 제목과 조작 버튼은 아래 띠에 둡니다.
export default function IntroVideo() {
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [playing, setPlaying] = useState(true)
  if (!HOME_VIDEO.src) return null

  return (
    <section className="bg-black">
      <video ref={ref} src={HOME_VIDEO.src} poster={HOME_VIDEO.poster || undefined}
        autoPlay muted loop playsInline preload="auto"
        className="w-full max-h-[86vh] object-cover block" />
      <div className="bg-[#0b1220] border-t border-white/10">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-4 md:py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] md:text-[11px] tracking-[0.35em] text-[#C5A258] font-bold">{HOME_VIDEO.label}</p>
            <p className="text-sm md:text-lg font-bold text-white mt-1 truncate">{HOME_VIDEO.title}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { const v = ref.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted) }}
              className="h-9 px-4 rounded-full border border-white/30 text-white text-xs font-semibold hover:bg-white/10" aria-label="소리">
              {muted ? '소리 켜기' : '소리 끄기'}
            </button>
            <button onClick={() => { const v = ref.current; if (!v) return; if (v.paused) { v.play(); setPlaying(true) } else { v.pause(); setPlaying(false) } }}
              className="h-9 px-4 rounded-full bg-white text-[#0b1220] text-xs font-bold" aria-label="재생/정지">
              {playing ? '일시정지' : '재생'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
