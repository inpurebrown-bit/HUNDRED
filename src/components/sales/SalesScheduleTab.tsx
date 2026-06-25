'use client'

import { useState, useEffect } from 'react'

interface ScheduleEvent {
  id: string
  title: string
  start_date: string
  start_time?: string | null
  description?: string
  color?: string
  created_by?: string
  event_type?: string
}

const TYPE_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  recall:  { bg: 'bg-blue-50',   text: 'text-blue-700',   badge: 'bg-blue-500' },
  meeting: { bg: 'bg-violet-50', text: 'text-violet-700', badge: 'bg-violet-500' },
  etc:     { bg: 'bg-gray-50',   text: 'text-gray-700',   badge: 'bg-gray-400' },
}

const TYPE_LABELS: Record<string, string> = {
  recall: '재통화', meeting: '미팅', etc: '기타',
}

function todayKST() {
  return new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .replace(/\. /g, '-').replace('.', '').trim()
}

function dateLabel(dateStr: string) {
  const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
  const d = new Date(dateStr + 'T00:00:00')
  const label = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  const todayDate = new Date().toISOString().slice(0, 10)
  if (dateStr === todayDate) return `오늘 · ${label}`
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  if (dateStr === tomorrow) return `내일 · ${label}`
  return label
}

export default function SalesScheduleTab({ userName }: { userName: string }) {
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    event_type: 'recall',
    title: '',
    start_date: new Date().toISOString().slice(0, 10),
    start_time: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      // 현재+다음달 조회
      const now = new Date()
      const [res1, res2] = await Promise.all([
        fetch(`/api/events?year=${now.getFullYear()}&month=${now.getMonth() + 1}`),
        fetch(`/api/events?year=${now.getFullYear()}&month=${now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2}`),
      ])
      const [d1, d2] = await Promise.all([res1.json(), res2.json()])
      const all: ScheduleEvent[] = [...(d1.events || []), ...(d2.events || [])]
      // 본인 + 미래 기준 정렬
      const myEvents = all
        .filter(e => e.created_by === userName)
        .sort((a, b) => {
          const da = a.start_date + (a.start_time || '00:00')
          const db = b.start_date + (b.start_time || '00:00')
          return da.localeCompare(db)
        })
      setEvents(myEvents)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [userName])

  async function handleSave() {
    if (!form.title.trim() || !form.start_date) return
    setSaving(true)
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          start_date: form.start_date,
          start_time: form.start_time || null,
          description: form.description,
          color: form.event_type === 'recall' ? 'blue' : form.event_type === 'meeting' ? 'violet' : 'gray',
          event_type: form.event_type,
          is_allday: !form.start_time,
        }),
      })
      setForm({ event_type: 'recall', title: '', start_date: new Date().toISOString().slice(0, 10), start_time: '', description: '' })
      setShowForm(false)
      await load()
    } catch {}
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await fetch('/api/events', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const today = new Date().toISOString().slice(0, 10)
  const twoWeeksLater = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)

  const upcoming = events.filter(e => e.start_date >= today)
  const past = events.filter(e => e.start_date < today).reverse()

  // 날짜별 그룹
  const grouped: Record<string, ScheduleEvent[]> = {}
  upcoming.forEach(e => {
    if (!grouped[e.start_date]) grouped[e.start_date] = []
    grouped[e.start_date].push(e)
  })

  return (
    <div className="space-y-4 pb-8">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-sky-700 rounded-xl px-5 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white">일정관리</h2>
          <p className="text-white/50 text-[11px] mt-0.5">재통화 · 미팅 · 기타 일정</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-[#C5A258] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#b8934a] transition-colors"
        >
          + 일정 추가
        </button>
      </div>

      {/* 일정 추가 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-[#1B2A45]">새 일정</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 text-lg leading-none">✕</button>
          </div>
          <div className="space-y-3">
            {/* 유형 */}
            <div className="flex gap-2">
              {(['recall', 'meeting', 'etc'] as const).map(t => (
                <button key={t}
                  onClick={() => setForm(p => ({ ...p, event_type: t }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    form.event_type === t ? `${TYPE_COLORS[t].badge} text-white` : 'bg-gray-100 text-gray-500'
                  }`}
                >{TYPE_LABELS[t]}</button>
              ))}
            </div>
            {/* 제목 */}
            <input
              type="text"
              placeholder={form.event_type === 'recall' ? '업체명 또는 메모' : form.event_type === 'meeting' ? '미팅 상대 / 장소' : '일정 제목'}
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
            />
            {/* 날짜 + 시간 */}
            <div className="flex gap-2">
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                className="w-28 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              />
            </div>
            {/* 메모 */}
            <textarea
              placeholder="메모 (선택)"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-violet-400"
            />
            <button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="w-full py-2.5 bg-[#1B2A45] text-white text-sm font-bold rounded-lg hover:bg-[#1B2A45]/90 disabled:opacity-50 transition-colors"
            >{saving ? '저장중...' : '저장'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
      ) : upcoming.length === 0 && past.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
          <p className="text-2xl mb-2">📅</p>
          <p>등록된 일정이 없습니다</p>
          <p className="text-xs mt-1">재통화·미팅 일정을 추가해보세요</p>
        </div>
      ) : (
        <>
          {/* 예정 일정 */}
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide px-1">예정 일정</p>
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className={`text-[10px] font-bold ${date === today ? 'text-red-500' : 'text-gray-500'}`}>
                      {dateLabel(date)}
                    </span>
                    {date <= twoWeeksLater && date !== today && (
                      <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-bold">2주 이내</span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {items.map(e => {
                      const c = TYPE_COLORS[e.event_type || 'etc'] || TYPE_COLORS.etc
                      return (
                        <div key={e.id} className={`${c.bg} border border-transparent rounded-xl px-4 py-3 flex items-start justify-between gap-2`}>
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className={`shrink-0 text-[9px] font-bold text-white px-1.5 py-0.5 rounded mt-0.5 ${c.badge}`}>
                              {TYPE_LABELS[e.event_type || 'etc']}
                            </span>
                            <div className="min-w-0">
                              <p className={`text-sm font-bold ${c.text} truncate`}>{e.title}</p>
                              {e.start_time && (
                                <p className="text-[11px] text-gray-400 mt-0.5">{e.start_time}</p>
                              )}
                              {e.description && (
                                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{e.description}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="shrink-0 text-gray-300 hover:text-red-400 text-sm transition-colors mt-0.5"
                          >✕</button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 지난 일정 */}
          {past.length > 0 && (
            <details className="group">
              <summary className="text-xs font-bold text-gray-400 cursor-pointer hover:text-gray-600 px-1 list-none flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                지난 일정 {past.length}건
              </summary>
              <div className="mt-2 space-y-1.5">
                {past.map(e => {
                  const c = TYPE_COLORS[e.event_type || 'etc'] || TYPE_COLORS.etc
                  return (
                    <div key={e.id} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 opacity-60">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 text-[9px] font-bold text-white px-1.5 py-0.5 rounded bg-gray-400">
                          {TYPE_LABELS[e.event_type || 'etc']}
                        </span>
                        <p className="text-xs text-gray-500 truncate">{e.start_date} {e.start_time || ''} · {e.title}</p>
                      </div>
                      <button onClick={() => handleDelete(e.id)} className="shrink-0 text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                  )
                })}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
