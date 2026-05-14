import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * 영업팀 전용: 자금팀 전송된 고객들의 진행현황 조회 (읽기전용)
 * GET /api/ops-status?ids=id1,id2,...
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'sales' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? []

  if (ids.length === 0) return NextResponse.json({ statuses: [] })

  const { data, error } = await supabaseAdmin
    .from('ops_cases')
    .select('customer_id, stage, institution, memo, is_refund, is_completed')
    .in('customer_id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ statuses: data ?? [] })
}
