'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { contractWeight } from '@/lib/supplyRules'

// ─── 타입 ─────────────────────────────────────────────────

interface OpsEmployee {
  name: string
  base_salary: number
  fee_revenue: number
  puto_revenue: number
  performance_bonus: number
}

interface AwardItem { reason: string; amount: number }

interface SalesEmployee {
  name: string
  contract_revenue: number
  contract_count: number
  performance_bonus: number
  awards: AwardItem[]
}

interface OtherCostItem { label: string; amount: number }

interface OtherCosts {
  db_count: number
  db_unit_price: number
  rent: number
  mgmt: number
  sales_fixed: number
  sales_other_items: OtherCostItem[]
  personal_card: number
  personal_rent: number
}

// ─── 계산 ─────────────────────────────────────────────────

function calcOps(e: OpsEmployee) {
  const feeInc  = Math.round(Number(e.fee_revenue)  * 0.10)
  const putoInc = Math.round(Number(e.puto_revenue) * 0.35)
  const before  = Number(e.base_salary) + feeInc + putoInc + Number(e.performance_bonus)
  const after   = Math.round(before * 0.967)
  return { feeInc, putoInc, before, after }
}

function getPromo(n: number) {
  if (n >= 40) return 1_500_000
  if (n >= 30) return 1_000_000
  if (n >= 25) return   700_000
  if (n >= 20) return   500_000
  return 0
}

function calcSales(e: SalesEmployee) {
  const contractInc  = Math.round(Number(e.contract_revenue) * 0.25)
  const perfBonus    = Number(e.performance_bonus)
  const promo        = getPromo(e.contract_count)
  const awardsSum    = (e.awards || []).reduce((s, a) => s + Number(a.amount || 0), 0)
  const before       = contractInc + perfBonus + promo + awardsSum
  const after        = Math.round(before * 0.967)
  return { contractInc, perfBonus, promo, awardsSum, before, after }
}

// ─── 유틸 ─────────────────────────────────────────────────

function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function won(n: number) {
  if (!n) return '-'
  return n.toLocaleString('ko-KR') + '원'
}
function fmtInput(n: number) {
  if (!n) return ''
  return n.toLocaleString('ko-KR')
}
function parseInput(s: string) {
  return parseInt(s.replace(/[^0-9]/g, ''), 10) || 0
}
function nowTimestamp() {
  const d = new Date()
  const mm  = String(d.getMonth() + 1).padStart(2, '0')
  const dd  = String(d.getDate()).padStart(2, '0')
  const hh  = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${min}`
}

function defaultOps(): OpsEmployee {
  return { name: '', base_salary: 0, fee_revenue: 0, puto_revenue: 0, performance_bonus: 0 }
}
function defaultSales(): SalesEmployee {
  return { name: '', contract_revenue: 0, contract_count: 0, performance_bonus: 0, awards: [] }
}
function defaultCosts(): OtherCosts {
  return { db_count: 0, db_unit_price: 40000, rent: 650000, mgmt: 400000, sales_fixed: 820000, sales_other_items: [],
           personal_card: 3_000_000, personal_rent: 650_000 }
}

// ─── PayRow 헬퍼 ─────────────────────────────────────────

function PayRow({
  label, value, editable, onEdit, autoTag, bold, colorClass, sub,
}: {
  label: string; value: number
  editable?: boolean; onEdit?: (v: string) => void
  autoTag?: boolean; bold?: boolean
  colorClass?: string; sub?: string
}) {
  const valColor = colorClass || (bold ? 'text-gray-800' : 'text-gray-700')
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-1 min-w-0">
        <span className={`text-xs leading-tight ${bold ? 'font-semibold text-gray-700' : 'text-gray-400'} truncate`}>
          {label}
        </span>
        {autoTag && <span className="shrink-0 text-[9px] bg-blue-50 text-blue-400 border border-blue-100 px-1 rounded">자동</span>}
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        {sub && <span className="text-[9px] text-gray-300">{sub}</span>}
        {editable && onEdit ? (
          <input
            type="text"
            inputMode="numeric"
            value={fmtInput(value)}
            onChange={e => onEdit(e.target.value)}
            placeholder="0"
            className="w-28 text-right text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700"
          />
        ) : (
          <span className={`text-xs font-semibold ${valColor}`}>{won(value)}</span>
        )}
      </div>
    </div>
  )
}

// ─── 관리팀 직원 카드 ─────────────────────────────────────

function OpsCard({
  emp, idx, onChange, onRemove,
}: {
  emp: OpsEmployee; idx: number
  onChange: (i: number, f: keyof OpsEmployee, v: string) => void
  onRemove: (i: number) => void
}) {
  const c = calcOps(emp)
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-[#1B2A45] to-[#2d4a7a] px-4 py-3">
        <div className="flex items-center justify-between">
          <input
            type="text" value={emp.name}
            onChange={e => onChange(idx, 'name', e.target.value)}
            placeholder="직원명"
            className="bg-transparent text-white font-bold text-sm placeholder-white/40 border-none outline-none w-full"
          />
          <button onClick={() => onRemove(idx)} className="text-white/30 hover:text-white/70 text-sm ml-2 shrink-0">✕</button>
        </div>
        {/* 공제전/공제후 인라인 */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-white/50">공제전 <span className="text-white/80 font-semibold">{c.before > 0 ? c.before.toLocaleString('ko-KR') + '원' : '-'}</span></span>
          <span className="text-white/20 text-[10px]">→</span>
          <span className="text-[10px] text-white/50">공제후 <span className="text-emerald-300 font-bold">{c.after > 0 ? c.after.toLocaleString('ko-KR') + '원' : '-'}</span></span>
        </div>
      </div>
      {/* 항목 */}
      <div className="px-4 py-3 space-y-0">
        <PayRow label="기본급" value={emp.base_salary} editable onEdit={v => onChange(idx, 'base_salary', v)} />
        <PayRow label="수수료매출(VAT제외)" value={emp.fee_revenue} autoTag />
        <PayRow label="수수료인센(10%)" value={c.feeInc} />
        <PayRow label="뿌토매출(VAT제외)" value={emp.puto_revenue} autoTag />
        <PayRow label="뿌토인센(35%)" value={c.putoInc} />
        <PayRow label="성과급" value={emp.performance_bonus} editable onEdit={v => onChange(idx, 'performance_bonus', v)} />
      </div>
    </div>
  )
}

// ─── 영업팀 직원 카드 ─────────────────────────────────────

function SalesCard({
  emp, idx, onChange, onRemove, onAddAward, onUpdateAward, onRemoveAward,
}: {
  emp: SalesEmployee; idx: number
  onChange: (i: number, f: keyof Omit<SalesEmployee, 'awards'>, v: string) => void
  onRemove: (i: number) => void
  onAddAward: (i: number) => void
  onUpdateAward: (ei: number, ai: number, f: keyof AwardItem, v: string) => void
  onRemoveAward: (ei: number, ai: number) => void
}) {
  const c = calcSales(emp)
  const has12 = emp.contract_count >= 12
  const promoLabel = emp.contract_count > 0 ? `${emp.contract_count}개` : '갯수 미정'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-[#C5A258] to-[#d4b56a] px-4 py-3">
        <div className="flex items-center justify-between">
          <input
            type="text" value={emp.name}
            onChange={e => onChange(idx, 'name', e.target.value)}
            placeholder="사원명"
            className="bg-transparent text-white font-bold text-sm placeholder-white/40 border-none outline-none w-full"
          />
          <button onClick={() => onRemove(idx)} className="text-white/30 hover:text-white/70 text-sm ml-2 shrink-0">✕</button>
        </div>
        {/* 공제전/공제후 인라인 */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-white/60">공제전 <span className="text-white/90 font-semibold">{c.before > 0 ? c.before.toLocaleString('ko-KR') + '원' : '-'}</span></span>
          <span className="text-white/30 text-[10px]">→</span>
          <span className="text-[10px] text-white/60">공제후 <span className="text-yellow-100 font-bold">{c.after > 0 ? c.after.toLocaleString('ko-KR') + '원' : '-'}</span></span>
        </div>
      </div>
      {/* 항목 */}
      <div className="px-4 py-3 space-y-0">
        <PayRow label="계약금매출(VAT제외)" value={emp.contract_revenue} autoTag />
        <PayRow label="계약금인센(25%)" value={c.contractInc} />
        <PayRow
          label={has12 ? '성과급(+5% ✓ 12개↑)' : '성과급(+5%, 12개↑)'}
          value={emp.performance_bonus}
          editable
          autoTag={has12}
          onEdit={v => onChange(idx, 'performance_bonus', v)}
          colorClass={has12 ? 'text-violet-600' : undefined}
        />
        <PayRow
          label={`프로모션(${promoLabel})`}
          value={c.promo}
          sub={c.promo > 0 ? '' : '20/25/30/40개 기준'}
        />
        {/* 시상금 */}
        <div className="py-1.5 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">시상금</span>
            <div className="flex items-center gap-2">
              <button onClick={() => onAddAward(idx)}
                className="text-[10px] text-[#C5A258] border border-[#C5A258]/30 rounded px-1.5 py-0.5 hover:bg-[#C5A258]/10">
                + 추가
              </button>
              <span className="text-xs font-semibold text-gray-700">
                {c.awardsSum > 0 ? c.awardsSum.toLocaleString('ko-KR') + '원' : '-'}
              </span>
            </div>
          </div>
          {(emp.awards || []).map((aw, ai) => (
            <div key={ai} className="flex items-center gap-1.5 mt-1.5">
              <input type="text" value={aw.reason} placeholder="사유"
                onChange={e => onUpdateAward(idx, ai, 'reason', e.target.value)}
                className="flex-1 min-w-0 text-[11px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-300 text-gray-600" />
              <input type="text" inputMode="numeric" value={fmtInput(aw.amount)} placeholder="금액"
                onChange={e => onUpdateAward(idx, ai, 'amount', e.target.value)}
                className="w-24 text-right text-[11px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-amber-300 text-gray-600" />
              <button onClick={() => onRemoveAward(idx, ai)} className="text-red-300 hover:text-red-500 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────

export default function PayrollTab() {
  const [yearMonth, setYearMonth] = useState(thisMonth())
  const [loading, setLoading]         = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [msg, setMsg]                 = useState('')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const [opsEmps, setOpsEmps] = useState<OpsEmployee[]>([
    { ...defaultOps(), name: '관리팀장', base_salary: 2_000_000 },
  ])
  const [salesEmps, setSalesEmps] = useState<SalesEmployee[]>([
    { ...defaultSales(), name: '손제후' },
    { ...defaultSales(), name: '김윤지' },
  ])
  const [costs, setCosts]     = useState<OtherCosts>(defaultCosts())
  const [revTotals, setRevTotals] = useState<{ sales: number; ops: number; opsContract: number } | null>(null)
  const [perPersonSupply, setPerPersonSupply] = useState<{ name: string; count: number }[]>([])
  const [salesContractMap, setSalesContractMap] = useState<Record<string, Array<{ company: string; amount: number; weight: number; date: string }>>>({})

  // 개인재무에서 자동 산출 (대출이자 + 구독료)
  // DB 미저장 시 PersonalFinanceTab DEFAULT_LOANS + DEFAULT_SUBS 합계를 기본값으로 사용
  const PF_FALLBACK_LOANS = 583_000   // 49000 + 114000 + 420000
  const PF_FALLBACK_SUBS  = 208_153   // DEFAULT_SUBS 16개 합산
  const [pfFixed, setPfFixed] = useState<{ loans: number; subs: number }>({ loans: PF_FALLBACK_LOANS, subs: PF_FALLBACK_SUBS })

  useEffect(() => {
    fetch('/api/personal-finance')
      .then(r => r.json())
      .then(d => {
        const pf = d.record?.employees
        if (!pf) {
          // DB에 저장된 기록 없음 → 기본값 유지
          setPfFixed({ loans: PF_FALLBACK_LOANS, subs: PF_FALLBACK_SUBS })
          return
        }
        const loans = (pf.loans || []).reduce((s: number, l: any) => s + Number(l.p1_monthly || 0), 0)
        const subs  = (pf.subs  || []).reduce((s: number, sub: any) => s + Number(sub.monthly_amount || 0), 0)
        // DB 데이터가 있지만 값이 0인 경우에도 fallback 적용
        setPfFixed({ loans: loans || PF_FALLBACK_LOANS, subs: subs || PF_FALLBACK_SUBS })
      })
      .catch(() => {
        setPfFixed({ loans: PF_FALLBACK_LOANS, subs: PF_FALLBACK_SUBS })
      })
  }, [])

  // 자동저장 디바운스
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didInitLoad = useRef(false)
  // handleLoad와 prevMonthLoad 간 race condition 방지 토큰
  const loadToken   = useRef(0)

  // ── 저장 (내부용) ────────────────────────────────────────
  async function doSave(
    ops: OpsEmployee[],
    sales: SalesEmployee[],
    c: OtherCosts,
    rev: { sales: number; ops: number; opsContract: number } | null
  ) {
    await fetch('/api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year_month: yearMonth,
        employees: { ops_employees: ops, sales_employees: sales, other_costs: c, revenue_totals: rev },
        memo: '',
      }),
    })
  }

  // ── 자동저장 (state 변경 시 디바운스) ────────────────────
  useEffect(() => {
    if (!didInitLoad.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      doSave(opsEmps, salesEmps, costs, revTotals)
    }, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [opsEmps, salesEmps, costs, revTotals]) // eslint-disable-line

  // ── 전월 불러오기: 고객 DB 실시간 집계 (이달이 아닐 때 사용) ─────────────
  const prevMonthLoad = useCallback(async () => {
    ++loadToken.current  // handleLoad가 진행 중이면 결과 무시하도록 토큰 무효화
    setAutoLoading(true)
    setMsg('')
    try {
      const parseMon = (v: any) => parseInt(String(v || '0').replace(/[^0-9]/g, ''), 10) || 0
      const [custRes, prRes] = await Promise.all([
        fetch('/api/customers'),
        fetch(`/api/payrate?year_month=${yearMonth}`),
      ])
      const [custJson, prData] = await Promise.all([custRes.json(), prRes.json()])

      // 해당 월 계약 실시간 집계 (contractWeight 기준)
      const salesByName: Record<string, { amount: number; count: number }> = {}
      ;(custJson.customers || []).forEach((c: any) => {
        if (c.status !== 'contracted') return
        const contractMonth = (c.details?.contract_date || c.created_at || '').slice(0, 7)
        if (contractMonth !== yearMonth) return
        const name = (c.details?.sales_user_name || c.sales_user_name || '').trim()
        if (!name) return
        // my_revenue 없으면 payment_amount 폴백 (미입력 계약 누락 방지)
        const rev = parseMon(c.details?.my_revenue) || parseMon(c.details?.payment_amount)
        const w = contractWeight(c.details?.payment_amount, c.details?.vat_included)
        if (!salesByName[name]) salesByName[name] = { amount: 0, count: 0 }
        salesByName[name].amount += rev
        salesByName[name].count  += w > 0 ? w : 1
      })

      const newSalesEmps = salesEmps.map(emp => {
        if (!emp.name) return emp
        const key = Object.keys(salesByName).find(k =>
          k === emp.name || k.includes(emp.name) || emp.name.includes(k))
        if (!key) return emp
        const data = salesByName[key]
        const autoPerf = data.count >= 12 ? Math.round(data.amount * 0.05) : 0
        return { ...emp, contract_revenue: data.amount, contract_count: data.count, performance_bonus: autoPerf }
      })
      setSalesEmps(newSalesEmps)

      // payrate에서 인별 공급수 로드
      try {
        if (prData.record?.employee_details) {
          const details = prData.record.employee_details as any[]
          const perPerson = details
            .filter((e: any) => e.name && e.name !== 'sales-tester')
            .map((e: any) => {
              const fromDaily = e.daily_supplies
                ? Object.values(e.daily_supplies).reduce((ss: number, v: any) => ss + Number(v || 0), 0)
                : 0
              return { name: String(e.name), count: fromDaily > 0 ? fromDaily : Number(e.supply_count || 0) }
            })
          setPerPersonSupply(perPerson)
        }
      } catch { /* payrate 실패해도 계속 */ }

      // 저장
      await doSave(opsEmps, newSalesEmps, costs, revTotals)

      const ts = nowTimestamp()
      setLastUpdated(ts)
      setMsg('불러오기 완료')
    } catch {
      setMsg('불러오기 실패')
    } finally {
      setAutoLoading(false)
    }
  }, [yearMonth, salesEmps, opsEmps, costs, revTotals]) // eslint-disable-line

  // ── 자동 반영 ─────────────────────────────────────────────
  // baseOps/baseSales/baseCosts: handleLoad에서 호출 시 새로 로드한 값 전달 (stale closure 방지)
  const autoLoad = useCallback(async (
    baseOps?: OpsEmployee[],
    baseSales?: SalesEmployee[],
    baseCosts?: OtherCosts
  ) => {
    const currentOps   = baseOps   || opsEmps
    const currentSales = baseSales || salesEmps
    const currentCosts = baseCosts || costs
    setAutoLoading(true)
    setMsg('')
    try {
      const res  = await fetch('/api/revenue')
      const data = await res.json()

      const salesEntries: any[]    = data.thisMonthSales    || []
      const opsEntries: any[]      = data.thisMonthOps      || []
      const contractEntries: any[] = data.thisMonthOpsContracts || []

      const newRevTotals = {
        sales:       salesEntries.reduce((s: number, e: any) => s + (e.amount || 0), 0),
        ops:         opsEntries.reduce((s: number, e: any) => s + (e.amount || 0), 0),
        opsContract: contractEntries.reduce((s: number, e: any) => s + (e.amount || 0), 0),
      }
      setRevTotals(newRevTotals)

      // 영업팀
      const salesByName: Record<string, { amount: number; count: number }> = {}
      const contractDetails: Record<string, Array<{ company: string; amount: number; weight: number; date: string }>> = {}
      for (const e of salesEntries) {
        const name = (e.sales_user_name || '').trim()
        if (!name) continue
        if (!salesByName[name]) salesByName[name] = { amount: 0, count: 0 }
        salesByName[name].amount += e.amount || 0
        // contractWeight 기준 가중치 적용 (50만이하=0.5, 31~99만=1, 100만~=2,3,4...)
        const w = contractWeight((e as any).payment_amount, (e as any).vat_included)
        salesByName[name].count += w > 0 ? w : 1  // payment_amount 없으면 1로 폴백
        if (!contractDetails[name]) contractDetails[name] = []
        contractDetails[name].push({
          company: (e as any).company || '(업체명 없음)',
          amount: e.amount || 0,
          weight: w > 0 ? w : 1,
          date: (e as any).date || '',
        })
      }
      setSalesContractMap(contractDetails)
      const newSalesEmps = currentSales.map(emp => {
        if (!emp.name) return emp
        const key = Object.keys(salesByName).find(k => k === emp.name || k.includes(emp.name) || emp.name.includes(k))
        if (!key) return emp
        const rev = salesByName[key]
        const autoPerf = rev.count >= 12 ? Math.round(rev.amount * 0.05) : 0
        return { ...emp, contract_revenue: rev.amount, contract_count: rev.count, performance_bonus: autoPerf }
      })
      setSalesEmps(newSalesEmps)

      // 관리팀
      const opsFeeByName: Record<string, number>  = {}
      const opsPutoByName: Record<string, number> = {}
      for (const e of opsEntries) {
        const name = (e.ops_user_name || '').trim()
        if (!name) continue
        opsFeeByName[name] = (opsFeeByName[name] || 0) + (e.amount || 0)
      }
      for (const e of contractEntries) {
        const name = (e.ops_user_name || '').trim()
        if (!name) continue
        opsPutoByName[name] = (opsPutoByName[name] || 0) + (e.amount || 0)
      }
      const newOpsEmps = currentOps.map(emp => {
        if (!emp.name) return emp
        const key  = Object.keys(opsFeeByName).find(k => k === emp.name || k.includes(emp.name) || emp.name.includes(k))
        const pKey = Object.keys(opsPutoByName).find(k => k === emp.name || k.includes(emp.name) || emp.name.includes(k))
        return {
          ...emp,
          fee_revenue:  key  ? opsFeeByName[key]   : emp.fee_revenue,
          puto_revenue: pKey ? opsPutoByName[pKey]  : emp.puto_revenue,
        }
      })
      setOpsEmps(newOpsEmps)

      // DB 공급 갯수 자동 반영
      let newCosts = currentCosts
      try {
        const prRes  = await fetch(`/api/payrate?year_month=${yearMonth}`)
        const prData = await prRes.json()
        if (prData.record?.employee_details) {
          const details = prData.record.employee_details as any[]
          const perPerson = details
            .filter((e: any) => e.name && e.name !== 'sales-tester')
            .map((e: any) => {
              const fromDaily = e.daily_supplies
                ? Object.values(e.daily_supplies).reduce((ss: number, v: any) => ss + Number(v || 0), 0)
                : 0
              return { name: String(e.name), count: fromDaily > 0 ? fromDaily : Number(e.supply_count || 0) }
            })
          const totalSupply = perPerson.reduce((s: number, p: { count: number }) => s + p.count, 0)
          if (totalSupply > 0) {
            newCosts = { ...currentCosts, db_count: totalSupply }
            setCosts(newCosts)
            setPerPersonSupply(perPerson)
          }
        }
      } catch {
        // payrate 실패해도 revenue 반영은 성공
      }

      // 자동저장
      await doSave(newOpsEmps, newSalesEmps, newCosts, newRevTotals)

      const ts = nowTimestamp()
      setLastUpdated(ts)
      setMsg('자동 반영 완료')
    } catch {
      setMsg('자동 로드 실패')
    } finally {
      setAutoLoading(false)
    }
  }, [yearMonth, opsEmps, salesEmps, costs]) // eslint-disable-line

  // ── 불러오기 ──────────────────────────────────────────────
  async function handleLoad() {
    const token = ++loadToken.current
    setLoading(true)
    setMsg('')
    didInitLoad.current = false
    const [res, prRes] = await Promise.all([
      fetch(`/api/payroll?year_month=${yearMonth}`),
      fetch(`/api/payrate?year_month=${yearMonth}`),
    ])
    const json = await res.json()
    // payrate 에서 인별 공급수 로드
    try {
      const prData = await prRes.json()
      if (prData.record?.employee_details) {
        const details = prData.record.employee_details as any[]
        const perPerson = details
          .filter((e: any) => e.name && e.name !== 'sales-tester')
          .map((e: any) => {
            const fromDaily = e.daily_supplies
              ? Object.values(e.daily_supplies).reduce((ss: number, v: any) => ss + Number(v || 0), 0)
              : 0
            return { name: String(e.name), count: fromDaily > 0 ? fromDaily : Number(e.supply_count || 0) }
          })
        setPerPersonSupply(perPerson)
      } else {
        setPerPersonSupply([])
      }
    } catch { setPerPersonSupply([]) }

    // prevMonthLoad가 먼저 실행된 경우 handleLoad 결과 무시 (race condition 방지)
    if (token !== loadToken.current) { setLoading(false); return }

    if (json.record?.employees) {
      const d = json.record.employees
      // 새로 로드한 값을 변수에 먼저 저장 — autoLoad에 직접 전달해 stale closure 방지
      const freshOps   = d.ops_employees  || opsEmps
      const freshSales = d.sales_employees || salesEmps
      const freshCosts = d.other_costs ? { ...defaultCosts(), ...d.other_costs } : costs
      setOpsEmps(freshOps)
      setSalesEmps(freshSales)
      setCosts(freshCosts)
      if (d.revenue_totals) setRevTotals(d.revenue_totals)
      // 현재 월이면 저장된 레코드 로드 후 자동으로 최신 계약 데이터 반영
      if (yearMonth === thisMonth()) {
        setMsg('불러오기 완료 — 최신 계약 자동 반영 중…')
        await autoLoad(freshOps, freshSales, freshCosts)
      } else {
        setMsg('불러오기 완료')
      }
    } else {
      if (yearMonth === thisMonth()) await autoLoad()
      else setMsg('저장된 데이터 없음')
    }
    didInitLoad.current = true
    setLoading(false)
  }

  useEffect(() => { handleLoad() }, [yearMonth]) // eslint-disable-line

  // ── 업데이트 헬퍼 ─────────────────────────────────────────
  function updateOps(i: number, f: keyof OpsEmployee, v: string) {
    setOpsEmps(prev => { const n = [...prev]; n[i] = { ...n[i], [f]: f === 'name' ? v : parseInput(v) }; return n })
  }
  function removeOps(i: number) { setOpsEmps(prev => prev.filter((_, j) => j !== i)) }

  function updateSales(i: number, f: keyof Omit<SalesEmployee, 'awards'>, v: string) {
    setSalesEmps(prev => { const n = [...prev]; n[i] = { ...n[i], [f]: f === 'name' ? v : parseInput(v) }; return n })
  }
  function removeSales(i: number) { setSalesEmps(prev => prev.filter((_, j) => j !== i)) }
  function addAward(ei: number) {
    setSalesEmps(prev => { const n = [...prev]; n[ei] = { ...n[ei], awards: [...(n[ei].awards || []), { reason: '', amount: 0 }] }; return n })
  }
  function updateAward(ei: number, ai: number, f: keyof AwardItem, v: string) {
    setSalesEmps(prev => {
      const n = [...prev]; const aw = [...(n[ei].awards || [])]
      aw[ai] = { ...aw[ai], [f]: f === 'amount' ? parseInput(v) : v }
      n[ei] = { ...n[ei], awards: aw }; return n
    })
  }
  function removeAward(ei: number, ai: number) {
    setSalesEmps(prev => { const n = [...prev]; n[ei] = { ...n[ei], awards: n[ei].awards.filter((_, j) => j !== ai) }; return n })
  }

  // ── 손익 집계 ─────────────────────────────────────────────
  const opsCalcs   = opsEmps.map(calcOps)
  const salesCalcs = salesEmps.map(calcSales)

  const opsTotalBefore   = opsCalcs.reduce((s, c) => s + c.before, 0)
  const opsTotalAfter    = opsCalcs.reduce((s, c) => s + c.after,  0)
  const salesTotalBefore = salesCalcs.reduce((s, c) => s + c.before, 0)
  const salesTotalAfter  = salesCalcs.reduce((s, c) => s + c.after,  0)
  const laborCost = opsTotalBefore + salesTotalBefore

  const autoSalesFixed = pfFixed.loans + pfFixed.subs

  const totalRevenue  = (revTotals?.sales || 0) + (revTotals?.ops || 0) + (revTotals?.opsContract || 0)
  const tax           = Math.round(totalRevenue * 0.10)
  const dbCost        = Number(costs.db_count) * Number(costs.db_unit_price)
  const otherItemsSum = (costs.sales_other_items || []).reduce((s, i) => s + Number(i.amount || 0), 0)
  const otherTotal    = dbCost + Number(costs.rent) + Number(costs.mgmt) + autoSalesFixed + otherItemsSum
  const netProfit     = totalRevenue - tax - laborCost - otherTotal
  const realTakeHome  = netProfit - Number(costs.personal_card) - Number(costs.personal_rent)

  const isCurrentMonth = yearMonth === thisMonth()

  const namedOps   = opsEmps.filter(e => e.name.trim())
  const namedSales = salesEmps.filter(e => e.name.trim())

  return (
    <div className="space-y-6 pb-10 max-w-4xl mx-auto">

      {/* ── 헤더 바 ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />

        <button
          onClick={isCurrentMonth ? () => autoLoad() : prevMonthLoad}
          disabled={autoLoading}
          className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
          {autoLoading ? '반영 중...' : isCurrentMonth ? '이달 매출 자동 반영' : '불러오기'}
        </button>

        <button
          onClick={async () => {
            setSaving(true)
            setMsg('')
            try {
              await doSave(opsEmps, salesEmps, costs, revTotals)
              setMsg('저장 완료')
            } catch { setMsg('저장 실패') }
            finally { setSaving(false) }
          }}
          disabled={saving}
          className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors">
          {saving ? '저장 중...' : '저장하기'}
        </button>

        {loading && <span className="text-xs text-blue-500 animate-pulse">불러오는 중...</span>}

        {msg && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${msg.includes('완료') ? 'text-emerald-600' : msg.includes('실패') ? 'text-red-500' : 'text-gray-500'}`}>
              {msg}
            </span>
            {lastUpdated && msg.includes('완료') && (
              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {lastUpdated} 기준
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 영업팀 | 구분선 | 관리팀 ── */}
      <div className="flex gap-0 items-stretch">

        {/* 영업팀 */}
        <div className="flex-1 min-w-0 pr-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-[#C5A258]">영업팀</h3>
            {namedSales.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span>전 <span className="font-bold text-blue-600">{salesTotalBefore.toLocaleString('ko-KR')}원</span></span>
                <span className="text-gray-300">|</span>
                <span>후 <span className="font-bold text-[#C5A258]">{salesTotalAfter.toLocaleString('ko-KR')}원</span></span>
              </div>
            )}
          </div>

          {salesEmps.map((emp, i) => {
            const empName = emp.name.trim()
            const matched = empName
              ? Object.keys(salesContractMap).find(k => k === empName || k.includes(empName) || empName.includes(k))
              : undefined
            const contracts: Array<{ company: string; amount: number; weight: number; date: string }> = matched ? salesContractMap[matched] : []
            return (
              <div key={i}>
                <SalesCard emp={emp} idx={i}
                  onChange={updateSales} onRemove={removeSales}
                  onAddAward={addAward} onUpdateAward={updateAward} onRemoveAward={removeAward} />
                {empName && (
                  <details className="mt-1 bg-amber-50 border border-amber-100 rounded-xl overflow-hidden">
                    <summary className="px-3 py-1.5 text-[10px] font-semibold text-amber-700 cursor-pointer select-none">
                      집계된 계약 {contracts.length}건 ({contracts.reduce((s, c) => s + c.weight, 0)}개) — 클릭해서 확인
                    </summary>
                    <div className="px-3 pb-2 space-y-0.5">
                      {contracts.length === 0 ? (
                        <p className="text-[10px] text-gray-400 py-1">자동반영 후 목록이 표시됩니다</p>
                      ) : contracts.map((c, ci) => (
                        <div key={ci} className="flex items-center justify-between text-[10px] py-0.5 border-b border-amber-100 last:border-0">
                          <span className="text-gray-700 font-medium">{c.company}</span>
                          <div className="flex items-center gap-3 text-gray-400">
                            <span>{c.date.slice(0, 10)}</span>
                            <span className="text-amber-600 font-semibold">{c.weight}개</span>
                            <span>{c.amount > 0 ? c.amount.toLocaleString('ko-KR') + '원' : '—'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )
          })}

          <button onClick={() => setSalesEmps(prev => [...prev, defaultSales()])}
            className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-400 hover:border-[#C5A258]/60 hover:text-[#C5A258]/80 transition-colors">
            + 직원 추가
          </button>
        </div>

        {/* 구분선 */}
        <div className="w-px bg-gray-200 self-stretch mx-1 shrink-0" />

        {/* 관리팀 */}
        <div className="flex-1 min-w-0 pl-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-[#1B2A45]">관리팀</h3>
            {namedOps.length > 0 && (
              <div className="flex items-center gap-2 text-[10px] text-gray-400">
                <span>전 <span className="font-bold text-blue-600">{opsTotalBefore.toLocaleString('ko-KR')}원</span></span>
                <span className="text-gray-300">|</span>
                <span>후 <span className="font-bold text-[#1B2A45]">{opsTotalAfter.toLocaleString('ko-KR')}원</span></span>
              </div>
            )}
          </div>

          {opsEmps.map((emp, i) => (
            <OpsCard key={i} emp={emp} idx={i} onChange={updateOps} onRemove={removeOps} />
          ))}

          <button onClick={() => setOpsEmps(prev => [...prev, defaultOps()])}
            className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-400 hover:border-[#1B2A45]/40 hover:text-[#1B2A45]/60 transition-colors">
            + 직원 추가
          </button>
        </div>
      </div>

      {/* ── 회사 손익 요약 ── */}
      <div className="bg-white rounded-2xl border border-[#E8E2D4] overflow-hidden">

        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-[#E8E2D4] flex items-center justify-between bg-gradient-to-r from-[#1B2A45]/4 to-transparent">
          <h3 className="text-sm font-bold text-[#1B2A45]">회사 손익 요약</h3>
          {revTotals && (
            <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">매출 자동 반영됨</span>
          )}
        </div>

        {/* KPI 3개 */}
        <div className="grid grid-cols-3 divide-x divide-[#E8E2D4] border-b border-[#E8E2D4]">
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] text-gray-400 font-medium mb-1">총 매출</p>
            <p className="text-xl font-black text-[#1B2A45] tracking-tight">
              {totalRevenue > 0 ? totalRevenue.toLocaleString('ko-KR') + '원' : '—'}
            </p>
          </div>
          <div className="px-5 py-4 text-center">
            <p className="text-[10px] text-gray-400 font-medium mb-1">총 매입</p>
            <p className="text-xl font-black text-red-500 tracking-tight">
              {totalRevenue > 0 ? (tax + laborCost + otherTotal).toLocaleString('ko-KR') + '원' : '—'}
            </p>
          </div>
          <div className={`px-5 py-4 text-center ${netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
            <p className="text-[10px] font-bold mb-1 ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}">순이익</p>
            <p className={`text-xl font-black tracking-tight ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {totalRevenue > 0 ? netProfit.toLocaleString('ko-KR') + '원' : '—'}
            </p>
            {totalRevenue > 0 && (
              <p className={`text-[10px] mt-0.5 ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                이익률 {((netProfit / totalRevenue) * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* 좌: 매출 + 비용 입력 */}
          <div className="space-y-4">

            {/* 매출 내역 */}
            <div className="bg-[#1B2A45]/3 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold text-[#1B2A45]/40 uppercase tracking-widest mb-2">매출 내역</p>
              <SumRow label="영업팀 계약 매출" value={revTotals?.sales || 0} />
              <SumRow label="관리팀 수수료 매출" value={revTotals?.ops || 0} />
              <SumRow label="관리팀 뿌토 매출" value={revTotals?.opsContract || 0} />
              <div className="border-t border-[#1B2A45]/10 pt-2">
                <SumRow label="총 매출" value={totalRevenue} bold />
              </div>
            </div>

            {/* 운영비 입력 */}
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-[#1B2A45]/40 uppercase tracking-widest mb-2">운영비</p>

              {/* DB — 갯수 잠금, 단가만 편집 */}
              <div className="py-2 border-b border-gray-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 shrink-0">DB 공급비용</span>
                  <div className="flex items-center gap-1 text-xs shrink-0 flex-wrap justify-end">
                    <span className="flex items-center gap-1 bg-gray-100 text-gray-500 rounded px-1.5 py-1 font-mono whitespace-nowrap">
                      <span className="font-bold text-gray-700">{costs.db_count}</span>개
                    </span>
                    <span className="text-gray-300">×</span>
                    <div className="flex items-center gap-0.5 whitespace-nowrap">
                      <input type="text" inputMode="numeric" value={fmtInput(costs.db_unit_price)} placeholder="40,000"
                        onChange={e => setCosts(p => ({ ...p, db_unit_price: parseInput(e.target.value) }))}
                        className="w-18 text-center border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      <span className="text-gray-400 ml-0.5">원</span>
                    </div>
                    <span className="font-bold text-gray-700 whitespace-nowrap">{dbCost > 0 ? '= ' + dbCost.toLocaleString('ko-KR') + '원' : '-'}</span>
                  </div>
                </div>
                {/* 인별 공급수 */}
                {perPersonSupply.length > 0 && (
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {perPersonSupply.filter(p => p.count > 0).map(p => (
                      <span key={p.name} className="text-[10px] bg-sky-50 text-sky-700 border border-sky-100 rounded-full px-2 py-0.5 font-medium">
                        {p.name.replace(/\s*(수석팀장|팀장|팀원|대리|과장|부장|차장|이사|수석|매니저|주임|사원).*/g, '')} {p.count}개
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 임대료 / 관리비 */}
              {([
                ['rent', '임대료',  costs.rent],
                ['mgmt', '관리비',  costs.mgmt],
              ] as [keyof OtherCosts, string, number][]).map(([key, label, val]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-xs text-gray-500">{label}</span>
                  <input type="text" inputMode="numeric" value={fmtInput(val)} placeholder="0"
                    onChange={e => setCosts(p => ({ ...p, [key]: parseInput(e.target.value) }))}
                    className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              ))}

              {/* 영업 고정비용 — 자동 (대출이자 + 구독료) */}
              <div className="py-2 border-b border-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">영업 고정비용</span>
                    <span className="text-[9px] bg-violet-50 text-violet-500 border border-violet-100 px-1.5 py-0.5 rounded font-bold">자동</span>
                  </div>
                  <span className="text-xs font-bold text-gray-700">{autoSalesFixed > 0 ? autoSalesFixed.toLocaleString('ko-KR') + '원' : '-'}</span>
                </div>
                {autoSalesFixed > 0 && (
                  <div className="flex items-center gap-3 mt-1 pl-1">
                    <span className="text-[10px] text-gray-400">대출이자 {pfFixed.loans.toLocaleString('ko-KR')}원</span>
                    <span className="text-gray-200 text-[10px]">+</span>
                    <span className="text-[10px] text-gray-400">구독료 {pfFixed.subs.toLocaleString('ko-KR')}원</span>
                  </div>
                )}
              </div>

              {/* 영업 기타비용 */}
              <div className="pt-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">영업 기타비용</span>
                  <button onClick={() => setCosts(p => ({ ...p, sales_other_items: [...(p.sales_other_items || []), { label: '', amount: 0 }] }))}
                    className="text-[10px] text-blue-500 border border-blue-200 rounded-full px-2 py-0.5 hover:bg-blue-50 transition-colors">+ 추가</button>
                </div>
                {(costs.sales_other_items || []).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <input type="text" value={item.label} placeholder="항목명 (예: 알바비)"
                      onChange={e => { const arr = [...costs.sales_other_items]; arr[i] = { ...arr[i], label: e.target.value }; setCosts(p => ({ ...p, sales_other_items: arr })) }}
                      className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    <input type="text" inputMode="numeric" value={fmtInput(item.amount)} placeholder="금액"
                      onChange={e => { const arr = [...costs.sales_other_items]; arr[i] = { ...arr[i], amount: parseInput(e.target.value) }; setCosts(p => ({ ...p, sales_other_items: arr })) }}
                      className="w-24 text-right border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300" />
                    <button onClick={() => setCosts(p => ({ ...p, sales_other_items: p.sales_other_items.filter((_, j) => j !== i) }))}
                      className="text-red-300 hover:text-red-500 text-xs shrink-0">✕</button>
                  </div>
                ))}
                {(costs.sales_other_items || []).length === 0 && (
                  <p className="text-[11px] text-gray-300 pl-1">없음</p>
                )}
              </div>
            </div>
          </div>

          {/* 우: 비용 요약 + 인건비 */}
          <div className="flex flex-col gap-3">

            {/* 비용 내역 */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold text-[#1B2A45]/40 uppercase tracking-widest mb-2">매입 내역</p>
              <SumRow label="세금 (10%)"        value={tax}           negative />
              <SumRow label="인건비 (세전)"      value={laborCost}     negative />
              <SumRow label="DB 비용"            value={dbCost}        negative />
              <SumRow label="임대료"             value={costs.rent}    negative />
              <SumRow label="관리비"             value={costs.mgmt}    negative />
              <SumRow label="고정비용(대출+구독)" value={autoSalesFixed} negative />
              {(costs.sales_other_items || []).map((item, i) => (
                <SumRow key={i} label={item.label || '기타'} value={item.amount} negative />
              ))}
              <div className="border-t border-gray-200 pt-2">
                <SumRow label="총 매입" value={totalRevenue > 0 ? tax + laborCost + otherTotal : 0} negative bold />
              </div>
            </div>

            {/* 대표 실수령 */}
            <div className={`rounded-xl border overflow-hidden ${realTakeHome >= 0 ? 'border-emerald-100' : 'border-red-100'}`}>
              <div className={`px-4 py-2 flex items-center justify-between ${realTakeHome >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <span className="text-xs font-bold text-gray-500">대표 실수령</span>
                <span className="text-[10px] text-gray-400">순이익에서 개인지출 차감</span>
              </div>
              <div className="bg-white px-4 py-3 space-y-2">
                {/* 개인카드 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">개인 카드값</span>
                  <div className="flex items-center gap-1.5">
                    <input type="text" inputMode="numeric" value={fmtInput(costs.personal_card)} placeholder="0"
                      onChange={e => setCosts(p => ({ ...p, personal_card: parseInput(e.target.value) }))}
                      className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-rose-300" />
                    <span className="text-[10px] text-red-400 font-medium">-</span>
                  </div>
                </div>
                {/* 개인 월세 */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">개인 월세</span>
                  <div className="flex items-center gap-1.5">
                    <input type="text" inputMode="numeric" value={fmtInput(costs.personal_rent)} placeholder="0"
                      onChange={e => setCosts(p => ({ ...p, personal_rent: parseInput(e.target.value) }))}
                      className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-rose-300" />
                    <span className="text-[10px] text-red-400 font-medium">-</span>
                  </div>
                </div>
                {/* 실수령 */}
                <div className={`border-t pt-2 flex items-center justify-between ${realTakeHome >= 0 ? 'border-emerald-100' : 'border-red-100'}`}>
                  <span className="text-xs font-bold text-gray-600">실제 남는 금액</span>
                  <span className={`text-lg font-black ${realTakeHome >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {totalRevenue > 0 ? realTakeHome.toLocaleString('ko-KR') + '원' : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── SumRow 헬퍼 ─────────────────────────────────────────

function SumRow({ label, value, bold, negative }: { label: string; value: number; bold?: boolean; negative?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-xs ${bold ? 'font-bold text-[#1B2A45]' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-xs font-semibold ${bold ? 'text-[#1B2A45] text-sm' : negative && value > 0 ? 'text-red-500' : 'text-gray-700'}`}>
        {value > 0 ? (negative ? '-' : '') + value.toLocaleString('ko-KR') + '원' : '-'}
      </span>
    </div>
  )
}
