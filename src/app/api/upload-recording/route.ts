import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// POST: 녹취 파일 Supabase Storage 업로드
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'dig' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 })

    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: '최대 50MB까지 업로드 가능합니다' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'mp3'
    const timestamp = Date.now()
    const path = `recordings/${user.id}/${timestamp}.${ext}`

    const bytes = await file.arrayBuffer()

    const { data, error } = await supabaseAdmin.storage
      .from('dig-recordings')
      .upload(path, bytes, {
        contentType: file.type || 'audio/mpeg',
        upsert: false,
      })

    if (error) {
      // 버킷 없을 시 명확한 에러 메시지
      if (error.message.includes('Bucket not found') || error.message.includes('bucket')) {
        return NextResponse.json({
          error: 'Supabase Storage에 "dig-recordings" 버킷이 없습니다. 대표님이 Supabase 대시보드에서 생성해주세요.',
        }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('dig-recordings')
      .getPublicUrl(data.path)

    return NextResponse.json({ url: publicUrl, path: data.path, filename: file.name })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
