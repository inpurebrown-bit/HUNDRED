import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any

  // 영업팀 매출 — contracts 테이블 + customers.details.my_revenue 병합
  const contractsQuery = supabaseAdmin
    .from('contracts')
    .select('contract_amount, created_at, sales_user_id, sales_user_name, customers(name, company)')
    .order('created_at', { ascending: false })

  const finalContractsQuery = user.role === 'sales'
    ? contractsQuery.eq('sales_user_id', user.id)
    : contractsQuery

  // customers 테이블에서 contracted 상태 & my_revenue 있는 행
  let custQuery = supabaseAdmin
    .from('customers')
    .select('id, owner_id, details, created_at')
    .eq('status', 'contracted')

  if (user.role === 'sales') custQuery = custQuery.eq('owner_id', user.id)

  // 관리팀 매출 (ops_cases.revenue)
  const opsQuery = supabaseAdmin
    .from('ops_cases')
    .select('revenue, created_at, updated_at, ops_user_id, ops_user_name, customers(name, company)')
    .gt('revenue', 0)
    .order('created_at', { ascending: false })

  const finalOpsQuery = user.role === 'ops'
    ? opsQuery.eq('ops_user_id', user.id)
    : opsQuery

  const [{ data: contracts }, { data: custContracted }, { data: opsCases }] = await Promise.all([
    finalContractsQuery,
    custQuery,
    finalOpsQuery,
  ])

  // customers.details.my_revenue 를 contract 형태로 변환 (contracts 테이블에 없는 것만)
  const contractCustomerIds = new Set((contracts || []).map((c: any) => c.customer_id || c.id).filter(Boolean))
  const custContracts = (custContracted || [])
    .filter((c: any) => {
      const rev = parseInt(String(c.details?.my_revenue || '0').replace(/[^0-9]/g, ''), 10)
      return rev > 0 && !contractCustomerIds.has(c.id)
    })
    .map((c: any) => ({
      contract_amount: parseInt(String(c.details?.my_revenue || '0').replace(/[^0-9]/g, ''), 10) || 0,
      created_at: c.details?.contract_date || c.created_at || '',
      sales_user_id: c.owner_id || c.details?.sales_user_id || '',
      sales_user_name: c.details?.sales_user_name || '',
    }))

  const allContracts = [...(contracts || []), ...custContracts]

  // 월별 집계 (최근 6개월)
  const monthlyMap: Record<string, { sales: number; ops: number }> = {}

  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[key] = { sales: 0, ops: 0 }
  }

  allContracts.forEach((c: any) => {
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
  allContracts.forEach((c: any) => {
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
  const totalSales = allContracts.reduce((s: number, c: any) => s + (c.contract_amount || 0), 0)
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
