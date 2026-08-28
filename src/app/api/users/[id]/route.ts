import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

// PATCH: 직원 정보 수정 (대표만) — 이름/아이디/비번/역할 변경, 팀이관 시 owner_id 초기화
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { id } = await context.params
  const body = await req.json()
  const { name, username, password, role, blocked } = body

  // 대상 직원 확인
  const { data: target } = await supabaseAdmin.from('users').select('role, name, blocked').eq('id', id).single()
  if (!target) return NextResponse.json({ error: '직원 없음' }, { status: 404 })
  if (target.role === 'ceo') return NextResponse.json({ error: '대표 계정은 수정할 수 없습니다' }, { status: 400 })

  // 아이디 중복 확인
  if (username) {
    const { data: dup } = await supabaseAdmin.from('users').select('id').eq('username', username).neq('id', id).single()
    if (dup) return NextResponse.json({ error: '이미 사용 중인 아이디입니다' }, { status: 409 })
  }

  const updateFields: Record<string, any> = {}
  if (name) updateFields.name = name
  if (username) updateFields.username = username
  if (password) updateFields.password_hash = await bcrypt.hash(password, 10)
  if (role && ['sales', 'ops', 'dig'].includes(role)) updateFields.role = role
  if (typeof blocked === 'boolean') updateFields.blocked = blocked

  const { data: updated, error } = await supabaseAdmin
    .from('users').update(updateFields).eq('id', id).select('id, name, username, role, blocked').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 팀이관 시: 해당 직원이 담당하던 고객 owner_id 초기화 (블락은 제외)
  const roleChanged = role && role !== target.role && typeof blocked !== 'boolean'
  if (roleChanged) {
    await supabaseAdmin.from('customers').update({ owner_id: null }).eq('owner_id', id)
  }

  return NextResponse.json({ user: updated, customersUnassigned: roleChanged })
}

// DELETE: 직원 계정 삭제 (대표만)
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { id } = await context.params

  // 대표 자신은 삭제 불가
  if (id === user.id) {
    return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다' }, { status: 400 })
  }

  // CEO 계정은 삭제 불가
  const { data: target } = await supabaseAdmin
    .from('users')
    .select('role, name')
    .eq('id', id)
    .single()

  if (!target) return NextResponse.json({ error: '직원 없음' }, { status: 404 })
  if (target.role === 'ceo') return NextResponse.json({ error: '대표 계정은 삭제할 수 없습니다' }, { status: 400 })

  const { error } = await supabaseAdmin.from('users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, name: target.name })
}
