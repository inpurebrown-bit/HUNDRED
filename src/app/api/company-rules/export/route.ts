import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readSetting } from '@/lib/docs/store'
import { docToHwpx, docToPdf, type DocContent } from '@/lib/docs/hwpxDoc'

export const runtime = 'nodejs'
export const maxDuration = 60

// 정관·규정을 한글(.hwpx) 또는 PDF 로 내려받기 — 대표 전용
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  if ((session.user as any).role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const rules = await readSetting<DocContent & { version: number }>('company_rules')
  if (!rules) return NextResponse.json({ error: '저장된 정관이 없습니다' }, { status: 404 })
  const format = req.nextUrl.searchParams.get('format') === 'hwpx' ? 'hwpx' : 'pdf'
  const date = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  const cover = { org: '헌드레드컨설팅', version: `v${rules.version}`, date: date.replace(/-/g, '. ') + '.' }
  const buf = format === 'hwpx' ? await docToHwpx(rules, cover) : await docToPdf(rules, cover)
  const fname = `헌드레드컨설팅_정관·규정_v${rules.version}_${date}.${format}`
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
      'Cache-Control': 'no-store',
    },
  })
}
