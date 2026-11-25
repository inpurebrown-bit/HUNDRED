import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard } from '@/lib/agentAuth'
import { isTester } from '@/lib/tester'
import { baseName } from '@/lib/personName'

// 주황이·남색 전용(읽기): 영업사원 개인별 "오늘 챙길 업체" 정리. GET /api/agent/sales-brief[?name=손제후]
//  · 개인톡으로 "결정업체 / 오늘 통화 예정(시간순) / 지난 재통화(놓친 것) / 고민중 / 부재" 를 카테고리별로 보낼 때 쓴다.
//  · 휴대폰·녹취·매출 등 민감정보는 주지 않는다. 업체명과 시간만 준다.
const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000)
const CAP = 40

export async function GET(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const want = (new URL(req.url).searchParams.get('name') || '').trim()
  const { data: users } = await supabaseAdmin.from('users').select('id, name, username, blocked').eq('role', 'sales')
  const members = (users || []).filter(u => !u.blocked && !isTester(u.name, u.username) && (!want || baseName(u.name) === baseName(want) || u.name === want))
  const today = kstNow().toISOString().slice(0, 10)
  const weekAgo = new Date(kstNow().getTime() - 7 * 86400000).toISOString().slice(0, 10)
  const out: any[] = []
  for (const m of members) {
    const { data: rows } = await supabaseAdmin.from('customers').select('id, name, status, details, created_at')
      .eq('owner_id', m.id).eq('status', 'active').order('created_at', { ascending: false }).limit(600)
    const live = (rows || []).filter(r => !['trash', 'refunded'].includes(String((r.details || {}).sub_status || '')))
    const co = (r: any) => String((r.details || {}).company || r.name || '').trim()
    const cr = (r: any) => String((r.details || {}).closing_result || '')
    const fd = (r: any) => String((r.details || {}).follow_up_date || '')
    const ft = (r: any) => String((r.details || {}).follow_up_time || '')
    const todayCalls = live.filter(r => fd(r) === today).sort((a, b) => ft(a).localeCompare(ft(b)))
      .map(r => ({ time: ft(r), company: co(r), result: cr(r) }))
    const overdue = live.filter(r => fd(r) && fd(r) < today && fd(r) >= weekAgo && ['재통화', '고민중', '부재', ''].includes(cr(r)))
      .sort((a, b) => (fd(a) + ft(a)).localeCompare(fd(b) + ft(b))).map(r => ({ date: fd(r), time: ft(r), company: co(r), result: cr(r) }))
    const names = (k: string) => live.filter(r => cr(r) === k).map(r => ({ company: co(r), follow_up: fd(r) ? `${fd(r)} ${ft(r)}`.trim() : '' }))
    const decided = names('결정업체'), thinking = names('고민중'), absent = names('부재')
    out.push({
      id: m.id, name: m.name, base_name: baseName(m.name),
      counts: { today_calls: todayCalls.length, overdue: overdue.length, decided: decided.length, thinking: thinking.length, absent: absent.length },
      today_calls: todayCalls.slice(0, CAP), overdue: overdue.slice(0, CAP),
      decided: decided.slice(0, CAP), thinking: thinking.slice(0, CAP), absent: absent.slice(0, CAP),
    })
  }
  return NextResponse.json({ date: today, members: out })
}
