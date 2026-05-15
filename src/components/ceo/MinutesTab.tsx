'use client'

import { useState, useEffect } from 'react'

// ── 타입 ───────────────────────────────────────────────────
interface Report {
  id: string
  user_name: string
  report_type: 'morning' | 'daily'
  report_date: string
  data: any
}
interface NextDayCheck {
  id: string
  company: string
  note: string
  done: boolean
}

// ── 헬퍼 ──────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10)
const yesterdayStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10)
}
const pct = (n: number, d: number) => d === 0 ? '—' : (n / d * 100).toFixed(0) + '%'
const pctNum = (n: number, d: number) => d === 0 ? 100 : (n / d * 100)
function uid() { return Math.random().toString(36).slice(2) }

// ── 메인 컴포넌트 ─────────────────────────────────────────
export default function MinutesTab() {
  // 어제 마감보고 기준 날짜 (조정 가능)
  const [prepDate, setPrepDate] = useState(yesterdayStr())
  const [dailyReports, setDailyReports] = useState<Report[]>([])
  const [morningReports, setMorningReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)
  const [nextDayChecks, setNextDayChecks] = useState<Record<string, NextDayCheck[]>>({})

  async function loadReports(dateForDaily: string) {
    setLoading(true)
    const todayDate = todayStr()
    const r1 = await fetch(`/api/reports?date=${dateForDaily}`)
    const d1 = await r1.json()
    const allYesterday: Report[] = d1.reports || []
    setDailyReports(allYesterday.filter(r => r.report_type === 'daily'))
    const r2 = await fetch(`/api/reports?date=${todayDate}`)
    const d2 = await r2.json()
    const allToday: Report[] = d2.reports || []
    setMorningReports(allToday.filter(r => r.report_type === 'morning'))
    setLoading(false)
  }

  useEffect(() => { loadReports(prepDate) }, [prepDate])

  const today = todayStr()
  const allNames = [...new Set([
    ...dailyReports.map(r => r.user_name),
    ...morningReports.map(r => r.user_name),
  ])]
  const morningMap: Record<string, Report> = {}
  const dailyMap: Record<string, Report> = {}
  morningReports.forEach(r => { morningMap[r.user_name] = r })
  dailyReports.forEach(r => { dailyMap[r.user_name] = r })

  return (
    <div className="space-y-4 pb-8">
      {/* 헤더 */}
      <div className="bg-[#1B2A45] rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-3 print-hide">
        <div>
          <h2 className="font-bold text-white text-base">📒 오늘 회의 자료</h2>
          <p className="text-xs text-white/50 mt-0.5">
            마감보고 기준: <b className="text-white/80">{prepDate}</b> &nbsp;·&nbsp; 오전보고: <b className="text-white/80">{today}</b>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/60">마감보고 날짜</label>
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
            🔄 새로고침
          </button>
          <button
            onClick={() => window.print()}
            className="bg-[#C5A258] hover:bg-[#D4B568] text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            🖨️ 출력
          </button>
        </div>
      </div>
      {/* 인쇄 전용 타이틀 */}
      <div className="hidden print:block text-center mb-3">
        <h2 className="text-base font-bold text-gray-800">📒 회의 자료 — 마감보고: {prepDate} · 오전보고: {today}</h2>
      </div>

      {/* 직원별 보고 */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
      ) : allNames.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E2D4] p-10 text-center text-gray-400 text-sm">
          <p>보고 데이터 없음</p>
          <p className="text-xs mt-1 text-gray-300">마감보고: {prepDate} · 오전보고: {today}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allNames.map(name => {
            const mr = morningMap[name]
            const dr = dailyMap[name]
            const tc = Number(mr?.data?.total_calls || 0)
            const cn = Number(mr?.data?.connected || 0)
            const db = Number(mr?.data?.db_secured || 0)
            const oc = Number(mr?.data?.outbound_contracts || 0)

            const pressPoints: string[] = []
            if (mr) {
              if (tc === 0) pressPoints.push('콜 0건 — 활동 자체가 없음, 원인 확인 필요')
              else {
                if (pctNum(cn, tc) < 30) pressPoints.push(`연결율 ${pct(cn, tc)} — 30% 미달, 타겟 DB 품질 점검`)
                if (oc === 0 && cn > 0) pressPoints.push('아웃계약 0건 — 연결 후 클로징 전환 전략 논의')
                if (db === 0 && cn > 0) pressPoints.push('DB확보 0건 — 상담 전환이 안 됨, 멘트 점검')
              }
              if (pressPoints.length === 0) pressPoints.push('✓ 전체 양호 — 유지 독려')
            }

            return (
              <div key={name} className="bg-white rounded-xl border border-gray-200 overflow-hidden print:overflow-visible print:break-after-page">
                {/* 직원 헤더 */}
                <div className="bg-[#1B2A45] px-5 py-3 flex items-center justify-between">
                  <h3 className="text-white font-bold text-base">{name}</h3>
                  <div className="flex items-center gap-3 text-[10px] text-white/50">
                    <span>마감: {prepDate}</span>
                    <span>오전: {today}</span>
                    {!morningMap[name] && (
                      <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">오전보고 미제출</span>
                    )}
                    {!dailyMap[name] && (
                      <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">마감보고 미제출</span>
                    )}
                  </div>
                </div>

                <div className="p-5 grid md:grid-cols-2 print:grid-cols-1 gap-4">
                  {/* 오전보고 */}
                  <div>
                    <p className="text-xs font-bold text-amber-600 mb-3">☀️ 오전보고</p>
                    {mr ? (
                      <>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          {[
                            { label: '총 콜', value: tc, rate: null },
                            { label: '연결됨', value: cn, rate: pct(cn, tc) },
                            { label: 'DB확보', value: db, rate: pct(db, tc) },
                            { label: '아웃계약', value: oc, rate: pct(oc, tc) },
                          ].map(s => (
                            <div key={s.label} className="bg-amber-50 rounded-lg p-2 text-center">
                              <p className="text-[9px] text-gray-400">{s.label}</p>
                              <p className="text-lg font-black text-amber-700">{s.value}</p>
                              {s.rate && <p className="text-[10px] text-amber-500 font-semibold">{s.rate}</p>}
                            </div>
                          ))}
                        </div>
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                          <p className="text-[10px] font-bold text-red-600 mb-1.5">📌 프레스 체크</p>
                          <div className="space-y-0.5">
                            {pressPoints.map((pt, i) => (
                              <p key={i} className={`text-xs ${pt.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{pt}</p>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-400 text-center">오전보고 미제출</div>
                    )}
                  </div>

                  {/* 마감보고 */}
                  <div>
                    <p className="text-xs font-bold text-blue-600 mb-3">📋 마감보고</p>
                    {!dr && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400 mb-2 text-center">마감보고 미제출</div>
                    )}
                    <div className="space-y-2">
                      {/* 계약 수치 */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: '당일계약', value: dr?.data?.today_contracts ?? '—' },
                          { label: '월누적', value: dr?.data?.month_contracts ?? '—' },
                          { label: '월목표', value: dr?.data?.goal ?? '—' },
                        ].map(s => (
                          <div key={s.label} className="bg-blue-50 rounded-lg p-2 text-center">
                            <p className="text-[9px] text-gray-400">{s.label}</p>
                            <p className="text-lg font-black text-blue-700">{s.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* 공급DB 상담결과 */}
                      <div>
                        <p className="text-[10px] font-bold text-green-700 mb-1">🟢 공급DB 상담결과</p>
                        {(dr?.data?.supply_db || []).length > 0 ? (
                          <div className="space-y-1">
                            {(dr!.data.supply_db as any[]).map((i: any, idx: number) => {
                              const st = i.status || (i.is_decided ? '결정업체' : '')
                              const stColor: Record<string, string> = {
                                '결정업체': 'bg-emerald-100 text-emerald-700',
                                '계약대기': 'bg-blue-100 text-blue-700',
                                '계약서대기': 'bg-sky-100 text-sky-700',
                                '입금대기': 'bg-violet-100 text-violet-700',
                                '고민중': 'bg-amber-100 text-amber-700',
                                '재통화예정': 'bg-orange-100 text-orange-700',
                                '감성톡관리': 'bg-pink-100 text-pink-700',
                              }
                              return (
                                <div key={idx} className="bg-green-50/60 rounded-lg px-2 py-1.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-bold text-gray-800">{i.company}</span>
                                    {st && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${stColor[st] || 'bg-gray-100 text-gray-600'}`}>{st}</span>}
                                    {st === '재통화예정' && i.callback_date && <span className="text-[9px] text-orange-600">({i.callback_date})</span>}
                                  </div>
                                  {i.content && <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{i.content}</p>}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-300 pl-1">없음</p>
                        )}
                      </div>

                      {/* 아웃바운딩 상담결과 */}
                      <div>
                        <p className="text-[10px] font-bold text-violet-700 mb-1">🟣 아웃바운딩 상담결과</p>
                        {(dr?.data?.outbound || []).length > 0 ? (
                          <div className="space-y-1">
                            {(dr!.data.outbound as any[]).map((i: any, idx: number) => {
                              const st = i.status || (i.is_decided ? '결정업체' : '')
                              const stColor: Record<string, string> = {
                                '결정업체': 'bg-emerald-100 text-emerald-700',
                                '계약대기': 'bg-blue-100 text-blue-700',
                                '계약서대기': 'bg-sky-100 text-sky-700',
                                '입금대기': 'bg-violet-100 text-violet-700',
                                '고민중': 'bg-amber-100 text-amber-700',
                                '재통화예정': 'bg-orange-100 text-orange-700',
                                '감성톡관리': 'bg-pink-100 text-pink-700',
                              }
                              return (
                                <div key={idx} className="bg-violet-50/60 rounded-lg px-2 py-1.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-bold text-gray-800">{i.company}</span>
                                    {st && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${stColor[st] || 'bg-gray-100 text-gray-600'}`}>{st}</span>}
                                    {st === '재통화예정' && i.callback_date && <span className="text-[9px] text-orange-600">({i.callback_date})</span>}
                                  </div>
                                  {i.content && <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{i.content}</p>}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-300 pl-1">없음</p>
                        )}
                      </div>

                      {/* 결정업체 */}
                      <div>
                        <p className="text-[10px] font-bold text-emerald-700 mb-1">✅ 결정업체</p>
                        {(dr?.data?.decided || []).length > 0 ? (
                          <div className="space-y-1">
                            {(dr!.data.decided as any[]).map((d: any, idx: number) => (
                              <div key={idx} className="bg-emerald-50/60 rounded-lg px-2 py-1.5">
                                <span className="text-[11px] font-bold text-gray-800">{d.company}</span>
                                {d.content && <p className="text-[10px] text-gray-500 mt-0.5">{d.content}</p>}
                                {d.current_progress && <p className="text-[10px] text-emerald-700 mt-0.5">▶ 진행: {d.current_progress}</p>}
                                {d.next_action && <p className="text-[10px] text-blue-600 mt-0.5">→ 다음: {d.next_action}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-300 pl-1">없음</p>
                        )}
                      </div>

                      {/* 고민관리업체 */}
                      <div>
                        <p className="text-[10px] font-bold text-amber-700 mb-1">🤔 고민관리업체</p>
                        {(dr?.data?.worried || []).length > 0 ? (
                          <div className="space-y-1">
                            {(dr!.data.worried as any[]).map((w: any, idx: number) => (
                              <div key={idx} className="bg-amber-50/60 rounded-lg px-2 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-bold text-gray-800">{w.company}</span>
                                  {w.probability && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                                      w.probability === '상' ? 'bg-green-100 text-green-700'
                                      : w.probability === '중' ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-600'
                                    }`}>{w.probability}</span>
                                  )}
                                </div>
                                {w.content && <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{w.content}</p>}
                                {w.reason && <p className="text-[10px] text-amber-700 mt-0.5">고민사유: {w.reason}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-300 pl-1">없음</p>
                        )}
                      </div>

                      {/* 미팅 일정 */}
                      <div>
                        <p className="text-[10px] font-bold text-sky-700 mb-1">📅 미팅 일정</p>
                        {(dr?.data?.meetings || []).length > 0 ? (
                          <div className="space-y-0.5">
                            {(dr!.data.meetings as any[]).map((m: any, idx: number) => (
                              <p key={idx} className="text-[11px] text-gray-600">
                                {m.company} — {m.date} {m.time}{m.location && ` (${m.location})`}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-300 pl-1">없음</p>
                        )}
                      </div>

                      {/* 입금대기 */}
                      <div>
                        <p className="text-[10px] font-bold text-indigo-700 mb-1">💰 입금대기 업체</p>
                        {(dr?.data?.payment_waiting || []).length > 0 ? (
                          <div className="space-y-1">
                            {(dr!.data.payment_waiting as any[]).map((p: any, idx: number) => (
                              <div key={idx} className="bg-indigo-50/60 rounded-lg px-2 py-1.5">
                                <span className="text-[11px] font-bold text-gray-800">{p.company}</span>
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  {p.ceo_name && `${p.ceo_name}`}{p.phone && ` · ${p.phone}`}{p.first_call_date && ` · 첫콜 ${p.first_call_date}`}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-300 pl-1">없음</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 다음날 확인 필요 */}
                <div className="border-t border-blue-100 px-5 py-3 bg-blue-50/40">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-blue-600">🔔 다음날 확인 필요</p>
                    <button
                      onClick={() => setNextDayChecks(prev => ({
                        ...prev,
                        [name]: [...(prev[name] || []), { id: uid(), company: '', note: '', done: false }]
                      }))}
                      className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-0.5 rounded transition-colors print-hide"
                    >
                      + 추가
                    </button>
                  </div>
                  {(nextDayChecks[name] || []).length === 0 ? (
                    <p className="text-[10px] text-blue-300 text-center py-1">추가하면 출력물에 포함됩니다</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(nextDayChecks[name] || []).map((chk, ci) => (
                        <div key={chk.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={chk.done}
                            onChange={e => setNextDayChecks(prev => ({
                              ...prev,
                              [name]: (prev[name] || []).map((c, i) => i === ci ? { ...c, done: e.target.checked } : c)
                            }))}
                            className="w-3.5 h-3.5 rounded shrink-0"
                          />
                          <input
                            type="text"
                            value={chk.company}
                            onChange={e => setNextDayChecks(prev => ({
                              ...prev,
                              [name]: (prev[name] || []).map((c, i) => i === ci ? { ...c, company: e.target.value } : c)
                            }))}
                            placeholder="업체명"
                            className="border border-blue-200 rounded px-2 py-0.5 text-xs bg-white w-28 focus:outline-none"
                          />
                          <input
                            type="text"
                            value={chk.note}
                            onChange={e => setNextDayChecks(prev => ({
                              ...prev,
                              [name]: (prev[name] || []).map((c, i) => i === ci ? { ...c, note: e.target.value } : c)
                            }))}
                            placeholder="확인 내용"
                            className="flex-1 border border-blue-200 rounded px-2 py-0.5 text-xs bg-white focus:outline-none"
                          />
                          <button
                            onClick={() => setNextDayChecks(prev => ({
                              ...prev,
                              [name]: (prev[name] || []).filter((_, i) => i !== ci)
                            }))}
                            className="text-red-300 hover:text-red-500 text-xs print-hide"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 전체 메모 공간 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 print:break-before-page">
        <p className="text-xs font-bold text-gray-500 mb-3">📝 전체 결정사항 / 메모</p>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-5 border-b border-dashed border-gray-300" />
          ))}
        </div>
      </div>
    </div>
  )
}
