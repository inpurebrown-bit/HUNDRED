'use client'

import { useState, useEffect, useMemo } from 'react'
import { calcRecommendedSupply, contractWeight } from '@/lib/supplyRules'
import { getElapsedBusinessDays } from '@/lib/businessDays'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface PersonSupply { supplied: number; goal: number; base: number }
type SupplyConfig = Record<string, PersonSupply>

interface EmployeeRow {
  name: string
  target: number
  supply_count: number
  supply_payment: number
  direct_count: number
  direct_payment: number
}

interface SalesEmp { name: string; sales_vat_incl: number; contracts: number }
interface OpsEmp   { name: string; fee_vat_incl: number; contract_vat_incl: number }
interface OtherCost {
  ad_marketing: number; db: number; rent: number
  mgmt: number; sales_fixed: number; sales_other: number
}

// ── 상수 ──────────────────────────────────────────────────────────────────────
const TESTER = 'TESTER'

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────
function todayStr()     { return new Date().toISOString().slice(0, 10) }
function thisMonthStr() { return new Date().toISOString().slice(0, 7) }

function calcWorkingDays(dateStr: string): { total: number; elapsed: number } {
  const d     = new Date(dateStr)
  const year  = d.getFullYear()
  const month = d.getMonth()
  let total = 0, elapsed = 0
  for (let day = new Date(year, month, 1); day <= new Date(year, month + 1, 0); day.setDate(day.getDate() + 1)) {
    const dow = day.getDay()
    if (dow !== 0 && dow !== 6) { total++; if (day <= d) elapsed++ }
  }
  return { total, elapsed }
}

function fmtN(n: number, dec = 2): string {
  if (!isFinite(n)) return '-'
  return Number.isInteger(n) || dec === 0 ? n.toLocaleString('ko-KR') : n.toFixed(dec)
}

function calcScore(actual: number, actualDays: number, target: number, totalDays: number): number {
  if (actualDays === 0 || totalDays === 0 || target === 0) return 0
  const pace = (actual / actualDays) / (target / totalDays)
  return Math.min(10, Math.max(1, Math.round(pace * 5)))
}

// ── 공통 컴포넌트 ──────────────────────────────────────────────────────────────
function PaceBadge({ status, score }: { status: string; score?: number }) {
  if (status === '-' || !status) return <span className="text-gray-300 text-xs">—</span>
  const isGood = status === 'GOOD'
  return (
    <div className="flex items-center gap-1.5">
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide ${
        isGood ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
      }`}>{status}</span>
      {score !== undefined && score > 0 && (
        <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
          score >= 9 ? 'bg-emerald-100 text-emerald-700' :
          score >= 7 ? 'bg-blue-100 text-blue-700' :
          score >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
        }`}>{score}</span>
      )}
    </div>
  )
}

// ── 깔끔한 숫자 입력 ──────────────────────────────────────────────────────────
function NumInput({
  label, value, onChange, unit = '',
  color = 'gray', auto = false, size = 'md',
}: {
  label: string; value: number | string; onChange?: (v: number) => void
  unit?: string; color?: string; auto?: boolean; size?: 'sm' | 'md' | 'lg'
}) {
  const bg = {
    gray:    'bg-slate-50',
    green:   'bg-emerald-50',
    blue:    'bg-blue-50',
    sky:     'bg-sky-50',
    amber:   'bg-amber-50',
    white:   'bg-white border border-gray-100',
    editable: 'bg-white border-2 border-gray-100 hover:border-blue-300 transition-colors',
  }[color] || 'bg-slate-50'

  const textColor = {
    gray:    'text-slate-800',
    green:   'text-emerald-700',
    blue:    'text-blue-700',
    sky:     'text-sky-700',
    amber:   'text-amber-700',
    white:   'text-gray-800',
    editable: 'text-gray-800',
  }[color] || 'text-slate-800'

  const labelColor = {
    gray:    'text-slate-400',
    green:   'text-emerald-500',
    blue:    'text-blue-500',
    sky:     'text-sky-500',
    amber:   'text-amber-500',
    white:   'text-gray-400',
    editable: 'text-gray-400',
  }[color] || 'text-slate-400'

  const numSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-xl'
  const inputW  = size === 'lg' ? 'w-20' : size === 'sm' ? 'w-12' : 'w-16'

  return (
    <div className={`rounded-2xl px-3 py-2.5 flex flex-col items-center gap-0.5 ${bg}`}>
      <p className={`text-[10px] font-medium uppercase tracking-wide ${labelColor}`}>{label}</p>
      {auto || !onChange ? (
        <p className={`${numSize} font-black ${textColor} leading-tight`}>
          {typeof value === 'number' ? fmtN(value) : value}
          {unit && <span className={`text-xs font-normal ml-0.5 opacity-60`}>{unit}</span>}
        </p>
      ) : (
        <div className="flex items-baseline gap-0.5">
          <input
            type="number" min={0} value={value}
            onChange={e => onChange(Number(e.target.value))}
            className={`${inputW} ${numSize} font-black ${textColor} text-center bg-transparent
              border-b-2 border-current/20 focus:border-current focus:outline-none
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          />
          {unit && <span className={`text-xs font-normal opacity-60 ${textColor}`}>{unit}</span>}
        </div>
      )}
      {auto && <span className="text-[9px] bg-white/70 text-current opacity-70 rounded-full px-1.5 py-0.5 font-semibold">자동</span>}
    </div>
  )
}

// ── 직원 입력 카드 ─────────────────────────────────────────────────────────────
function EmpCard({
  row, idx, we, tw,
  onChange, onRemove,
}: {
  row: EmployeeRow; idx: number; we: number; tw: number
  onChange: (i: number, f: keyof EmployeeRow, v: number | string) => void
  onRemove: (i: number) => void
}) {
  const total     = Number(row.supply_payment) + Number(row.direct_payment)
  const supplyTot = Number(row.supply_count)   + Number(row.direct_count)
  const supplyRate = Number(row.supply_count) > 0
    ? (total / Number(row.supply_count) * 100) : null
  const totalRate  = supplyTot > 0 ? (total / supplyTot * 100) : null
  const needed     = Number(row.target) - total
  const status     = we > 0 && tw > 0 ? (total / we >= Number(row.target) / tw ? 'GOOD' : 'BAD') : '-'
  const score      = calcScore(total, we, Number(row.target), tw)
  const achievePct = Number(row.target) > 0 ? Math.round(total / Number(row.target) * 100) : 0

  const FIELDS: { key: keyof EmployeeRow; label: string }[] = [
    { key: 'target',          label: '목표' },
    { key: 'supply_count',    label: '공급수' },
    { key: 'supply_payment',  label: '공급결제' },
    { key: 'direct_count',    label: '직접수' },
    { key: 'direct_payment',  label: '직접결제' },
  ]

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1B2A45] text-white flex items-center justify-center text-sm font-bold shrink-0">
            {(row.name || '?').charAt(0)}
          </div>
          <input
            type="text" value={row.name}
            onChange={e => onChange(idx, 'name', e.target.value)}
            placeholder="직원명"
            className="font-bold text-gray-800 bg-transparent border-b border-transparent
              hover:border-gray-300 focus:border-blue-500 focus:outline-none text-sm w-24"
          />
        </div>
        <div className="flex items-center gap-2">
          <PaceBadge status={status} score={score} />
          <button onClick={() => onRemove(idx)}
            className="text-gray-300 hover:text-red-400 text-xs transition-colors">✕</button>
        </div>
      </div>

      {/* 5개 입력칸 */}
      <div className="grid grid-cols-5 gap-1.5">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center gap-0.5">
            <p className="text-[9px] text-gray-400 font-medium">{label}</p>
            <input
              type="number" min={0} value={row[key] as number}
              onChange={e => onChange(idx, key, Number(e.target.value))}
              className="w-full text-center text-sm font-bold text-gray-800 bg-white rounded-xl
                border border-gray-200 px-1 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        ))}
      </div>

      {/* 목표 진행바 */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-[10px] text-gray-400">목표 달성률</span>
          <span className="text-[10px] font-bold text-gray-600">{total} / {Number(row.target)}개 · {achievePct}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${achievePct >= 100 ? 'bg-emerald-500' : achievePct >= 60 ? 'bg-blue-500' : 'bg-amber-400'}`}
            style={{ width: `${Math.min(100, achievePct)}%` }} />
        </div>
      </div>

      {/* 결과 3칸 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-xl py-2 text-center">
          <p className="text-[9px] text-emerald-500">총결제</p>
          <p className="text-base font-black text-emerald-700">{total}</p>
        </div>
        <div className="bg-blue-50 rounded-xl py-2 text-center">
          <p className="text-[9px] text-blue-500">공급대비율</p>
          <p className="text-base font-black text-blue-700">
            {supplyRate !== null ? supplyRate.toFixed(1) + '%' : '—'}
          </p>
        </div>
        <div className={`rounded-xl py-2 text-center ${needed > 0 ? 'bg-rose-50' : 'bg-gray-100'}`}>
          <p className={`text-[9px] ${needed > 0 ? 'text-rose-400' : 'text-gray-400'}`}>목표까지</p>
          <p className={`text-base font-black ${needed > 0 ? 'text-rose-600' : 'text-gray-500'}`}>
            {needed > 0 ? `${needed}개` : '완료'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  결제율 대시보드
// ════════════════════════════════════════════════════════════════════════════════
function PayRateSubView() {
  const today = todayStr()
  const month = thisMonthStr()
  const now   = new Date()
  const { total: tw, elapsed: we }  = calcWorkingDays(today)
  const bizElapsed = getElapsedBusinessDays(now.getFullYear(), now.getMonth(), now.getDate())

  // ── 상태 ──
  const [saving,       setSaving]       = useState(false)
  const [saveMsg,      setSaveMsg]      = useState('')
  const [customers,    setCustomers]    = useState<any[]>([])
  const [salesPeople,  setSalesPeople]  = useState<string[]>([])
  const [autoStats,    setAutoStats]    = useState<{ name: string; contracted: number }[]>([])

  // 공급 현황
  const [supplyConfig,   setSupplyConfig]   = useState<SupplyConfig>({})
  const [supplyDraft,    setSupplyDraft]    = useState<SupplyConfig>({})
  const [supplyEditMode, setSupplyEditMode] = useState(false)
  const [supplySaving,   setSupplySaving]   = useState(false)

  // 영업일 기준
  const [targetCount,    setTargetCount]    = useState(0)
  const [paymentCount,   setPaymentCount]   = useState(0)
  const [employeeCount,  setEmployeeCount]  = useState(0)

  // 직원별
  const mkRow = (name = ''): EmployeeRow => ({ name, target: 0, supply_count: 0, supply_payment: 0, direct_count: 0, direct_payment: 0 })
  const [employees, setEmployees] = useState<EmployeeRow[]>([])

  // ── 초기 로드 ──
  useEffect(() => {
    async function load() {
      try {
        const [payRes, scRes, custRes, userRes] = await Promise.all([
          fetch(`/api/payrate?date=${today}`),
          fetch('/api/supply-config'),
          fetch('/api/customers'),
          fetch('/api/users?role=sales'),
        ])
        const [payJson, scJson, custJson, userJson] = await Promise.all([
          payRes.json(), scRes.json(), custRes.json(), userRes.json()
        ])

        // 고객 (TESTER 제외)
        const allCust = (custJson.customers || []).filter((c: any) =>
          (c.details?.sales_user_name || c.sales_user_name || '').trim() !== TESTER
        )
        setCustomers(allCust)

        // 영업팀 사람 (TESTER 제외)
        const people: string[] = (userJson.users || [])
          .filter((u: any) => u.name && u.name !== TESTER)
          .map((u: any) => u.name as string)
        setSalesPeople(people)
        setEmployeeCount(people.length)

        // 이번달 계약 자동집계 (TESTER 제외)
        const byPerson: Record<string, number> = {}
        allCust
          .filter((c: any) =>
            c.status === 'contracted' &&
            (c.details?.contract_date || c.created_at || '').startsWith(month)
          )
          .forEach((c: any) => {
            const name = (c.details?.sales_user_name || c.sales_user_name || '').trim()
            if (name && name !== TESTER) byPerson[name] = (byPerson[name] || 0) + 1
          })
        const stats = Object.entries(byPerson).map(([name, contracted]) => ({ name, contracted }))
        setAutoStats(stats)
        setPaymentCount(stats.reduce((s, v) => s + v.contracted, 0))

        // 공급 설정 (TESTER 제외)
        if (scJson.config?.month === month) {
          const cfg: SupplyConfig = {}
          for (const [k, v] of Object.entries(scJson.config.people || {})) {
            if (k !== TESTER) cfg[k] = v as PersonSupply
          }
          setSupplyConfig(cfg)
        }

        // 결제율 레코드
        if (payJson.record) {
          const r = payJson.record
          setTargetCount(r.target_count ?? 0)
          const empDetails = (r.employee_details || []).filter((e: EmployeeRow) => e.name !== TESTER)
          if (empDetails.length > 0) {
            setEmployees(empDetails)
          } else if (people.length > 0) {
            setEmployees(people.map(name => mkRow(name)))
          }
        } else if (people.length > 0) {
          setEmployees(people.map(name => mkRow(name)))
        }
      } catch {}
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 공급 현황 계산 ──
  const supplyStats = useMemo(() =>
    salesPeople.map(name => {
      const cfg = supplyConfig[name] || { supplied: 0, goal: 30, base: 0 }
      const dbContracted = customers
        .filter(c =>
          c.status === 'contracted' &&
          (c.details?.sales_user_name || '').trim() === name &&
          (c.details?.contract_date || c.created_at || '').slice(0, 7) === month
        )
        .reduce((sum, c) => sum + contractWeight(c.details?.payment_amount), 0)
      const totalContracted = cfg.base + dbContracted
      const rate       = cfg.supplied > 0 ? Math.floor(totalContracted / cfg.supplied * 10000) / 100 : 0
      const achievePct = cfg.goal     > 0 ? Math.round(totalContracted / cfg.goal * 100) : 0
      const recommended = calcRecommendedSupply(rate, bizElapsed)
      return { name, cfg, dbContracted, totalContracted, rate, achievePct, recommended }
    }),
  [salesPeople, supplyConfig, customers, month, bizElapsed])

  // ── 영업일 기준 계산 ──
  const pc = paymentCount, ec = employeeCount
  const remaining           = tw - we
  const expected            = we > 0 ? (pc / we) * tw : 0
  const expPerPersonMonth   = ec > 0 ? expected / ec : 0
  const expPerPersonDay     = we > 0 && ec > 0 ? pc / we / ec : 0
  const tgtPerPersonDay     = tw > 0 && ec > 0 ? targetCount / tw / ec : 0
  const paceStatus          = we > 0 && tw > 0 ? (pc / we >= targetCount / tw ? 'GOOD' : 'BAD') : '-'
  const paceScore           = calcScore(pc, we, targetCount, tw)

  // ── 공급 저장 ──
  function openSupplyEdit() {
    const draft: SupplyConfig = {}
    for (const name of salesPeople) {
      draft[name] = { ...(supplyConfig[name] || { supplied: 0, goal: 30, base: 0 }) }
    }
    setSupplyDraft(draft)
    setSupplyEditMode(true)
  }
  async function saveSupply() {
    setSupplySaving(true)
    await fetch('/api/supply-config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, people: supplyDraft }),
    })
    setSupplyConfig({ ...supplyDraft })
    setSupplyEditMode(false)
    setSupplySaving(false)
  }

  // ── 직원별 업데이트 ──
  function updateEmp(i: number, f: keyof EmployeeRow, v: number | string) {
    setEmployees(prev => { const n = [...prev]; n[i] = { ...n[i], [f]: f === 'name' ? v : Number(v) }; return n })
  }
  function removeEmp(i: number) { setEmployees(prev => prev.filter((_, idx) => idx !== i)) }

  // ── 결제율 저장 ──
  async function handleSave() {
    setSaving(true); setSaveMsg('')
    const res = await fetch('/api/payrate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today, employee_count: employeeCount,
        target_count: targetCount, payment_count: paymentCount,
        working_days_elapsed: we, total_working_days: tw,
        employee_details: employees,
      }),
    })
    const json = await res.json()
    setSaveMsg(json.record ? '✅ 저장 완료' : '❌ 저장 실패')
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  // ── 직원별 합계 ──
  const totTarget   = employees.reduce((s, r) => s + Number(r.target),          0)
  const totSupply   = employees.reduce((s, r) => s + Number(r.supply_count),    0)
  const totPayment  = employees.reduce((s, r) => s + Number(r.supply_payment) + Number(r.direct_payment), 0)
  const totSupRate  = totSupply > 0 ? (totPayment / totSupply * 100) : null

  return (
    <div className="space-y-5 pb-8">

      {/* ─── 이번달 계약 자동집계 ─────────────────────────────────────────── */}
      {autoStats.length > 0 && (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4">
          <p className="text-[11px] font-bold text-emerald-700 mb-3">🤖 이번달 계약 자동집계</p>
          <div className="flex gap-3 flex-wrap">
            {autoStats.map(s => (
              <div key={s.name} className="bg-white rounded-xl px-4 py-3 border border-emerald-100 text-center shadow-sm min-w-[80px]">
                <p className="text-[10px] text-gray-400 mb-0.5">{s.name}</p>
                <p className="text-2xl font-black text-emerald-700">
                  {s.contracted}<span className="text-xs font-normal text-gray-400 ml-0.5">건</span>
                </p>
              </div>
            ))}
            {autoStats.length > 1 && (
              <div className="bg-emerald-600 rounded-xl px-4 py-3 text-center shadow-sm min-w-[80px]">
                <p className="text-[10px] text-white/70 mb-0.5">합계</p>
                <p className="text-2xl font-black text-white">
                  {autoStats.reduce((s, v) => s + v.contracted, 0)}<span className="text-xs font-normal text-white/70 ml-0.5">건</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 📊 공급 현황 ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800">📊 공급 현황</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{month} · 계약율 기준 내일 권장 공급량</p>
          </div>
          {!supplyEditMode ? (
            <button onClick={openSupplyEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700
                border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-colors">
              ✏️ 수정
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setSupplyEditMode(false)}
                className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500 text-xs font-semibold hover:bg-gray-200 transition-colors">
                취소
              </button>
              <button onClick={saveSupply} disabled={supplySaving}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60">
                {supplySaving ? '저장중…' : '💾 저장'}
              </button>
            </div>
          )}
        </div>

        {supplyStats.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-6">등록된 영업사원이 없습니다</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {supplyStats.map(s => (
              <div key={s.name} className="bg-gray-50 rounded-2xl p-4 space-y-3">
                {/* 이름 + 달성 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#1B2A45] text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {s.name.charAt(0)}
                    </div>
                    <span className="font-bold text-gray-800">{s.name}</span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    s.achievePct >= 100 ? 'bg-emerald-100 text-emerald-700' :
                    s.achievePct >= 70  ? 'bg-blue-100 text-blue-700' :
                    s.achievePct >= 40  ? 'bg-amber-100 text-amber-700' :
                    'bg-red-50 text-red-600'
                  }`}>달성 {s.achievePct}%</span>
                </div>

                {/* 핵심 3수치 */}
                <div className="grid grid-cols-3 gap-2">
                  {/* 공급수 */}
                  <div className="bg-sky-50 rounded-xl py-2.5 text-center">
                    <p className="text-[9px] text-sky-500 mb-0.5">공급수</p>
                    {supplyEditMode ? (
                      <input type="number" min="0"
                        value={supplyDraft[s.name]?.supplied ?? s.cfg.supplied}
                        onChange={e => setSupplyDraft(prev => ({
                          ...prev, [s.name]: { ...(prev[s.name] || { supplied: 0, goal: 30, base: 0 }), supplied: Number(e.target.value) }
                        }))}
                        className="w-full text-center text-base font-black text-sky-700 bg-transparent
                          border-b-2 border-sky-400 focus:outline-none
                          [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    ) : (
                      <p className="text-base font-black text-sky-700">{s.cfg.supplied}</p>
                    )}
                  </div>
                  {/* 결제수 */}
                  <div className="bg-emerald-50 rounded-xl py-2.5 text-center">
                    <p className="text-[9px] text-emerald-500 mb-0.5">결제수</p>
                    <p className="text-base font-black text-emerald-700">{s.totalContracted.toFixed(1)}</p>
                    {s.cfg.base > 0 && (
                      <p className="text-[8px] text-gray-400">기존{s.cfg.base}+DB{s.dbContracted.toFixed(1)}</p>
                    )}
                  </div>
                  {/* 계약율 */}
                  <div className={`rounded-xl py-2.5 text-center ${
                    s.rate >= 17 ? 'bg-emerald-50' : s.rate >= 13 ? 'bg-amber-50' : 'bg-red-50'
                  }`}>
                    <p className="text-[9px] text-gray-400 mb-0.5">계약율</p>
                    <p className={`text-base font-black ${
                      s.rate >= 17 ? 'text-emerald-700' : s.rate >= 13 ? 'text-amber-700' : 'text-red-600'
                    }`}>{s.rate.toFixed(1)}%</p>
                  </div>
                </div>

                {/* 목표 진행바 */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-400 font-medium">목표 달성</span>
                    <div className="flex items-center gap-0.5 text-[10px]">
                      <span className="text-gray-400">{s.totalContracted.toFixed(1)} / </span>
                      {supplyEditMode ? (
                        <input type="number" min="0"
                          value={supplyDraft[s.name]?.goal ?? s.cfg.goal}
                          onChange={e => setSupplyDraft(prev => ({
                            ...prev, [s.name]: { ...(prev[s.name] || { supplied: 0, goal: 30, base: 0 }), goal: Number(e.target.value) }
                          }))}
                          className="w-10 text-center font-bold text-gray-800 bg-transparent border-b border-gray-400
                            focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      ) : (
                        <span className="font-bold text-gray-700">{s.cfg.goal}개</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, s.achievePct)}%` }} />
                  </div>
                </div>

                {/* 오프셋 (수정모드) */}
                {supplyEditMode && (
                  <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
                    <span className="text-[10px] text-gray-400 flex-1">시스템 전 결제수 (오프셋)</span>
                    <input type="number" min="0" step="0.5"
                      value={supplyDraft[s.name]?.base ?? s.cfg.base}
                      onChange={e => setSupplyDraft(prev => ({
                        ...prev, [s.name]: { ...(prev[s.name] || { supplied: 0, goal: 30, base: 0 }), base: Number(e.target.value) }
                      }))}
                      className="w-16 text-center text-xs font-bold text-gray-800 bg-gray-50 border border-gray-200
                        rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400
                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                )}

                {/* 권장 내일 공급 */}
                <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${
                  s.recommended >= 5 ? 'bg-emerald-50 border border-emerald-100' :
                  s.recommended >= 3 ? 'bg-blue-50 border border-blue-100' :
                  s.recommended >= 1 ? 'bg-amber-50 border border-amber-100' :
                  'bg-red-50 border border-red-100'
                }`}>
                  <div>
                    <p className="text-[11px] font-bold text-gray-600">권장 내일 공급</p>
                    <p className="text-[9px] text-gray-400">계약율 {s.rate.toFixed(1)}% 기준</p>
                  </div>
                  <p className={`text-3xl font-black ${
                    s.recommended >= 5 ? 'text-emerald-700' :
                    s.recommended >= 3 ? 'text-blue-700' :
                    s.recommended >= 1 ? 'text-amber-700' : 'text-red-600'
                  }`}>{s.recommended}<span className="text-sm font-normal opacity-60">개</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 📈 영업일 기준 ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800">📈 영업일 기준</h3>
          <span className="text-[11px] text-gray-300">{today}</span>
        </div>

        {/* 핵심 4개 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <NumInput label="인원수"   value={employeeCount} color="gray"  auto unit="명" />
          <NumInput label="목표개수" value={targetCount}   color="editable" unit="개"
            onChange={v => setTargetCount(v)} />
          <NumInput label="결제개수" value={paymentCount}  color="green" auto unit="개" />
          <div className="bg-slate-50 rounded-2xl px-3 py-2.5 flex flex-col items-center gap-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">진행 영업일</p>
            <p className="text-xl font-black text-slate-800 leading-tight">
              {we}<span className="text-sm text-slate-400 font-normal"> / {tw}일</span>
            </p>
            <span className="text-[9px] bg-amber-100 text-amber-600 rounded-full px-1.5 py-0.5 font-semibold">잔여 {remaining}일</span>
          </div>
        </div>

        {/* 예측 지표 5개 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <NumInput label="예상개수"    value={fmtN(expected)}           color="gray" />
          <NumInput label="인당이번달"  value={fmtN(expPerPersonMonth)}  color="gray" />
          <NumInput label="인당하루"    value={fmtN(expPerPersonDay)}    color="gray" />
          <NumInput label="목표인당하루" value={fmtN(tgtPerPersonDay)}   color="blue" />
          <div className="bg-amber-50 rounded-2xl px-3 py-2.5 flex flex-col items-center gap-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-amber-500">진행상태</p>
            <PaceBadge status={paceStatus} score={paceScore} />
          </div>
        </div>
      </div>

      {/* ─── 👥 직원별 현황 ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800 mb-4">👥 직원별 현황</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {employees.filter(r => r.name !== TESTER).map((row, i) => (
            <EmpCard key={i} row={row} idx={i} we={we} tw={tw} onChange={updateEmp} onRemove={removeEmp} />
          ))}

          {/* 직원 추가 */}
          <button onClick={() => setEmployees(prev => [...prev, mkRow()])}
            className="min-h-[160px] border-2 border-dashed border-gray-200 rounded-2xl text-gray-300
              hover:border-blue-300 hover:text-blue-400 transition-colors flex flex-col items-center justify-center gap-2">
            <span className="text-2xl">＋</span>
            <span className="text-sm font-medium">직원 추가</span>
          </button>
        </div>

        {/* 합계 바 */}
        {employees.length >= 2 && (
          <div className="mt-4 bg-[#1B2A45] rounded-2xl p-4 grid grid-cols-3 gap-3 text-white text-center">
            <div>
              <p className="text-[10px] text-white/50 mb-0.5">총 목표</p>
              <p className="text-lg font-black">{totTarget}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/50 mb-0.5">총 결제</p>
              <p className="text-lg font-black text-emerald-400">{totPayment}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/50 mb-0.5">공급대비율</p>
              <p className="text-lg font-black text-blue-400">
                {totSupRate !== null ? totSupRate.toFixed(1) + '%' : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── 저장 ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3">
        {saveMsg && (
          <span className={`text-sm font-medium ${saveMsg.includes('✅') ? 'text-emerald-600' : 'text-red-500'}`}>
            {saveMsg}
          </span>
        )}
        <button onClick={handleSave} disabled={saving}
          className="bg-[#1B2A45] hover:bg-[#263d66] disabled:opacity-40 text-white
            px-7 py-2.5 rounded-2xl text-sm font-bold shadow-sm transition-colors">
          {saving ? '저장 중…' : '💾 저장'}
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  손익계산 뷰 (날짜 없이 오늘 자동 사용)
// ════════════════════════════════════════════════════════════════════════════════
function PnlSubView() {
  const today = todayStr()
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')

  const [salesEmps,   setSalesEmps]   = useState<SalesEmp[]>([])
  const [opsEmps,     setOpsEmps]     = useState<OpsEmp[]>([])
  const [otherCosts,  setOtherCosts]  = useState<OtherCost>({
    ad_marketing: 0, db: 0, rent: 0, mgmt: 0, sales_fixed: 0, sales_other: 0,
  })
  const [ceoSalary, setCeoSalary] = useState(0)
  const [dbCount,        setDbCount]        = useState(0)
  const [dbUnitPrice,    setDbUnitPrice]    = useState(0)
  const [dbPurchaseCost, setDbPurchaseCost] = useState(0)

  // 계산
  const salesTotal      = salesEmps.reduce((s, e) => s + Number(e.sales_vat_incl), 0)
  const opsFeeTotal     = opsEmps.reduce((s, e) => s + Number(e.fee_vat_incl), 0)
  const opsContractTotal= opsEmps.reduce((s, e) => s + Number(e.contract_vat_incl), 0)
  const totalRevenue    = salesTotal + opsFeeTotal + opsContractTotal

  function calcPromo(revenue: number, contracts: number) {
    const c = Number(contracts)
    const baseRate = c >= 12 ? 0.30 : 0.25
    const bonus    = c >= 40 ? 1500000 : c >= 30 ? 1000000 : c >= 23 ? 700000 : c >= 20 ? 500000 : 0
    return { baseRate, bonus, promoWage: revenue * baseRate + bonus }
  }

  const salesTax  = salesTotal * 0.10
  const salesWage = salesEmps.length > 0
    ? salesEmps.reduce((s, e) => {
        const has = Number(e.contracts) > 0
        const r   = Number(e.sales_vat_incl)
        return s + (has ? calcPromo(r, e.contracts).promoWage : r * 0.30)
      }, 0)
    : salesTotal * 0.30
  const otherTotal  = Object.values(otherCosts).reduce((s, v) => s + Number(v), 0)
  const totalCost   = salesTax + salesWage + otherTotal
  const netProfit   = totalRevenue - totalCost
  const personalProfit = netProfit - Number(ceoSalary)
  const ifRevenue   = Number(dbCount) * Number(dbUnitPrice)
  const ifProfit    = ifRevenue - ifRevenue * 0.10 - Number(dbPurchaseCost) - Number(ceoSalary)

  const iClass = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
  const rClass = 'bg-gray-50 text-gray-600 text-sm px-2 py-1.5 rounded-lg text-right whitespace-nowrap'

  async function handleLoad() {
    setLoading(true); setMsg('')
    const res  = await fetch(`/api/pnl?date=${today}`)
    const json = await res.json()
    if (json.record) {
      const r = json.record
      if (Array.isArray(r.sales_employees)) setSalesEmps(r.sales_employees)
      if (Array.isArray(r.ops_employees))   setOpsEmps(r.ops_employees)
      if (r.other_costs)   setOtherCosts(r.other_costs)
      if (r.ceo_salary !== undefined) setCeoSalary(r.ceo_salary)
      setMsg('불러오기 완료')
    } else { setMsg('저장된 데이터 없음') }
    setLoading(false)
    setTimeout(() => setMsg(''), 3000)
  }

  async function handleSave() {
    setSaving(true); setMsg('')
    const res  = await fetch('/api/pnl', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, sales_employees: salesEmps, ops_employees: opsEmps, other_costs: otherCosts, ceo_salary: ceoSalary }),
    })
    const json = await res.json()
    setMsg(json.record ? '✅ 저장 완료' : '❌ 저장 실패')
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  function updSales(i: number, f: keyof SalesEmp, v: string) {
    setSalesEmps(prev => { const n = [...prev]; n[i] = { ...n[i], [f]: f === 'name' ? v : Number(v) }; return n })
  }
  function updOps(i: number, f: keyof OpsEmp, v: string) {
    setOpsEmps(prev => { const n = [...prev]; n[i] = { ...n[i], [f]: f === 'name' ? v : Number(v) }; return n })
  }

  useEffect(() => { handleLoad() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5 pb-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400">{today}</p>
        <div className="flex items-center gap-3">
          {loading && <span className="text-xs text-blue-400">불러오는 중…</span>}
          {msg && <span className={`text-sm font-medium ${msg.includes('✅') ? 'text-emerald-600' : msg.includes('❌') ? 'text-red-500' : 'text-gray-500'}`}>{msg}</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-[#1B2A45] hover:bg-[#263d66] text-white px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition-colors">
            {saving ? '저장 중…' : '💾 저장'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 매출 */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700">매출</h3>

          {/* 영업팀 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h4 className="text-xs font-bold text-gray-500 mb-3">영업팀</h4>
            <div className="space-y-2">
              {salesEmps.map((e, i) => {
                const promo = calcPromo(Number(e.sales_vat_incl), e.contracts)
                const has   = Number(e.contracts) > 0
                return (
                  <div key={i} className="grid grid-cols-[100px_1fr_64px_auto_auto_auto_24px] gap-1.5 items-center">
                    <input type="text" value={e.name} onChange={ev => updSales(i, 'name', ev.target.value)}
                      className={iClass} placeholder="직원명" />
                    <input type="number" value={e.sales_vat_incl} onChange={ev => updSales(i, 'sales_vat_incl', ev.target.value)}
                      className={iClass} placeholder="매출(부가세제외)" min={0} />
                    <input type="number" value={e.contracts} onChange={ev => updSales(i, 'contracts', ev.target.value)}
                      className={iClass} placeholder="계약수" min={0} />
                    <span className={rClass}>{has ? `${(promo.baseRate*100).toFixed(0)}%` : '30%'}</span>
                    <span className={rClass}>{has ? promo.bonus.toLocaleString('ko-KR') : '—'}</span>
                    <span className="text-sm font-bold text-blue-700 text-right whitespace-nowrap">
                      {Math.round(has ? promo.promoWage : Number(e.sales_vat_incl)*0.30).toLocaleString('ko-KR')}
                    </span>
                    <button onClick={() => setSalesEmps(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-300 mt-2">계약수 미입력 시 30% 고정</p>
            <button onClick={() => setSalesEmps(prev => [...prev, { name: '', sales_vat_incl: 0, contracts: 0 }])}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-medium">+ 영업팀 직원 추가</button>
          </div>

          {/* 관리팀 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h4 className="text-xs font-bold text-gray-500 mb-3">관리팀</h4>
            <div className="space-y-2">
              {opsEmps.map((e, i) => (
                <div key={i} className="grid grid-cols-[100px_1fr_1fr_24px] gap-1.5 items-center">
                  <input type="text" value={e.name} onChange={ev => updOps(i, 'name', ev.target.value)}
                    className={iClass} placeholder="직원명" />
                  <input type="number" value={e.fee_vat_incl} onChange={ev => updOps(i, 'fee_vat_incl', ev.target.value)}
                    className={iClass} placeholder="수수료(부가세제외)" min={0} />
                  <input type="number" value={e.contract_vat_incl} onChange={ev => updOps(i, 'contract_vat_incl', ev.target.value)}
                    className={iClass} placeholder="계약(부가세제외)" min={0} />
                  <button onClick={() => setOpsEmps(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setOpsEmps(prev => [...prev, { name: '', fee_vat_incl: 0, contract_vat_incl: 0 }])}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-medium">+ 관리팀 직원 추가</button>
          </div>
        </div>

        {/* 매입 + 요약 */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700">매입 / 비용</h3>

          {/* 영업팀 매입 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h4 className="text-xs font-bold text-gray-500 mb-3">영업팀 매입</h4>
            <div className="space-y-1">
              {salesEmps.map((e, i) => {
                const has  = Number(e.contracts) > 0
                const amt  = Number(e.sales_vat_incl)
                const wage = has ? calcPromo(amt, e.contracts).promoWage : amt * 0.30
                return (
                  <div key={i} className="grid grid-cols-[100px_1fr_1fr] gap-2 items-center text-sm">
                    <span className="text-gray-500 text-xs">{e.name || `직원${i+1}`}</span>
                    <span className={rClass}>{Math.round(amt*0.10).toLocaleString('ko-KR')}</span>
                    <span className={rClass}>{Math.round(wage).toLocaleString('ko-KR')}</span>
                  </div>
                )
              })}
              <div className="grid grid-cols-[100px_1fr_1fr] gap-2 items-center border-t border-gray-100 pt-1">
                <span className="text-xs font-bold text-gray-500">소계</span>
                <span className={rClass + ' font-bold'}>{Math.round(salesTax).toLocaleString('ko-KR')}</span>
                <span className={rClass + ' font-bold'}>{Math.round(salesWage).toLocaleString('ko-KR')}</span>
              </div>
            </div>
          </div>

          {/* 기타 운영비 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h4 className="text-xs font-bold text-gray-500 mb-3">기타 운영비</h4>
            <div className="space-y-2">
              {([
                ['ad_marketing', '광고/마케팅'],
                ['db',           'DB'],
                ['rent',         '임대료'],
                ['mgmt',         '관리비'],
                ['sales_fixed',  '영업고정비용'],
                ['sales_other',  '영업기타비용'],
              ] as [keyof OtherCost, string][]).map(([f, label]) => (
                <div key={f} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
                  <input type="number" value={otherCosts[f]}
                    onChange={e => setOtherCosts(prev => ({ ...prev, [f]: Number(e.target.value) }))}
                    className={iClass} min={0} />
                  <span className="text-xs text-gray-400 w-28 text-right shrink-0">
                    {Number(otherCosts[f]).toLocaleString('ko-KR')}원
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 손익 요약 */}
          <div className="bg-[#1B2A45] text-white rounded-2xl p-5 space-y-2">
            <h4 className="text-xs font-bold text-white/50 mb-3 uppercase tracking-wide">손익 요약</h4>
            {[
              ['총 매출', totalRevenue, 'text-white'],
              ['총 매입', totalCost,    'text-white/70'],
            ].map(([label, val, cls]) => (
              <div key={label as string} className="flex justify-between text-sm">
                <span className="text-white/60">{label as string}</span>
                <span className={`font-bold ${cls as string}`}>{(val as number).toLocaleString('ko-KR')}원</span>
              </div>
            ))}
            <div className="border-t border-white/20 pt-2 flex justify-between text-base font-black">
              <span>순이익</span>
              <span className={netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {netProfit.toLocaleString('ko-KR')}원
              </span>
            </div>
          </div>

          {/* 개인 생활비 */}
          <div className="space-y-2">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">개인 고정 생활비</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs text-rose-600">💳 카드값</span>
                <span className="text-sm font-black text-rose-700">300만원</span>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs text-orange-600">🏠 집월세</span>
                <span className="text-sm font-black text-orange-700">65만원</span>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 flex items-center justify-between">
              <span className="text-xs text-gray-500">순이익 − 생활비</span>
              <span className={`text-sm font-black ${(netProfit - 3650000) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {(netProfit - 3650000).toLocaleString('ko-KR')}원
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* DB 미니 계산기 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 max-w-sm">
        <h4 className="text-sm font-bold text-gray-700 mb-4">DB 미니 계산기</h4>
        <div className="space-y-2.5">
          {([
            ['DB 개수',       dbCount,        setDbCount],
            ['DB 단가(원/개)', dbUnitPrice,    setDbUnitPrice],
            ['DB 구매비용',   dbPurchaseCost, setDbPurchaseCost],
            ['대표 개인 월급', ceoSalary,      setCeoSalary],
          ] as [string, number, (v: number) => void][]).map(([label, val, setter]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
              <input type="number" value={val} onChange={e => setter(Number(e.target.value))}
                className={iClass} min={0} />
            </div>
          ))}
          <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">IF 매출</span><span className="font-medium">{ifRevenue.toLocaleString('ko-KR')}원</span></div>
            <div className="flex justify-between"><span className="text-gray-400">세금 10%</span><span className="font-medium">{Math.round(ifRevenue*0.10).toLocaleString('ko-KR')}원</span></div>
            <div className="flex justify-between font-bold">
              <span>IF 수익</span>
              <span className={ifProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{Math.round(ifProfit).toLocaleString('ko-KR')}원</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>개인 수익</span>
              <span className={personalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{Math.round(personalProfit).toLocaleString('ko-KR')}원</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  메인 탭
// ════════════════════════════════════════════════════════════════════════════════
type SubView = '결제율' | '손익계산'

export default function PayRateTab() {
  const [sub, setSub] = useState<SubView>('결제율')

  return (
    <div className="space-y-4 pb-8">
      <div className="flex gap-2">
        {(['결제율', '손익계산'] as SubView[]).map(v => (
          <button key={v} onClick={() => setSub(v)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              sub === v
                ? 'bg-[#1B2A45] text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}>
            {v === '결제율' ? '📊 결제율' : '💹 손익계산'}
          </button>
        ))}
      </div>

      {sub === '결제율'  && <PayRateSubView />}
      {sub === '손익계산' && <PnlSubView />}
    </div>
  )
}
