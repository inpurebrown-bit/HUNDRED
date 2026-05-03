'use client'

import { useState, useEffect, FormEvent, ReactNode } from 'react'

interface MinuteSummary {
  title?: string
  attendees?: string[]
  summary?: string
  key_points?: string[]
  decisions?: string[]
  actions?: { person: string; task: string; deadline?: string }[]
  sales_report?: string | null
  revenue_report?: string | null
}

interface Minute {
  id: string
  meeting_date: string
  raw_text: string
  summary: MinuteSummary
  created_by: string
  updated_at: string
}

const today = () => new Date().toISOString().slice(0, 10)

export default function MinutesTab() {
  const [minutes, setMinutes] = useState<Minute[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Minute | null>(null)
  const [showInput, setShowInput] = useState(false)
  const [rawText, setRawText] = useState('')
  const [meetingDate, setMeetingDate] = useState(today())
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/minutes')
    const data = await res.json()
    setMinutes(data.minutes || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!rawText.trim()) return
    setProcessing(true)
    setError('')

    const res = await fetch('/api/minutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_text: rawText, meeting_date: meetingDate }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || '오류가 발생했습니다')
    } else {
      setRawText('')
      setShowInput(false)
      await load()
      // 방금 저장된 것 바로 열기
      setSelected(data.minute)
    }
    setProcessing(false)
  }

  return (
    <div className="space-y-4 pb-8">
      {/* 상단 버튼 */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">회의록</h2>
        <button
          onClick={() => { setShowInput(!showInput); setMeetingDate(today()) }}
          className="bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showInput ? '✕ 취소' : '+ 회의록 입력'}
        </button>
      </div>

      {/* 입력 패널 */}
      {showInput && (
        <form onSubmit={submit} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">회의 날짜</label>
              <input
                type="date" value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="flex-1 flex items-end">
              <p className="text-xs text-gray-400 pb-2">
                같은 날짜 회의록은 덮어쓰기됩니다
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              클로바노트 텍스트 붙여넣기
            </label>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              rows={10}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              placeholder="클로바노트에서 복사한 회의 내용을 여기에 붙여넣으세요.&#10;&#10;예)&#10;김철수: 오늘 영업팀 보고 내용 공유 드리겠습니다.&#10;이영희: 이번달 계약 목표는 10건입니다.&#10;..."
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={processing || !rawText.trim()}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                AI가 정리 중입니다...
              </>
            ) : (
              '✦ AI로 회의록 정리하기'
            )}
          </button>
        </form>
      )}

      {/* 회의록 목록 + 상세 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 날짜 목록 */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-xs font-semibold text-gray-500">날짜별 목록</p>
            </div>
            {loading ? (
              <div className="p-6 text-center text-gray-400 text-sm">불러오는 중...</div>
            ) : minutes.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">
                회의록이 없습니다.<br />위에서 입력해주세요.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {minutes.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selected?.id === m.id ? 'bg-gray-50 border-l-2 border-gray-900' : ''
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{m.meeting_date}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {m.summary?.title || '회의록'}
                    </p>
                    <p className="text-xs text-gray-300 mt-0.5">{m.created_by}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 상세 내용 */}
        <div className="md:col-span-2">
          {selected ? (
            <MinuteDetail minute={selected} onReprocess={() => {
              setRawText(selected.raw_text)
              setMeetingDate(selected.meeting_date)
              setShowInput(true)
            }} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 h-64 flex items-center justify-center text-gray-400 text-sm">
              왼쪽 목록에서 날짜를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MinuteDetail({ minute, onReprocess }: { minute: Minute; onReprocess: () => void }) {
  const s = minute.summary
  const [showRaw, setShowRaw] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">{s?.title || '회의록'}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{minute.meeting_date} · {minute.created_by}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg"
          >
            {showRaw ? '요약 보기' : '원문 보기'}
          </button>
          <button
            onClick={onReprocess}
            className="text-xs text-gray-600 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg"
          >
            재정리
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5 overflow-y-auto max-h-[600px]">
        {showRaw ? (
          <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-xl p-4 leading-relaxed">
            {minute.raw_text}
          </pre>
        ) : (
          <>
            {/* 참석자 */}
            {s?.attendees && s.attendees.length > 0 && (
              <div>
                <SectionTitle>참석자</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {s.attendees.map((a, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 요약 */}
            {s?.summary && (
              <div>
                <SectionTitle>전체 요약</SectionTitle>
                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-4">{s.summary}</p>
              </div>
            )}

            {/* 핵심 논의사항 */}
            {s?.key_points && s.key_points.length > 0 && (
              <div>
                <SectionTitle>핵심 논의사항</SectionTitle>
                <ul className="space-y-1.5">
                  {s.key_points.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 결정사항 */}
            {s?.decisions && s.decisions.length > 0 && (
              <div>
                <SectionTitle>결정사항</SectionTitle>
                <ul className="space-y-1.5">
                  {s.decisions.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 액션 아이템 */}
            {s?.actions && s.actions.length > 0 && (
              <div>
                <SectionTitle>액션 아이템</SectionTitle>
                <div className="space-y-2">
                  {s.actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold shrink-0">
                        {a.person}
                      </span>
                      <span className="text-sm text-gray-700 flex-1">{a.task}</span>
                      {a.deadline && (
                        <span className="text-xs text-amber-600 shrink-0">~{a.deadline}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 영업 관련 */}
            {s?.sales_report && (
              <div>
                <SectionTitle>영업 관련</SectionTitle>
                <p className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-xl p-4 leading-relaxed">
                  {s.sales_report}
                </p>
              </div>
            )}

            {/* 매출 관련 */}
            {s?.revenue_report && (
              <div>
                <SectionTitle>매출 관련</SectionTitle>
                <p className="text-sm text-gray-600 bg-violet-50 border border-violet-100 rounded-xl p-4 leading-relaxed">
                  {s.revenue_report}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{children}</p>
  )
}
