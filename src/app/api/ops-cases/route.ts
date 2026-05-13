import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 실제 ops_cases 컬럼:
 *   id, contract_id, owner_id, customer_name, phone,
 *   institution, institution_type, solution, stage, memo,
 *   revenue, visit_date, script_delivered, next_plan,
 *   required_checks, fund_solution, tax_invoice_requested,
 *   is_refund, is_completed, approved_amount, commission_amount, created_at
 *
 * 프론트 호환용 alias (GET 응답에서 추가):
 *   progress_stage = stage
 *   progress_memo  = memo
 *   ops_user_name  = owner_id에서 조회 or stored
 */
function normalize(c: any) {
  return {
    ...c,
    progress_stage: c.stage ?? '',
    progress_memo:  c.memo  ?? '',
    // customers 구조 맞추기 (customer_name/phone이 직접 컬럼)
    customers: {
      name:    c.customer_name ?? '',
      phone:   c.phone         ?? '',
      details: { company: c.customer_name ?? '' },
    },
  }
}

// GET: 케이스 목록
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ops' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  let query = supabaseAdmin.from('ops_cases').select('*')
  // ops 사용자는 본인 케이스 + 미배정(owner_id null) 케이스 모두 조회
  if (user.role === 'ops') query = query.or(`owner_id.eq.${user.id},owner_id.is.null`) as any

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ cases: (data || []).map(normalize) })
}

// POST: 케이스 등록 (자금팀전송)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'sales' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const { customer_name, phone, stage, memo, revenue, owner_id, timeline } = body

  const { data, error } = await supabaseAdmin
    .from('ops_cases')
    .insert({
      customer_name:    customer_name ?? '',
      phone:            phone         ?? '',
      owner_id:         owner_id      ?? null,
      stage:            stage         ?? '서류받는중',
      memo:             memo          ?? '',
      revenue:          revenue       ?? 0,
      institution_type: 'new',
      ...(timeline ? { timeline } : {}),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ case: normalize(data) }, { status: 201 })
}
