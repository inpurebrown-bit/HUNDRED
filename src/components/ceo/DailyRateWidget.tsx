'use client'

/**
 * 결제율 일일 현황 위젯
 * - 전체현황 탭에 삽입되는 컴팩트 패널
 * - 날짜 선택 없이 오늘 자동 사용
 * - TESTER 제외
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { getElapsedBusinessDays } from '@/lib/businessDays'

const TESTER = 'TESTER'

function todayStr() { return new Date().toISOString().slice(0, 10) }

function calcWorkingDays(dateStr: string) {
  const d = new Date(dateStr)
  const year = d.getFullYear(), month = d.getMonth()
  let total = 0, elapsed = 0
  for (let day = new Date(year, month, 1); day <= new Date(year, month + 1, 0); day.setDate(day.getDate() + 1)) {
    const dow = day.getDay()
    if (dow !== 0 && dow !== 6) { total++; if (day <= d) elapsed++ }
  }
  return { total, elapsed }
}

interface EmpRow {
  name: string
  target: number
  supply_count: number
  supply_payment: number
  direct_count: number
  direct_payment: number
}

const mkRow = (name = ''): EmpRow => ({ name, target: 0, supply_count: 0, supply_payment: 0, direct_count: 0, direct_payment: 0 })

export default function DailyRateWidget() {
  const today  = todayStr()
  const now    = new Date()
  const { total: tw, elapsed: we } = calcWorkingDays(today)
  const bizEl  = getElapsedBusinessDays(now.getFullYear(), now.getMonth(), now.getDate())

  const [targetCount,  setTargetCount]  = useState(0)
  const [paymentCount, setPaymentCount] = useState(0)  // auto
  const [employees,    setEmployees]    = useState<EmpRow[]>([])
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState('')
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestState   = useRef({ targetCount, employees, paymentCount, we, tw })

  useEffect(() => {
    async function load() {
      const [payRes, custRes, userRes] = await Promise.all([
        fetch(`/api/payrate?date=${today}`),
        fetch('/api/customers'),
        fetch('/api/users?role=sales'),
      ])
      const [payJson, custJson, userJson] = await Promise.all([
        payRes.json(), custRes.json(), userRes.json()
      ])

      // 영업팀 사람 목록 (TESTER 제외)
      const people: string[] = (userJson.users || [])
        .filter((u: any) => u.name && u.name !== TESTER)
        .map((u: any) => u.name as string)

      // 이번달 계약 수 자동집계 (TESTER 제외)
      const month = today.slice(0, 7)
      const total = (custJson.customers || []).filter((c: any) =>
        c.status === 'contracted' &&
        (c.details?.contract_date || c.created_at || '').startsWith(month) &&
        (c.details?.sales_user_name || '').trim() !== TESTER
      ).length
      setPaymentCount(total)

      // 결제율 레코드
      if (payJson.record) {
        const r = payJson.record
        setTargetCount(r.target_count ?? 0)
        const saved = (r.employee_details || []).filter((e: EmpRow) => e.name !== TESTER)
        setEmployees(saved.length > 0 ? saved : people.map(mkRow))
      } else {
        setEmployees(people.map(mkRow))
      }
    }
    load().catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // latestState 항상 최신값으로 유지
  useEffect(() => {
    latestState.current = { targetCount, employees, paymentCount, we, tw }
  }, [targetCount, employees, paymentCount, we, tw])

  const doSave = useCallback(async (silent = false) => {
    const s = latestState.current
    if (!silent) { setSaving(true); setMsg('') }
    const res = await fetch('/api/payrate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today,
        employee_count: s.employees.length,
        target_count: s.targetCount,
        payment_count: s.paymentCount,
        working_days_elapsed: s.we,
        total_working_days: s.tw,
        employee_details: s.employees,
      }),
    })
    const json = await res.json()
    if (!silent) {
      setMsg(json.record ? '저장 완료' : '저장 실패')
      setSaving(false)
      setTimeout(() => setMsg(''), 3000)
    } else {
      if (json.record) setMsg('자동저장 ✓')
      setTimeout(() => setMsg(''), 2000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])

  // 값 변경 시 2초 후 자동저장
  function scheduleAutoSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => doSave(true), 2000)
  }

  function upd(i: number, f: keyof EmpRow, v: number | string) {
    setEmployees(prev => {
      const n = [...prev]
      n[i] = { ...n[i], [f]: f === 'name' ? v : Number(v) }
      return n
    })
    scheduleAutoSave()
  }

  function setTargetCountAndSave(v: number) {
    setTargetCount(v)
    scheduleAutoSave()
  }

  async function save() { await doSave(false) }

  // 영업일 기준 계산
  const remaining = tw - we
  const paceOk    = we > 0 && tw > 0 && paymentCount / we >= targetCount / tw

  // 직원별 합계
  const totPay = employees.reduce((s, r) => s + Number(r.supply_payment) + Number(r.direct_payment), 0)
  const totSup = employees.reduce((s, r) => s + Number(r.supply_count), 0)

  const iCls = `w-full text-center text-sm font-bold text-gray-700 bg-white rounded-lg border border-gray-200
    px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300
    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`

  return (
    <div className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-[#E8E2D4] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-[#1B2A45] text-base">📈 결제율 현황</h2>
          <span className="text-[10px] text-[#1B2A45]/30">{today}</span>
        </div>
        <div className="flex items-center gap-2">
          {msg && <span className={`text-xs font-medium ${msg.includes('완료') ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</span>}
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 bg-[#1B2A45] hover:bg-[#263d66] text-white text-xs font-bold rounded-lg disabled:opacity-40 transition-colors">
            {saving ? '저장중…' : '💾 저장'}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── 영업일 기준 요약 ── */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* 목표 (수정 가능) */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] text-gray-400">목표</span>
            <input type="number" value={targetCount} min={0}
              onChange={e => setTargetCountAndSave(Number(e.target.value))}
              className="w-10 text-center text-sm font-black text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[10px] text-gray-400">개</span>
          </div>

          {/* 결제 (자동) */}
          <div className="flex items-center gap-1 bg-emerald-50 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] text-emerald-600">결제</span>
            <span className="text-sm font-black text-emerald-700">{paymentCount}</span>
            <span className="text-[10px] text-emerald-500">개</span>
            <span className="text-[9px] bg-emerald-200 text-emerald-700 rounded-full px-1 font-semibold">자동</span>
          </div>

          {/* 영업일 */}
          <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] text-gray-400">영업일</span>
            <span className="text-sm font-bold text-gray-700">{we}<span className="text-gray-400 font-normal">/{tw}일</span></span>
            <span className="text-[10px] text-gray-400">잔여 {remaining}일</span>
          </div>

          {/* 진행상태 */}
          {we > 0 && tw > 0 && (
            <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
              paceOk ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
            }`}>{paceOk ? 'GOOD' : 'BAD'}</span>
          )}

          {/* 인당 하루 */}
          {employees.length > 0 && we > 0 && (
            <div className="ml-auto flex items-center gap-1 text-[10px] text-gray-400">
              <span>인당하루</span>
              <span className="font-bold text-gray-600">
                {(paymentCount / we / employees.length).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* ── 직원별 ── */}
        {employees.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">영업팀 직원 없음</p>
        ) : (
          <div className="space-y-2">
            {/* 헤더 */}
            <div className="grid gap-1.5 text-[10px] text-gray-400 font-medium px-1"
              style={{ gridTemplateColumns: '80px repeat(5,1fr) 44px 52px' }}>
              <span>직원</span>
              <span className="text-center">목표</span>
              <span className="text-center">공급수</span>
              <span className="text-center">공급결제</span>
              <span className="text-center">직접수</span>
              <span className="text-center">직접결제</span>
              <span className="text-center text-emerald-500">총결제</span>
              <span className="text-center text-blue-500">공급율</span>
            </div>

            {employees.filter(r => r.name !== TESTER).map((row, i) => {
              const total      = Number(row.supply_payment) + Number(row.direct_payment)
              const supplyRate = Number(row.supply_count) > 0
                ? (total / Number(row.supply_count) * 100).toFixed(1) + '%' : '—'
              return (
                <div key={i} className="grid gap-1.5 items-center"
                  style={{ gridTemplateColumns: '80px repeat(5,1fr) 44px 52px' }}>
                  {/* 이름 */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-[#1B2A45]/10 text-[#1B2A45] flex items-center justify-center text-[10px] font-bold shrink-0">
                      {(row.name || '?').charAt(0)}
                    </div>
                    <span className="text-xs font-semibold text-gray-700 truncate">{row.name}</span>
                  </div>
                  {/* 5개 입력 */}
                  {(['target','supply_count','supply_payment','direct_count','direct_payment'] as (keyof EmpRow)[]).map(f => (
                    <input key={f} type="number" min={0} value={row[f] as number}
                      onChange={e => upd(i, f, Number(e.target.value))}
                      className={iCls}
                    />
                  ))}
                  {/* 총결제 */}
                  <div className="text-center">
                    <span className="text-sm font-black text-emerald-600">{total}</span>
                  </div>
                  {/* 공급율 */}
                  <div className={`text-center text-xs font-bold ${
                    supplyRate === '—' ? 'text-gray-300' :
                    parseFloat(supplyRate) >= 17 ? 'text-emerald-600' :
                    parseFloat(supplyRate) >= 13 ? 'text-amber-600' : 'text-red-500'
                  }`}>{supplyRate}</div>
                </div>
              )
            })}

            {/* 합계 */}
            {employees.length > 1 && (
              <div className="border-t border-gray-100 pt-2 flex items-center justify-end gap-4 text-xs">
                <span className="text-gray-400">합계</span>
                <span className="font-black text-emerald-600">{totPay}건</span>
                <span className={`font-black ${
                  totSup > 0 ? (totPay / totSup * 100 >= 17 ? 'text-emerald-600' : totPay / totSup * 100 >= 13 ? 'text-amber-600' : 'text-red-500') : 'text-gray-400'
                }`}>
                  {totSup > 0 ? (totPay / totSup * 100).toFixed(1) + '%' : '—'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
