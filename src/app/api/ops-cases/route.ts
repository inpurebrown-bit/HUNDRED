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

  // 전체 케이스 조회 후 JS에서 필터 (owner_id 타입 불일치 방어)
  const { data: allData, error } = await supabaseAdmin.from('ops_cases').select('*')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let cases = allData || []

  if (user.role === 'ops') {
    const myId   = String(user.id).trim()
    const myName = (user.name || '').trim()
    cases = cases.filter(c => {
      const ownerMatch = c.owner_id != null && String(c.owner_id).trim() === myId
      const nameMatch  = c.ops_user_name && c.ops_user_name.trim() === myName
      const unassigned = c.owner_id == null && !c.ops_user_name
      return ownerMatch || nameMatch || unassigned
    })
  }

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
