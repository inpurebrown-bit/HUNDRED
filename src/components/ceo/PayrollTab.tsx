'use client'

import { useState, useEffect, useCallback } from 'react'

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
  contract_count: number   // 내부 보관 (자동 반영, 표시 안 함)
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

function defaultOps(): OpsEmployee {
  return { name: '', base_salary: 0, fee_revenue: 0, puto_revenue: 0, performance_bonus: 0 }
}
function defaultSales(): SalesEmployee {
  return { name: '', contract_revenue: 0, contract_count: 0, performance_bonus: 0, awards: [] }
}
function defaultCosts(): OtherCosts {
  return { db_count: 0, db_unit_price: 40000, rent: 650000, mgmt: 400000, sales_fixed: 820000, sales_other_items: [] }
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
      <div className="bg-gradient-to-r from-[#1B2A45] to-[#2d4a7a] px-4 py-3 flex items-center justify-between">
        <input
          type="text" value={emp.name}
          onChange={e => onChange(idx, 'name', e.target.value)}
          placeholder="직원명"
          className="bg-transparent text-white font-bold text-sm placeholder-white/40 border-none outline-none w-full"
        />
        <button onClick={() => onRemove(idx)} className="text-white/30 hover:text-white/70 text-sm ml-2 shrink-0">✕</button>
      </div>
      {/* 항목 */}
      <div className="px-4 py-3 space-y-0">
        <PayRow label="기본급" value={emp.base_salary} editable onEdit={v => onChange(idx, 'base_salary', v)} />
        <PayRow label="수수료매출(VAT제외)" value={emp.fee_revenue} editable autoTag onEdit={v => onChange(idx, 'fee_revenue', v)} />
        <PayRow label="수수료인센(10%)" value={c.feeInc} />
        <PayRow label="뿌토매출(VAT제외)" value={emp.puto_revenue} editable autoTag onEdit={v => onChange(idx, 'puto_revenue', v)} />
        <PayRow label="뿌토인센(35%)" value={c.putoInc} />
        <PayRow label="성과급" value={emp.performance_bonus} editable onEdit={v => onChange(idx, 'performance_bonus', v)} />
      </div>
      {/* 합계 */}
      <div className="bg-gray-50 px-4 py-3 space-y-1 border-t border-gray-100">
        <PayRow label="공제전급여" value={c.before} bold colorClass="text-blue-600" />
        <PayRow label="공제후급여(3.3%)" value={c.after} bold colorClass="text-emerald-600" />
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
      <div className="bg-gradient-to-r from-[#C5A258] to-[#d4b56a] px-4 py-3 flex items-center justify-between">
        <input
          type="text" value={emp.name}
          onChange={e => onChange(idx, 'name', e.target.value)}
          placeholder="사원명"
          className="bg-transparent text-white font-bold text-sm placeholder-white/40 border-none outline-none w-full"
        />
        <button onClick={() => onRemove(idx)} className="text-white/30 hover:text-white/70 text-sm ml-2 shrink-0">✕</button>
      </div>
      {/* 항목 */}
      <div className="px-4 py-3 space-y-0">
        <PayRow label="계약금매출(VAT제외)" value={emp.contract_revenue} editable autoTag onEdit={v => onChange(idx, 'contract_revenue', v)} />
        <PayRow label="계약금인센(25%)" value={c.contractInc} />
        <PayRow
          label={has12 ? '성과급(+5% ✓ 12개↑)' : '성과급(+5%, 12개↑)'}
          value={emp.performance_bonus}
          editable
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
      {/* 합계 */}
      <div className="bg-gray-50 px-4 py-3 space-y-1 border-t border-gray-100">
        <PayRow label="공제전급여" value={c.before} bold colorClass="text-blue-600" />
        <PayRow label="공제후급여(3.3%)" value={c.after} bold colorClass="text-emerald-600" />
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────

export default function PayrollTab() {
  const [yearMonth, setYearMonth] = useState(thisMonth())
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)
  const [msg, setMsg]             = useState('')

  const [opsEmps, setOpsEmps] = useState<OpsEmployee[]>([
    { ...defaultOps(), name: '관리팀장', base_salary: 2_000_000 },
  ])
  const [salesEmps, setSalesEmps] = useState<SalesEmployee[]>([
    { ...defaultSales(), name: '손제후' },
    { ...defaultSales(), name: '김윤지' },
  ])
  const [costs, setCosts]   = useState<OtherCosts>(defaultCosts())
  const [revTotals, setRevTotals] = useState<{ sales: number; ops: number; opsContract: number } | null>(null)

  // ── 자동 반영 ─────────────────────────────────────────────
  const autoLoad = useCallback(async () => {
    setAutoLoading(true)
    setMsg('')
    try {
      const res  = await fetch('/api/revenue')
      const data = await res.json()

      const salesEntries: any[]    = data.thisMonthSales    || []
      const opsEntries: any[]      = data.thisMonthOps      || []
      const contractEntries: any[] = data.thisMonthOpsContracts || []

      setRevTotals({
        sales:       salesEntries.reduce((s: number, e: any) => s + (e.amount || 0), 0),
        ops:         opsEntries.reduce((s: number, e: any) => s + (e.amount || 0), 0),
        opsContract: contractEntries.reduce((s: number, e: any) => s + (e.amount || 0), 0),
      })

      // 영업팀 — 이름 기준 집계 (sales_user_name 또는 owner_id로 fallback)
      const salesByName: Record<string, { amount: number; count: number }> = {}
      for (const e of salesEntries) {
        const name = (e.sales_user_name || '').trim()
        if (!name) continue
        if (!salesByName[name]) salesByName[name] = { amount: 0, count: 0 }
        salesByName[name].amount += e.amount || 0
        salesByName[name].count++
      }

      setSalesEmps(prev => prev.map(emp => {
        if (!emp.name) return emp
        const key = Object.keys(salesByName).find(k => k === emp.name || k.includes(emp.name) || emp.name.includes(k))
        if (!key) return emp
        const rev = salesByName[key]
        const autoPerf = rev.count >= 12 ? Math.round(rev.amount * 0.05) : emp.performance_bonus
        return { ...emp, contract_revenue: rev.amount, contract_count: rev.count, performance_bonus: autoPerf }
      }))

      // 관리팀 — 이름 기준 집계
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
      setOpsEmps(prev => prev.map(emp => {
        if (!emp.name) return emp
        const key = Object.keys(opsFeeByName).find(k => k === emp.name || k.includes(emp.name) || emp.name.includes(k))
        const pKey = Object.keys(opsPutoByName).find(k => k === emp.name || k.includes(emp.name) || emp.name.includes(k))
        return {
          ...emp,
          fee_revenue:  key  ? opsFeeByName[key]   : emp.fee_revenue,
          puto_revenue: pKey ? opsPutoByName[pKey]  : emp.puto_revenue,
        }
      }))

      setMsg('✅ 이달 매출 자동 반영 완료')
    } catch {
      setMsg('❌ 자동 로드 실패')
    } finally {
      setAutoLoading(false)
    }
  }, [])

  // ── 불러오기 ──────────────────────────────────────────────
  async function handleLoad() {
    setLoading(true)
    setMsg('')
    const res  = await fetch(`/api/payroll?year_month=${yearMonth}`)
    const json = await res.json()
    if (json.record?.employees) {
      const d = json.record.employees
      if (d.ops_employees)    setOpsEmps(d.ops_employees)
      if (d.sales_employees)  setSalesEmps(d.sales_employees)
      if (d.other_costs)      setCosts({ ...defaultCosts(), ...d.other_costs })
      if (d.revenue_totals)   setRevTotals(d.revenue_totals)
      setMsg('불러오기 완료')
    } else {
      if (yearMonth === thisMonth()) await autoLoad()
      else setMsg('저장된 데이터 없음')
    }
    setLoading(false)
  }

  useEffect(() => { handleLoad() }, [yearMonth]) // eslint-disable-line

  // ── 저장 ──────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year_month: yearMonth,
        employees: { ops_employees: opsEmps, sales_employees: salesEmps, other_costs: costs, revenue_totals: revTotals },
        memo: '',
      }),
    })
    const json = await res.json()
    setMsg(json.record ? '저장 완료 ✓' : '저장 실패: ' + json.error)
    setSaving(false)
  }

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
  const salesTotalBefore = salesCalcs.reduce((s, c) => s + c.before, 0)
  const laborCost = opsTotalBefore + salesTotalBefore

  const totalRevenue  = (revTotals?.sales || 0) + (revTotals?.ops || 0) + (revTotals?.opsContract || 0)
  const tax           = Math.round(totalRevenue * 0.10)
  const dbCost        = Number(costs.db_count) * Number(costs.db_unit_price)
  const otherItemsSum = (costs.sales_other_items || []).reduce((s, i) => s + Number(i.amount || 0), 0)
  const otherTotal    = dbCost + Number(costs.rent) + Number(costs.mgmt) + Number(costs.sales_fixed) + otherItemsSum
  const netProfit     = totalRevenue - tax - laborCost - otherTotal

  const isCurrentMonth = yearMonth === thisMonth()

  // 이름 있는 직원만 표시
  const namedOps   = opsEmps.filter(e => e.name.trim())
  const namedSales = salesEmps.filter(e => e.name.trim())

  return (
    <div className="space-y-6 pb-10">

      {/* ── 헤더 바 ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />

        {isCurrentMonth && (
          <button onClick={autoLoad} disabled={autoLoading}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
            {autoLoading ? '⏳ 반영 중...' : '🔄 이달 매출 자동 반영'}
          </button>
        )}

        <button onClick={handleSave} disabled={saving}
          className="bg-[#1B2A45] hover:bg-[#1B2A45]/90 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors">
          {saving ? '저장 중...' : '💾 저장'}
        </button>

        {loading && <span className="text-xs text-blue-500 animate-pulse">불러오는 중...</span>}
        {msg && <span className={`text-xs font-medium ${msg.includes('✅') || msg.includes('완료') ? 'text-emerald-600' : msg.includes('❌') || msg.includes('실패') ? 'text-red-500' : 'text-gray-500'}`}>{msg}</span>}
      </div>

      {/* ── 2단 레이아웃 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* 관리팀 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1B2A45]">관리팀</h3>
            {namedOps.length > 0 && (
              <span className="text-xs text-gray-400">
                합계 공제후 <span className="font-bold text-[#1B2A45]">{opsCalcs.filter((_, i) => opsEmps[i].name).reduce((s, c) => s + c.after, 0).toLocaleString('ko-KR')}원</span>
              </span>
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

        {/* 영업팀 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1B2A45]">영업팀</h3>
            {namedSales.length > 0 && (
              <span className="text-xs text-gray-400">
                합계 공제후 <span className="font-bold text-[#1B2A45]">{salesCalcs.filter((_, i) => salesEmps[i].name).reduce((s, c) => s + c.after, 0).toLocaleString('ko-KR')}원</span>
              </span>
            )}
          </div>

          {salesEmps.map((emp, i) => (
            <SalesCard key={i} emp={emp} idx={i}
              onChange={updateSales} onRemove={removeSales}
              onAddAward={addAward} onUpdateAward={updateAward} onRemoveAward={removeAward} />
          ))}

          <button onClick={() => setSalesEmps(prev => [...prev, defaultSales()])}
            className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-400 hover:border-[#C5A258]/60 hover:text-[#C5A258]/80 transition-colors">
            + 직원 추가
          </button>
        </div>
      </div>

      {/* ── 회사 손익 요약 ── */}
      <div className="bg-white rounded-2xl border border-[#E8E2D4] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E8E2D4] flex items-center justify-between bg-gradient-to-r from-[#1B2A45]/3 to-transparent">
          <h3 className="text-sm font-bold text-[#1B2A45]">회사 손익 요약</h3>
          {revTotals && (
            <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">📡 매출 자동 반영됨</span>
          )}
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* 좌: 매출 + 운영비 입력 */}
          <div className="space-y-4">
            {/* 매출 내역 */}
            <div className="bg-[#1B2A45]/3 rounded-xl p-4 space-y-2">
              <p className="text-[11px] font-bold text-[#1B2A45]/50 uppercase tracking-widest mb-2">매출 내역</p>
              <SumRow label="영업팀 매출" value={revTotals?.sales || 0} />
              <SumRow label="관리팀 수수료 매출" value={revTotals?.ops || 0} />
              <SumRow label="관리팀 뿌토 매출" value={revTotals?.opsContract || 0} />
              <div className="border-t border-[#1B2A45]/10 pt-2">
                <SumRow label="총 매출" value={totalRevenue} bold />
              </div>
            </div>

            {/* 운영비 */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-[#1B2A45]/50 uppercase tracking-widest">운영비</p>

              {/* DB */}
              <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                <span className="text-xs text-gray-500">DB 공급 비용</span>
                <div className="flex items-center gap-1.5 text-xs">
                  <input type="text" inputMode="numeric" value={fmtInput(costs.db_count)} placeholder="0"
                    onChange={e => setCosts(p => ({ ...p, db_count: parseInput(e.target.value) }))}
                    className="w-14 text-center border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <span className="text-gray-400">개 × </span>
                  <input type="text" inputMode="numeric" value={fmtInput(costs.db_unit_price)} placeholder="40,000"
                    onChange={e => setCosts(p => ({ ...p, db_unit_price: parseInput(e.target.value) }))}
                    className="w-20 text-center border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <span className="text-gray-400">원</span>
                  <span className="font-semibold text-gray-700 w-16 text-right">{dbCost > 0 ? dbCost.toLocaleString('ko-KR') + '원' : '-'}</span>
                </div>
              </div>

              {([
                ['rent',        '임대료',         costs.rent],
                ['mgmt',        '관리비',         costs.mgmt],
                ['sales_fixed', '영업 고정비용',   costs.sales_fixed],
              ] as [keyof OtherCosts, string, number][]).map(([key, label, val]) => (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-xs text-gray-500">{label}</span>
                  <div className="flex items-center gap-2">
                    <input type="text" inputMode="numeric" value={fmtInput(val)} placeholder="0"
                      onChange={e => setCosts(p => ({ ...p, [key]: parseInput(e.target.value) }))}
                      className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                </div>
              ))}

              {/* 기타비용 */}
              <div>
                <div className="flex items-center gap-2 py-1 mb-1">
                  <span className="text-xs text-gray-500">영업 기타비용</span>
                  <button onClick={() => setCosts(p => ({ ...p, sales_other_items: [...(p.sales_other_items || []), { label: '', amount: 0 }] }))}
                    className="text-[10px] text-blue-500 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50">+ 추가</button>
                </div>
                {(costs.sales_other_items || []).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1.5">
                    <input type="text" value={item.label} placeholder="품목명"
                      onChange={e => { const arr = [...costs.sales_other_items]; arr[i] = { ...arr[i], label: e.target.value }; setCosts(p => ({ ...p, sales_other_items: arr })) }}
                      className="flex-1 min-w-0 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none" />
                    <input type="text" inputMode="numeric" value={fmtInput(item.amount)} placeholder="금액"
                      onChange={e => { const arr = [...costs.sales_other_items]; arr[i] = { ...arr[i], amount: parseInput(e.target.value) }; setCosts(p => ({ ...p, sales_other_items: arr })) }}
                      className="w-28 text-right border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none" />
                    <button onClick={() => setCosts(p => ({ ...p, sales_other_items: p.sales_other_items.filter((_, j) => j !== i) }))} className="text-red-300 hover:text-red-500 text-xs">✕</button>
                  </div>
                ))}
                {(costs.sales_other_items || []).length === 0 && (
                  <p className="text-[11px] text-gray-300 pl-1">없음</p>
                )}
              </div>
            </div>
          </div>

          {/* 우: 결과 요약 */}
          <div className="flex flex-col gap-3">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-[11px] font-bold text-[#1B2A45]/50 uppercase tracking-widest mb-2">비용 내역</p>
              <SumRow label="세금 (10%)" value={tax} negative />
              <SumRow label="인건비 (세전)" value={laborCost} negative />
              <SumRow label="DB 비용" value={dbCost} negative />
              <SumRow label="임대료" value={costs.rent} negative />
              <SumRow label="관리비" value={costs.mgmt} negative />
              <SumRow label="영업 고정비용" value={costs.sales_fixed} negative />
              {(costs.sales_other_items || []).map((item, i) => (
                <SumRow key={i} label={item.label || '기타'} value={item.amount} negative />
              ))}
              <div className="border-t border-gray-200 pt-2">
                <SumRow label="총 비용" value={totalRevenue > 0 ? tax + laborCost + otherTotal : 0} negative bold />
              </div>
            </div>

            <div className={`rounded-2xl p-5 ${netProfit >= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
              <p className="text-xs font-bold text-gray-400 mb-1">순이익</p>
              <p className={`text-3xl font-black tracking-tight ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalRevenue > 0 ? netProfit.toLocaleString('ko-KR') + '원' : '—'}
              </p>
              {totalRevenue > 0 && (
                <p className="text-[11px] text-gray-400 mt-1.5">이익률 {((netProfit / totalRevenue) * 100).toFixed(1)}%</p>
              )}
            </div>

            {/* 팀별 인건비 소계 */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-[11px] font-bold text-[#1B2A45]/50 uppercase tracking-widest mb-2">인건비 내역</p>
              <SumRow label="관리팀 공제전 합계" value={opsTotalBefore} />
              <SumRow label="영업팀 공제전 합계" value={salesTotalBefore} />
              <div className="border-t border-gray-200 pt-2">
                <SumRow label="합계" value={laborCost} bold />
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
