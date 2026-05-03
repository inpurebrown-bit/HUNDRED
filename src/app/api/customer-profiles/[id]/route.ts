import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// GET: customer_id로 프로필 조회
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await context.params

  const { data, error } = await supabaseAdmin
    .from('customer_profiles')
    .select('*')
    .eq('customer_id', id)
    .single()

  if (error) return NextResponse.json({ profile: null })
  return NextResponse.json({ profile: data })
}

// PATCH: 고객 프로필 업데이트 - params.id는 customer_id (UUID)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { id } = await context.params
  const body = await req.json()

  const { data, error } = await supabaseAdmin
    .from('customer_profiles')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq('customer_id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
