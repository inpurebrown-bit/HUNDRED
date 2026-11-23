import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard } from '@/lib/agentAuth'
import { DIG_DAILY_GOAL } from '@/lib/payrollCalc'
import { isTester } from '@/lib/tester'
import { baseName } from '@/lib/personName'

// 주황이 전용(읽기): 오늘 발굴팀이 CRM 에 올린 심사요청 현황. GET /api/agent/dig-today[?date=YYYY-MM-DD]
//  · count_today = 오늘 넘긴 총 개수(승인·부결·대기 모두, 사장님이 삭제한 취소건 제외) → 보라의 "(N/8건)" 의 N
//  · quota = 한 사람 하루 할당량(8)
//  · items 의 status: pending(대기) / approved(승인) / assigned(배정됨) / rejected(부결, reason 에 사유)
//  · 휴대폰·녹취 등 민감정보는 주지 않는다. 업체명은 직원방 안내용으로만 준다.
const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

export async function GET(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const date = new URL(req.url).searchParams.get('date') || kstToday()
  const { data: users } = await supabaseAdmin.from('users').select('id, name, username, blocked').eq('role', 'dig')
  const members = (users || []).filter(u => !u.blocked && !isTester(u.name, u.username))
  const { data: rows, error } = await supabaseAdmin.from('dig_prospects')
    .select('id, dig_user_id, dig_user_name, company, status, ceo_comment, created_at, call_date')
    .eq('call_date', date).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const byUser = new Map<string, any[]>()
  for (const r of rows || []) {
    if (r.status === 'canceled') continue
    const k = String(r.dig_user_id || r.dig_user_name)
    if (!byUser.has(k)) byUser.set(k, [])
    byUser.get(k)!.push({ id: r.id, status: r.status, company: r.company || '', reason: r.status === 'rejected' ? (r.ceo_comment || '') : '', created_at: r.created_at })
  }
  const list = members.map(m => {
    const items = byUser.get(String(m.id)) || byUser.get(String(m.name)) || []
    return { id: m.id, name: m.name, base_name: baseName(m.name), count_today: items.length, quota: DIG_DAILY_GOAL, items }
  })
  const total = list.reduce((s, m) => s + m.count_today, 0)
  return NextResponse.json({ date, quota_per_person: DIG_DAILY_GOAL, team_total_today: total, team_quota: DIG_DAILY_GOAL * list.length, members: list })
}
