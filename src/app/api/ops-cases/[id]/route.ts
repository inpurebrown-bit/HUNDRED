import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// PATCH: 케이스 진행현황 업데이트 (자동저장)
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const body = await req.json()
  const { id } = await context.params

  // 본인 담당 케이스만 수정 (ceo는 전체)
  const { data: existing } = await supabaseAdmin
    .from('ops_cases')
    .select('ops_user_id')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: '케이스 없음' }, { status: 404 })
  if (user.role === 'ops' && existing.ops_user_id !== user.id) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('ops_cases')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ case: data })
}
