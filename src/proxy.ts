import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// 홈페이지를 자동으로 긁어가는 도구들. 검색엔진(구글·네이버·다음)과 카카오톡 미리보기는 막지 않는다
const SCRAPERS = /curl|wget|python-requests|python-urllib|aiohttp|httpx|scrapy|httrack|webcopier|webzip|offline explorer|teleport|go-http-client|java\/|libwww-perl|okhttp|node-fetch|axios|undici|headlesschrome|phantomjs|selenium|playwright|puppeteer|gptbot|ccbot|claudebot|bytespider|petalbot|ahrefsbot|semrushbot|mj12bot|dotbot/i

function guardPublic(request: NextRequest) {
  const ua = request.headers.get('user-agent') || ''
  if (!ua || SCRAPERS.test(ua)) return new NextResponse('Forbidden', { status: 403 })
  const { pathname } = request.nextUrl
  if (pathname !== '/') {
    const ref = request.headers.get('referer')
    let host = ''
    try { host = ref ? new URL(ref).host : '' } catch { /* 이상한 값은 없는 것으로 */ }
    if (host && host !== request.nextUrl.host) return new NextResponse('Forbidden', { status: 403 })
  }
  return NextResponse.next()
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/dashboard')) return guardPublic(request)

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // 로그인 안 된 상태에서 /dashboard 접근 → 로그인 페이지
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = token.role as string

  // 대표만 /dashboard/ceo 접근 가능
  if (pathname.startsWith('/dashboard/ceo') && role !== 'ceo') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 영업팀 + 대표만 /dashboard/sales 접근 가능
  if (
    pathname.startsWith('/dashboard/sales') &&
    role !== 'sales' &&
    role !== 'ceo'
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 관리팀 + 대표만 /dashboard/ops 접근 가능
  if (
    pathname.startsWith('/dashboard/ops') &&
    role !== 'ops' &&
    role !== 'ceo'
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/', '/images/portfolio/:path*', '/images/consulting/:path*', '/images/ceo-main.png', '/images/ceo-stand.png', '/images/lecture.png', '/videos/:path*'],
}
