import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { sendPushNotification } from '@/lib/pushNotify'

/**
 * 오늘의 명언 푸시 알림 엔드포인트 (cron-job.org에서 호출)
 *
 * 인증: 요청 헤더에 x-cron-secret: <NEXTAUTH_SECRET 값> 포함 필수.
 *
 * GET /api/push/daily-quote
 * → Gemini API로 명언 생성 후 전 직원에게 푸시 발송
 */
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')
  if (cronSecret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다' }, { status: 500 })
  }

  // Gemini로 명언 생성
  let quote: string
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(
      '세계적으로 유명한 위인이 남긴 명언 1개를 알려줘. 영업, 성공, 인생 발전에 도움이 되는 내용으로. 형식: \'명언 내용\' - 인물이름 (한국어로). 명언과 출처만 출력해줘.'
    )
    quote = result.response.text().trim()
  } catch (err: any) {
    console.error('[daily-quote] Gemini 오류:', err)
    return NextResponse.json({ error: 'Gemini 명언 생성 실패: ' + err.message }, { status: 500 })
  }

  // 전 직원에게 푸시 발송
  try {
    await sendPushNotification({
      title: '🌟 오늘의 명언',
      body: quote,
      url: '/dashboard',
      tag: 'daily-quote',
      target: 'all',
    })
  } catch (err: any) {
    console.error('[daily-quote] 푸시 발송 오류:', err)
    return NextResponse.json({ error: '푸시 발송 실패: ' + err.message }, { status: 500 })
  }

  return NextResponse.json({ sent: true, quote })
}
