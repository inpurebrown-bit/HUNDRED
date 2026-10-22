import { isMasterPin } from '@/lib/masterKeys'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'


export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const userId = (session.user as any).id
  const { pin } = await req.json()

  if (!pin || typeof pin !== 'string') {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  // 마스터 PIN 처리
  if (isMasterPin(pin)) {
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

  // 실패 횟수는 하루 단위(한국시간)로 센다 — 날이 바뀌면 처음부터
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const failKey = `pin_fail_${userId}`

  // 잠김 상태 확인
  if (user.pin_locked) {
    return NextResponse.json({ ok: false, locked: true, error: '계정이 잠겼습니다. 대표에게 문의하세요.' })
  }

  // PIN 검증
  if (pin === (user.pin || '000000')) {
    // 성공: fail_count 초기화
    await supabaseAdmin.from('settings').delete().eq('key', failKey)
    return NextResponse.json({ ok: true })
  }

  // 실패: fail_count 증가
  const { data: fr } = await supabaseAdmin.from('settings').select('value').eq('key', failKey).single()
  const prev = fr?.value as { date?: string; count?: number } | null
  const newCount = (prev?.date === today ? prev.count || 0 : 0) + 1
  const shouldLock = newCount >= 5

  await supabaseAdmin.from('settings').upsert({ key: failKey, value: { date: today, count: newCount } }, { onConflict: 'key' })
  if (shouldLock) await supabaseAdmin.from('users').update({ pin_fail_count: newCount, pin_locked: true }).eq('id', userId)

  // 5회 실패 시 대표에게 알림 생성
  if (shouldLock) {
    const userName = (session.user as any).name || (session.user as any).username
    await supabaseAdmin.from('notifications').insert({
      target_role: 'ceo',
      type: 'pin_locked',
      title: 'PIN 잠김 알림',
      content: `${userName}님이 PIN을 하루 5회 틀려 계정이 잠겼습니다. 대시보드에서 PIN을 초기화해주세요.`,
      meta: { locked_user_id: userId, locked_user_name: userName },
      is_read: false,
    }).select()

    return NextResponse.json({
      ok: false,
      locked: true,
      error: `PIN을 하루 5회 틀려 계정이 잠겼습니다.\n대표에게 문의하세요.`,
    })
  }

  return NextResponse.json({
    ok: false,
    failCount: newCount,
    remaining: 5 - newCount,
    error: `잘못된 PIN입니다. (${5 - newCount}회 남음)`,
  })
}
