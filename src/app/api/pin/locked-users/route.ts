import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// 대표 전용: 잠긴 사용자 목록 조회
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const role = (session.user as any).role
  if (role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, name, username, role, pin_fail_count, pin_locked')
    .eq('pin_locked', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ users: data || [] })
}
