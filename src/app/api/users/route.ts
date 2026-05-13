import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: 역할별 직원 목록 (대표만 조회 가능)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')

  // 영업팀은 영업팀 이름 목록만 조회 가능 (DB 트레이드용)
  // CEO는 전체 조회 가능
  if (user.role !== 'ceo') {
    if (user.role === 'sales' && role === 'sales') {
      // 이름만 반환 (민감 정보 제외)
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('name')
        .eq('role', 'sales')
        .order('name')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ users: data })
    }
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const query = supabaseAdmin
    .from('users')
    .select('id, name, username, role')
    .order('name')

  const finalQuery = role ? query.eq('role', role) : query

  const { data, error } = await finalQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}
