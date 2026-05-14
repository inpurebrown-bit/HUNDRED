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
 *   is_refund, is_completed, approved_amount, commission_amount, created_at,
 *   timeline, details, customer_id
 *
 * 프론트 호환용 alias (GET 응답에서 추가):
 *   progress_stage = stage
 *   progress_memo  = memo
 */
function normalize(c: any, customerMap: Record<string, any> = {}) {
  // customers 테이블에서 전화번호로 매칭된 고객 데이터
  const cust = customerMap[c.phone] || null
  const custDetails = cust?.details || {}

  // sales_customer_info: ops_case.details에 저장된 값 OR customers 테이블 실시간 데이터
  const sci = c.details?.sales_customer_info || null

  return {
    ...c,
    progress_stage: c.stage ?? '',
    progress_memo:  c.memo  ?? '',
    customers: {
      name:    cust?.name ?? c.customer_name ?? '',
      phone:   c.phone ?? '',
      company: custDetails.company || c.customer_name || '',
      details: {
        company:         custDetails.company         || sci?.company         || c.customer_name || '',
        representative:  cust?.name                  || sci?.representative  || '',
        phone:           c.phone                     || '',
        business_type:   custDetails.business_type   || sci?.business_type   || '',
        region:          custDetails.region           || sci?.region          || '',
        loan_history:    cust?.loan_history           || sci?.loan_history    || '',
        call_result:     custDetails.call_result      || sci?.call_result     || '',
        closing_result:  custDetails.closing_result   || sci?.closing_result  || '',
        subcall_date:    custDetails.subcall_date      || sci?.subcall_date    || '',
        sales_user_name: custDetails.sales_user_name  || sci?.sales_user_name || '',
        created_at:      cust?.created_at             || sci?.created_at      || '',
        memo:            cust?.memo                   || '',
      },
      call_timeline: cust?.call_timeline || [],
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
  if (user.role === 'ops') {
    // owner_id로 배정된 케이스 OR 이름으로 배정된 케이스 OR 미배정(owner_id null + ops_user_name null)
    const userName = user.name || ''
    if (userName) {
      query = query.or(`owner_id.eq.${user.id},ops_user_name.eq.${userName},and(owner_id.is.null,ops_user_name.is.null)`) as any
    } else {
      query = query.or(`owner_id.eq.${user.id},owner_id.is.null`) as any
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cases = data || []

  // 전화번호 목록으로 customers 테이블 일괄 조회
  const phones = [...new Set(cases.map((c: any) => c.phone).filter(Boolean))]
  let customerMap: Record<string, any> = {}
  if (phones.length > 0) {
    const { data: custData } = await supabaseAdmin
      .from('customers')
      .select('name, phone, loan_history, call_timeline, details, created_at, memo')
      .in('phone', phones as string[])
    if (custData) {
      for (const c of custData) {
        if (c.phone && !customerMap[c.phone]) customerMap[c.phone] = c
      }
    }
  }

  return NextResponse.json({ cases: cases.map((c: any) => normalize(c, customerMap)) })
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
  const { customer_name, phone, stage, progress_stage, memo, revenue, owner_id, ops_user_name, timeline, customer_id, details } = body

  const { data, error } = await supabaseAdmin
    .from('ops_cases')
    .insert({
      customer_name:    customer_name ?? '',
      phone:            phone         ?? '',
      owner_id:         owner_id      ?? null,
      stage:            stage ?? progress_stage ?? '서류받는중',
      memo:             memo          ?? '',
      revenue:          revenue       ?? 0,
      institution_type: 'new',
      ...(ops_user_name ? { ops_user_name } : {}),
      ...(timeline      ? { timeline }      : {}),
      ...(customer_id   ? { customer_id }   : {}),
      ...(details       ? { details }       : {}),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ case: normalize(data) }, { status: 201 })
}
