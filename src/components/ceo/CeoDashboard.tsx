'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'

interface Message {
  role: 'user' | 'model'
  parts: { text: string }[]
}

export default function CeoDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'ops' | 'assign' | 'ai'>('overview')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">대표 대시보드</h1>
          <p className="text-sm text-gray-500">헌드레드 지원센터</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          로그아웃
        </button>
      </header>

      <div className="px-4 md:px-6 pt-4">
        {/* 탭 */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'overview', label: '전체 현황' },
            { key: 'assign', label: '계약 배정' },
            { key: 'sales', label: '영업팀' },
            { key: 'ops', label: '관리팀' },
            { key: 'ai', label: '✦ AI 비서' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? tab.key === 'ai'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'assign' && <AssignTab />}
        {activeTab === 'sales' && <SalesTab />}
        {activeTab === 'ops' && <OpsTab />}
        {activeTab === 'ai' && <AiTab />}
      </div>
    </div>
  )
}

function OverviewTab() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[
        { label: '전체 고객 수', value: '-' },
        { label: '이번달 총 매출', value: '-' },
        { label: '영업팀 계약', value: '-' },
        { label: '관리팀 진행 중', value: '-' },
      ].map((stat) => (
        <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">{stat.label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}

function AssignTab() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-800 mb-4">미배정 계약 목록</h2>
      <p className="text-gray-400 text-sm text-center py-8">
        영업팀이 계약 버튼을 누른 건이 여기에 쌓입니다.
      </p>
    </div>
  )
}

function SalesTab() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-800 mb-4">영업팀 전체 현황</h2>
      <p className="text-gray-400 text-sm text-center py-8">
        CRM 연동 후 데이터가 표시됩니다.
      </p>
    </div>
  )
}

function OpsTab() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6">
      <h2 className="font-semibold text-gray-800 mb-4">관리팀 전체 현황</h2>
      <p className="text-gray-400 text-sm text-center py-8">
        CRM 연동 후 데이터가 표시됩니다.
      </p>
    </div>
  )
}

function AiTab() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', parts: [{ text: input }] }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: messages,
        }),
      })
      const data = await res.json()

      if (data.reply) {
        setMessages([...newMessages, {
          role: 'model',
          parts: [{ text: data.reply }],
        }])
      } else {
        setMessages([...newMessages, {
          role: 'model',
          parts: [{ text: '오류가 발생했습니다: ' + (data.error || '알 수 없는 오류') }],
        }])
      }
    } catch {
      setMessages([...newMessages, {
        role: 'model',
        parts: [{ text: '서버 연결 오류가 발생했습니다.' }],
      }])
    } finally {
      setLoading(false)
    }
  }

  const suggestions = [
    '2024년 소상공인 정책자금 종류 알려줘',
    '정책자금 신청 시 필요한 서류는?',
    '기술보증기금과 신용보증기금 차이점',
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      {/* 헤더 */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">AI</span>
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">헌드레드 AI 비서</p>
          <p className="text-xs text-gray-400">정책자금 전문 · Gemini 2.5 Flash</p>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-8">
            <p className="text-gray-400 text-sm mb-6">무엇이든 물어보세요</p>
            <div className="flex flex-col gap-2 items-center">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-sm text-indigo-600 border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-colors max-w-xs"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
            >
              {msg.parts[0].text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <form onSubmit={sendMessage} className="px-4 py-4 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="정책자금, 고객 분석, 업무 관련 무엇이든..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            전송
          </button>
        </div>
      </form>
    </div>
  )
}
