/** 시험용(테스터) 계정 판별 — 이름이나 아이디에 tester/테스터가 들어가면 모든 현황·집계에서 뺀다 */
export const isTester = (...parts: (string | null | undefined)[]) => /tester|테스터/i.test(parts.filter(Boolean).join(' '))
