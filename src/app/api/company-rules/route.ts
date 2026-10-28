import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { BUCKET, ensureBucket, readSetting, writeSetting } from '@/lib/docs/store'
import { parseDocFile } from '@/lib/docs/importDoc'
import type { DocContent } from '@/lib/docs/hwpxDoc'

export const maxDuration = 60

// 정관·규정 — 대표 전용. 내용은 settings 의 'company_rules', 지난 버전은 'company_rules_history' 에 보관한다.
export interface RulesData extends DocContent { version: number; updatedAt: string; updatedBy: string; note?: string }
interface HistItem { version: number; at: string; by: string; note: string; content: DocContent }

async function ceo() {
  const session = await getServerSession(authOptions)
  if (!session) return { err: NextResponse.json({ error: '인증 필요' }, { status: 401 }) }
  if ((session.user as any).role !== 'ceo') return { err: NextResponse.json({ error: '권한 없음' }, { status: 403 }) }
  return { user: session.user as any }
}

export async function GET() {
  const a = await ceo(); if (a.err) return a.err
  const rules = await readSetting<RulesData>('company_rules')
  const hist = (await readSetting<{ items: HistItem[] }>('company_rules_history'))?.items || []
  return NextResponse.json({ rules, history: hist.map(h => ({ version: h.version, at: h.at, by: h.by, note: h.note, blocks: h.content.blocks.length })) })
}

// 저장: 이전 내용은 이력에 보관하고 버전을 올린다
async function saveNew(content: DocContent, user: string, note: string) {
  const cur = await readSetting<RulesData>('company_rules')
  const hist = (await readSetting<{ items: HistItem[] }>('company_rules_history'))?.items || []
  if (cur) {
    const { version, updatedAt, updatedBy, note: n, ...prevContent } = cur
    hist.unshift({ version, at: updatedAt, by: updatedBy, note: n || '', content: prevContent })
    await writeSetting('company_rules_history', { items: hist.slice(0, 12) })
  }
  const next: RulesData = { title: content.title, subtitle: content.subtitle, blocks: content.blocks, version: (cur?.version || 0) + 1, updatedAt: new Date().toISOString(), updatedBy: user, note }
  await writeSetting('company_rules', next)
  return next
}

export async function PUT(req: NextRequest) {
  const a = await ceo(); if (a.err) return a.err
  const body = await req.json().catch(() => null)
  if (!body?.content?.blocks) return NextResponse.json({ error: '내용이 없습니다' }, { status: 400 })
  const next = await saveNew(body.content, a.user.name || '', String(body.note || '내용 수정'))
  return NextResponse.json({ ok: true, rules: next })
}

export async function POST(req: NextRequest) {
  const a = await ceo(); if (a.err) return a.err
  const body = await req.json().catch(() => ({}))

  // 한글·워드 파일 교체: 올려 둔 파일을 읽어 내용으로 바꾼다 (이전 내용은 이력에 보관)
  if (body.action === 'upload-url') {
    await ensureBucket()
    const ext = (String(body.filename || 'f').split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `rules-import/${Date.now()}.${ext}`
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ path, token: data.token })
  }
  if (body.action === 'import') {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(String(body.path))
    if (error || !data) return NextResponse.json({ error: error?.message || '파일을 찾을 수 없습니다' }, { status: 404 })
    try {
      const content = await parseDocFile(Buffer.from(await data.arrayBuffer()), String(body.filename || 'f.hwpx'))
      if (content.blocks.length < 3) return NextResponse.json({ error: '읽어 낸 내용이 너무 적습니다. 파일을 확인해 주세요' }, { status: 422 })
      const next = body.apply === false ? null : await saveNew(content, a.user.name || '', `파일 교체: ${body.filename}`)
      await supabaseAdmin.storage.from(BUCKET).remove([String(body.path)]).catch(() => {})
      return NextResponse.json({ ok: true, rules: next, count: content.blocks.length, content })
    } catch (e: any) {
      return NextResponse.json({ error: '파일을 읽지 못했습니다: ' + (e?.message || '') }, { status: 422 })
    }
  }
  if (body.action === 'restore') {
    const hist = (await readSetting<{ items: HistItem[] }>('company_rules_history'))?.items || []
    const h = hist.find(x => x.version === body.version)
    if (!h) return NextResponse.json({ error: '해당 버전이 없습니다' }, { status: 404 })
    const next = await saveNew(h.content, a.user.name || '', `v${h.version}로 되돌림`)
    return NextResponse.json({ ok: true, rules: next })
  }
  return NextResponse.json({ error: '알 수 없는 요청' }, { status: 400 })
}
