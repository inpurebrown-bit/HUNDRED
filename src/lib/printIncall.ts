// 인콜일지 공통 인쇄 유틸 — 영업팀/관리팀/대표 모두 동일 레이아웃

export interface PrintSection {
  title: string
  color: string   // hex 색상값
  fields: Array<{ label: string; value?: string | null }>
}

export interface PrintTimeline {
  time?: string
  created_at?: string
  author?: string
  user?: string
  content?: string
}

export interface PrintIncallData {
  companyName: string
  salesName: string
  sections: PrintSection[]
  callResult?: string
  closingResult?: string
  subcallDate?: string
  timeline?: PrintTimeline[]
  notes?: string
  asRequest?: string
}

export function printIncall(data: PrintIncallData) {
  const { companyName, salesName, sections, callResult, closingResult, subcallDate, timeline = [], notes, asRequest } = data

  const sectionsHtml = sections.map(sec => {
    const rows = sec.fields
      .filter(f => f.value !== undefined && f.value !== null && f.value !== '')
      .map(f => `
        <div class="frow">
          <span class="flabel">${f.label}</span>
          <span class="fval">${(f.value || '—').replace(/\n/g, '<br/>')}</span>
        </div>`)
      .join('')
    if (!rows) return ''
    return `
      <div class="sec">
        <div class="sec-head" style="background:${sec.color}">${sec.title}</div>
        <div class="sec-body">${rows}</div>
      </div>`
  }).join('')

  const sortedTl = [...timeline].sort((a, b) => {
    const ta = a.time || a.created_at || ''
    const tb = b.time || b.created_at || ''
    return tb > ta ? 1 : -1
  })

  const tlHtml = sortedTl.length === 0
    ? '<p style="color:#ccc;font-size:9.5px;text-align:center;padding:12px 0">통화 메모 없음</p>'
    : sortedTl.map(e => {
      const raw = e.time || e.created_at || ''
      let dt = ''
      if (raw) {
        try {
          dt = new Date(raw).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
        } catch {}
      }
      const author = e.author || e.user || ''
      return `<div class="tl">
        <div class="tl-meta">${dt}<br/><b>${author}</b></div>
        <div class="tl-body">${(e.content || '').replace(/\n/g, '<br/>')}</div>
      </div>`
    }).join('')

  const chips: string[] = []
  if (callResult)    chips.push(`<div class="chip-row"><span class="chip-label">결정전</span><span class="chip chip-green">${callResult}</span></div>`)
  if (closingResult) chips.push(`<div class="chip-row"><span class="chip-label">클로징</span><span class="chip chip-blue">${closingResult}</span></div>`)
  if (subcallDate)   chips.push(`<div class="chip-row"><span class="chip-label">재통화</span><span class="chip chip-gray">${subcallDate}</span></div>`)
  const resultHtml = chips.length
    ? `<div class="result-box">${chips.join('')}</div>`
    : '<p style="color:#ccc;font-size:9.5px;padding:4px 0">결과 없음</p>'

  const extraHtml = [
    notes    ? `<div class="sec"><div class="sec-head" style="background:#374151">메모</div><div class="sec-body"><div class="frow"><span class="fval" style="padding:6px">${notes.replace(/\n/g, '<br/>')}</span></div></div></div>` : '',
    asRequest ? `<div class="sec"><div class="sec-head" style="background:#374151">A/S 요청</div><div class="sec-body"><div class="frow"><span class="fval" style="padding:6px">${asRequest.replace(/\n/g, '<br/>')}</span></div></div></div>` : '',
  ].join('')

  const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>${companyName} 인콜일지</title>
  <style>
    @page { margin:10mm; size:A4 portrait; }
    *{ box-sizing:border-box; margin:0; padding:0; }
    body{ font-family:'Apple SD Gothic Neo','Noto Sans KR',Arial,sans-serif; font-size:11px; color:#1a1a1a; background:#fff; }

    .top{ display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:8px; border-bottom:2.5px solid #1B2A45; margin-bottom:10px; }
    .top-name{ font-size:18px; font-weight:900; color:#1B2A45; }
    .top-sub{ font-size:10px; color:#666; margin-top:3px; }
    .print-btn{ padding:5px 14px; background:#1B2A45; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:11px; }

    .layout{ display:grid; grid-template-columns:1fr 260px; gap:10px; align-items:start; }

    /* 섹션 */
    .sec{ border:1px solid #e5e7eb; border-radius:5px; overflow:hidden; margin-bottom:6px; }
    .sec-head{ padding:4px 8px; color:#fff; font-size:9.5px; font-weight:700; letter-spacing:.06em; }
    .sec-body{ }
    .frow{ display:grid; grid-template-columns:62px 1fr; border-bottom:1px solid #f3f4f6; }
    .frow:last-child{ border-bottom:none; }
    .flabel{ padding:3px 6px; font-size:9px; color:#9ca3af; background:#fafafa; border-right:1px solid #f3f4f6; line-height:1.4; }
    .fval{ padding:3px 6px; font-size:10.5px; font-weight:600; color:#1B2A45; word-break:break-all; line-height:1.5; }

    /* 우측 */
    .right-title{ font-size:9.5px; font-weight:700; color:#6b7280; text-transform:uppercase; letter-spacing:.06em; border-bottom:1px solid #e5e7eb; padding-bottom:3px; margin-bottom:6px; margin-top:10px; }
    .right-title:first-child{ margin-top:0; }

    .result-box{ background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; padding:8px; margin-bottom:4px; }
    .chip-row{ display:flex; align-items:center; gap:6px; margin-bottom:5px; }
    .chip-row:last-child{ margin-bottom:0; }
    .chip-label{ font-size:9.5px; color:#9ca3af; width:40px; flex-shrink:0; }
    .chip{ font-size:10.5px; font-weight:700; padding:2px 10px; border-radius:20px; }
    .chip-green{ background:#d1fae5; color:#065f46; }
    .chip-blue { background:#dbeafe; color:#1e40af; }
    .chip-gray { background:#f3f4f6; color:#374151; }

    .tl{ display:grid; grid-template-columns:64px 1fr; gap:4px; border-bottom:1px solid #f3f4f6; padding:4px 2px; }
    .tl:last-child{ border-bottom:none; }
    .tl-meta{ font-size:8.5px; color:#9ca3af; line-height:1.5; }
    .tl-meta b{ color:#374151; font-weight:700; }
    .tl-body{ font-size:10px; color:#1f2937; word-break:break-all; line-height:1.5; }

    @media print{ .print-btn{ display:none!important; } }
  </style>
</head>
<body>
  <div class="top">
    <div>
      <div class="top-name">${companyName}</div>
      <div class="top-sub">담당: ${salesName} &nbsp;|&nbsp; 인쇄: ${new Date().toLocaleDateString('ko-KR')}</div>
    </div>
    <button class="print-btn" onclick="window.print()">인쇄</button>
  </div>
  <div class="layout">
    <div>
      ${sectionsHtml}${extraHtml}
    </div>
    <div>
      <div class="right-title">인콜 결과</div>
      ${resultHtml}
      <div class="right-title">통화 메모</div>
      ${tlHtml}
    </div>
  </div>
</body></html>`

  const w = window.open('', '_blank', 'width=920,height=1060')
  if (w) { w.document.write(html); w.document.close() }
}

/** 고객 데이터 → 인콜일지 섹션 배열로 변환 (InCallTableView / CustomerCard 공용) */
export function buildCustomerSections(d: Record<string, any>, base: { name?: string; phone?: string; company?: string }): PrintSection[] {
  const v = (k: string, fallback?: string) => (d[k] || fallback || '') as string
  return [
    {
      title: '기업 기본정보', color: '#1B2A45',
      fields: [
        { label: '업체명',   value: v('company', base.company) },
        { label: '대표자',   value: base.name || v('representative') },
        { label: '연락처',   value: base.phone || v('phone') },
        { label: '지역',     value: v('region') },
        { label: '접수일',   value: v('reception_date') },
        { label: '업종',     value: v('business_type') },
        { label: '실제업무', value: v('real_work') },
        { label: '업력',     value: v('years_in_business') || v('biz_size') },
        { label: '직원수',   value: v('employee_count') },
        { label: '특허',     value: v('patent') },
        { label: '직가/공가',value: v('lead_type') },
      ],
    },
    {
      title: '대출 현황', color: '#d97706',
      fields: [
        { label: '기보대출',  value: v('loan_kibo') || v('loan_policy') },
        { label: '신보대출',  value: v('loan_shinbo') },
        { label: '재단대출',  value: v('loan_jaedan') },
        { label: '중진공',    value: v('loan_jinjong') },
        { label: '소진공',    value: v('loan_sojin') },
        { label: '신용/담보', value: v('loan_other') || v('loan_credit') },
        { label: '기대출합계',value: v('loan_total') },
      ],
    },
    {
      title: '신용 / 재무', color: '#6d28d9',
      fields: [
        { label: 'KCB점수',  value: v('credit_kcb') || v('credit_score') },
        { label: 'NICE점수', value: v('credit_nice') },
        { label: '세금체납', value: v('tax_status') || v('tax_delinquency') },
        { label: '26년매출', value: v('revenue_2026') },
        { label: '25년매출', value: v('revenue_2025') },
        { label: '24년매출', value: v('revenue_2024') },
        { label: '23년매출', value: v('revenue_2023') },
        { label: '필요자금', value: v('required_funds') },
        { label: '솔루션',   value: v('solution') },
      ],
    },
    {
      title: '자산여부', color: '#0f766e',
      fields: [
        {
          label: '자택',
          value: d.asset_home_type === 'owned'  ? `자가 · 시세 ${d.asset_home_value || '—'}`
               : d.asset_home_type === 'rented' ? `임차 · 보증금 ${d.asset_home_value || '—'}` : '',
        },
        {
          label: '사업장',
          value: d.asset_biz_type === 'owned'   ? `자가 · 시세 ${d.asset_biz_value || '—'}`
               : d.asset_biz_type === 'rented'  ? `임차 · 보증금 ${d.asset_biz_value || '—'}` : '',
        },
        { label: '기타자산', value: v('asset_other') || v('assets') },
      ],
    },
  ]
}
