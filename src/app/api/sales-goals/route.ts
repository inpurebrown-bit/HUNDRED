import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: CEO only - 특정 월 전체 영업사원 목표 조회
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const year_month = searchParams.get('year_month')

  const baseQuery = supabaseAdmin
    .from('sales_goals')
    .select('*')
    .order('user_name', { ascending: true })

  const { data, error } = await (year_month
    ? baseQuery.eq('year_month', year_month)
    : baseQuery)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sales_goals: data })
}

// POST: CEO only - 목표 upsert (user_id + year_month 기준)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const { user_id, user_name, year_month, goal_count } = body

  if (!user_id || !year_month) {
    return NextResponse.json({ error: 'user_id와 year_month는 필수입니다' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('sales_goals')
    .upsert(
      {
        user_id,
        user_name: user_name || '',
        year_month,
        goal_count: goal_count ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,year_month' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sales_goal: data }, { status: 201 })
}
