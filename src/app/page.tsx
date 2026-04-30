import Link from 'next/link'
import ChatWidget from '@/components/ChatWidget'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* 네비게이션 */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <span className="text-xl font-bold text-gray-900">헌드레드 지원센터</span>
        <Link
          href="/login"
          className="text-sm text-gray-600 hover:text-gray-900 border border-gray-200 px-4 py-2 rounded-lg"
        >
          직원 로그인
        </Link>
      </nav>

      {/* 히어로 섹션 */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
          정책자금, 제대로 받아가세요
        </h1>
        <p className="text-lg text-gray-500 mb-10 max-w-2xl mx-auto">
          헌드레드 지원센터는 기업 맞춤형 정책자금 솔루션을 제공합니다.
          전문 컨설턴트가 처음부터 끝까지 함께합니다.
        </p>
        <a
          href="#contact"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-base font-medium"
        >
          무료 상담 신청
        </a>
      </section>

      {/* 서비스 소개 */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">서비스</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: '정책자금 컨설팅', desc: '기업 상황에 맞는 정책자금을 분석하고 최적의 솔루션을 제안합니다.' },
              { title: '자금 조달 지원', desc: '신청부터 승인까지 전 과정을 전문가가 함께합니다.' },
              { title: '사후 관리', desc: '자금 집행 후 관리 및 후속 지원까지 책임집니다.' },
            ].map((s) => (
              <div key={s.title} className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 상담 신청 폼 */}
      <section id="contact" className="max-w-xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">무료 상담 신청</h2>
        <p className="text-gray-500 text-sm text-center mb-8">
          남겨주신 정보로 담당자가 연락드립니다.
        </p>
        <form action="/api/leads" method="POST" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
            <input
              name="name"
              type="text"
              required
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="홍길동"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">연락처 *</label>
            <input
              name="phone"
              type="tel"
              required
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="010-0000-0000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">문의 내용</label>
            <textarea
              name="message"
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="필요한 자금 규모나 현재 상황을 간단히 적어주세요."
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-medium"
          >
            상담 신청하기
          </button>
        </form>
      </section>

      {/* 푸터 */}
      <footer className="border-t border-gray-100 py-6 text-center text-sm text-gray-400">
        © 2024 헌드레드 지원센터. All rights reserved.
      </footer>

      {/* 헌드레드비서 플로팅 채팅 위젯 */}
      <ChatWidget />
    </div>
  )
}
