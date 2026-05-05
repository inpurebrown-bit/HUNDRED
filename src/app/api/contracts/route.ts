import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// POST: 계약 신청 (고객 → 계약 전환, 대표에게 배정 대기)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'sales') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { customer_id, contract_amount, memo } = await req.json()
  if (!customer_id) return NextResponse.json({ error: 'customer_id 필요' }, { status: 400 })

  // 고객 상태 → 'contracted'로 업데이트
  await supabaseAdmin
    .from('customers')
    .update({ status: 'contracted', updated_at: new Date().toISOString() })
    .eq('id', customer_id)

  // contracts 테이블에 등록 (대표 배정 대기)
  const { data, error } = await supabaseAdmin
    .from('contracts')
    .insert({
      customer_id,
      sales_user_id: user.id,
      sales_user_name: user.name,
      contract_amount: contract_amount || 0,
      memo: memo || '',
      status: 'pending_assign', // 대표 배정 대기
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contract: data }, { status: 201 })
}

// GET: 계약 목록 조회
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any

  const query = supabaseAdmin
    .from('contracts')
    .select('id, customer_id, sales_user_id, sales_user_name, contract_amount, memo, status, ops_user_id, ops_user_name, created_at, customers(name, phone, company)')
    .order('created_at', { ascending: false })

  const finalQuery = user.role === 'sales'
    ? query.eq('sales_user_id', user.id)
    : query

  const { data, error } = await finalQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contracts: data })
}
