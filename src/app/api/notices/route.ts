import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

export const dynamic = 'force-dynamic'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/pushNotify'

// GET: 공개 - 활성 공지사항 조회
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const team = searchParams.get('team')

  const baseQuery = supabaseAdmin
    .from('notices')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  const { data, error } = await (team && team !== 'all'
    ? baseQuery.in('target_team', [team, 'all'])
    : baseQuery)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ notices: data })
}

// POST: CEO only - 공지사항 등록 + 직원 푸시 알림
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const { title, content, notice_type, target_team, is_active, start_date, end_date } = body

  if (!title) return NextResponse.json({ error: '제목은 필수입니다' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('notices')
    .insert({
      title,
      content: content || '',
      notice_type: notice_type || 'general',
      target_team: target_team || 'all',
      is_active: is_active ?? true,
      start_date: start_date || null,
      end_date: end_date || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 공지 유형이 supply_count가 아닐 때만 푸시 알림 발송
  if (notice_type !== 'supply_count') {
    const pushTarget = target_team === 'sales' ? 'sales'
      : target_team === 'ops' ? 'ops'
      : 'employees' // all → 전 직원

    await sendPushNotification({
      title: '📢 새 공지사항',
      body: title,
      url: '/',
      tag: 'notice',
      target: pushTarget,
    })
  }

  return NextResponse.json({ notice: data }, { status: 201 })
}

// PATCH: CEO only - ?id= 쿼리 파라미터 + body로 수정
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id는 필수입니다' }, { status: 400 })

  const body = await req.json()
  const { title, content, notice_type, target_team, is_active, start_date, end_date } = body

  const updateData: Record<string, any> = {}
  if (title !== undefined) updateData.title = title
  if (content !== undefined) updateData.content = content
  if (notice_type !== undefined) updateData.notice_type = notice_type
  if (target_team !== undefined) updateData.target_team = target_team
  if (is_active !== undefined) updateData.is_active = is_active
  if (start_date !== undefined) updateData.start_date = start_date
  if (end_date !== undefined) updateData.end_date = end_date

  const { data, error } = await supabaseAdmin
    .from('notices')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 공지사항 수정 시 직원들에게 푸시 알림
  const noticeTitle = title || data?.title || ''
  if (noticeTitle && notice_type !== 'supply_count') {
    const resolvedTargetTeam = target_team || data?.target_team
    const pushTarget = resolvedTargetTeam === 'sales' ? 'sales'
      : resolvedTargetTeam === 'ops' ? 'ops'
      : 'employees'

    await sendPushNotification({
      title: '📢 공지사항',
      body: `새 공지사항: ${noticeTitle}`,
      url: '/dashboard',
      tag: 'notice',
      target: pushTarget,
    })
  }

  return NextResponse.json({ notice: data })
}

// DELETE: CEO only - ?id= 쿼리 파라미터 필요
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id는 필수입니다' }, { status: 400 })

  const { error } = await supabaseAdmin.from('notices').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
