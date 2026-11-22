import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { agentGuard } from '@/lib/agentAuth'

// 주황이 전용: 카톡방 이름 또는 업체명으로 관리팀 카드(case_id) 찾기. GET /api/agent/cases?room=…  또는 ?q=업체명
const norm = (s: any) => String(s || '').replace(/\s+/g, '').toLowerCase()

export async function GET(req: NextRequest) {
  const g = agentGuard(req); if (g) return g
  const sp = new URL(req.url).searchParams
  const room = norm(sp.get('room')), q = norm(sp.get('q'))
  if (!room && !q) return NextResponse.json({ error: 'room 또는 q 필요' }, { status: 400 })
  let all: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from('ops_cases').select('*').range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    all = all.concat(data || [])
    if (!data || data.length < 1000) break
  }
  const ids = [...new Set(all.map(c => c.customer_id).filter(Boolean))]
  const names: Record<string, { name: string; company: string }> = {}
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabaseAdmin.from('customers').select('id, name, details').in('id', ids.slice(i, i + 200))
    for (const c of data || []) names[c.id] = { name: c.name || '', company: c.details?.company || '' }
  }
  const hits = all.map(c => ({ case_id: c.id, company: names[c.customer_id]?.company || c.details?.company || c.customer_name || '', representative: names[c.customer_id]?.name || c.customer_name || '', kakao_room: c.details?.kakao_room || '', ops_user: c.ops_user_name || c.details?.ops_user_name || '', stage: c.stage || '' }))
    .filter(h => (room && norm(h.kakao_room) === room) || (q && (norm(h.company).includes(q) || norm(h.representative).includes(q) || norm(h.kakao_room).includes(q))))
    .slice(0, 20)
  return NextResponse.json({ cases: hits })
}
