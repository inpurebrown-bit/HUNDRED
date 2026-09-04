import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

function parseMoney(v: any): number {
  if (!v) return 0
  return parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any

  // ── 영업팀 매출: contracted 고객의 my_revenue ──────────────────────────
  let custQuery = supabaseAdmin
    .from('customers')
    .select('id, owner_id, name, details, created_at')
    .eq('status', 'contracted')

  if (user.role === 'sales') custQuery = custQuery.eq('owner_id', user.id)

  // ── 관리팀 매출: ops_cases.details.fee_amount + payment_entries[*].fee_amount ──
  // ops-cases GET과 동일한 JS 필터 방식으로 owner_id/ops_user_name/details.ops_user_name 모두 매칭
  const opsQuery = supabaseAdmin
    .from('ops_cases')
    .select('id, details, created_at, owner_id, ops_user_name, customer_name, phone')

  const [{ data: custContracted }, { data: opsCasesRaw }] = await Promise.all([
    custQuery,
    opsQuery,
  ])

  let opsCases = opsCasesRaw || []
  if (user.role === 'ops') {
    const myId   = String(user.id).trim()
    const myName = (user.name || '').trim()
    const isLeader = myName.includes('팀장')
    if (!isLeader) {
      opsCases = opsCases.filter((c: any) => {
        const ownerMatch   = c.owner_id != null && String(c.owner_id).trim() === myId
        const nameMatch    = c.ops_user_name && c.ops_user_name.trim() === myName
        const detailsMatch = c.details?.ops_user_name && String(c.details.ops_user_name).trim() === myName
        return ownerMatch || nameMatch || detailsMatch
      })
    }
  }

  // ── 영업팀 계약 리스트 변환 ──────────────────────────────────────────
  const salesEntries = (custContracted || [])
    .map((c: any) => {
      const payAmt = parseMoney(c.details?.payment_amount)
      // vat_included=true이면 공급가액(부가세제외)을 매출로 사용
      const supplyAmt = c.details?.vat_included ? Math.round(payAmt / 1.1) : payAmt
      const rev = parseMoney(c.details?.my_revenue) || supplyAmt
      if (rev === 0) return null
      return {
        id: c.id,
        amount: rev,
        date: c.details?.contract_date || c.created_at || '',
        sales_user_id: c.owner_id || '',
        sales_user_name: c.details?.sales_user_name || '',
        company: c.details?.company || c.name || '',
        payment_amount: c.details?.payment_amount,
        vat_included: c.details?.vat_included,
      }
    })
    .filter(Boolean) as { id: string; amount: number; date: string; sales_user_id: string; sales_user_name: string; company: string; payment_amount?: any; vat_included?: boolean }[]

  type OpsEntry = { id: string; amount: number; date: string; ops_user_id: string; ops_user_name: string; company: string }

  // ── 관리팀 수수료 리스트 변환 ────────────────────────────────────────
  // fee_amount(1차) + payment_entries[*].fee_amount(추가)
  const todayStr = new Date().toISOString().slice(0, 10)
  const opsEntries: OpsEntry[] = (opsCases || [])
    .flatMap((c: any) => {
      const d = c.details || {}
      const entries: OpsEntry[] = []
      const fee1 = parseMoney(d.fee_amount)
      if (fee1 > 0) {
        // deposit_date 우선 → updated_at → created_at → 오늘 (반드시 날짜 있어야 월별 집계 가능)
        const entryDate = d.deposit_date || c.created_at?.slice(0, 10) || todayStr
        entries.push({
          id: `${c.id}_1`,
          amount: fee1,
          date: entryDate,
          ops_user_id: String(c.owner_id || ''),
          ops_user_name: c.ops_user_name || d.ops_user_name || '',
          company: d.sales_customer_info?.company || d.company || c.customer_name || '',
        })
      }
      for (const pe of (d.payment_entries || [])) {
        const feeN = parseMoney(pe.fee_amount)
        if (feeN > 0) {
          entries.push({
            id: `${c.id}_${pe.id || entries.length}`,
            amount: feeN,
            date: pe.date || c.created_at?.slice(0, 10) || todayStr,
            ops_user_id: String(c.owner_id || ''),
            ops_user_name: c.ops_user_name || d.ops_user_name || '',
            company: d.sales_customer_info?.company || d.company || c.customer_name || '',
          })
        }
      }
      return entries
    })

  // ── 관리팀 계약 매출 (뿌토 계약 + 직접계약) ──────────────────────────
  type OpsContractEntry = OpsEntry & { type: 'puto' | 'direct' }
  const opsContractEntries: OpsContractEntry[] = (opsCases || [])
    .flatMap((c: any) => {
      const d = c.details || {}
      const entries: OpsContractEntry[] = []
      const ownerName = c.ops_user_name || d.ops_user_name || ''
      const ownerId   = String(c.owner_id || '')
      // 뿌토 계약 (신규DB → 계약)
      const putoAmt = parseMoney(d.puto_contract_amount)
      if (putoAmt > 0) {
        entries.push({
          id: `${c.id}_puto`,
          amount: putoAmt,
          date: d.puto_contract_date || c.created_at?.slice(0, 10) || '',
          ops_user_id: ownerId, ops_user_name: ownerName,
          company: d.sales_customer_info?.company || c.customer_name || '',
          type: 'puto',
        })
      }
      // 직접계약 (관리팀 계약 탭)
      if (d.is_ops_direct_contract) {
        const contractAmt = parseMoney(d.contract_amount)
        if (contractAmt > 0) {
          entries.push({
            id: `${c.id}_direct`,
            amount: contractAmt,
            date: d.contract_date || c.created_at?.slice(0, 10) || '',
            ops_user_id: ownerId, ops_user_name: ownerName,
            company: c.customer_name || '',
            type: 'direct',
          })
        }
      }
      return entries
    })

  // ── 월별 집계 (최근 6개월) ──────────────────────────────────────────
  const now = new Date()
  const monthlyMap: Record<string, { sales: number; ops: number; ops_contract: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = { sales: 0, ops: 0, ops_contract: 0 }
  }

  salesEntries.forEach(e => {
    const key = e.date?.slice(0, 7)
    if (key && monthlyMap[key]) monthlyMap[key].sales += e.amount
  })
  opsEntries.forEach(e => {
    const key = e.date?.slice(0, 7)
    if (key && monthlyMap[key]) monthlyMap[key].ops += e.amount
  })
  opsContractEntries.forEach(e => {
    const key = e.date?.slice(0, 7)
    if (key && monthlyMap[key]) monthlyMap[key].ops_contract += e.amount
  })

  const monthly = Object.entries(monthlyMap).map(([month, v]) => ({
    month: month.slice(5) + '월',
    fullMonth: month,
    영업팀: v.sales,
    관리팀: v.ops,
    관리팀계약: v.ops_contract,
    합계: v.sales + v.ops + v.ops_contract,
  }))

  // ── 연도별 매출 집계 ────────────────────────────────────────────────
  const thisYear = now.getFullYear()
  const lastYear = thisYear - 1
  const annualRevenue: Record<string, { sales: number; ops: number; total: number }> = {
    [String(lastYear)]: { sales: 0, ops: 0, total: 0 },
    [String(thisYear)]: { sales: 0, ops: 0, total: 0 },
  }
  salesEntries.forEach(e => {
    const year = e.date?.slice(0, 4)
    if (year && annualRevenue[year]) { annualRevenue[year].sales += e.amount; annualRevenue[year].total += e.amount }
  })
  opsEntries.forEach(e => {
    const year = e.date?.slice(0, 4)
    if (year && annualRevenue[year]) { annualRevenue[year].ops += e.amount; annualRevenue[year].total += e.amount }
  })

  // ── 부가세 기간별 집계 ───────────────────────────────────────────────
  // 작년 2기(7~12월) / 이번년 1기(1~6월) / 이번년 2기(7~12월)
  const prevH2Start = `${lastYear}-07`; const prevH2End = `${lastYear}-12`
  const currH1Start = `${thisYear}-01`; const currH1End = `${thisYear}-06`
  const currH2Start = `${thisYear}-07`; const currH2End = `${thisYear}-12`
  const vatPrevH2 = { sales_vat: 0, ops_vat: 0 }
  const vatCurrH1 = { sales_vat: 0, ops_vat: 0 }
  const vatCurrH2 = { sales_vat: 0, ops_vat: 0 }

  // 영업팀 착수금 VAT (vat_included=true → payment_amount/11)
  ;(custContracted || []).forEach((c: any) => {
    if (!c.details?.vat_included) return
    const payAmt = parseMoney(c.details?.payment_amount)
    if (!payAmt) return
    const vat = Math.round(payAmt / 11)
    const month = (c.details?.contract_date || c.created_at || '').slice(0, 7)
    if (month >= prevH2Start && month <= prevH2End) vatPrevH2.sales_vat += vat
    if (month >= currH1Start && month <= currH1End) vatCurrH1.sales_vat += vat
    if (month >= currH2Start && month <= currH2End) vatCurrH2.sales_vat += vat
  })

  // 관리팀 수수료 VAT: tax_invoice_requested=false로 명시된 것만 제외, 나머지(true/undefined) 포함
  ;(opsCases || []).forEach((c: any) => {
    const d = c.details || {}
    // 1차 수수료
    if (d.tax_invoice_requested !== false) {
      const feeAmt = parseMoney(d.fee_amount)
      if (feeAmt > 0) {
        const vat = Math.round(feeAmt * 0.1)
        const month = (d.deposit_date || c.created_at || '').slice(0, 7)
        if (month >= prevH2Start && month <= prevH2End) vatPrevH2.ops_vat += vat
        if (month >= currH1Start && month <= currH1End) vatCurrH1.ops_vat += vat
        if (month >= currH2Start && month <= currH2End) vatCurrH2.ops_vat += vat
      }
    }
    // payment_entries 수수료
    for (const pe of (d.payment_entries || [])) {
      if (pe.tax_invoice_requested === false) continue
      const feeAmt = parseMoney(pe.fee_amount)
      if (feeAmt <= 0) continue
      const vat = Math.round(feeAmt * 0.1)
      const month = (pe.date || c.created_at || '').slice(0, 7)
      if (month >= prevH2Start && month <= prevH2End) vatPrevH2.ops_vat += vat
      if (month >= currH1Start && month <= currH1End) vatCurrH1.ops_vat += vat
      if (month >= currH2Start && month <= currH2End) vatCurrH2.ops_vat += vat
    }
  })

  // ── 직원별 집계 ─────────────────────────────────────────────────────
  const salesByUser: Record<string, { name: string; amount: number; count: number }> = {}
  salesEntries.forEach(e => {
    const id = e.sales_user_id
    if (!id) return
    if (!salesByUser[id]) salesByUser[id] = { name: e.sales_user_name, amount: 0, count: 0 }
    salesByUser[id].amount += e.amount
    salesByUser[id].count++
  })

  const opsByUser: Record<string, { name: string; amount: number; count: number }> = {}
  opsEntries.forEach(e => {
    const id = e.ops_user_id || e.ops_user_name
    if (!id) return
    if (!opsByUser[id]) opsByUser[id] = { name: e.ops_user_name, amount: 0, count: 0 }
    opsByUser[id].amount += e.amount
    opsByUser[id].count++
  })

  // ── 특정 월 조회 (year_month 파라미터) — PayrollTab 과거 월 복구용 ──────
  const targetMonth = req.nextUrl.searchParams.get('year_month')
  if (targetMonth) {
    const targetOps      = opsEntries.filter(e => e.date?.startsWith(targetMonth))
    const targetContracts = opsContractEntries.filter(e => e.date?.startsWith(targetMonth))
    const targetSales    = salesEntries.filter(e => e.date?.startsWith(targetMonth))
    return NextResponse.json({
      thisMonthOps:          targetOps,
      thisMonthOpsContracts: targetContracts,
      thisMonthSales:        targetSales,
    })
  }

  // ── 이달 / 지난달 내역 ──────────────────────────────────────────────
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthDate2 = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthKey  = `${lastMonthDate2.getFullYear()}-${String(lastMonthDate2.getMonth() + 1).padStart(2, '0')}`

  const thisMonthSales         = salesEntries.filter(e => e.date?.startsWith(thisMonthKey))
  const thisMonthOps           = opsEntries.filter(e => e.date?.startsWith(thisMonthKey))
  const thisMonthOpsContracts  = opsContractEntries.filter(e => e.date?.startsWith(thisMonthKey))
  const lastMonthOps           = opsEntries.filter(e => e.date?.startsWith(lastMonthKey))
  const lastMonthOpsContracts  = opsContractEntries.filter(e => e.date?.startsWith(lastMonthKey))
  const twoMonthsAgoDate2 = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  const twoAgoKey = `${twoMonthsAgoDate2.getFullYear()}-${String(twoMonthsAgoDate2.getMonth() + 1).padStart(2, '0')}`
  const twoAgoOps          = opsEntries.filter(e => e.date?.startsWith(twoAgoKey))
  const twoAgoOpsContracts = opsContractEntries.filter(e => e.date?.startsWith(twoAgoKey))

  const totalSales = salesEntries.reduce((s, e) => s + e.amount, 0)
  const totalOps   = opsEntries.reduce((s, e) => s + e.amount, 0)

  // 뿌토 계약 건수 (puto_contract_amount 있는 ops_cases)
  const putoContractCount = (opsCases || []).filter((c: any) =>
    parseMoney(c.details?.puto_contract_amount) > 0
  ).length

  return NextResponse.json({
    monthly,
    salesByUser: Object.values(salesByUser),
    opsByUser: Object.values(opsByUser),
    totalSales,
    totalOps,
    total: totalSales + totalOps,
    putoContractCount,
    thisMonthSales,
    thisMonthOps,
    thisMonthOpsContracts,
    lastMonthOps,
    lastMonthOpsContracts,
    twoAgoOps,
    twoAgoOpsContracts,
    thisMonthKey,
    annualRevenue,
    vatPrevH2: { period: `${lastYear}년 7~12월`, ...vatPrevH2, total_vat: vatPrevH2.sales_vat + vatPrevH2.ops_vat },
    vatCurrH1: { period: `${thisYear}년 1~6월`, ...vatCurrH1, total_vat: vatCurrH1.sales_vat + vatCurrH1.ops_vat },
    vatCurrH2: { period: `${thisYear}년 7~12월`, ...vatCurrH2, total_vat: vatCurrH2.sales_vat + vatCurrH2.ops_vat },
    lastYear,
    thisYear,
  })
}
