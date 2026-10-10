'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { contractWeight, calcRecommendedSupply } from '@/lib/supplyRules'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface EmployeeRow {
  name: string
  target: number
  supply_count: number   // 하위호환 보존 (실제값은 daily_supplies 합산)
  supply_payment: number // 하위호환 보존 (실제값은 자동집계)
  direct_count: number   // 하위호환 보존 (실제값은 자동집계)
  direct_payment: number // 하위호환 보존 (실제값은 자동집계)
  direct_adjustment?: number // 대표가 수동 차감한 카운트 (음수, 기본 0)
  daily_supplies?: Record<string, number> // 일별 공급 입력 (key: 일자 "1"~"31")
}

interface AutoEmpData {
  supply_payment: number  // 공급결제 (공가 계약)
  direct_count: number    // 직접수 (직가 DB 추가)
  direct_payment: number  // 직접결제 (직가 계약)
}

interface SalesEmp { name: string; sales_vat_incl: number; contracts: number; supply_count?: number }
interface OpsEmp   { name: string; fee_vat_incl: number; contract_vat_incl: number }
interface OtherCost {
  ad_marketing: number; db: number; rent: number
  mgmt: number; sales_fixed: number; sales_other: number
}

// ── 상수 ──────────────────────────────────────────────────────────────────────
const TESTER = 'sales-tester'

function rateGrade(rate: number | null, top: number) {
  if (rate === null || rate === undefined) return { label: '—', cls: 'text-gray-400' }
  if (rate >= top)        return { label: '최상', cls: 'text-blue-600 font-bold' }
  if (rate >= top - 5)    return { label: '우수', cls: 'text-cyan-600 font-bold' }
  if (rate >= top - 10)   return { label: '양호', cls: 'text-emerald-600 font-bold' }
  if (rate >= top - 15)   return { label: '보통', cls: 'text-amber-500 font-bold' }
  if (rate >= top - 20)   return { label: '미흡', cls: 'text-orange-400 font-bold' }
  if (rate >= top - 25)   return { label: '부진', cls: 'text-orange-600 font-bold' }
  return                         { label: '위험', cls: 'text-red-500 font-bold' }
}

// 직책 제거 이름 정규화 (예: "손제후 수석팀장" → "손제후")
function cleanName(s: string): string {
  return s.replace(/\s*(수석팀장|팀장|팀원|대리|과장|부장|차장|이사|수석|매니저|주임|사원).*/g, '').trim()
}

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────
function todayStr() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10) }

function calcWorkingDays(dateStr: string): { total: number; elapsed: number } {
  const d = new Date(dateStr)
  const year = d.getFullYear(), month = d.getMonth()
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
    <div className="flex flex-col items-center gap-0.5">
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wide ${
        isGood ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
      }`}>{status}</span>
      {score !== undefined && score > 0 && (
        <span className={`text-[10px] font-bold tabular-nums ${
          score >= 9 ? 'text-emerald-600' :
          score >= 7 ? 'text-blue-500' :
          score >= 4 ? 'text-amber-500' : 'text-red-400'
        }`}>{score}<span className="opacity-50">/10</span></span>
      )}
    </div>
  )
}

function NumInput({
  label, value, onChange, unit = '', color = 'gray', auto = false, size = 'md',
}: {
  label: string; value: number | string; onChange?: (v: number) => void
  unit?: string; color?: string; auto?: boolean; size?: 'sm' | 'md' | 'lg'
}) {
  const bg = {
    gray:     'bg-slate-50',
    green:    'bg-emerald-50',
    blue:     'bg-blue-50',
    sky:      'bg-sky-50',
    amber:    'bg-amber-50',
    editable: 'bg-white border-2 border-gray-100 hover:border-blue-300 transition-colors',
  }[color] || 'bg-slate-50'
  const textColor = {
    gray:     'text-slate-800', green:    'text-emerald-700', blue:     'text-blue-700',
    sky:      'text-sky-700',  amber:    'text-amber-700',   editable: 'text-gray-800',
  }[color] || 'text-slate-800'
  const labelColor = {
    gray:     'text-slate-400', green:    'text-emerald-500', blue:     'text-blue-500',
    sky:      'text-sky-500',  amber:    'text-amber-500',   editable: 'text-gray-400',
  }[color] || 'text-slate-400'
  const numSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-xl'
  const inputW  = size === 'lg' ? 'w-20'     : size === 'sm' ? 'w-12'      : 'w-16'

  return (
    <div className={`rounded-2xl px-3 py-2.5 flex flex-col items-center gap-0.5 ${bg}`}>
      <p className={`text-[10px] font-medium uppercase tracking-wide ${labelColor}`}>{label}</p>
      {auto || !onChange ? (
        <p className={`${numSize} font-black ${textColor} leading-tight`}>
          {typeof value === 'number' ? fmtN(value) : value}
          {unit && <span className="text-xs font-normal ml-0.5 opacity-60">{unit}</span>}
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

function AutoField({ label, field, value, autoVal, idx, onChange }: {
  label: string; field: string; value: number; autoVal: number; idx: number
  onChange: (i: number, f: string, v: number | string | Record<string, number>) => void
}) {
  const fv = (v: number) => (v % 1 === 0 ? String(v) : v.toFixed(1))
  return (
    <div className="text-center">
      <p className="text-[12.5px] text-gray-500 font-semibold mb-1">{label}</p>
      <input
        type="number" min={0} step={0.5} value={value}
        onChange={e => onChange(idx, field, Number(e.target.value))}
        className="w-full text-center text-[17px] font-black text-[#0b2140] bg-white rounded-xl border-2 border-gray-100 py-2 hover:border-[#b8995a]/50 focus:outline-none focus:border-[#b8995a] tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {autoVal !== value && (
        <button title={`DB 자동값(${fv(autoVal)})으로 맞추기`} onClick={() => onChange(idx, field, autoVal)} className="text-[11px] text-sky-600 hover:underline mt-1">DB값 {fv(autoVal)} 적용</button>
      )}
    </div>
  )
}

function EmpCard({
  row, idx, we, tw, onChange, onRemove, autoData, selfSupplied = 0,
}: {
  row: EmployeeRow; idx: number; we: number; tw: number
  onChange: (i: number, f: string, v: number | string | Record<string, number>) => void
  onRemove: (i: number) => void
  autoData: AutoEmpData
  selfSupplied?: number
  // target은 supply-config에서 읽어온 값이 row.target에 반영되어 있음 (읽기전용)
}) {
  const [showDaily, setShowDaily] = useState(false)

  // 일별 공급 합산 → 공급수 (자동)
  const dailySupplies = row.daily_supplies || {}
  const supplyCount   = Object.values(dailySupplies).reduce((s, v) => s + Number(v || 0), 0)

  // 자동집계값 우선 사용 — DB 저장값이 0이면 API 실시간값으로 보완 (DB 초기화 복구)
  const supplyPayment    = Math.max(Number(row.supply_payment),  autoData.supply_payment)
  const directCountRaw   = Math.max(Number(row.direct_count),    autoData.direct_count)
  const directAdjustment = Number(row.direct_adjustment ?? 0)  // 대표 수동 차감 (음수)
  const directCount      = Math.max(0, directCountRaw + directAdjustment)
  const directPayment    = Math.max(Number(row.direct_payment),  autoData.direct_payment)

  const total       = supplyPayment + directPayment
  const supplyRate  = supplyCount > 0 ? (supplyPayment / supplyCount * 100) : null
  const directRate  = directCount > 0 ? (directPayment / directCount * 100) : null
  // 총결제율 = 총계약수(공가+직가) / 공급갯수 × 100
  const totalRate   = supplyCount > 0 ? ((supplyPayment + directPayment) / supplyCount * 100) : null
  const needed      = Number(row.target) - total
  // 공급예정: 총결제율 기준 권장 공급 수
  const dailyRec    = totalRate !== null ? calcRecommendedSupply(totalRate, we) : 0
  const supplyNeeded = dailyRec > 0 ? dailyRec : null

  const status     = we > 0 && tw > 0 ? (total / we >= Number(row.target) / tw ? 'GOOD' : 'BAD') : '-'
  const score      = calcScore(total, we, Number(row.target), tw)
  const achievePct = Number(row.target) > 0 ? Math.round(total / Number(row.target) * 100) : 0

  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const todayDay    = now.getDate()

  const fmtVal = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1)
  const fmtPct = (v: number | null) => v !== null ? v.toFixed(1) + '%' : '—'

  const todayVal = Number(dailySupplies[String(todayDay)] || 0)
  const tone = achievePct >= 100 ? '#12805c' : achievePct >= 60 ? '#0b2140' : '#c0392b'

  return (
    <div className="rounded-3xl border border-gray-100 bg-white shadow-sm p-5 md:p-6 space-y-5">
      {/* ── 이름 · 상태 ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#10203a] to-[#0a1424] text-[#E8D080] flex items-center justify-center text-lg font-black shrink-0">
            {(row.name || '?').charAt(0)}
          </div>
          <input
            type="text" value={row.name}
            onChange={e => onChange(idx, 'name', e.target.value)}
            placeholder="직원명"
            className="text-[19px] font-black text-[#0b2140] bg-transparent border-b border-transparent hover:border-gray-300 focus:border-[#b8995a] focus:outline-none w-36 min-w-0"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PaceBadge status={status} score={score} />
          <button onClick={() => onRemove(idx)} className="text-gray-300 hover:text-red-400 text-sm transition-colors" title="이 직원 카드 삭제">✕</button>
        </div>
      </div>

      {/* ── 달성 현황 ── */}
      <div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[13px] text-gray-500 font-semibold">총결제 / 목표</p>
            <p className="text-[36px] leading-none font-black tabular-nums mt-1" style={{ color: '#0b2140' }}>
              {fmtVal(total)}<span className="text-[17px] font-semibold text-gray-400"> / {Number(row.target) || '—'}건</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[30px] leading-none font-black tabular-nums" style={{ color: tone }}>{achievePct}%</p>
            <p className="text-[13px] text-gray-500 mt-1">{needed > 0 ? `목표까지 ${fmtVal(needed)}건` : '목표 달성 🎉'}</p>
          </div>
        </div>
        <div className="h-3.5 rounded-full bg-gray-100 overflow-hidden mt-3">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, achievePct)}%`, background: achievePct >= 100 ? '#12805c' : 'linear-gradient(90deg,#0b2140,#b8995a)' }} />
        </div>
      </div>

      {/* ── 결제율 ── */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl bg-[#0b2140]/[.06] px-3 py-3 text-center">
          <p className="text-[13px] text-gray-500 font-semibold">총결제율</p>
          <p className="text-[26px] leading-tight font-black text-[#0b2140] tabular-nums">{fmtPct(totalRate)}</p>
          {totalRate !== null && <p className={`text-[12.5px] ${rateGrade(totalRate, 30).cls}`}>{rateGrade(totalRate, 30).label}</p>}
        </div>
        <div className="rounded-2xl bg-sky-50 px-3 py-3 text-center">
          <p className="text-[13px] text-sky-700 font-semibold">공급 결제율</p>
          <p className="text-[26px] leading-tight font-black text-sky-800 tabular-nums">{fmtPct(supplyRate)}</p>
          {supplyRate !== null && <p className={`text-[12.5px] ${rateGrade(supplyRate, 40).cls}`}>{rateGrade(supplyRate, 40).label}</p>}
        </div>
        <div className="rounded-2xl bg-violet-50 px-3 py-3 text-center">
          <p className="text-[13px] text-violet-700 font-semibold">직접 결제율</p>
          <p className="text-[26px] leading-tight font-black text-violet-800 tabular-nums">{fmtPct(directRate)}</p>
        </div>
      </div>

      {/* ── 갯수 ── */}
      <div className="grid grid-cols-4 gap-2.5">
        <div className="text-center">
          <p className="text-[12.5px] text-gray-500 font-semibold mb-1">공급수</p>
          <div className="rounded-xl bg-gray-50 border border-gray-100 py-2.5 text-[17px] font-black text-[#0b2140] tabular-nums">{supplyCount}</div>
          {selfSupplied > 0 && <p className="text-[11px] text-emerald-600 font-bold mt-1">자체 {selfSupplied}건</p>}
        </div>
        <AutoField label="공급 결제" field="supply_payment" value={supplyPayment} autoVal={autoData.supply_payment} idx={idx} onChange={onChange} />
        <div className="text-center">
          <p className="text-[12.5px] text-gray-500 font-semibold mb-1">직접수{directAdjustment < 0 && <span className="text-red-400 ml-1">{directAdjustment}</span>}</p>
          <div className="rounded-xl bg-gray-50 border border-gray-100 py-2.5 text-[17px] font-black text-[#0b2140] tabular-nums">{directCount}</div>
          <div className="flex justify-center gap-1 mt-1">
            <button title="직접수 1개 취소 (실수 등록 시)" onClick={() => onChange(idx, 'direct_adjustment', directAdjustment - 1)} className="text-[11px] text-red-400 hover:bg-red-50 rounded px-1.5 py-0.5 font-semibold">−1</button>
            {directAdjustment < 0 && <button title="차감 복원" onClick={() => onChange(idx, 'direct_adjustment', directAdjustment + 1)} className="text-[11px] text-gray-400 hover:bg-gray-100 rounded px-1.5 py-0.5">+1</button>}
          </div>
        </div>
        <AutoField label="직접 결제" field="direct_payment" value={directPayment} autoVal={autoData.direct_payment} idx={idx} onChange={onChange} />
      </div>

      {/* ── 오늘 DB 공급 갯수 (직접 입력) ── */}
      <div className="rounded-2xl border border-[#b8995a]/35 bg-[#b8995a]/[.08] p-4">
        <p className="text-[13px] font-black text-[#0b2140] mb-2.5">오늘({now.getMonth() + 1}/{todayDay}) DB 공급 갯수 <span className="font-medium text-gray-500">— 직접 입력</span></p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-baseline gap-1.5">
            <input
              type="number" min={0} value={todayVal || ''} placeholder="0"
              onChange={e => onChange(idx, 'daily_supplies', { ...dailySupplies, [String(todayDay)]: Number(e.target.value) || 0 })}
              className="w-24 text-center text-[30px] font-black text-[#0b2140] bg-white rounded-2xl border-2 border-[#b8995a]/50 py-1.5 focus:outline-none focus:border-[#b8995a] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[15px] font-bold text-gray-500">개</span>
          </div>
          <div className="text-[13.5px] text-gray-600 leading-relaxed">
            이번 달 합계 <b className="text-[#0b2140] text-[16px]">{supplyCount}개</b>
            {supplyRate !== null && <><br />{dailyRec === 0 ? <b className="text-red-500">공급 중단 권장 구간</b> : <>내일 권장 <b className="text-[#a8873f]">{supplyNeeded}개</b></>}</>}
          </div>
        </div>
        <button onClick={() => setShowDaily(v => !v)} className="mt-3 text-[12.5px] font-semibold text-[#a8873f] hover:underline">
          {showDaily ? '▲ 날짜별 입력 접기' : '▼ 날짜별로 보기·수정'}
        </button>
        {showDaily && (
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
              <div key={day} className={`text-center ${day === todayDay ? 'ring-2 ring-[#b8995a] rounded-lg' : ''}`}>
                <p className={`text-[11px] mb-0.5 ${day === todayDay ? 'text-[#a8873f] font-black' : 'text-gray-400'}`}>{day}</p>
                <input
                  type="number" min={0}
                  value={dailySupplies[String(day)] || ''}
                  placeholder="0"
                  onChange={e => onChange(idx, 'daily_supplies', { ...dailySupplies, [String(day)]: Number(e.target.value) || 0 })}
                  className="w-full text-center text-[13px] font-bold text-gray-700 bg-white rounded-lg border border-gray-200 py-1.5 focus:outline-none focus:border-[#b8995a] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  결제율 대시보드 (전체현황 탭에 삽입)
// ════════════════════════════════════════════════════════════════════════════════
function PayRateSubView() {
  const today = todayStr()
  const month = today.slice(0, 7)
  const { total: tw, elapsed: we } = calcWorkingDays(today)

  const [saving,        setSaving]       = useState(false)
  const [reloading,     setReloading]    = useState(false)
  const [saveMsg,       setSaveMsg]      = useState('')
  const [autoStats,     setAutoStats]    = useState<{ name: string; contracted: number }[]>([])
  const [targetCount,   setTargetCount]  = useState(0)
  const [paymentCount,  setPaymentCount] = useState(0)  // contractWeight 기준 자동
  const [employeeCount, setEmployeeCount] = useState(0)
  // 관리팀 이번달 매출 (수수료 + 계약)
  const [opsRevenue, setOpsRevenue] = useState<{ fee: number; contract: number } | null>(null)
  const [opsContractCount, setOpsContractCount] = useState(0)
  // 관리팀 진행 케이스 요약
  const [opsCases,   setOpsCases]   = useState<any[]>([])
  // 인별 자동집계: 공급결제(공가) / 직접수(직가DB) / 직접결제(직가계약)
  const [autoByPerson,  setAutoByPerson] = useState<Record<string, AutoEmpData>>({})
  const [selfSuppliedMap, setSelfSuppliedMap] = useState<Record<string, number>>({})

  const mkRow = (name = ''): EmployeeRow => ({ name, target: 0, supply_count: 0, supply_payment: 0, direct_count: 0, direct_payment: 0 })
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestState   = useRef({ targetCount, employees, paymentCount, we, tw })

  useEffect(() => {
    async function load() {
      // 자동저장 대기 중이면 reload 건너뜀 (입력값 덮어쓰기 방지)
      if (autoSaveTimer.current) return
      try {
        const [payRes, custRes, userRes, revRes, casesRes, scRes] = await Promise.all([
          fetch(`/api/payrate?year_month=${month}`),
          fetch('/api/customers'),
          fetch('/api/users?role=sales'),
          fetch('/api/revenue'),
          fetch('/api/ops-cases'),
          fetch('/api/supply-config'),
        ])
        const [payJson, custJson, userJson, revJson, casesJson, scJson] = await Promise.all([
          payRes.json(), custRes.json(), userRes.json(), revRes.json(), casesRes.json(), scRes.json()
        ])
        // 직원별 목표 (supply-config.people[이름].goal)
        const goalMap: Record<string, number> = {}
        const scPeople = scJson?.config?.people || {}
        const selfMap: Record<string, number> = {}
        Object.entries(scPeople).forEach(([name, cfg]: [string, any]) => {
          goalMap[cleanName(name)] = Number(cfg.goal) || 0
          if ((cfg as any).self_supplied > 0) selfMap[cleanName(name)] = Number((cfg as any).self_supplied)
        })
        setSelfSuppliedMap(selfMap)
        setOpsCases(casesJson.cases || [])

        // 관리팀 이번달 매출 집계
        setOpsContractCount(Array.isArray(revJson.thisMonthOpsContracts) ? revJson.thisMonthOpsContracts.length : 0)
        const revThisMonth = (revJson.monthly || []).find((m: any) => m.fullMonth === month)
        setOpsRevenue({
          fee:      revThisMonth ? Number(revThisMonth['관리팀'] || 0) : 0,
          contract: revThisMonth ? Number(revThisMonth['관리팀계약'] || 0) : 0,
        })

        // 영업팀 사람 (TESTER 제외) — role=sales API 기준으로만 카운팅
        const people: string[] = (userJson.users || [])
          .filter((u: any) => u.name && u.name !== TESTER)
          .map((u: any) => u.name as string)
        const salesNameSet = new Set(people.map(cleanName))
        setEmployeeCount(people.length)

        // ★ contractWeight 기준 이번달 계약 집계 (TESTER 제외)
        // 공가(lead/consulting) 계약 → supply_payment
        // 직가(db010) 계약 → direct_payment
        // 직가 DB 추가 → direct_count
        const byPerson: Record<string, number> = {}
        const supplyPayMap:  Record<string, number> = {}
        const directPayMap:  Record<string, number> = {}
        const directCntMap:  Record<string, number> = {}

        ;(custJson.customers || [])
          .forEach((c: any) => {
            const name  = (c.details?.sales_user_name || c.sales_user_name || '').trim()
            if (!name || name === TESTER) return
            const contractMonth  = (c.details?.contract_date || c.created_at || '').slice(0, 7)
            // 직가 등록월: db010_month 우선, 없으면 접수일, 없으면 created_at
            // ⚡ reception_date는 통화접수일(지난달 가능)이므로 폴백에서 제외 → created_at 기준으로만 판단
            const receptionMonth = (c.details?.db010_month || c.created_at || '').slice(0, 7)
            // 계약 완료 시에도 원래 출처(공가/직가) 기준으로 분류 (is_direct 플래그 포함)
            const isDirectType = c.status === 'db010' || !!c.details?.db010_month || !!c.details?.is_direct

            // 전체 계약 집계 (기존)
            if (c.status === 'contracted' && contractMonth === month) {
              const w = contractWeight(c.details?.payment_amount, c.details?.vat_included)
              byPerson[name] = (byPerson[name] || 0) + w
              if (isDirectType) directPayMap[name] = (directPayMap[name] || 0) + w
              else              supplyPayMap[name]  = (supplyPayMap[name] || 0) + w
            }
            // 잔금 등 추가 입금 갯수 (입금한 달에 가산)
            if (c.status === 'contracted') {
              for (const ex of (Array.isArray(c.details?.extra_counts) ? c.details.extra_counts : [])) {
                if (String(ex?.date || '').slice(0, 7) !== month) continue
                const w = parseFloat(String(ex?.weight ?? 0)) || 0
                if (w <= 0) continue
                byPerson[name] = (byPerson[name] || 0) + w
                if (isDirectType) directPayMap[name] = (directPayMap[name] || 0) + w
                else              supplyPayMap[name]  = (supplyPayMap[name] || 0) + w
              }
            }
            // 직접수: 거절/삭제 이동해도 카운트 유지 (direct_count_voided=true일 때만 제외)
            // ⚡ reception_date는 통화접수일(지난달 가능)이므로 폴백에서 제외 → created_at 기준으로만 판단
            const isDirectMonth = isDirectType && receptionMonth === month
            const isVoided = c.details?.direct_count_voided === true
            if (isDirectMonth && !isVoided) {
              directCntMap[name] = (directCntMap[name] || 0) + 1
            }
          })

        // 인별 자동 집계 (직책 포함/미포함 이름 모두 지원)
        const allNames = new Set([
          ...Object.keys(supplyPayMap),
          ...Object.keys(directPayMap),
          ...Object.keys(directCntMap),
        ])
        const aMap: Record<string, AutoEmpData> = {}
        allNames.forEach(n => {
          const clean = cleanName(n)
          const key   = clean // 정규화된 이름으로 저장
          aMap[key] = {
            supply_payment: (supplyPayMap[n]  || 0) + (aMap[key]?.supply_payment || 0),
            direct_count:   (directCntMap[n]  || 0) + (aMap[key]?.direct_count   || 0),
            direct_payment: (directPayMap[n]  || 0) + (aMap[key]?.direct_payment  || 0),
          }
        })
        // 환불 차감: aMap 및 byPerson에서 weight 제거
        ;(custJson.customers || []).forEach((c: any) => {
          const dedMonth = c.details?.refund_deduction_month
          if (dedMonth !== month) return
          const rawName = (c.details?.refund_deduction_sales || '').trim()
          if (!rawName) return
          const w = parseFloat(String(c.details?.refund_deduction_weight || 0)) || 0
          if (w <= 0) return
          const cName = cleanName(rawName)
          if (aMap[cName]) {
            const deductFrom = aMap[cName].supply_payment >= w ? 'supply_payment' : 'direct_payment'
            aMap[cName][deductFrom] = Math.max(0, aMap[cName][deductFrom] - w)
          }
          const bpKey = Object.keys(byPerson).find(k => cleanName(k) === cName)
          if (bpKey) byPerson[bpKey] = Math.max(0, byPerson[bpKey] - w)
        })
        const statsAfterRefund = Object.entries(byPerson).map(([name, contracted]) => ({ name, contracted }))
        setAutoStats(statsAfterRefund)
        setPaymentCount(statsAfterRefund.reduce((s, v) => s + v.contracted, 0))

        setAutoByPerson(aMap)

        // 결제율 레코드 (DB → localStorage 순으로 폴백)
        if (payJson.record) {
          const r = payJson.record
          setTargetCount(r.target_count ?? 0)
          const saved = (r.employee_details || []).filter((e: EmployeeRow) => e.name !== TESTER)
          const baseRows = saved.length > 0 ? saved : people.map(mkRow)
          // ★ auto-sync: supply_payment/direct_payment/direct_count 모두 항상 DB 실시간값 사용
          //   (Math.max 제거 — 직가↔공가 전환, 계약취소 등 상태변경이 즉시 반영되어야 함)
          const syncRow = (row: EmployeeRow) => {
            const key  = cleanName(row.name)
            const auto = aMap[key]
            const goal = goalMap[key]   // supply-config에서 가져온 직원 목표
            const synced = auto ? {
              ...row,
              supply_payment: Math.max(Number(row.supply_payment),  auto.supply_payment),
              direct_count:   Math.max(Number(row.direct_count),    auto.direct_count),
              direct_payment: Math.max(Number(row.direct_payment),  auto.direct_payment),
            } : row
            // supply-config goal이 있으면 target을 항상 그 값으로 덮어씀 (읽기전용)
            return goal > 0 ? { ...synced, target: goal } : synced
          }
          // 영업팀만 포함 (저장된 rows에 관리팀 직원 행 섞인 경우 제거)
          const synced = baseRows
            .filter((row: EmployeeRow) => !row.name || salesNameSet.has(cleanName(row.name)))
            .map(syncRow)
          // fetch 완료 후에도 편집 중이면 덮어쓰기 금지
          if (!autoSaveTimer.current) setEmployees(synced)
        } else {
          // DB 레코드 없으면 localStorage 폴백 시도
          try {
            const lsKey = `payrate-draft-${month}`
            const draft = localStorage.getItem(lsKey)
            if (draft) {
              const d = JSON.parse(draft)
              if (d.target_count !== undefined) setTargetCount(d.target_count)
              const lsSaved = (d.employee_details || []).filter((e: EmployeeRow) => e.name !== TESTER)
              const baseRows = lsSaved.length > 0 ? lsSaved : people.map(mkRow)
              const synced = baseRows
                .filter((row: EmployeeRow) => !row.name || salesNameSet.has(cleanName(row.name)))
                .map((row: EmployeeRow) => {
                  const key  = cleanName(row.name)
                  const auto = aMap[key]
                  const goal = goalMap[key]
                  const r2 = auto ? {
                    ...row,
                    supply_payment: auto.supply_payment,
                    direct_count:   auto.direct_count,
                    direct_payment: auto.direct_payment,
                  } : row
                  return goal > 0 ? { ...r2, target: goal } : r2
                })
              if (!autoSaveTimer.current) setEmployees(synced)
            } else {
              if (!autoSaveTimer.current) setEmployees(people.map(mkRow))
            }
          } catch {
            if (!autoSaveTimer.current) setEmployees(people.map(n => {
              const goal = goalMap[cleanName(n)]
              return { ...mkRow(n), target: goal > 0 ? goal : 0 }
            }))
          }
        }
      } catch {}
    }
    load()
    const timer = setInterval(load, 30000)
    function onVisible() { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', load)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', load)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // latestState 항상 최신값 유지 (stale closure 방지)
  useEffect(() => {
    latestState.current = { targetCount, employees, paymentCount, we, tw }
  }, [targetCount, employees, paymentCount, we, tw])

  const LS_KEY = `payrate-draft-${month}`

  const doSave = useCallback(async (silent = false) => {
    const s = latestState.current
    if (!silent) { setSaving(true); setSaveMsg('') }
    const payload = {
      date: today,
      employee_count: s.employees.length,
      target_count: s.targetCount,
      payment_count: s.paymentCount,
      working_days_elapsed: s.we,
      total_working_days: s.tw,
      employee_details: s.employees,
    }
    // localStorage에 항상 백업 (새로고침 방어)
    try { localStorage.setItem(LS_KEY, JSON.stringify(payload)) } catch {}
    try {
      const res = await fetch('/api/payrate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!silent) {
        if (!res.ok) {
          setSaveMsg(`저장 실패: ${json.error || res.status}`)
        } else {
          setSaveMsg(json.record ? '저장 완료' : '저장 실패')
        }
        setSaving(false)
        setTimeout(() => setSaveMsg(''), 4000)
      } else {
        if (json.record) setSaveMsg('자동저장 ✓')
        setTimeout(() => setSaveMsg(''), 2000)
      }
    } catch (e: any) {
      if (!silent) {
        setSaveMsg(`네트워크 오류`)
        setSaving(false)
        setTimeout(() => setSaveMsg(''), 4000)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today])

  // unmount 시 타이머 정리 (좀비 저장 방지)
  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [])

  function scheduleAutoSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      // daily_supplies 입력이 하나라도 있어야만 자동저장 — target만 있는 빈 상태로 덮어쓰기 방지
      const s = latestState.current
      const hasSupplies = s.employees.some(
        r => Object.keys(r.daily_supplies || {}).length > 0
      )
      if (!hasSupplies) return
      doSave(true)
    }, 2000)
  }

  // 영업일 기준 계산
  const pc  = paymentCount, ec = employeeCount
  const remaining         = tw - we
  const expected          = we > 0 ? (pc / we) * tw : 0
  const expPerPersonMonth = ec > 0 ? expected / ec : 0
  const expPerPersonDay   = we > 0 && ec > 0 ? pc / we / ec : 0
  const tgtPerPersonDay   = tw > 0 && ec > 0 ? targetCount / tw / ec : 0
  const paceStatus        = we > 0 && tw > 0 ? (pc / we >= targetCount / tw ? 'GOOD' : 'BAD') : '-'
  const paceScore         = calcScore(pc, we, targetCount, tw)

  function updateEmp(i: number, f: string, v: number | string | Record<string, number>) {
    setEmployees(prev => {
      const n = [...prev]
      if (f === 'daily_supplies') {
        n[i] = { ...n[i], daily_supplies: v as Record<string, number> }
      } else {
        n[i] = { ...n[i], [f]: f === 'name' ? v : Number(v) }
      }
      return n
    })
    scheduleAutoSave()
  }
  function removeEmp(i: number) {
    setEmployees(prev => prev.filter((_, idx) => idx !== i))
    scheduleAutoSave()
  }

  function setTargetCountAndSave(v: number) {
    setTargetCount(v)
    scheduleAutoSave()
  }

  async function handleSave() { await doSave(false) }

  // 이전 기록 복구 — daily_supplies/target이 있는 가장 최근 레코드를 찾아 복구
  const [recovering, setRecovering] = useState(false)
  async function recoverFromPrevRecord() {
    setRecovering(true)
    setSaveMsg('')
    try {
      const res  = await fetch(`/api/payrate?year_month=${month}&find_nonempty=true`)
      const data = await res.json()
      if (!data.record?.employee_details?.length) {
        setSaveMsg('복구 가능한 이전 기록 없음')
        setTimeout(() => setSaveMsg(''), 3000)
        return
      }
      const prevDetails: EmployeeRow[] = data.record.employee_details
      const prevDate = data.record.record_date || '?'
      setEmployees(prev => prev.map(row => {
        const match = prevDetails.find(p => cleanName(p.name) === cleanName(row.name))
        if (!match) return row
        return {
          ...row,
          target:        match.target        || row.target,
          daily_supplies: match.daily_supplies || row.daily_supplies,
          direct_adjustment: match.direct_adjustment ?? row.direct_adjustment,
        }
      }))
      setSaveMsg(`✅ ${prevDate} 기록에서 복구 완료`)
      setTimeout(() => { setSaveMsg(''); scheduleAutoSave() }, 800)
    } catch {
      setSaveMsg('복구 실패')
    } finally {
      setRecovering(false)
      setTimeout(() => setSaveMsg(''), 4000)
    }
  }

  // 전월 목표 복사 (이번달 모든 target이 0일 때 전월 record에서 복사)
  const [copyingPrev, setCopyingPrev] = useState(false)
  async function copyPrevMonthTargets() {
    setCopyingPrev(true)
    try {
      const prevMonth = new Date(month + '-01')
      prevMonth.setMonth(prevMonth.getMonth() - 1)
      const ym = prevMonth.toISOString().slice(0, 7)
      const res  = await fetch(`/api/payrate?year_month=${ym}`)
      const data = await res.json()
      if (!data.record?.employee_details?.length) {
        setSaveMsg('전월 데이터 없음')
        setTimeout(() => setSaveMsg(''), 3000)
        return
      }
      const prevDetails: EmployeeRow[] = data.record.employee_details
      setEmployees(prev => prev.map(row => {
        const match = prevDetails.find(p => cleanName(p.name) === cleanName(row.name))
        if (!match) return row
        return { ...row, target: match.target, daily_supplies: {} }
      }))
      setSaveMsg('전월 목표 복사 완료 ✓')
      setTimeout(() => { setSaveMsg(''); scheduleAutoSave() }, 500)
    } catch {
      setSaveMsg('복사 실패')
    } finally {
      setCopyingPrev(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  const handleReload = useCallback(async () => {
    setReloading(true)
    setSaveMsg('')
    try {
      const [custRes, userRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/users?role=sales'),
      ])
      const [custJson, userJson] = await Promise.all([
        custRes.json(), userRes.json(),
      ])

      const people: string[] = (userJson.users || [])
        .filter((u: any) => u.name && u.name !== TESTER)
        .map((u: any) => u.name as string)
      const salesNameSet = new Set(people.map(cleanName))

      const supplyPayMap: Record<string, number> = {}
      const directPayMap: Record<string, number> = {}
      const directCntMap: Record<string, number> = {}
      const byPerson: Record<string, number> = {}

      ;(custJson.customers || []).forEach((c: any) => {
        const name = (c.details?.sales_user_name || c.sales_user_name || '').trim()
        if (!name || name === TESTER) return
        const contractMonth  = (c.details?.contract_date || c.created_at || '').slice(0, 7)
        const receptionMonth = (c.details?.db010_month || c.created_at || '').slice(0, 7)
        const isDirectType   = c.status === 'db010' || !!c.details?.db010_month || !!c.details?.is_direct

        if (c.status === 'contracted' && contractMonth === month) {
          const w = contractWeight(c.details?.payment_amount, c.details?.vat_included)
          byPerson[name] = (byPerson[name] || 0) + w
          if (isDirectType) directPayMap[name] = (directPayMap[name] || 0) + w
          else              supplyPayMap[name]  = (supplyPayMap[name] || 0) + w
        }
        if (c.status === 'contracted') {
          for (const ex of (Array.isArray(c.details?.extra_counts) ? c.details.extra_counts : [])) {
            if (String(ex?.date || '').slice(0, 7) !== month) continue
            const w = parseFloat(String(ex?.weight ?? 0)) || 0
            if (w <= 0) continue
            byPerson[name] = (byPerson[name] || 0) + w
            if (isDirectType) directPayMap[name] = (directPayMap[name] || 0) + w
            else              supplyPayMap[name]  = (supplyPayMap[name] || 0) + w
          }
        }
        const isDirectMonth = isDirectType && receptionMonth === month
        const isVoided = c.details?.direct_count_voided === true
        if (isDirectMonth && !isVoided) {
          directCntMap[name] = (directCntMap[name] || 0) + 1
        }
      })

      const allNames = new Set([
        ...Object.keys(supplyPayMap),
        ...Object.keys(directPayMap),
        ...Object.keys(directCntMap),
      ])
      const aMap: Record<string, AutoEmpData> = {}
      allNames.forEach(n => {
        const clean = cleanName(n)
        aMap[clean] = {
          supply_payment: (supplyPayMap[n] || 0) + (aMap[clean]?.supply_payment || 0),
          direct_count:   (directCntMap[n] || 0) + (aMap[clean]?.direct_count   || 0),
          direct_payment: (directPayMap[n] || 0) + (aMap[clean]?.direct_payment  || 0),
        }
      })

      const stats = Object.entries(byPerson).map(([name, contracted]) => ({ name, contracted }))
      setAutoStats(stats)
      setPaymentCount(stats.reduce((s, v) => s + v.contracted, 0))
      setAutoByPerson(aMap)

      setEmployees(prev => prev
        .filter(row => !row.name || salesNameSet.has(cleanName(row.name)))
        .map(row => {
          const key  = cleanName(row.name)
          const auto = aMap[key]
          if (!auto) return row
          return {
            ...row,
            supply_payment: Math.max(Number(row.supply_payment), auto.supply_payment),
            direct_count:   Math.max(Number(row.direct_count),   auto.direct_count),
            direct_payment: Math.max(Number(row.direct_payment), auto.direct_payment),
          }
        })
      )
      scheduleAutoSave()
      setSaveMsg('불러오기 완료 ✓')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch {
      setSaveMsg('불러오기 실패')
    } finally {
      setReloading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const totTarget   = employees.reduce((s, r) => s + Number(r.target), 0)
  // 직원 카드 표시값 기준 합산 (auto-sync 이미 반영된 row 값 직접 사용)
  const totSupply    = employees.filter(r => r.name !== TESTER)
    .reduce((s, r) => s + Object.values(r.daily_supplies || {}).reduce((a, v) => a + Number(v || 0), 0), 0)
  const totSupplyPay = employees.filter(r => r.name !== TESTER)
    .reduce((s, r) => s + Number(r.supply_payment), 0)
  const totDirectPay = employees.filter(r => r.name !== TESTER)
    .reduce((s, r) => s + Number(r.direct_payment), 0)
  const totPayment   = totSupplyPay + totDirectPay
  // 총결제율 = (공가+직가) / 공급갯수 × 100
  const totTotalRate = totSupply > 0 ? (totPayment / totSupply * 100) : null

  const man = (v: number) => (v >= 100000000 ? parseFloat((v / 100000000).toFixed(2)) + '억' : Math.round(v / 10000).toLocaleString('ko-KR') + '만')

  // ── 관리팀 현황 계산 (관리팀 화면과 같은 기준) ──
  const INST_LIST = ['중진공', '소진공(혁신)', '소진공(신취)', '소진공(재도전)', '기보', '신보', '재단', '서민금융(미소)']
  const REFUND_KEYS = new Set(['환불', 'refunded'])
  const DONE_KEYS = new Set(['종료', '완료', 'completed'])
  const PENDING_R = new Set(['환불예정'])
  const PENDING_D = new Set(['종료예정'])
  const INDIRECT_INST = new Set(['기보', '신보', '재단'])
  const UPCOMING = new Set(['', '미선택', '서류받는중', '접수전'])
  const isHolding = (c: any) => !!c.details?.is_holding
  const isHandling = (c: any) => !!(c.details?.handling_no_contact || c.details?.handling_no_fit || c.details?.handling_mindless)
  const activeCases = opsCases.filter(c => !c.is_completed && !c.is_refund && !REFUND_KEYS.has(c.stage ?? '') && !DONE_KEYS.has(c.stage ?? ''))
  const regularCases = activeCases.filter(c => !PENDING_R.has(c.stage ?? '') && !PENDING_D.has(c.stage ?? '') && !isHolding(c) && !isHandling(c))
  // 진행 중 = 직접/간접 자금 중 하나라도 접수 이후 단계, 대기 = 아직 서류·접수 전
  const startedCase = (c: any) => [c.details?.direct_stage, c.details?.indirect_stage].some((st: string) => st && !UPCOMING.has(st))
  const inProgressN = regularCases.filter(startedCase).length
  const waitingN = regularCases.length - inProgressN
  const instStats = INST_LIST.map(inst => {
    const matched = regularCases.filter(c => (c.institution || '').split(',').map((x: string) => x.trim()).includes(inst))
    const isIndirect = INDIRECT_INST.has(inst)
    const waiting = matched.filter(c => UPCOMING.has(isIndirect ? (c.details?.indirect_stage || '') : (c.details?.direct_stage || '')))
    return { inst, label: inst === '서민금융(미소)' ? '미소' : inst, active: matched.length - waiting.length, waiting: waiting.length, total: matched.length }
  }).filter(x => x.total > 0)
  const hasStageAny = (c: any, set: string[]) => { const t = new Set(set); return t.has(c.details?.direct_stage ?? '') || t.has(c.details?.indirect_stage ?? '') || t.has(c.stage ?? '') }
  const companyName = (c: any) => c.customers?.details?.company || c.customers?.name || c.customer_name || '-'
  const stageGroups = [
    { label: '반려보정', tone: 'bg-orange-50 border-orange-200 text-orange-800', dot: 'bg-orange-500', cases: activeCases.filter(c => hasStageAny(c, ['반려보정'])) },
    { label: '실사대기', tone: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500', cases: activeCases.filter(c => hasStageAny(c, ['실사대기'])) },
    { label: '자금승인 · 입금대기', tone: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500', cases: activeCases.filter(c => hasStageAny(c, ['승인대기', '승인', '입금전'])) },
  ].filter(g => g.cases.length > 0)
  const opsTotal = (opsRevenue?.fee || 0) + (opsRevenue?.contract || 0)

  return (
    <div className="space-y-8 pb-4">

      {/* ═════════ 영업팀 ═════════ */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h3 className="text-[19px] font-black text-[#0b2140]">영업팀 <span className="text-[14px] font-semibold text-gray-400 ml-1">{month.replace('-', '년 ')}월</span></h3>
            <p className="text-[13px] text-gray-500 mt-0.5">목표 · 결제율 · 갯수 · 달성률, 오늘 DB 공급 갯수는 카드에서 직접 입력하세요</p>
          </div>
          <div className="flex items-center gap-2">
            {employees.length > 0 && employees.every(r => Number(r.target) === 0 && Object.keys(r.daily_supplies || {}).length === 0) && (
              <button onClick={recoverFromPrevRecord} disabled={recovering} className="text-[12.5px] font-bold bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg">{recovering ? '복구 중…' : '🔁 이전 기록 복구'}</button>
            )}
            {employees.length > 0 && employees.every(r => Number(r.target) === 0) && (
              <button onClick={copyPrevMonthTargets} disabled={copyingPrev} className="text-[12.5px] font-bold bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg">{copyingPrev ? '복사 중…' : '📋 전월 목표 복사'}</button>
            )}
          </div>
        </div>

        {employees.length >= 2 && (
          <div className="rounded-3xl p-5 mb-4 text-white bg-gradient-to-br from-[#10203a] to-[#0a1424] grid grid-cols-3 gap-3 text-center shadow-[0_18px_40px_-26px_rgba(11,33,64,.8)]">
            <div><p className="text-[13px] text-white/60 font-semibold">팀 목표</p><p className="text-[28px] font-black tabular-nums">{totTarget}<span className="text-[14px] text-white/50"> 건</span></p></div>
            <div><p className="text-[13px] text-white/60 font-semibold">팀 총결제</p><p className="text-[28px] font-black tabular-nums text-[#7ee0b5]">{totPayment % 1 === 0 ? totPayment : totPayment.toFixed(1)}<span className="text-[14px] text-white/50"> 건</span></p></div>
            <div><p className="text-[13px] text-white/60 font-semibold">팀 총결제율</p><p className="text-[28px] font-black tabular-nums text-[#E8D080]">{totTotalRate !== null ? totTotalRate.toFixed(1) + '%' : '—'}</p></div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {employees.filter(r => r.name !== TESTER).map((row, i) => (
            <EmpCard
              key={i} row={row} idx={i} we={we} tw={tw}
              onChange={updateEmp} onRemove={removeEmp}
              autoData={autoByPerson[cleanName(row.name)] || autoByPerson[row.name] || { supply_payment: 0, direct_count: 0, direct_payment: 0 }}
              selfSupplied={selfSuppliedMap[cleanName(row.name)] || 0}
            />
          ))}
        </div>
      </section>

      {/* ═════════ 관리팀 ═════════ */}
      {(opsRevenue !== null || opsCases.length > 0) && (
        <section>
          <div className="mb-4">
            <h3 className="text-[19px] font-black text-[#0b2140]">관리팀 <span className="text-[14px] font-semibold text-gray-400 ml-1">{month.replace('-', '년 ')}월</span></h3>
            <p className="text-[13px] text-gray-500 mt-0.5">진행 중 · 대기 중, 단계별 업체, 매출, 계약 건수</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="rounded-3xl p-4 text-white bg-gradient-to-br from-[#10203a] to-[#0a1424]">
              <p className="text-[13px] text-white/60 font-semibold">이번 달 매출</p>
              <p className="text-[28px] leading-tight font-black text-[#E8D080] tabular-nums mt-1">{man(opsTotal)}</p>
              <p className="text-[12.5px] text-white/50 mt-0.5">수수료 {man(opsRevenue?.fee || 0)} · 계약 {man(opsRevenue?.contract || 0)}</p>
            </div>
            <div className="rounded-3xl border border-gray-100 bg-white p-4">
              <p className="text-[13px] text-gray-500 font-semibold">계약</p>
              <p className="text-[28px] leading-tight font-black text-[#0b2140] tabular-nums mt-1">{opsContractCount}<span className="text-[15px] text-gray-400 font-semibold"> 건</span></p>
              <p className="text-[12.5px] text-gray-400 mt-0.5">이번 달 관리팀 계약</p>
            </div>
            <div className="rounded-3xl border border-sky-100 bg-sky-50 p-4">
              <p className="text-[13px] text-sky-700 font-semibold">진행 중</p>
              <p className="text-[28px] leading-tight font-black text-sky-800 tabular-nums mt-1">{inProgressN}<span className="text-[15px] text-sky-500 font-semibold"> 건</span></p>
              <p className="text-[12.5px] text-sky-600/70 mt-0.5">접수 이후 단계</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-[13px] text-gray-600 font-semibold">대기 중</p>
              <p className="text-[28px] leading-tight font-black text-gray-700 tabular-nums mt-1">{waitingN}<span className="text-[15px] text-gray-400 font-semibold"> 건</span></p>
              <p className="text-[12.5px] text-gray-400 mt-0.5">서류·접수 전</p>
            </div>
          </div>

          {instStats.length > 0 && (
            <div className="mb-5">
              <p className="text-[14px] font-black text-[#0b2140] mb-2.5">기관별 현황</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {instStats.map(x => (
                  <div key={x.inst} className="rounded-2xl border border-gray-100 bg-white px-3.5 py-3">
                    <p className="text-[14px] font-black text-[#0b2140] truncate">{x.label}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[12.5px] font-bold bg-sky-100 text-sky-700 rounded-full px-2.5 py-0.5">진행 {x.active}</span>
                      <span className="text-[12.5px] font-bold bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">대기 {x.waiting}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stageGroups.length > 0 && (
            <div>
              <p className="text-[14px] font-black text-[#0b2140] mb-2.5">단계별 업체</p>
              <div className="space-y-2.5">
                {stageGroups.map(g => (
                  <div key={g.label} className={`flex items-start gap-3 border rounded-2xl px-4 py-3 ${g.tone}`}>
                    <span className={`mt-2 w-2.5 h-2.5 rounded-full shrink-0 ${g.dot}`} />
                    <div className="min-w-0">
                      <p className="text-[14px] font-black">{g.label} <span className="font-semibold opacity-70">({g.cases.length}건)</span></p>
                      <p className="text-[14px] font-medium mt-1 leading-relaxed">{g.cases.map(c => companyName(c)).join(' · ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {instStats.length === 0 && stageGroups.length === 0 && (
            <p className="text-[13.5px] text-gray-400 text-center py-3">진행 중인 케이스가 없어요</p>
          )}
        </section>
      )}

      {/* ─── 저장 · 불러오기 ─── */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        {saveMsg && <span className={`text-sm font-medium ${saveMsg.includes('완료') || saveMsg.includes('✓') ? 'text-emerald-600' : 'text-red-500'}`}>{saveMsg}</span>}
        <button onClick={handleReload} disabled={reloading || saving}
          className="bg-white hover:bg-gray-50 disabled:opacity-40 text-[#0b2140] border-2 border-gray-200 px-5 py-2.5 rounded-2xl text-[13.5px] font-bold transition-colors">
          {reloading ? '불러오는 중…' : '🔄 DB 불러오기'}
        </button>
        <button onClick={handleSave} disabled={saving}
          className="bg-gradient-to-r from-[#0b2140] to-[#4a5a9a] hover:-translate-y-0.5 disabled:opacity-40 text-white px-8 py-2.5 rounded-2xl text-[13.5px] font-bold shadow-[0_10px_22px_-10px_rgba(11,33,64,.7)] transition-all">
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
//  손익계산 (analytics 탭 급여·손익에서 사용)
// ════════════════════════════════════════════════════════════════════════════════
export function PnlSubView() {
  const today = todayStr()
  const [saving, setSaving] = useState(false)
  const [msg,    setMsg]    = useState('')

  const [salesEmps,  setSalesEmps]  = useState<SalesEmp[]>([])
  const [opsEmps,    setOpsEmps]    = useState<OpsEmp[]>([])
  const [otherCosts, setOtherCosts] = useState<OtherCost>({
    ad_marketing: 0, db: 0, rent: 0, mgmt: 0, sales_fixed: 0, sales_other: 0,
  })
  const [ceoSalary,      setCeoSalary]      = useState(0)
  const [dbCount,        setDbCount]        = useState(0)
  const [dbUnitPrice,    setDbUnitPrice]    = useState(0)
  const [dbPurchaseCost, setDbPurchaseCost] = useState(0)

  // 3개월 손익 비교
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; fullMonth: string; 영업팀: number; 관리팀: number; 관리팀계약: number; 합계: number }[]>([])
  useEffect(() => {
    fetch('/api/revenue').then(r => r.json()).then(j => {
      if (j.monthly) setMonthlyRevenue(j.monthly)
    }).catch(() => {})
  }, [])

  const salesTotal       = salesEmps.reduce((s, e) => s + Number(e.sales_vat_incl), 0)
  const opsFeeTotal      = opsEmps.reduce((s, e) => s + Number(e.fee_vat_incl), 0)
  const opsContractTotal = opsEmps.reduce((s, e) => s + Number(e.contract_vat_incl), 0)
  const totalRevenue     = salesTotal + opsFeeTotal + opsContractTotal

  function calcPromo(revenue: number, contracts: number) {
    const c = Number(contracts)
    const baseRate = c >= 12 ? 0.30 : 0.25
    const bonus    = c >= 40 ? 1500000 : c >= 30 ? 1000000 : c >= 23 ? 700000 : c >= 20 ? 500000 : 0
    return { baseRate, bonus, promoWage: revenue * baseRate + bonus }
  }

  const salesTax  = salesTotal * 0.10
  const salesWage = salesEmps.reduce((s, e) => {
    const has = Number(e.contracts) > 0
    const r   = Number(e.sales_vat_incl)
    return s + (has ? calcPromo(r, e.contracts).promoWage : r * 0.30)
  }, 0)
  const otherTotal    = Object.values(otherCosts).reduce((s, v) => s + Number(v), 0)
  const totalCost     = salesTax + salesWage + otherTotal
  const netProfit     = totalRevenue - totalCost
  const personalProfit = netProfit - Number(ceoSalary)
  const ifRevenue     = Number(dbCount) * Number(dbUnitPrice)
  const ifProfit      = ifRevenue - ifRevenue * 0.10 - Number(dbPurchaseCost) - Number(ceoSalary)

  const iCls = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
  const rCls = 'bg-gray-50 text-gray-600 text-sm px-2 py-1.5 rounded-lg text-right whitespace-nowrap'

  const PNL_LS_KEY = `pnl-draft-${today}`

  useEffect(() => {
    const month = today.slice(0, 7)
    // payrate에서 직원별 공급수(daily_supplies 합산) 가져오기
    function buildSupplyMap(payRecord: any): Record<string, number> {
      const map: Record<string, number> = {}
      for (const e of (payRecord?.employee_details || [])) {
        if (!e.name) continue
        const cnt = Object.values(e.daily_supplies || {}).reduce((s: number, v: any) => s + Number(v || 0), 0)
        map[cleanName(e.name)] = cnt
      }
      return map
    }
    function applySupply(emps: SalesEmp[], supplyMap: Record<string, number>): SalesEmp[] {
      return emps.map(e => ({
        ...e,
        supply_count: supplyMap[cleanName(e.name)] ?? e.supply_count ?? 0,
      }))
    }

    Promise.all([
      fetch(`/api/pnl?date=${today}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/payrate?year_month=${month}`).then(r => r.json()).catch(() => ({})),
    ]).then(([pnlJson, payJson]) => {
      const supplyMap = buildSupplyMap(payJson.record)

      if (!pnlJson.record) {
        try {
          const draft = localStorage.getItem(PNL_LS_KEY)
          if (draft) {
            const d = JSON.parse(draft)
            if (Array.isArray(d.sales_employees)) setSalesEmps(applySupply(d.sales_employees, supplyMap))
            if (Array.isArray(d.ops_employees))   setOpsEmps(d.ops_employees)
            if (d.other_costs)                    setOtherCosts(d.other_costs)
            if (d.ceo_salary !== undefined)       setCeoSalary(d.ceo_salary)
          }
        } catch {}
        return
      }
      const r = pnlJson.record
      if (Array.isArray(r.sales_employees)) setSalesEmps(applySupply(r.sales_employees, supplyMap))
      if (Array.isArray(r.ops_employees))   setOpsEmps(r.ops_employees)
      if (r.other_costs)                    setOtherCosts(r.other_costs)
      if (r.ceo_salary !== undefined)       setCeoSalary(r.ceo_salary)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave() {
    setSaving(true); setMsg('')
    const payload = { date: today, sales_employees: salesEmps, ops_employees: opsEmps, other_costs: otherCosts, ceo_salary: ceoSalary }
    // localStorage 항상 백업
    try { localStorage.setItem(PNL_LS_KEY, JSON.stringify(payload)) } catch {}
    try {
      const res  = await fetch('/api/pnl', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg(`저장 실패: ${json.error || res.status}`)
      } else {
        setMsg(json.record ? '저장 완료' : '저장 실패')
      }
    } catch {
      setMsg('네트워크 오류 (로컬 백업됨)')
    }
    setSaving(false)
    setTimeout(() => setMsg(''), 4000)
  }

  function updSales(i: number, f: keyof SalesEmp, v: string) {
    setSalesEmps(prev => { const n = [...prev]; n[i] = { ...n[i], [f]: f === 'name' ? v : Number(v) }; return n })
  }
  function updOps(i: number, f: keyof OpsEmp, v: string) {
    setOpsEmps(prev => { const n = [...prev]; n[i] = { ...n[i], [f]: f === 'name' ? v : Number(v) }; return n })
  }

  // 월별 비교용 최근 3개월
  const last3 = monthlyRevenue.slice(-3)

  return (
    <div className="space-y-5 pb-8">
      {/* ── 월별 손익 3개월 비교 ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-gray-800 mb-3">월별 매출 3개월 비교</h3>
        {last3.length === 0 ? (
          <p className="text-xs text-gray-400">데이터 불러오는 중...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">구분</th>
                  {last3.map(m => (
                    <th key={m.fullMonth} className="px-3 py-2 text-right">
                      {m.month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: '영업팀 매출', key: '영업팀' as const, color: 'text-blue-700' },
                  { label: '관리팀 수수료', key: '관리팀' as const, color: 'text-emerald-700' },
                  { label: '관리팀 계약', key: '관리팀계약' as const, color: 'text-violet-700' },
                  { label: '합계', key: '합계' as const, color: 'text-gray-900' },
                ].map(row => (
                  <tr key={row.key} className={`border-t border-gray-50 ${row.key === '합계' ? 'font-bold bg-gray-50' : ''}`}>
                    <td className="px-3 py-2 text-xs text-gray-500">{row.label}</td>
                    {last3.map(m => (
                      <td key={m.fullMonth} className={`px-3 py-2 text-right text-xs ${row.color}`}>
                        {m[row.key] > 0
                          ? (m[row.key] >= 100000000
                            ? (m[row.key] / 100000000).toFixed(1) + '억'
                            : (m[row.key] / 10000).toFixed(0) + '만')
                          : <span className="text-gray-300 text-[10px]">아직 매출 입력 전</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400">{today}</p>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-sm font-medium ${msg.includes('저장 완료') ? 'text-emerald-600' : msg.includes('실패') || msg.includes('오류') ? 'text-red-500' : 'text-gray-500'}`}>{msg}</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-[#1B2A45] hover:bg-[#263d66] text-white px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition-colors">
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700">매출</h3>
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h4 className="text-xs font-bold text-gray-500 mb-3">영업팀</h4>
            <div className="space-y-2">
              {salesEmps.map((e, i) => {
                const promo = calcPromo(Number(e.sales_vat_incl), e.contracts)
                const has   = Number(e.contracts) > 0
                return (
                  <div key={i}>
                    <div className="grid grid-cols-[100px_1fr_60px_auto_auto_auto_24px] gap-1.5 items-center">
                      <input type="text" value={e.name} onChange={ev => updSales(i, 'name', ev.target.value)} className={iCls} placeholder="직원명" />
                      <input type="number" value={e.sales_vat_incl} onChange={ev => updSales(i, 'sales_vat_incl', ev.target.value)} className={iCls} placeholder="매출(부가세제외)" min={0} />
                      <input type="number" value={e.contracts} onChange={ev => updSales(i, 'contracts', ev.target.value)} className={iCls} placeholder="계약수" min={0} />
                      <span className={rCls}>{has ? `${(promo.baseRate*100).toFixed(0)}%` : '30%'}</span>
                      <span className={rCls}>{has ? promo.bonus.toLocaleString('ko-KR') : '—'}</span>
                      <span className="text-sm font-bold text-blue-700 text-right whitespace-nowrap">
                        {Math.round(has ? promo.promoWage : Number(e.sales_vat_incl)*0.30).toLocaleString('ko-KR')}
                      </span>
                      <button onClick={() => setSalesEmps(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                    </div>
                    {(e.supply_count !== undefined && e.supply_count > 0) && (
                      <div className="flex items-center gap-1.5 mt-0.5 mb-1 ml-1">
                        <span className="text-[9px] bg-sky-100 text-sky-600 rounded-full px-2 py-0.5 font-semibold">
                          공급수 {e.supply_count}개 · 결제율탭 자동반영
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-300 mt-2">계약수 미입력 시 30% 고정</p>
            <button onClick={() => setSalesEmps(prev => [...prev, { name: '', sales_vat_incl: 0, contracts: 0 }])}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-medium">+ 영업팀 직원 추가</button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h4 className="text-xs font-bold text-gray-500 mb-3">관리팀</h4>
            <div className="space-y-2">
              {opsEmps.map((e, i) => (
                <div key={i} className="grid grid-cols-[100px_1fr_1fr_24px] gap-1.5 items-center">
                  <input type="text" value={e.name} onChange={ev => updOps(i, 'name', ev.target.value)} className={iCls} placeholder="직원명" />
                  <input type="number" value={e.fee_vat_incl} onChange={ev => updOps(i, 'fee_vat_incl', ev.target.value)} className={iCls} placeholder="수수료(부가세제외)" min={0} />
                  <input type="number" value={e.contract_vat_incl} onChange={ev => updOps(i, 'contract_vat_incl', ev.target.value)} className={iCls} placeholder="계약(부가세제외)" min={0} />
                  <button onClick={() => setOpsEmps(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setOpsEmps(prev => [...prev, { name: '', fee_vat_incl: 0, contract_vat_incl: 0 }])}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-medium">+ 관리팀 직원 추가</button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-700">매입 / 비용</h3>
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
                    <span className={rCls}>{Math.round(amt*0.10).toLocaleString('ko-KR')}</span>
                    <span className={rCls}>{Math.round(wage).toLocaleString('ko-KR')}</span>
                  </div>
                )
              })}
              <div className="grid grid-cols-[100px_1fr_1fr] gap-2 border-t border-gray-100 pt-1">
                <span className="text-xs font-bold text-gray-500">소계</span>
                <span className={rCls + ' font-bold'}>{Math.round(salesTax).toLocaleString('ko-KR')}</span>
                <span className={rCls + ' font-bold'}>{Math.round(salesWage).toLocaleString('ko-KR')}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h4 className="text-xs font-bold text-gray-500 mb-3">기타 운영비</h4>
            <div className="space-y-2">
              {([
                ['ad_marketing','광고/마케팅'],['db','DB'],['rent','임대료'],
                ['mgmt','관리비'],['sales_fixed','영업고정비용'],['sales_other','영업기타비용'],
              ] as [keyof OtherCost, string][]).map(([f, label]) => (
                <div key={f} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
                  <input type="number" value={otherCosts[f]} onChange={e => setOtherCosts(prev => ({ ...prev, [f]: Number(e.target.value) }))} className={iCls} min={0} />
                  <span className="text-xs text-gray-400 w-24 text-right shrink-0">{Number(otherCosts[f]).toLocaleString('ko-KR')}원</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1B2A45] text-white rounded-2xl p-5 space-y-2">
            <h4 className="text-xs font-bold text-white/50 mb-3 uppercase tracking-wide">손익 요약</h4>
            <div className="flex justify-between text-sm"><span className="text-white/60">총 매출</span><span className="font-bold">{totalRevenue.toLocaleString('ko-KR')}원</span></div>
            <div className="flex justify-between text-sm"><span className="text-white/60">총 매입</span><span className="font-bold text-white/70">{totalCost.toLocaleString('ko-KR')}원</span></div>
            <div className="border-t border-white/20 pt-2 flex justify-between text-base font-black">
              <span>순이익</span>
              <span className={netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>{netProfit.toLocaleString('ko-KR')}원</span>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">개인 고정 생활비</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs text-rose-600">카드값</span><span className="text-sm font-black text-rose-700">300만원</span>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5 flex items-center justify-between">
                <span className="text-xs text-orange-600">집월세</span><span className="text-sm font-black text-orange-700">65만원</span>
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

      <div className="bg-white rounded-2xl border border-gray-100 p-5 max-w-sm">
        <h4 className="text-sm font-bold text-gray-700 mb-4">DB 미니 계산기</h4>
        <div className="space-y-2.5">
          {([
            ['DB 개수', dbCount, setDbCount], ['DB 단가(원/개)', dbUnitPrice, setDbUnitPrice],
            ['DB 구매비용', dbPurchaseCost, setDbPurchaseCost], ['대표 개인 월급', ceoSalary, setCeoSalary],
          ] as [string, number, (v: number) => void][]).map(([label, val, setter]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
              <input type="number" value={val} onChange={e => setter(Number(e.target.value))} className={iCls} min={0} />
            </div>
          ))}
          <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">IF 매출</span><span>{ifRevenue.toLocaleString('ko-KR')}원</span></div>
            <div className="flex justify-between"><span className="text-gray-400">세금 10%</span><span>{Math.round(ifRevenue*0.10).toLocaleString('ko-KR')}원</span></div>
            <div className="flex justify-between font-bold">
              <span>IF 수익</span><span className={ifProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{Math.round(ifProfit).toLocaleString('ko-KR')}원</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>개인 수익</span><span className={personalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>{Math.round(personalProfit).toLocaleString('ko-KR')}원</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 기본 export: 전체현황 탭에서 직접 사용 ───────────────────────────────────
export default function PayRateTab() {
  return <PayRateSubView />
}
