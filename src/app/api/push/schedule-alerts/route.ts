import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

function kstNow() {
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
  // s = "YYYY-MM-DD HH:MM:SS"
  return {
    dateStr:  s.slice(0, 10),
    hour:     parseInt(s.slice(11, 13), 10),
    min:      parseInt(s.slice(14, 16), 10),
    full:     s.slice(11, 16),
  }
}

function kstTomorrow(todayStr: string) {
  // todayStr = "YYYY-MM-DD" (KST)
  const d = new Date(todayStr + 'T00:00:00+09:00')
  d.setDate(d.getDate() + 1)
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10)
}

function toHHMM(t?: string | null): string {
  if (!t) return ''
  return t.slice(0, 5) // "HH:MM:SS" → "HH:MM", already "HH:MM" → no-op
}

/** cron-job.org: 매분 GET 호출 */
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  return runAlerts({ testMode: false })
}

/**
 * POST: 대표/관리자가 수동으로 알림 테스트
 * body: { secret, mode: "recall" | "meeting" | "all", overrideDate?: "YYYY-MM-DD", overrideTime?: "HH:MM" }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  return runAlerts({
    testMode: true,
    overrideDate: body.overrideDate,
    overrideTime: body.overrideTime,
    mode: body.mode || 'all',
  })
}

async function runAlerts(opts: {
  testMode: boolean
  overrideDate?: string
  overrideTime?: string
  mode?: 'recall' | 'meeting' | 'all'
}) {
  const { testMode, mode = 'all' } = opts
  const kst = kstNow()

  const todayStr   = opts.overrideDate || kst.dateStr
  const tomorrowStr = kstTomorrow(todayStr)

  // 5분 후 HH:MM
  const totalMin5 = kst.hour * 60 + kst.min + 5
  const targetRecallTime = opts.overrideTime || `${String(Math.floor(totalMin5 / 60) % 24).padStart(2,'0')}:${String(totalMin5 % 60).padStart(2,'0')}`

  // 미팅 알림: 09:00~09:59 구간 내 매분 발송 (정각 실패 방어)
  // 브라우저가 같은 tag를 받으면 기존 알림을 교체하므로 중복 없음
  const isMeetingHour = kst.hour === 9
  const doMeeting = (mode === 'meeting' || mode === 'all') && (isMeetingHour || testMode)
  const doRecall  = (mode === 'recall'  || mode === 'all')

  // ── 고객 조회 ──────────────────────────────────────────
  const { data: customers, error: custErr } = await supabaseAdmin
    .from('customers')
    .select('id, name, sales_user_name, details')

  if (custErr) {
    return NextResponse.json({ error: `고객 조회 실패: ${custErr.message}` }, { status: 500 })
  }

  // ── 구독 조회 ──────────────────────────────────────────
  const { data: allSubs, error: subErr } = await supabaseAdmin
    .from('push_subscriptions')
    .select('user_name, subscription, endpoint')

  if (subErr) {
    return NextResponse.json({ error: `구독 조회 실패: ${subErr.message}` }, { status: 500 })
  }

  const subMap: Record<string, any[]> = {}
  for (const s of (allSubs || [])) {
    if (!s.user_name) continue
    if (!subMap[s.user_name]) subMap[s.user_name] = []
    subMap[s.user_name].push(s.subscription)
  }

  const subscribedUsers = Object.keys(subMap)

  // ── 대상 수집 ──────────────────────────────────────────
  const recallAlerts: { userName: string; company: string; time: string }[] = []
  const meetingAlerts: { userName: string; company: string; time?: string }[] = []
  const debugScan: string[] = []

  for (const c of (customers || [])) {
    const d = (c.details as any) || {}
    const company   = d.company || c.name || '—'
    const salesUser: string = d.sales_user_name || (c as any).sales_user_name || ''
    if (!salesUser) continue

    if (doRecall) {
      const recallDate = d.callback_date || d.follow_up_date
      const recallTime = toHHMM(d.callback_time || d.follow_up_time)
      if (recallDate === todayStr && recallTime) {
        debugScan.push(`[재통화] ${company} | ${salesUser} | ${recallDate} ${recallTime} | target=${targetRecallTime} | match=${recallTime === targetRecallTime}`)
        if (recallTime === targetRecallTime) {
          recallAlerts.push({ userName: salesUser, company, time: recallTime })
        }
      }
    }

    if (doMeeting) {
      const meetingDate = d.meeting_date
      const meetingTime = toHHMM(d.meeting_time)
      if (meetingDate === tomorrowStr) {
        debugScan.push(`[미팅] ${company} | ${salesUser} | ${meetingDate}${meetingTime ? ' '+meetingTime : ''} | tomorrowStr=${tomorrowStr}`)
        meetingAlerts.push({ userName: salesUser, company, time: meetingTime || undefined })
      }
    }
  }

  // 브라우저에서 tag 기반 중복 교체 처리하므로 별도 중복 방지 불필요
  const filteredMeetingAlerts = meetingAlerts

  // ── 발송 ───────────────────────────────────────────────
  const errors: string[] = []
  const failedEndpoints: string[] = []
  let sent = 0

  async function sendToUser(userName: string, title: string, body: string, tag: string) {
    const subs = subMap[userName] || []
    if (subs.length === 0) {
      errors.push(`구독 없음: ${userName}`)
      return
    }
    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub, JSON.stringify({ title, body, url: '/dashboard/sales', tag }))
        sent++
      } catch (err: any) {
        errors.push(`발송 실패 (${userName}): ${err.statusCode} ${err.message}`)
        if (err.statusCode === 410 || err.statusCode === 404) {
          failedEndpoints.push(sub.endpoint)
        }
      }
    }
  }

  for (const a of recallAlerts) {
    await sendToUser(a.userName, `📞 재통화 5분 전`, `${a.company} 재통화 예정 (${a.time})`, `recall-${todayStr}-${a.time}`)
  }
  for (const a of filteredMeetingAlerts) {
    const timeStr = a.time ? ` ${a.time}` : ''
    await sendToUser(a.userName, `📅 내일 미팅 있어요`, `${a.company} 미팅 일정${timeStr}`, `meeting-${tomorrowStr}`)
  }

  if (failedEndpoints.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', failedEndpoints)
  }

  return NextResponse.json({
    ok: true,
    kst: kst.full,
    todayStr,
    tomorrowStr,
    targetRecallTime,
    doRecall,
    doMeeting,
    customers: customers?.length ?? 0,
    subscribedUsers,
    recallAlerts,
    meetingAlerts: filteredMeetingAlerts,
    sent,
    errors,
    debugScan,
  })
}
