import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: 설정 조회 (?key=gcal 기본값)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  const key = req.nextUrl.searchParams.get('key') || 'gcal'
  // inst_lists는 모든 인증 유저가 읽을 수 있음 (ops 대시보드에서 필요)
  if (user.role !== 'ceo' && key !== 'inst_lists') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data } = await supabaseAdmin
    .from('settings')
    .select('*')
    .eq('key', key)
    .single()

  return NextResponse.json({ settings: data?.value || null })
}

// POST: 설정 저장 (body에 _key 필드로 키 지정, 없으면 'gcal' 기본)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json()
  const { _key, ...rest } = body
  const settingsKey = _key || 'gcal'
  const value = _key ? rest : body

  const { error } = await supabaseAdmin
    .from('settings')
    .upsert({ key: settingsKey, value }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
