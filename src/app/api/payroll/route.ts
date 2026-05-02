import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as { role?: string }
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const year_month = req.nextUrl.searchParams.get('year_month')
  if (!year_month) return NextResponse.json({ error: 'year_month 파라미터 필요' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('payroll_records')
    .select('*')
    .eq('year_month', year_month)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ record: data ?? null })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as { role?: string }
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json()
  const { year_month, employees, memo } = body

  const { data, error } = await supabaseAdmin
    .from('payroll_records')
    .upsert(
      {
        year_month,
        employees,
        memo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'year_month' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ record: data })
}
