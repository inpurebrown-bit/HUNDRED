import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { BUCKET, ensureBucket, readLib, writeSetting, type LibDoc } from '@/lib/docs/store'

// 규정·서식 보관함 — 대표 전용
async function ceo() {
  const session = await getServerSession(authOptions)
  if (!session) return { err: NextResponse.json({ error: '인증 필요' }, { status: 401 }) }
  if ((session.user as any).role !== 'ceo') return { err: NextResponse.json({ error: '권한 없음' }, { status: 403 }) }
  return { user: session.user as any }
}

export async function GET() {
  const a = await ceo(); if (a.err) return a.err
  return NextResponse.json(await readLib())
}

export async function POST(req: NextRequest) {
  const a = await ceo(); if (a.err) return a.err
  const body = await req.json().catch(() => ({}))

  // 업로드용 서명 주소 (큰 파일도 브라우저가 저장소로 바로 올린다)
  if (body.action === 'upload-url') {
    await ensureBucket()
    const ext = (String(body.filename || 'file').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `files/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ path, token: data.token })
  }

  // 내려받기·미리보기용 서명 주소
  if (body.action === 'sign') {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(String(body.path), 600, body.download ? { download: String(body.name || true) } : undefined)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ url: data.signedUrl })
  }

  const lib = await readLib()

  // 문서 저장 (추가·수정·파일 교체 모두 이 한 곳)
  if (body.action === 'save') {
    const d = body.doc as LibDoc
    if (!d?.title?.trim()) return NextResponse.json({ error: '제목을 입력해 주세요' }, { status: 400 })
    const now = new Date().toISOString()
    const id = d.id || 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
    const prev = lib.docs.find(x => x.id === id)
    const doc: LibDoc = {
      id, title: d.title.trim(), team: d.team || '공통', category: d.category || '기타', desc: d.desc || '', text: d.text || '',
      files: d.files || [], history: d.history || [], createdAt: prev?.createdAt || now, updatedAt: now, updatedBy: a.user.name || '',
    }
    const docs = prev ? lib.docs.map(x => (x.id === id ? doc : x)) : [...lib.docs, doc]
    const categories = lib.categories.includes(doc.category) ? lib.categories : [...lib.categories, doc.category]
    await writeSetting('company_docs', { docs, categories, teams: lib.teams })
    return NextResponse.json({ ok: true, doc })
  }

  if (body.action === 'delete') {
    const d = lib.docs.find(x => x.id === body.id)
    if (d) await supabaseAdmin.storage.from(BUCKET).remove([...d.files, ...d.history].map(f => f.path)).catch(() => {})
    await writeSetting('company_docs', { ...lib, docs: lib.docs.filter(x => x.id !== body.id) })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'categories') {
    const cats = (body.categories as string[]).map(s => s.trim()).filter(Boolean)
    await writeSetting('company_docs', { ...lib, categories: cats })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: '알 수 없는 요청' }, { status: 400 })
}
