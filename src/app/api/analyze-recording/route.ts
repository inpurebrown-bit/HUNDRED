import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { analyzeAudio } from '@/lib/recordingAnalysis'

// 긴 녹취는 분석에 시간이 걸리고 재시도도 있으므로 기본 제한시간으로는 끊길 수 있다
export const maxDuration = 120


// POST: 녹취 파일 → Gemini 분석
// 두 가지 입력 방식 지원:
//   1. JSON { fileUrl, filename } — 파일 선택 시 Supabase에 먼저 올린 뒤 URL로 요청 (Vercel 크기 제한 우회)
//   2. FormData file — 소형 파일 레거시 경로
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'dig' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    let bytes: ArrayBuffer
    let mimeType: string
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      // URL 방식: 클라이언트가 Supabase에 직접 올린 뒤 URL 전달
      const { fileUrl, filename } = await req.json()
      if (!fileUrl) return NextResponse.json({ error: 'fileUrl 필요' }, { status: 400 })
      const fetchRes = await fetch(fileUrl)
      if (!fetchRes.ok) return NextResponse.json({ error: '파일 다운로드 실패' }, { status: 500 })
      bytes = await fetchRes.arrayBuffer()
      const ext = ((filename || fileUrl).split('.').pop() || 'mp3').toLowerCase()
      const mimeMap: Record<string, string> = { m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', mp4: 'audio/mp4' }
      mimeType = mimeMap[ext] || 'audio/mpeg'
    } else {
      // FormData 방식 (레거시)
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      if (!file) return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 })
      if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: '파일이 너무 큽니다 (최대 50MB)' }, { status: 400 })
      const ext = (file.name.split('.').pop() || 'mp3').toLowerCase()
      const mimeMap: Record<string, string> = { m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', mp4: 'audio/mp4' }
      mimeType = (file.type && file.type !== 'audio/x-m4a') ? file.type : (mimeMap[ext] || 'audio/mpeg')
      bytes = await file.arrayBuffer()
    }

    const base64 = Buffer.from(bytes).toString('base64')
    // 재시도·형식 보정은 analyzeAudio 가 처리
    const analysis = await analyzeAudio(base64, mimeType)

    return NextResponse.json({ analysis })
  } catch (error: any) {
    console.error('analyze-recording error:', error)
    return NextResponse.json({ error: '분석 실패: ' + error.message }, { status: 500 })
  }
}
