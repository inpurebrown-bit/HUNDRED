import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { assignProspect, queueAssign, cancelQueue } from '@/lib/digAssign'

// PATCH: 상태 변경 (ceo: 승인/거절/배정, dig: 분석 결과 업데이트)
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await context.params
  const user = session.user as any
  const body = await req.json()
  const { action } = body

  if (action === 'clear_urgent') {
    if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    const { data: pr } = await supabaseAdmin.from('dig_prospects').update({ urgent_assign: false }).eq('id', id).select('customer_id').single()
    if (pr?.customer_id) {
      const { data: cu } = await supabaseAdmin.from('customers').select('details').eq('id', pr.customer_id).single()
      if (cu) await supabaseAdmin.from('customers').update({ details: { ...(cu.details || {}), urgent_assign: false } }).eq('id', pr.customer_id)
    }
    return NextResponse.json({ ok: true })
  }

  if (action === 'cancel_queue') {
    if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    await cancelQueue(id)
    return NextResponse.json({ ok: true })
  }

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
    // 즉시 배정(now) 또는 다음 영업일 아침 자동 배정 예약(schedule)
    const { assigned_to, assigned_to_name, mode } = body
    if (!assigned_to) return NextResponse.json({ error: '배정 대상 필요' }, { status: 400 })
    if (mode === 'schedule') {
      const at = await queueAssign([id], assigned_to, assigned_to_name || '', { name: user.name, role: user.role })
      return NextResponse.json({ queued: true, release_at: at })
    }
    const r = await assignProspect(id, assigned_to, assigned_to_name || '', { name: user.name, role: user.role })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    await cancelQueue(id)
    return NextResponse.json({ ok: true })
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

  // 대표 삭제 = 취소건으로 남긴다 (고객이 상담 취소 요청한 경우 발굴팀이 다시 확인할 수 있게). 이미 취소건이면 완전 삭제.
  if (user.role === 'ceo') {
    const { data: cur } = await supabaseAdmin.from('dig_prospects').select('status, recording_analysis').eq('id', id).maybeSingle()
    if (cur && cur.status !== 'canceled') {
      const ra = cur.recording_analysis && typeof cur.recording_analysis === 'object' ? cur.recording_analysis : {}
      const { error: ce } = await supabaseAdmin.from('dig_prospects')
        .update({ status: 'canceled', recording_analysis: { ...ra, canceled_at: new Date().toISOString(), prev_status: cur.status } })
        .eq('id', id)
      if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })
      await cancelQueue(id).catch(() => {})
      return NextResponse.json({ success: true, canceled: true })
    }
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
