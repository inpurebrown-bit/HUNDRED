import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as { role?: string }
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const date = req.nextUrl.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date 파라미터 필요' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('payrate_records')
    .select('*')
    .eq('record_date', date)
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
  const { date, employee_count, target_count, payment_count, working_days_elapsed, total_working_days, employee_details } = body

  const { data, error } = await supabaseAdmin
    .from('payrate_records')
    .upsert(
      {
        record_date: date,
        year_month: (date as string).slice(0, 7),
        employee_count,
        target_count,
        payment_count,
        working_days_elapsed,
        total_working_days,
        employee_details,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'record_date' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ record: data })
}
