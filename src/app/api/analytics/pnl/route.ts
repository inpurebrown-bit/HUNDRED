import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { calcMonthPnl } from '@/lib/pnlCalc'

// 대표 전용: 급여·손익 탭에 저장된 월별 기록으로 매출·비용·순이익 추이를 계산해 돌려준다.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  if ((session.user as any).role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('payroll_records')
    .select('year_month, employees')
    .order('year_month', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const months = (data || [])
    .filter(r => /^\d{4}-\d{2}$/.test(r.year_month))   // __personal_finance__ 같은 보조 행 제외
    .map(r => calcMonthPnl(r.year_month, r.employees))
    .filter(m => m.hasData)
    .slice(-12)

  const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7)
  return NextResponse.json({ months, currentMonth: kst })
}
