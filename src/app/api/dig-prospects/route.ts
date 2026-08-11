import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: 목록 조회
// - dig: 본인 것만
// - ceo: 전체 (status 필터 가능)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'dig' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // pending | approved | rejected | assigned | all

  let query = supabaseAdmin
    .from('dig_prospects')
    .select('*')
    .order('created_at', { ascending: false })

  if (user.role === 'dig') {
    query = query.eq('dig_user_id', user.id)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ prospects: data || [] })
}

// POST: 신규 가망 등록 (dig 팀만)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'dig') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const {
    company, ceo_name, phone, phone_010,
    business_age, annual_revenue, industry,
    has_delinquency, credit_score, required_fund,
    checklist, memo,
    recording_url, recording_filename, recording_analysis,
  } = body

  if (!phone_010) {
    return NextResponse.json({ error: '010 번호는 필수입니다' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('dig_prospects')
    .insert({
      dig_user_id: user.id,
      dig_user_name: user.name,
      company, ceo_name, phone, phone_010,
      business_age, annual_revenue, industry,
      has_delinquency: !!has_delinquency,
      credit_score, required_fund,
      checklist: checklist || {},
      memo,
      recording_url, recording_filename,
      recording_analysis: recording_analysis || null,
      status: 'pending',
      call_date: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ prospect: data })
}
