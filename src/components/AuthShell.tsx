'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'

// 로그인·PIN 화면 공통 틀 — 좌측 히어로 패널은 고정, 우측만 교체된다.
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr]">
      {/* ── 좌측: 홈페이지 히어로 배너 톤 ── */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#05080f] text-white px-14 py-12">
        <div className="absolute inset-0 bg-cover bg-center hs-slow-zoom opacity-70"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1486325212027-8081e485255e?w=2000&q=75)', filter: 'grayscale(35%) contrast(1.05)' }} />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b2140]/90 via-[#03060c]/80 to-[#03060c]/95" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#C5A258 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full bg-[#3b4a8f]/40 blur-[90px] hc-bob" />
        <div className="absolute -bottom-28 right-[-60px] w-[380px] h-[380px] rounded-full bg-[#b8995a]/25 blur-[100px] hc-bob" style={{ animationDelay: '-2s' }} />

        <div className="relative hc-in" style={{ animationDelay: '.1s' }}>
          <div className="relative w-44 h-12">
            <Image src="/images/logo.png" alt="HUNDRED Consulting" fill className="object-contain object-left brightness-0 invert" unoptimized priority />
          </div>
        </div>

        <div className="relative">
          <p className="hc-in text-[11px] tracking-[0.35em] text-[#C5A258] font-semibold mb-5" style={{ animationDelay: '.3s' }}>HUNDRED CONSULTING</p>
          <h1 className="hc-in text-5xl font-black leading-[1.25] tracking-tight" style={{ animationDelay: '.5s' }}>
            성장의 기회를<br /><span className="hc-shine">현실</span>로 만드는 곳
          </h1>
          <p className="hc-in mt-6 text-white/65 leading-relaxed max-w-md" style={{ animationDelay: '.75s' }}>
            고객 상담부터 계약·매출·정산까지,<br />헌드레드컨설팅 임직원을 위한 통합 업무 시스템입니다.
          </p>
          <div className="hc-in mt-9 flex gap-3" style={{ animationDelay: '1s' }}>
            {['고객관리', '계약·매출', '급여정산'].map((t, i) => (
              <span key={t} className="hc-bob px-4 py-2.5 rounded-2xl text-xs font-semibold text-white/80 bg-white/[.07] border border-white/15 backdrop-blur-md"
                style={{ animationDelay: `${-i * 1.2}s` }}>{t}</span>
            ))}
          </div>
        </div>

        <p className="relative hc-in text-[11px] text-white/35" style={{ animationDelay: '1.2s' }}>© HUNDRED Consulting. 임직원 전용 · 무단 접근 시 기록됩니다.</p>
      </aside>


      {/* ── 우측 ── */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          {/* 모바일 상단 로고 */}
          <div className="lg:hidden mb-8 hc-in">
            <div className="relative w-40 h-11"><Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain object-left" unoptimized /></div>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
