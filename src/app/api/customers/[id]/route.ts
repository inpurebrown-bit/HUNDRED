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
  // call_timeline: 인콜 타임라인 (직접 컬럼으로 저장)
  if (body.call_timeline !== undefined) updateBody.call_timeline = body.call_timeline

  // details JSONB 머지 (company/sales_user_name 포함)
  // ⚡ 수정: updateBody.details(status 처리 결과)를 베이스로 사용해야 sub_status가 유실되지 않음
  if (body.details || body.company || body.sales_user_name) {
    const incomingDetails: Record<string, any> = { ...(body.details || {}) }
    if (body.company !== undefined) incomingDetails.company = body.company
    if (body.sales_user_name !== undefined) incomingDetails.sales_user_name = body.sales_user_name
    updateBody.details = { ...(updateBody.details || existing.details || {}), ...incomingDetails }
  }

  // ⚡ 안전장치: 계약 상태인 고객에 sub_status가 끼어들지 않도록 강제 제거
  // (프론트 state에 stale sub_status가 남아있을 때 재기입 방지)
  const finalStatus = updateBody.status ?? existing.status
  if (finalStatus === 'contracted' && updateBody.details) {
    delete updateBody.details.sub_status
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .update(updateBody)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const customerName = existing.details?.company || existing.name || '고객'

  // 계약 완료로 상태 변경 시 대표에게 푸시 알림
  if (body.status === 'contracted' && existing.status !== 'contracted') {
    await sendPushNotification({
      title: '✅ 계약 완료',
      body: `${customerName} 계약이 완료되었습니다.`,
      url: '/dashboard',
      tag: 'contract',
      target: 'ceo',
    })
  }

  // 담당 영업직원 조회 헬퍼 (이름 → user_id)
  const salesUserName = (updateBody.details ?? (existing.details as any))?.sales_user_name
  async function getSalesUserId(): Promise<string | null> {
    if (!salesUserName) return null
    const { data: su } = await supabaseAdmin.from('users').select('id').eq('name', salesUserName).maybeSingle()
    return su?.id ?? null
  }

  // 심사 요청 시 대표에게 푸시 알림
  const prevInspectionStatus = (existing.details as any)?.inspection_status
  const newInspectionStatus = body.details?.inspection_status
  if (newInspectionStatus === 'pending' && prevInspectionStatus !== 'pending') {
    await sendPushNotification({
      title: '🔍 심사 요청',
      body: `${customerName} 심사 요청이 접수되었습니다.`,
      url: '/dashboard',
      tag: 'inspection',
      target: 'ceo',
    })
  }
  // 심사 완료(승인/반려) 시 영업직원에게 알림
  if ((newInspectionStatus === 'approved' || newInspectionStatus === 'rejected') && prevInspectionStatus !== newInspectionStatus) {
    const salesUid = await getSalesUserId()
    const resultLabel = newInspectionStatus === 'approved' ? '✅ 심사완료' : '❌ 심사반려'
    await sendPushNotification({
      title: resultLabel,
      body: `${customerName} 심사가 ${newInspectionStatus === 'approved' ? '완료' : '반려'}되었습니다.`,
      url: '/dashboard',
      tag: 'inspection-result',
      target: salesUid ?? 'sales',
    })
  }

  // A/S 요청 시 대표에게 푸시 알림
  const prevAsRequested = (existing.details as any)?.as_requested
  const newAsRequested = body.details?.as_requested
  if (newAsRequested === true && !prevAsRequested) {
    await sendPushNotification({
      title: '🔧 A/S 요청',
      body: `${customerName} A/S 요청이 접수되었습니다.`,
      url: '/dashboard',
      tag: 'as-request',
      target: 'ceo',
    })
  }
  // A/S 완료 → 영업직원에게 알림 (DB 쓰레기통 이동됨)
  const prevAsApproved = (existing.details as any)?.as_approved
  const newAsApproved = body.details?.as_approved
  if (newAsApproved === true && !prevAsApproved) {
    const salesUid = await getSalesUserId()
    await sendPushNotification({
      title: '♻️ A/S완료 처리',
      body: `${customerName} A/S가 완료되어 DB쓰레기통으로 이동되었습니다.`,
      url: '/dashboard',
      tag: 'as-complete',
      target: salesUid ?? 'sales',
    })
  }
  // A/S 비해당 → 영업직원에게 알림
  const prevAsNotApplicable = (existing.details as any)?.as_not_applicable
  const newAsNotApplicable = body.details?.as_not_applicable
  if (newAsNotApplicable === true && !prevAsNotApplicable) {
    const salesUid = await getSalesUserId()
    await sendPushNotification({
      title: '⛔ A/S비해당',
      body: `${customerName} A/S 비해당 처리되었습니다.`,
      url: '/dashboard',
      tag: 'as-not-applicable',
      target: salesUid ?? 'sales',
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

  // 영업팀·관리팀은 soft-delete(trash 상태)만 허용 — 대표만 진짜 삭제 가능
  if (user.role !== 'ceo') {
    // ⚡ sub_status도 반드시 'trash'로 업데이트해야 normalizeCustomer가 올바르게 'trash'로 인식
    const existingDetails = existing ? (existing as any).details || {} : {}
    const { error: patchErr } = await supabaseAdmin
      .from('customers')
      .update({
        status: 'active',
        details: { ...existingDetails, sub_status: 'trash' },
      })
      .eq('id', id)
    if (patchErr) return NextResponse.json({ error: patchErr.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
