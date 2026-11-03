import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assignProspect, queueAssign, cancelQueue } from '@/lib/digAssign'

// POST { ids, assigned_to, assigned_to_name, mode: 'schedule' | 'now' } — 체크한 승인 건을 한 번에 배정(예약/즉시)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { ids, assigned_to, assigned_to_name, mode } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0 || !assigned_to) return NextResponse.json({ error: '대상과 직원을 선택해주세요' }, { status: 400 })
  const actor = { name: user.name, role: user.role }
  if (mode === 'now') {
    let ok = 0
    const failed: string[] = []
    for (const id of ids) {
      const r = await assignProspect(id, assigned_to, assigned_to_name || '', actor)
      if (r.ok) { ok++; await cancelQueue(id) } else failed.push(id)
    }
    return NextResponse.json({ ok, failed })
  }
  const release_at = await queueAssign(ids, assigned_to, assigned_to_name || '', actor)
  return NextResponse.json({ ok: ids.length, release_at })
}
