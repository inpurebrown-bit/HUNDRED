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
function todayStr() { return new Date().toISOString().slice(0, 10) }

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

function EmpCard({
  row, idx, we, tw, onChange, onRemove, autoData,
}: {
  row: EmployeeRow; idx: number; we: number; tw: number
  onChange: (i: number, f: string, v: number | string | Record<string, number>) => void
  onRemove: (i: number) => void
  autoData: AutoEmpData
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

  // 수동편집 필드 (DB자동값 동기화 버튼 포함)
  function EditableAutoField({
    label, field, value, autoVal, color,
  }: { label: string; field: string; value: number; autoVal: number; color: string }) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-0.5">
          <p className={`text-[9px] font-medium ${color}`}>{label}</p>
          {autoVal !== value && (
            <button
              title={`DB자동값(${fmtVal(autoVal)})으로 동기화`}
              onClick={() => onChange(idx, field, autoVal)}
              className="text-[8px] text-gray-400 hover:text-blue-500 transition-colors"
            >동기화</button>
          )}
        </div>
        <div className="relative w-full">
          <input
            type="number" min={0} step={0.5} value={value}
            onChange={e => onChange(idx, field, Number(e.target.value))}
            className="w-full text-center text-sm font-bold text-gray-800 bg-white rounded-xl
              border border-gray-200 px-1 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {autoVal > 0 && autoVal !== value && (
            <span className="absolute -bottom-3 left-0 right-0 text-center text-[7px] text-gray-400">DB:{fmtVal(autoVal)}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
      {/* ── 헤더 ── */}
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
              hover:border-gray-300 focus:border-blue-500 focus:outline-none text-sm w-28"
          />
        </div>
        <div className="flex items-center gap-2">
          <PaceBadge status={status} score={score} />
          <button onClick={() => onRemove(idx)} className="text-gray-300 hover:text-red-400 text-xs transition-colors">✕</button>
        </div>
      </div>

      {/* ── 5개 수치 ── */}
      <div className="grid grid-cols-5 gap-1.5 pb-3">
        {/* 목표 */}
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-[9px] text-gray-400 font-medium">목표</p>
          <input
            type="number" min={0} value={row.target}
            onChange={e => onChange(idx, 'target', Number(e.target.value))}
            className="w-full text-center text-sm font-bold text-gray-800 bg-white rounded-xl
              border border-gray-200 px-1 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300
              [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
        {/* 공급수 - 일별 합산 자동 */}
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-[9px] text-sky-500 font-medium">공급수</p>
          <div className="w-full text-center text-sm font-bold text-sky-700 bg-sky-50 rounded-xl border border-sky-100 px-1 py-2">
            {supplyCount}
          </div>
        </div>
        {/* 공급결제 - 수동 (DB자동값 참고) */}
        <EditableAutoField label="공급결제" field="supply_payment"
          value={supplyPayment} autoVal={autoData.supply_payment} color="text-emerald-600" />
        {/* 직접수 - 자동집계 + 대표 차감 버튼 */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-0.5">
            <p className="text-[9px] font-medium text-violet-600">직접수</p>
            {directAdjustment < 0 && (
              <span className="text-[8px] text-red-400 font-bold">{directAdjustment}</span>
            )}
          </div>
          <div className="w-full text-center text-sm font-bold text-violet-700 bg-violet-50 rounded-xl border border-violet-100 px-1 py-2">
            {directCount}
          </div>
          <button
            title="직접수 1개 취소 (실수 등록 시 대표만 사용)"
            onClick={() => onChange(idx, 'direct_adjustment', directAdjustment - 1)}
            className="text-[8px] text-red-300 hover:text-red-500 hover:bg-red-50 rounded px-1 py-0.5 transition-colors font-semibold"
          >−1 취소</button>
          {directAdjustment < 0 && (
            <button
              title="차감 취소 (복원)"
              onClick={() => onChange(idx, 'direct_adjustment', directAdjustment + 1)}
              className="text-[8px] text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded px-1 py-0.5 transition-colors"
            >+1 복원</button>
          )}
        </div>
        {/* 직접결제 - 수동 */}
        <EditableAutoField label="직접결제" field="direct_payment"
          value={directPayment} autoVal={autoData.direct_payment} color="text-purple-600" />
      </div>

      {/* ── 목표 달성률 ── */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-[10px] text-gray-400">목표 달성률</span>
          <span className="text-[10px] font-bold text-gray-600">{fmtVal(total)} / {Number(row.target)}개 · {achievePct}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${achievePct >= 100 ? 'bg-emerald-500' : achievePct >= 60 ? 'bg-blue-500' : 'bg-amber-400'}`}
            style={{ width: `${Math.min(100, achievePct)}%` }} />
        </div>
      </div>

      {/* ── 6박스: 총결제 / 공급결제율 / 직접결제율 / 총결제율 / 공급예정 / 목표까지 ── */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-emerald-50 rounded-xl py-2 text-center">
          <p className="text-[9px] text-emerald-500">총결제</p>
          <p className="text-base font-black text-emerald-700">{fmtVal(total)}</p>
        </div>
        <div className="bg-blue-50 rounded-xl py-2 text-center">
          <p className="text-[9px] text-blue-500">공급결제율</p>
          <p className="text-sm font-black text-blue-700">{fmtPct(supplyRate)}</p>
          {supplyRate !== null && (
            <p className={`text-[9px] mt-0.5 ${rateGrade(supplyRate, 40).cls}`}>{rateGrade(supplyRate, 40).label}</p>
          )}
        </div>
        <div className="bg-violet-50 rounded-xl py-2 text-center">
          <p className="text-[9px] text-violet-500">직접결제율</p>
          <p className="text-sm font-black text-violet-700">{fmtPct(directRate)}</p>
        </div>
        <div className="bg-teal-50 rounded-xl py-2 text-center">
          <p className="text-[9px] text-teal-600">총결제율</p>
          <p className="text-sm font-black text-teal-700">{fmtPct(totalRate)}</p>
          {totalRate !== null && (
            <p className={`text-[9px] mt-0.5 ${rateGrade(totalRate, 30).cls}`}>{rateGrade(totalRate, 30).label}</p>
          )}
        </div>
        <div className={`rounded-xl py-2 text-center ${dailyRec === 0 && supplyRate !== null ? 'bg-red-50' : 'bg-amber-50'}`}>
          <p className={`text-[9px] ${dailyRec === 0 && supplyRate !== null ? 'text-red-500' : 'text-amber-600'}`}>공급예정</p>
          <p className={`text-sm font-black ${dailyRec === 0 && supplyRate !== null ? 'text-red-600' : 'text-amber-700'}`}>
            {supplyRate === null ? '—' : dailyRec === 0 ? '공급중단' : `${supplyNeeded}개`}
          </p>
          {dailyRec > 0 && <p className="text-[8px] text-amber-400">내일 권장</p>}
        </div>
        <div className={`rounded-xl py-2 text-center ${needed > 0 ? 'bg-rose-50' : 'bg-gray-100'}`}>
          <p className={`text-[9px] ${needed > 0 ? 'text-rose-400' : 'text-gray-400'}`}>목표까지</p>
          <p className={`text-sm font-black ${needed > 0 ? 'text-rose-600' : 'text-gray-500'}`}>
            {needed > 0 ? `${fmtVal(needed)}개` : '완료'}
          </p>
        </div>
      </div>

      {/* ── 일별 공급 입력 (접기/펼치기) ── */}
      <div>
        <button
          onClick={() => setShowDaily(v => !v)}
          className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <span className="text-[9px] text-gray-500 font-semibold">
            일별 공급 입력
            <span className="ml-1.5 text-sky-600 font-black">합계 {supplyCount}개</span>
          </span>
          <span className="text-[9px] text-gray-400">{showDaily ? '▲ 접기' : '▼ 펼치기'}</span>
        </button>
        {showDaily && (
          <div className="mt-2 grid grid-cols-7 gap-1">
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
              <div key={day} className={`text-center ${day === todayDay ? 'ring-2 ring-blue-400 rounded-lg' : ''}`}>
                <p className={`text-[8px] font-medium mb-0.5 ${day === todayDay ? 'text-blue-600 font-black' : 'text-gray-400'}`}>{day}</p>
                <input
                  type="number" min={0}
                  value={dailySupplies[String(day)] || ''}
                  placeholder="0"
                  onChange={e => {
                    const v = Number(e.target.value) || 0
                    onChange(idx, 'daily_supplies', { ...dailySupplies, [String(day)]: v })
                  }}
                  className="w-full text-center text-[10px] font-bold text-gray-700 bg-white rounded border border-gray-200 py-1
                    focus:outline-none focus:ring-1 focus:ring-blue-300
                    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
  // 관리팀 진행 케이스 요약
  const [opsCases,   setOpsCases]   = useState<any[]>([])
  // 인별 자동집계: 공급결제(공가) / 직접수(직가DB) / 직접결제(직가계약)
  const [autoByPerson,  setAutoByPerson] = useState<Record<string, AutoEmpData>>({})

  const mkRow = (name = ''): EmployeeRow => ({ name, target: 0, supply_count: 0, supply_payment: 0, direct_count: 0, direct_payment: 0 })
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestState   = useRef({ targetCount, employees, paymentCount, we, tw })

  useEffect(() => {
    async function load() {
      try {
        const [payRes, custRes, userRes, revRes, casesRes] = await Promise.all([
          fetch(`/api/payrate?year_month=${month}`),
          fetch('/api/customers'),
          fetch('/api/users?role=sales'),
          fetch('/api/revenue'),
          fetch('/api/ops-cases'),
        ])
        const [payJson, custJson, userJson, revJson, casesJson] = await Promise.all([
          payRes.json(), custRes.json(), userRes.json(), revRes.json(), casesRes.json()
        ])
        setOpsCases(casesJson.cases || [])

        // 관리팀 이번달 매출 집계
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
            // 직접수: 거절/삭제 이동해도 카운트 유지 (direct_count_voided=true일 때만 제외)
            // ⚡ reception_date는 통화접수일(지난달 가능)이므로 폴백에서 제외 → created_at 기준으로만 판단
            const isDirectMonth = isDirectType && receptionMonth === month
            const isVoided = c.details?.direct_count_voided === true
            if (isDirectMonth && !isVoided) {
              directCntMap[name] = (directCntMap[name] || 0) + 1
            }
          })

        const stats = Object.entries(byPerson).map(([name, contracted]) => ({ name, contracted }))
        setAutoStats(stats)
        setPaymentCount(stats.reduce((s, v) => s + v.contracted, 0))

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
            // auto가 없어도 기존 저장값 유지 (이름 매칭 실패 시 방어)
            // auto가 있으면 항상 최신 API값으로 덮어씀 (DB 초기화 복구 포함)
            if (!auto) return row
            return {
              ...row,
              supply_payment: Math.max(Number(row.supply_payment),  auto.supply_payment),
              direct_count:   Math.max(Number(row.direct_count),    auto.direct_count),
              direct_payment: Math.max(Number(row.direct_payment),  auto.direct_payment),
            }
          }
          // 영업팀만 포함 (저장된 rows에 관리팀 직원 행 섞인 경우 제거)
          const synced = baseRows
            .filter((row: EmployeeRow) => !row.name || salesNameSet.has(cleanName(row.name)))
            .map(syncRow)
          setEmployees(synced)
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
                  if (!auto) return row
                  return {
                    ...row,
                    supply_payment: auto.supply_payment,
                    direct_count:   auto.direct_count,
                    direct_payment: auto.direct_payment,
                  }
                })
              setEmployees(synced)
            } else {
              setEmployees(people.map(mkRow))
            }
          } catch {
            setEmployees(people.map(mkRow))
          }
        }
      } catch {}
    }
    load()
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

  return (
    <div className="space-y-5 pb-8">

      {/* ─── 이번달 계약 자동집계 (compact) ─── */}
      {autoStats.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <span className="text-[10px] font-bold text-emerald-600 shrink-0">이번달 계약</span>
          <div className="flex gap-2 flex-wrap flex-1">
            {autoStats.map(s => (
              <div key={s.name} className="bg-white rounded-lg px-3 py-1.5 border border-emerald-100 flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400">{s.name}</span>
                <span className="text-sm font-black text-emerald-700">
                  {s.contracted % 1 === 0 ? s.contracted : s.contracted.toFixed(1)}
                </span>
                <span className="text-[9px] text-gray-400">건</span>
              </div>
            ))}
            {autoStats.length > 1 && (
              <div className="bg-emerald-600 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                <span className="text-[10px] text-white/70">합계</span>
                <span className="text-sm font-black text-white">
                  {paymentCount % 1 === 0 ? paymentCount : paymentCount.toFixed(1)}
                </span>
                <span className="text-[9px] text-white/70">건</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 👥 직원별 현황 (영업일기준보다 먼저) ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800">직원별 현황
            <span className="ml-2 text-[10px] text-gray-400 font-normal">{month}</span>
          </h3>
          <div className="flex items-center gap-2">
            {/* 이전 기록 복구 버튼 — 공급수/목표가 날아갔을 때 */}
            {employees.length > 0 && employees.every(r =>
              Number(r.target) === 0 && Object.keys(r.daily_supplies || {}).length === 0
            ) && (
              <button
                onClick={recoverFromPrevRecord}
                disabled={recovering}
                className="text-[11px] font-bold bg-rose-50 hover:bg-rose-100 disabled:opacity-40 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                {recovering ? '복구 중…' : '🔁 이전 기록 복구'}
              </button>
            )}
            {/* 전월 목표 복사 — 목표만 0일 때 */}
            {employees.length > 0 && employees.every(r => Number(r.target) === 0) && (
              <button
                onClick={copyPrevMonthTargets}
                disabled={copyingPrev}
                className="text-[11px] font-bold bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copyingPrev ? '복사 중…' : '📋 전월 목표 복사'}
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {employees.filter(r => r.name !== TESTER).map((row, i) => (
            <EmpCard
              key={i} row={row} idx={i} we={we} tw={tw}
              onChange={updateEmp} onRemove={removeEmp}
              autoData={autoByPerson[cleanName(row.name)] || autoByPerson[row.name] || { supply_payment: 0, direct_count: 0, direct_payment: 0 }}
            />
          ))}
        </div>
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
              <p className="text-[10px] text-white/50 mb-0.5">총결제율</p>
              <p className="text-lg font-black text-teal-400">
                {totTotalRate !== null ? totTotalRate.toFixed(1) + '%' : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── 📈 영업일 기준 (영업팀) ─── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800">영업일 기준 <span className="text-violet-500 font-semibold">(영업팀)</span></h3>
          <span className="text-[11px] text-gray-300">{today}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <NumInput label="인원수"   value={employeeCount} color="gray"     auto unit="명" />
          <NumInput label="목표개수" value={targetCount}   color="editable" unit="개" onChange={v => setTargetCountAndSave(v)} />
          <NumInput label="결제개수" value={paymentCount % 1 === 0 ? paymentCount : Number(paymentCount.toFixed(1))}
            color="green" auto unit="개" />
          <div className="bg-slate-50 rounded-2xl px-3 py-2.5 flex flex-col items-center gap-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">진행 영업일</p>
            <p className="text-xl font-black text-slate-800 leading-tight">
              {we}<span className="text-sm text-slate-400 font-normal"> / {tw}일</span>
            </p>
            <span className="text-[9px] bg-amber-100 text-amber-600 rounded-full px-1.5 py-0.5 font-semibold">잔여 {remaining}일</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <NumInput label="예상개수"    value={fmtN(expected)}          color="gray" />
          <NumInput label="인당이번달"  value={fmtN(expPerPersonMonth)} color="gray" />
          <NumInput label="인당하루"    value={fmtN(expPerPersonDay)}   color="gray" />
          <NumInput label="목표인당하루" value={fmtN(tgtPerPersonDay)}  color="blue" />
          <div className="bg-amber-50 rounded-2xl px-3 py-2.5 flex flex-col items-center gap-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-amber-500">진행상태</p>
            <PaceBadge status={paceStatus} score={paceScore} />
          </div>
        </div>
      </div>

      {/* ─── 🏢 관리팀 매출 + 진행 현황 (통합) ─── */}
      {(opsRevenue !== null || opsCases.length > 0) && (() => {
        const INST_LIST = [
          '중진공', '소진공(혁신)', '소진공(신취)', '소진공(재도전)',
          '기보', '신보', '재단', '서민금융(미소)',
        ]
        // ── OpsCeoTab과 동일한 필터링 로직 ──
        const REFUND_KEYS   = new Set(['환불', 'refunded'])
        const DONE_KEYS     = new Set(['종료', '완료', 'completed'])
        const PENDING_R     = new Set(['환불예정'])
        const PENDING_D     = new Set(['종료예정'])

        const isHolding  = (c: any) => !!(c.details?.is_holding)
        const isHandling = (c: any) => !!(
          c.details?.handling_no_contact || c.details?.handling_no_fit || c.details?.handling_mindless
        )

        // 전체 활성 케이스 (종료/환불/완료 제외)
        const activeCases = opsCases.filter(c =>
          !c.is_completed && !c.is_refund &&
          !REFUND_KEYS.has(c.stage ?? '') && !DONE_KEYS.has(c.stage ?? '')
        )

        // 기관별 카드에 표시되는 regularCases (OpsCeoTab의 기관 그룹과 동일)
        const regularCases = activeCases.filter(c =>
          !PENDING_R.has(c.stage ?? '') && !PENDING_D.has(c.stage ?? '') &&
          !isHolding(c) && !isHandling(c)
        )

        // 기관별 집계 (regularCases 기준 — 실제 ops 화면 카드 수와 일치)
        // 진행/대기 기준: direct_stage or indirect_stage (OpsCeoTab과 동일)
        const INDIRECT_INST = new Set(['기보', '신보', '재단'])
        const UPCOMING = new Set(['', '미선택', '서류받는중', '접수전'])

        const instStats = INST_LIST.map(inst => {
          const matched = regularCases.filter(c =>
            (c.institution || '').split(',').map((s: string) => s.trim()).includes(inst)
          )
          const isIndirect = INDIRECT_INST.has(inst)
          // 기관별 세부 단계로 대기 판별
          const waiting = matched.filter(c => {
            const stg = isIndirect
              ? (c.details?.indirect_stage || '')
              : (c.details?.direct_stage   || '')
            return UPCOMING.has(stg)
          })
          return {
            inst,
            label: inst === '서민금융(미소)' ? '미소' : inst,
            active: matched.length - waiting.length,
            waiting: waiting.length,
            total: matched.length,
          }
        }).filter(s => s.total > 0)

        // 단계별 업체 목록
        // direct_stage / indirect_stage / stage 세 곳 중 하나라도 해당하면 포함
        const hasStageAny = (c: any, stageSet: string[]) => {
          const s = new Set(stageSet)
          return s.has(c.details?.direct_stage ?? '') ||
                 s.has(c.details?.indirect_stage ?? '') ||
                 s.has(c.stage ?? '')
        }
        // 업체명 우선순위: details.company > customers.name > customer_name
        const companyName = (c: any) =>
          c.customers?.details?.company ||
          c.customers?.name ||
          c.customer_name || '-'

        const stageGroups = [
          {
            label: '반려보정',
            color: 'bg-orange-100 text-orange-700 border-orange-200',
            dot: 'bg-orange-500',
            cases: activeCases.filter(c => hasStageAny(c, ['반려보정'])),
          },
          {
            label: '실사대기',
            color: 'bg-amber-100 text-amber-700 border-amber-200',
            dot: 'bg-amber-500',
            cases: activeCases.filter(c => hasStageAny(c, ['실사대기'])),
          },
          {
            label: '자금승인·입금대기',
            color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            dot: 'bg-emerald-500',
            cases: activeCases.filter(c => hasStageAny(c, ['승인대기', '승인', '입금전'])),
          },
        ].filter(g => g.cases.length > 0)

        return (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800">관리팀 현재 매출 &amp; 진행 현황 <span className="text-[11px] text-gray-400 font-normal">({month})</span></h3>

            {/* 매출 요약 */}
            {opsRevenue !== null && (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-violet-50 rounded-2xl px-3 py-3 text-center">
                  <p className="text-[9px] text-violet-400 font-semibold mb-1">수수료 매출</p>
                  <p className="text-xl font-black text-violet-700 leading-tight">
                    {opsRevenue.fee >= 100000000
                      ? (opsRevenue.fee / 100000000).toFixed(1) + '억'
                      : opsRevenue.fee >= 10000
                        ? Math.round(opsRevenue.fee / 10000) + '만'
                        : opsRevenue.fee.toLocaleString()}
                  </p>
                  <p className="text-[8px] text-violet-400 mt-0.5">원</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl px-3 py-3 text-center">
                  <p className="text-[9px] text-emerald-500 font-semibold mb-1">계약 매출</p>
                  <p className="text-xl font-black text-emerald-700 leading-tight">
                    {opsRevenue.contract >= 100000000
                      ? (opsRevenue.contract / 100000000).toFixed(1) + '억'
                      : opsRevenue.contract >= 10000
                        ? Math.round(opsRevenue.contract / 10000) + '만'
                        : opsRevenue.contract.toLocaleString()}
                  </p>
                  <p className="text-[8px] text-emerald-400 mt-0.5">원</p>
                </div>
                <div className="bg-[#1B2A45] rounded-2xl px-3 py-3 text-center">
                  <p className="text-[9px] text-white/50 font-semibold mb-1">합계</p>
                  <p className="text-xl font-black text-white leading-tight">
                    {(() => {
                      const total = opsRevenue.fee + opsRevenue.contract
                      return total >= 100000000
                        ? (total / 100000000).toFixed(1) + '억'
                        : total >= 10000
                          ? Math.round(total / 10000) + '만'
                          : total.toLocaleString()
                    })()}
                  </p>
                  <p className="text-[8px] text-white/40 mt-0.5">원</p>
                </div>
              </div>
            )}

            {/* 기관별 현황 */}
            {instStats.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">기관별 현황</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {instStats.map(s => (
                    <div key={s.inst} className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2 min-w-0">
                      <span className="text-xs font-bold text-gray-700 truncate min-w-0 flex-1">{s.label}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {s.active > 0 && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold whitespace-nowrap">
                            진행중 {s.active}
                          </span>
                        )}
                        {s.waiting > 0 && (
                          <span className="text-[10px] bg-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-semibold whitespace-nowrap">
                            대기 {s.waiting}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 단계별 업체 */}
            {stageGroups.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">단계별 업체</p>
                <div className="space-y-2">
                  {stageGroups.map(g => (
                    <div key={g.label} className={`flex items-start gap-2 border rounded-xl px-3 py-2 ${g.color}`}>
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${g.dot}`} />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold mr-2">{g.label}</span>
                        <span className="text-[10px] opacity-60">({g.cases.length}건)</span>
                        <p className="text-xs font-medium mt-0.5 leading-relaxed">
                          {g.cases.map(c => companyName(c)).join(' · ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {instStats.length === 0 && stageGroups.length === 0 && opsCases.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">진행 중인 케이스 없음</p>
            )}
          </div>
        )
      })()}

      {/* ─── 저장 ─── */}
      <div className="flex items-center justify-end gap-3">
        {saveMsg && (
          <span className={`text-sm font-medium ${saveMsg.includes('완료') ? 'text-emerald-600' : 'text-red-500'}`}>
            {saveMsg}
          </span>
        )}
        <button onClick={handleReload} disabled={reloading || saving}
          className="bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white
            px-5 py-2.5 rounded-2xl text-sm font-bold shadow-sm transition-colors">
          {reloading ? '불러오는 중…' : '🔄 DB 불러오기'}
        </button>
        <button onClick={handleSave} disabled={saving}
          className="bg-[#1B2A45] hover:bg-[#263d66] disabled:opacity-40 text-white
            px-7 py-2.5 rounded-2xl text-sm font-bold shadow-sm transition-colors">
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
