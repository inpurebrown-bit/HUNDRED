import { NextRequest, NextResponse } from 'next/server'
import { randomInt, randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { sendPushNotification } from '@/lib/pushNotify'
import { lockedSeconds, recordFail, clientIp } from '@/lib/loginGuard'

// 아이디/비밀번호 찾기 — 코드 발급 방식
//  1) 직원이 로그인 화면에서 '코드 요청' 버튼만 누른다(개인정보 입력 없음).
//  2) 대표가 대표 대시보드 '코드 요청' 탭에서 코드를 확인해 직원에게 직접 전달한다.
//  3) 직원이 코드를 입력해야 비로소 이름·연락처 입력칸이 열리고, 코드+이름이 모두 맞아야
//     아이디 확인 / 비밀번호 재설정이 된다.
// 코드는 30분 유효·1회용·5회 오입력 시 폐기. 계정 존재 여부는 응답으로 알 수 없다.
const KEY = 'auth_codes'
const TTL_MS = 30 * 60 * 1000
type Item = {
  id: string; at: string; exp: number; type: 'id' | 'pw'; code: string; tries: number; used: boolean; ip: string
  by?: { name: string; phone: string; username: string; at: string } // 사용한 사람
  last_try?: string // 마지막으로 입력된 이름(오입력 확인용)
}

async function loadItems(): Promise<Item[]> {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', KEY).single()
  return ((data?.value as any)?.items || []) as Item[]
}
async function saveItems(items: Item[]) {
  await supabaseAdmin.from('settings').upsert({ key: KEY, value: { items: items.slice(0, 60) } }, { onConflict: 'key' })
}
const norm = (s: any) => String(s || '').replace(/\s/g, '')

// 대표 전용: 코드 요청 목록
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const now = Date.now()
  const items = (await loadItems()).map(i => ({ ...i, expired: i.exp < now }))
  return NextResponse.json({ items })
}

// 대표 전용: 요청 삭제 / 코드 폐기
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any).role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const id = req.nextUrl.searchParams.get('id')
  const items = (await loadItems()).filter(i => i.id !== id)
  await saveItems(items)
  return NextResponse.json({ ok: true })
}

// 공개: 코드 요청(action='request') / 코드 확인(action='check') / 본인 확인·처리(action='verify')
export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers)
  let b: any
  try { b = await req.json() } catch { return NextResponse.json({ error: '잘못된 요청' }, { status: 400 }) }
  const type: 'id' | 'pw' = b.type === 'id' ? 'id' : 'pw'
  const BAD = '코드가 올바르지 않거나 만료되었습니다.'
  const bad = (msg = BAD, status = 400) => NextResponse.json({ error: msg }, { status })

  // ── 코드 요청 (입력 정보 없음) ──
  if (b.action === 'request') {
    const generic = NextResponse.json({ ok: true, message: '코드 요청이 접수되었습니다. 대표님께 연락해 코드를 받아 입력해 주세요. (코드는 30분간 유효)' })
    if (b.website || (typeof b.t === 'number' && Date.now() - b.t < 2000)) return generic // 봇 차단
    const gk = [`help:${ip}`]
    if (await lockedSeconds(gk) > 0) return bad('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429)
    await recordFail(gk, 3, 60) // IP당 시간당 3건

    const now = Date.now()
    const items = (await loadItems()).filter(i => i.exp > now - 24 * 3600 * 1000)
    // 대기 중(미사용·유효) 요청은 최대 10건
    if (items.filter(i => !i.used && i.exp > now && i.tries < 5).length >= 10) return bad('대기 중인 요청이 많습니다. 잠시 후 다시 시도해 주세요.', 429)
    const code = String(randomInt(0, 1000000)).padStart(6, '0')
    items.unshift({ id: randomUUID(), at: new Date().toISOString(), exp: now + TTL_MS, type, code, tries: 0, used: false, ip })
    await saveItems(items)

    await sendPushNotification({
      title: `🔐 ${type === 'id' ? '아이디 찾기' : '비밀번호 재설정'} 코드 요청`,
      body: "누군가 코드를 요청했습니다. 대표 대시보드 '코드 요청' 탭에서 확인 후, 본인이 맞으면 코드를 알려주세요.",
      url: '/dashboard', tag: 'auth-help', target: 'ceo',
    })
    return generic
  }

  // ── 코드 확인 / 본인 확인·처리 ──
  if (b.action === 'check' || b.action === 'verify') {
    const gk = [`verify:${ip}`]
    if (await lockedSeconds(gk) > 0) return bad('시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.', 429)
    const code = norm(b.code)
    if (!/^\d{6}$/.test(code)) { await recordFail(gk, 10, 15); return bad() }

    const items = await loadItems()
    const now = Date.now()
    const it = items.find(i => i.code === code && i.type === type && !i.used && i.exp > now && i.tries < 5)
    if (!it) { await recordFail(gk, 10, 15); return bad() }

    if (b.action === 'check') return NextResponse.json({ ok: true }) // 코드가 맞으면 이름·연락처 입력칸을 연다

    // verify: 이름·연락처까지 받아서 직원 본인 확인
    const name = String(b.name || '').trim().slice(0, 20)
    const phone = String(b.phone || '').replace(/[^0-9]/g, '').slice(0, 11)
    const fail = async (msg: string) => {
      it.tries += 1; it.last_try = name
      await saveItems(items)
      await recordFail(gk, 10, 15)
      return bad(it.tries >= 5 ? '오입력 5회로 코드가 폐기되었습니다. 코드를 다시 요청해 주세요.' : msg)
    }
    if (!name || phone.length < 10) return bad('이름과 연락처를 정확히 입력해 주세요.')

    const { data: us } = await supabaseAdmin.from('users').select('id, username, role, blocked').eq('name', name)
    const cand = (us || []).filter((u: any) => u.role !== 'ceo' && !u.blocked)
    if (cand.length !== 1) return fail(cand.length > 1 ? '동명이인이 있어 처리할 수 없습니다. 대표님께 문의해 주세요.' : '이름이 일치하는 직원이 없습니다.')
    const u = cand[0]

    if (type === 'pw') {
      const pw = String(b.newPassword || '')
      if (pw.length < 6) return bad('새 비밀번호는 6자 이상이어야 합니다.')
      await supabaseAdmin.from('users').update({ password_hash: await bcrypt.hash(pw, 10) }).eq('id', u.id)
    }
    it.used = true
    it.by = { name, phone, username: u.username, at: new Date().toISOString() }
    await saveItems(items)
    return NextResponse.json({ ok: true, username: u.username })
  }

  return bad('잘못된 요청')
}
