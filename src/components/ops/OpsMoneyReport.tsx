'use client'

// 관리팀 마감보고 — "돈 나올 곳"만 본다 (2026-11-25 대표 지시)
//  · 접수 몇 개 / 실사대기 몇 개 / 승인 전 몇 개 + 나올 것 같은 곳 목록
//  · 이번주 예상 매출 / 이번달 예상 매출 (예상 금액 입력 + 잔금 도래분 자동 합산)
//  · 큰건(매출 규모가 큰 건)은 따로 "큰건 진행" 탭에서 진행 상황을 적는다
//  · 그 밖의 이슈·특이사항은 받지 않는다
import { useEffect, useMemo, useState } from 'react'

type Case = any
type Expect = { on?: boolean; amount?: number; when?: 'week' | 'month' | 'later'; at?: string }
type BigNote = { at: string; by: string; text: string }

const nameOf = (c: Case) => c.customers?.details?.company || c.customers?.company || c.customers?.name || '—'
const num = (v: string) => parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0
const fmt = (n: number) => (n ? n.toLocaleString('ko-KR') : '')
const man = (n: number) => (n >= 10000 ? `${Math.round(n / 10000).toLocaleString('ko-KR')}만원` : `${n.toLocaleString('ko-KR')}원`)
const kst = () => new Date(Date.now() + 9 * 3600 * 1000)
const ymd = (d: Date) => d.toISOString().slice(0, 10)
function ranges() {
  const t = kst(); const day = (t.getUTCDay() + 6) % 7   // 월=0
  const ws = new Date(t.getTime() - day * 86400000), we = new Date(ws.getTime() + 6 * 86400000)
  const ms = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1)), me = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0))
  return { today: ymd(t), ws: ymd(ws), we: ymd(we), ms: ymd(ms), me: ymd(me) }
}
const stagesOf = (c: Case): string[] => [c.details?.direct_stage || '', c.details?.indirect_stage || '']
const has = (c: Case, keys: string[]) => stagesOf(c).some(s => keys.includes(s))
const G_RECEIPT = ['접수', '신청완료', '반려보정']
const G_INSPECT = ['실사대기']
const G_BEFORE_OK = ['실사완료', '승인대기']
const G_PAY = ['입금전']

export default function OpsMoneyReport({ userName, activeCases, onSaveDetails }: {
  userId: string; userName: string; activeCases: Case[]
  onSaveDetails: (id: string, patch: Record<string, any>) => void
}) {
  const R = useMemo(ranges, [])
  const [sub, setSub] = useState<'daily' | 'big'>('daily')
  const [bal, setBal] = useState<{ week: number; month: number; items: any[] }>({ week: 0, month: 0, items: [] })
  const [submitted, setSubmitted] = useState<string>('')   // 오늘 제출한 시각
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [local, setLocal] = useState<Record<string, Expect>>({})
  const [bigDraft, setBigDraft] = useState<Record<string, string>>({})
  const [bigAdd, setBigAdd] = useState('')
  const [bigQ, setBigQ] = useState('')

  const receipt = activeCases.filter(c => has(c, G_RECEIPT))
  const inspect = activeCases.filter(c => has(c, G_INSPECT))
  const beforeOk = activeCases.filter(c => has(c, G_BEFORE_OK))
  const pay = activeCases.filter(c => has(c, G_PAY))
  const cand = activeCases.filter(c => has(c, [...G_RECEIPT, ...G_INSPECT, ...G_BEFORE_OK, ...G_PAY]))
  const ex = (c: Case): Expect => local[c.id] ?? c.details?.expect ?? {}

  useEffect(() => {
    fetch('/api/balances', { cache: 'no-store' }).then(r => r.json()).then(j => {
      const items = (j.items || []).filter((i: any) => !i.done && i.remaining > 0 && i.due)
      const sum = (a: string, b: string) => items.filter((i: any) => i.due >= a && i.due <= b).reduce((s: number, i: any) => s + i.remaining, 0)
      setBal({ week: sum(R.today, R.we), month: sum(R.today, R.me), items })
    }).catch(() => {})
    fetch('/api/reports', { cache: 'no-store' }).then(r => r.json()).then(j => {
      const mine = (j.reports || []).find((r: any) => r.report_type === 'ops_daily' && r.report_date === R.today)
      if (mine) setSubmitted(String(mine.updated_at || mine.created_at || '').slice(11, 16))
    }).catch(() => {})
  }, [R])

  function setEx(c: Case, patch: Expect, save = true) {
    const next = { ...ex(c), ...patch, at: new Date().toISOString() }
    setLocal(p => ({ ...p, [c.id]: next }))
    if (save) onSaveDetails(c.id, { expect: next })
  }
  const exs = cand.map(c => ({ c, e: ex(c) })).filter(x => x.e.on && (x.e.amount || 0) > 0)
  const expectWeek = exs.filter(x => x.e.when === 'week').reduce((s, x) => s + (x.e.amount || 0), 0)
  const expectMonth = exs.filter(x => x.e.when === 'week' || x.e.when === 'month').reduce((s, x) => s + (x.e.amount || 0), 0)
  const weekTotal = expectWeek + bal.week
  const monthTotal = expectMonth + bal.month

  async function submit() {
    setBusy(true); setMsg('')
    const data = {
      auto_stats: {
        receipt_count: receipt.length, receipt_names: receipt.map(nameOf),
        real_insp_count: inspect.length, real_insp_names: inspect.map(nameOf),
        approval_count: beforeOk.length, approval_names: beforeOk.map(nameOf),
        payment_count: pay.length, payment_names: pay.map(nameOf),
      },
      expectations: exs.map(x => ({ caseId: x.c.id, company: nameOf(x.c), institution: x.c.institution || '', amount: x.e.amount || 0, when: x.e.when || 'month' })),
      expected_week: weekTotal, expected_month: monthTotal, balance_week: bal.week, balance_month: bal.month,
      big_cases: activeCases.filter(c => c.details?.big?.on).map(c => ({ company: nameOf(c), size: c.details.big.size || 0, last_note: (c.details.big.notes || []).slice(-1)[0]?.text || '' })),
      special_notes: '', form_version: 'money-v1',
    }
    try {
      const res = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report_type: 'ops_daily', report_date: R.today, data }) })
      if (res.ok) { setSubmitted(kst().toISOString().slice(11, 16)); setMsg('마감보고가 제출되었습니다.') } else setMsg('제출에 실패했습니다. 다시 눌러 주세요.')
    } catch { setMsg('네트워크 오류로 제출하지 못했습니다.') }
    setBusy(false)
  }

  // ── 큰건 ──
  const bigCases = activeCases.filter(c => c.details?.big?.on)
  function addBigNote(c: Case) {
    const text = (bigDraft[c.id] || '').trim(); if (!text) return
    const big = c.details?.big || {}
    const notes: BigNote[] = [...(big.notes || []), { at: new Date().toISOString(), by: userName, text }]
    onSaveDetails(c.id, { big: { ...big, on: true, notes } })
    setBigDraft(p => ({ ...p, [c.id]: '' }))
  }
  const card = 'rounded-xl border border-gray-100 bg-white'
  const chip = (on: boolean) => `px-3 py-1.5 rounded-lg text-xs font-bold border ${on ? 'bg-[#1B2A45] text-white border-[#1B2A45]' : 'bg-white text-gray-500 border-gray-200'}`
  const Stat = ({ label, cases }: { label: string; cases: Case[] }) => (
    <div className="rounded-xl bg-white/10 px-3 py-2.5">
      <p className="text-white/60 text-[11px] font-bold">{label}</p>
      <p className="text-white font-black text-2xl leading-tight">{cases.length}<span className="text-sm font-bold ml-0.5">개</span></p>
      <div className="flex flex-wrap gap-1 mt-1">
        {cases.slice(0, 5).map(c => <span key={c.id} className="text-[10px] bg-white/20 text-white rounded px-1.5 py-0.5 truncate max-w-[92px]">{nameOf(c)}</span>)}
        {cases.length > 5 && <span className="text-[10px] text-white/50">+{cases.length - 5}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex gap-2">
        <button type="button" className={chip(sub === 'daily')} onClick={() => setSub('daily')}>마감보고</button>
        <button type="button" className={chip(sub === 'big')} onClick={() => setSub('big')}>큰건 진행 {bigCases.length > 0 && `(${bigCases.length})`}</button>
        {submitted && <span className="ml-auto self-center text-xs font-bold text-emerald-600">✅ 오늘 마감보고 제출함 · {submitted}</span>}
        {!submitted && <span className="ml-auto self-center text-xs font-bold text-red-500">⚠ 오늘 마감보고 아직 안 냄</span>}
      </div>

      {sub === 'daily' && (<>
        <div className="rounded-xl bg-gradient-to-r from-[#1B2A45] to-violet-800 px-4 py-4 text-white">
          <div className="flex items-center justify-between mb-3"><h3 className="font-black text-sm">돈 나올 곳 현황</h3><span className="text-white/50 text-xs">{R.today} · {userName}</span></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="접수" cases={receipt} />
            <Stat label="실사대기" cases={inspect} />
            <Stat label="자금 승인 전" cases={beforeOk} />
            <Stat label="입금 전(승인됨)" cases={pay} />
          </div>
        </div>

        <div className={card + ' overflow-hidden'}>
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-black text-[#1B2A45]">나올 것 같은 곳 <span className="font-normal text-gray-400 text-xs">· 체크하고 예상 금액(우리 매출)·시기를 적으세요. 내일도 그대로 남아 있습니다.</span></p>
          </div>
          {cand.length === 0 && <p className="px-4 py-6 text-sm text-gray-400">접수 이후 진행 중인 업체가 없습니다.</p>}
          <div className="divide-y divide-gray-50">
            {cand.map(c => {
              const e = ex(c)
              const st = stagesOf(c).filter(Boolean).join(' / ')
              return (
                <div key={c.id} className="px-4 py-2.5 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 min-w-[190px] flex-1">
                    <input type="checkbox" checked={!!e.on} onChange={ev => setEx(c, { on: ev.target.checked, when: e.when || 'month' })} className="w-4 h-4" />
                    <span className="text-[13px] font-bold text-[#1B2A45] truncate">{nameOf(c)}</span>
                    <span className="text-[11px] text-gray-400 truncate">{c.institution || '기관 미정'} · {st}</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input disabled={!e.on} value={fmt(e.amount || 0)} inputMode="numeric" placeholder="예상 금액"
                      onChange={ev => setEx(c, { amount: num(ev.target.value) }, false)} onBlur={() => onSaveDetails(c.id, { expect: ex(c) })}
                      className="w-32 text-right tabular-nums border border-gray-200 rounded-lg px-2 py-1.5 text-sm disabled:bg-gray-50" />
                    <span className="text-xs text-gray-400">원</span>
                  </div>
                  <div className="flex gap-1">
                    {([['week', '이번주'], ['month', '이번달'], ['later', '그 이후']] as const).map(([k, l]) => (
                      <button key={k} type="button" disabled={!e.on} onClick={() => setEx(c, { when: k })}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold border ${e.when === k && e.on ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-400 border-gray-200'} disabled:opacity-40`}>{l}</button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-xl bg-[#0f1f3d] px-4 py-4 text-white">
          <p className="text-sm font-black mb-2">예상 매출</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[['이번주', weekTotal, expectWeek, bal.week, `${R.ws.slice(5)} ~ ${R.we.slice(5)}`], ['이번달', monthTotal, expectMonth, bal.month, `${R.ms.slice(5)} ~ ${R.me.slice(5)}`]].map(([l, tot, e, b, rg]) => (
              <div key={String(l)} className="rounded-xl bg-white/10 px-4 py-3">
                <p className="text-white/60 text-[11px] font-bold">{l} 예상 매출 <span className="font-normal">({rg})</span></p>
                <p className="text-2xl font-black text-amber-300 tabular-nums">{man(Number(tot))}</p>
                <p className="text-[11px] text-white/60 mt-1">나올 곳 {man(Number(e))} + 잔금 도래 {man(Number(b))}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/40 mt-2">잔금 도래분은 "잔금 관리"에서 자동으로 합산됩니다(아직 못 받은 잔금 중 기한이 이번주·이번달인 것).</p>
        </div>

        {msg && <p className="text-sm font-bold text-violet-700">{msg}</p>}
        <button type="button" disabled={busy} onClick={submit} className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-black py-3.5 rounded-2xl text-sm">
          {busy ? '제출 중…' : submitted ? '마감보고 다시 제출(수정)' : '마감보고 제출'}
        </button>
        <p className="text-[11px] text-gray-400 text-center">이 보고에는 위 숫자만 들어갑니다. 그 밖의 이슈는 적지 않아도 됩니다.</p>
      </>)}

      {sub === 'big' && (
        <div className="space-y-3">
          <div className={card + ' px-4 py-3'}>
            <p className="text-sm font-black text-[#1B2A45] mb-1">큰건 추가 <span className="font-normal text-xs text-gray-400">· 매출 규모가 큰 업체를 골라 진행 상황을 따로 적습니다</span></p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input value={bigQ} onChange={e => { setBigQ(e.target.value); setBigAdd(''); setBigQ('') }} placeholder="업체명 검색 (일부만 쳐도 됩니다)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                {bigQ.trim() && !bigAdd && (
                  <div className="absolute z-20 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {activeCases.filter(c => !c.details?.big?.on && nameOf(c).replace(/s/g, '').toLowerCase().includes(bigQ.trim().replace(/s/g, '').toLowerCase())).slice(0, 12).map(c => (
                      <button key={c.id} type="button" onClick={() => { setBigAdd(c.id); setBigQ(nameOf(c)) }} className="block w-full text-left px-3 py-2 text-sm hover:bg-violet-50">{nameOf(c)}</button>
                    ))}
                    {!activeCases.some(c => !c.details?.big?.on && nameOf(c).replace(/s/g, '').toLowerCase().includes(bigQ.trim().replace(/s/g, '').toLowerCase())) && <p className="px-3 py-2 text-xs text-gray-400">맞는 업체가 없습니다</p>}
                  </div>
                )}
              </div>
              <button type="button" disabled={!bigAdd} onClick={() => { const c = activeCases.find(x => x.id === bigAdd); if (c) onSaveDetails(c.id, { big: { ...(c.details?.big || {}), on: true, notes: c.details?.big?.notes || [] } }); setBigAdd('') }}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-bold disabled:opacity-40">큰건으로 등록</button>
            </div>
          </div>
          {bigCases.length === 0 && <p className="text-sm text-gray-400 px-1">등록된 큰건이 없습니다.</p>}
          {bigCases.map(c => {
            const big = c.details.big; const notes: BigNote[] = [...(big.notes || [])].reverse()
            return (
              <div key={c.id} className={card + ' px-4 py-3 space-y-2'}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-[#1B2A45]">{nameOf(c)}</p>
                  <span className="text-[11px] text-gray-400">{c.institution || '기관 미정'} · {stagesOf(c).filter(Boolean).join(' / ') || '단계 미정'}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <span className="text-xs text-gray-400">매출 규모</span>
                    <input defaultValue={fmt(big.size || 0)} inputMode="numeric" onBlur={e => onSaveDetails(c.id, { big: { ...big, size: num(e.target.value) } })}
                      className="w-28 text-right tabular-nums border border-gray-200 rounded-lg px-2 py-1 text-sm" /><span className="text-xs text-gray-400">원</span>
                    <button type="button" onClick={() => { if (confirm('큰건 목록에서 뺄까요? (기록은 남아 있습니다)')) onSaveDetails(c.id, { big: { ...big, on: false } }) }} className="ml-2 text-[11px] text-gray-400 hover:text-red-500">빼기</button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <textarea rows={2} value={bigDraft[c.id] || ''} onChange={e => setBigDraft(p => ({ ...p, [c.id]: e.target.value }))} placeholder="오늘 진행 상황을 적어 주세요 (어디까지 됐고, 다음에 뭐가 남았는지)" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <button type="button" onClick={() => addBigNote(c)} className="px-4 rounded-lg bg-[#1B2A45] text-white text-sm font-bold">기록</button>
                </div>
                {notes.length > 0 && (
                  <ul className="space-y-1">
                    {notes.slice(0, 5).map((n, i) => (
                      <li key={i} className="text-[12px] text-gray-700 bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-gray-400">{new Date(n.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {n.by}</span><br />{n.text}</li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
