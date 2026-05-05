/**
 * 서버 사이드에서 푸시 알림 보내는 헬퍼
 * API 라우트 내부에서만 호출
 */
export async function sendPushNotification({
  title,
  body,
  url = '/',
  tag = 'hundred',
  target = 'ceo',
}: {
  title: string
  body: string
  url?: string
  tag?: string
  target?: string
}) {
  try {
    // 같은 서버 내 API 호출 (절대 URL 필요)
    const baseUrl =
      process.env.NEXTAUTH_URL_PRODUCTION ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000'

    const res = await fetch(`${baseUrl}/api/push/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-push-secret': process.env.NEXTAUTH_SECRET || '',
      },
      body: JSON.stringify({ title, body, url, tag, target }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[pushNotify] 실패:', err)
    }
  } catch (err) {
    console.error('[pushNotify] 네트워크 오류:', err)
  }
}
