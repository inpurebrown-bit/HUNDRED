import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeCustomers, toDbRow } from '@/lib/customerUtils'

// GET: 내 고객 목록 조회
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'sales' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  // Supabase 기본 응답 제한(1,000행)을 넘는 고객도 모두 가져오도록 페이지 단위로 반복 조회
  // scope=payroll: 급여·정산에 쓰이는 고객만 (계약/환불 + 환수차감·잔금 추가입금 보유)
  const payrollOnly = req.nextUrl.searchParams.get('scope') === 'payroll'
  const PAGE = 1000
  const rows: any[] = []
  for (let from = 0; ; from += PAGE) {
    let q = supabaseAdmin
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE - 1)
    // 영업팀은 본인 고객만 (DB 실제 컬럼: owner_id)
    if (user.role === 'sales') q = q.eq('owner_id', user.id)
    if (payrollOnly) q = q.or('status.in.(contracted,refunded),details->>refund_deduction_weight.not.is.null,details->extra_counts.not.is.null')
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    rows.push(...(data || []))
    if (!data || data.length < PAGE) break
  }

  return NextResponse.json({ customers: normalizeCustomers(rows) })
}

// POST: 신규 고객 등록
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'sales' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })
  }

  const body = await req.json()
  const { name, sales_user_id } = body

  if (!name || !name.trim()) {
    return NextResponse.json({ error: '고객명(대표자)은 필수입니다' }, { status: 400 })
  }

  // CEO는 특정 영업팀 직원에게 배정 가능
  let assignedUserId = user.id
  let assignedUserName = user.name

  if (user.role === 'ceo' && sales_user_id) {
    const { data: salesUser } = await supabaseAdmin
      .from('users').select('id, name').eq('id', sales_user_id).single()
    if (salesUser) {
      assignedUserId = salesUser.id
      assignedUserName = body.sales_user_name || salesUser.name
    }
  }

  const insertRow = toDbRow(body, assignedUserId, assignedUserName)

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert(insertRow)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ customer: normalizeCustomers([data])[0] }, { status: 201 })
}
