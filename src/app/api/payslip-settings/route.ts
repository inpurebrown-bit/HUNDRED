import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('payslip_settings')
    .select('*')
    .eq('id', 'default')
    .single()
  return NextResponse.json({ settings: data || null })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('payslip_settings')
    .upsert({ id: 'default', ...body, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
}
