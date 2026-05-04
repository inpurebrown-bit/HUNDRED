/**
 * 한국 영업일 계산 유틸
 * - 토·일 제외
 * - 법정 공휴일 제외 (대체공휴일 포함)
 */

// yyyy-MM-dd 형식의 공휴일 목록
const KR_HOLIDAYS = new Set<string>([
  // ───────── 2025 ─────────
  '2025-01-01', // 신정
  '2025-01-28', // 설날 연휴
  '2025-01-29', // 설날
  '2025-01-30', // 설날 연휴
  '2025-03-01', // 삼일절
  '2025-05-05', // 어린이날 / 부처님오신날 겹침
  '2025-05-06', // 대체공휴일 (어린이날)
  '2025-06-06', // 현충일
  '2025-08-15', // 광복절
  '2025-10-03', // 개천절
  '2025-10-05', // 추석 연휴
  '2025-10-06', // 추석
  '2025-10-07', // 추석 연휴
  '2025-10-08', // 대체공휴일 (추석 연휴 일요일)
  '2025-10-09', // 한글날
  '2025-12-25', // 크리스마스

  // ───────── 2026 ─────────
  '2026-01-01', // 신정
  '2026-02-16', // 설날 연휴
  '2026-02-17', // 설날
  '2026-02-18', // 설날 연휴
  '2026-03-01', // 삼일절
  '2026-03-02', // 대체공휴일 (삼일절 일요일)
  '2026-05-05', // 어린이날
  '2026-05-24', // 부처님오신날 (음력 4월 8일)
  '2026-05-25', // 대체공휴일 (부처님오신날 일요일)
  '2026-06-06', // 현충일
  '2026-08-15', // 광복절
  '2026-09-24', // 추석 연휴
  '2026-09-25', // 추석
  '2026-09-26', // 추석 연휴
  '2026-10-03', // 개천절
  '2026-10-05', // 대체공휴일 (개천절 토요일)
  '2026-10-09', // 한글날
  '2026-12-25', // 크리스마스

  // ───────── 2027 ─────────
  '2027-01-01', // 신정
  '2027-02-06', // 설날 연휴
  '2027-02-07', // 설날
  '2027-02-08', // 설날 연휴
  '2027-02-09', // 대체공휴일 (설날 연휴 토요일)
  '2027-03-01', // 삼일절
  '2027-05-05', // 어린이날
  '2027-05-13', // 부처님오신날 (음력 4월 8일)
  '2027-06-06', // 현충일
  '2027-08-15', // 광복절
  '2027-08-16', // 대체공휴일 (광복절 일요일)
  '2027-10-03', // 개천절
  '2027-10-04', // 추석 연휴
  '2027-10-05', // 추석
  '2027-10-06', // 추석 연휴
  '2027-10-09', // 한글날
  '2027-12-25', // 크리스마스
  '2027-12-27', // 대체공휴일 (크리스마스 토요일)
])

/** 해당 날짜가 영업일인지 여부 */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay() // 0=일, 6=토
  if (day === 0 || day === 6) return false
  const key = formatDate(date)
  return !KR_HOLIDAYS.has(key)
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 해당 월의 총 영업일 수
 * @param year  4자리 연도
 * @param month 0-indexed (0=1월)
 */
export function getBusinessDaysInMonth(year: number, month: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let d = 1; d <= lastDay; d++) {
    if (isBusinessDay(new Date(year, month, d))) count++
  }
  return count
}

/**
 * 해당 월에서 1일 ~ today(포함)까지 경과한 영업일 수
 */
export function getElapsedBusinessDays(year: number, month: number, today: number): number {
  let count = 0
  for (let d = 1; d <= today; d++) {
    if (isBusinessDay(new Date(year, month, d))) count++
  }
  return count
}

/**
 * 해당 월에서 today(포함) ~ 마지막 날까지 남은 영업일 수
 */
export function getRemainingBusinessDays(year: number, month: number, today: number): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  let count = 0
  for (let d = today; d <= lastDay; d++) {
    if (isBusinessDay(new Date(year, month, d))) count++
  }
  return count
}
