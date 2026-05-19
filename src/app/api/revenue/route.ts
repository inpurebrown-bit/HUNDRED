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
  let opsQuery = supabaseAdmin
    .from('ops_cases')
    .select('id, details, created_at, updated_at, owner_id, ops_user_name, customer_name, phone')

  if (user.role === 'ops') opsQuery = opsQuery.eq('owner_id', user.id)

  const [{ data: custContracted }, { data: opsCases }] = await Promise.all([
    custQuery,
    opsQuery,
  ])

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

  // ── 관리팀 수수료 리스트 변환 ────────────────────────────────────────
  // fee_amount(1차) + payment_entries[*].fee_amount(추가)
  const opsEntries = (opsCases || [])
    .flatMap((c: any) => {
      const d = c.details || {}
      const entries: { id: string; amount: number; date: string; ops_user_id: string; ops_user_name: string; company: string }[] = []
      const fee1 = parseMoney(d.fee_amount)
      if (fee1 > 0) {
        entries.push({
          id: `${c.id}_1`,
          amount: fee1,
          date: d.deposit_date || c.updated_at?.slice(0, 10) || c.created_at?.slice(0, 10) || '',
          ops_user_id: String(c.owner_id || ''),
          ops_user_name: c.ops_user_name || d.ops_user_name || '',
          company: d.sales_customer_info?.company || c.customer_name || '',
        })
      }
      for (const pe of (d.payment_entries || [])) {
        const feeN = parseMoney(pe.fee_amount)
        if (feeN > 0) {
          entries.push({
            id: `${c.id}_${pe.id || entries.length}`,
            amount: feeN,
            date: pe.date || c.updated_at?.slice(0, 10) || '',
            ops_user_id: String(c.owner_id || ''),
            ops_user_name: c.ops_user_name || d.ops_user_name || '',
            company: d.sales_customer_info?.company || c.customer_name || '',
          })
        }
      }
      return entries
    })

  // ── 월별 집계 (최근 6개월) ──────────────────────────────────────────
  const now = new Date()
  const monthlyMap: Record<string, { sales: number; ops: number }> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = { sales: 0, ops: 0 }
  }

  salesEntries.forEach(e => {
    const key = e.date?.slice(0, 7)
    if (key && monthlyMap[key]) monthlyMap[key].sales += e.amount
  })
  opsEntries.forEach(e => {
    const key = e.date?.slice(0, 7)
    if (key && monthlyMap[key]) monthlyMap[key].ops += e.amount
  })

  const monthly = Object.entries(monthlyMap).map(([month, v]) => ({
    month: month.slice(5) + '월',
    fullMonth: month,
    영업팀: v.sales,
    관리팀: v.ops,
    합계: v.sales + v.ops,
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
  const thisMonthSales = salesEntries.filter(e => e.date?.startsWith(thisMonthKey))
  const thisMonthOps   = opsEntries.filter(e => e.date?.startsWith(thisMonthKey))

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
    thisMonthKey,
  })
}
