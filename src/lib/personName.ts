// 사람은 이름으로 구분한다 — 직함(수석팀장·팀장·실장 등)은 시기에 따라 바뀌는 꼬리표라서 이름 비교·묶기·저장에서 뺀다.
// 예: '손제후 수석팀장' = '손제후', '김윤지 수석팀장'(영업 시절) = '김윤지 실장'(지금 관리팀) = '김윤지'
// 직함은 이름 뒤에 띄어 쓴 경우만 뗀다 ('관리팀장'처럼 직책 자체가 이름 칸에 들어간 값은 그대로 둔다).
const TITLES = '수석팀장|관리실장|팀장|실장|팀원|대리|과장|부장|차장|이사|수석|매니저|주임|사원'
const TITLE_TAIL = new RegExp(`\s+(?:${TITLES}).*$`)

export const baseName = (n: unknown): string => String(n ?? '').replace(TITLE_TAIL, '').trim()
export const sameName = (a: unknown, b: unknown): boolean => {
  const x = baseName(a)
  return x !== '' && x === baseName(b)
}
