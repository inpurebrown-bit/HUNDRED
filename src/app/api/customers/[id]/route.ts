import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeCustomers, statusPatch } from '@/lib/customerUtils'
import { sendPushNotification } from '@/lib/pushNotify'

// PATCH: 고객 정보 수정
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const body = await req.json()
  const { id } = await context.params

  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('owner_id, status, name, details')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: '고객 없음' }, { status: 404 })
  if (user.role === 'sales' && existing.owner_id !== user.id) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  // DB 컬럼명으로 변환
  const updateBody: Record<string, any> = {}

  if (body.name !== undefined) updateBody.name = body.name
  if (body.phone !== undefined) updateBody.phone = body.phone
  if (body.loan_history !== undefined) updateBody.loan_history = body.loan_history
  if (body.notes !== undefined) updateBody.memo = body.notes
  if (body.memo !== undefined) updateBody.memo = body.memo
  if (body.status !== undefined) {
    const sp = statusPatch(body.status, existing.details || {})
    updateBody.status  = sp.status
    updateBody.details = { ...(updateBody.details || existing.details || {}), ...sp.details }
  }
  if (body.owner_id !== undefined) updateBody.owner_id = body.owner_id
  if (body.sales_user_id !== undefined) updateBody.owner_id = body.sales_user_id
  if (body.source !== undefined) updateBody.source = body.source

  // details JSONB 머지 (company/sales_user_name 포함)
  if (body.details || body.company || body.sales_user_name) {
    const incomingDetails: Record<string, any> = { ...(body.details || {}) }
    if (body.company !== undefined) incomingDetails.company = body.company
    if (body.sales_user_name !== undefined) incomingDetails.sales_user_name = body.sales_user_name
    updateBody.details = { ...(existing.details || {}), ...incomingDetails }
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .update(updateBody)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 계약 완료로 상태 변경 시 대표에게 푸시 알림
  if (body.status === 'contracted' && existing.status !== 'contracted') {
    const customerName = existing.details?.company || existing.name || '고객'
    await sendPushNotification({
      title: '🎉 계약 완료!',
      body: `${customerName} — ${user.name || '영업팀'}이(가) 계약을 완료했습니다.`,
      url: '/',
      tag: 'contract',
      target: 'ceo',
    })
  }

  return NextResponse.json({ customer: normalizeCustomers([data])[0] })
}

// DELETE: 고객 삭제
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const { id } = await context.params

  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('owner_id')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: '고객 없음' }, { status: 404 })
  if (user.role === 'sales' && existing.owner_id !== user.id) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
