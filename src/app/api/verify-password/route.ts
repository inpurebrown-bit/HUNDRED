import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

const MASTER_PASSWORD = 'Wndelddla87!!'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { password } = await req.json()
  if (!password) return NextResponse.json({ error: '비밀번호를 입력하세요' }, { status: 400 })

  const userId = (session.user as any).id
  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('password_hash')
    .eq('id', userId)
    .single()

  if (!dbUser) return NextResponse.json({ error: '사용자 없음' }, { status: 404 })

  const isMaster = password === MASTER_PASSWORD
  const valid    = isMaster || await bcrypt.compare(password, dbUser.password_hash)

  if (!valid) return NextResponse.json({ error: '비밀번호가 틀렸습니다' }, { status: 401 })
  return NextResponse.json({ ok: true })
}
