import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// POST: 배정 완료된 발굴 가망 → customers owner_id 동기화
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  // 배정 완료된 발굴 가망 전체 조회
  const { data: prospects, error: pErr } = await supabaseAdmin
    .from('dig_prospects')
    .select('id, ceo_name, company, assigned_to, assigned_to_name, customer_id')
    .eq('status', 'assigned')

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const results: any[] = []

  for (const p of (prospects || [])) {
    if (!p.customer_id || !p.assigned_to) continue

    // 현재 customer 확인
    const { data: cust } = await supabaseAdmin
      .from('customers')
      .select('id, owner_id, source, details')
      .eq('id', p.customer_id)
      .single()

    if (!cust) {
      results.push({ prospect_id: p.id, name: p.ceo_name, status: 'customer_not_found' })
      continue
    }

    const needsFix = cust.owner_id !== p.assigned_to || cust.source !== 'lead'

    if (needsFix) {
      const { error: uErr } = await supabaseAdmin
        .from('customers')
        .update({
          owner_id: p.assigned_to,
          source: 'lead',
        })
        .eq('id', p.customer_id)

      results.push({
        prospect_id: p.id,
        customer_id: p.customer_id,
        name: p.ceo_name || p.company,
        assigned_to_name: p.assigned_to_name,
        old_owner_id: cust.owner_id,
        new_owner_id: p.assigned_to,
        status: uErr ? `error: ${uErr.message}` : 'fixed',
      })
    } else {
      results.push({
        prospect_id: p.id,
        customer_id: p.customer_id,
        name: p.ceo_name || p.company,
        assigned_to_name: p.assigned_to_name,
        status: 'ok',
      })
    }
  }

  return NextResponse.json({ results })
}
