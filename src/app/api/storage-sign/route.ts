import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// POST: 클라이언트가 Supabase Storage에 직접 업로드할 수 있는 서명된 URL 발급
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'dig' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { filename } = await req.json()
  if (!filename) return NextResponse.json({ error: 'filename 필요' }, { status: 400 })

  const ext = (filename.split('.').pop() || 'mp3').toLowerCase()
  const path = `recordings/${user.id}/${Date.now()}.${ext}`

  const { data, error } = await supabaseAdmin.storage
    .from('dig-recordings')
    .createSignedUploadUrl(path)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('dig-recordings')
    .getPublicUrl(path)

  return NextResponse.json({ signedUrl: data.signedUrl, path, publicUrl, filename })
}
