import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const MASTER_PIN = '621414'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const userId = (session.user as any).id
  const { pin } = await req.json()

  if (!pin || typeof pin !== 'string') {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  // 마스터 PIN 처리
  if (pin === MASTER_PIN) {
    return NextResponse.json({ ok: true, master: true })
  }

  // 사용자 PIN 조회
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('pin, pin_fail_count, pin_locked')
    .eq('id', userId)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: '사용자 없음' }, { status: 404 })
  }

  // 잠김 상태 확인
  if (user.pin_locked) {
    return NextResponse.json({ ok: false, locked: true, error: '계정이 잠겼습니다. 대표에게 문의하세요.' })
  }

  // PIN 검증
  if (pin === (user.pin || '000000')) {
    // 성공: fail_count 초기화
    await supabaseAdmin
      .from('users')
      .update({ pin_fail_count: 0 })
      .eq('id', userId)
    return NextResponse.json({ ok: true })
  }

  // 실패: fail_count 증가
  const newCount = (user.pin_fail_count || 0) + 1
  const shouldLock = newCount >= 5

  await supabaseAdmin
    .from('users')
    .update({
      pin_fail_count: newCount,
      pin_locked: shouldLock,
    })
    .eq('id', userId)

  // 5회 실패 시 대표에게 알림 생성
  if (shouldLock) {
    const userName = (session.user as any).name || (session.user as any).username
    await supabaseAdmin.from('notifications').insert({
      target_role: 'ceo',
      type: 'pin_locked',
      title: 'PIN 잠김 알림',
      content: `${userName}님이 PIN을 5회 연속 틀려 계정이 잠겼습니다. 대시보드에서 PIN을 초기화해주세요.`,
      meta: { locked_user_id: userId, locked_user_name: userName },
      is_read: false,
    }).select()

    return NextResponse.json({
      ok: false,
      locked: true,
      error: `PIN 5회 오류로 계정이 잠겼습니다.\n대표에게 문의하세요.`,
    })
  }

  return NextResponse.json({
    ok: false,
    failCount: newCount,
    remaining: 5 - newCount,
    error: `잘못된 PIN입니다. (${5 - newCount}회 남음)`,
  })
}
