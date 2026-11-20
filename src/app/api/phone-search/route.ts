import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { findPhoneMatches } from '@/lib/phoneDup'

// 번호 중복 검색 — 영업 고객(customers)과 발굴팀 가망(dig_prospects) 모두에서 찾는다 (번호 모양이 달라도 찾도록 phoneDup 사용)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const phone = req.nextUrl.searchParams.get('phone')?.replace(/[^0-9]/g, '') || ''
  if (phone.length < 9) return NextResponse.json({ results: [] })

  return NextResponse.json({ results: await findPhoneMatches(phone) })
}
