import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensurePlayableWav, logConvertError } from '@/lib/recordingConvert'

export const maxDuration = 60

// POST { path }: 올라간 wav 가 브라우저에서 재생 안 되는 형식(GSM 등)이면 일반 wav 로 바꿔 새 URL 을 돌려준다
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'dig' && user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { path } = await req.json()
  if (typeof path !== 'string' || !path.startsWith('recordings/') || path.includes('..')) {
    return NextResponse.json({ error: 'path 가 올바르지 않습니다' }, { status: 400 })
  }
  try {
    return NextResponse.json(await ensurePlayableWav(path))
  } catch (e: any) {
    await logConvertError('convert-recording', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
