import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: 공개 - 활성 공지사항 조회 (인증 불필요)
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

// POST: CEO only - 공지사항 등록
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const {
    title,
    content,
    notice_type,
    target_team,
    is_active,
    start_date,
    end_date,
  } = body

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
  return NextResponse.json({ notice: data }, { status: 201 })
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

  const { error } = await supabaseAdmin
    .from('notices')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
