import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

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
  matcher: ['/dashboard/:path*'],
}
