import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

/**
 * 일정 아침 알림 — cron-job.org에서 매일 오전 9시 GET 호출
 * 인증: x-cron-secret 헤더에 NEXTAUTH_SECRET 값 포함
 *
 * 오늘 일정이 있으면 모든 구독자에게 푸시 알림 발송
 */
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  // 오늘 날짜 (KST 기준)
  const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10)

  // 오늘 해당하는 이벤트 조회 (start_date <= today <= end_date)
  const { data: events, error: evErr } = await supabaseAdmin
    .from('events')
    .select('id, title, start_date, end_date, start_time, is_allday')
    .lte('start_date', todayStr)
    .gte('end_date', todayStr)
    .order('start_time', { ascending: true, nullsFirst: true })

  if (evErr) {
    return NextResponse.json({ error: evErr.message }, { status: 500 })
  }

  if (!events || events.length === 0) {
    return NextResponse.json({ sent: 0, message: '오늘 일정 없음' })
  }

  // 알림 내용 구성
  const eventLines = events.slice(0, 5).map((e: any) => {
    const time = e.is_allday ? '종일' : (e.start_time ? e.start_time.slice(0, 5) : '')
    return time ? `${time} ${e.title}` : e.title
  })
  const title = `📅 오늘 일정 ${events.length}건`
  const body = eventLines.join(' · ')
  const url = '/dashboard'

  // 모든 구독자에게 발송
  const { data: subs, error: subErr } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')

  if (subErr || !subs?.length) {
    return NextResponse.json({ sent: 0, message: '구독자 없음' })
  }

  const message = JSON.stringify({ title, body, url, tag: 'calendar-daily' })
  let sent = 0
  const failedEndpoints: string[] = []

  await Promise.all(
    subs.map(async (row: any) => {
      try {
        await webpush.sendNotification(row.subscription, message)
        sent++
      } catch (err: any) {
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

  return NextResponse.json({
    sent,
    failed: failedEndpoints.length,
    events: events.length,
    today: todayStr,
  })
}
