import { timingSafeEqual } from 'crypto'

// 마스터 비밀번호 / 마스터 PIN — 코드에 적지 않고 환경변수(MASTER_PASSWORD, MASTER_PIN)에서만 읽는다.
// 환경변수가 없으면 마스터 기능은 꺼진 상태(아무 값도 통과하지 않음)로 동작한다.
function same(a: string, b: string): boolean {
  if (!a || !b) return false
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export function isMasterPassword(input: unknown): boolean {
  return typeof input === 'string' && same(input, process.env.MASTER_PASSWORD || '')
}

export function isMasterPin(input: unknown): boolean {
  return typeof input === 'string' && same(input, process.env.MASTER_PIN || '')
}
