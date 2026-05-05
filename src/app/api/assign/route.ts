import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// POST: 대표가 계약 건을 관리팀 직원에게 배정
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '대표만 배정 가능' }, { status: 403 })

  const { contract_id, ops_user_id, ops_user_name } = await req.json()
  if (!contract_id || !ops_user_id) {
    return NextResponse.json({ error: 'contract_id, ops_user_id 필요' }, { status: 400 })
  }

  // 계약 정보 조회
  const { data: contract } = await supabaseAdmin
    .from('contracts')
    .select('id, customer_id, sales_user_name, contract_amount, memo, status, created_at, customers(name, phone, company, loan_history)')
    .eq('id', contract_id)
    .single()

  if (!contract) return NextResponse.json({ error: '계약 없음' }, { status: 404 })

  // ops_cases 생성
  const { data: opsCase, error: opsError } = await supabaseAdmin
    .from('ops_cases')
    .insert({
      customer_id: contract.customer_id,
      contract_id: contract_id,
      ops_user_id,
      ops_user_name,
      institution: '',
      solution_type: '',
      progress_stage: 'assigned',
      progress_memo: contract.memo || '',
      revenue: 0,
    })
    .select()
    .single()

  if (opsError) return NextResponse.json({ error: opsError.message }, { status: 500 })

  // 계약 상태 → assigned
  await supabaseAdmin
    .from('contracts')
    .update({ status: 'assigned', ops_user_id, ops_user_name })
    .eq('id', contract_id)

  return NextResponse.json({ opsCase }, { status: 201 })
}

// GET: 미배정 계약 목록 (대표용)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('contracts')
    .select('id, customer_id, sales_user_name, contract_amount, memo, status, created_at, customers(name, phone, company)')
    .eq('status', 'pending_assign')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contracts: data })
}
