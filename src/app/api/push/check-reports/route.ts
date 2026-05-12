import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/pushNotify'

/**
 * 보고 미이행 독촉 체크 엔드포인트 (cron-job.org에서 호출)
 *
 * 인증: 요청 헤더에 x-cron-secret: <NEXTAUTH_SECRET 값> 포함 필수.
 *
 * GET /api/push/check-reports?type=morning|daily
 */
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  if (type !== 'morning' && type !== 'daily') {
    return NextResponse.json({ error: 'type은 morning 또는 daily 이어야 합니다' }, { status: 400 })
  }

  // 오늘 날짜 (KST 기준 YYYY-MM-DD)
  const today = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstDate = new Date(today.getTime() + kstOffset)
  const todayStr = kstDate.toISOString().slice(0, 10)

  // 오늘 해당 type 보고 제출한 user_id 목록 조회
  const { data: submittedReports, error: reportsError } = await supabaseAdmin
    .from('reports')
    .select('user_id')
    .eq('report_type', type)
    .eq('report_date', todayStr)

  if (reportsError) {
    console.error('[check-reports] 보고 조회 오류:', reportsError)
    return NextResponse.json({ error: reportsError.message }, { status: 500 })
  }

  const submittedUserIds = new Set((submittedReports || []).map((r: any) => r.user_id))

  // sales, ops 역할 구독자 전체 조회
  const { data: subs, error: subsError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('user_id, user_role')
    .in('user_role', ['sales', 'ops'])

  if (subsError) {
    console.error('[check-reports] 구독자 조회 오류:', subsError)
    return NextResponse.json({ error: subsError.message }, { status: 500 })
  }

  if (!subs?.length) {
    return NextResponse.json({ sent: 0, skipped: 0 })
  }

  // 중복 user_id 제거 (같은 사람이 여러 기기 구독 시 한 번만 처리)
  const uniqueUsers = Array.from(
    new Map(subs.map((s: any) => [s.user_id, s])).values()
  ) as Array<{ user_id: string; user_role: string }>

  const notSubmitted = uniqueUsers.filter((u) => !submittedUserIds.has(u.user_id))

  if (notSubmitted.length === 0) {
    return NextResponse.json({ sent: 0, skipped: uniqueUsers.length })
  }

  const message =
    type === 'morning'
      ? {
          title: '⏰ 오전보고 미제출',
          body: '오전보고를 아직 제출하지 않으셨습니다. 지금 바로 제출해주세요!',
        }
      : {
          title: '⏰ 마감보고 미제출',
          body: '마감보고를 아직 제출하지 않으셨습니다. 지금 바로 제출해주세요!',
        }

  let sent = 0
  await Promise.all(
    notSubmitted.map(async (u) => {
      try {
        await sendPushNotification({
          title: message.title,
          body: message.body,
          url: '/dashboard',
          tag: `check-${type}`,
          target: u.user_id,
        })
        sent++
      } catch {
        // 개별 알림 실패는 무시
      }
    })
  )

  return NextResponse.json({ sent, skipped: uniqueUsers.length - notSubmitted.length, type, date: todayStr })
}
