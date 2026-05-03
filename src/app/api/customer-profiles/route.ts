import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: ?customer_id= - 단일 고객 프로필 조회
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customer_id = searchParams.get('customer_id')

  if (!customer_id) return NextResponse.json({ error: 'customer_id는 필수입니다' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('customer_profiles')
    .select('*')
    .eq('customer_id', customer_id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ profile: null })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ profile: data })
}

// POST: 고객 프로필 신규 등록
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await req.json()
  const {
    customer_id,
    db_type,
    ceo_name,
    email,
    is_youth,
    business_start_date,
    industry_detail,
    actual_business,
    has_patent,
    patent_detail,
    innov_sales_growth,
    innov_own_mall,
    innov_crm,
    innov_cutting,
    innov_kiosk,
    innov_waiting,
    innov_qr,
    innov_export,
    employee_count,
    revenue_2026,
    revenue_2025,
    revenue_2024,
    revenue_2023,
    home_type,
    home_value,
    car_count,
    office_type,
    office_value,
    loan_kibo,
    loan_shinbo,
    loan_foundation,
    loan_jungzin,
    loan_sojingong,
    loan_credit,
    loan_collateral,
    credit_kcb,
    credit_nice,
    tax_delinquent,
    tax_delinquent_detail,
    required_funds,
    as_request_type,
    decision_result,
    closing_result,
    next_call_date,
    review_status,
    progress_status,
    call_notes,
  } = body

  if (!customer_id) return NextResponse.json({ error: 'customer_id는 필수입니다' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('customer_profiles')
    .insert({
      customer_id,
      db_type: db_type || 'direct',
      ceo_name: ceo_name || '',
      email: email || '',
      is_youth: is_youth ?? false,
      business_start_date: business_start_date || null,
      industry_detail: industry_detail || '',
      actual_business: actual_business || '',
      has_patent: has_patent ?? false,
      patent_detail: patent_detail || '',
      innov_sales_growth: innov_sales_growth ?? false,
      innov_own_mall: innov_own_mall ?? false,
      innov_crm: innov_crm ?? false,
      innov_cutting: innov_cutting ?? false,
      innov_kiosk: innov_kiosk ?? false,
      innov_waiting: innov_waiting ?? false,
      innov_qr: innov_qr ?? false,
      innov_export: innov_export ?? false,
      employee_count: employee_count || null,
      revenue_2026: revenue_2026 || null,
      revenue_2025: revenue_2025 || null,
      revenue_2024: revenue_2024 || null,
      revenue_2023: revenue_2023 || null,
      home_type: home_type || '',
      home_value: home_value || null,
      car_count: car_count || null,
      office_type: office_type || '',
      office_value: office_value || null,
      loan_kibo: loan_kibo || '',
      loan_shinbo: loan_shinbo || '',
      loan_foundation: loan_foundation || '',
      loan_jungzin: loan_jungzin || '',
      loan_sojingong: loan_sojingong || '',
      loan_credit: loan_credit || '',
      loan_collateral: loan_collateral || null,
      credit_kcb: credit_kcb || null,
      credit_nice: credit_nice || null,
      tax_delinquent: tax_delinquent ?? false,
      tax_delinquent_detail: tax_delinquent_detail || '',
      required_funds: required_funds || null,
      as_request_type: as_request_type || '',
      decision_result: decision_result || '',
      closing_result: closing_result || '',
      next_call_date: next_call_date || null,
      review_status: review_status || 'pending',
      progress_status: progress_status || '',
      call_notes: call_notes || '',
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data }, { status: 201 })
}
