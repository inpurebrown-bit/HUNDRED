import Link from 'next/link'
import ChatWidget from '@/components/ChatWidget'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden">

      {/* 네비게이션 */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 md:px-12 py-4 flex items-center justify-between bg-[#0a0a0f]/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-2">
          {/* 입체 로고 */}
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <span className="text-white font-black text-base tracking-tight">H</span>
            </div>
            <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 opacity-30 blur-sm -z-10" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">헌드레드 지원센터</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#services" className="text-xs text-white/50 hover:text-white transition-colors hidden md:block">서비스</a>
          <a href="#contact" className="text-xs text-white/50 hover:text-white transition-colors hidden md:block">상담 신청</a>
          <Link
            href="/login"
            className="text-xs text-white/70 hover:text-white border border-white/10 hover:border-white/30 px-4 py-2 rounded-lg transition-all"
          >
            직원 로그인
          </Link>
        </div>
      </nav>

      {/* 히어로 섹션 */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20">
        {/* 배경 글로우 */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          {/* 뱃지 */}
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs text-white/60 font-medium">정책자금 전문 컨설팅</span>
          </div>

          {/* 메인 헤딩 */}
          <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight mb-6">
            <span className="text-white">정책자금,</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 bg-clip-text text-transparent">
              제대로 받아가세요
            </span>
          </h1>

          <p className="text-base md:text-lg text-white/40 mb-10 max-w-xl mx-auto leading-relaxed">
            헌드레드 지원센터는 기업 맞춤형 정책자금 솔루션을 제공합니다.
            <br className="hidden md:block" />
            전문 컨설턴트가 처음부터 끝까지 함께합니다.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="#contact"
              className="group relative inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white px-8 py-3.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02]"
            >
              무료 상담 신청
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </a>
            <a
              href="#services"
              className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 px-8 py-3.5 rounded-xl text-sm font-medium transition-all"
            >
              서비스 보기
            </a>
          </div>
        </div>

        {/* 통계 바 */}
        <div className="relative z-10 mt-20 grid grid-cols-3 gap-6 md:gap-12 max-w-2xl mx-auto w-full">
          {[
            { value: '500+', label: '누적 상담 고객' },
            { value: '98%', label: '고객 만족도' },
            { value: '10년+', label: '정책자금 전문 경력' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl md:text-3xl font-black bg-gradient-to-r from-blue-300 to-indigo-300 bg-clip-text text-transparent">{s.value}</p>
              <p className="text-xs text-white/30 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 스크롤 인디케이터 */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-30">
          <span className="text-xs text-white">스크롤</span>
          <div className="w-px h-10 bg-gradient-to-b from-white to-transparent" />
        </div>
      </section>

      {/* 서비스 섹션 */}
      <section id="services" className="relative py-24 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-blue-400 font-semibold tracking-widest uppercase mb-3">SERVICES</p>
            <h2 className="text-2xl md:text-4xl font-black text-white">우리가 제공하는 것들</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: '🎯',
                title: '정책자금 컨설팅',
                desc: '기업 상황에 맞는 정책자금을 분석하고 최적의 솔루션을 제안합니다.',
                tag: 'CONSULTING',
              },
              {
                icon: '📋',
                title: '자금 조달 지원',
                desc: '신청부터 승인까지 전 과정을 전문가가 함께합니다.',
                tag: 'SUPPORT',
              },
              {
                icon: '🔄',
                title: '사후 관리',
                desc: '자금 집행 후 관리 및 후속 지원까지 책임집니다.',
                tag: 'MANAGEMENT',
              },
            ].map((s) => (
              <div
                key={s.title}
                className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-6 transition-all cursor-default"
              >
                <div className="absolute top-4 right-4">
                  <span className="text-[10px] text-white/20 font-bold tracking-widest">{s.tag}</span>
                </div>
                <div className="text-3xl mb-4">{s.icon}</div>
                <h3 className="font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>
                {/* 하단 글로우 라인 */}
                <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 프로세스 섹션 */}
      <section className="py-24 px-6 md:px-12 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs text-blue-400 font-semibold tracking-widest uppercase mb-3">PROCESS</p>
            <h2 className="text-2xl md:text-4xl font-black text-white">진행 프로세스</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { step: '01', title: '무료 상담 신청', desc: '온라인 또는 전화로 간편하게' },
              { step: '02', title: '기업 분석', desc: '현황 파악 및 적합 자금 선별' },
              { step: '03', title: '서류 준비', desc: '전문가와 함께 완벽하게' },
              { step: '04', title: '승인 완료', desc: '신속한 처리로 빠른 결과' },
            ].map((p, i) => (
              <div key={p.step} className="relative text-center">
                {i < 3 && (
                  <div className="hidden md:block absolute top-5 left-[60%] w-[80%] h-px bg-gradient-to-r from-blue-500/30 to-transparent" />
                )}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-3">
                  <span className="text-xs font-black text-blue-400">{p.step}</span>
                </div>
                <h3 className="text-sm font-bold text-white mb-1">{p.title}</h3>
                <p className="text-xs text-white/30">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 상담 신청 폼 */}
      <section id="contact" className="py-24 px-6 md:px-12">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs text-blue-400 font-semibold tracking-widest uppercase mb-3">CONTACT</p>
            <h2 className="text-2xl md:text-3xl font-black text-white">무료 상담 신청</h2>
            <p className="text-sm text-white/30 mt-2">남겨주신 정보로 담당자가 빠르게 연락드립니다.</p>
          </div>

          <form action="/api/leads" method="POST" className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">이름 *</label>
              <input
                name="name" type="text" required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">연락처 *</label>
              <input
                name="phone" type="tel" required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                placeholder="010-0000-0000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">회사명</label>
              <input
                name="company" type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                placeholder="(주)홍길동상사"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">문의 내용</label>
              <textarea
                name="message" rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
                placeholder="필요한 자금 규모나 현재 상황을 간단히 적어주세요."
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white py-3.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.01]"
            >
              상담 신청하기 →
            </button>
          </form>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-white/5 py-8 px-6 md:px-12">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-black text-xs">H</span>
            </div>
            <span className="text-xs text-white/30 font-medium">헌드레드 지원센터</span>
          </div>
          <p className="text-xs text-white/20">© 2024 헌드레드 지원센터. All rights reserved.</p>
        </div>
      </footer>

      {/* 헌드레드비서 플로팅 채팅 위젯 */}
      <ChatWidget />
    </div>
  )
}
