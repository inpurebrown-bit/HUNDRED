// 홈페이지 푸터·약관에 표시되는 사업자 정보. 빈 문자열('')인 항목은 화면에 표시되지 않습니다.
// 값이 확정되면 아래를 채워 주세요.
export const COMPANY = {
  brand: 'HUNDRED CONSULTING',
  brandKo: '헌드레드컨설팅',
  legalName: '',             // 상호(법인명) 예: 주식회사 헌드레드
  ceo: '백승협',
  bizNo: '533-36-01551',     // 사업자등록번호
  commerceNo: '',            // 통신판매업 신고번호 (해당 시)
  telemarketingNo: '신고완료',    // 전화권유판매업 (신고번호를 받으면 예: '제0000-서울구로-0000호 (신고완료)' 로 교체)
  address: '서울특별시 구로구 디지털로 243 지하이시티 911호',
  phone: '1844-2599',
  phoneHref: 'tel:18442599',
  email: '100-house@naver.com',
  hours: '평일 09:00 – 18:00 (토/일·공휴일 휴무)',
  privacyOfficer: '',        // 개인정보 보호책임자 성명/직책
  privacyContact: '',        // 개인정보 보호책임자 연락처(이메일/전화). 비우면 대표 연락처 사용
} as const

export const LEGAL_VERSION = '2026-09-29'
// 상담 종료 후 개인정보 보유 기간(개월) — 약관 문구에 사용
export const RETENTION_MONTHS = 12

// 대표 인사 영상. public/videos/ 에 mp4를 넣고 src에 '/videos/파일명.mp4' 를 적으면 홈페이지에 꽉 찬 영상 섹션이 나타납니다.
export const HOME_VIDEO = {
  src: '',            // 예: '/videos/ceo-intro.mp4'
  poster: '',         // 예: '/videos/ceo-intro.jpg' (선택)
  label: 'CEO MESSAGE',
  title: '대표가 직접 전하는 헌드레드컨설팅 이야기',
}
