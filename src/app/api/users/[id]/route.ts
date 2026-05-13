import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

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
