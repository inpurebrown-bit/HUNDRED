'use client'

import { useEffect, useMemo, useState } from 'react'

// 잔금 관리 — 선금을 받은 신규(1년 관리비) 계약의 남은 잔금을 한눈에: 얼마 남았는지, 기한(업무 세팅 후 90일), 요청 이력, 완납 표시.
interface Item {
  id: string; company: string; phone: string; sales: string; ops: string
  contractDate: string; setupDate: string; due: string; dday: number | null
  total: number; prepaid: number; paidExtra: number; remaining: number; done: boolean; doneManual: boolean
  requests: { date: string; note: string; by: string }[]; requestCount: number
  payments: { date: string; amount: number; label: string }[]; note: string
}

const won = (n: number) => Math.round(n).toLocaleString('ko-KR') + '원'
const man = (n: number) => n >= 100000000 ? parseFloat((n / 100000000).toFixed(2)) + '억' : Math.round(n / 10000).toLocaleString('ko-KR') + '만'

export default function BalanceTab({ isCeo = false }: { isCeo?: boolean }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'wait' | 'done' | 'all'>('wait')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [payAmt, setPayAmt] = useState('')
  const [payVat, setPayVat] = useState(false)
  const [reqNote, setReqNote] = useState('')

  async function load() {
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/balances')
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || '불러오기 실패')
      setItems(j.items || [])
    } catch (e: any) { setErr(e.message || '불러오기 실패') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function act(id: string, body: Record<string, any>) {
    setBusy(true)
    const r = await fetch('/api/balances', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { alert(j.error || '저장 실패'); return false }
    await load()
    return true
  }

  const wait = items.filter(i => !i.done)
  const overdue = wait.filter(i => i.dday != null && i.dday < 0)
  const soon = wait.filter(i => i.dday != null && i.dday >= 0 && i.dday <= 14)
  const shown = useMemo(() => items.filter(i => filter === 'all' ? true : filter === 'wait' ? !i.done : i.done), [items, filter])
  const waitSum = wait.reduce((s, i) => s + i.remaining, 0)

  const ddayBadge = (i: Item) => {
    if (i.done) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ 잔금 완료</span>
    if (i.dday == null) return <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">기한 미정</span>
    if (i.dday < 0) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">기한 {-i.dday}일 지남</span>
    if (i.dday <= 14) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">D-{i.dday}</span>
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">D-{i.dday}</span>
  }

  return (
    <div className="space-y-5 max-w-4xl pb-10">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-[26px] font-black text-[#0b2140] leading-tight">잔금 관리</h2>
          <p className="text-[13.5px] text-gray-500 mt-0.5">선금을 받은 신규 계약의 남은 잔금 — 업무 세팅 후 90일 안에 받습니다{isCeo ? '' : ' (내가 맡은 건)'}</p>
        </div>
        <button onClick={load} className="px-3 py-1.5 text-xs bg-white border border-gray-200 text-gray-600 rounded-xl hover:border-gray-400">새로고침</button>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: '잔금 대기', v: `${wait.length}건`, s: `남은 ${man(waitSum)}원`, c: 'text-[#0b2140]' },
          { l: '기한 지남', v: `${overdue.length}건`, s: overdue.length ? man(overdue.reduce((s, i) => s + i.remaining, 0)) + '원 먼저 챙기기' : '없음', c: overdue.length ? 'text-rose-600' : 'text-gray-400' },
          { l: '2주 안 마감', v: `${soon.length}건`, s: soon.length ? man(soon.reduce((s, i) => s + i.remaining, 0)) + '원' : '없음', c: soon.length ? 'text-amber-600' : 'text-gray-400' },
          { l: '잔금 완료', v: `${items.length - wait.length}건`, s: '더 이상 요청 안 해도 됨', c: 'text-emerald-600' },
        ].map(t => (
          <div key={t.l} className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
            <p className="text-[11px] text-gray-400">{t.l}</p>
            <p className={`text-2xl font-black mt-0.5 ${t.c}`}>{t.v}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{t.s}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        {([['wait', `잔금 대기 ${wait.length}`], ['done', `완료 ${items.length - wait.length}`], ['all', '전체']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border ${filter === k ? 'bg-[#0b2140] text-white border-[#0b2140]' : 'bg-white text-gray-500 border-gray-200'}`}>{l}</button>
        ))}
      </div>

      {err && <p className="text-sm text-rose-600">{err}</p>}
      {loading ? <p className="text-center text-gray-400 text-sm py-10">불러오는 중...</p> : shown.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center text-sm text-gray-400">
          {items.length === 0 ? '아직 새 구조(선금·잔금) 계약이 없습니다. 계약완료 창에서 "신규" 방식으로 넘긴 계약이 여기에 나옵니다.' : '해당하는 건이 없습니다.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map(i => {
            const isOpen = open === i.id
            return (
              <div key={i.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${i.done ? 'border-emerald-100' : i.dday != null && i.dday < 0 ? 'border-rose-200' : 'border-gray-100'}`}>
                <button type="button" onClick={() => { setOpen(isOpen ? null : i.id); setPayAmt(''); setReqNote('') }} className="w-full text-left px-4 py-3.5 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#0b2140] truncate">{i.company}</p>
                    <p className="text-[11px] text-gray-400">영업 {i.sales || '-'}{i.ops ? ` · 관리 ${i.ops}` : ''} · 계약 {i.contractDate.slice(5)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400">남은 잔금</p>
                    <p className={`text-xl font-black tabular-nums ${i.done ? 'text-emerald-600' : 'text-[#0b2140]'}`}>{i.done ? '0원' : won(i.remaining)}</p>
                  </div>
                  <div className="shrink-0">{ddayBadge(i)}</div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-50 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[['1년 관리비(VAT 별도)', i.total], ['선금 입금', i.prepaid], ['잔금 입금', i.paidExtra]].map(([l, v]) => (
                        <div key={l as string} className="bg-gray-50 rounded-xl px-2 py-2"><p className="text-[10px] text-gray-400">{l}</p><p className="text-sm font-bold text-[#0b2140] tabular-nums">{won(v as number)}</p></div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-gray-500">
                      <span>업무 세팅 완료일 <b className="text-gray-700">{i.setupDate || '-'}</b></span>
                      <span>잔금 기한 <b className="text-gray-700">{i.due || '-'}</b></span>
                      <span>전화 <b className="text-gray-700">{i.phone || '-'}</b></span>
                    </div>

                    {/* 요청 이력 */}
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 mb-1">잔금 요청 이력 ({i.requestCount}회)</p>
                      {i.requests.length === 0 ? <p className="text-[11px] text-gray-400">아직 요청한 기록이 없습니다.</p> : (
                        <ul className="space-y-0.5">{i.requests.map((r, k) => <li key={k} className="text-[12px] text-gray-600">{r.date} · {r.by || '-'} {r.note && <span className="text-gray-400">— {r.note}</span>}</li>)}</ul>
                      )}
                      {i.payments.length > 0 && <p className="text-[11px] text-emerald-700 mt-1.5">입금: {i.payments.map(p => `${p.date.slice(5)} ${won(p.amount)}`).join(' · ')}</p>}
                    </div>

                    {!i.done && (
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3 space-y-2">
                          <p className="text-[11px] font-bold text-amber-700">📞 잔금 요청했어요</p>
                          <input value={reqNote} onChange={e => setReqNote(e.target.value)} placeholder="메모 (예: 다음 주 입금 약속)" className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white" />
                          <button disabled={busy} onClick={async () => { if (await act(i.id, { action: 'request', note: reqNote })) setReqNote('') }}
                            className="w-full py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold disabled:opacity-50">요청 기록 남기기</button>
                        </div>
                        <div className="rounded-xl bg-emerald-50/70 border border-emerald-100 p-3 space-y-2">
                          <p className="text-[11px] font-bold text-emerald-700">💰 잔금 입금됐어요</p>
                          <div className="flex gap-1.5 items-center">
                            <input value={payAmt} inputMode="numeric" onChange={e => setPayAmt(e.target.value.replace(/[^0-9]/g, '') ? Number(e.target.value.replace(/[^0-9]/g, '')).toLocaleString() : '')} placeholder={`남은 ${i.remaining.toLocaleString()}`} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-right bg-white" />
                            <label className="text-[10px] text-gray-500 flex items-center gap-1 shrink-0"><input type="checkbox" checked={payVat} onChange={e => setPayVat(e.target.checked)} />VAT 포함</label>
                          </div>
                          <div className="flex gap-1.5">
                            <button disabled={busy} onClick={async () => { const n = Number(payAmt.replace(/[^0-9]/g, '')); if (n > 0 && await act(i.id, { action: 'payment', amount: n, vatIncluded: payVat })) setPayAmt('') }}
                              className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">입금 기록</button>
                            <button disabled={busy} onClick={() => { setPayAmt(i.remaining.toLocaleString()); setPayVat(false) }} className="px-2.5 rounded-lg border border-emerald-300 text-emerald-700 text-[11px] font-bold bg-white">전액</button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {!i.done
                        ? <button disabled={busy} onClick={() => { if (confirm('남은 금액이 있어도 잔금을 다 정산한 것으로 표시합니다. 완납 처리할까요?')) act(i.id, { action: 'done' }) }} className="text-[11px] px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 font-bold">잔금 정산 끝 (완납 처리)</button>
                        : i.doneManual && <button disabled={busy} onClick={() => act(i.id, { action: 'undo' })} className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 font-bold">완납 표시 되돌리기</button>}
                      <button disabled={busy} onClick={() => { const v = prompt('업무 세팅 완료일 (YYYY-MM-DD) — 이 날부터 90일이 잔금 기한입니다', i.setupDate || ''); if (v !== null) act(i.id, { action: 'edit', setupDate: v.trim(), due: '' }) }} className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500">세팅일 수정</button>
                      <button disabled={busy} onClick={() => { const v = prompt('잔금 기한을 직접 정합니다 (YYYY-MM-DD, 서면 합의로 조정한 경우)', i.due || ''); if (v !== null) act(i.id, { action: 'edit', due: v.trim() }) }} className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500">기한 조정</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
