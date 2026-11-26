// 한국 시간 표시 — DB 시각(timestamptz)은 UTC 문자열이라 그대로 잘라 쓰면 9시간 늦게(이른 시각으로) 보인다.
// 보는 기기의 시간대와 상관없이 항상 한국(KST) 기준으로 바꿔서 돌려준다.
const shift = (iso?: string | null) => { const t = iso ? new Date(iso).getTime() : NaN; return Number.isNaN(t) ? null : new Date(t + 9 * 3600 * 1000).toISOString() }
/** 'HH:mm' */
export const kstHM = (iso?: string | null) => shift(iso)?.slice(11, 16) ?? ''
/** 'MM-DD HH:mm' */
export const kstMDHM = (iso?: string | null) => (shift(iso)?.slice(5, 16) ?? '').replace('T', ' ')
/** 'MM/DD' */
export const kstMD = (iso?: string | null) => (shift(iso)?.slice(5, 10) ?? '').replace('-', '/')
