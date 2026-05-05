import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: 보고 목록 조회
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') // 'morning' | 'daily'
  const date = searchParams.get('date') // YYYY-MM-DD

  let query = supabaseAdmin
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })

  // 직원은 본인 보고만
  if (user.role === 'sales' || user.role === 'ops') {
    query = query.eq('user_id', user.id)
  }
  if (type) query = query.eq('report_type', type)
  if (date) query = query.eq('report_date', date)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data })
}

// POST: 보고 제출 (upsert → 없으면 INSERT, 있으면 UPDATE)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const body = await req.json()
  const { report_type, report_date, data } = body

  if (!report_type || !report_date) {
    return NextResponse.json({ error: 'report_type, report_date 필요' }, { status: 400 })
  }

  // 기존 보고 확인
  const { data: existing } = await supabaseAdmin
    .from('reports')
    .select('id')
    .eq('user_id', user.id)
    .eq('report_type', report_type)
    .eq('report_date', report_date)
    .single()

  let result, error

  if (existing?.id) {
    // 이미 있으면 UPDATE
    const res = await supabaseAdmin
      .from('reports')
      .update({ data, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    result = res.data
    error = res.error
  } else {
    // 없으면 INSERT
    const res = await supabaseAdmin
      .from('reports')
      .insert({
        user_id: user.id,
        user_name: user.name,
        report_type,
        report_date,
        data,
      })
      .select()
      .single()
    result = res.data
    error = res.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ report: result }, { status: 201 })
}
