'use client'

import { useState, useEffect } from 'react'

interface Props {
  customer: any
  onClose: () => void
  userName?: string  // 타임라인 메모 작성자 이름 (없으면 읽기 전용)
}

const STATUS_LABEL: Record<string, string> = {
  lead: '신규', consulting: '상담중', db010: '직가DB',
  contracted: '계약', emotional: '감성톡', trash: '거절',
}
const STATUS_COLOR: Record<string, string> = {
  lead: 'bg-sky-100 text-sky-700', consulting: 'bg-sky-100 text-sky-700',
  db010: 'bg-violet-100 text-violet-700', contracted: 'bg-emerald-100 text-emerald-700',
  emotional: 'bg-pink-100 text-pink-700', trash: 'bg-gray-100 text-gray-500',
}

export default function CustomerReferencePanel({ customer, onClose, userName }: Props) {
  const [opsCase, setOpsCase] = useState<any | null>(null)
  const [opsLoading, setOpsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'incall' | 'ops'>('incall')
  const [tlText, setTlText] = useState('')
  const [tlSaving, setTlSaving] = useState(false)

  const d = customer?.details || {}
  const company = d.company || customer?.company || customer?.name || '—'
  const ownerName = d.sales_user_name || customer?.sales_user_name || '-'

  useEffect(() => {
    if (!customer) return
    setOpsLoading(true)
    setActiveTab('incall')
    const normPhone = (p: string) => (p || '').replace(/[^0-9]/g, '')
    const custPhone = normPhone(customer.phone || '')
    fetch('/api/ops-cases')
      .then(r => r.json())
      .then(data => {
        const found = (data.cases || []).find((c: any) =>
          (c.customer_id && c.customer_id === customer.id) ||
          (custPhone && normPhone(c.phone || '') === custPhone)
        )
        setOpsCase(found || null)
        if (found) setActiveTab('ops')
      })
      .catch(() => {})
      .finally(() => setOpsLoading(false))
  }, [customer?.id])

  async function addTimeline() {
    if (!tlText.trim() || !opsCase) return
    setTlSaving(true)
    const entry = {
      user: userName || '—',
      content: tlText.trim(),
      created_at: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00',
    }
    const updated = [...(opsCase.timeline || []), entry]
    await fetch(`/api/ops-cases/${opsCase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeline: updated }),
    })
    setOpsCase((prev: any) => ({ ...prev, timeline: updated }))
    setTlText('')
    setTlSaving(false)
  }

  const INCALL_FIELDS = [
    ['지역', d.region],
    ['접수일', d.reception_date],
    ['업종', d.business_type],
    ['실제업무', d.real_work],
    ['업력', d.years_in_business],
    ['직원수', d.employee_count],
    ['매출(26)', d.revenue_2026],
    ['매출(25)', d.revenue_2025],
    ['매출(24)', d.revenue_2024],
    ['기보대출', d.loan_kibo || d.loan_policy],
    ['신보대출', d.loan_shinbo],
    ['재단대출', d.loan_jaedan],
    ['진종대출', d.loan_jinjong],
    ['기타대출', d.loan_other || d.loan_credit],
    ['총대출', d.loan_total],
    ['KCB점수', d.credit_kcb || d.credit_score],
    ['NICE점수', d.credit_nice],
    ['세금체납', d.tax_status || d.tax_delinquency],
    ['필요자금', d.required_funds],
    ['자산', d.assets],
    ['솔루션', d.solution],
    ['콜결과', d.call_result],
    ['클로징', d.closing_result],
    ['계약수수료', d.contract_fee],
  ].filter(([, v]) => v)

  if (!customer) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm px-8 text-center gap-3">
        <div className="text-4xl opacity-30">🔍</div>
        <p className="font-medium">업체를 검색하여 선택하면</p>
        <p className="text-xs text-gray-300">이 패널에 인콜일지가 표시됩니다</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 헤더 */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 shrink-0 bg-[#F8F6F1]">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[#1B2A45] text-sm leading-tight truncate">{company}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[11px] text-gray-400 truncate">{customer.name} · {customer.phone}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_COLOR[customer.status] || 'bg-gray-100 text-gray-500'}`}>
              {STATUS_LABEL[customer.status] || customer.status}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">담당: {ownerName}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1 ml-2 shrink-0">✕</button>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-100 shrink-0">
        <button onClick={() => setActiveTab('incall')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'incall' ? 'border-[#1B2A45] text-[#1B2A45]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
          인콜일지
        </button>
        <button onClick={() => setActiveTab('ops')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'ops' ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
          관리팀 {opsCase ? '타임라인' : opsLoading ? '…' : '(없음)'}
        </button>
      </div>

      {/* 내용 */}
      <div className="flex-1 overflow-y-auto">

        {/* ── 인콜일지 ── */}
        {activeTab === 'incall' && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['대표명', customer.name],
                ['연락처', customer.phone],
                ...INCALL_FIELDS,
              ].filter(([, v]) => v).map(([label, val]) => (
                <div key={label as string} className="bg-[#F8F6F1] rounded-lg px-3 py-2">
                  <p className="text-[10px] text-[#1B2A45]/40 mb-0.5">{label}</p>
                  <p className="text-xs font-semibold text-[#1B2A45] break-words">{String(val)}</p>
                </div>
              ))}
            </div>
            {INCALL_FIELDS.length === 0 && !customer.name && (
              <p className="text-sm text-gray-400 text-center py-8">인콜일지 데이터 없음</p>
            )}
            {(customer.memo || customer.notes) && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <p className="text-[10px] text-amber-600 font-semibold mb-1">메모</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{customer.memo || customer.notes}</p>
              </div>
            )}
            {/* 콜 타임라인 (영업팀 기록) */}
            {customer.call_timeline && customer.call_timeline.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-[#1B2A45]/50 uppercase tracking-widest mb-2">콜 타임라인</p>
                <div className="space-y-1.5">
                  {[...customer.call_timeline].reverse().slice(0, 10).map((entry: any, i: number) => {
                    const dt = new Date(entry.created_at || '')
                    const dateStr = isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }) + ' ' + dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })
                    return (
                      <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-semibold text-[#1B2A45]">{entry.user || '—'}</span>
                          <span className="text-[9px] text-gray-400">{dateStr}</span>
                        </div>
                        <p className="text-[11px] text-gray-600 whitespace-pre-wrap">{entry.content}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 관리팀 타임라인 ── */}
        {activeTab === 'ops' && (
          <div className="p-4 space-y-3">
            {opsLoading ? (
              <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
            ) : !opsCase ? (
              <div className="text-center py-10">
                <p className="text-sm text-gray-400">관리팀 진행 내역 없음</p>
                <p className="text-xs text-gray-300 mt-1">계약 후 관리팀 배정 시 표시</p>
              </div>
            ) : (
              <>
                {/* 기관·단계 요약 */}
                <div className="bg-violet-50 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-violet-500 font-semibold mb-0.5">담당 기관</p>
                    <p className="text-sm font-bold text-[#1B2A45]">{opsCase.institution || '미배정'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-violet-500 font-semibold mb-0.5">단계</p>
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white bg-violet-500">
                      {opsCase.progress_stage || opsCase.stage || '—'}
                    </span>
                  </div>
                  {opsCase.ops_user_name && (
                    <div>
                      <p className="text-[10px] text-violet-500 font-semibold mb-0.5">담당자</p>
                      <p className="text-xs font-semibold text-[#1B2A45]">{opsCase.ops_user_name}</p>
                    </div>
                  )}
                </div>

                {/* 재무 정보 */}
                {[
                  ['승인금액', opsCase.details?.approval_amount],
                  ['계약금', opsCase.details?.contract_amount],
                  ['입금액', opsCase.details?.deposit_amount],
                  ['방문일정', opsCase.details?.visit_date],
                  ['계약일', opsCase.details?.contract_date],
                ].filter(([, v]) => v).length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ['승인금액', opsCase.details?.approval_amount],
                      ['계약금', opsCase.details?.contract_amount],
                      ['입금액', opsCase.details?.deposit_amount],
                      ['방문일정', opsCase.details?.visit_date],
                      ['계약일', opsCase.details?.contract_date],
                    ].filter(([, v]) => v).map(([label, val]) => (
                      <div key={label as string} className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                        <p className="text-xs font-semibold text-gray-800">{String(val)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 타임라인 입력 (userName이 있을 때만) */}
                {userName && (
                  <div className="flex gap-2">
                    <input value={tlText} onChange={e => setTlText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTimeline()}
                      placeholder="타임라인 메모 추가..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400" />
                    <button onClick={addTimeline} disabled={tlSaving || !tlText.trim()}
                      className="bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors">
                      {tlSaving ? '…' : '추가'}
                    </button>
                  </div>
                )}

                {/* 타임라인 목록 */}
                {(!opsCase.timeline || opsCase.timeline.length === 0) ? (
                  <p className="text-xs text-gray-400 text-center py-4">타임라인 없음</p>
                ) : (
                  <div className="relative pl-4 border-l-2 border-violet-200 space-y-2">
                    {[...(opsCase.timeline || [])].reverse().map((entry: any, i: number) => {
                      const isAuto = entry.user === '자동기록'
                      const d2 = new Date(entry.created_at || entry.date || '')
                      const dateStr = isNaN(d2.getTime()) ? '' : d2.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }) + ' ' + d2.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })
                      return (
                        <div key={i} className="relative">
                          <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${isAuto ? 'bg-violet-300' : 'bg-[#1B2A45]'}`} />
                          <div className={`rounded-lg px-3 py-2 ${isAuto ? 'bg-violet-50' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[10px] font-semibold ${isAuto ? 'text-violet-600' : 'text-[#1B2A45]'}`}>{entry.user || '—'}</span>
                              <span className="text-[10px] text-gray-400">{dateStr}</span>
                            </div>
                            <p className="text-xs text-gray-700">{entry.content || entry.text}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {opsCase.progress_memo && (
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-400 font-semibold mb-1">진행 메모</p>
                    <p className="text-xs text-gray-700">{opsCase.progress_memo}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
