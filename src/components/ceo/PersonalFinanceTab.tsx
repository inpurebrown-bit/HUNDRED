'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'

// ─── Types ────────────────────────────────────────────────

interface Loan {
  id: string
  amount: number
  rate: number
  institution: string
  bank: string
  repayment_type: string
  repayment_day: string
  p1_principal: number
  p1_interest: number
  p1_monthly: number
  p2_same: boolean
  p2_principal: number
  p2_interest: number
  p2_monthly: number
  memo: string
  goal: string
}

interface Subscription {
  id: string
  name: string
  cycle: string
  last_date: string
  next_date: string
  monthly_amount: number
  annual_amount: number
  memo: string
  payment_route: string
  corp_card: boolean
}

// ─── 기본 데이터 ──────────────────────────────────────────

const DEFAULT_LOANS: Loan[] = [
  {
    id: '1', amount: 20000000, rate: 2.90, institution: '재단', bank: '신한',
    repayment_type: '2년거치', repayment_day: '매월 20일',
    p1_principal: 0, p1_interest: 49000, p1_monthly: 49000,
    p2_same: false, p2_principal: 340000, p2_interest: 490000, p2_monthly: 390000,
    memo: '2,5,8,11월에 3개월주기 상환이나 머리아프니까 다달이 넣어놓기\n대출금의 70%만 내고 2033만 만기때 30퍼인 720만원 내기',
    goal: '28년 1월까지 5천 상환 목표 = 2년동안 5전 = 1년에 2,500 = 1달에 200',
  },
  {
    id: '2', amount: 30000000, rate: 4.56, institution: '신보', bank: '소진공(기업)',
    repayment_type: '2년거치', repayment_day: '매월 11일',
    p1_principal: 0, p1_interest: 114000, p1_monthly: 114000,
    p2_same: false, p2_principal: 500000, p2_interest: 114000, p2_monthly: 614000,
    memo: '', goal: '',
  },
  {
    id: '3', amount: 16000000, rate: 6.23, institution: '서민금융', bank: 'ibk저축',
    repayment_type: '매월상환', repayment_day: '매월 18일',
    p1_principal: 333333, p1_interest: 84831, p1_monthly: 420000,
    p2_same: true, p2_principal: 0, p2_interest: 0, p2_monthly: 0,
    memo: '재단결로 밀려왔으나 사업 확장위해 예비비로 일단 두기로 결정\n가능하면 4-5월중 밀 예정',
    goal: '',
  },
]

const DEFAULT_SUBS: Subscription[] = [
  { id:'s1',  name:'독서탈(개인)',    cycle:'1달', last_date:'2026-03-13', next_date:'2026-04-13', monthly_amount:990,   annual_amount:0,      memo:'왜싸지?',                payment_route:'본폰 요금',           corp_card:false },
  { id:'s2',  name:'독서탈(회사)',    cycle:'1달', last_date:'2026-03-16', next_date:'2026-04-16', monthly_amount:2900,  annual_amount:0,      memo:'30GB',                   payment_route:'',                    corp_card:true  },
  { id:'s3',  name:'컬러링',          cycle:'',    last_date:'',           next_date:'',           monthly_amount:990,   annual_amount:0,      memo:'휴대폰요금에 나오는도',   payment_route:'',                    corp_card:false },
  { id:'s4',  name:'미리캔버스',      cycle:'1년', last_date:'2025-11-28', next_date:'2026-11-28', monthly_amount:13400, annual_amount:160800, memo:'pro 요금제',             payment_route:'',                    corp_card:true  },
  { id:'s5',  name:'캡컷',            cycle:'1년', last_date:'2025-10-21', next_date:'2026-10-21', monthly_amount:14833, annual_amount:178000, memo:'pro 요금제',             payment_route:'',                    corp_card:true  },
  { id:'s6',  name:'GPT',             cycle:'1달', last_date:'2026-03-13', next_date:'2026-04-13', monthly_amount:29000, annual_amount:0,      memo:'Plus',                   payment_route:'',                    corp_card:false },
  { id:'s7',  name:'애들뮤직',        cycle:'1달', last_date:'2026-03-12', next_date:'2026-04-12', monthly_amount:14900, annual_amount:0,      memo:'유튜브프리미엄',          payment_route:'',                    corp_card:false },
  { id:'s8',  name:'루팡',            cycle:'1달', last_date:'2026-02-28', next_date:'2026-03-31', monthly_amount:7890,  annual_amount:0,      memo:'',                       payment_route:'',                    corp_card:false },
  { id:'s9',  name:'모두싸인',        cycle:'1년', last_date:'2025-09-30', next_date:'2026-09-29', monthly_amount:31900, annual_amount:382800, memo:'요금제 team 1년',        payment_route:'',                    corp_card:true  },
  { id:'s10', name:'넷플릭스',        cycle:'1달', last_date:'2026-02-27', next_date:'2026-03-27', monthly_amount:17000, annual_amount:0,      memo:'원태량 반반',             payment_route:'현대카드',            corp_card:false },
  { id:'s11', name:'웨이브',          cycle:'1달', last_date:'2026-03-14', next_date:'2026-04-14', monthly_amount:12500, annual_amount:0,      memo:'',                       payment_route:'',                    corp_card:false },
  { id:'s12', name:'대표번호',        cycle:'1달', last_date:'2026-04-20', next_date:'2026-05-20', monthly_amount:11000, annual_amount:0,      memo:'1688-1000 (세종네트워크)', payment_route:'기업카드(사업자체크)', corp_card:true  },
  { id:'s13', name:'업무폰 통신료',   cycle:'1달', last_date:'2026-02-28', next_date:'2026-03-31', monthly_amount:17000, annual_amount:0,      memo:'2월 1달요금',             payment_route:'현대카드',            corp_card:true  },
  { id:'s14', name:'아이클라우드',    cycle:'1달', last_date:'2026-03-01', next_date:'2026-04-01', monthly_amount:1100,  annual_amount:0,      memo:'50GB',                   payment_route:'',                    corp_card:false },
  { id:'s15', name:'클로드',          cycle:'1달', last_date:'2026-05-01', next_date:'2026-06-01', monthly_amount:30000, annual_amount:0,      memo:'',                       payment_route:'',                    corp_card:false },
  { id:'s16', name:'네이버클라우드',  cycle:'1년', last_date:'2025-10-18', next_date:'2026-10-18', monthly_amount:2750,  annual_amount:33000,  memo:'180GB',                  payment_route:'',                    corp_card:false },
]

// ─── 유틸 ─────────────────────────────────────────────────

function won(n: number) { return n > 0 ? n.toLocaleString('ko-KR') + '원' : '-' }
function fmtI(n: number) { return n > 0 ? n.toLocaleString('ko-KR') : '' }
function parseN(s: string) { return parseInt(s.replace(/[^0-9]/g, ''), 10) || 0 }

function dday(dateStr: string): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

function DdayBadge({ dateStr }: { dateStr: string }) {
  const d = dday(dateStr)
  if (d === null) return null
  if (d < 0) return <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-bold">완료</span>
  if (d === 0) return <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">D-Day</span>
  if (d <= 7)  return <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">D-{d}</span>
  if (d <= 30) return <span className="text-[9px] bg-orange-100 text-orange-500 px-1.5 py-0.5 rounded-full font-bold">D-{d}</span>
  return <span className="text-[9px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">D-{d}</span>
}

const defaultLoan = (): Loan => ({
  id: Date.now().toString(), amount: 0, rate: 0, institution: '', bank: '',
  repayment_type: '', repayment_day: '',
  p1_principal: 0, p1_interest: 0, p1_monthly: 0,
  p2_same: false, p2_principal: 0, p2_interest: 0, p2_monthly: 0,
  memo: '', goal: '',
})
const defaultSub = (): Subscription => ({
  id: Date.now().toString(), name: '', cycle: '1달', last_date: '', next_date: '',
  monthly_amount: 0, annual_amount: 0, memo: '', payment_route: '', corp_card: false,
})

// ─── 대출 편집 모달 ───────────────────────────────────────

function LoanModal({
  loan, phaseLabels, onSave, onClose,
}: {
  loan: Loan
  phaseLabels: [string, string]
  onSave: (l: Loan) => void
  onClose: () => void
}) {
  const [f, setF] = useState<Loan>({ ...loan })
  const set = (k: keyof Loan, v: any) => setF(p => ({ ...p, [k]: v }))

  const INP = 'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30'
  const INP_NUM = INP + ' text-right'

  return (
    <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-[#1B2A45] to-[#2d4a7a] px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">대출 편집</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white text-lg">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">원금</label>
              <input className={INP_NUM} type="text" inputMode="numeric"
                value={fmtI(f.amount)} onChange={e => set('amount', parseN(e.target.value))} placeholder="20,000,000" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">금리 (%)</label>
              <input className={INP} type="number" step="0.01"
                value={f.rate || ''} onChange={e => set('rate', parseFloat(e.target.value) || 0)} placeholder="2.90" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">기관</label>
              <input className={INP} type="text" value={f.institution} onChange={e => set('institution', e.target.value)} placeholder="재단" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">은행/플랫폼</label>
              <input className={INP} type="text" value={f.bank} onChange={e => set('bank', e.target.value)} placeholder="신한" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">상환방법</label>
              <input className={INP} type="text" value={f.repayment_type} onChange={e => set('repayment_type', e.target.value)} placeholder="2년거치" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-400 mb-1 block">상환일</label>
              <input className={INP} type="text" value={f.repayment_day} onChange={e => set('repayment_day', e.target.value)} placeholder="매월 20일" />
            </div>
          </div>

          {/* 거치기간 */}
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-[11px] font-bold text-blue-600 mb-2">{phaseLabels[0]}</p>
            <div className="grid grid-cols-3 gap-2">
              {[['p1_principal','원금'] as const,['p1_interest','이자'] as const,['p1_monthly','월상환금'] as const].map(([k,l]) => (
                <div key={k}>
                  <label className="text-[10px] text-blue-500 mb-1 block">{l}</label>
                  <input className={INP_NUM} type="text" inputMode="numeric"
                    value={fmtI(f[k])} onChange={e => set(k, parseN(e.target.value))} placeholder="0" />
                </div>
              ))}
            </div>
          </div>

          {/* 상환기간 */}
          <div className="bg-emerald-50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-emerald-600">{phaseLabels[1]}</p>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={f.p2_same} onChange={e => set('p2_same', e.target.checked)} className="accent-emerald-500 w-3 h-3" />
                <span className="text-[11px] text-emerald-600 font-medium">상동 (Phase 1과 동일)</span>
              </label>
            </div>
            {f.p2_same ? (
              <p className="text-xs text-emerald-500 text-center py-2">Phase 1 값과 동일하게 표시됩니다</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {[['p2_principal','원금'] as const,['p2_interest','이자'] as const,['p2_monthly','월상환금'] as const].map(([k,l]) => (
                  <div key={k}>
                    <label className="text-[10px] text-emerald-600 mb-1 block">{l}</label>
                    <input className={INP_NUM} type="text" inputMode="numeric"
                      value={fmtI(f[k])} onChange={e => set(k, parseN(e.target.value))} placeholder="0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 메모 + 목표 */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 mb-1 block">메모</label>
            <textarea className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1B2A45]/30 resize-none"
              rows={2} value={f.memo} onChange={e => set('memo', e.target.value)} placeholder="메모..." />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-gray-400 mb-1 block">목표</label>
            <input className={INP} type="text" value={f.goal} onChange={e => set('goal', e.target.value)} placeholder="상환 목표..." />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">취소</button>
          <button onClick={() => onSave(f)} className="px-5 py-2 bg-[#1B2A45] text-white rounded-xl text-sm font-semibold hover:bg-[#1B2A45]/90">저장</button>
        </div>
      </div>
    </div>
  )
}

// ─── 구독 행 컴포넌트 ─────────────────────────────────────

function SubRow({
  sub, onSave, onDelete,
}: {
  sub: Subscription
  onSave: (s: Subscription) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState(sub)
  const set = (k: keyof Subscription, v: any) => setF(p => ({ ...p, [k]: v }))
  const INP = 'w-full border border-gray-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300'

  function save() { onSave(f); setEditing(false) }
  function cancel() { setF(sub); setEditing(false) }

  const d = dday(sub.next_date)
  const isUrgent = d !== null && d >= 0 && d <= 7

  if (editing) {
    return (
      <tr className="bg-blue-50/50 border-b border-blue-100">
        <td className="px-3 py-2"><input className={INP} value={f.name} onChange={e => set('name', e.target.value)} /></td>
        <td className="px-2 py-2">
          <select className={INP + ' w-16'} value={f.cycle} onChange={e => set('cycle', e.target.value)}>
            <option value="1달">1달</option><option value="1년">1년</option><option value="">기타</option>
          </select>
        </td>
        <td className="px-2 py-2"><input className={INP + ' w-28'} type="date" value={f.next_date} onChange={e => set('next_date', e.target.value)} /></td>
        <td className="px-2 py-2 text-right">
          <input className={INP + ' w-24 text-right'} type="text" inputMode="numeric"
            value={fmtI(f.monthly_amount)} onChange={e => set('monthly_amount', parseN(e.target.value))} />
        </td>
        <td className="px-2 py-2">
          <input className={INP + ' w-28'} type="text" inputMode="numeric"
            value={fmtI(f.annual_amount)} onChange={e => set('annual_amount', parseN(e.target.value))} placeholder="0" />
        </td>
        <td className="px-2 py-2"><input className={INP} value={f.payment_route} onChange={e => set('payment_route', e.target.value)} placeholder="결제루트" /></td>
        <td className="px-2 py-2 text-center">
          <input type="checkbox" checked={f.corp_card} onChange={e => set('corp_card', e.target.checked)} className="accent-[#1B2A45] w-3.5 h-3.5" />
        </td>
        <td className="px-2 py-2"><input className={INP} value={f.memo} onChange={e => set('memo', e.target.value)} placeholder="비고" /></td>
        <td className="px-2 py-2 whitespace-nowrap">
          <button onClick={save} className="text-emerald-600 hover:text-emerald-800 text-xs font-bold mr-1">✓</button>
          <button onClick={cancel} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </td>
      </tr>
    )
  }

  return (
    <tr className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isUrgent ? 'bg-red-50/30' : ''}`}>
      <td className="px-3 py-2.5">
        <span className="text-sm font-semibold text-[#1B2A45]">{sub.name}</span>
      </td>
      <td className="px-2 py-2.5">
        {sub.cycle && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sub.cycle === '1년' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
            {sub.cycle}
          </span>
        )}
      </td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">{sub.next_date || '-'}</span>
          <DdayBadge dateStr={sub.next_date} />
        </div>
      </td>
      <td className="px-2 py-2.5 text-right">
        <span className={`text-sm font-bold ${isUrgent ? 'text-red-600' : 'text-gray-800'}`}>
          {sub.monthly_amount > 0 ? sub.monthly_amount.toLocaleString('ko-KR') : '-'}
        </span>
      </td>
      <td className="px-2 py-2.5 text-right">
        <span className="text-xs text-gray-500">{sub.annual_amount > 0 ? sub.annual_amount.toLocaleString('ko-KR') : '-'}</span>
      </td>
      <td className="px-2 py-2.5">
        {sub.payment_route && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{sub.payment_route}</span>}
      </td>
      <td className="px-2 py-2.5 text-center">
        {sub.corp_card && <span className="text-[10px] bg-[#1B2A45] text-white px-1.5 py-0.5 rounded-full font-bold">기업</span>}
      </td>
      <td className="px-2 py-2.5 max-w-[120px]">
        <span className="text-[11px] text-gray-400 line-clamp-1">{sub.memo}</span>
      </td>
      <td className="px-2 py-2.5 whitespace-nowrap">
        <button onClick={() => setEditing(true)} className="text-[10px] text-blue-500 hover:text-blue-700 mr-2">편집</button>
        <button onClick={onDelete} className="text-[10px] text-red-400 hover:text-red-600">삭제</button>
      </td>
    </tr>
  )
}

// ─── 스프레드시트 (전면 재작성) ──────────────────────────────

interface CellStyle {
  bg?: string
  color?: string
  bold?: boolean
  italic?: boolean
  align?: 'left' | 'center' | 'right'
  borderTop?: boolean
  borderRight?: boolean
  borderBottom?: boolean
  borderLeft?: boolean
}

interface SheetPage {
  id: string
  name: string
  title: string
  headers: string[]
  rows: string[][]
  styles: Record<string, CellStyle>
  colWidths: number[]
}

interface SheetData {
  pages: SheetPage[]
  activeId: string
}

const DCOL = 8
const DROW = 40
const DEF_W = 100
const RNW = 40
const RH = 26

const BG_PAL = [
  '#ffffff','#f8fafc','#fef9c3','#fef3c7','#fde68a',
  '#bbf7d0','#d1fae5','#bfdbfe','#dbeafe','#c7d2fe',
  '#fce7f3','#fbcfe8','#fed7d7','#fee2e2','#fef2f2',
  '#374151','#1e3a5f','#166534','#92400e','#991b1b',
]
const TX_PAL = [
  '#111827','#374151','#6b7280','#9ca3af',
  '#1d4ed8','#16a34a','#dc2626','#d97706',
  '#7c3aed','#ffffff',
]

function mkPage(id: string, name: string): SheetPage {
  return {
    id, name, title: '',
    headers: Array.from({ length: DCOL }, (_, i) => String.fromCharCode(65 + i)),
    rows: Array.from({ length: DROW }, () => Array(DCOL).fill('')),
    styles: {},
    colWidths: Array(DCOL).fill(DEF_W),
  }
}

function makeDefaultSheet(): SheetData {
  const p = mkPage('1', '시트1')
  return { pages: [p], activeId: '1' }
}

function normalizeSheet(raw: any): SheetData {
  if (!raw) return makeDefaultSheet()
  if (raw.pages?.length) return raw as SheetData
  // migrate old format { headers, rows }
  const cols = raw.headers?.length || DCOL
  const p: SheetPage = {
    id: '1', name: '시트1', title: '',
    headers: raw.headers || Array.from({ length: cols }, (_: unknown, i: number) => String.fromCharCode(65 + i)),
    rows: raw.rows || Array.from({ length: DROW }, () => Array(cols).fill('')),
    styles: {},
    colWidths: Array(cols).fill(DEF_W),
  }
  return { pages: [p], activeId: '1' }
}

// ─── 수식 평가기 ──────────────────────────────────────────

function colIdx(s: string): number {
  let n = 0
  for (const ch of s.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function rawNum(cell: string, rows: string[][], depth: number): number {
  if (!cell) return 0
  if (cell.startsWith('=')) {
    const v = compute(cell.slice(1), rows, depth + 1)
    return parseFloat(v.replace(/,/g, '')) || 0
  }
  return parseFloat(cell.replace(/,/g, '')) || 0
}

function resolveCells(expr: string, rows: string[][], depth: number): string {
  return expr.replace(/([A-Za-z]{1,3})(\d+)/g, (_, col, row) => {
    const ci = colIdx(col), ri = parseInt(row) - 1
    const raw = rows[ri]?.[ci] ?? '0'
    const n = rawNum(raw, rows, depth)
    return String(isNaN(n) ? 0 : n)
  })
}

function compute(formula: string, rows: string[][], depth = 0): string {
  if (depth > 8) return '#REF'
  try {
    let expr = formula.trim()

    // SUM(A1:B5)
    expr = expr.replace(/SUM\(([A-Za-z]+)(\d+):([A-Za-z]+)(\d+)\)/gi, (_, c1, r1, c2, r2) => {
      let s = 0
      const ci1 = colIdx(c1), ri1 = +r1 - 1, ci2 = colIdx(c2), ri2 = +r2 - 1
      for (let ri = Math.min(ri1, ri2); ri <= Math.max(ri1, ri2); ri++)
        for (let ci = Math.min(ci1, ci2); ci <= Math.max(ci1, ci2); ci++)
          s += rawNum(rows[ri]?.[ci] ?? '', rows, depth)
      return String(s)
    })

    // IF(cond, trueVal, falseVal)
    expr = expr.replace(/IF\(([^,]+),([^,]+),([^)]*)\)/gi, (_, cond, tv, fv) => {
      const resolvedCond = resolveCells(cond.trim(), rows, depth)
      let condResult: unknown = false
      try { condResult = Function('"use strict";return(' + resolvedCond + ')')() } catch {}
      const chosen = (condResult && condResult !== '0' && condResult !== 'FALSE') ? tv.trim() : fv.trim()
      if (chosen.startsWith('"') && chosen.endsWith('"')) return chosen.slice(1, -1)
      return compute(chosen.replace(/^=/, ''), rows, depth + 1)
    })

    // cell refs
    expr = resolveCells(expr, rows, depth)

    if (!/^[\d\s+\-*/%().,<>=!&|"'?:]+$/.test(expr)) return '#ERR'
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict";return(' + expr + ')')()
    if (result === null || result === undefined) return ''
    if (typeof result === 'boolean') return result ? 'TRUE' : 'FALSE'
    if (typeof result === 'string') return result
    if (typeof result !== 'number' || !isFinite(result)) return '#ERR'
    const r = Math.round(result * 1e10) / 1e10
    return Number.isInteger(r) ? r.toLocaleString('ko-KR') : r.toLocaleString('ko-KR', { maximumFractionDigits: 4 })
  } catch { return '#ERR' }
}

// ─── 툴바 버튼 ────────────────────────────────────────────

function TB({ active, onClick, title, children, cls = '' }: {
  active?: boolean; onClick: () => void; title?: string; children: React.ReactNode; cls?: string
}) {
  return (
    <button title={title} onClick={onClick}
      className={`h-6 min-w-[24px] px-1 rounded text-[11px] font-bold border transition-colors ${
        active ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
      } ${cls}`}>
      {children}
    </button>
  )
}

// ─── SpreadsheetTab ────────────────────────────────────────

function SpreadsheetTab({ data, onChange }: { data: SheetData; onChange: (d: SheetData) => void }) {
  const page = data.pages.find(p => p.id === data.activeId) ?? data.pages[0]
  const { headers, rows, styles, colWidths } = page

  // Selection
  const [sel, setSel] = useState<[number, number] | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editVal, setEditVal] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Drag
  const [dragSrc, setDragSrc] = useState<[number, number] | null>(null)
  const [dragOver, setDragOver] = useState<[number, number] | null>(null)

  // Column resize
  const [liveWidths, setLiveWidths] = useState<number[]>([])
  const resizeRef = useRef<{ idx: number; startX: number; startW: number } | null>(null)
  useEffect(() => { setLiveWidths(headers.map((_, i) => colWidths[i] ?? DEF_W)) }, [page.id])

  // Toolbar dropdowns
  const [showBg, setShowBg] = useState(false)
  const [showTx, setShowTx] = useState(false)
  const [showBdr, setShowBdr] = useState(false)

  // Tab rename
  const [renamingTab, setRenamingTab] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')

  const numCols = headers.length
  const numRows = rows.length

  // Computed display values (memoized for performance)
  const displayedRows = useMemo(() =>
    rows.map(row => row.map(cell =>
      cell.startsWith('=') ? compute(cell.slice(1), rows) : cell
    )),
  [rows])

  const selCell = sel ? rows[sel[0]]?.[sel[1]] ?? '' : ''
  const selStyle: CellStyle = sel ? (styles[`${sel[0]},${sel[1]}`] ?? {}) : {}

  // ── Page helpers ────────────────────────────────────────
  function updPage(patch: Partial<SheetPage>) {
    onChange({ ...data, pages: data.pages.map(p => p.id === page.id ? { ...p, ...patch } : p) })
  }
  function updCell(r: number, c: number, val: string) {
    const nr = rows.map((row, ri) => ri === r ? row.map((v, ci) => ci === c ? val : v) : row)
    updPage({ rows: nr })
  }
  function applyStyle(patch: Partial<CellStyle>) {
    if (!sel) return
    const key = `${sel[0]},${sel[1]}`
    updPage({ styles: { ...styles, [key]: { ...styles[key], ...patch } } })
  }
  function getW(ci: number) { return liveWidths[ci] ?? colWidths[ci] ?? DEF_W }

  // ── Column resize ────────────────────────────────────────
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!resizeRef.current) return
      const { idx, startX, startW } = resizeRef.current
      const newW = Math.max(40, startW + e.clientX - startX)
      setLiveWidths(prev => prev.map((w, i) => i === idx ? newW : w))
    }
    function onUp() {
      if (!resizeRef.current) return
      const widths = liveWidths.length ? liveWidths : headers.map((_, i) => colWidths[i] ?? DEF_W)
      updPage({ colWidths: widths })
      resizeRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
  }, [liveWidths])

  // ── Commit edit ─────────────────────────────────────────
  function commit(r: number, c: number, val: string, next?: [number, number]) {
    updCell(r, c, val)
    setEditMode(false)
    setEditVal('')
    if (next) { setSel(next); setTimeout(() => containerRef.current?.focus(), 0) }
    else { setTimeout(() => containerRef.current?.focus(), 0) }
  }

  // ── Container keydown (non-edit navigation) ──────────────
  function onContainerKey(e: React.KeyboardEvent) {
    if (editMode || !sel) return
    const [r, c] = sel
    if (e.key === 'ArrowUp')    { e.preventDefault(); if (r > 0)        setSel([r-1, c]) }
    else if (e.key === 'ArrowDown')  { e.preventDefault(); if (r < numRows-1) setSel([r+1, c]) }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); if (c > 0)        setSel([r, c-1]) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (c < numCols-1) setSel([r, c+1]) }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); updCell(r, c, '') }
    else if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditVal(rows[r][c]); setEditMode(true); setTimeout(() => editInputRef.current?.focus(), 0) }
    else if (e.key === 'Tab') { e.preventDefault(); if (c < numCols-1) setSel([r, c+1]); else if (r < numRows-1) setSel([r+1, 0]) }
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { setEditVal(e.key); setEditMode(true); setTimeout(() => editInputRef.current?.focus(), 0) }
  }

  // ── Cell click / select ─────────────────────────────────
  function onCellClick(r: number, c: number) {
    if (editMode && sel) { commit(sel[0], sel[1], editVal) }
    setSel([r, c])
    setEditMode(false)
    containerRef.current?.focus()
  }
  function onCellDbl(r: number, c: number) {
    setSel([r, c]); setEditVal(rows[r][c]); setEditMode(true)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  // ── Drag & drop ─────────────────────────────────────────
  function onDragStart(r: number, c: number, e: React.DragEvent) {
    setDragSrc([r, c]); e.dataTransfer.effectAllowed = 'move'
  }
  function onDrop(r: number, c: number, e: React.DragEvent) {
    e.preventDefault()
    if (!dragSrc || (dragSrc[0] === r && dragSrc[1] === c)) return
    const [sr, sc] = dragSrc
    const nr = rows.map((row, ri) => row.map((v, ci) => {
      if (ri === r && ci === c) return rows[sr][sc]
      if (ri === sr && ci === sc) return ''
      return v
    }))
    const ns = { ...styles }
    if (styles[`${sr},${sc}`]) ns[`${r},${c}`] = styles[`${sr},${sc}`]
    delete ns[`${sr},${sc}`]
    updPage({ rows: nr, styles: ns })
    setSel([r, c]); setDragSrc(null); setDragOver(null)
  }

  // close pickers on outside click
  useEffect(() => {
    if (!showBg && !showTx && !showBdr) return
    const h = () => { setShowBg(false); setShowTx(false); setShowBdr(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [showBg, showTx, showBdr])

  return (
    <div className="space-y-1.5 select-none">

      {/* 제목 */}
      <input
        value={page.title}
        onChange={e => updPage({ title: e.target.value })}
        placeholder="제목 없음"
        className="w-full text-lg font-bold text-gray-800 bg-transparent outline-none border-b-2 border-transparent hover:border-gray-200 focus:border-blue-400 px-1 py-0.5 transition-colors"
      />

      {/* 도구상자 (Toolbar) */}
      <div className="flex items-center gap-1 flex-wrap bg-[#f2f2f2] border border-gray-300 rounded-lg px-2 py-1.5" onMouseDown={e => e.preventDefault()}>
        {/* Bold / Italic */}
        <TB title="굵게" active={selStyle.bold} onClick={() => applyStyle({ bold: !selStyle.bold })} cls="font-black w-6">B</TB>
        <TB title="기울임" active={selStyle.italic} onClick={() => applyStyle({ italic: !selStyle.italic })} cls="italic w-6">I</TB>
        <div className="w-px h-5 bg-gray-300 mx-0.5" />

        {/* Align */}
        <TB title="왼쪽" active={!selStyle.align || selStyle.align === 'left'} onClick={() => applyStyle({ align: 'left' })} cls="text-[10px]">≡L</TB>
        <TB title="가운데" active={selStyle.align === 'center'} onClick={() => applyStyle({ align: 'center' })} cls="text-[10px]">≡C</TB>
        <TB title="오른쪽" active={selStyle.align === 'right'} onClick={() => applyStyle({ align: 'right' })} cls="text-[10px]">R≡</TB>
        <div className="w-px h-5 bg-gray-300 mx-0.5" />

        {/* BG color */}
        <div className="relative" onMouseDown={e => e.stopPropagation()}>
          <button title="배경색" onClick={() => { setShowBg(p => !p); setShowTx(false); setShowBdr(false) }}
            className="w-7 h-6 rounded border border-gray-300 flex flex-col items-center justify-center gap-0 hover:border-gray-400 overflow-hidden">
            <span className="text-[10px] font-bold text-gray-700 leading-none">A</span>
            <div className="w-full h-1.5 mt-0.5" style={{ backgroundColor: selStyle.bg || '#fef9c3' }} />
          </button>
          {showBg && (
            <div className="absolute top-7 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-2 grid grid-cols-5 gap-1" style={{ width: 148 }} onMouseDown={e => e.stopPropagation()}>
              {BG_PAL.map(col => (
                <button key={col} onClick={() => { applyStyle({ bg: col }); setShowBg(false) }}
                  title={col} className="w-6 h-6 rounded border border-gray-200 hover:scale-125 transition-transform"
                  style={{ backgroundColor: col }} />
              ))}
              <button onClick={() => { applyStyle({ bg: undefined }); setShowBg(false) }}
                className="w-6 h-6 rounded border border-gray-200 text-[9px] text-gray-400 hover:bg-gray-100">✕</button>
            </div>
          )}
        </div>

        {/* Text color */}
        <div className="relative" onMouseDown={e => e.stopPropagation()}>
          <button title="글자색" onClick={() => { setShowTx(p => !p); setShowBg(false); setShowBdr(false) }}
            className="w-7 h-6 rounded border border-gray-300 flex items-center justify-center hover:border-gray-400">
            <span className="text-xs font-bold" style={{ color: selStyle.color || '#dc2626' }}>A</span>
          </button>
          {showTx && (
            <div className="absolute top-7 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-2 grid grid-cols-5 gap-1" style={{ width: 148 }} onMouseDown={e => e.stopPropagation()}>
              {TX_PAL.map(col => (
                <button key={col} onClick={() => { applyStyle({ color: col }); setShowTx(false) }}
                  title={col} className="w-6 h-6 rounded border border-gray-200 hover:scale-125 transition-transform"
                  style={{ backgroundColor: col }} />
              ))}
            </div>
          )}
        </div>
        <div className="w-px h-5 bg-gray-300 mx-0.5" />

        {/* Borders */}
        <div className="relative" onMouseDown={e => e.stopPropagation()}>
          <button title="테두리" onClick={() => { setShowBdr(p => !p); setShowBg(false); setShowTx(false) }}
            className="w-7 h-6 rounded border border-gray-300 text-sm text-gray-600 hover:border-gray-400">⊞</button>
          {showBdr && (
            <div className="absolute top-7 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-1.5 w-36" onMouseDown={e => e.stopPropagation()}>
              {([
                ['없음',   { borderTop: false, borderBottom: false, borderLeft: false, borderRight: false }],
                ['전체',   { borderTop: true,  borderBottom: true,  borderLeft: true,  borderRight: true }],
                ['하단만', { borderTop: false, borderBottom: true,  borderLeft: false, borderRight: false }],
                ['상단만', { borderTop: true,  borderBottom: false, borderLeft: false, borderRight: false }],
                ['좌우만', { borderTop: false, borderBottom: false, borderLeft: true,  borderRight: true }],
              ] as [string, Partial<CellStyle>][]).map(([label, patch]) => (
                <button key={label} onClick={() => { applyStyle(patch); setShowBdr(false) }}
                  className="w-full text-left text-[11px] px-2 py-1 rounded hover:bg-blue-50 text-gray-600">{label}</button>
              ))}
            </div>
          )}
        </div>
        <div className="w-px h-5 bg-gray-300 mx-0.5" />

        {/* SUM / IF */}
        <button title="SUM(범위) 삽입" onClick={() => { if (!sel) return; setEditVal('=SUM(A1:A1)'); setEditMode(true); setTimeout(() => editInputRef.current?.focus(), 0) }}
          className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 h-6 rounded border border-emerald-200">Σ SUM</button>
        <button title="IF(조건,참,거짓) 삽입" onClick={() => { if (!sel) return; setEditVal('=IF(,0,0)'); setEditMode(true); setTimeout(() => editInputRef.current?.focus(), 0) }}
          className="text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 h-6 rounded border border-blue-200">IF</button>
        <div className="w-px h-5 bg-gray-300 mx-0.5" />

        {/* Add row/col */}
        <button onClick={() => updPage({ rows: [...rows, Array(numCols).fill('')] })}
          className="text-[11px] bg-white hover:bg-gray-100 text-gray-600 px-2 h-6 rounded border border-gray-200">+행</button>
        <button onClick={() => updPage({ headers: [...headers, String.fromCharCode(65 + numCols)], rows: rows.map(r => [...r, '']), colWidths: [...(colWidths), DEF_W] })}
          className="text-[11px] bg-white hover:bg-gray-100 text-gray-600 px-2 h-6 rounded border border-gray-200">+열</button>
        <button onClick={() => { if (numRows <= 1) return; updPage({ rows: rows.slice(0, -1) }) }}
          className="text-[11px] bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 px-2 h-6 rounded border border-gray-200">-행</button>
        <button onClick={() => { if (numCols <= 1) return; updPage({ headers: headers.slice(0, -1), rows: rows.map(r => r.slice(0, -1)), colWidths: colWidths.slice(0, -1) }) }}
          className="text-[11px] bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 px-2 h-6 rounded border border-gray-200">-열</button>
      </div>

      {/* 수식바 */}
      <div className="flex items-center gap-2 bg-white border border-gray-300 rounded px-2 py-1">
        <span className="text-[10px] font-bold text-gray-500 w-12 text-center shrink-0 bg-gray-100 rounded px-1 py-0.5">
          {sel ? `${headers[sel[1]] || String.fromCharCode(65 + sel[1])}${sel[0] + 1}` : ''}
        </span>
        <div className="w-px h-4 bg-gray-200 shrink-0" />
        <span className="text-xs text-gray-700 font-mono flex-1 min-w-0 truncate">
          {editMode && sel ? editVal : selCell || <span className="text-gray-300">셀 선택</span>}
        </span>
      </div>

      {/* 그리드 */}
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onContainerKey}
        className="border border-gray-300 rounded-lg overflow-hidden shadow-sm focus:outline-none bg-white"
      >
        <div className="overflow-auto" style={{ maxHeight: '55vh' }}>
          <table className="border-collapse" style={{ tableLayout: 'fixed', minWidth: RNW + headers.reduce((s, _, i) => s + getW(i), 0) }}>
            <colgroup>
              <col style={{ width: RNW, minWidth: RNW }} />
              {headers.map((_, ci) => <col key={ci} style={{ width: getW(ci), minWidth: getW(ci) }} />)}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr style={{ height: RH }}>
                <th className="bg-[#e8e8e8] border-b-2 border-r border-gray-300" />
                {headers.map((h, ci) => (
                  <th key={ci} className="bg-[#e8e8e8] border-b-2 border-r border-gray-300 relative text-center" style={{ width: getW(ci) }}>
                    <span className="text-[11px] font-semibold text-gray-600">{h}</span>
                    {/* col resize handle */}
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10"
                      onMouseDown={e => { e.preventDefault(); resizeRef.current = { idx: ci, startX: e.clientX, startW: getW(ci) } }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ height: RH }}>
                  <td className="bg-[#e8e8e8] border-b border-r border-gray-200 text-[10px] text-gray-500 text-center font-medium select-none">
                    {ri + 1}
                  </td>
                  {row.map((cell, ci) => {
                    const isSel = sel?.[0] === ri && sel?.[1] === ci
                    const isDO  = dragOver?.[0] === ri && dragOver?.[1] === ci
                    const cs    = styles[`${ri},${ci}`] ?? {}
                    const disp  = displayedRows[ri]?.[ci] ?? ''
                    const isErr = disp === '#ERR' || disp === '#REF'
                    const isFml = cell.startsWith('=')
                    const w     = getW(ci)
                    return (
                      <td
                        key={ci}
                        draggable={isSel && !editMode}
                        onDragStart={e => onDragStart(ri, ci, e)}
                        onDragOver={e => { e.preventDefault(); setDragOver([ri, ci]) }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={e => onDrop(ri, ci, e)}
                        onDragEnd={() => { setDragSrc(null); setDragOver(null) }}
                        onClick={() => onCellClick(ri, ci)}
                        onDoubleClick={() => onCellDbl(ri, ci)}
                        style={{
                          width: w,
                          height: RH,
                          backgroundColor: cs.bg || 'transparent',
                          borderTop:    cs.borderTop    ? '1px solid #666' : undefined,
                          borderBottom: cs.borderBottom ? '1px solid #666' : '1px solid #e5e7eb',
                          borderLeft:   cs.borderLeft   ? '1px solid #666' : undefined,
                          borderRight:  '1px solid #e5e7eb',
                          outline:      isSel ? '2px solid #2563eb' : isDO ? '2px dashed #93c5fd' : undefined,
                          outlineOffset: '-1px',
                        }}
                        className="p-0 relative"
                      >
                        {isSel && editMode ? (
                          <input
                            ref={editInputRef}
                            className="absolute inset-0 w-full h-full px-1.5 text-xs bg-white focus:outline-none font-mono z-10"
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { e.preventDefault(); commit(ri, ci, editVal, ri < numRows-1 ? [ri+1, ci] : undefined) }
                              else if (e.key === 'Tab') { e.preventDefault(); commit(ri, ci, editVal, ci < numCols-1 ? [ri, ci+1] : ri < numRows-1 ? [ri+1, 0] : undefined) }
                              else if (e.key === 'Escape') { setEditMode(false); setEditVal(''); setTimeout(() => containerRef.current?.focus(), 0) }
                              else if (e.key === 'ArrowUp' && !editVal.startsWith('=')) { e.preventDefault(); commit(ri, ci, editVal, ri > 0 ? [ri-1, ci] : undefined) }
                              else if (e.key === 'ArrowDown' && !editVal.startsWith('=')) { e.preventDefault(); commit(ri, ci, editVal, ri < numRows-1 ? [ri+1, ci] : undefined) }
                            }}
                            onBlur={() => { commit(ri, ci, editVal) }}
                          />
                        ) : (
                          <div className="px-1.5 overflow-hidden whitespace-nowrap"
                            style={{
                              fontSize: 12,
                              lineHeight: `${RH}px`,
                              color:      isErr ? '#ef4444' : cs.color || '#111827',
                              fontWeight: cs.bold ? 700 : 400,
                              fontStyle:  cs.italic ? 'italic' : 'normal',
                              textAlign:  cs.align || (isFml ? 'right' : 'left'),
                            }}>
                            {disp}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 하단 시트 탭 */}
      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-[#f2f2f2]">
        <div className="flex items-end flex-1 overflow-x-auto">
          {data.pages.map(p => (
            <div key={p.id} className={`relative flex items-center border-r border-gray-300 ${p.id === data.activeId ? 'bg-white border-t-2 border-t-blue-500 -mt-px' : 'hover:bg-gray-100'}`}>
              {renamingTab === p.id ? (
                <input autoFocus value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => { if (renameVal.trim()) onChange({ ...data, pages: data.pages.map(pg => pg.id === p.id ? { ...pg, name: renameVal.trim() } : pg) }); setRenamingTab(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') { if (renameVal.trim()) onChange({ ...data, pages: data.pages.map(pg => pg.id === p.id ? { ...pg, name: renameVal.trim() } : pg) }); setRenamingTab(null) } else if (e.key === 'Escape') setRenamingTab(null) }}
                  className="text-xs px-2 py-1.5 w-20 focus:outline-none bg-transparent"
                />
              ) : (
                <button onClick={() => onChange({ ...data, activeId: p.id })}
                  onDoubleClick={() => { setRenamingTab(p.id); setRenameVal(p.name) }}
                  className="text-xs px-4 py-1.5 font-medium whitespace-nowrap">
                  {p.name}
                </button>
              )}
              {data.pages.length > 1 && (
                <button onClick={() => { const ps = data.pages.filter(pg => pg.id !== p.id); onChange({ pages: ps, activeId: p.id === data.activeId ? ps[0].id : data.activeId }) }}
                  className="text-[10px] text-gray-300 hover:text-red-400 pr-1.5 -ml-1">×</button>
              )}
            </div>
          ))}
        </div>
        <button title="시트 추가" onClick={() => { const id = Date.now().toString(); onChange({ ...data, pages: [...data.pages, mkPage(id, `시트${data.pages.length + 1}`)], activeId: id }) }}
          className="px-3 py-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-200 text-sm font-bold shrink-0">+</button>
      </div>
      <p className="text-[10px] text-gray-400 text-right">클릭 선택 · 더블클릭/타이핑 편집 · 방향키 이동 · 드래그로 셀 이동 · 열 헤더 우측 끝 드래그로 폭 조절 · 탭 더블클릭 이름변경</p>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────

export default function PersonalFinanceTab() {
  const [activeTab, setActiveTab] = useState<'loans' | 'subs' | 'sheet'>('loans')
  const [loans, setLoans]         = useState<Loan[]>(DEFAULT_LOANS)
  const [subs, setSubs]           = useState<Subscription[]>(DEFAULT_SUBS)
  const [sheet, setSheet]         = useState<SheetData>(makeDefaultSheet())
  const [phaseLabels, setPhaseLabels] = useState<[string, string]>(['28년 1월까지', '28년 2월부터'])
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [msg, setMsg]             = useState('')
  const [editPhase, setEditPhase] = useState(false)
  const [quickAmtId, setQuickAmtId] = useState<string | null>(null)
  const [quickAmtVal, setQuickAmtVal] = useState('')

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loansRef  = useRef(loans)
  const subsRef   = useRef(subs)
  const sheetRef  = useRef(sheet)
  const labelsRef = useRef(phaseLabels)
  useEffect(() => { loansRef.current = loans }, [loans])
  useEffect(() => { subsRef.current = subs }, [subs])
  useEffect(() => { sheetRef.current = sheet }, [sheet])
  useEffect(() => { labelsRef.current = phaseLabels }, [phaseLabels])

  // 불러오기
  useEffect(() => {
    setLoading(true)
    fetch('/api/personal-finance')
      .then(r => r.json())
      .then(json => {
        if (json.record?.employees) {
          const d = json.record.employees
          if (d.loans?.length)  setLoans(d.loans)
          if (d.subs?.length)   setSubs(d.subs)
          if (d.phaseLabels)    setPhaseLabels(d.phaseLabels)
          if (d.sheet) setSheet(normalizeSheet(d.sheet))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const doSaveRaw = useCallback(async (data: object) => {
    setSaving(true)
    const res = await fetch('/api/personal-finance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })
    const json = await res.json()
    setMsg(json.record ? '자동저장 ✓' : '저장 실패')
    setSaving(false)
    setTimeout(() => setMsg(''), 2000)
  }, [])

  // 수동 저장
  async function save() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    await doSaveRaw({ loans, subs, phaseLabels, sheet })
    setMsg('저장 완료 ✓')
  }

  // 시트 변경시 자동저장 (1.5초 debounce)
  function handleSheetChange(next: SheetData) {
    setSheet(next)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      doSaveRaw({ loans: loansRef.current, subs: subsRef.current, phaseLabels: labelsRef.current, sheet: next })
    }, 1500)
  }

  // 대출 집계
  const totalDebt       = loans.reduce((s, l) => s + Number(l.amount), 0)
  const currentMonthly  = loans.reduce((s, l) => s + Number(l.p1_monthly), 0)
  const futureMonthly   = loans.reduce((s, l) => s + (l.p2_same ? l.p1_monthly : Number(l.p2_monthly)), 0)

  // 구독 집계
  const subMonthly = subs.reduce((s, sub) => s + Number(sub.monthly_amount), 0)
  const subAnnual  = subs.reduce((s, sub) => s + Number(sub.annual_amount), 0)
  const corpSubs   = subs.filter(s => s.corp_card)
  const corpMonthly = corpSubs.reduce((s, sub) => s + Number(sub.monthly_amount), 0)
  const urgentSubs = subs.filter(s => { const d = dday(s.next_date); return d !== null && d >= 0 && d <= 7 })

  return (
    <div className="space-y-5 pb-8">

      {/* 헤더 */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {([['loans','대출 현황'],['subs','정기구독'],['sheet','메모 시트']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setActiveTab(k)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === k ? 'bg-white text-[#1B2A45] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={save} disabled={saving}
          className="ml-auto bg-[#1B2A45] hover:bg-[#1B2A45]/90 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          {saving ? '저장 중...' : '저장'}
        </button>
        {loading && <span className="text-xs text-blue-400 animate-pulse">불러오는 중...</span>}
        {msg && <span className={`text-xs font-medium ${msg.includes('완료') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</span>}
      </div>

      {/* ════════════════ 대출 현황 ════════════════ */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-4 text-white">
              <p className="text-white/60 text-[11px] font-semibold mb-1">총 부채</p>
              <p className="text-2xl font-black tracking-tight">{(totalDebt / 10000).toFixed(0)}만원</p>
              <p className="text-white/50 text-xs mt-0.5">{totalDebt.toLocaleString('ko-KR')}원</p>
            </div>
            <div className="bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl p-4 text-white">
              <p className="text-white/70 text-[11px] font-semibold mb-1">{phaseLabels[0]} 월납부</p>
              <p className="text-2xl font-black tracking-tight">{(currentMonthly / 10000).toFixed(0)}만원</p>
              <p className="text-white/50 text-xs mt-0.5">{currentMonthly.toLocaleString('ko-KR')}원/월</p>
            </div>
            <div className="bg-gradient-to-br from-[#1B2A45] to-[#2d4a7a] rounded-2xl p-4 text-white">
              <p className="text-white/70 text-[11px] font-semibold mb-1">{phaseLabels[1]} 월납부</p>
              <p className="text-2xl font-black tracking-tight">{(futureMonthly / 10000).toFixed(0)}만원</p>
              <p className="text-white/50 text-xs mt-0.5">{futureMonthly.toLocaleString('ko-KR')}원/월</p>
            </div>
          </div>

          {/* 구간 라벨 편집 */}
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            <span>구간 구분:</span>
            {editPhase ? (
              <>
                <input value={phaseLabels[0]} onChange={e => setPhaseLabels([e.target.value, phaseLabels[1]])}
                  className="border border-gray-200 rounded px-2 py-0.5 text-xs w-28 focus:outline-none" />
                <span className="text-gray-300">→</span>
                <input value={phaseLabels[1]} onChange={e => setPhaseLabels([phaseLabels[0], e.target.value])}
                  className="border border-gray-200 rounded px-2 py-0.5 text-xs w-28 focus:outline-none" />
                <button onClick={() => setEditPhase(false)} className="text-emerald-500 font-bold">완료</button>
              </>
            ) : (
              <>
                <span className="bg-blue-50 text-blue-500 px-2 py-0.5 rounded font-medium">{phaseLabels[0]}</span>
                <span>→</span>
                <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-medium">{phaseLabels[1]}</span>
                <button onClick={() => setEditPhase(true)} className="text-gray-400 hover:text-gray-600">편집</button>
              </>
            )}
          </div>

          {/* 대출 카드 목록 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loans.map((loan, i) => {
              const c = calcOps(loan) // just for display
              return (
                <div key={loan.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  {/* 카드 헤더 */}
                  <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-4 py-3">
                    <div className="flex items-start justify-between">
                      <div>
                        {quickAmtId === loan.id ? (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              type="text" inputMode="numeric"
                              value={quickAmtVal}
                              onChange={e => setQuickAmtVal(e.target.value.replace(/[^0-9]/g, ''))}
                              onKeyDown={async e => {
                                if (e.key === 'Enter') {
                                  const amt = parseInt(quickAmtVal) * 10000
                                  if (amt > 0) {
                                    const next = loans.map(l => l.id === loan.id ? { ...l, amount: amt } : l)
                                    setLoans(next)
                                    await fetch('/api/personal-finance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { loans: next, subs, phaseLabels } }) })
                                  }
                                  setQuickAmtId(null)
                                }
                                if (e.key === 'Escape') setQuickAmtId(null)
                              }}
                              placeholder={String((loan.amount / 10000).toFixed(0))}
                              className="w-20 bg-white/20 text-white font-black text-lg rounded px-1 focus:outline-none focus:bg-white/30"
                            />
                            <span className="text-sm text-white/60">만원</span>
                            <button onClick={async () => {
                              const amt = parseInt(quickAmtVal) * 10000
                              if (amt > 0) {
                                const next = loans.map(l => l.id === loan.id ? { ...l, amount: amt } : l)
                                setLoans(next)
                                await fetch('/api/personal-finance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { loans: next, subs, phaseLabels } }) })
                              }
                              setQuickAmtId(null)
                            }} className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded hover:bg-white/30">✓</button>
                          </div>
                        ) : (
                          <button onClick={() => { setQuickAmtId(loan.id); setQuickAmtVal(String((loan.amount / 10000).toFixed(0))) }}
                            className="flex items-baseline gap-0.5 group">
                            <span className="text-white font-black text-lg leading-none group-hover:text-amber-200 transition-colors">{(loan.amount / 10000).toFixed(0)}</span>
                            <span className="text-sm font-normal text-white/60 ml-0.5">만원</span>
                            <span className="text-[9px] text-white/30 group-hover:text-white/60 ml-1 transition-colors">잔액수정</span>
                          </button>
                        )}
                        <p className="text-white/60 text-xs mt-0.5">{loan.bank} · {loan.institution}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-300 font-black text-lg">{loan.rate}%</span>
                        <p className="text-white/50 text-[10px] mt-0.5">{loan.repayment_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] bg-white/15 text-white/70 px-2 py-0.5 rounded-full">{loan.repayment_day}</span>
                    </div>
                  </div>

                  {/* 두 구간 비교 */}
                  <div className="grid grid-cols-2 divide-x divide-gray-100">
                    <div className="px-3 py-2.5 bg-blue-50/50">
                      <p className="text-[10px] font-bold text-blue-500 mb-1.5">{phaseLabels[0]}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs"><span className="text-gray-400">원금</span><span className="font-semibold text-gray-700">{loan.p1_principal > 0 ? loan.p1_principal.toLocaleString('ko-KR') : '-'}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-400">이자</span><span className="font-semibold text-gray-700">{won(loan.p1_interest)}</span></div>
                        <div className="flex justify-between text-xs border-t border-blue-100 pt-1"><span className="text-blue-600 font-bold">월납부</span><span className="font-black text-blue-600">{won(loan.p1_monthly)}</span></div>
                      </div>
                    </div>
                    <div className="px-3 py-2.5 bg-emerald-50/50">
                      <p className="text-[10px] font-bold text-emerald-600 mb-1.5">{phaseLabels[1]}</p>
                      {loan.p2_same ? (
                        <p className="text-xs text-emerald-500 font-semibold pt-3 text-center">상동</p>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs"><span className="text-gray-400">원금</span><span className="font-semibold text-gray-700">{won(loan.p2_principal)}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-gray-400">이자</span><span className="font-semibold text-gray-700">{won(loan.p2_interest)}</span></div>
                          <div className="flex justify-between text-xs border-t border-emerald-100 pt-1"><span className="text-emerald-600 font-bold">월납부</span><span className="font-black text-emerald-600">{won(loan.p2_monthly)}</span></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 메모 / 목표 */}
                  {(loan.memo || loan.goal) && (
                    <div className="px-3 py-2.5 border-t border-gray-100 space-y-1.5">
                      {loan.memo && (
                        <p className="text-[11px] text-gray-500 leading-relaxed whitespace-pre-line">{loan.memo}</p>
                      )}
                      {loan.goal && (
                        <div className="flex items-start gap-1.5">
                          <span className="text-amber-400 text-[10px] font-bold shrink-0 mt-0.5">목표</span>
                          <p className="text-[11px] text-amber-700 font-medium leading-relaxed">{loan.goal}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 편집/삭제 버튼 */}
                  <div className="px-3 pb-3 flex gap-2">
                    <button onClick={() => setEditingLoan(loan)}
                      className="flex-1 py-1.5 text-xs font-semibold text-[#1B2A45] border border-[#1B2A45]/20 rounded-lg hover:bg-[#1B2A45]/5 transition-colors">
                      편집
                    </button>
                    <button onClick={() => setLoans(prev => prev.filter((_, j) => j !== i))}
                      className="px-3 py-1.5 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                      삭제
                    </button>
                  </div>
                </div>
              )
            })}

            {/* 대출 추가 */}
            <button onClick={() => setEditingLoan(defaultLoan())}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-gray-300 hover:border-gray-300 hover:text-gray-400 transition-colors flex flex-col items-center justify-center gap-2 min-h-[200px]">
              <span className="text-3xl">+</span>
              <span className="text-sm font-semibold">대출 추가</span>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════ 정기구독 ════════════════ */}
      {activeTab === 'subs' && (
        <div className="space-y-4">
          {/* 요약 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-[#1B2A45] to-[#2d4a7a] rounded-2xl p-4 text-white">
              <p className="text-white/60 text-[11px] font-semibold mb-1">월 구독 합계</p>
              <p className="text-xl font-black">{subMonthly.toLocaleString('ko-KR')}<span className="text-sm font-normal text-white/60 ml-0.5">원</span></p>
            </div>
            <div className="bg-emerald-600 rounded-2xl p-4 text-white">
              <p className="text-white/70 text-[11px] font-semibold mb-1">연간 합산 결제</p>
              <p className="text-xl font-black">{(subMonthly * 12 / 10000).toFixed(0)}<span className="text-sm font-normal text-white/70 ml-0.5">만원↑</span></p>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <p className="text-gray-400 text-[11px] font-semibold mb-1">기업카드 결제</p>
              <p className="text-xl font-black text-[#1B2A45]">{corpMonthly.toLocaleString('ko-KR')}<span className="text-sm font-normal text-gray-400 ml-0.5">원/월</span></p>
            </div>
            <div className={`rounded-2xl p-4 ${urgentSubs.length > 0 ? 'bg-red-50 border border-red-100' : 'bg-white border border-gray-200'}`}>
              <p className={`text-[11px] font-semibold mb-1 ${urgentSubs.length > 0 ? 'text-red-400' : 'text-gray-400'}`}>7일 내 결제</p>
              <p className={`text-xl font-black ${urgentSubs.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>{urgentSubs.length}<span className="text-sm font-normal ml-0.5">건</span></p>
            </div>
          </div>

          {/* 추가 버튼 */}
          <div className="flex justify-end">
            <button onClick={() => setSubs(prev => [...prev, defaultSub()])}
              className="flex items-center gap-2 bg-[#1B2A45] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#1B2A45]/90 transition-colors">
              + 항목 추가
            </button>
          </div>

          {/* 구독 테이블 */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-400 whitespace-nowrap">서비스</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 whitespace-nowrap">주기</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 whitespace-nowrap">차후결제일</th>
                    <th className="px-2 py-3 text-right text-xs font-bold text-gray-400 whitespace-nowrap">월금액</th>
                    <th className="px-2 py-3 text-right text-xs font-bold text-gray-400 whitespace-nowrap">연간금액</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 whitespace-nowrap">결제루트</th>
                    <th className="px-2 py-3 text-center text-xs font-bold text-gray-400 whitespace-nowrap">기업</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-gray-400 whitespace-nowrap">비고</th>
                    <th className="px-2 py-3 whitespace-nowrap" />
                  </tr>
                </thead>
                <tbody>
                  {subs.map((sub, i) => (
                    <SubRow
                      key={sub.id}
                      sub={sub}
                      onSave={updated => setSubs(prev => prev.map((s, j) => j === i ? updated : s))}
                      onDelete={() => setSubs(prev => prev.filter((_, j) => j !== i))}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1B2A45]/5 border-t-2 border-[#1B2A45]/10">
                    <td className="px-3 py-3 text-xs font-bold text-[#1B2A45]">합계</td>
                    <td colSpan={2} />
                    <td className="px-2 py-3 text-right text-sm font-black text-[#1B2A45]">{subMonthly.toLocaleString('ko-KR')}원</td>
                    <td className="px-2 py-3 text-right text-xs font-bold text-gray-500">{subAnnual > 0 ? subAnnual.toLocaleString('ko-KR') : '-'}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ 메모 시트 ════════════════ */}
      {activeTab === 'sheet' && (
        <SpreadsheetTab data={sheet} onChange={handleSheetChange} />
      )}

      {/* 대출 편집 모달 */}
      {editingLoan && (
        <LoanModal
          loan={editingLoan}
          phaseLabels={phaseLabels}
          onSave={updated => {
            setLoans(prev => {
              const idx = prev.findIndex(l => l.id === updated.id)
              if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
              return [...prev, updated]
            })
            setEditingLoan(null)
          }}
          onClose={() => setEditingLoan(null)}
        />
      )}
    </div>
  )
}

// 대출 계산은 사용하지 않으므로 빈 함수 (실제 계산은 각 카드에서 직접 처리)
function calcOps(_: Loan) { return {} }
