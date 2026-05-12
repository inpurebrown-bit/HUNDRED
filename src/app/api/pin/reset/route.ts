import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// 대표 전용: 특정 직원 PIN 초기화 (000000으로 리셋 + 잠김 해제)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { targetUserId, newPin } = await req.json()

  if (!targetUserId) {
    return NextResponse.json({ error: '대상 사용자 필요' }, { status: 400 })
  }

  const pin = newPin && /^\d{6}$/.test(newPin) ? newPin : '000000'

  const { error } = await supabaseAdmin
    .from('users')
    .update({ pin, pin_fail_count: 0, pin_locked: false })
    .eq('id', targetUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, resetTo: pin })
}
