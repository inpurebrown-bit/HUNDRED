import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const NOTICE_TYPE = 'supply_config'

// GET: 공급 설정 조회 (영업팀/대표 모두 가능)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('notices')
    .select('id, content')
    .eq('notice_type', NOTICE_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return NextResponse.json({ config: null, id: null })

  try {
    const config = JSON.parse(data.content || '{}')
    return NextResponse.json({ config, id: data.id })
  } catch {
    return NextResponse.json({ config: null, id: null })
  }
}

// PATCH: 공급 설정 저장 (대표만)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json()
  const content = JSON.stringify(body)

  const { data: existing } = await supabaseAdmin
    .from('notices')
    .select('id')
    .eq('notice_type', NOTICE_TYPE)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    await supabaseAdmin.from('notices').update({ content }).eq('id', existing.id)
  } else {
    await supabaseAdmin.from('notices').insert({
      title: 'supply_config',
      content,
      notice_type: NOTICE_TYPE,
      target_team: 'all',
      is_active: true,
    })
  }

  return NextResponse.json({ ok: true })
}
