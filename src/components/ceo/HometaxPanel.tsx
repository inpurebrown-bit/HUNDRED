'use client'

import { useEffect, useRef, useState } from 'react'
import { computeTax, type TaxData, type TaxCell } from '@/lib/taxCalc'
import { quarterMonths, sumMonths, hasMonths, type HometaxData } from '@/lib/hometaxData'

interface Profile { userName: string; birth: string; phoneNo: string; telecom: string; authLevel: string; bizNo: string }
const EMPTY: Profile = { userName: '', birth: '', phoneNo: '', telecom: '0', authLevel: '1', bizNo: '' }
const AUTHS: [string, string][] = [['1', '카카오톡'], ['3', '삼성패스'], ['4', 'KB모바일'], ['5', '통신사(PASS)'], ['6', '네이버'], ['8', '토스']]
type Kind = 'vatCert' | 'taxInvoice' | 'cashSales' | 'cashBuy'
const ITEMS: { kind: Kind; label: string; desc: string }[] = [
  { kind: 'vatCert', label: '반기별 신고 매출', desc: '부가세과세표준증명 — 홈택스에 신고된 1기·2기 과세표준' },
  { kind: 'taxInvoice', label: '세금계산서 월별 매출·매입', desc: '전자세금계산서 기간별 통계 — 매출과 매입을 한 번에' },
  { kind: 'cashSales', label: '현금영수증 매출', desc: '건별 내역을 월별로 합산 (취소 거래는 차감)' },
  { kind: 'cashBuy', label: '현금영수증 매입', desc: '건별 내역을 월별로 합산 (공제분만)' },
]
type Phase = 'idle' | 'requesting' | 'waiting' | 'loading' | 'error'
const won = (v: any) => { const n = typeof v === 'number' ? Math.round(v) : parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return isNaN(n) ? String(v ?? '') : n.toLocaleString('ko-KR') }
const fmtT = (s?: string) => (s ? new Date(s).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '아직 안 불러옴')

export default function HometaxPanel({ data, onApply, onFetched }: { data?: TaxData; onApply?: (patch: Record<string, { salesCash?: TaxCell; salesCard?: TaxCell; buyCash?: TaxCell }>) => void; onFetched?: () => void }) {
  const [info, setInfo] = useState<{ configured: boolean; env: string } | null>(null)
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [profileMsg, setProfileMsg] = useState('')
  const [hd, setHd] = useState<HometaxData>({})
  const [phase, setPhase] = useState<Phase>('idle')
  const [active, setActive] = useState<Kind | null>(null)
  const [msg, setMsg] = useState('')
  const [left, setLeft] = useState(0)
  const [secret7, setSecret7] = useState('')
  const [applyMsg, setApplyMsg] = useState('')
  const ctx = useRef<{ sid: string; kind: Kind; twoWay: any; queue: Kind[] } | null>(null)
  const tally = useRef<{ done: Kind[]; failed: string[] }>({ done: [], failed: [] })
  const [authNo, setAuthNo] = useState(0)
  const [picked, setPicked] = useState<Record<Kind, boolean>>({ vatCert: true, taxInvoice: false, cashSales: true, cashBuy: true })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetch('/api/hometax/sync', { cache: 'no-store' }).then(r => r.json()).then(j => {
      setInfo({ configured: !!j.configured, env: j.env })
      if (j.profile) setProfile({ ...EMPTY, ...j.profile })
      if (j.data) setHd(j.data)
    }).catch(() => setMsg('연결 상태를 불러오지 못했습니다'))
  }, [])

  useEffect(() => {
    if (phase !== 'waiting') return
    setLeft(270)
    const id = setInterval(() => setLeft(s => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [phase, authNo])

  async function saveProfile() {
    const p = { ...profile, phoneNo: profile.phoneNo.replace(/[^0-9]/g, ''), birth: profile.birth.replace(/[^0-9]/g, ''), bizNo: profile.bizNo.replace(/[^0-9]/g, '') }
    const r = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _key: 'codef_profile', ...p }) })
    setProfile(p); setProfileMsg(r.ok ? '저장했습니다' : '저장 실패'); setTimeout(() => setProfileMsg(''), 2500)
  }

  async function call(body: any) {
    const ac = new AbortController(); abortRef.current = ac
    const r = await fetch('/api/hometax/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal })
    return r.json()
  }
  function cancel() { abortRef.current?.abort(); ctx.current = null; setPhase('idle'); setActive(null); setMsg('취소했습니다') }
  const labelOf = (k?: Kind) => ITEMS.find(i => i.kind === k)?.label || ''
  // 항목을 하나씩 차례로 읽는다 — 승인이 필요한 항목에서 멈추고, 승인하면 이어서 읽는다
  async function run(body: any) {
    try { handle(await call({ ...body, secret7: picked.taxInvoice ? secret7 : undefined })) }
    catch (e: any) { if (e?.name !== 'AbortError') { setPhase('error'); setMsg('요청에 실패했습니다') } }
  }
  function start() {
    const kinds = ITEMS.map(i => i.kind).filter(k => picked[k])
    if (!kinds.length) { setMsg('불러올 항목을 골라 주세요'); return }
    tally.current = { done: [], failed: [] }
    setActive(kinds[0]); setPhase('requesting'); setMsg('')
    void run({ action: 'start', kinds })
  }
  function confirm() {
    const c = ctx.current
    if (!c) return
    setPhase('loading'); setMsg(labelOf(c.kind) + ' 가져오는 중입니다. 최대 1~2분 걸릴 수 있어요…')
    void run({ action: 'confirm', kind: c.kind, sid: c.sid, twoWay: c.twoWay, queue: c.queue })
  }
  async function reload() {
    const j = await fetch('/api/hometax/sync', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
    if (j?.data) setHd(j.data)
    onFetched?.()
  }
  async function finishAll() {
    await reload()
    ctx.current = null; setActive(null)
    const { done, failed } = tally.current
    const okTxt = done.length ? `${done.map(labelOf).join(', ')} 불러왔습니다. 아래 표를 확인하세요.` : ''
    if (failed.length) { setPhase('error'); setMsg([okTxt, '실패: ' + failed.join(' / ')].filter(Boolean).join(' · ')) }
    else { setPhase('idle'); setMsg(okTxt || '불러오기를 마쳤습니다') }
  }
  function handle(j: any) {
    for (const k of j.done || []) tally.current.done.push(k)
    for (const f of j.failed || []) tally.current.failed.push([labelOf(f.kind), f.message].filter(Boolean).join(' '))
    if (j.status === 'need-auth') {
      ctx.current = { sid: j.sid, kind: j.kind, twoWay: j.twoWay, queue: j.queue || [] }
      setActive(j.kind); setPhase('waiting'); setMsg(j.message || '')
      if (!j.retry) setAuthNo(n => n + 1)    // 새 승인 요청이면 남은 시간을 다시 센다
    } else if (j.status === 'next') {
      if (j.queue?.length) { setPhase('loading'); setMsg('다음 항목을 읽는 중…'); void run({ action: 'next', sid: j.sid, kinds: j.queue }) }
      else void finishAll()
    } else if (j.status === 'done') {
      void finishAll()
    } else {
      setPhase('error'); setMsg([j.code, j.message, j.extra].filter(Boolean).join(' · ') || '알 수 없는 오류')
    }
  }

  const upd = (k: keyof Profile, v: string) => setProfile(p => ({ ...p, [k]: v }))
  const inCls = 'w-full text-[14px] font-bold text-[#0b2140] bg-white border-[1.5px] border-gray-200 focus:border-[#b8995a] rounded-xl px-3 py-2 outline-none'
  const busy = phase !== 'idle' && phase !== 'error'

  // ── 읽은 자료 정리: 분기·반기 ──
  const year = data?.year ?? new Date().getFullYear()
  const qs = ([1, 2, 3, 4] as const).map(q => {
    const ms = quarterMonths(year, q)
    const have = { tis: hasMonths(hd.taxInvoiceSales, ms), tib: hasMonths(hd.taxInvoiceBuy, ms), cs: hasMonths(hd.cashSales, ms), cb: hasMonths(hd.cashBuy, ms) }
    const tis = sumMonths(hd.taxInvoiceSales, ms), tib = sumMonths(hd.taxInvoiceBuy, ms), cs = sumMonths(hd.cashSales, ms), cb = sumMonths(hd.cashBuy, ms)
    return { q, ms, have, tis, tib, cs, cb, sales: { supply: tis.supply + cs.supply, tax: tis.tax + cs.tax, total: tis.total + cs.total }, buy: { supply: tib.supply + cb.supply, tax: tib.tax + cb.tax, total: tib.total + cb.total } }
  })
  const sheet = data ? computeTax({ ...data, reported: undefined }) : null
  const halfRows = [1, 2].map(h => {
    const a = qs[(h - 1) * 2], b = qs[(h - 1) * 2 + 1]
    const cert = (hd.halves || []).find(x => x.start === `${year}${h === 1 ? '01' : '07'}01`)
    const have = a.have.tis && a.have.cs && b.have.tis && b.have.cs
    const cashSupply = a.sales.supply + b.sales.supply
    const card = cert && have ? cert.total - cashSupply : null
    const sheetCard = sheet ? (h === 1 ? sheet.quarters[0].salesCard.supply + sheet.quarters[1].salesCard.supply : sheet.quarters[2].salesCard.supply + sheet.quarters[3].salesCard.supply) : null
    return { h, cert, have, cashSupply, card, sheetCard }
  })
  const monthsShown = Array.from(new Set([...Object.keys(hd.taxInvoiceSales || {}), ...Object.keys(hd.taxInvoiceBuy || {}), ...Object.keys(hd.cashSales || {}), ...Object.keys(hd.cashBuy || {})])).sort()

  function apply() {
    const patch: Record<string, { salesCash?: TaxCell; salesCard?: TaxCell; buyCash?: TaxCell }> = {}
    const done: string[] = []
    for (const q of qs) {
      const p: { salesCash?: TaxCell; salesCard?: TaxCell; buyCash?: TaxCell } = {}
      // 세금계산서와 현금영수증이 둘 다 읽힌 달만 합산한다 (이번 달처럼 일부만 읽힌 분기도 읽힌 달까지 반영)
      const both = (a?: Record<string, any>, b?: Record<string, any>) => q.ms.filter(m => a?.[m] !== undefined && b?.[m] !== undefined)
      const sm = both(hd.taxInvoiceSales, hd.cashSales), bm = both(hd.taxInvoiceBuy, hd.cashBuy)
      if (sm.length) { const a = sumMonths(hd.taxInvoiceSales, sm), b = sumMonths(hd.cashSales, sm); p.salesCash = { total: a.total + b.total, supply: a.supply + b.supply } }
      if (bm.length) { const a = sumMonths(hd.taxInvoiceBuy, bm), b = sumMonths(hd.cashBuy, bm); p.buyCash = { total: a.total + b.total, supply: a.supply + b.supply } }
      if (p.salesCash || p.salesCard || p.buyCash) { patch['q' + q.q] = p; done.push(`${q.q}기${p.salesCash ? ` 매출(${sm.length}개월)` : ''}${p.buyCash ? ` 매입(${bm.length}개월)` : ''}`) }
    }
    if (!done.length) { setApplyMsg('세금계산서와 현금영수증이 함께 읽힌 달이 아직 없습니다. 먼저 불러오세요.'); return }
    onApply?.(patch); setApplyMsg('표에 반영했습니다: ' + done.join(', '))
  }

  const Cell = ({ v }: { v?: { supply: number; tax: number } }) => <td className="text-right tabular-nums px-2">{v ? won(v.supply) : <span className="text-gray-300">-</span>}</td>

  return (
    <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[18px] font-black text-[#0b2140]">홈택스에서 불러오기 <span className="text-[13px] font-bold text-gray-400">CODEF 간편인증 · {info?.env === 'prod' ? '정식' : info?.env === 'sandbox' ? '샌드박스(테스트 데이터)' : '데모'}</span></p>
          <p className="text-[13px] text-gray-500 mt-0.5">항목을 하나씩 차례로 읽습니다. 홈택스가 항목마다 승인을 다시 요구하면 그 항목 이름과 함께 안내합니다. 읽은 자료는 월별로 정리해 아래에 보여줍니다.</p>
        </div>
        {info && !info.configured && <span className="text-[12.5px] font-bold text-[#b3261e] bg-[#fde7e3] px-3 py-1.5 rounded-full">CODEF 키 미설정</span>}
      </div>

      {/* 연결 정보 */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[13.5px] font-bold text-[#0b2140]">연결 정보 {profile.userName ? `· ${profile.userName}` : '(입력 필요)'}</summary>
        <div className="grid sm:grid-cols-3 gap-3 mt-3">
          <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">이름</span><input className={inCls} value={profile.userName} onChange={e => upd('userName', e.target.value)} /></label>
          <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">생년월일 (YYYYMMDD)</span><input className={inCls} inputMode="numeric" value={profile.birth} onChange={e => upd('birth', e.target.value)} placeholder="19900101" /></label>
          <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">전화번호</span><input className={inCls} inputMode="numeric" value={profile.phoneNo} onChange={e => upd('phoneNo', e.target.value)} placeholder="01012345678" /></label>
          <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">간편인증 종류</span>
            <select className={inCls} value={profile.authLevel} onChange={e => upd('authLevel', e.target.value)}>{AUTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {profile.authLevel === '5' && (
            <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">통신사</span>
              <select className={inCls} value={profile.telecom} onChange={e => upd('telecom', e.target.value)}><option value="0">SKT(알뜰폰)</option><option value="1">KT(알뜰폰)</option><option value="2">LG U+(알뜰폰)</option></select></label>
          )}
          <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">사업자번호 <span className="font-normal text-gray-400">(없으면 비움)</span></span><input className={inCls} inputMode="numeric" value={profile.bizNo} onChange={e => upd('bizNo', e.target.value)} /></label>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={saveProfile} className="px-4 py-2 rounded-full text-[13px] font-bold text-white bg-[#0b2140]">연결 정보 저장</button>
          <span className="text-[12.5px] text-gray-500">대표 계정에서만 보이며 CRM 설정에 저장됩니다.</span>
          {profileMsg && <span className="text-[12.5px] font-bold text-emerald-600">{profileMsg}</span>}
        </div>
      </details>

      {/* 불러올 항목 — 한 번 승인으로 선택한 항목을 모두 읽는다 */}
      <div className="mt-4 grid md:grid-cols-2 gap-3">
        {ITEMS.map(it => (
          <label key={it.kind} className={'rounded-2xl border p-4 cursor-pointer block ' + (picked[it.kind] ? 'border-[#b8995a] bg-[#fffaf0]' : 'border-gray-100 bg-gray-50/60')}>
            <span className="flex items-center gap-2"><input type="checkbox" checked={picked[it.kind]} onChange={e => setPicked(p => ({ ...p, [it.kind]: e.target.checked }))} /><span className="text-[14.5px] font-black text-[#0b2140]">{it.label}</span></span>
            <p className="text-[12.5px] text-gray-500 mt-1">{it.desc}</p>
            <p className="text-[12px] text-gray-400 mt-1">마지막 {fmtT(hd.fetched?.[it.kind])}{hd.ranges?.[it.kind] ? ' · ' + hd.ranges[it.kind] : ''}</p>
            {it.kind === 'taxInvoice' && picked.taxInvoice && (
              <span className="block mt-2"><span className="text-[12px] font-semibold text-gray-600">주민등록번호 뒤 7자리 <span className="font-normal text-gray-400">(저장하지 않고 이번 요청에만 사용)</span></span>
                <input type="password" inputMode="numeric" maxLength={7} value={secret7} onChange={e => setSecret7(e.target.value.replace(/[^0-9]/g, ''))} className={inCls} autoComplete="off" /></span>
            )}
          </label>
        ))}
      </div>
      <button onClick={start} disabled={!info?.configured || busy || (picked.taxInvoice && secret7.length !== 7)}
        className="mt-3 px-6 py-2.5 rounded-full text-[14px] font-bold text-white bg-gradient-to-r from-[#0b2140] to-[#4a5a9a] disabled:opacity-40">
        선택한 항목 불러오기
      </button>
      {info && !info.configured && <p className="mt-2 text-[12.5px] font-bold text-[#b3261e]">버튼이 눌리지 않는 이유: 이 서버에 CODEF 키(CODEF_CLIENT_ID, CODEF_CLIENT_SECRET)가 설정되지 않았습니다. Vercel 환경변수에 넣고 다시 배포하면 켜집니다.</p>}
      {info?.configured && picked.taxInvoice && secret7.length !== 7 && <p className="mt-2 text-[12.5px] font-bold text-[#b3261e]">세금계산서를 읽으려면 주민등록번호 뒤 7자리를 입력하세요. (안 읽을 거면 세금계산서 체크를 해제)</p>}
      {info?.configured && !profile.userName && <p className="mt-2 text-[12.5px] font-bold text-[#b3261e]">위의 "연결 정보"에 이름·생년월일·전화번호를 먼저 저장하세요.</p>}

      {/* 진행 상태 */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {phase === 'requesting' && (<><span className="text-[14px] font-bold text-[#0b2140]">인증을 요청하는 중…</span><button onClick={cancel} className="px-4 py-2 rounded-full text-[13px] font-bold text-gray-500 bg-white border border-gray-200">취소</button></>)}
        {phase === 'waiting' && (
          <div className="rounded-2xl bg-[#fffaf0] border-[1.5px] border-[#ecd9a6] px-4 py-3 flex flex-wrap items-center gap-3">
            <div>
              <p className="text-[14px] font-black text-[#0b2140]">{AUTHS.find(a => a[0] === profile.authLevel)?.[1] || '간편인증'} 앱에서 「{labelOf(active ?? undefined)}」 인증 요청을 승인하세요</p>
              <p className="text-[12.5px] text-gray-500">승인한 뒤 아래 버튼을 눌러 주세요 · 남은 시간 {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}{msg ? ' · ' + msg : ''}</p>
            </div>
            <button onClick={confirm} className="px-5 py-2 rounded-full text-[14px] font-bold text-white bg-[#0b2140]">승인했어요</button>
            <button onClick={cancel} className="px-4 py-2 rounded-full text-[13px] font-bold text-gray-500 bg-white border border-gray-200">취소</button>
          </div>
        )}
        {phase === 'loading' && (<><span className="text-[14px] font-bold text-[#0b2140]">{msg}</span><button onClick={cancel} className="px-4 py-2 rounded-full text-[13px] font-bold text-gray-500 bg-white border border-gray-200">취소</button></>)}
        {phase === 'error' && <span className="text-[13.5px] font-bold text-[#b3261e]">{msg}</span>}
        {phase === 'idle' && msg && <span className="text-[13px] font-semibold text-emerald-700">{msg}</span>}
      </div>

      {/* 읽은 자료 (월별) */}
      {monthsShown.length > 0 && (
        <div className="mt-5">
          <p className="text-[15px] font-black text-[#0b2140] mb-2">홈택스 원자료 <span className="text-[12.5px] text-gray-400 font-bold">공급가액 기준 · 월별</span></p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="text-gray-400 text-[12px]"><th className="text-left font-semibold py-1">월</th><th className="text-right font-semibold px-2">세금계산서 매출</th><th className="text-right font-semibold px-2">현금영수증 매출</th><th className="text-right font-semibold px-2">세금계산서 매입</th><th className="text-right font-semibold px-2">현금영수증 매입(공제)</th></tr></thead>
              <tbody>{monthsShown.map(ym => (
                <tr key={ym} className="border-t border-gray-100"><td className="py-1.5 font-bold text-[#0b2140]">{ym.slice(0, 4)}-{ym.slice(4)}</td><Cell v={hd.taxInvoiceSales?.[ym]} /><Cell v={hd.cashSales?.[ym]} /><Cell v={hd.taxInvoiceBuy?.[ym]} /><Cell v={hd.cashBuy?.[ym]} /></tr>
              ))}</tbody>
            </table>
          </div>

          {/* 분기 합계 */}
          <p className="text-[14px] font-black text-[#0b2140] mt-4 mb-1">분기별 합계 <span className="text-[12px] text-gray-400 font-bold">세 달이 모두 읽힌 분기만 계산</span></p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="text-gray-400 text-[12px]"><th className="text-left font-semibold py-1">분기</th><th className="text-right font-semibold px-2">현금 매출 공급가</th><th className="text-right font-semibold px-2">엑셀 현금 매출</th><th className="text-right font-semibold px-2">현금 매입 공급가</th><th className="text-right font-semibold px-2">엑셀 현금 매입</th></tr></thead>
              <tbody>{qs.map(q => {
                const sq = sheet?.quarters[q.q - 1]
                const okS = q.have.tis && q.have.cs, okB = q.have.tib && q.have.cb
                return (
                  <tr key={q.q} className="border-t border-gray-100">
                    <td className="py-1.5 font-bold text-[#0b2140]">{q.q}기 <span className="text-gray-400 font-normal">{(q.q - 1) * 3 + 1}~{q.q * 3}월</span></td>
                    <td className="text-right tabular-nums px-2">{okS ? won(q.sales.supply) : <span className="text-gray-300">-</span>}</td>
                    <td className={'text-right tabular-nums px-2 ' + (okS && sq && Math.abs(q.sales.supply - sq.salesCash.supply) > 1000 ? 'text-[#b3261e] font-bold' : 'text-gray-500')}>{sq ? won(sq.salesCash.supply) : '-'}</td>
                    <td className="text-right tabular-nums px-2">{okB ? won(q.buy.supply) : <span className="text-gray-300">-</span>}</td>
                    <td className={'text-right tabular-nums px-2 ' + (okB && sq && Math.abs(q.buy.supply - sq.buyCash.supply) > 1000 ? 'text-[#b3261e] font-bold' : 'text-gray-500')}>{sq ? won(sq.buyCash.supply) : '-'}</td>
                  </tr>
                )
              })}</tbody>
            </table>
          </div>

          {/* 반기 대조 + 카드 */}
          <p className="text-[14px] font-black text-[#0b2140] mt-4 mb-1">반기별 신고 매출과 카드 매출 <span className="text-[12px] text-gray-400 font-bold">카드 = 신고 과세표준 − 세금계산서·현금영수증 매출</span></p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="text-gray-400 text-[12px]"><th className="text-left font-semibold py-1">반기</th><th className="text-right font-semibold px-2">신고 과세표준</th><th className="text-right font-semibold px-2">계산서+현금영수증</th><th className="text-right font-semibold px-2">카드·기타(계산)</th><th className="text-right font-semibold px-2">엑셀 카드</th></tr></thead>
              <tbody>{halfRows.map(r => (
                <tr key={r.h} className="border-t border-gray-100">
                  <td className="py-1.5 font-bold text-[#0b2140]">{r.h === 1 ? '1기 (1~6월)' : '2기 (7~12월)'}</td>
                  <td className="text-right tabular-nums px-2">{r.cert ? won(r.cert.total) : <span className="text-gray-300">신고 전</span>}</td>
                  <td className="text-right tabular-nums px-2">{r.have ? won(r.cashSupply) : <span className="text-gray-300">-</span>}</td>
                  <td className="text-right tabular-nums px-2 font-bold">{r.card != null ? won(r.card) : <span className="text-gray-300 font-normal">-</span>}</td>
                  <td className="text-right tabular-nums px-2 text-gray-500">{r.sheetCard != null ? won(r.sheetCard) : '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-[12px] text-gray-500 mt-2">카드 매출은 홈택스 간편인증으로 조회할 수 없어 <b>엑셀 표에 총액을 직접 입력</b>합니다(부가세는 자동으로 뺍니다). 위 "카드·기타(계산)"는 신고가 끝난 반기의 참고 값입니다.</p>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <button onClick={apply} className="px-5 py-2 rounded-full text-[13.5px] font-bold text-white bg-[#0b2140]">홈택스 값으로 엑셀 표 채우기</button>
            {applyMsg && <span className="text-[13px] font-semibold text-emerald-700">{applyMsg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
