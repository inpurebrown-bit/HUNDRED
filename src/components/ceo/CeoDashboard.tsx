'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'

export default function CeoDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'ops' | 'assign'>('overview')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">대표 대시보드</h1>
          <p className="text-sm text-gray-500">전체 현황 통합 뷰</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          로그아웃
        </button>
      </header>

      <div className="px-6 pt-6">
        {/* 탭 */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'overview', label: '전체 현황' },
            { key: 'assign', label: '계약 배정' },
            { key: 'sales', label: '영업팀 관리' },
            { key: 'ops', label: '관리팀 관리' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[
              { label: '전체 고객 수', value: '-', color: 'blue' },
              { label: '이번달 총 매출', value: '-', color: 'green' },
              { label: '영업팀 계약', value: '-', color: 'purple' },
              { label: '관리팀 진행 중', value: '-', color: 'orange' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'assign' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">미배정 계약 목록</h2>
            <p className="text-gray-400 text-sm text-center py-8">
              영업팀이 계약 버튼을 누른 건이 여기에 쌓입니다.<br />
              관리팀 직원을 선택해 배정할 수 있습니다.
            </p>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">영업팀 전체 현황</h2>
            <p className="text-gray-400 text-sm text-center py-8">
              Supabase 연결 후 영업팀 전체 고객·매출 데이터가 표시됩니다.
            </p>
          </div>
        )}

        {activeTab === 'ops' && (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">관리팀 전체 현황</h2>
            <p className="text-gray-400 text-sm text-center py-8">
              Supabase 연결 후 관리팀 전체 케이스·매출 데이터가 표시됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
