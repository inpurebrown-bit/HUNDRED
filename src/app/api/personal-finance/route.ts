import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const KEY = '__personal_finance__'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('payroll_records')
    .select('*')
    .eq('year_month', KEY)
    .maybeSingle()

  return NextResponse.json({ record: data })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('payroll_records')
    .upsert(
      { year_month: KEY, employees: body.data, memo: '' },
      { onConflict: 'year_month' }
    )
    .select()
    .single()

  return NextResponse.json({ record: data, error })
}
