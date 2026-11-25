import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard } from '@/lib/agentAuth'
import { isTester } from '@/lib/tester'
import { baseName } from '@/lib/personName'

// 주황이·남색 전용(읽기): 오늘 오전보고·마감보고를 낸 사람 / 안 낸 사람. GET /api/agent/report-status[?date=YYYY-MM-DD]
//  · 영업팀(sales)·관리팀(ops) 구성원별로 morning / daily 제출 여부와 제출 시각(KST)을 준다.
//  · 마감보고 안내·독촉(관리팀방·영업팀방·개인톡)에 쓴다. 보고 내용은 주지 않는다.
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

export async function GET(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const date = new URL(req.url).searchParams.get('date') || kstToday()
  const { data: users } = await supabaseAdmin.from('users').select('id, name, username, role, blocked').in('role', ['sales', 'ops'])
  const members = (users || []).filter(u => !u.blocked && !isTester(u.name, u.username))
  const { data: rows } = await supabaseAdmin.from('reports').select('user_id, report_type, created_at, updated_at').eq('report_date', date)
  const hhmm = (iso?: string) => iso ? new Date(new Date(iso).getTime() + 9 * 3600 * 1000).toISOString().slice(11, 16) : ''
  const out = members.map(m => {
    const mine = (rows || []).filter(r => String(r.user_id) === String(m.id))
    const pick = (t: string) => mine.find(r => r.report_type === t || r.report_type === 'ops_' + t)
    const mo = pick('morning'), da = pick('daily')
    return {
      id: m.id, name: m.name, base_name: baseName(m.name), role: m.role,
      morning: !!mo, morning_at: hhmm((mo as any)?.updated_at || (mo as any)?.created_at),
      daily: !!da, daily_at: hhmm((da as any)?.updated_at || (da as any)?.created_at),
    }
  })
  return NextResponse.json({ date, members: out, missing_daily: out.filter(o => !o.daily).map(o => o.name), missing_morning: out.filter(o => !o.morning).map(o => o.name) })
}
