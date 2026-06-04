import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/pushNotify'

// 프론트 alias → DB 컬럼명 변환
function toDbPatch(body: Record<string, any>) {
  const patch: Record<string, any> = {}
  const ALLOWED = [
    'customer_name','phone','institution','institution_type','solution',
    'memo','revenue','visit_date','script_delivered','next_plan',
    'required_checks','fund_solution','tax_invoice_requested',
    'is_refund','is_completed','approved_amount','commission_amount','owner_id',
    // 신규 필드
    'timeline','institution_credentials','deposit_date',
    'contract_fee','paid_amount','invoice_issued','payment_cash','payment_card',
    'absorbed','sojin_cert_youth','sojin_cert_general','sojin_cert_disabled',
    'concurrent_institutions','contract_notes','customer_type','commission_rate',
    'stage',
    'details', 'customer_id',
  ]
  for (const k of ALLOWED) {
    if (body[k] !== undefined) patch[k] = body[k]
  }
  // 프론트 alias 처리
  if (body.progress_stage !== undefined) {
    patch.stage = body.progress_stage
    // stage 변경 시 is_refund / is_completed 플래그 자동 동기화
    const s = body.progress_stage
    const isRefundStage    = s === '환불' || s === 'refunded'
    const isCompletedStage = s === '종료' || s === '완료' || s === 'completed'
    patch.is_refund    = isRefundStage
    patch.is_completed = isCompletedStage
  }
  if (body.progress_memo  !== undefined) patch.memo  = body.progress_memo
  if (body.stage          !== undefined) {
    patch.stage = body.stage
    const s = body.stage
    const isRefundStage    = s === '환불' || s === 'refunded'
    const isCompletedStage = s === '종료' || s === '완료' || s === 'completed'
    patch.is_refund    = isRefundStage
    patch.is_completed = isCompletedStage
  }
  return patch
}

// PATCH: 케이스 진행현황 업데이트
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const body = await req.json()
  const { id } = await context.params

  // 권한 확인
  const { data: existing } = await supabaseAdmin
    .from('ops_cases')
    .select('owner_id, ops_user_name, stage, customer_name')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: '케이스 없음' }, { status: 404 })
  // ops 직원은 본인 케이스(owner_id 또는 ops_user_name 매칭) 또는 미배정 케이스만 수정 가능
  if (user.role === 'ops') {
    const myId   = String(user.id).trim()
    const myName = (user.name || '').trim()
    const isOwnerById   = existing.owner_id != null && String(existing.owner_id).trim() === myId
    const isOwnerByName = existing.ops_user_name && existing.ops_user_name.trim() === myName
    const isUnassigned  = existing.owner_id == null && !existing.ops_user_name
    if (!isOwnerById && !isOwnerByName && !isUnassigned) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }
  }

  const patch = toDbPatch(body)
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '수정할 필드 없음' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('ops_cases')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 자금 승인 시 대표에게 푸시 알림
  const newStage = patch.stage
  if (newStage === '승인' && existing.stage !== '승인') {
    const caseName = existing.customer_name || '업체'
    await sendPushNotification({
      title: '🎉 자금 승인',
      body: `${caseName} 승인이 완료되었습니다.`,
      url: '/dashboard',
      tag: 'approval',
      target: 'ceo',
    })
  }

  return NextResponse.json({ case: { ...data, progress_stage: data.stage, progress_memo: data.memo } })
}
