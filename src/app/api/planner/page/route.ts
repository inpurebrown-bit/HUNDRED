import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PLANNER_HTML } from '@/lib/plannerHtml'

// 대표 전용 플래너 화면 — 개인 재무 숫자가 들어 있어 로그인한 대표에게만 제공
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ceo') {
    return new NextResponse('권한 없음', { status: 403 })
  }
  return new NextResponse(PLANNER_HTML, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
