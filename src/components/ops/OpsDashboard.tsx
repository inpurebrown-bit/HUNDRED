'use client'

import { signOut } from 'next-auth/react'

interface Props {
  userId: string
  userName: string
}

export default function OpsDashboard({ userId, userName }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">관리팀 대시보드</h1>
          <p className="text-sm text-gray-500">{userName} 님의 전용 공간</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          로그아웃
        </button>
      </header>

      <div className="px-6 pt-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">담당 케이스</h2>
          </div>
          <p className="text-gray-400 text-sm text-center py-8">
            대표님이 배정한 고객이 여기에 나타납니다.<br />
            Supabase 연결 후 데이터가 표시됩니다.
          </p>
        </div>
      </div>
    </div>
  )
}
