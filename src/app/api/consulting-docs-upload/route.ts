import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'consulting-docs'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (!['ops', 'ceo'].includes(user.role)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { filename, caseId, docType } = await req.json()
  if (!filename || !caseId || !docType) return NextResponse.json({ error: 'filename, caseId, docType 필요' }, { status: 400 })

  // 비공개 버킷 자동 생성 (이미 있으면 무시)
  await supabaseAdmin.storage.createBucket(BUCKET, { public: false }).catch(() => {})

  const ext = (String(filename).split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `cases/${caseId}/${docType}_${Date.now()}.${ext}`
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ path, token: data.token })
}

// 삭제
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (!['ops', 'ceo'].includes(user.role)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { path } = await req.json()
  if (!path) return NextResponse.json({ error: 'path 필요' }, { status: 400 })
  await supabaseAdmin.storage.from(BUCKET).remove([path])
  return NextResponse.json({ ok: true })
}
