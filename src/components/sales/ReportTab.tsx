'use client'

import { useState, useEffect, FormEvent, ReactNode } from 'react'

// ── 타입 ────────────────────────────────────────────────
interface MorningData {
  total_calls: string
  no_connect: string
  connected: string
  db_secured: string
  outbound_contracts: string
}

interface ConsultItem {
  company: string
  content: string
  is_decided: boolean
}

interface WorriedItem {
  company: string
  content: string
  reason: string
  probability: '상' | '중' | '하' | ''
}

interface DecidedItem {
  company: string
  content: string
  current_progress: string
  next_action: string
}

interface MeetingItem {
  company: string
  date: string
  time: string
  location: string
}

interface PaymentItem {
  first_call_date: string
  company: string
  ceo_name: string
  phone: string
}

interface DailyData {
  supply_db: ConsultItem[] | null       // null = 없음
  outbound: ConsultItem[] | null
  today_contracts: string
  month_contracts: string
  goal: string
  worried: WorriedItem[] | null
  decided: DecidedItem[] | null
  meetings: MeetingItem[] | null
  payment_waiting: PaymentItem[] | null
}

interface Props {
  userId: string
  userName: string
}

const today = () => new Date().toISOString().slice(0, 10)

// ── 공통 입력 스타일 ────────────────────────────────────
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const label = 'text-xs text-gray-500 mb-1 block font-medium'

export default function ReportTab({ userId, userName }: Props) {
  const [activeReport, setActiveReport] = useState<'morning' | 'daily'>('morning')
  const [submitted, setSubmitted] = useState(false)
  const [submitType, setSubmitType] = useState<'morning' | 'daily'>('morning')
  const [loading, setLoading] = useState(false)
  const [pastReports, setPastReports] = useState<any[]>([])
  const [viewReport, setViewReport] = useState<any | null>(null)

  // 오전보고 상태
  const [morning, setMorning] = useState<MorningData>({
    total_calls: '', no_connect: '', connected: '', db_secured: '', outbound_contracts: '',
  })

  // 마감보고 상태
  const [daily, setDaily] = useState<DailyData>({
    supply_db: [],
    outbound: [],
    today_contracts: '',
    month_contracts: '',
    goal: '',
    worried: [],
    decided: [],
    meetings: [],
    payment_waiting: [],
  })

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => setPastReports(d.reports || []))
  }, [submitted])

  // ── 오전보고 제출 ────────────────────────────────────
  async function submitMorning(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_type: 'morning', report_date: today(), data: morning }),
    })
    if (res.ok) {
      setSubmitType('morning')
      setSubmitted(true)
    }
    setLoading(false)
  }

  // ── 마감보고 제출 ────────────────────────────────────
  async function submitDaily(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_type: 'daily', report_date: today(), data: daily }),
    })
    if (res.ok) {
      setSubmitType('daily')
      setSubmitted(true)
    }
    setLoading(false)
  }

  // ── 배열 아이템 헬퍼 ─────────────────────────────────
  function addItem<T>(field: keyof DailyData, empty: T) {
    setDaily(p => ({ ...p, [field]: [...((p[field] as any[]) || []), empty] }))
  }
  function removeItem(field: keyof DailyData, idx: number) {
    setDaily(p => ({ ...p, [field]: (p[field] as any[]).filter((_, i) => i !== idx) }))
  }
  function updateItem(field: keyof DailyData, idx: number, key: string, val: any) {
    setDaily(p => ({
      ...p,
      [field]: (p[field] as any[]).map((item, i) => i === idx ? { ...item, [key]: val } : item),
    }))
  }

  // 자동 계산
  const remaining = daily.goal && daily.month_contracts
    ? Math.max(0, Number(daily.goal) - Number(daily.month_contracts))
    : null

  const morningReports = pastReports.filter(r => r.report_type === 'morning')
  const dailyReports = pastReports.filter(r => r.report_type === 'daily')

  return (
    <div className="space-y-4">
      {/* 탭 선택 */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveReport('morning')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeReport === 'morning' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          ☀️ 오전보고
        </button>
        <button
          onClick={() => setActiveReport('daily')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeReport === 'daily' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          📋 일일마감보고
        </button>
      </div>

      {/* ── 전송 완료 팝업 모달 ── */}
      {submitted && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] px-6">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center animate-[fadeIn_0.2s_ease]">
            {/* 아이콘 */}
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">✅</span>
            </div>
            {/* 제목 */}
            <h2 className="text-xl font-black text-gray-900 mb-2">
              {submitType === 'morning' ? '오전보고 완료!' : '마감보고 완료!'}
            </h2>
            {/* 설명 */}
            <p className="text-sm text-gray-500 mb-1">
              대표님께 성공적으로 전송되었습니다.
            </p>
            <p className="text-xs text-gray-400 mb-7">
              {today()} · {userName}
            </p>
            {/* 확인 버튼 */}
            <button
              onClick={() => setSubmitted(false)}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors">
              확인
            </button>
          </div>
        </div>
      )}

      {/* ── 오전보고 폼 ── */}
      {activeReport === 'morning' && (
        <div className="space-y-4">
          <form onSubmit={submitMorning} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-800">☀️ 오전보고</h3>
              <span className="text-xs text-gray-400">{today()} · {userName}</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className={label}>총 콜 수</label>
                <input type="number" className={inp} placeholder="0"
                  value={morning.total_calls}
                  onChange={e => setMorning(p => ({ ...p, total_calls: e.target.value }))} />
              </div>
              <div>
                <label className={label}>연결안됨</label>
                <input type="number" className={inp} placeholder="0"
                  value={morning.no_connect}
                  onChange={e => setMorning(p => ({ ...p, no_connect: e.target.value }))} />
              </div>
              <div>
                <label className={label}>연결됨</label>
                <input type="number" className={inp} placeholder="0"
                  value={morning.connected}
                  onChange={e => setMorning(p => ({ ...p, connected: e.target.value }))} />
              </div>
              <div>
                <label className={label}>DB확보 (결정업체)</label>
                <input type="number" className={inp} placeholder="0"
                  value={morning.db_secured}
                  onChange={e => setMorning(p => ({ ...p, db_secured: e.target.value }))} />
              </div>
              <div>
                <label className={label}>아웃바운딩 계약</label>
                <input type="number" className={inp} placeholder="0"
                  value={morning.outbound_contracts}
                  onChange={e => setMorning(p => ({ ...p, outbound_contracts: e.target.value }))} />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
              {loading ? '전송 중...' : '오전보고 전송 →'}
            </button>
          </form>

          {/* 과거 오전보고 목록 */}
          {morningReports.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">지난 오전보고</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {morningReports.slice(0, 10).map(r => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{r.report_date}</span>
                      <p className="text-xs text-gray-400 mt-0.5">
                        총콜 {r.data?.total_calls || 0} · 연결 {r.data?.connected || 0} · DB확보 {r.data?.db_secured || 0} · 계약 {r.data?.outbound_contracts || 0}
                      </p>
                    </div>
                    <button onClick={() => setViewReport(r)}
                      className="text-xs text-blue-500 hover:text-blue-700">상세보기</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 마감보고 폼 ── */}
      {activeReport === 'daily' && (
        <div className="space-y-4">
          <form onSubmit={submitDaily} className="space-y-5">

            {/* 기본 정보 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800">📋 일일업무마감보고서</h3>
                <span className="text-xs text-gray-400">{today()} · {userName}</span>
              </div>

              {/* 계약 현황 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                <div>
                  <label className={label}>당일 계약 개수</label>
                  <input type="number" className={inp} placeholder="0"
                    value={daily.today_contracts}
                    onChange={e => setDaily(p => ({ ...p, today_contracts: e.target.value }))} />
                </div>
                <div>
                  <label className={label}>이번달 총 계약</label>
                  <input type="number" className={inp} placeholder="0"
                    value={daily.month_contracts}
                    onChange={e => setDaily(p => ({ ...p, month_contracts: e.target.value }))} />
                </div>
                <div>
                  <label className={label}>월 목표 개수</label>
                  <input type="number" className={inp} placeholder="0"
                    value={daily.goal}
                    onChange={e => setDaily(p => ({ ...p, goal: e.target.value }))} />
                </div>
                <div>
                  <label className={label}>목표까지 남은 수</label>
                  <div className={`${inp} bg-gray-50 text-gray-600 font-semibold`}>
                    {remaining !== null ? remaining + '개' : '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* 금일 신규 공급DB 상담결과 */}
            <Section
              title="금일 신규 공급DB 상담결과"
              isEmpty={daily.supply_db === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, supply_db: p.supply_db === null ? [] : null }))}
              onAdd={() => addItem('supply_db', { company: '', content: '', is_decided: false })}
            >
              {(daily.supply_db || []).map((item, i) => (
                <ConsultRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('supply_db', i, k, v)}
                  onRemove={() => removeItem('supply_db', i)} />
              ))}
            </Section>

            {/* 금일 신규 아웃바운딩 상담결과 */}
            <Section
              title="금일 신규 아웃바운딩 상담결과"
              isEmpty={daily.outbound === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, outbound: p.outbound === null ? [] : null }))}
              onAdd={() => addItem('outbound', { company: '', content: '', is_decided: false })}
            >
              {(daily.outbound || []).map((item, i) => (
                <ConsultRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('outbound', i, k, v)}
                  onRemove={() => removeItem('outbound', i)} />
              ))}
            </Section>

            {/* 고민관리업체 */}
            <Section
              title="고민관리업체"
              isEmpty={daily.worried === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, worried: p.worried === null ? [] : null }))}
              onAdd={() => addItem('worried', { company: '', content: '', reason: '', probability: '' })}
            >
              {(daily.worried || []).map((item, i) => (
                <WorriedRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('worried', i, k, v)}
                  onRemove={() => removeItem('worried', i)} />
              ))}
            </Section>

            {/* 결정업체 */}
            <Section
              title="결정업체"
              isEmpty={daily.decided === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, decided: p.decided === null ? [] : null }))}
              onAdd={() => addItem('decided', { company: '', content: '', current_progress: '', next_action: '' })}
            >
              {(daily.decided || []).map((item, i) => (
                <DecidedRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('decided', i, k, v)}
                  onRemove={() => removeItem('decided', i)} />
              ))}
            </Section>

            {/* 미팅업체 */}
            <Section
              title="미팅업체"
              isEmpty={daily.meetings === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, meetings: p.meetings === null ? [] : null }))}
              onAdd={() => addItem('meetings', { company: '', date: '', time: '', location: '' })}
            >
              {(daily.meetings || []).map((item, i) => (
                <MeetingRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('meetings', i, k, v)}
                  onRemove={() => removeItem('meetings', i)} />
              ))}
            </Section>

            {/* 입금대기 업체 */}
            <Section
              title="입금대기 업체"
              isEmpty={daily.payment_waiting === null}
              onToggleEmpty={() => setDaily(p => ({ ...p, payment_waiting: p.payment_waiting === null ? [] : null }))}
              onAdd={() => addItem('payment_waiting', { first_call_date: '', company: '', ceo_name: '', phone: '' })}
            >
              {(daily.payment_waiting || []).map((item, i) => (
                <PaymentRow key={i} item={item} idx={i}
                  onChange={(k: string, v: unknown) => updateItem('payment_waiting', i, k, v)}
                  onRemove={() => removeItem('payment_waiting', i)} />
              ))}
            </Section>

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition-colors">
              {loading ? '전송 중...' : '📋 마감보고 전송 →'}
            </button>
          </form>

          {/* 과거 마감보고 목록 */}
          {dailyReports.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">지난 마감보고</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {dailyReports.slice(0, 10).map(r => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{r.report_date}</span>
                      <p className="text-xs text-gray-400 mt-0.5">
                        당일계약 {r.data?.today_contracts || 0}건 · 월누적 {r.data?.month_contracts || 0}건 · 목표 {r.data?.goal || 0}건
                      </p>
                    </div>
                    <button onClick={() => setViewReport(r)}
                      className="text-xs text-blue-500 hover:text-blue-700">상세보기</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 상세보기 모달 */}
      {viewReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">
                {viewReport.report_type === 'morning' ? '☀️ 오전보고' : '📋 마감보고'} — {viewReport.report_date}
              </h3>
              <button onClick={() => setViewReport(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg p-4">
              {JSON.stringify(viewReport.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 섹션 래퍼 ────────────────────────────────────────────
function Section({ title, isEmpty, onToggleEmpty, onAdd, children }: {
  title: string
  isEmpty: boolean
  onToggleEmpty: () => void
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-800 text-sm">{title}</h4>
        <div className="flex gap-2">
          <button type="button" onClick={onToggleEmpty}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors border ${
              isEmpty ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}>
            없음
          </button>
          {!isEmpty && (
            <button type="button" onClick={onAdd}
              className="text-xs px-3 py-1.5 rounded-lg font-medium bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors">
              + 추가
            </button>
          )}
        </div>
      </div>
      {isEmpty ? (
        <p className="text-xs text-gray-400 text-center py-2">해당 없음으로 표시됩니다</p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </div>
  )
}

// ── 공급DB / 아웃바운딩 행 ────────────────────────────────
function ConsultRow({ item, idx, onChange, onRemove }: any) {
  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">#{idx + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">삭제</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">업체명</label>
          <input className={inp} placeholder="업체명" value={item.company}
            onChange={e => onChange('company', e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-400 mb-0.5 block">결정업체 여부</label>
            <button type="button"
              onClick={() => onChange('is_decided', !item.is_decided)}
              className={`w-full py-2 rounded-lg text-xs font-medium border transition-colors ${
                item.is_decided ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-500 border-gray-200'
              }`}>
              {item.is_decided ? '✅ 결정' : '미결정'}
            </button>
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">상담내용</label>
        <textarea className={inp + ' resize-none'} rows={2} placeholder="상담 내용을 입력하세요"
          value={item.content} onChange={e => onChange('content', e.target.value)} />
      </div>
    </div>
  )
}

// ── 고민관리업체 행 ──────────────────────────────────────
function WorriedRow({ item, idx, onChange, onRemove }: any) {
  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">#{idx + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">삭제</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">업체명</label>
          <input className={inp} placeholder="업체명" value={item.company}
            onChange={e => onChange('company', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">계약 확률</label>
          <div className="flex gap-1">
            {(['상', '중', '하'] as const).map(p => (
              <button key={p} type="button"
                onClick={() => onChange('probability', p)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                  item.probability === p
                    ? p === '상' ? 'bg-emerald-500 text-white border-emerald-500'
                      : p === '중' ? 'bg-amber-400 text-white border-amber-400'
                      : 'bg-red-400 text-white border-red-400'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">상담내용</label>
        <textarea className={inp + ' resize-none'} rows={2} placeholder="상담 내용"
          value={item.content} onChange={e => onChange('content', e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">고민 사유</label>
        <input className={inp} placeholder="고민하는 이유" value={item.reason}
          onChange={e => onChange('reason', e.target.value)} />
      </div>
    </div>
  )
}

// ── 결정업체 행 ──────────────────────────────────────────
function DecidedRow({ item, idx, onChange, onRemove }: any) {
  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">#{idx + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">삭제</button>
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">업체명</label>
        <input className={inp} placeholder="업체명" value={item.company}
          onChange={e => onChange('company', e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">상담내용</label>
        <textarea className={inp + ' resize-none'} rows={2} placeholder="상담 내용"
          value={item.content} onChange={e => onChange('content', e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">현재 진행 내용</label>
        <input className={inp} placeholder="현재 진행 상황" value={item.current_progress}
          onChange={e => onChange('current_progress', e.target.value)} />
      </div>
      <div>
        <label className="text-xs text-gray-400 mb-0.5 block">이후 진행할 내용</label>
        <input className={inp} placeholder="다음 액션" value={item.next_action}
          onChange={e => onChange('next_action', e.target.value)} />
      </div>
    </div>
  )
}

// ── 미팅업체 행 ──────────────────────────────────────────
function MeetingRow({ item, idx, onChange, onRemove }: any) {
  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">#{idx + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">삭제</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">업체명</label>
          <input className={inp} placeholder="업체명" value={item.company}
            onChange={e => onChange('company', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">날짜</label>
          <input type="date" className={inp} value={item.date}
            onChange={e => onChange('date', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">시간</label>
          <input type="time" className={inp} value={item.time}
            onChange={e => onChange('time', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">장소</label>
          <input className={inp} placeholder="장소" value={item.location}
            onChange={e => onChange('location', e.target.value)} />
        </div>
      </div>
    </div>
  )
}

// ── 입금대기 업체 행 ─────────────────────────────────────
function PaymentRow({ item, idx, onChange, onRemove }: any) {
  return (
    <div className="border border-gray-100 rounded-lg p-3 space-y-2 bg-gray-50/50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">#{idx + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-400 hover:text-red-600">삭제</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">첫 콜 날짜</label>
          <input type="date" className={inp} value={item.first_call_date}
            onChange={e => onChange('first_call_date', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">업체명</label>
          <input className={inp} placeholder="업체명" value={item.company}
            onChange={e => onChange('company', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">대표명</label>
          <input className={inp} placeholder="대표명" value={item.ceo_name}
            onChange={e => onChange('ceo_name', e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-400 mb-0.5 block">전화번호</label>
          <input className={inp} placeholder="010-0000-0000" value={item.phone}
            onChange={e => onChange('phone', e.target.value)} />
        </div>
      </div>
    </div>
  )
}
