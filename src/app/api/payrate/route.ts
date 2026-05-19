import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as { role?: string; name?: string }
  if (user.role !== 'ceo' && user.role !== 'sales') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const date = req.nextUrl.searchParams.get('date')
  const list = req.nextUrl.searchParams.get('list')

  // list=true → 월별 아카이브 (각 월의 마지막 레코드)
  if (list === 'true') {
    const { data } = await supabaseAdmin
      .from('payrate_records')
      .select('*')
      .order('record_date', { ascending: false })
      .limit(60)
    // 월별 그룹핑 (month당 최신 레코드 1개)
    const byMonth: Record<string, any> = {}
    for (const row of (data || [])) {
      const ym = (row.year_month || (row.record_date as string).slice(0, 7)) as string
      if (!byMonth[ym]) byMonth[ym] = row
    }
    const records = Object.values(byMonth).sort((a: any, b: any) =>
      b.record_date.localeCompare(a.record_date)
    )
    return NextResponse.json({ records })
  }

  // date 없으면 최신 레코드 반환 (오늘 or 가장 최근 저장 레코드)
  if (!date) {
    const today = new Date().toISOString().slice(0, 10)
    const { data: todayData } = await supabaseAdmin
      .from('payrate_records')
      .select('*')
      .eq('record_date', today)
      .single()
    if (todayData) return NextResponse.json({ record: todayData })

    // 오늘 없으면 가장 최근 레코드
    const { data: latestData } = await supabaseAdmin
      .from('payrate_records')
      .select('*')
      .order('record_date', { ascending: false })
      .limit(1)
      .single()
    return NextResponse.json({ record: latestData ?? null })
  }

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
