// 인콜일지 공통 인쇄 유틸 — 영업팀/관리팀/대표 모두 동일 레이아웃

export interface PrintSection {
  title: string
  color: string
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

  // 모든 필드 표시 (빈 값 포함) — 빈 항목도 확인할 수 있도록
  const sectionsHtml = sections.map(sec => {
    if (!sec.fields.length) return ''
    const rows = sec.fields.map(f => {
      const val = (f.value || '').toString().trim()
      const display = val ? val.replace(/\n/g, '<br/>') : ''
      return `<div class="frow${val ? '' : ' empty'}">
        <span class="flabel">${f.label}</span>
        <span class="fval">${display || '<span class="dash">—</span>'}</span>
      </div>`
    }).join('')
    return `<div class="sec">
      <div class="sec-head" style="background:${sec.color}">${sec.title}</div>
      <div class="sec-body">${rows}</div>
    </div>`
  }).filter(Boolean).join('')

  const sortedTl = [...timeline].sort((a, b) => {
    const ta = a.time || a.created_at || ''
    const tb = b.time || b.created_at || ''
    return tb > ta ? 1 : -1
  })

  const tlHtml = sortedTl.length === 0
    ? '<div class="tl-empty">통화 메모 없음</div>'
    : sortedTl.map(e => {
      const raw = e.time || e.created_at || ''
      let dt = ''
      if (raw) {
        try {
          const d = new Date(raw)
          const mo  = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          const hh  = String(d.getHours()).padStart(2, '0')
          const mm  = String(d.getMinutes()).padStart(2, '0')
          dt = `${mo}/${day} ${hh}:${mm}`
        } catch {}
      }
      const author = e.author || e.user || ''
      return `<div class="tl">
        <div class="tl-meta"><span class="tl-date">${dt}</span><span class="tl-author">${author}</span></div>
        <div class="tl-body">${(e.content || '').replace(/\n/g, '<br/>')}</div>
      </div>`
    }).join('')

  const chips: string[] = []
  if (callResult)    chips.push(`<div class="chip-row"><span class="clabel">결정전</span><span class="chip chip-green">${callResult}</span></div>`)
  if (closingResult) chips.push(`<div class="chip-row"><span class="clabel">클로징</span><span class="chip chip-blue">${closingResult}</span></div>`)
  if (subcallDate)   chips.push(`<div class="chip-row"><span class="clabel">재통화</span><span class="chip chip-gray">${subcallDate}</span></div>`)

  const resultHtml = chips.length
    ? chips.join('')
    : '<span class="no-data">결과 미입력</span>'

  const extraHtml = [
    notes     ? `<div class="sec"><div class="sec-head" style="background:#4b5563">메모</div><div class="sec-body"><div class="frow"><span class="fval extra-text">${notes.replace(/\n/g, '<br/>')}</span></div></div></div>` : '',
    asRequest ? `<div class="sec"><div class="sec-head" style="background:#4b5563">A/S 요청</div><div class="sec-body"><div class="frow"><span class="fval extra-text">${asRequest.replace(/\n/g, '<br/>')}</span></div></div></div>` : '',
  ].filter(Boolean).join('')

  const printDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

  const html = `<!DOCTYPE html>
<html lang="ko"><head>
  <meta charset="utf-8">
  <title>${companyName} 인콜일지</title>
  <style>
    @page { margin: 8mm 10mm; size: A4 portrait; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', Arial, sans-serif;
      font-size: 10.5px;
      color: #111827;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── 헤더 ── */
    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 8px;
      margin-bottom: 10px;
      border-bottom: 2px solid #1B2A45;
    }
    .top-left { display: flex; flex-direction: column; gap: 3px; }
    .top-badge {
      display: inline-block;
      background: #1B2A45;
      color: #fff;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: .1em;
      padding: 2px 7px;
      border-radius: 20px;
      margin-bottom: 2px;
    }
    .top-name { font-size: 20px; font-weight: 900; color: #1B2A45; letter-spacing: -.3px; }
    .top-sub { font-size: 9.5px; color: #6b7280; margin-top: 1px; }
    .top-sub b { color: #374151; }
    .print-btn {
      padding: 6px 18px;
      background: #1B2A45;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .03em;
    }

    /* ── 2단 레이아웃 ── */
    .layout {
      display: grid;
      grid-template-columns: 1.65fr 1fr;
      gap: 10px;
      align-items: start;
    }

    /* ── 섹션 ── */
    .sec { border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; margin-bottom: 7px; }
    .sec-head {
      padding: 4px 9px;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: .09em;
      text-transform: uppercase;
    }
    .frow {
      display: grid;
      grid-template-columns: 58px 1fr;
      border-bottom: 1px solid #f3f4f6;
    }
    .frow:last-child { border-bottom: none; }
    .frow.empty .fval { opacity: .38; }
    .flabel {
      padding: 3.5px 7px;
      font-size: 8.5px;
      color: #9ca3af;
      background: #f9fafb;
      border-right: 1px solid #f3f4f6;
      display: flex;
      align-items: center;
      line-height: 1.3;
    }
    .fval {
      padding: 3.5px 7px;
      font-size: 10px;
      font-weight: 600;
      color: #1B2A45;
      word-break: break-all;
      line-height: 1.5;
    }
    .fval .dash { color: #d1d5db; font-weight: 400; }
    .extra-text { font-weight: 400; color: #374151; white-space: pre-wrap; }

    /* ── 우측 ── */
    .panel-title {
      font-size: 8.5px;
      font-weight: 800;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: .1em;
      padding-bottom: 4px;
      margin-bottom: 6px;
      border-bottom: 1.5px solid #e5e7eb;
    }
    .panel-block { margin-bottom: 12px; }

    /* 인콜 결과 */
    .chip-row { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
    .chip-row:last-child { margin-bottom: 0; }
    .clabel { font-size: 8.5px; color: #9ca3af; width: 36px; flex-shrink: 0; }
    .chip { font-size: 10px; font-weight: 700; padding: 2.5px 10px; border-radius: 20px; }
    .chip-green { background: #d1fae5; color: #065f46; }
    .chip-blue  { background: #dbeafe; color: #1e40af; }
    .chip-gray  { background: #f3f4f6; color: #374151; }
    .no-data { font-size: 9px; color: #d1d5db; }

    /* 타임라인 */
    .tl {
      display: grid;
      grid-template-columns: 54px 1fr;
      gap: 5px;
      padding: 5px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    .tl:last-child { border-bottom: none; }
    .tl-meta { display: flex; flex-direction: column; gap: 1px; padding-top: 1px; }
    .tl-date { font-size: 8px; color: #9ca3af; }
    .tl-author { font-size: 8.5px; font-weight: 700; color: #374151; }
    .tl-body { font-size: 9.5px; color: #111827; line-height: 1.55; word-break: break-all; white-space: pre-wrap; }
    .tl-empty { font-size: 9px; color: #d1d5db; text-align: center; padding: 10px 0; }

    @media print { .print-btn { display: none !important; } }
  </style>
</head>
<body>
  <div class="top">
    <div class="top-left">
      <span class="top-badge">인콜일지</span>
      <div class="top-name">${companyName}</div>
      <div class="top-sub">담당 <b>${salesName || '—'}</b> &nbsp;·&nbsp; ${printDate}</div>
    </div>
    <button class="print-btn" onclick="window.print()">🖨 인쇄</button>
  </div>

  <div class="layout">
    <div class="left-col">
      ${sectionsHtml}
      ${extraHtml}
    </div>
    <div class="right-col">
      <div class="panel-block">
        <div class="panel-title">인콜 결과</div>
        ${resultHtml}
      </div>
      <div class="panel-block">
        <div class="panel-title">통화 메모</div>
        ${tlHtml}
      </div>
    </div>
  </div>
</body></html>`

  const w = window.open('', '_blank', 'width=940,height=1080')
  if (w) { w.document.write(html); w.document.close() }
}

/** 고객 데이터 → 인콜일지 섹션 배열로 변환 */
export function buildCustomerSections(d: Record<string, any>, base: { name?: string; phone?: string; company?: string }): PrintSection[] {
  const v = (k: string, fallback?: string) => (d[k] || fallback || '') as string

  const assetHome =
    d.asset_home_type === 'owned'  ? `자가 · 시세 ${d.asset_home_value || '—'}` :
    d.asset_home_type === 'rented' ? `임차 · 보증금 ${d.asset_home_value || '—'}` :
    d.asset_home_type              ? d.asset_home_type : ''

  const assetBiz =
    d.asset_biz_type === 'owned'   ? `자가 · 시세 ${d.asset_biz_value || '—'}` :
    d.asset_biz_type === 'rented'  ? `임차 · 보증금 ${d.asset_biz_value || '—'}` :
    d.asset_biz_type               ? d.asset_biz_type : ''

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
        { label: '자택',     value: assetHome },
        { label: '사업장',   value: assetBiz },
        { label: '기타자산', value: v('asset_other') || v('assets') },
      ],
    },
  ]
}
