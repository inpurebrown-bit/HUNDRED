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

// POST: 보고 제출
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const body = await req.json()
  const { report_type, report_date, data } = body

  if (!report_type || !report_date) {
    return NextResponse.json({ error: 'report_type, report_date 필요' }, { status: 400 })
  }

  // 같은 날 같은 타입 보고 중복 방지 → upsert
  const { data: result, error } = await supabaseAdmin
    .from('reports')
    .upsert({
      user_id: user.id,
      user_name: user.name,
      report_type,
      report_date,
      data,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,report_type,report_date',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ report: result }, { status: 201 })
}
