'use client'

import { useEffect, useRef, useState } from 'react'
import HometaxPanel from './HometaxPanel'
import { DEFAULT_TAX_2026, computeTax, cellAmt, type TaxData, type TaxCell, type TaxQuarter } from '@/lib/taxCalc'

const won = (n: number) => Math.round(n || 0).toLocaleString('ko-KR')
const man = (n: number) => {
  const v = Math.abs(n || 0), s = n < 0 ? '-' : ''
  return v >= 100000000 ? s + parseFloat((v / 100000000).toFixed(2)) + '억' : s + Math.round(v / 10000).toLocaleString('ko-KR') + '만'
}
const toNum = (v: string): number | null => { const d = v.replace(/[^0-9-]/g, ''); return d === '' || d === '-' ? null : parseInt(d, 10) }
const fmtIn = (n: number | null | undefined) => (n == null ? '' : Math.round(n).toLocaleString('ko-KR'))

function NumIn({ value, onChange, placeholder }: { value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string }) {
  return (
    <input inputMode="numeric" value={fmtIn(value)} placeholder={placeholder}
      onChange={e => onChange(toNum(e.target.value))}
      className="w-full text-right tabular-nums text-[14px] font-bold text-[#0b2140] bg-white border-[1.5px] border-gray-200 focus:border-[#b8995a] rounded-xl px-2.5 py-2 outline-none placeholder:text-gray-300 placeholder:font-medium" />
  )
}

type CellKey = 'salesCash' | 'salesCard' | 'buyCash' | 'buyCard'
const ROWS: { key: CellKey; group: string; label: string }[] = [
  { key: 'salesCash', group: '매출', label: '현금(계산서·현금영수증)' },
  { key: 'salesCard', group: '매출', label: '카드' },
  { key: 'buyCash',   group: '매입', label: '현금(계산서·현금영수증)' },
  { key: 'buyCard',   group: '매입', label: '카드' },
]

function Tile({ label, v, sub, dark }: { label: string; v: number; sub?: string; dark?: boolean }) {
  return (
    <div className={`rounded-3xl p-5 ${dark ? 'text-white bg-gradient-to-br from-[#10203a] to-[#0a1424]' : 'bg-white border border-gray-100 shadow-sm'}`}>
      <p className={`text-[13.5px] font-semibold ${dark ? 'text-white/65' : 'text-gray-500'}`}>{label}</p>
      <p className={`text-[30px] leading-tight font-black tabular-nums mt-1 ${dark ? 'text-[#E8D080]' : 'text-[#0b2140]'}`}>{man(v)}</p>
      <p className={`text-[12.5px] tabular-nums ${dark ? 'text-white/45' : 'text-gray-400'}`}>{won(v)}원{sub ? ' · ' + sub : ''}</p>
    </div>
  )
}
function Row3({ label, a, bold }: { label: string; a: { total: number; supply: number; tax: number }; bold?: boolean }) {
  return (
    <tr className={bold ? 'bg-[#f6f0e1] font-bold' : ''}>
      <td className="py-2 px-3 text-left text-[13.5px]">{label}</td>
      <td className="py-2 px-3 text-right tabular-nums text-[13.5px]">{won(a.total)}</td>
      <td className="py-2 px-3 text-right tabular-nums text-[13.5px]">{won(a.supply)}</td>
      <td className="py-2 px-3 text-right tabular-nums text-[13.5px]">{won(a.tax)}</td>
    </tr>
  )
}

export default function TaxCalcTab() {
  const [data, setData] = useState<TaxData>(DEFAULT_TAX_2026)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState('불러오는 중…')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    fetch('/api/tax-calc', { cache: 'no-store' }).then(r => r.json()).then(j => {
      if (j.data) setData(j.data)
      setStatus(j.saved ? '저장된 값' : '엑셀 값으로 시작 (수정하면 저장됩니다)')
      setLoaded(true)
    }).catch(() => { setStatus('불러오지 못했습니다'); setLoaded(true) })
  }, [])

  async function flush() {
    if (timer.current) clearTimeout(timer.current)
    try {
      const r = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, body: JSON.stringify({ _key: 'tax_calc', ...dataRef.current }) })
      if (!r.ok) throw new Error('save')
      dirty.current = false
      const t = new Date()
      setStatus('저장됨 ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'))
    } catch { setStatus('저장 실패 · 다시 눌러 주세요') }
  }
  function edit(fn: (d: TaxData) => TaxData) {
    setData(prev => { const next = fn(prev); dataRef.current = next; return next })
    dirty.current = true
    setStatus('저장 중…')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 600)
  }
  useEffect(() => {
    const h = () => { if (dirty.current) void flush() }
    window.addEventListener('pagehide', h)
    return () => { window.removeEventListener('pagehide', h); h() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setCell = (qi: number, key: CellKey, patch: Partial<TaxCell>) =>
    edit(d => ({ ...d, quarters: d.quarters.map((q, i) => i === qi ? { ...q, [key]: { ...(q[key] as TaxCell), ...patch } } : q) as TaxQuarter[] }))

  const s = computeTax(data)

  return (
    <div className="space-y-5 pb-10 max-w-[1500px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[26px] font-black text-[#0b2140] leading-tight">세금 계산 <span className="text-[16px] text-gray-400 font-bold">{data.year}년 부가세·종소세</span></h2>
          <p className="text-[13.5px] text-gray-500 mt-0.5">홈택스에 신고된 매출·매입 기준입니다. 숫자를 고치면 자동 저장되고, 다른 화면의 세금 숫자도 이 값을 따라갑니다.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-[13px] font-semibold text-gray-500">기준일
            <input type="date" value={data.asOf} onChange={e => edit(d => ({ ...d, asOf: e.target.value }))}
              className="border-[1.5px] border-gray-200 rounded-xl px-3 py-2 text-[14px] font-bold text-[#0b2140] bg-white outline-none focus:border-[#b8995a]" />
          </label>
          <span className="text-[13px] font-bold text-[#0b2140]">{status}</span>
          <button onClick={flush} disabled={!loaded} className="px-5 py-2.5 rounded-full text-[14px] font-bold text-white bg-gradient-to-r from-[#0b2140] to-[#4a5a9a] disabled:opacity-40">저장</button>
        </div>
      </div>

      {/* 홈택스 불러오기 (CODEF 간편인증) */}
      <HometaxPanel data={data}
        onFetched={() => { fetch('/api/tax-calc', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j.data) setData(j.data) }).catch(() => {}) }}
        onApply={patch => edit(d => ({ ...d, quarters: d.quarters.map(q => (patch[q.key] ? { ...q, ...patch[q.key] } : q)) as TaxQuarter[], source: '홈택스' }))} />

      {/* 한눈에 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="현재 가지고 있어야 되는 종소세" v={s.incomeTax} sub={`1년 매출 공급가 × ${Math.round((data.incomeTaxRate ?? 0.1) * 100)}%`} />
        <Tile label="현재 가지고 있어야 되는 부가세" v={s.vat} sub="매출세액 − 매입세액" />
        <Tile label="파킹통장에 있어야 되는 금액" v={s.parking} />
        <Tile label="실제 있어야 될 금액" v={s.actual} sub={s.paidTotal > 0 ? `예정 신고 ${won(s.paidTotal)}원 낸 뒤` : '예정 신고로 낸 금액 없음'} dark />
      </div>

      {/* 직접 입력 */}
      <div className="rounded-3xl bg-[#fffaf0] border-[1.5px] border-[#ecd9a6] p-5">
        <p className="inline-block bg-[#b8995a] text-white text-[12px] font-bold px-3 py-1 rounded-full mb-3">수정할 곳</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block"><span className="text-[13px] font-semibold text-gray-600">1기 예정에 낸 금액</span><NumIn value={data.paid?.q1} onChange={v => edit(d => ({ ...d, paid: { ...d.paid, q1: v } }))} placeholder="없으면 비움" /></label>
          <label className="block"><span className="text-[13px] font-semibold text-gray-600">2기 예정에 낸 금액</span><NumIn value={data.paid?.q3} onChange={v => edit(d => ({ ...d, paid: { ...d.paid, q3: v } }))} placeholder="없으면 비움" /></label>
          <label className="block"><span className="text-[13px] font-semibold text-gray-600">종소세 적립률 (%)</span>
            <input inputMode="decimal" defaultValue={String(Math.round((data.incomeTaxRate ?? 0.1) * 1000) / 10)} key={String(data.incomeTaxRate)}
              onBlur={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) edit(d => ({ ...d, incomeTaxRate: n / 100 })) }}
              className="w-full text-right tabular-nums text-[14px] font-bold text-[#0b2140] bg-white border-[1.5px] border-gray-200 focus:border-[#b8995a] rounded-xl px-2.5 py-2 outline-none" /></label>
        </div>
        <p className="text-[12.5px] text-gray-500 mt-2">아래 분기별 칸에 홈택스 총액을 적으면 공급가액과 세액은 자동 계산됩니다(총액 ÷ 1.1). 홈택스 공급가액이 다르면 공급가액 칸에 직접 적으세요.</p>
      </div>

      {/* 분기별 */}
      <div className="grid lg:grid-cols-2 gap-4">
        {data.quarters.map((q, qi) => {
          const qs = s.quarters[qi]
          return (
            <div key={q.key} className="bg-white border border-gray-100 shadow-sm rounded-3xl p-5">
              <p className="text-[18px] font-black text-[#0b2140] mb-3">{q.label} <span className="text-[14px] text-gray-400 font-bold">{q.months} · {q.note}</span></p>
              <div className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr] gap-x-2 gap-y-1.5 items-center text-[12.5px]">
                <span /><span className="text-center font-bold text-gray-400">총액(부가세 포함)</span><span className="text-center font-bold text-gray-400">공급가액</span><span className="text-center font-bold text-gray-400">세액</span>
                {ROWS.map(r => {
                  const cell = q[r.key]
                  const a = cellAmt(cell)
                  return (
                    <div key={r.key} className="contents">
                      <span className="text-[13px] font-bold text-[#0b2140]"><span className={r.group === '매출' ? 'text-sky-600' : 'text-violet-600'}>{r.group}</span> {r.label}</span>
                      <NumIn value={cell.total} onChange={v => setCell(qi, r.key, { total: v })} placeholder="-" />
                      <NumIn value={cell.supply} onChange={v => setCell(qi, r.key, { supply: v })} placeholder={cell.total ? won(a.supply) : '자동'} />
                      <span className="text-right tabular-nums font-semibold text-gray-600 pr-1">{cell.total ? won(a.tax) : '-'}</span>
                    </div>
                  )
                })}
              </div>
              <table className="w-full mt-3 border-t border-gray-100">
                <tbody>
                  <Row3 label="매출 계" a={qs.sales} bold />
                  <Row3 label="매입 계" a={qs.buy} />
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      {/* 반기·1년 합계 */}
      <div className="grid lg:grid-cols-2 gap-4">
        {[{ t: '전반기 (1~6월)', h: s.h1, due: '신고·납부 7월 25일' }, { t: '하반기 (7~12월)', h: s.h2, due: '신고·납부 다음 해 1월 25일' }].map(x => (
          <div key={x.t} className="bg-white border border-gray-100 shadow-sm rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-[16px] font-black text-[#0b2140]">{x.t}</p>
              <p className="text-[12.5px] text-gray-400 font-semibold">{x.due}</p>
            </div>
            <table className="w-full mt-2">
              <thead><tr className="text-[12px] text-gray-400"><th /><th className="text-right px-3 font-semibold">총액</th><th className="text-right px-3 font-semibold">공급가액</th><th className="text-right px-3 font-semibold">세액</th></tr></thead>
              <tbody>
                <Row3 label="매출 현금 소계" a={x.h.salesCash} />
                <Row3 label="매출 카드 소계" a={x.h.salesCard} />
                <Row3 label="매입 현금 소계" a={x.h.buyCash} />
                <Row3 label="매입 카드 소계" a={x.h.buyCard} />
              </tbody>
            </table>
            <div className="mt-3 rounded-2xl bg-[#fff6d6] px-4 py-3 flex items-center justify-between">
              <span className="text-[14px] font-bold text-[#8a6d2b]">내야 되는 부가세</span>
              <span className="text-[22px] font-black text-[#b3261e] tabular-nums">{won(x.h.vatDue)}원</span>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-5">
        <p className="text-[16px] font-black text-[#0b2140] mb-2">1년 합계</p>
        <table className="w-full">
          <thead><tr className="text-[12px] text-gray-400"><th /><th className="text-right px-3 font-semibold">총액</th><th className="text-right px-3 font-semibold">공급가액</th><th className="text-right px-3 font-semibold">세액</th></tr></thead>
          <tbody><Row3 label="1년 합계 매출" a={s.year.sales} bold /><Row3 label="1년 합계 매입" a={s.year.buy} bold /></tbody>
        </table>
      </div>
      <p className="text-[12.5px] text-gray-400">참고용 계산입니다. 신고 금액은 세무사 확인 후 확정하세요.</p>
    </div>
  )
}
