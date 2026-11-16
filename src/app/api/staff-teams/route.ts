import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// 영업팀 구성원의 "몇 팀" 정보 — 1팀 구성원이 스타트 멤버(잔금 인센 대상), 2팀부터는 잔금 인센 없음
// users 테이블을 건드리지 않고 settings('staff_teams') 에 {사용자 id: 팀 번호} 로 저장한다. 지정하지 않은 영업 구성원은 1팀으로 본다.
const KEY = 'staff_teams'

async function ceo() {
  const session = await getServerSession(authOptions)
  if (!session) return { err: NextResponse.json({ error: '인증 필요' }, { status: 401 }) }
  if ((session.user as any).role !== 'ceo') return { err: NextResponse.json({ error: '권한 없음' }, { status: 403 }) }
  return {}
}

async function readMap(): Promise<Record<string, number>> {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', KEY).maybeSingle()
  const m = (data?.value as any)?.map
  return m && typeof m === 'object' ? m : {}
}

export async function GET() {
  const a = await ceo(); if (a.err) return a.err
  const map = await readMap()
  const { data: users } = await supabaseAdmin.from('users').select('id, name, username, role, blocked').eq('role', 'sales')
  const teams = (users || []).map((u: any) => ({ id: u.id, name: u.name, username: u.username, blocked: !!u.blocked, team_no: map[u.id] ?? 1, set: map[u.id] != null }))
  return NextResponse.json({ map, teams })
}

export async function POST(req: NextRequest) {
  const a = await ceo(); if (a.err) return a.err
  const body = await req.json().catch(() => ({}))
  const id = String(body.user_id || '')
  const n = Number(body.team_no)
  if (!id || !Number.isInteger(n) || n < 1 || n > 99) return NextResponse.json({ error: '사용자와 팀 번호(1~99)가 필요합니다' }, { status: 400 })
  const map = await readMap()
  map[id] = n
  const { error } = await supabaseAdmin.from('settings').upsert({ key: KEY, value: { map } }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, map })
}
