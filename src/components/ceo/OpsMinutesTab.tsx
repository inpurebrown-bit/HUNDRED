'use client'

import { useState, useEffect } from 'react'

interface OpsReport {
  id: string
  user_name: string
  report_type: string
  report_date: string
  data: any
}

const todayStr = () => new Date().toISOString().slice(0, 10)
const yesterdayStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
}
const fmtMoney = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(0)}만원` : `${n.toLocaleString()}원`

export default function OpsMinutesTab() {
  const [prepDate, setPrepDate] = useState(yesterdayStr())
  const [reports, setReports] = useState<OpsReport[]>([])
  const [loading, setLoading] = useState(false)
  // 처음 열 때: 어제에 보고가 없으면(주말·휴일) 가장 최근 관리팀 보고가 있는 날짜로 자동 이동
  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => {
      const all: OpsReport[] = d.reports || []
      const t = todayStr()
      const ds = all.filter(r => r.report_type === 'ops_daily').map(r => r.report_date).sort()
      const pick = ds.filter(x => x < t).slice(-1)[0] || ds.slice(-1)[0]
      if (pick) setPrepDate(pick)
    }).catch(() => {})
  }, [])

  async function loadReports(date: string) {
    setLoading(true)
    const res = await fetch(`/api/reports?date=${date}`)
    const d = await res.json()
    const all: OpsReport[] = d.reports || []
    setReports(all.filter(r => r.report_type === 'ops_daily'))
    setLoading(false)
  }

  useEffect(() => { loadReports(prepDate) }, [prepDate])

  return (
    <div className="space-y-4 pb-8">
      {/* 헤더 */}
      <div className="bg-[#1B2A45] rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-3 print-hide">
        <div>
          <h2 className="font-bold text-white text-base">관리팀 회의 자료</h2>
          <p className="text-xs text-white/50 mt-0.5">
            보고 기준: <b className="text-white/80">{prepDate}</b>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/60">보고 날짜</label>
            <input
              type="date"
              value={prepDate}
              onChange={e => setPrepDate(e.target.value)}
              className="border border-white/20 bg-white/10 text-white rounded-lg px-2 py-1 text-xs focus:outline-none"
            />
          </div>
          <button
            onClick={() => loadReports(prepDate)}
            className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            새로고침
          </button>
          <button
            onClick={() => window.print()}
            className="bg-[#C5A258] hover:bg-[#D4B568] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            출력
          </button>
        </div>
      </div>

      <div className="hidden print:block text-center mb-3">
        <h2 className="text-base font-bold text-gray-800">관리팀 회의 자료 — {prepDate}</h2>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-10 text-center text-gray-400 text-sm">
          <p>보고 데이터 없음</p>
          <p className="text-xs mt-1 text-gray-300">날짜: {prepDate}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(r => {
            const s = r.data?.auto_stats || {}
            const stage2: any[] = r.data?.stage2_notes || []
            const activeCases: any[] = r.data?.active_case_notes || []
            const specialNotes: string = r.data?.special_notes || ''

            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden print:break-after-page">
                {/* 직원 헤더 */}
                <div className="bg-[#1B2A45] px-5 py-3 flex items-center justify-between">
                  <h3 className="text-white font-bold text-base">{r.user_name}</h3>
                  <span className="text-white/50 text-xs">{r.report_date}</span>
                </div>

                <div className="p-5 space-y-4">
                  {/* 수치 요약 */}
                  <div>
                    <p className="text-xs font-bold text-[#1B2A45] mb-2">이달 현황</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: '이달 매출', value: s.month_revenue ? fmtMoney(s.month_revenue) : '—', color: 'bg-indigo-50 text-indigo-700' },
                        { label: '서류진행', value: `${s.stage2_count ?? 0}건`, color: 'bg-amber-50 text-amber-700' },
                        { label: '승인/뿌토', value: `${s.approval_count ?? 0}건`, color: 'bg-green-50 text-green-700' },
                        { label: '입금', value: `${s.payment_count ?? 0}건`, color: 'bg-blue-50 text-blue-700' },
                      ].map(st => (
                        <div key={st.label} className={`rounded-lg p-2 text-center ${st.color.split(' ')[0]}`}>
                          <p className="text-[9px] text-gray-400">{st.label}</p>
                          <p className={`text-sm font-black ${st.color.split(' ')[1]}`}>{st.value}</p>
                        </div>
                      ))}
                    </div>
                    {/* 입금 업체명 */}
                    {(s.payment_names || []).length > 0 && (
                      <p className="text-[10px] text-blue-600 mt-1.5 pl-1">
                        입금: {s.payment_names.join(', ')}
                      </p>
                    )}
                    {/* 승인 업체명 */}
                    {(s.approval_names || []).length > 0 && (
                      <p className="text-[10px] text-green-600 mt-0.5 pl-1">
                        승인: {s.approval_names.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* 서류진행 케이스 */}
                    <div>
                      <p className="text-xs font-bold text-amber-600 mb-2">서류진행 ({stage2.length}건)</p>
                      {stage2.length === 0 ? (
                        <p className="text-[11px] text-gray-300 pl-1">없음</p>
                      ) : (
                        <div className="space-y-1">
                          {stage2.map((c, i) => (
                            <div key={i} className="bg-amber-50/60 rounded-lg px-2 py-1.5">
                              <p className="text-[11px] font-bold text-gray-800">{c.company}</p>
                              {c.fund && <p className="text-[10px] text-amber-700 mt-0.5">{c.fund}</p>}
                              {c.note && <p className="text-[10px] text-gray-500 mt-0.5">{c.note}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 진행현황 케이스 */}
                    <div>
                      <p className="text-xs font-bold text-[#1B2A45] mb-2">진행현황 ({activeCases.length}건)</p>
                      {activeCases.length === 0 ? (
                        <p className="text-[11px] text-gray-300 pl-1">없음</p>
                      ) : (
                        <div className="space-y-1">
                          {activeCases.map((c, i) => (
                            <div key={i} className="bg-slate-50/60 rounded-lg px-2 py-1.5">
                              <div className="flex items-start justify-between gap-1">
                                <p className="text-[11px] font-bold text-gray-800">{c.company}</p>
                                {c.institution && (
                                  <span className="text-[9px] bg-[#1B2A45]/10 text-[#1B2A45] px-1.5 py-0.5 rounded-full shrink-0">{c.institution}</span>
                                )}
                              </div>
                              {c.note && <p className="text-[10px] text-gray-500 mt-0.5">{c.note}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 특이사항 */}
                  {specialNotes && (
                    <div className="bg-rose-50 border border-rose-100 rounded-lg px-3 py-2.5">
                      <p className="text-[10px] font-bold text-rose-600 mb-1">특이사항</p>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{specialNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 전체 메모 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 print:break-before-page">
        <p className="text-xs font-bold text-gray-500 mb-3">전체 결정사항 / 메모</p>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-5 border-b border-dashed border-gray-300" />
          ))}
        </div>
      </div>
    </div>
  )
}
