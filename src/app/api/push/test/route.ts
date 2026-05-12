import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

// 개발용 테스트 푸시 엔드포인트
// POST /api/push/test — 로그인된 본인에게 테스트 알림 1개 발송
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  }

  const user = session.user as any

  // 본인 user_id 기준으로 구독 조회
  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', user.id)

  if (error) {
    console.error('[Push Test] DB 조회 오류:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!subs?.length) {
    return NextResponse.json(
      { error: '등록된 구독이 없습니다. 먼저 푸시 알림을 허용해주세요.' },
      { status: 404 }
    )
  }

  const message = JSON.stringify({
    title: '🧪 테스트 알림',
    body: `${user.name ?? user.email}님, 푸시 알림이 정상 작동합니다!`,
    url: '/dashboard',
    tag: 'push-test',
  })

  let sent = 0
  const failedEndpoints: string[] = []

  await Promise.all(
    subs.map(async (row: any) => {
      try {
        await webpush.sendNotification(row.subscription, message)
        sent++
      } catch (err: any) {
        console.error('[Push Test] 발송 실패:', err.statusCode, row.endpoint)
        if (err.statusCode === 410 || err.statusCode === 404) {
          failedEndpoints.push(row.endpoint)
        }
      }
    })
  )

  // 만료된 구독 정리
  if (failedEndpoints.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .in('endpoint', failedEndpoints)
  }

  return NextResponse.json({ sent, failed: failedEndpoints.length })
}
