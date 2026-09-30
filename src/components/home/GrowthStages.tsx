'use client'

import { useState } from 'react'

const STAGES = [
  {
    en: 'PRE-STARTUP', label: '예비 ~ 창업 초기',
    img: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1400&q=70',
    items: [
      ['예비·초기 창업 지원사업', '창업패키지·초기 창업 지원금 등 지원사업 탐색과 사업계획서 작성 방향 자문'],
      ['창업 초기 지원자금·보증', '창업 초기 기업이 활용할 수 있는 지원 자금과 보증 제도 요건 검토'],
      ['기초 기업인증', '벤처기업확인·기업부설연구소 등 기초 인증 사전 진단'],
    ],
  },
  {
    en: 'EARLY-STAGE', label: '초기 창업기업',
    img: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1400&q=70',
    items: [
      ['운전·시설자금 전략', '업력·매출·기대출을 기준으로 지원 제도별 적합도와 순서 설계'],
      ['기술개발(R&D) 연계', '기술개발 지원사업과 연구소·특허 등 기술 자산 정리'],
      ['재무·신용 관리', '재무제표와 신용 상태 점검으로 다음 단계 준비'],
    ],
  },
  {
    en: 'SCALE-UP', label: '스케일업',
    img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1400&q=70',
    items: [
      ['스케일업 자금·투자 연계', '성장 자금과 투자 유치를 함께 고려한 조달 구조 검토'],
      ['수출·해외 진출', '수출 지원사업과 해외 진출 준비 과제 안내'],
      ['법인 전환·조직 고도화', '매출·이익 규모에 맞는 법인 전환 시점과 구조 설계'],
    ],
  },
  {
    en: 'CERTIFICATION', label: '기업 인증',
    img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1400&q=70',
    items: [
      ['벤처기업확인', '요건 진단부터 준비 서류 정리까지 취득 로드맵 제안'],
      ['이노비즈·메인비즈', '기술혁신형·경영혁신형 인증 준비와 평가 대응 자문'],
      ['기업부설연구소·특허', '기술 경쟁력을 증명하는 자산 구축 방향 안내'],
    ],
  },
  {
    en: 'RE-START & SPECIAL', label: '재창업 · 특수',
    img: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1400&q=70',
    items: [
      ['재도전 지원 프로그램', '재창업 준비 단계별 지원 제도 탐색'],
      ['채무조정 이후 자금 설계', '성실 상환 이력을 바탕으로 한 자금 재설계 방향 자문'],
      ['사업 재편·전환', '사업 전환과 재편 시 활용 가능한 지원 제도 안내'],
    ],
  },
]

export default function GrowthStages() {
  const [active, setActive] = useState(0)
  return (
    <div className="flex flex-col md:flex-row gap-2 md:gap-2.5 md:h-[460px]">
      {STAGES.map((s, i) => {
        const on = i === active
        return (
          <div key={s.en}
            onMouseEnter={() => setActive(i)} onClick={() => setActive(i)}
            className={`relative overflow-hidden rounded-xl cursor-pointer bg-[#0b1220] transition-all duration-700 ease-[cubic-bezier(.4,0,.2,1)]
              ${on ? 'h-[430px] md:h-auto md:flex-[5]' : 'h-[64px] md:h-auto md:flex-1'}`}>
            <div className={`absolute inset-0 bg-cover bg-center transition-all duration-700 ${on ? 'opacity-40 scale-105' : 'opacity-25'}`}
              style={{ backgroundImage: `url(${s.img})`, filter: 'grayscale(70%)' }} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070c16]/90 via-[#070c16]/50 to-[#070c16]/70" />

            {/* 접힌 상태: 세로 라벨(데스크톱) / 한 줄 라벨(모바일) */}
            <div className={`absolute inset-0 flex md:items-center md:justify-center items-center px-5 md:px-0 transition-opacity duration-300 ${on ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <span className="hidden md:block text-[13px] font-bold tracking-[0.35em] text-white/85 [writing-mode:vertical-rl]">{s.en}</span>
              <span className="md:hidden text-sm font-bold text-white/85">{String(i + 1).padStart(2, '0')} &nbsp;{s.label}</span>
            </div>

            {/* 펼친 상태 */}
            <div className={`absolute inset-0 p-6 md:p-9 flex flex-col justify-between transition-all duration-700 ${on ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
              <div>
                <p className="text-[11px] tracking-[0.3em] text-[#C5A258] font-bold">{String(i + 1).padStart(2, '0')} {s.en}</p>
                <h3 className="text-2xl md:text-3xl font-black text-white mt-2">{s.label}</h3>
              </div>
              <div className="md:ml-auto md:w-[58%] space-y-0">
                {s.items.map(([t, d]) => (
                  <div key={t} className="border-t border-white/25 py-3.5">
                    <p className="text-sm font-bold text-white">{t}</p>
                    <p className="text-xs text-white/60 mt-1 leading-relaxed">{d}</p>
                  </div>
                ))}
                <div className="border-t border-white/25" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
