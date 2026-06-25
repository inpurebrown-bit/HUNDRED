import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

/**
 * 일정 알림 cron — cron-job.org에서 매분 GET 호출
 * - 재통화: callback_date/follow_up_date = 오늘 AND 시간 = 지금+5분 → 본인에게 푸시
 * - 미팅:   meeting_date = 내일 AND 현재 시각 09:00 → 본인에게 푸시
 *
 * 인증: x-cron-secret 헤더에 NEXTAUTH_SECRET 값 포함
 */
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  // ── KST 현재 시각 ──────────────────────────────────────
  const kstStr = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
  // kstStr: "YYYY-MM-DD HH:MM:SS"
  const todayStr    = kstStr.slice(0, 10)
  const nowHour     = parseInt(kstStr.slice(11, 13), 10)
  const nowMin      = parseInt(kstStr.slice(14, 16), 10)

  // 5분 후 시각 (재통화 알림 타겟)
  const totalMin5   = nowHour * 60 + nowMin + 5
  const recallH     = Math.floor(totalMin5 / 60) % 24
  const recallM     = totalMin5 % 60
  const targetRecallTime = `${String(recallH).padStart(2, '0')}:${String(recallM).padStart(2, '0')}`

  // 내일 날짜 (미팅 알림 타겟)
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = tomorrowDate.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10)

  // 미팅 알림은 09:00 에만 발송
  const isMeetingAlertTime = nowHour === 9 && nowMin === 0

  // ── 고객 데이터 조회 ────────────────────────────────────
  const { data: customers, error: custErr } = await supabaseAdmin
    .from('customers')
    .select('id, name, sales_user_name, details')

  if (custErr) {
    return NextResponse.json({ error: custErr.message }, { status: 500 })
  }

  // ── 구독 조회 ───────────────────────────────────────────
  const { data: allSubs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('user_name, subscription')

  if (!allSubs?.length) {
    return NextResponse.json({ sent: 0, message: '구독자 없음' })
  }

  // user_name → subscriptions 맵
  const subMap: Record<string, any[]> = {}
  for (const s of allSubs) {
    if (!s.user_name) continue
    if (!subMap[s.user_name]) subMap[s.user_name] = []
    subMap[s.user_name].push(s.subscription)
  }

  // ── 알림 대상 수집 ──────────────────────────────────────
  const recallAlerts: { userName: string; company: string; time: string }[] = []
  const meetingAlerts: { userName: string; company: string; time?: string }[] = []

  for (const c of (customers || [])) {
    const d = (c.details as any) || {}
    const company = d.company || c.name || '—'
    const salesUser: string = d.sales_user_name || (c as any).sales_user_name || ''
    if (!salesUser) continue

    // 재통화 (5분 전)
    const recallDate = d.callback_date || d.follow_up_date
    const recallTime = d.callback_time || d.follow_up_time
    if (recallDate === todayStr && recallTime === targetRecallTime) {
      recallAlerts.push({ userName: salesUser, company, time: recallTime })
    }

    // 미팅 (하루 전 09:00)
    if (isMeetingAlertTime && d.meeting_date === tomorrowStr) {
      meetingAlerts.push({ userName: salesUser, company, time: d.meeting_time })
    }
  }

  // ── 푸시 발송 헬퍼 ─────────────────────────────────────
  const failedEndpoints: string[] = []
  let sent = 0

  async function sendToUser(userName: string, title: string, body: string, tag: string) {
    const subs = subMap[userName] || []
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, JSON.stringify({
          title, body, url: '/dashboard/sales', tag,
        }))
        sent++
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          failedEndpoints.push(sub.endpoint)
        }
      }
    }
  }

  // 재통화 알림
  for (const a of recallAlerts) {
    await sendToUser(
      a.userName,
      `📞 재통화 5분 전`,
      `${a.company} 재통화 예정 (${a.time})`,
      `recall-${todayStr}-${a.time}-${a.company}`,
    )
  }

  // 미팅 알림
  for (const a of meetingAlerts) {
    const timeStr = a.time ? ` ${a.time}` : ''
    await sendToUser(
      a.userName,
      `📅 내일 미팅 일정`,
      `${a.company} 미팅${timeStr}`,
      `meeting-${tomorrowStr}-${a.company}`,
    )
  }

  // 만료된 구독 정리
  if (failedEndpoints.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .in('endpoint', failedEndpoints)
  }

  return NextResponse.json({
    ok: true,
    time: `${kstStr.slice(11, 16)} KST`,
    recallAlerts: recallAlerts.length,
    meetingAlerts: meetingAlerts.length,
    sent,
  })
}
