// PIN 인증 상태 (세션 스토리지) — 로그인 화면과 PinGate가 공유
export const PIN_KEY = 'pin_verified'
export const ACTIVITY_KEY = 'pin_last_activity'
export const USER_KEY = 'pin_user_id'
export const INACTIVITY_LIMIT = 30 * 60 * 1000

export function getPinUserId(): string | null {
  try { return sessionStorage.getItem(USER_KEY) } catch { return null }
}
export function isPinVerified(userId: string): boolean {
  try { return sessionStorage.getItem(PIN_KEY) === '1' && sessionStorage.getItem(USER_KEY) === userId } catch { return false }
}
export function isActivityFresh(): boolean {
  try {
    const ts = sessionStorage.getItem(ACTIVITY_KEY)
    return !!ts && Date.now() - Number(ts) < INACTIVITY_LIMIT
  } catch { return false }
}
export function markPinVerified(userId: string) {
  try {
    sessionStorage.setItem(PIN_KEY, '1')
    sessionStorage.setItem(USER_KEY, userId)
    sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()))
  } catch {}
}
export function bumpActivity() {
  try { sessionStorage.setItem(ACTIVITY_KEY, String(Date.now())) } catch {}
}
export function clearPin() {
  try {
    sessionStorage.removeItem(PIN_KEY)
    sessionStorage.removeItem(USER_KEY)
    sessionStorage.removeItem(ACTIVITY_KEY)
  } catch {}
}
