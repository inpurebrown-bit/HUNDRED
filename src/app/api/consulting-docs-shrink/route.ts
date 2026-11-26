import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { shrinkStored } from '@/lib/pdfShrink'

export const maxDuration = 60

// 고객서류 탭에서 PDF 를 올린 직후 부르면, 3MB 넘는 스캔본을 서버가 알아서 줄여 같은 자리에 바꿔 둔다(원본은 orig/ 에 보관).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (!['ops', 'ceo'].includes(user.role)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { path } = await req.json().catch(() => ({}))
  if (!path || !String(path).startsWith('cases/')) return NextResponse.json({ error: 'path 가 올바르지 않습니다' }, { status: 400 })
  return NextResponse.json(await shrinkStored(String(path)))
}
