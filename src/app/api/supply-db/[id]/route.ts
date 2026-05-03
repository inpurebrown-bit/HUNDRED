import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { assign, assigned_user_id, assigned_user_name, ...rest } = body

    const updates: Record<string, any> = {
      ...rest,
      updated_at: new Date().toISOString(),
    }

    if (assign) {
      updates.assigned_user_id = assigned_user_id
      updates.assigned_user_name = assigned_user_name
      updates.status = 'assigned'
    }

    const { data, error } = await supabaseAdmin
      .from('supply_db')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return NextResponse.json({ error: '테이블이 존재하지 않습니다' }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ item: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    const { error } = await supabaseAdmin
      .from('supply_db')
      .delete()
      .eq('id', params.id)

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return NextResponse.json({ error: '테이블이 존재하지 않습니다' }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
