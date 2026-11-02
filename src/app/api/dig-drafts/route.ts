import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// 발굴팀 임시 저장함 (저장하기 / 나중에 통화로 저장) — 본인 것만, settings 에 직원별로 보관
const keyOf = (uid: string) => `dig_drafts_${uid}`

async function load(uid: string): Promise<any[]> {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', keyOf(uid)).maybeSingle()
  return data?.value?.items || []
}
async function save(uid: string, items: any[]) {
  const { error } = await supabaseAdmin.from('settings').upsert({ key: keyOf(uid), value: { items } }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}

async function me() {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user) return { err: NextResponse.json({ error: '인증 필요' }, { status: 401 }) }
  if (user.role !== 'dig') return { err: NextResponse.json({ error: '권한 없음' }, { status: 403 }) }
  return { uid: user.id as string }
}

export async function GET() {
  const m = await me()
  if (m.err) return m.err
  return NextResponse.json({ drafts: await load(m.uid!) })
}

// 새로 저장하거나(id 없음), 같은 id 를 덮어쓴다
export async function POST(req: NextRequest) {
  const m = await me()
  if (m.err) return m.err
  const { id, kind, note, form, checklist, urgent, phoneSearch } = await req.json()
  if (kind !== 'save' && kind !== 'callback') return NextResponse.json({ error: '종류 오류' }, { status: 400 })
  const items = await load(m.uid!)
  const now = new Date().toISOString()
  const item = {
    id: id || 'dr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    kind, note: String(note || '').slice(0, 1000), form: form || {}, checklist: checklist || {},
    urgent: !!urgent, phoneSearch: phoneSearch || '', updatedAt: now,
    createdAt: items.find(x => x.id === id)?.createdAt || now,
  }
  const next = id && items.some(x => x.id === id) ? items.map(x => (x.id === id ? item : x)) : [item, ...items]
  await save(m.uid!, next.slice(0, 100))
  return NextResponse.json({ draft: item })
}

export async function DELETE(req: NextRequest) {
  const m = await me()
  if (m.err) return m.err
  const id = new URL(req.url).searchParams.get('id')
  const items = await load(m.uid!)
  await save(m.uid!, items.filter(x => x.id !== id))
  return NextResponse.json({ ok: true })
}
