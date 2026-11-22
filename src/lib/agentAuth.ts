import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

// 주황이 전용 API 인증 — Authorization: Bearer <AGENT_TOKEN>. 토큰은 Vercel 환경변수(AGENT_TOKEN)와 주황이 PC 비공개 설정에만 있다.
export function agentGuard(req: NextRequest): NextResponse | null {
  const want = process.env.AGENT_TOKEN
  if (!want) return NextResponse.json({ error: '서버에 AGENT_TOKEN 이 설정되지 않았습니다' }, { status: 503 })
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()
  const a = Buffer.from(got), b = Buffer.from(want)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  return null
}

/** 비밀번호·PIN 처럼 보이는 키는 주황이에게 넘기지 않는다 */
export function scrub(v: any): any {
  if (Array.isArray(v)) return v.map(scrub)
  if (v && typeof v === 'object') {
    const out: Record<string, any> = {}
    for (const [k, val] of Object.entries(v)) {
      if (/pw|pass|비번|비밀번호|pin|secret|token/i.test(k)) continue
      out[k] = scrub(val)
    }
    return out
  }
  return v
}
