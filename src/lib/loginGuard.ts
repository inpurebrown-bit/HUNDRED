import { supabaseAdmin } from './supabase'

// 로그인·찾기 요청 시도 제한 — settings 테이블(key='login_guard')에 저장
// entries[키] = { n: 실패 횟수, first: 첫 실패 시각, until: 잠금 해제 시각 }
type Entry = { n: number; first: number; until?: number }
const KEY = 'login_guard'
const WINDOW_MS = 15 * 60 * 1000

async function load(): Promise<Record<string, Entry>> {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', KEY).single()
  const e = (data?.value as any)?.entries || {}
  const now = Date.now()
  for (const k of Object.keys(e)) if ((e[k].until || e[k].first + WINDOW_MS) < now) delete e[k]
  return e
}
async function save(entries: Record<string, Entry>) {
  await supabaseAdmin.from('settings').upsert({ key: KEY, value: { entries } }, { onConflict: 'key' })
}

/** 잠금 여부 확인 (남은 초 반환, 0이면 통과) */
export async function lockedSeconds(keys: string[]): Promise<number> {
  try {
    const e = await load()
    const now = Date.now()
    return Math.max(0, ...keys.map(k => Math.ceil(((e[k]?.until || 0) - now) / 1000)))
  } catch { return 0 }
}

/** 실패 기록 — limit회 도달 시 lockMin분 잠금 */
export async function recordFail(keys: string[], limit = 5, lockMin = 15) {
  try {
    const e = await load()
    const now = Date.now()
    for (const k of keys) {
      const cur = e[k] && !(e[k].until && e[k].until < now) ? e[k] : { n: 0, first: now }
      cur.n += 1
      if (cur.n >= limit) cur.until = now + lockMin * 60 * 1000
      e[k] = cur
    }
    await save(e)
  } catch {}
}

export async function clearFail(keys: string[]) {
  try {
    const e = await load()
    let ch = false
    for (const k of keys) if (e[k]) { delete e[k]; ch = true }
    if (ch) await save(e)
  } catch {}
}

export function clientIp(headers: Headers | Record<string, any> | undefined): string {
  if (!headers) return 'unknown'
  const get = (n: string) => (headers instanceof Headers ? headers.get(n) : (headers as any)[n]) as string | null
  return (get('x-forwarded-for') || get('x-real-ip') || 'unknown').split(',')[0].trim()
}
