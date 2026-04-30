'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Message {
  role: 'user' | 'model'
  parts: { text: string }[]
}

interface Contract {
  id: string
  customer_id: string
  sales_user_name: string
  contract_amount: number
  memo: string
  created_at: string
  customers: { name: string; phone: string; company: string }
}

interface OpsUser {
  id: string
  name: string
}

export default function CeoDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'ops' | 'assign' | 'revenue' | 'ai'>('overview')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">대표 대시보드</h1>
          <p className="text-sm text-gray-500">헌드레드 지원센터</p>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-sm text-gray-500 hover:text-gray-700">
          로그아웃
        </button>
      </header>

      <div className="px-4 md:px-6 pt-4">
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'overview', label: '전체 현황' },
            { key: 'assign', label: '계약 배정' },
            { key: 'sales', label: '영업팀' },
            { key: 'ops', label: '관리팀' },
            { key: 'revenue', label: '💰 매출 관리' },
            { key: 'ai', label: '✦ AI 비서' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? tab.key === 'ai' ? 'bg-indigo-600 text-white' : 'bg-gray-900 text-white'
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
        {activeTab === 'revenue' && <RevenueTab />}
        {activeTab === 'ai' && <AiTab />}
      </div>
    </div>
  )
}

// ─── 전체 현황 ───────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState({ customers: 0, contracts: 0, opsCases: 0, revenue: 0 })

  useEffect(() => {
    async function load() {
      const [cRes, conRes, opsRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/contracts'),
        fetch('/api/ops-cases'),
      ])
      const [cData, conData, opsData] = await Promise.all([cRes.json(), conRes.json(), opsRes.json()])
      const revenue = (opsData.cases || []).reduce((s: number, c: any) => s + (c.revenue || 0), 0)
      const inProgress = (opsData.cases || []).filter((c: any) => !['completed', 'rejected'].includes(c.progress_stage)).length
      setStats({
        customers: cData.customers?.length || 0,
        contracts: conData.contracts?.length || 0,
        opsCases: inProgress,
        revenue,
      })
    }
    load()
  }, [])

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[
        { label: '전체 고객', value: stats.customers + '명' },
        { label: '총 계약', value: stats.contracts + '건' },
        { label: '관리팀 진행 중', value: stats.opsCases + '건' },
        { label: '누적 매출', value: stats.revenue > 0 ? (stats.revenue / 10000).toFixed(0) + '만원' : '-' },
      ].map((s) => (
        <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm text-gray-500">{s.label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── 계약 배정 ───────────────────────────────────────────
function AssignTab() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [opsUsers, setOpsUsers] = useState<OpsUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOps, setSelectedOps] = useState<Record<string, string>>({})
  const [assigning, setAssigning] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const [cRes, uRes] = await Promise.all([
      fetch('/api/assign'),
      fetch('/api/users?role=ops'),
    ])
    const [cData, uData] = await Promise.all([cRes.json(), uRes.json()])
    setContracts(cData.contracts || [])
    setOpsUsers(uData.users || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function assign(contractId: string) {
    const opsUserId = selectedOps[contractId]
    if (!opsUserId) return alert('관리팀 담당자를 선택해주세요')
    const opsUser = opsUsers.find(u => u.id === opsUserId)
    setAssigning(contractId)
    await fetch('/api/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract_id: contractId, ops_user_id: opsUserId, ops_user_name: opsUser?.name }),
    })
    setAssigning(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">미배정 계약 목록</h2>
        <span className="text-xs text-gray-400">{contracts.length}건 대기 중</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">불러오는 중...</div>
      ) : contracts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          배정 대기 중인 계약이 없습니다.
        </div>
      ) : (
        contracts.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{c.customers?.name}</span>
                  {c.customers?.company && <span className="text-gray-400 text-xs">{c.customers.company}</span>}
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">배정 대기</span>
                </div>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>📞 {c.customers?.phone}</span>
                  {c.contract_amount > 0 && <span>💰 {c.contract_amount.toLocaleString()}원</span>}
                  <span>영업: {c.sales_user_name}</span>
                  <span>📅 {new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                {c.memo && <p className="text-xs text-gray-500 mt-2 bg-gray-50 px-3 py-2 rounded-lg">{c.memo}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={selectedOps[c.id] || ''}
                  onChange={e => setSelectedOps(prev => ({ ...prev, [c.id]: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="">담당자 선택</option>
                  {opsUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => assign(c.id)}
                  disabled={assigning === c.id || !selectedOps[c.id]}
                  className="bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  {assigning === c.id ? '배정 중...' : '배정'}
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── 영업팀 현황 ─────────────────────────────────────────
function SalesTab() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(d => {
      setCustomers(d.customers || [])
      setLoading(false)
    })
  }, [])

  const byStatus = {
    lead: customers.filter(c => c.status === 'lead').length,
    consulting: customers.filter(c => c.status === 'consulting').length,
    contracted: customers.filter(c => c.status === 'contracted').length,
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 mb-2">
        {[
          { label: '신규 리드', count: byStatus.lead, color: 'text-sky-600' },
          { label: '상담 중', count: byStatus.consulting, color: 'text-amber-600' },
          { label: '계약 완료', count: byStatus.contracted, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">전체 고객 목록 ({customers.length})</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">불러오는 중...</div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">등록된 고객이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {customers.map(c => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-900">{c.name}</span>
                  {c.company && <span className="text-xs text-gray-400 ml-2">{c.company}</span>}
                  <p className="text-xs text-gray-400">{c.phone} · {c.sales_user_name}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.status === 'lead' ? 'bg-sky-100 text-sky-700' :
                  c.status === 'consulting' ? 'bg-amber-100 text-amber-700' :
                  'bg-emerald-100 text-emerald-700'
                }`}>
                  {c.status === 'lead' ? '신규 리드' : c.status === 'consulting' ? '상담 중' : '계약 완료'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 관리팀 현황 ─────────────────────────────────────────
function OpsTab() {
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ops-cases').then(r => r.json()).then(d => {
      setCases(d.cases || [])
      setLoading(false)
    })
  }, [])

  const STAGE_LABEL: Record<string, string> = {
    assigned: '배정 완료', doc_collect: '서류 수집', reviewing: '심사 중',
    approved: '승인 완료', executing: '자금 집행', completed: '완료', rejected: '거절/보류',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">전체 케이스 ({cases.length})</h3>
      </div>
      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">불러오는 중...</div>
      ) : cases.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">배정된 케이스가 없습니다.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {cases.map(c => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-900">{c.customers?.name}</span>
                {c.customers?.company && <span className="text-xs text-gray-400 ml-2">{c.customers.company}</span>}
                <p className="text-xs text-gray-400">{c.ops_user_name} · {c.institution || '기관 미정'}</p>
              </div>
              <div className="flex items-center gap-2">
                {c.revenue > 0 && <span className="text-xs text-emerald-600 font-medium">{c.revenue.toLocaleString()}원</span>}
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {STAGE_LABEL[c.progress_stage] || c.progress_stage}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 매출 관리 ───────────────────────────────────────────
function RevenueTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/revenue').then(r => r.json()).then(d => {
      setData(d)
      setLoading(false)
    })
  }, [])

  const fmt = (n: number) => {
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '억'
    if (n >= 10000) return (n / 10000).toFixed(0) + '만'
    return n.toLocaleString()
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
  if (!data) return null

  return (
    <div className="space-y-6 pb-8">
      {/* 총계 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '영업팀 총 매출', value: data.totalSales, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '관리팀 총 매출', value: data.totalOps, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: '통합 총 매출', value: data.total, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-5 text-center`}>
            <p className={`text-2xl font-black ${s.color}`}>{fmt(s.value)}원</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 월별 차트 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">월별 매출 추이 (최근 6개월)</h3>
        {data.monthly.every((m: any) => m.합계 === 0) ? (
          <p className="text-center text-gray-400 text-sm py-8">아직 매출 데이터가 없습니다.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 11 }} width={55} />
              <Tooltip formatter={(v: any) => v.toLocaleString() + '원'} />
              <Legend />
              <Bar dataKey="영업팀" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="관리팀" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 직원별 실적 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 영업팀 직원별 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">영업팀 직원별 실적</h3>
          {data.salesByUser.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-4">데이터 없음</p>
          ) : (
            <div className="space-y-2">
              {data.salesByUser
                .sort((a: any, b: any) => b.amount - a.amount)
                .map((u: any) => (
                  <div key={u.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                        {u.name?.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.count}건</span>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">{fmt(u.amount)}원</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* 관리팀 직원별 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">관리팀 직원별 실적</h3>
          {data.opsByUser.length === 0 ? (
            <p className="text-gray-400 text-xs text-center py-4">데이터 없음</p>
          ) : (
            <div className="space-y-2">
              {data.opsByUser
                .sort((a: any, b: any) => b.amount - a.amount)
                .map((u: any) => (
                  <div key={u.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                        {u.name?.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.count}건</span>
                    </div>
                    <span className="text-sm font-semibold text-violet-600">{fmt(u.amount)}원</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── AI 비서 ────────────────────────────────────────────
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
        body: JSON.stringify({ message: input, history: messages }),
      })
      const data = await res.json()
      setMessages([...newMessages, {
        role: 'model',
        parts: [{ text: data.reply || ('오류: ' + (data.error || '알 수 없는 오류')) }],
      }])
    } catch {
      setMessages([...newMessages, { role: 'model', parts: [{ text: '서버 연결 오류가 발생했습니다.' }] }])
    } finally {
      setLoading(false)
    }
  }

  const suggestions = ['2024년 소상공인 정책자금 종류 알려줘', '정책자금 신청 시 필요한 서류는?', '기술보증기금과 신용보증기금 차이점']

  return (
    <div className="bg-white rounded-xl border border-gray-100 flex flex-col" style={{ height: 'calc(100vh - 220px)' }}>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">AI</span>
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-sm">헌드레드 AI 비서</p>
          <p className="text-xs text-gray-400">정책자금 전문 · Gemini 3.1 Flash</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-8">
            <p className="text-gray-400 text-sm mb-6">무엇이든 물어보세요</p>
            <div className="flex flex-col gap-2 items-center">
              {suggestions.map((s) => (
                <button key={s} onClick={() => setInput(s)}
                  className="text-sm text-indigo-600 border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition-colors max-w-xs">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
              msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
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
      <form onSubmit={sendMessage} className="px-4 py-4 border-t border-gray-100">
        <div className="flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="정책자금, 고객 분석, 업무 관련 무엇이든..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading} />
          <button type="submit" disabled={loading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            전송
          </button>
        </div>
      </form>
    </div>
  )
}
