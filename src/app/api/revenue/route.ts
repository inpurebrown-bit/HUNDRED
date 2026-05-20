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
      const rev = parseMoney(c.details?.my_revenue)
      if (rev === 0) return null
      return {
        id: c.id,
        amount: rev,
        date: c.details?.contract_date || c.created_at || '',
        sales_user_id: c.owner_id || '',
        sales_user_name: c.details?.sales_user_name || '',
        company: c.details?.company || c.name || '',
      }
    })
    .filter(Boolean) as { id: string; amount: number; date: string; sales_user_id: string; sales_user_name: string; company: string }[]

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

  // ── 이달 내역 ────────────────────────────────────────────────────────
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthSales         = salesEntries.filter(e => e.date?.startsWith(thisMonthKey))
  const thisMonthOps           = opsEntries.filter(e => e.date?.startsWith(thisMonthKey))
  const thisMonthOpsContracts  = opsContractEntries.filter(e => e.date?.startsWith(thisMonthKey))

  const totalSales = salesEntries.reduce((s, e) => s + e.amount, 0)
  const totalOps   = opsEntries.reduce((s, e) => s + e.amount, 0)

  return NextResponse.json({
    monthly,
    salesByUser: Object.values(salesByUser),
    opsByUser: Object.values(opsByUser),
    totalSales,
    totalOps,
    total: totalSales + totalOps,
    thisMonthSales,
    thisMonthOps,
    thisMonthOpsContracts,
    thisMonthKey,
  })
}
