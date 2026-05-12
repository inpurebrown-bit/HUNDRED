import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

/**
 * cron-job.org에서 GET으로 호출하는 푸시 발송 엔드포인트.
 *
 * 인증: 요청 헤더에 x-cron-secret: <NEXTAUTH_SECRET 값> 포함 필수.
 *
 * 쿼리 파라미터 (cron-job.org URL에 직접 입력):
 *   title   - 알림 제목 (필수)
 *   body    - 알림 내용 (필수)
 *   target  - 대상: all | ceo | sales | ops | employees (기본값: all)
 *   url     - 클릭 시 이동 URL (기본값: /dashboard)
 *   tag     - 알림 태그 중복 방지용 (선택)
 *
 * 예시:
 *   GET /api/push/cron?title=알림제목&body=알림내용&target=ceo
 */
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const title  = searchParams.get('title')
  const body   = searchParams.get('body')
  const target = searchParams.get('target') || 'all'
  const url    = searchParams.get('url') || '/dashboard'
  const tag    = searchParams.get('tag') || 'cron'

  if (!title || !body) {
    return NextResponse.json(
      { error: 'title과 body 파라미터가 필요합니다' },
      { status: 400 }
    )
  }

  let query = supabaseAdmin.from('push_subscriptions').select('*')
  if (target === 'ceo')            query = query.eq('user_role', 'ceo')
  else if (target === 'sales')     query = query.eq('user_role', 'sales')
  else if (target === 'ops')       query = query.eq('user_role', 'ops')
  else if (target === 'employees') query = query.neq('user_role', 'ceo')

  const { data: subs, error } = await query
  if (error) {
    console.error('[Push Cron] DB 오류:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!subs?.length) {
    return NextResponse.json({ sent: 0, failed: 0, target })
  }

  const message = JSON.stringify({ title, body, url, tag })
  let sent = 0
  const failedEndpoints: string[] = []

  await Promise.all(
    subs.map(async (row: any) => {
      try {
        await webpush.sendNotification(row.subscription, message)
        sent++
      } catch (err: any) {
        console.error('[Push Cron] 발송 실패:', err.statusCode)
        if (err.statusCode === 410 || err.statusCode === 404) {
          failedEndpoints.push(row.endpoint)
        }
      }
    })
  )

  if (failedEndpoints.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .in('endpoint', failedEndpoints)
  }

  return NextResponse.json({ sent, failed: failedEndpoints.length, target })
}
