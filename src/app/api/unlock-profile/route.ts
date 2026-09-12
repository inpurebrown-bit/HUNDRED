import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// CEO 전용: 특정 직원의 info_locked를 false로 해제
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = (session?.user as any)
  if (!session || user?.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { target_user_id } = await req.json()
  if (!target_user_id) return NextResponse.json({ error: 'target_user_id 필요' }, { status: 400 })

  const { data: psRow } = await supabaseAdmin
    .from('payslip_settings')
    .select('*')
    .eq('id', 'default')
    .single()

  const employees: any[] = psRow?.employees || []
  const idx = employees.findIndex((e: any) => e.user_id === target_user_id)
  if (idx === -1) return NextResponse.json({ error: '직원 정보 없음' }, { status: 404 })

  const updated = employees.map((e: any, i: number) =>
    i === idx ? { ...e, info_locked: false } : e
  )

  await supabaseAdmin
    .from('payslip_settings')
    .upsert({ ...psRow, employees: updated, updated_at: new Date().toISOString() }, { onConflict: 'id' })

  return NextResponse.json({ ok: true })
}
