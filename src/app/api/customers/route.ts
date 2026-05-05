import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: 내 고객 목록 조회
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'sales' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const query = supabaseAdmin
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  // 영업팀은 본인 고객만
  const finalQuery = user.role === 'sales'
    ? query.eq('sales_user_id', user.id)
    : query

  const { data, error } = await finalQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ customers: data })
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
  const { name, phone, company, loan_history, notes, status, details } = body

  if (!name || !name.trim()) {
    return NextResponse.json({ error: '고객명(대표자)은 필수입니다' }, { status: 400 })
  }

  const insertRow: Record<string, any> = {
    name: name.trim(),
    phone: phone || '',
    company: company || '',
    loan_history: loan_history || '',
    notes: notes || '',
    status: status || 'lead',
    sales_user_id: user.id,
    sales_user_name: user.name,
  }

  // details JSONB 필드 저장 (인콜일지 모든 항목 포함)
  if (details && typeof details === 'object') {
    insertRow.details = details
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert(insertRow)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ customer: data }, { status: 201 })
}
