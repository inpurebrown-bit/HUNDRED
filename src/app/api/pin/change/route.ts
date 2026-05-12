import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const MASTER_PIN = '621414'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const userId = (session.user as any).id
  const { currentPin, newPin } = await req.json()

  if (!currentPin || !newPin || !/^\d{6}$/.test(newPin)) {
    return NextResponse.json({ error: '6자리 숫자로 입력하세요' }, { status: 400 })
  }

  // 현재 PIN 확인 (마스터 PIN도 허용)
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('pin, pin_locked')
    .eq('id', userId)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: '사용자 없음' }, { status: 404 })
  }

  const currentOk =
    currentPin === MASTER_PIN ||
    currentPin === (user.pin || '000000')

  if (!currentOk) {
    return NextResponse.json({ error: '현재 PIN이 올바르지 않습니다' }, { status: 400 })
  }

  await supabaseAdmin
    .from('users')
    .update({ pin: newPin, pin_fail_count: 0, pin_locked: false })
    .eq('id', userId)

  return NextResponse.json({ ok: true })
}
