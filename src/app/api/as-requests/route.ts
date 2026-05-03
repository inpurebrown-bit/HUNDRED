import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: CEO only - AS 요청 목록 조회
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const baseQuery = supabaseAdmin
    .from('as_requests')
    .select('*')
    .order('created_at', { ascending: false })

  const { data, error } = await (status
    ? baseQuery.eq('status', status)
    : baseQuery)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ as_requests: data })
}

// POST: 영업팀 또는 CEO - 신규 AS 요청 등록
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'sales' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const {
    company_name,
    customer_name,
    phone,
    sales_user_name,
    request_type,
    notes,
  } = body

  if (!company_name) return NextResponse.json({ error: '업체명은 필수입니다' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('as_requests')
    .insert({
      company_name,
      customer_name: customer_name || '',
      phone: phone || '',
      sales_user_name: sales_user_name || user.name || '',
      request_type: request_type || '',
      notes: notes || '',
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ as_request: data }, { status: 201 })
}

// PATCH: CEO only - ?id= 쿼리 파라미터 필요 - 상태 업데이트
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id는 필수입니다' }, { status: 400 })

  const body = await req.json()

  const { data, error } = await supabaseAdmin
    .from('as_requests')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ as_request: data })
}
