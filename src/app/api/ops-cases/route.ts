import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: 내 담당 케이스 목록
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ops' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const query = supabaseAdmin
    .from('ops_cases')
    .select(`*, customers(name, phone, company, loan_history)`)
    .order('updated_at', { ascending: false })

  // 관리팀은 본인 담당 케이스만
  const finalQuery = user.role === 'ops'
    ? query.eq('ops_user_id', user.id)
    : query

  const { data, error } = await finalQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cases: data })
}

// POST: 영업팀 → 관리팀 케이스 전송
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'sales' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const { customer_id, progress_stage, progress_memo, revenue } = body

  if (!customer_id) {
    return NextResponse.json({ error: 'customer_id 필수' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('ops_cases')
    .insert({
      customer_id,
      progress_stage: progress_stage ?? 'assigned',
      progress_memo: progress_memo ?? '',
      revenue: revenue ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ case: data }, { status: 201 })
}
