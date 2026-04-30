'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'model'
  parts: { text: string }[]
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', parts: [{ text: input }] }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: messages,
        }),
      })
      const data = await res.json()

      setMessages([...newMessages, {
        role: 'model',
        parts: [{ text: data.reply || ('오류: ' + (data.error || '알 수 없는 오류')) }],
      }])
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
    '소상공인 정책자금 종류 알려줘',
    '정책자금 신청 서류가 뭐야?',
    '기보와 신보 차이점은?',
  ]

  return (
    <>
      {/* 팝업 채팅창 */}
      {open && (
        <div className="fixed bottom-24 right-4 md:right-6 z-50 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ height: '480px' }}>
          {/* 헤더 */}
          <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white text-xs font-bold">H</span>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">헌드레드비서</p>
                <p className="text-blue-100 text-xs">정책자금 상담 AI</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/80 hover:text-white text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center pt-4">
                <p className="text-gray-400 text-xs mb-4">정책자금에 대해 무엇이든 물어보세요</p>
                <div className="flex flex-col gap-2 items-center">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-xs text-blue-600 border border-blue-100 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors w-full max-w-xs"
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
                  className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100 shadow-sm'
                  }`}
                >
                  {msg.parts[0].text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 shadow-sm px-3 py-2 rounded-xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <form onSubmit={sendMessage} className="px-3 py-3 border-t border-gray-100 bg-white">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="정책자금 관련 질문을 입력하세요..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                전송
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 md:right-6 z-50 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        {open ? (
          <span className="text-xl">✕</span>
        ) : (
          <>
            <span className="text-lg">💬</span>
            <span className="text-[9px] font-bold leading-tight mt-0.5">헌드레드비서</span>
          </>
        )}
      </button>
    </>
  )
}
