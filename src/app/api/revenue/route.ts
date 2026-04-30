import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any

  // 영업팀 매출 (contracts.contract_amount)
  const contractsQuery = supabaseAdmin
    .from('contracts')
    .select('contract_amount, created_at, sales_user_id, sales_user_name, customers(name, company)')
    .order('created_at', { ascending: false })

  const finalContractsQuery = user.role === 'sales'
    ? contractsQuery.eq('sales_user_id', user.id)
    : contractsQuery

  // 관리팀 매출 (ops_cases.revenue)
  const opsQuery = supabaseAdmin
    .from('ops_cases')
    .select('revenue, created_at, ops_user_id, ops_user_name, customers(name, company)')
    .gt('revenue', 0)
    .order('created_at', { ascending: false })

  const finalOpsQuery = user.role === 'ops'
    ? opsQuery.eq('ops_user_id', user.id)
    : opsQuery

  const [{ data: contracts }, { data: opsCases }] = await Promise.all([
    finalContractsQuery,
    finalOpsQuery,
  ])

  // 월별 집계 (최근 6개월)
  const monthlyMap: Record<string, { sales: number; ops: number }> = {}

  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = { sales: 0, ops: 0 }
  }

  ;(contracts || []).forEach((c: any) => {
    const key = c.created_at?.slice(0, 7)
    if (key && monthlyMap[key]) monthlyMap[key].sales += c.contract_amount || 0
  })

  ;(opsCases || []).forEach((c: any) => {
    const key = c.updated_at?.slice(0, 7) || c.created_at?.slice(0, 7)
    if (key && monthlyMap[key]) monthlyMap[key].ops += c.revenue || 0
  })

  const monthly = Object.entries(monthlyMap).map(([month, v]) => ({
    month: month.slice(5) + '월',
    영업팀: v.sales,
    관리팀: v.ops,
    합계: v.sales + v.ops,
  }))

  // 직원별 집계
  const salesByUser: Record<string, { name: string; amount: number; count: number }> = {}
  ;(contracts || []).forEach((c: any) => {
    const id = c.sales_user_id
    if (!id) return
    if (!salesByUser[id]) salesByUser[id] = { name: c.sales_user_name, amount: 0, count: 0 }
    salesByUser[id].amount += c.contract_amount || 0
    salesByUser[id].count++
  })

  const opsByUser: Record<string, { name: string; amount: number; count: number }> = {}
  ;(opsCases || []).forEach((c: any) => {
    const id = c.ops_user_id
    if (!id) return
    if (!opsByUser[id]) opsByUser[id] = { name: c.ops_user_name, amount: 0, count: 0 }
    opsByUser[id].amount += c.revenue || 0
    opsByUser[id].count++
  })

  // 총계
  const totalSales = (contracts || []).reduce((s: number, c: any) => s + (c.contract_amount || 0), 0)
  const totalOps = (opsCases || []).reduce((s: number, c: any) => s + (c.revenue || 0), 0)

  return NextResponse.json({
    monthly,
    salesByUser: Object.values(salesByUser),
    opsByUser: Object.values(opsByUser),
    totalSales,
    totalOps,
    total: totalSales + totalOps,
  })
}
