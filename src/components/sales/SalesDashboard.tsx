'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { signOut } from 'next-auth/react'
import ReportTab from './ReportTab'

interface Customer {
  id: string
  name: string
  phone: string
  company: string
  loan_history: string
  notes: string
  status: 'lead' | 'consulting' | 'contracted'
  sales_user_name: string
  updated_at: string
}

interface Contract {
  id: string
  customer_id: string
  contract_amount: number
  memo: string
  status: string
  created_at: string
  customers: { name: string; phone: string; company: string }
}

interface Props {
  userId: string
  userName: string
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  lead:        { label: '신규 리드',   color: 'bg-sky-100 text-sky-700' },
  consulting:  { label: '상담 중',     color: 'bg-amber-100 text-amber-700' },
  contracted:  { label: '계약 완료',   color: 'bg-emerald-100 text-emerald-700' },
}

export default function SalesDashboard({ userId, userName }: Props) {
  const [activeTab, setActiveTab] = useState<'customers' | 'contracts' | 'report'>('customers')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saved' | 'saving' | 'unsaved'>>({})
  const [contractModal, setContractModal] = useState<Customer | null>(null)
  const [contractAmount, setContractAmount] = useState('')
  const [contractMemo, setContractMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const autoSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // 데이터 로드
  async function loadAll() {
    setLoading(true)
    const [cRes, conRes] = await Promise.all([
      fetch('/api/customers'),
      fetch('/api/contracts'),
    ])
    const cData = await cRes.json()
    const conData = await conRes.json()
    setCustomers(cData.customers || [])
    setContracts(conData.contracts || [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  // 자동 저장 (debounce 1.2초)
  const autoSave = useCallback((id: string, patch: Partial<Customer>) => {
    setSaveStatus(prev => ({ ...prev, [id]: 'unsaved' }))
    if (autoSaveTimers.current[id]) clearTimeout(autoSaveTimers.current[id])
    autoSaveTimers.current[id] = setTimeout(async () => {
      setSaveStatus(prev => ({ ...prev, [id]: 'saving' }))
      await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      setSaveStatus(prev => ({ ...prev, [id]: 'saved' }))
    }, 1200)
  }, [])

  function updateLocalCustomer(id: string, field: keyof Customer, value: string) {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
    autoSave(id, { [field]: value })
  }

  // 신규 고객 등록
  const [newForm, setNewForm] = useState({ name: '', phone: '', company: '', loan_history: '', notes: '' })

  async function submitNew(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newForm, status: 'lead' }),
    })
    if (res.ok) {
      setNewForm({ name: '', phone: '', company: '', loan_history: '', notes: '' })
      setShowForm(false)
      loadAll()
    }
    setSubmitting(false)
  }

  // 계약 처리
  async function submitContract() {
    if (!contractModal) return
    setSubmitting(true)
    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: contractModal.id,
        contract_amount: Number(contractAmount.replace(/,/g, '')),
        memo: contractMemo,
      }),
    })
    if (res.ok) {
      setContractModal(null)
      setContractAmount('')
      setContractMemo('')
      loadAll()
    }
    setSubmitting(false)
  }

  // 고객 삭제
  async function deleteCustomer(id: string) {
    if (!confirm('이 고객을 삭제하시겠습니까?')) return
    await fetch(`/api/customers/${id}`, { method: 'DELETE' })
    loadAll()
  }

  // 매출 집계
  const totalRevenue = contracts.reduce((s, c) => s + (c.contract_amount || 0), 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthRevenue = contracts
    .filter(c => c.created_at?.slice(0, 7) === thisMonth)
    .reduce((s, c) => s + (c.contract_amount || 0), 0)

  const tabs = [
    { key: 'customers', label: `내 고객 (${customers.length})` },
    { key: 'contracts', label: `계약 완료 (${contracts.length})` },
    { key: 'report', label: '📝 보고' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{userName.charAt(0)}</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">영업팀 대시보드</h1>
            <p className="text-xs text-gray-400">{userName} 님</p>
          </div>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="text-xs text-gray-400 hover:text-gray-700">
          로그아웃
        </button>
      </header>

      <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto">
        {/* 매출 요약 카드 */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: '내 고객', value: customers.length + '명', color: 'text-blue-600' },
            { label: '이번달 매출', value: monthRevenue > 0 ? (monthRevenue / 10000).toFixed(0) + '만원' : '-', color: 'text-emerald-600' },
            { label: '누적 매출', value: totalRevenue > 0 ? (totalRevenue / 10000).toFixed(0) + '만원' : '-', color: 'text-gray-800' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 고객 탭 */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            {/* 신규 등록 버튼 */}
            <div className="flex justify-end">
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {showForm ? '✕ 취소' : '+ 신규 고객 등록'}
              </button>
            </div>

            {/* 신규 고객 폼 */}
            {showForm && (
              <form onSubmit={submitNew} className="bg-white rounded-xl border border-blue-100 p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 mb-2">신규 고객 등록</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">이름 *</label>
                    <input
                      required value={newForm.name}
                      onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="홍길동"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">연락처</label>
                    <input
                      value={newForm.phone}
                      onChange={e => setNewForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="010-0000-0000"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">회사명</label>
                    <input
                      value={newForm.company}
                      onChange={e => setNewForm(p => ({ ...p, company: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="(주)홍길동상사"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">기대출 내역</label>
                    <input
                      value={newForm.loan_history}
                      onChange={e => setNewForm(p => ({ ...p, loan_history: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="기업은행 1억, 신보 5천만원"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">상담 메모</label>
                  <textarea
                    value={newForm.notes}
                    onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="고객 상황, 필요 자금 규모 등"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
                    취소
                  </button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {submitting ? '등록 중...' : '등록하기'}
                  </button>
                </div>
              </form>
            )}

            {/* 고객 목록 */}
            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : customers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                아직 등록된 고객이 없습니다.<br />위의 버튼으로 첫 번째 고객을 등록해보세요.
              </div>
            ) : (
              <div className="space-y-3">
                {customers.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {/* 카드 헤더 */}
                    <div
                      className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setEditingId(editingId === c.id ? null : c.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900 text-sm">{c.name}</span>
                          {c.company && <span className="text-gray-400 text-xs ml-2">{c.company}</span>}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_LABEL[c.status]?.color}`}>
                          {STATUS_LABEL[c.status]?.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {saveStatus[c.id] === 'saving' && <span className="text-xs text-amber-500">저장 중...</span>}
                        {saveStatus[c.id] === 'saved' && <span className="text-xs text-emerald-500">✓ 저장됨</span>}
                        {saveStatus[c.id] === 'unsaved' && <span className="text-xs text-gray-400">수정 중...</span>}
                        <span className="text-gray-300 text-sm">{editingId === c.id ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* 카드 상세 (펼쳐질 때) */}
                    {editingId === c.id && (
                      <div className="px-5 pb-5 border-t border-gray-50 pt-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">이름</label>
                            <input
                              value={c.name}
                              onChange={e => updateLocalCustomer(c.id, 'name', e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">연락처</label>
                            <input
                              value={c.phone}
                              onChange={e => updateLocalCustomer(c.id, 'phone', e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">회사명</label>
                            <input
                              value={c.company}
                              onChange={e => updateLocalCustomer(c.id, 'company', e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">상태</label>
                            <select
                              value={c.status}
                              onChange={e => updateLocalCustomer(c.id, 'status', e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="lead">신규 리드</option>
                              <option value="consulting">상담 중</option>
                              <option value="contracted">계약 완료</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">기대출 내역</label>
                          <input
                            value={c.loan_history}
                            onChange={e => updateLocalCustomer(c.id, 'loan_history', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">상담 메모</label>
                          <textarea
                            value={c.notes}
                            onChange={e => updateLocalCustomer(c.id, 'notes', e.target.value)}
                            rows={3}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                        </div>
                        <div className="flex justify-between items-center pt-1">
                          <button
                            onClick={() => deleteCustomer(c.id)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors"
                          >
                            삭제
                          </button>
                          <div className="flex gap-2">
                            {c.status !== 'contracted' && (
                              <button
                                onClick={() => {
                                  setContractModal(c)
                                  setContractAmount('')
                                  setContractMemo('')
                                }}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              >
                                🤝 계약 처리
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-300 text-right">
                          마지막 수정: {new Date(c.updated_at).toLocaleString('ko-KR')}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 계약 완료 탭 */}
        {activeTab === 'contracts' && (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12 text-gray-400 text-sm">불러오는 중...</div>
            ) : contracts.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                아직 계약 완료 건이 없습니다.
              </div>
            ) : (
              contracts.map(con => (
                <div key={con.id} className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-gray-900 text-sm">{con.customers?.name}</span>
                      {con.customers?.company && (
                        <span className="text-gray-400 text-xs ml-2">{con.customers.company}</span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      con.status === 'pending_assign'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {con.status === 'pending_assign' ? '대표 배정 대기' : '배정 완료'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>📞 {con.customers?.phone}</span>
                    {con.contract_amount > 0 && (
                      <span>💰 {con.contract_amount.toLocaleString()}원</span>
                    )}
                    <span>📅 {new Date(con.created_at).toLocaleDateString('ko-KR')}</span>
                  </div>
                  {con.memo && <p className="text-xs text-gray-500 mt-2 bg-gray-50 px-3 py-2 rounded-lg">{con.memo}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {/* 보고 탭 */}
        {activeTab === 'report' && (
          <ReportTab userId={userId} userName={userName} />
        )}
      </div>

      {/* 계약 처리 모달 */}
      {contractModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-1">계약 처리</h3>
            <p className="text-sm text-gray-400 mb-5">
              <strong className="text-gray-700">{contractModal.name}</strong> 님을 계약 완료로 전환하고 대표님께 배정 요청합니다.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">계약 금액 (원)</label>
                <input
                  value={contractAmount}
                  onChange={e => setContractAmount(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="예: 50000000"
                  type="number"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">계약 메모</label>
                <textarea
                  value={contractMemo}
                  onChange={e => setContractMemo(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="계약 내용, 관리팀에 전달 사항 등"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setContractModal(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={submitContract}
                disabled={submitting}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {submitting ? '처리 중...' : '계약 완료 처리'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
