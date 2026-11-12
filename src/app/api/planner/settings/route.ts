import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// 대표 플래너 설정(가정값·대출 잔액·시뮬레이션 값) 저장 — 대표 전용
const KEY = 'planner_v2'

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  if ((session.user as any).role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  return null
}

export async function GET() {
  const denied = await guard()
  if (denied) return denied
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', KEY).maybeSingle()
  return NextResponse.json({ value: data?.value || null })
}

export async function POST(req: NextRequest) {
  const denied = await guard()
  if (denied) return denied
  const body = await req.json().catch(() => null)
  if (!body || typeof body.value !== 'object') return NextResponse.json({ error: '값이 없습니다' }, { status: 400 })
  const { error } = await supabaseAdmin.from('settings').upsert({ key: KEY, value: body.value }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
