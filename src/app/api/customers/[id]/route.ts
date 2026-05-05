import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/pushNotify'

// PATCH: 고객 정보 수정
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const body = await req.json()
  const { id } = await context.params

  // 본인 고객만 수정 가능 (ceo는 모두 가능)
  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('sales_user_id, status, name, company')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: '고객 없음' }, { status: 404 })
  if (user.role === 'sales' && existing.sales_user_id !== user.id) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 계약 완료로 상태 변경 시 대표에게 푸시 알림
  if (body.status === 'contracted' && existing.status !== 'contracted') {
    const customerName = existing.company || existing.name || '고객'
    await sendPushNotification({
      title: '🎉 계약 완료!',
      body: `${customerName} — ${user.name || '영업팀'}이(가) 계약을 완료했습니다.`,
      url: '/',
      tag: 'contract',
      target: 'ceo',
    })
  }

  return NextResponse.json({ customer: data })
}

// DELETE: 고객 삭제
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const { id } = await context.params

  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('sales_user_id')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: '고객 없음' }, { status: 404 })
  if (user.role === 'sales' && existing.sales_user_id !== user.id) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
