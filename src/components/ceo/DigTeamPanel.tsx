'use client'

import { useEffect, useState } from 'react'
import { isTester } from '@/lib/tester'
import { bizDays, digPersonStats, digPay, selfSupplyStats, DIG_DAILY_GOAL, type DigPerson, type SelfStat } from '@/lib/digStats'

const NAVY = '#0b2140'
const won = (v: number) => Math.round(v).toLocaleString('ko-KR') + '원'
const man = (v: number) => (v >= 100000000 ? parseFloat((v / 100000000).toFixed(2)) + '억' : Math.round(v / 10000).toLocaleString('ko-KR') + '만')

/** 전체현황 — 영업팀·관리팀 아래 발굴팀 현황 */
export default function DigTeamPanel({ month, customers }: { month: string; customers: any[] }) {
  const [people, setPeople] = useState<DigPerson[] | null>(null)
  const biz = bizDays(month)
  const goalEach = biz.total * DIG_DAILY_GOAL

  useEffect(() => {
    let live = true
    Promise.all([
      fetch('/api/dig-prospects?status=all').then(r => r.json()).catch(() => ({})),
      fetch('/api/users?role=dig').then(r => r.json()).catch(() => ({})),
    ]).then(([p, u]) => {
      if (!live) return
      const names: string[] = (u.users || []).filter((x: any) => x.name && !isTester(x.name, x.username)).map((x: any) => x.name)
      setPeople(digPersonStats(p.prospects || [], month, names))
    })
    return () => { live = false }
  }, [month])

  const self: Record<string, SelfStat> = selfSupplyStats(customers, month)
  const selfSupplied = Object.values(self).reduce((s, v) => s + v.supplied, 0)
  const selfPaid = Object.values(self).reduce((s, v) => s + v.paid, 0)
  const selfRev = Object.values(self).reduce((s, v) => s + v.revenue, 0)
  const selfRate = selfSupplied > 0 ? selfPaid / selfSupplied * 100 : null

  if (!people) return null
  const approved = people.reduce((s, p) => s + p.approvedMonth, 0)
  const goal = goalEach * Math.max(1, people.length)
  const pending = people.reduce((s, p) => s + p.pending, 0)
  const rejected = people.reduce((s, p) => s + p.rejected, 0)

  return (
    <section>
      <div className="mb-4">
        <h3 className="text-[19px] font-black text-[#0b2140]">발굴팀 <span className="text-[14px] font-semibold text-gray-400 ml-1">{month.replace('-', '년 ')}월</span></h3>
        <p className="text-[13px] text-gray-500 mt-0.5">승인 개수 · 목표 대비 · 영업팀에 넘긴 자체공급의 결제 현황 (영업일 {biz.total}일 · 남은 {biz.remaining}일)</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-3xl p-4 text-white bg-gradient-to-br from-[#10203a] to-[#0a1424]">
          <p className="text-[13px] text-white/60 font-semibold">이번 달 승인</p>
          <p className="text-[28px] leading-tight font-black text-[#E8D080] tabular-nums mt-1">{approved}<span className="text-[15px] text-white/50"> / {goal}개</span></p>
          <p className="text-[12.5px] text-white/50 mt-0.5">목표 = {people.length || 0}명 × 영업일 {biz.total} × {DIG_DAILY_GOAL}</p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13px] text-amber-700 font-semibold">심사 대기</p>
          <p className="text-[28px] leading-tight font-black text-amber-800 tabular-nums mt-1">{pending}<span className="text-[15px] text-amber-500 font-semibold"> 건</span></p>
          <p className="text-[12.5px] text-amber-700/70 mt-0.5">부결 {rejected}건</p>
        </div>
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[13px] text-emerald-700 font-semibold">영업팀에 넘긴 자체공급</p>
          <p className="text-[28px] leading-tight font-black text-emerald-800 tabular-nums mt-1">{selfSupplied}<span className="text-[15px] text-emerald-500 font-semibold"> 개</span></p>
          <p className="text-[12.5px] text-emerald-700/70 mt-0.5">결제 {selfPaid % 1 === 0 ? selfPaid : selfPaid.toFixed(1)}건 · 매출 {man(selfRev)}</p>
        </div>
        <div className="rounded-3xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-[13px] text-sky-700 font-semibold">자체공급 결제율</p>
          <p className="text-[28px] leading-tight font-black text-sky-800 tabular-nums mt-1">{selfRate !== null ? selfRate.toFixed(1) + '%' : '—'}</p>
          <p className="text-[12.5px] text-sky-700/70 mt-0.5">결제 ÷ 넘긴 개수</p>
        </div>
      </div>

      {people.length === 0 ? (
        <p className="text-[13.5px] text-gray-400 text-center py-3">발굴팀 직원이 아직 없어요 (직원 관리에서 추가)</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {people.map(p => {
            const pct = goalEach > 0 ? Math.round(p.approvedMonth / goalEach * 100) : 0
            const left = Math.max(0, goalEach - p.approvedMonth)
            const perDay = biz.remaining > 0 ? Math.ceil(left / biz.remaining) : left
            const pay = digPay(p.approvedMonth, biz.total)
            return (
              <div key={p.name} className="rounded-3xl border border-gray-100 bg-white shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#10203a] to-[#0a1424] text-[#E8D080] flex items-center justify-center text-lg font-black shrink-0">{(p.name || '?').charAt(0)}</div>
                    <p className="text-[19px] font-black truncate" style={{ color: NAVY }}>{p.name}</p>
                  </div>
                  <span className={`text-[13px] font-bold px-3 py-1 rounded-full ${p.approvedToday >= DIG_DAILY_GOAL ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>오늘 {p.approvedToday}/{DIG_DAILY_GOAL}</span>
                </div>
                <div>
                  <div className="flex items-end justify-between">
                    <p className="text-[34px] leading-none font-black tabular-nums" style={{ color: NAVY }}>{p.approvedMonth}<span className="text-[16px] font-semibold text-gray-400"> / {goalEach}개</span></p>
                    <p className="text-[26px] leading-none font-black tabular-nums" style={{ color: pct >= 100 ? '#12805c' : pct >= 60 ? NAVY : '#c0392b' }}>{pct}%</p>
                  </div>
                  <div className="h-3 rounded-full bg-gray-100 overflow-hidden mt-3">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: pct >= 100 ? '#12805c' : 'linear-gradient(90deg,#0b2140,#b8995a)' }} />
                  </div>
                  <p className="text-[13px] text-gray-500 mt-2">
                    {left > 0 ? <>목표까지 <b className="text-[#0b2140]">{left}개</b> · 남은 {biz.remaining}영업일 기준 하루 <b className="text-[#a8873f]">{perDay}개</b></> : '이번 달 목표 달성 🎉'}
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[['대기', p.pending], ['부결', p.rejected], ['영업 배정', p.assigned], ['예상 급여', man(pay)]].map(([l, v]) => (
                    <div key={String(l)} className="rounded-xl bg-gray-50 border border-gray-100 py-2">
                      <p className="text-[11.5px] text-gray-500 font-semibold">{l}</p>
                      <p className="text-[15px] font-black tabular-nums" style={{ color: NAVY }}>{v}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11.5px] text-gray-400">예상 급여 = 기본급 210만 + 월 {goalEach}개 초과분 1개당 1만원 ({won(pay)})</p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
