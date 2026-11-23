import { headers } from 'next/headers'
import { getServerSession } from 'next-auth'
import { timingSafeEqual } from 'crypto'
import { authOptions } from '@/lib/auth'

// 로그인 세션이 없으면 Authorization: Bearer <AGENT_TOKEN> 을 확인해 '조회 전용 대표 권한'으로 인정한다.
// 매출·직원·손익·세무·플래너 같은 GET(읽기) 주소에만 쓴다. 쓰기(POST/PATCH/DELETE)에는 절대 쓰지 않는다.
export async function getSessionOrAgent(): Promise<any> {
  const session = await getServerSession(authOptions)
  if (session) return session
  const want = process.env.AGENT_TOKEN
  if (!want) return null
  const got = ((await headers()).get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const a = Buffer.from(got), b = Buffer.from(want)
  if (a.length === b.length && timingSafeEqual(a, b)) return { user: { id: 'agent', name: '빨강(조회)', role: 'ceo' } }
  return null
}
