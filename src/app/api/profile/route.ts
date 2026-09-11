import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

const MASTER_PASSWORD = 'Wndelddla87!!'

async function getMyPayslipEntry(userId: string, userName: string) {
  const { data } = await supabaseAdmin
    .from('payslip_settings')
    .select('employees')
    .eq('id', 'default')
    .single()
  const employees: any[] = data?.employees || []
  return employees.find((e: any) => e.user_id === userId || e.name === userName) || {}
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('id, name, username, role')
    .eq('id', user.id)
    .single()

  if (!dbUser) return NextResponse.json({ error: '사용자 없음' }, { status: 404 })

  const entry = await getMyPayslipEntry(user.id, dbUser.name)

  return NextResponse.json({
    profile: {
      id: dbUser.id,
      name: dbUser.name || '',
      username: dbUser.username || '',
      role: dbUser.role || '',
      phone: entry.phone || '',
      address: entry.address || '',
      bank_account: entry.bank_account || '',
      bank_name: entry.bank_name || '카카오뱅크',
      join_date: entry.join_date || '',
    },
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const userId = (session.user as any).id
  const body = await req.json()
  const { name, currentPassword, newPassword, phone, address, bank_account, bank_name, join_date } = body

  const { data: dbUser } = await supabaseAdmin
    .from('users')
    .select('name, password_hash, role')
    .eq('id', userId)
    .single()
  if (!dbUser) return NextResponse.json({ error: '사용자 없음' }, { status: 404 })

  const userUpdates: Record<string, any> = {}

  // 비밀번호 변경
  if (newPassword) {
    if (!currentPassword) return NextResponse.json({ error: '현재 비밀번호를 입력하세요' }, { status: 400 })
    if (newPassword.length < 4) return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다' }, { status: 400 })
    const isMaster = currentPassword === MASTER_PASSWORD
    const valid = isMaster || await bcrypt.compare(currentPassword, dbUser.password_hash)
    if (!valid) return NextResponse.json({ error: '현재 비밀번호가 틀렸습니다' }, { status: 400 })
    userUpdates.password_hash = await bcrypt.hash(newPassword, 10)
  }

  // 이름 변경
  const newName = name?.trim() || null
  if (newName) userUpdates.name = newName

  if (Object.keys(userUpdates).length > 0) {
    await supabaseAdmin.from('users').update(userUpdates).eq('id', userId)
  }

  // payslip_settings.employees 동기화
  const { data: settingsRow } = await supabaseAdmin
    .from('payslip_settings')
    .select('*')
    .eq('id', 'default')
    .single()

  const currentName = dbUser.name
  const finalName = newName || currentName
  const roleTeam = dbUser.role === 'ops' ? 'ops' : dbUser.role === 'dig' ? 'dig' : 'sales'
  const employees: any[] = settingsRow?.employees || []
  const idx = employees.findIndex((e: any) => e.user_id === userId || e.name === currentName)
  const existing = idx >= 0 ? employees[idx] : { id: userId, team: roleTeam }

  // 이름 최초 설정 시 join_date 자동 세팅 (기존 이름 없거나 비어있을 때)
  const isFirstNameSet = newName && (!currentName || currentName.trim() === '')
  const autoJoinDate = isFirstNameSet && !existing.join_date
    ? new Date().toISOString().slice(0, 10)
    : undefined

  const merged = {
    ...existing,
    user_id: userId,
    name: finalName,
    phone: phone !== undefined ? phone : (existing.phone || ''),
    address: address !== undefined ? address : (existing.address || ''),
    bank_account: bank_account !== undefined ? bank_account : (existing.bank_account || ''),
    bank_name: bank_name !== undefined ? bank_name : (existing.bank_name || '카카오뱅크'),
    join_date: join_date !== undefined ? join_date : (autoJoinDate || existing.join_date || ''),
    team: existing.team || roleTeam,
  }
  const newEmployees = idx >= 0
    ? employees.map((e: any, i: number) => i === idx ? merged : e)
    : [...employees, merged]

  const base = settingsRow || { id: 'default' }
  await supabaseAdmin
    .from('payslip_settings')
    .upsert({ ...base, employees: newEmployees, updated_at: new Date().toISOString() }, { onConflict: 'id' })

  return NextResponse.json({ ok: true, name: finalName })
}
