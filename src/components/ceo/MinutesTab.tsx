'use client'

import { useState, useEffect } from 'react'

// ── 타입 ───────────────────────────────────────────────────
interface StaffFollowup {
  id: string
  company: string
  note: string
  until_date: string
}
interface StaffSection {
  user_name: string
  press_notes: string
  instructions: string
  followups: StaffFollowup[]
}
interface MeetingMinute {
  id: string
  meeting_date: string
  summary: any
  raw_text?: string
  created_by: string
}
interface Report {
  id: string
  user_name: string
  report_type: 'morning' | 'daily'
  report_date: string
  data: any
}
// 다음날 확인 필요 아이템
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
  const [subTab, setSubTab] = useState<'prep' | 'write' | 'history'>('prep')

  // 회의자료 준비
  const [prepDate, setPrepDate] = useState(yesterdayStr())
  const [dayReports, setDayReports] = useState<Report[]>([])
  const [loadingReports, setLoadingReports] = useState(false)

  // 회의록 목록
  const [minutes, setMinutes] = useState<MeetingMinute[]>([])
  const [loadingMinutes, setLoadingMinutes] = useState(true)
  const [selectedMinute, setSelectedMinute] = useState<MeetingMinute | null>(null)

  // 작성 폼
  const [meetingDate, setMeetingDate] = useState(todayStr())
  const [staffSections, setStaffSections] = useState<StaffSection[]>([])
  const [generalDecisions, setGeneralDecisions] = useState('')
  const [nextMeeting, setNextMeeting] = useState('')
  const [saving, setSaving] = useState(false)

  // 다음날 확인 필요 체크리스트 (직원별)
  const [nextDayChecks, setNextDayChecks] = useState<Record<string, NextDayCheck[]>>({})

  // ── 데이터 로드 ─────────────────────────────────────────
  async function loadMinutes() {
    setLoadingMinutes(true)
    const res = await fetch('/api/minutes')
    const data = await res.json()
    setMinutes(data.minutes || [])
    setLoadingMinutes(false)
  }

  async function loadDayReports(date: string) {
    setLoadingReports(true)
    const res = await fetch(`/api/reports?date=${date}`)
    const data = await res.json()
    setDayReports(data.reports || [])
    setLoadingReports(false)
  }

  useEffect(() => { loadMinutes() }, [])
  useEffect(() => { loadDayReports(prepDate) }, [prepDate])

  // ── 파생값 ──────────────────────────────────────────────
  const today = todayStr()

  // 모든 회의록에서 아직 유효한 팔로업 수집
  const activeFollowups = minutes
    .flatMap(m => (m.summary?.staff_sections || [])
      .flatMap((s: StaffSection) => (s.followups || []).map(f => ({ ...f, user_name: s.user_name })))
    )
    .filter((f: any) => f.until_date && f.until_date >= today && f.company)
    .sort((a: any, b: any) => a.until_date.localeCompare(b.until_date))

  const userNames = [...new Set(dayReports.map(r => r.user_name))]
  const morningMap: Record<string, Report> = {}
  const dailyMap: Record<string, Report> = {}
  dayReports.forEach(r => {
    if (r.report_type === 'morning') morningMap[r.user_name] = r
    else dailyMap[r.user_name] = r
  })

  // ── 폼 초기화 (보고서에서 직원 목록 자동 채우기) ────────
  function initFormFromReports() {
    setMeetingDate(today)
    setStaffSections(userNames.map(name => ({
      user_name: name, press_notes: '', instructions: '', followups: [],
    })))
    setGeneralDecisions('')
    setNextMeeting('')
    setSubTab('write')
  }

  function addStaffSection() {
    const name = prompt('직원 이름을 입력하세요')
    if (!name?.trim()) return
    setStaffSections(p => [...p, { user_name: name.trim(), press_notes: '', instructions: '', followups: [] }])
  }

  // ── 저장 ────────────────────────────────────────────────
  async function save() {
    setSaving(true)
    await fetch('/api/minutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_date: meetingDate,
        mode: 'structured',
        summary: {
          mode: 'structured',
          title: `${meetingDate} 일일 회의록`,
          staff_sections: staffSections,
          general_decisions: generalDecisions,
          next_meeting: nextMeeting,
        },
      }),
    })
    setSaving(false)
    await loadMinutes()
    setSubTab('history')
  }

  // ── 출력 ────────────────────────────────────────────────
  function handlePrint() {
    const win = window.open('', '_blank', 'width=900,height=900')
    if (!win) return

    // 각 직원의 데이터 정리
    const staffBlocks = userNames.map(name => {
      const mr = morningMap[name]
      const dr = dailyMap[name]
      const tc = Number(mr?.data?.total_calls || 0)
      const cn = Number(mr?.data?.connected || 0)
      const db = Number(mr?.data?.db_secured || 0)
      const oc = Number(mr?.data?.outbound_contracts || 0)

      const pressPoints: string[] = []
      if (mr) {
        if (tc === 0) pressPoints.push('콜 0건 — 활동 없음, 원인 확인')
        else {
          if (cn / (tc || 1) < 0.3) pressPoints.push(`연결율 ${pct(cn, tc)} — 30% 미달`)
          if (oc === 0 && cn > 0) pressPoints.push('아웃계약 0건 — 클로징 전략 점검')
          if (db === 0 && cn > 0) pressPoints.push('DB확보 0건 — 상담전환 안됨')
        }
        if (pressPoints.length === 0) pressPoints.push('✓ 전체 양호')
      }

      const decidedSupply = (dr?.data?.supply_db || []).filter((i: any) => i.is_decided)
      const decidedOut = (dr?.data?.outbound || []).filter((i: any) => i.is_decided)
      const meetings = dr?.data?.meetings || []
      const payment = dr?.data?.payment_waiting || []
      const worried = dr?.data?.worried || []

      const checks = nextDayChecks[name] || []
      const hasChecks = checks.some(c => c.company.trim())

      return `
      <div class="staff-block">
        <div class="staff-header">
          <span class="staff-name">${name}</span>
          <span class="staff-date">${prepDate}</span>
        </div>
        <div class="two-col">
          <!-- 오전보고 -->
          <div>
            <div class="section-title amber">☀️ 오전보고</div>
            ${mr ? `
            <div class="stat-grid">
              <div class="stat"><div class="sv">${tc}</div><div class="sl">총 콜</div></div>
              <div class="stat"><div class="sv c-amber">${cn}</div><div class="sl">연결됨</div><div class="sr">${pct(cn, tc)}</div></div>
              <div class="stat"><div class="sv c-blue">${db}</div><div class="sl">DB확보</div><div class="sr">${pct(db, tc)}</div></div>
              <div class="stat"><div class="sv c-green">${oc}</div><div class="sl">아웃계약</div><div class="sr">${pct(oc, tc)}</div></div>
            </div>
            <div class="press-box">
              <div class="press-title">📌 프레스 체크</div>
              ${pressPoints.map(p => `<div class="press-item ${p.startsWith('✓') ? 'good' : 'bad'}">${p}</div>`).join('')}
            </div>` : `<div class="empty-box">오전보고 미제출</div>`}
          </div>
          <!-- 마감보고 -->
          <div>
            <div class="section-title blue">📋 마감보고</div>
            ${dr ? `
            <div class="stat-grid">
              <div class="stat"><div class="sv c-blue">${dr.data?.today_contracts || 0}</div><div class="sl">당일계약</div></div>
              <div class="stat"><div class="sv c-blue">${dr.data?.month_contracts || 0}</div><div class="sl">월누적</div></div>
              <div class="stat"><div class="sv">${dr.data?.goal || 0}</div><div class="sl">월목표</div></div>
            </div>
            ${decidedSupply.length > 0 ? `<div class="sub-section"><b>✅ 결정(공급):</b> ${decidedSupply.map((i: any) => `<span class="chip chip-green">${i.company}</span>`).join('')}</div>` : ''}
            ${decidedOut.length > 0 ? `<div class="sub-section"><b>✅ 결정(아웃):</b> ${decidedOut.map((i: any) => `<span class="chip chip-violet">${i.company}</span>`).join('')}</div>` : ''}
            ${meetings.length > 0 ? `<div class="sub-section"><b>📅 미팅:</b> ${meetings.map((m: any) => `${m.company} ${m.date} ${m.time}`).join(' / ')}</div>` : ''}
            ${payment.length > 0 ? `<div class="sub-section"><b>💰 입금대기:</b> ${payment.map((p: any) => `<span class="chip chip-amber">${p.company}</span>`).join('')}</div>` : ''}
            ${worried.length > 0 ? (() => {
              const probOrder: Record<string,number> = {'상':0,'중':1,'하':2}
              const sw = [...worried].sort((a:any,b:any) => (probOrder[a.probability]??3)-(probOrder[b.probability]??3))
              return `<div class="sub-section">
                <b>⚠️ 검토필요 (${worried.length}건):</b>
                <div class="worried-list">
                  ${sw.map((w:any, i:number) => `
                    <div class="worried-item">
                      <span class="w-num">${i+1}</span>
                      <span class="w-company">${w.company}</span>
                      <span class="badge badge-${w.probability==='상'?'red':w.probability==='중'?'amber':'gray'}">${w.probability}</span>
                      ${w.content ? `<span class="w-content"> — ${w.content}</span>` : ''}
                      ${w.reason ? `<span class="w-reason"> (${w.reason})</span>` : ''}
                    </div>`).join('')}
                </div>
              </div>`
            })() : ''}
            ` : `<div class="empty-box">마감보고 미제출</div>`}
          </div>
        </div>
        <!-- 다음날 확인 필요 -->
        ${hasChecks ? `
        <div class="next-day-box">
          <div class="next-day-title">🔔 다음날 확인 필요</div>
          ${checks.filter(c => c.company.trim()).map(c => `
            <div class="next-day-item">
              <span class="check-box">${c.done ? '☑' : '☐'}</span>
              <span class="check-company">${c.company}</span>
              ${c.note ? `<span class="check-note"> — ${c.note}</span>` : ''}
            </div>
          `).join('')}
        </div>` : ''}
        <!-- 지시사항 메모 라인 -->
        <div class="memo-area">
          <div class="memo-title">✏️ 회의 중 지시사항 / 다음 스텝</div>
          <div class="line"></div>
          <div class="line"></div>
          <div class="line"></div>
        </div>
      </div>`
    }).join('')

    // 팔로업 섹션
    const followupHtml = activeFollowups.length > 0 ? `
    <div class="followup-block">
      <div class="followup-title">📌 진행중인 팔로업 업체 (${activeFollowups.length}건)</div>
      <table class="followup-table">
        <tr><th>업체명</th><th>담당</th><th>내용</th><th>마감일</th></tr>
        ${activeFollowups.map((f: any) => `
          <tr>
            <td><b>${f.company}</b></td>
            <td>${f.user_name}</td>
            <td>${f.note || '-'}</td>
            <td class="${f.until_date === today ? 'urgent' : ''}">${f.until_date}${f.until_date === today ? ' ⚠️' : ''}</td>
          </tr>
        `).join('')}
      </table>
    </div>` : ''

    win.document.write(`<!DOCTYPE html><html lang="ko"><head>
      <meta charset="utf-8"/>
      <title>HUNDRED 회의자료 ${prepDate}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Apple SD Gothic Neo','Malgun Gothic','맑은 고딕',sans-serif; font-size: 11px; color: #111; background: #fff; padding: 16px 20px; }
        h1 { font-size: 17px; font-weight: 900; color: #1B2A45; }
        .doc-header { border-bottom: 3px solid #1B2A45; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
        .doc-meta { font-size: 10px; color: #666; }
        /* 팔로업 */
        .followup-block { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; }
        .followup-title { font-size: 11px; font-weight: 900; color: #c2410c; margin-bottom: 6px; }
        .followup-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .followup-table th { background: #fed7aa; padding: 3px 6px; text-align: left; }
        .followup-table td { padding: 3px 6px; border-bottom: 1px solid #fed7aa; }
        .urgent { color: #dc2626; font-weight: bold; }
        /* 직원 2단 그리드 */
        .staff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
        /* 직원 블록 */
        .staff-block { border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; break-inside: avoid; }
        .staff-header { background: #1B2A45; color: white; padding: 7px 12px; display: flex; justify-content: space-between; align-items: center; }
        .staff-name { font-size: 13px; font-weight: 900; }
        .staff-date { font-size: 10px; opacity: 0.6; }
        /* 2단 배치 시: 오전/마감 세로로 */
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1px solid #e5e7eb; }
        .two-col > div { padding: 8px 10px; }
        .two-col > div:first-child { border-right: 1px solid #e5e7eb; }
        .staff-grid .two-col { grid-template-columns: 1fr; }
        .staff-grid .two-col > div:first-child { border-right: none; border-bottom: 1px solid #e5e7eb; }
        .section-title { font-size: 10px; font-weight: 900; margin-bottom: 6px; }
        .section-title.amber { color: #d97706; }
        .section-title.blue { color: #2563eb; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 6px; }
        .stat { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px 3px; text-align: center; }
        .sv { font-size: 15px; font-weight: 900; line-height: 1; }
        .sl { font-size: 8px; color: #9ca3af; margin-top: 1px; }
        .sr { font-size: 9px; color: #d97706; font-weight: 700; }
        .c-amber { color: #d97706; }
        .c-blue { color: #2563eb; }
        .c-green { color: #16a34a; }
        .press-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 6px 8px; }
        .press-title { font-size: 9px; font-weight: 900; color: #dc2626; margin-bottom: 3px; }
        .press-item { font-size: 10px; padding: 1px 0; }
        .press-item.bad { color: #dc2626; }
        .press-item.good { color: #16a34a; }
        .sub-section { font-size: 10px; margin-top: 4px; line-height: 1.5; }
        .chip { display: inline-block; padding: 1px 6px; border-radius: 99px; font-size: 9px; margin: 1px; }
        .chip-green { background: #dcfce7; color: #16a34a; }
        .chip-violet { background: #ede9fe; color: #7c3aed; }
        .chip-amber { background: #fef3c7; color: #b45309; }
        /* 검토필요 상세 */
        .worried-list { margin-top: 3px; }
        .worried-item { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px; padding: 2px 0; border-bottom: 1px dotted #e5e7eb; font-size: 10px; line-height: 1.4; }
        .w-num { color: #9ca3af; font-weight: 900; min-width: 14px; font-size: 9px; }
        .w-company { font-weight: 700; color: #111827; }
        .w-content { color: #374151; }
        .w-reason { color: #6b7280; font-size: 9px; }
        .badge { font-size: 8px; font-weight: 700; padding: 1px 4px; border-radius: 99px; }
        .badge-red   { background: #fee2e2; color: #b91c1c; }
        .badge-amber { background: #fef3c7; color: #b45309; }
        .badge-gray  { background: #f3f4f6; color: #6b7280; }
        .empty-box { background: #f3f4f6; border-radius: 4px; padding: 8px; text-align: center; font-size: 10px; color: #9ca3af; }
        /* 다음날 확인 필요 */
        .next-day-box { background: #eff6ff; border-top: 1px dashed #bfdbfe; padding: 8px 12px; }
        .next-day-title { font-size: 10px; font-weight: 900; color: #1d4ed8; margin-bottom: 5px; }
        .next-day-item { display: flex; align-items: center; gap: 6px; font-size: 10px; margin-bottom: 3px; }
        .check-box { font-size: 12px; flex-shrink: 0; }
        .check-company { font-weight: 700; }
        .check-note { color: #6b7280; }
        /* 메모 영역 */
        .memo-area { padding: 8px 12px; background: #f9fafb; }
        .memo-title { font-size: 9px; font-weight: 700; color: #9ca3af; margin-bottom: 5px; }
        .line { border-bottom: 1px dashed #d1d5db; height: 18px; margin-bottom: 2px; }
        /* 전체 메모 */
        .total-memo { border: 1px solid #d1d5db; border-radius: 6px; padding: 10px 12px; margin-top: 12px; }
        .total-memo-title { font-size: 11px; font-weight: 900; color: #374151; margin-bottom: 8px; }
        @media print {
          @page { margin: 10mm; size: A4; }
          body { padding: 0; }
          .staff-block { page-break-inside: avoid; }
        }
      </style>
    </head><body>
      <div class="doc-header">
        <h1>HUNDRED 일일 회의자료</h1>
        <div class="doc-meta">
          <div>📅 보고기준: <b>${prepDate}</b></div>
          <div>🖨️ 출력: ${today}</div>
        </div>
      </div>
      ${followupHtml}
      <div class="staff-grid">
        ${staffBlocks}
      </div>
      <div class="total-memo">
        <div class="total-memo-title">📝 전체 결정사항 / 오늘 회의 메모</div>
        ${[1,2,3,4].map(() => '<div class="line"></div>').join('')}
      </div>
    </body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 600)
  }

  // ──────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-8">
      {/* Sub-tab */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'prep',    label: '📋 회의자료 준비' },
          { key: 'write',   label: '✏️ 회의록 작성' },
          { key: 'history', label: '📚 회의록 보기' },
        ].map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              subTab === t.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════ 회의자료 준비 ══════════════ */}
      {subTab === 'prep' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 font-medium">보고 기준 날짜</label>
              <input type="date" value={prepDate} onChange={e => setPrepDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div className="flex gap-2">
              <button onClick={initFormFromReports}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                ✏️ 이 자료로 회의록 작성
              </button>
              <button onClick={handlePrint}
                className="bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                🖨️ 출력하기
              </button>
            </div>
          </div>

          {/* ─── 화면 미리보기 ─── */}
          <div>

            {/* 팔로업 */}
            {activeFollowups.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-2">
                <h3 className="text-sm font-bold text-orange-700 mb-3">📌 진행중인 팔로업 업체 ({activeFollowups.length}건)</h3>
                <div className="space-y-2">
                  {activeFollowups.map((f: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 bg-white rounded-lg px-3 py-2 border border-orange-100">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-gray-900">{f.company}</span>
                        <span className="text-xs text-orange-600 ml-2 font-medium">{f.user_name}</span>
                        {f.note && <p className="text-xs text-gray-500 mt-0.5">{f.note}</p>}
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        f.until_date === today ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                      }`}>
                        ~{f.until_date}{f.until_date === today ? ' 오늘만료' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 직원별 보고 */}
            {loadingReports ? (
              <div className="text-center py-8 text-gray-400 text-sm">불러오는 중...</div>
            ) : userNames.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                {prepDate} 날짜에 제출된 보고가 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {userNames.map(name => {
                  const mr = morningMap[name]
                  const dr = dailyMap[name]
                  const tc = Number(mr?.data?.total_calls || 0)
                  const cn = Number(mr?.data?.connected || 0)
                  const db = Number(mr?.data?.db_secured || 0)
                  const oc = Number(mr?.data?.outbound_contracts || 0)
                  const nc = Number(mr?.data?.no_connect || 0)

                  // 프레스 포인트 자동 분석
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
                    <div key={name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* 직원 헤더 */}
                      <div className="bg-gray-900 px-5 py-3 flex items-center justify-between">
                        <h3 className="text-white font-bold text-base">{name}</h3>
                        <span className="text-white/50 text-xs">{prepDate}</span>
                      </div>

                      <div className="p-5 grid md:grid-cols-2 gap-5">
                        {/* ── 오전보고 ── */}
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

                        {/* ── 마감보고 ── */}
                        <div>
                          <p className="text-xs font-bold text-blue-600 mb-3">📋 마감보고</p>
                          {dr ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { label: '당일계약', value: dr.data?.today_contracts || 0 },
                                  { label: '월누적', value: dr.data?.month_contracts || 0 },
                                  { label: '월목표', value: dr.data?.goal || 0 },
                                ].map(s => (
                                  <div key={s.label} className="bg-blue-50 rounded-lg p-2 text-center">
                                    <p className="text-[9px] text-gray-400">{s.label}</p>
                                    <p className="text-lg font-black text-blue-700">{s.value}</p>
                                  </div>
                                ))}
                              </div>
                              {/* 결정업체 */}
                              {(dr.data?.supply_db || []).filter((i: any) => i.is_decided).length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-gray-500 mb-1">✅ 결정업체 (공급DB)</p>
                                  <div className="flex flex-wrap gap-1">
                                    {(dr.data.supply_db as any[]).filter(i => i.is_decided).map((i: any, idx: number) => (
                                      <span key={idx} className="text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{i.company}</span>
                                    ))}
                                  </div>
                                  {(dr.data.supply_db as any[]).filter(i => i.is_decided).map((i: any, idx: number) => i.content && (
                                    <p key={idx} className="text-[10px] text-gray-400 mt-0.5 ml-1">└ {i.company}: {i.content}</p>
                                  ))}
                                </div>
                              )}
                              {/* 아웃 결정 */}
                              {(dr.data?.outbound || []).filter((i: any) => i.is_decided).length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-gray-500 mb-1">✅ 결정업체 (아웃바운딩)</p>
                                  <div className="flex flex-wrap gap-1">
                                    {(dr.data.outbound as any[]).filter(i => i.is_decided).map((i: any, idx: number) => (
                                      <span key={idx} className="text-[11px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{i.company}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* 미팅 일정 */}
                              {(dr.data?.meetings || []).length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-gray-500 mb-1">📅 미팅 일정</p>
                                  <div className="space-y-0.5">
                                    {(dr.data.meetings as any[]).map((m: any, idx: number) => (
                                      <p key={idx} className="text-[11px] text-gray-600">{m.company} — {m.date} {m.time} {m.location && `(${m.location})`}</p>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* 입금대기 */}
                              {(dr.data?.payment_waiting || []).length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-gray-500 mb-1">💰 입금대기 업체</p>
                                  <div className="flex flex-wrap gap-1">
                                    {(dr.data.payment_waiting as any[]).map((p: any, idx: number) => (
                                      <span key={idx} className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{p.company}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* 걱정업체 */}
                              {(dr.data?.worried || []).length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-gray-500 mb-1">⚠️ 검토 필요 업체</p>
                                  <div className="space-y-0.5">
                                    {(dr.data.worried as any[]).map((w: any, idx: number) => (
                                      <p key={idx} className="text-[11px] text-gray-600">{w.company} <span className={`text-[9px] px-1 rounded ${
                                        w.probability === '상' ? 'bg-green-100 text-green-600'
                                        : w.probability === '중' ? 'bg-yellow-100 text-yellow-600'
                                        : 'bg-red-100 text-red-600'
                                      }`}>{w.probability}</span> {w.reason && `— ${w.reason}`}</p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-400 text-center">마감보고 미제출</div>
                          )}
                        </div>
                      </div>

                      {/* 다음날 확인 필요 체크리스트 */}
                      <div className="border-t border-blue-100 px-5 py-3 bg-blue-50/40">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-bold text-blue-600">🔔 다음날 확인 필요</p>
                          <button
                            onClick={() => setNextDayChecks(prev => ({
                              ...prev,
                              [name]: [...(prev[name] || []), { id: uid(), company: '', note: '', done: false }]
                            }))}
                            className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-0.5 rounded transition-colors">
                            + 추가
                          </button>
                        </div>
                        {(nextDayChecks[name] || []).length === 0 ? (
                          <p className="text-[10px] text-blue-300 text-center py-1">추가하면 출력물에 포함됩니다</p>
                        ) : (
                          <div className="space-y-1.5">
                            {(nextDayChecks[name] || []).map((chk, ci) => (
                              <div key={chk.id} className="flex items-center gap-2">
                                <input type="checkbox" checked={chk.done}
                                  onChange={e => setNextDayChecks(prev => ({
                                    ...prev,
                                    [name]: (prev[name] || []).map((c, i) => i === ci ? { ...c, done: e.target.checked } : c)
                                  }))}
                                  className="w-3.5 h-3.5 rounded shrink-0" />
                                <input type="text" value={chk.company}
                                  onChange={e => setNextDayChecks(prev => ({
                                    ...prev,
                                    [name]: (prev[name] || []).map((c, i) => i === ci ? { ...c, company: e.target.value } : c)
                                  }))}
                                  placeholder="업체명"
                                  className="border border-blue-200 rounded px-2 py-0.5 text-xs bg-white w-28 focus:outline-none" />
                                <input type="text" value={chk.note}
                                  onChange={e => setNextDayChecks(prev => ({
                                    ...prev,
                                    [name]: (prev[name] || []).map((c, i) => i === ci ? { ...c, note: e.target.value } : c)
                                  }))}
                                  placeholder="확인 내용"
                                  className="flex-1 border border-blue-200 rounded px-2 py-0.5 text-xs bg-white focus:outline-none" />
                                <button onClick={() => setNextDayChecks(prev => ({
                                  ...prev,
                                  [name]: (prev[name] || []).filter((_, i) => i !== ci)
                                }))}
                                  className="text-red-300 hover:text-red-500 text-xs">✕</button>
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
            <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
              <p className="text-xs font-bold text-gray-500 mb-3">📝 전체 결정사항 / 메모</p>
              <div className="space-y-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-5 border-b border-dashed border-gray-300" />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ 회의록 작성 ══════════════ */}
      {subTab === 'write' && (
        <div className="space-y-4">
          {/* 회의 기본정보 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">회의 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">회의 날짜</label>
                <input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">다음 회의 일정</label>
                <input type="text" value={nextMeeting} onChange={e => setNextMeeting(e.target.value)}
                  placeholder="예: 내일 오전 9시"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
              </div>
            </div>
          </div>

          {/* 직원 없을 때 안내 */}
          {staffSections.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center space-y-3">
              <p className="text-sm text-gray-400">
                직원 섹션이 없습니다.<br />
                <span className="text-gray-600 font-medium">"회의자료 준비" 탭</span>에서 <span className="text-gray-600 font-medium">"이 자료로 회의록 작성"</span> 버튼을 눌러 자동 채우거나<br />아래에서 직접 추가하세요.
              </p>
              <button onClick={addStaffSection}
                className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium">
                + 직원 직접 추가
              </button>
            </div>
          )}

          {/* 직원별 섹션 */}
          {staffSections.map((section, si) => (
            <div key={si} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-gray-900 px-5 py-3 flex items-center justify-between">
                <h3 className="text-white font-bold">{section.user_name}</h3>
                <button onClick={() => setStaffSections(p => p.filter((_, i) => i !== si))}
                  className="text-white/40 hover:text-white/80 text-xs transition-colors">
                  제거
                </button>
              </div>
              <div className="p-5 space-y-4">
                {/* 프레스 내용 */}
                <div>
                  <label className="text-xs font-bold text-red-500 mb-1.5 block">
                    📌 프레스 내용 (결제율 기반 지적 및 압박 사항)
                  </label>
                  <textarea
                    value={section.press_notes}
                    onChange={e => setStaffSections(p => p.map((s, i) => i === si ? { ...s, press_notes: e.target.value } : s))}
                    rows={3}
                    placeholder="예) 연결율 20% 미달 - 타겟 DB 재점검 지시&#10;아웃계약 3일 연속 0건 - 클로징 멘트 개선 필요"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
                  />
                </div>

                {/* 지시사항 */}
                <div>
                  <label className="text-xs font-bold text-blue-500 mb-1.5 block">
                    ✅ 지시사항 / 다음 목표
                  </label>
                  <textarea
                    value={section.instructions}
                    onChange={e => setStaffSections(p => p.map((s, i) => i === si ? { ...s, instructions: e.target.value } : s))}
                    rows={3}
                    placeholder="예) 이번 주 아웃계약 최소 5건&#10;ABC사 금주 내 계약서 작성 완료"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  />
                </div>

                {/* 팔로업 업체 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-orange-500">
                      📌 지속 팔로업 업체 (마감일까지 회의자료에 계속 표시)
                    </label>
                    <button
                      onClick={() => setStaffSections(p => p.map((s, i) => i === si ? {
                        ...s, followups: [...s.followups, { id: uid(), company: '', note: '', until_date: '' }]
                      } : s))}
                      className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded-lg transition-colors">
                      + 업체 추가
                    </button>
                  </div>
                  {section.followups.length === 0 && (
                    <p className="text-xs text-gray-400 bg-orange-50 rounded-lg p-3 text-center">
                      팔로업 업체 없음 — 추가하면 마감일까지 회의자료 상단에 표시됩니다
                    </p>
                  )}
                  {section.followups.map((f, fi) => (
                    <div key={f.id} className="bg-orange-50 rounded-xl p-3 border border-orange-100 mb-2 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 mb-0.5 block">업체명</label>
                          <input type="text" value={f.company}
                            onChange={e => setStaffSections(p => p.map((s, i) => i === si ? {
                              ...s, followups: s.followups.map((fu, j) => j === fi ? { ...fu, company: e.target.value } : fu)
                            } : s))}
                            placeholder="ABC사"
                            className="w-full border border-orange-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none bg-white" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 mb-0.5 block">팔로업 마감일</label>
                          <input type="date" value={f.until_date}
                            onChange={e => setStaffSections(p => p.map((s, i) => i === si ? {
                              ...s, followups: s.followups.map((fu, j) => j === fi ? { ...fu, until_date: e.target.value } : fu)
                            } : s))}
                            className="w-full border border-orange-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none bg-white" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input type="text" value={f.note}
                          onChange={e => setStaffSections(p => p.map((s, i) => i === si ? {
                            ...s, followups: s.followups.map((fu, j) => j === fi ? { ...fu, note: e.target.value } : fu)
                          } : s))}
                          placeholder="예) 대표 출장 중, 복귀 후 15일까지 계약 진행 예정"
                          className="flex-1 border border-orange-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none bg-white" />
                        <button onClick={() => setStaffSections(p => p.map((s, i) => i === si ? {
                          ...s, followups: s.followups.filter((_, j) => j !== fi)
                        } : s))}
                          className="text-red-400 hover:text-red-600 text-xs px-2 transition-colors">삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {staffSections.length > 0 && (
            <button onClick={addStaffSection}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
              + 직원 추가
            </button>
          )}

          {/* 전체 결정사항 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <label className="text-xs font-bold text-emerald-600 mb-2 block">✓ 전체 결정사항</label>
            <textarea value={generalDecisions} onChange={e => setGeneralDecisions(e.target.value)}
              rows={4}
              placeholder="오늘 회의에서 결정된 전체 사항들..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          </div>

          <button onClick={save} disabled={saving}
            className="w-full bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white py-3.5 rounded-xl text-sm font-bold transition-colors">
            {saving ? '저장 중...' : '💾 회의록 저장'}
          </button>
        </div>
      )}

      {/* ══════════════ 회의록 보기 ══════════════ */}
      {subTab === 'history' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 날짜 목록 */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-xs font-semibold text-gray-500">날짜별 목록</p>
              </div>
              {loadingMinutes ? (
                <div className="p-6 text-center text-gray-400 text-sm">불러오는 중...</div>
              ) : minutes.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">회의록이 없습니다.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {minutes.map(m => (
                    <button key={m.id} onClick={() => setSelectedMinute(m)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        selectedMinute?.id === m.id ? 'bg-gray-50 border-l-2 border-gray-900' : ''
                      }`}>
                      <p className="text-sm font-semibold text-gray-900">{m.meeting_date}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {m.summary?.title || '회의록'}
                        {m.summary?.mode === 'structured' && <span className="ml-1 text-blue-400">구조화</span>}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 상세 */}
          <div className="md:col-span-2">
            {selectedMinute ? (
              <MinuteDetail minute={selectedMinute} />
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 h-64 flex items-center justify-center text-gray-400 text-sm">
                왼쪽에서 날짜를 선택하세요
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 회의록 상세보기 ────────────────────────────────────────
function MinuteDetail({ minute }: { minute: MeetingMinute }) {
  const s = minute.summary
  const [showRaw, setShowRaw] = useState(false)

  if (s?.mode === 'structured') {
    return (
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">{s?.title || '회의록'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{minute.meeting_date} · {minute.created_by}</p>
          </div>
          {s?.next_meeting && (
            <span className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100">
              📅 다음: {s.next_meeting}
            </span>
          )}
        </div>
        <div className="p-5 space-y-5 overflow-y-auto max-h-[600px]">
          {/* 팔로업 */}
          {(s?.staff_sections || []).some((sec: StaffSection) => (sec.followups || []).length > 0) && (
            <div>
              <p className="text-xs font-bold text-orange-500 mb-2">📌 팔로업 업체</p>
              {(s?.staff_sections || []).map((sec: StaffSection, si: number) => (
                (sec.followups || []).map((f: StaffFollowup, fi: number) => (
                  <div key={`${si}-${fi}`} className="flex items-start gap-3 bg-orange-50 rounded-lg px-3 py-2 mb-1 border border-orange-100">
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-gray-900">{f.company}</span>
                      <span className="text-xs text-orange-600 ml-2">{sec.user_name}</span>
                      {f.note && <p className="text-xs text-gray-500 mt-0.5">{f.note}</p>}
                    </div>
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full shrink-0 font-semibold">~{f.until_date}</span>
                  </div>
                ))
              ))}
            </div>
          )}
          {/* 직원별 */}
          {(s?.staff_sections || []).map((sec: StaffSection, i: number) => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="bg-gray-900 px-4 py-2.5">
                <p className="text-white text-sm font-bold">{sec.user_name}</p>
              </div>
              <div className="p-4 space-y-3">
                {sec.press_notes && (
                  <div>
                    <p className="text-[10px] font-bold text-red-400 uppercase mb-1">프레스 내용</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-red-50 rounded-lg p-3">{sec.press_notes}</p>
                  </div>
                )}
                {sec.instructions && (
                  <div>
                    <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">지시사항</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-blue-50 rounded-lg p-3">{sec.instructions}</p>
                  </div>
                )}
                {(!sec.press_notes && !sec.instructions) && (
                  <p className="text-xs text-gray-400">내용 없음</p>
                )}
              </div>
            </div>
          ))}
          {/* 전체 결정사항 */}
          {s?.general_decisions && (
            <div>
              <p className="text-xs font-bold text-emerald-500 uppercase mb-2">✓ 전체 결정사항</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap bg-emerald-50 border border-emerald-100 rounded-xl p-4 leading-relaxed">{s.general_decisions}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // AI 처리 방식 (기존)
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">{s?.title || '회의록'}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{minute.meeting_date} · {minute.created_by}</p>
        </div>
        <button onClick={() => setShowRaw(!showRaw)}
          className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
          {showRaw ? '요약 보기' : '원문 보기'}
        </button>
      </div>
      <div className="p-5 overflow-y-auto max-h-[600px]">
        {showRaw ? (
          <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-xl p-4">{minute.raw_text}</pre>
        ) : (
          <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-xl p-4">{JSON.stringify(s, null, 2)}</pre>
        )}
      </div>
    </div>
  )
}
