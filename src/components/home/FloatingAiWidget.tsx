'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'

// ─── 플로팅 AI 위젯 ──────────────────────────────────────
export default function FloatingAiWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send(e: FormEvent) {
    e.preventDefault()
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    try {
      const res = await fetch('/api/public-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.reply || '답변을 가져올 수 없습니다.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: '서버 연결 오류가 발생했습니다.' }])
    }
    setLoading(false)
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">
      {/* 채팅 패널 */}
      {open && (
        <div className="w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-[#E8E2D4] flex flex-col overflow-hidden"
          style={{ height: 460 }}>
          {/* 헤더 */}
          <div className="bg-[#1B2A45] px-4 py-3 flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-full bg-[#C5A258] flex items-center justify-center shrink-0">
              <span className="text-white text-[11px] font-black">AI</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold">헌드레드 AI 상담</p>
              <p className="text-white/40 text-[10px]">정책자금·경영 전문</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-lg leading-none">✕</button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#FAF8F3]">
            {messages.length === 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-[11px] text-[#1B2A45]/40 text-center">궁금한 것을 물어보세요</p>
                {['정책자금 받을 수 있나요?', '기보 vs 신보 차이는?', '무상지원금도 있나요?'].map(q => (
                  <button key={q} onClick={() => { setInput(q); setTimeout(() => document.getElementById('ai-input')?.focus(), 50) }}
                    className="w-full text-left text-xs text-[#C5A258] border border-[#C5A258]/20 bg-white rounded-xl px-3 py-2 hover:bg-[#C5A258]/5 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-5 h-5 rounded-full bg-[#C5A258] flex items-center justify-center mr-2 shrink-0 mt-0.5">
                    <span className="text-white text-[8px] font-black">AI</span>
                  </div>
                )}
                <div className={`max-w-[82%] text-[12px] leading-relaxed px-3 py-2 rounded-2xl shadow-sm whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'bg-[#1B2A45] text-white rounded-br-sm'
                    : 'bg-white text-[#1B2A45]/80 rounded-bl-sm border border-[#E8E2D4]'
                  }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-5 h-5 rounded-full bg-[#C5A258] flex items-center justify-center mr-2 shrink-0">
                  <span className="text-white text-[8px] font-black">AI</span>
                </div>
                <div className="bg-white border border-[#E8E2D4] px-3 py-2 rounded-2xl rounded-bl-sm flex gap-1">
                  {[0, 150, 300].map(d => (
                    <span key={d} className="w-1.5 h-1.5 bg-[#C5A258] rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <form onSubmit={send} className="px-3 py-3 border-t border-[#E8E2D4] flex gap-2 shrink-0 bg-white">
            <input
              id="ai-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="질문을 입력하세요..."
              disabled={loading}
              className="flex-1 bg-[#FAF8F3] border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-3 py-2 text-xs text-[#1B2A45] placeholder-[#1B2A45]/30 outline-none transition-colors"
            />
            <button type="submit" disabled={loading || !input.trim()}
              className="bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-40 text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors shrink-0">
              전송
            </button>
          </form>
        </div>
      )}

      {/* 토글 버튼 */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-full bg-[#1B2A45] hover:bg-[#2A3D5E] shadow-2xl flex items-center justify-center transition-all hover:scale-105 group"
        style={{ boxShadow: '0 4px 24px rgba(27,42,69,0.35)' }}
      >
        {open ? (
          <span className="text-white/80 text-lg">✕</span>
        ) : (
          <div className="text-center">
            <span className="text-[#C5A258] text-[11px] font-black block leading-none">AI</span>
            <span className="text-white/50 text-[8px] block leading-none mt-0.5">상담</span>
          </div>
        )}
        {!open && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#C5A258] rounded-full border-2 border-white animate-pulse" />
        )}
      </button>
    </div>
  )
}

