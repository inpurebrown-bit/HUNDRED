import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// PATCH: 상태 변경 (ceo: 승인/거절/배정, dig: 분석 결과 업데이트)
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await context.params
  const user = session.user as any
  const body = await req.json()
  const { action } = body

  if (action === 'approve' || action === 'reject' || action === 'assign') {
    if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  if (action === 'set_analysis') {
    if (user.role !== 'dig' && user.role !== 'ceo') {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }
  }

  let updateData: Record<string, any> = {}

  if (action === 'approve') {
    updateData = {
      status: 'approved',
      ceo_comment: body.ceo_comment || null,
      approved_at: new Date().toISOString(),
    }
  } else if (action === 'reject') {
    updateData = {
      status: 'rejected',
      ceo_comment: body.ceo_comment || null,
    }
  } else if (action === 'assign') {
    const { assigned_to, assigned_to_name } = body
    if (!assigned_to) return NextResponse.json({ error: '배정 대상 필요' }, { status: 400 })

    const { data: prospect, error: fetchErr } = await supabaseAdmin
      .from('dig_prospects')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchErr || !prospect) return NextResponse.json({ error: '가망 없음' }, { status: 404 })

    const { data: newCustomer, error: custErr } = await supabaseAdmin
      .from('customers')
      .insert({
        name: prospect.ceo_name || '(미입력)',
        phone: prospect.phone_010 || prospect.phone,
        source: 'lead',          // DB CHECK: 'self'|'lead' — 자체공급도 공급파이프라인(공가) 경로
        status: 'active',        // DB CHECK: 'active'|'contracted'
        owner_id: assigned_to,
        details: {
          sub_status: 'lead',    // 공가DB 상태 (프론트 상태)
          supply_source: 'self_supply',  // 자체공급 식별자
          reception_date: new Date().toISOString().slice(0, 10),  // 공급일 자동 설정
          company: prospect.company,
          sales_user_name: assigned_to_name,
          // 영업팀 InCallCard 필드명으로 매핑
          years_in_business: prospect.business_age,
          business_type: prospect.industry,
          revenue_2026: prospect.annual_revenue,
          credit_score: prospect.credit_score,
          tax_delinquency: prospect.memo || (prospect.has_delinquency ? '있음' : '없음'),
          required_funds: prospect.required_fund,
          // 원본 보존
          business_age: prospect.business_age,
          annual_revenue: prospect.annual_revenue,
          industry: prospect.industry,
          has_delinquency: prospect.has_delinquency,
          required_fund: prospect.required_fund,
          // 출처 정보
          dig_prospect_id: prospect.id,
          dig_user_name: prospect.dig_user_name,
          dig_phone_010: prospect.phone_010,
        },
      })
      .select()
      .single()

    if (custErr) return NextResponse.json({ error: custErr.message }, { status: 500 })

    // 자체공급 카운트 자동 증가 (supply-config self_supplied)
    const { data: cfgRow } = await supabaseAdmin
      .from('notices')
      .select('id, content')
      .eq('notice_type', 'supply_config')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (cfgRow) {
      try {
        const cfg = JSON.parse(cfgRow.content || '{}')
        const people = cfg.people || {}
        const emp = people[assigned_to_name] || { supplied: 0, goal: 30, base: 0, self_supplied: 0 }
        emp.self_supplied = (emp.self_supplied || 0) + 1
        people[assigned_to_name] = emp
        cfg.people = people
        await supabaseAdmin.from('notices').update({ content: JSON.stringify(cfg) }).eq('id', cfgRow.id)
      } catch {}
    }

    updateData = {
      status: 'assigned',
      assigned_to,
      assigned_to_name,
      customer_id: newCustomer.id,
      assigned_at: new Date().toISOString(),
    }
  } else if (action === 'set_analysis') {
    updateData = {
      recording_analysis: body.analysis,
    }
  } else if (action === 'resubmit') {
    if (user.role !== 'dig' && user.role !== 'ceo') {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }
    const { data: existing } = await supabaseAdmin
      .from('dig_prospects')
      .select('status, dig_user_id')
      .eq('id', id)
      .single()
    if (!existing) return NextResponse.json({ error: '가망 없음' }, { status: 404 })
    if (existing.status !== 'rejected') {
      return NextResponse.json({ error: '부결된 가망만 재심사 가능합니다' }, { status: 400 })
    }
    if (user.role === 'dig' && existing.dig_user_id !== user.id) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }
    updateData = {
      status: 'pending',
      ceo_comment: null,
      recording_url: body.recording_url ?? null,
      recording_filename: body.recording_filename ?? null,
      recording_analysis: body.recording_analysis ?? null,
    }
  } else {
    return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('dig_prospects')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prospect: data })
}

// DELETE: CEO는 모든 상태 삭제 가능, dig는 본인 것 pending만 취소 가능
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await context.params
  const user = session.user as any
  if (user.role !== 'dig' && user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  let query = supabaseAdmin.from('dig_prospects').delete().eq('id', id)
  if (user.role === 'dig') {
    query = query.eq('dig_user_id', user.id).eq('status', 'pending') as typeof query
  }
  // CEO는 조건 없이 어떤 상태든 삭제 가능

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
