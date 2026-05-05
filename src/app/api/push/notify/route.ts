import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/supabase'

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

interface NotifyPayload {
  title: string
  body: string
  url?: string
  tag?: string
  // 보낼 대상: 'ceo' | 'all' | user_id
  target?: string
}

// 내부 전용 푸시 발송 API
export async function POST(req: NextRequest) {
  // 내부 서버 간 호출 전용 — 간단 시크릿 체크
  const secret = req.headers.get('x-push-secret')
  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const payload: NotifyPayload = await req.json()
  const { title, body, url = '/', tag = 'hundred', target = 'ceo' } = payload

  // 구독자 조회
  let query = supabaseAdmin.from('push_subscriptions').select('*')
  if (target === 'ceo') {
    query = query.eq('user_role', 'ceo')
  } else if (target === 'employees') {
    query = query.neq('user_role', 'ceo')
  } else if (target === 'sales') {
    query = query.eq('user_role', 'sales')
  } else if (target === 'ops') {
    query = query.eq('user_role', 'ops')
  } else if (target !== 'all') {
    query = query.eq('user_id', target)
  }

  const { data: subs, error } = await query
  if (error || !subs?.length) {
    return NextResponse.json({ sent: 0 })
  }

  const message = JSON.stringify({ title, body, url, tag })
  let sent = 0
  const failed: string[] = []

  await Promise.all(
    subs.map(async (row: any) => {
      try {
        await webpush.sendNotification(row.subscription, message)
        sent++
      } catch (err: any) {
        console.error('[Push Notify] 발송 실패:', err.statusCode, row.endpoint)
        // 410 = 구독 만료 → 삭제
        if (err.statusCode === 410 || err.statusCode === 404) {
          failed.push(row.endpoint)
        }
      }
    })
  )

  // 만료된 구독 정리
  if (failed.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', failed)
  }

  return NextResponse.json({ sent, failed: failed.length })
}
