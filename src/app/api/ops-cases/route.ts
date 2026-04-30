import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: 내 담당 케이스 목록
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ops' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const query = supabaseAdmin
    .from('ops_cases')
    .select(`*, customers(name, phone, company, loan_history)`)
    .order('updated_at', { ascending: false })

  // 관리팀은 본인 담당 케이스만
  const finalQuery = user.role === 'ops'
    ? query.eq('ops_user_id', user.id)
    : query

  const { data, error } = await finalQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cases: data })
}
