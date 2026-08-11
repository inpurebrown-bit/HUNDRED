import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

// POST /api/migrate/create-dig-user
// body: { username: 'hd-dig1', name: '발굴팀1', password: '...' }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || role !== 'ceo') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { username, name, password } = await req.json()
  if (!username || !name || !password) {
    return NextResponse.json({ error: 'username, name, password 필수' }, { status: 400 })
  }

  // 중복 확인
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('username', username)
    .single()

  if (existing) {
    return NextResponse.json({ error: `${username} 이미 존재합니다` }, { status: 409 })
  }

  const password_hash = await bcrypt.hash(password, 10)

  const { data, error } = await supabaseAdmin
    .from('users')
    .insert({ username, name, password_hash, role: 'dig' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: { id: data.id, username: data.username, name: data.name, role: data.role } })
}
