'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'

interface Props {
  userId: string
  userName: string
}

export default function SalesDashboard({ userId, userName }: Props) {
  const [activeTab, setActiveTab] = useState<'customers' | 'contracts'>('customers')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">영업팀 대시보드</h1>
          <p className="text-sm text-gray-500">{userName} 님의 전용 공간</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          로그아웃
        </button>
      </header>

      {/* 탭 */}
      <div className="px-6 pt-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'customers'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            내 고객
          </button>
          <button
            onClick={() => setActiveTab('contracts')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'contracts'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            계약 완료
          </button>
        </div>

        {activeTab === 'customers' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">고객 목록</h2>
              <button className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm">
                + 신규 고객 등록
              </button>
            </div>
            <p className="text-gray-400 text-sm text-center py-8">
              아직 등록된 고객이 없습니다.<br />
              Supabase 연결 후 데이터가 표시됩니다.
            </p>
          </div>
        )}

        {activeTab === 'contracts' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">계약 완료 목록</h2>
            <p className="text-gray-400 text-sm text-center py-8">
              계약 완료 건이 여기에 쌓입니다.<br />
              대표님이 관리팀에 배정하기 전 단계입니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
