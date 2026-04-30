import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  let query = supabaseAdmin
    .from('events')
    .select('*')
    .order('start_date', { ascending: true })

  if (year && month) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const end = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10)
    query = query.gte('start_date', start).lte('start_date', end)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ events: data })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const body = await req.json()
  const { title, start_date, end_date, start_time, end_time, description, color, is_allday } = body

  if (!title || !start_date) return NextResponse.json({ error: '제목과 날짜는 필수' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert({
      title,
      start_date,
      end_date: end_date || start_date,
      start_time: is_allday ? null : (start_time || null),
      end_time: is_allday ? null : (end_time || null),
      description: description || '',
      color: color || 'blue',
      is_allday: is_allday ?? true,
      source: 'local',
      created_by: user.name,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ event: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await req.json()
  const { error } = await supabaseAdmin.from('events').delete().eq('id', id).eq('source', 'local')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
