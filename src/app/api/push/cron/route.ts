import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

type CronType = 'morning' | 'evening' | 'followup'

interface ScenarioConfig {
  title: string
  body: string
  target: string
  url: string
}

const SCENARIOS: Record<CronType, ScenarioConfig> = {
  morning: {
    title: '☀️ 오늘의 업무 시작',
    body: '오늘 재통화 예정 업체를 확인하세요. 좋은 하루 되세요!',
    target: 'all',
    url: '/dashboard',
  },
  evening: {
    title: '📋 오늘 마감보고 확인',
    body: '영업팀·자금팀의 오늘 보고를 확인해주세요.',
    target: 'ceo',
    url: '/dashboard',
  },
  followup: {
    title: '🔔 재통화 예정 업체 확인',
    body: '오늘 재통화 일정이 있는 업체를 확인하세요.',
    target: 'sales',
    url: '/dashboard',
  },
}

// cron-job.org에서 GET으로 호출하는 스케줄 푸시 엔드포인트
export async function GET(req: NextRequest) {
  // 인증: x-cron-secret 헤더 검증
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  // 타입 파라미터 검증
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as CronType | null

  if (!type || !(type in SCENARIOS)) {
    return NextResponse.json(
      { error: 'type 파라미터 필요 (morning | evening | followup)' },
      { status: 400 }
    )
  }

  const scenario = SCENARIOS[type]
  const { title, body, target, url } = scenario

  // 구독자 조회 (target에 따라 필터링)
  let query = supabaseAdmin.from('push_subscriptions').select('*')
  if (target === 'ceo') {
    query = query.eq('user_role', 'ceo')
  } else if (target === 'sales') {
    query = query.eq('user_role', 'sales')
  } else if (target === 'ops') {
    query = query.eq('user_role', 'ops')
  } else if (target === 'employees') {
    query = query.neq('user_role', 'ceo')
  }
  // target === 'all' → 필터 없이 전체 조회

  const { data: subs, error } = await query
  if (error) {
    console.error('[Push Cron] DB 조회 오류:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!subs?.length) {
    return NextResponse.json({ type, sent: 0, failed: 0 })
  }

  const message = JSON.stringify({ title, body, url, tag: `cron-${type}` })
  let sent = 0
  const failedEndpoints: string[] = []

  await Promise.all(
    subs.map(async (row: any) => {
      try {
        await webpush.sendNotification(row.subscription, message)
        sent++
      } catch (err: any) {
        console.error('[Push Cron] 발송 실패:', err.statusCode, row.endpoint)
        // 410 / 404 = 구독 만료 → 나중에 삭제
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

  return NextResponse.json({ type, sent, failed: failedEndpoints.length })
}
