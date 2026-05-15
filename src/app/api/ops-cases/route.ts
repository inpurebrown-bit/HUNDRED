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

  // sci → custDetails 순으로 머지 (DB의 최신 데이터가 우선)
  // 명시적 필드는 아래에서 덮어씌움
  const mergedDetails: Record<string, any> = {
    ...(sci  || {}),       // sales_customer_info 기본값
    ...custDetails,        // customers 테이블 최신값 우선
    // 명시적 우선순위 필드
    company:         custDetails.company         || sci?.company         || c.customer_name || '',
    representative:  cust?.name                  || sci?.representative  || custDetails.representative || '',
    phone:           c.phone                     || '',
    business_type:   custDetails.business_type   || sci?.business_type   || '',
    region:          custDetails.region           || sci?.region          || '',
    loan_history:    cust?.loan_history           || sci?.loan_history    || custDetails.loan_history || '',
    call_result:     custDetails.call_result      || sci?.call_result     || '',
    closing_result:  custDetails.closing_result   || sci?.closing_result  || '',
    subcall_date:    custDetails.subcall_date      || sci?.subcall_date    || '',
    sales_user_name: custDetails.sales_user_name  || sci?.sales_user_name || '',
    created_at:      cust?.created_at             || sci?.created_at      || '',
    memo:            cust?.memo                   || '',
    // 추가 인콜일지 필드 (영업팀 → 자금팀 전달)
    real_work:        custDetails.real_work        || sci?.real_work        || '',
    years_in_business:custDetails.years_in_business|| sci?.years_in_business|| custDetails.biz_size || '',
    employee_count:   custDetails.employee_count   || sci?.employee_count   || '',
    innovation:       custDetails.innovation        || sci?.innovation        || '',
    reception_date:   custDetails.reception_date    || sci?.reception_date    || '',
    // 대출 현황
    loan_kibo:    custDetails.loan_kibo    || sci?.loan_kibo    || custDetails.loan_policy || '',
    loan_shinbo:  custDetails.loan_shinbo  || sci?.loan_shinbo  || '',
    loan_jaedan:  custDetails.loan_jaedan  || sci?.loan_jaedan  || '',
    loan_jinjong: custDetails.loan_jinjong || sci?.loan_jinjong || '',
    loan_sojin:   custDetails.loan_sojin   || sci?.loan_sojin   || '',
    loan_other:   custDetails.loan_other   || sci?.loan_other   || custDetails.loan_credit || '',
    loan_total:   custDetails.loan_total   || sci?.loan_total   || '',
    // 신용 / 재무
    credit_kcb:    custDetails.credit_kcb    || sci?.credit_kcb    || custDetails.credit_score || '',
    credit_nice:   custDetails.credit_nice   || sci?.credit_nice   || '',
    tax_status:    custDetails.tax_status    || sci?.tax_status    || custDetails.tax_delinquency || '',
    assets:        custDetails.assets        || sci?.assets        || '',
    revenue_2025:  custDetails.revenue_2025  || sci?.revenue_2025  || '',
    revenue_2024:  custDetails.revenue_2024  || sci?.revenue_2024  || '',
    revenue_2023:  custDetails.revenue_2023  || sci?.revenue_2023  || '',
    required_funds:custDetails.required_funds|| sci?.required_funds|| '',
    solution:      custDetails.solution      || sci?.solution      || '',
  }

  return {
    ...c,
    progress_stage: c.stage ?? '',
    progress_memo:  c.memo  ?? '',
    customers: {
      name:    cust?.name ?? c.customer_name ?? '',
      phone:   c.phone ?? '',
      company: mergedDetails.company,
      details: mergedDetails,
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
    const isLeader = myName.includes('팀장')

    if (isLeader) {
      // 팀장은 전체 케이스 열람 (CEO와 동일) — 미배정·고아 케이스 포함
      // cases 필터 없음
    } else {
      cases = cases.filter(c => {
        const ownerId   = c.owner_id != null ? String(c.owner_id).trim() : ''
        const ownerMatch   = ownerId !== '' && ownerId === myId
        const nameMatch    = c.ops_user_name && c.ops_user_name.trim() === myName
        const detailsMatch = c.details?.ops_user_name && String(c.details.ops_user_name).trim() === myName
        // 미배정: owner_id가 null·빈값 이고 ops_user_name도 없는 케이스
        const isUnassigned = (!c.owner_id || String(c.owner_id).trim() === '') &&
                             (!c.ops_user_name || c.ops_user_name.trim() === '') &&
                             (!c.details?.ops_user_name || String(c.details.ops_user_name).trim() === '')
        return ownerMatch || nameMatch || detailsMatch || isUnassigned
      })
    }
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

  // 미배정 시 관리팀장(이름에 '팀장' 포함 ops 유저, 없으면 첫 번째 ops 유저)에게 자동 배정
  let resolvedOwnerId: string | null = owner_id ?? null
  let resolvedOpsName: string | null = ops_user_name ?? null

  if (!resolvedOwnerId && !resolvedOpsName) {
    const { data: opsUsers } = await supabaseAdmin
      .from('users')
      .select('id, name')
      .eq('role', 'ops')
      .order('name')
    if (opsUsers && opsUsers.length > 0) {
      const leader = opsUsers.find((u: any) => u.name?.includes('팀장')) || opsUsers[0]
      resolvedOwnerId = String(leader.id)
      resolvedOpsName = leader.name
    }
  }

  // ops_user_name, customer_id를 details 안에도 저장 (별도 컬럼 없어도 동작)
  const mergedDetails = {
    ...(details || {}),
    ...(resolvedOpsName ? { ops_user_name: resolvedOpsName } : {}),
    ...(customer_id     ? { customer_id }                    : {}),
  }

  const baseRow: Record<string, any> = {
    customer_name:    customer_name     ?? '',
    phone:            phone             ?? '',
    owner_id:         resolvedOwnerId,
    stage:            stage ?? progress_stage ?? '서류받는중',
    memo:             memo              ?? '',
    revenue:          revenue           ?? 0,
    institution_type: 'new',
    details:          mergedDetails,
    ...(timeline         ? { timeline }                            : {}),
    ...(customer_id      ? { customer_id }                        : {}),
    ...(resolvedOpsName  ? { ops_user_name: resolvedOpsName }     : {}),
  }

  // 컬럼 없을 때 INSERT 실패 방지: 오류 시 옵셔널 컬럼 제거 후 재시도
  let result = await supabaseAdmin.from('ops_cases').insert(baseRow as any).select().single()
  if (result.error && result.error.message?.includes('column')) {
    const fallback: Record<string, any> = { ...baseRow }
    delete fallback.details
    delete fallback.customer_id
    delete fallback.ops_user_name
    result = await supabaseAdmin.from('ops_cases').insert(fallback as any).select().single()
  }
  const { data, error } = result

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ case: normalize(data) }, { status: 201 })
}
