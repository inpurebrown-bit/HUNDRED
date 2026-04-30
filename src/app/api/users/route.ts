import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: 역할별 직원 목록 (대표만 조회 가능)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role')

  const query = supabaseAdmin
    .from('users')
    .select('id, name, username, role')
    .order('name')

  const finalQuery = role ? query.eq('role', role) : query

  const { data, error } = await finalQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}
