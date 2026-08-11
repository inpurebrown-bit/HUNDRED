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
        status: 'db010',
        owner_id: assigned_to,
        details: {
          company: prospect.company,
          business_age: prospect.business_age,
          annual_revenue: prospect.annual_revenue,
          industry: prospect.industry,
          credit_score: prospect.credit_score,
          required_fund: prospect.required_fund,
          has_delinquency: prospect.has_delinquency,
          source: 'dig',
          dig_prospect_id: prospect.id,
          dig_user_name: prospect.dig_user_name,
        },
      })
      .select()
      .single()

    if (custErr) return NextResponse.json({ error: custErr.message }, { status: 500 })

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

// DELETE: dig 본인 것만 (pending 상태에서만 취소)
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

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
