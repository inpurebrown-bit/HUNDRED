import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

// GET: 역할별 직원 목록 (대표만 조회 가능)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')

  // 영업팀/관리팀은 ops 이름 목록만 조회 가능 (담당자 배정용)
  // CEO는 전체 조회 가능
  if (user.role !== 'ceo') {
    if ((user.role === 'sales' || user.role === 'ops') && (role === 'sales' || role === 'ops')) {
      // 이름만 반환 (민감 정보 제외)
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, name')
        .eq('role', role)
        .order('name')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ users: data })
    }
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const query = supabaseAdmin
    .from('users')
    .select('id, name, username, role, blocked')
    .order('name')

  const finalQuery = role ? query.eq('role', role) : query

  const { data, error } = await finalQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

// POST: 직원 계정 생성 (대표만)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const { name, username, password, role } = body

  if (!name || !username || !password || !role) {
    return NextResponse.json({ error: '이름, 아이디, 비밀번호, 역할은 필수입니다' }, { status: 400 })
  }
  if (!['sales', 'ops', 'dig'].includes(role)) {
    return NextResponse.json({ error: '역할은 sales, ops, dig만 가능합니다' }, { status: 400 })
  }
  if (password.length < 4) {
    return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다' }, { status: 400 })
  }

  // 중복 아이디 확인
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('username', username)
    .single()
  if (existing) {
    return NextResponse.json({ error: '이미 사용 중인 아이디입니다' }, { status: 409 })
  }

  const password_hash = await bcrypt.hash(password, 10)

  const { data: created, error } = await supabaseAdmin
    .from('users')
    .insert({ name, username, password_hash, role })
    .select('id, name, username, role')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ user: created }, { status: 201 })
}
