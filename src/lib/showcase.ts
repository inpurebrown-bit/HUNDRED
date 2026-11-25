// 홈페이지의 인증 예시·현장·구성원·후기 자료. 빈 목록은 화면에 나오지 않는다.

const P = '/images/portfolio/'

// 인증 "예시": 어떤 인증을 준비할 수 있는지 보여 주는 견본이다. 당사 지원 실적으로 표시하지 않는다.
// 업체명·이름·번호·주소·문서번호·QR 은 가린 이미지만 올린다.
export const CERT_EXAMPLES = [
  { img: P + 'ex-venture.jpg', title: '벤처기업 확인' },
  { img: P + 'ex-plaque-venture.jpg', title: '혁신성장형 벤처기업 명패' },
  { img: P + 'ex-innobiz.jpg', title: '이노비즈 확인' },
  { img: P + 'ex-plaque-innobiz.jpg', title: '이노비즈 명패' },
  { img: P + 'ex-mainbiz.jpg', title: '메인비즈 확인' },
  { img: P + 'ex-plaque-mainbiz.jpg', title: '메인비즈 명패' },
  { img: P + 'ex-lab.jpg', title: '기업부설연구소 인정' },
  { img: P + 'ex-plaque-lab.jpg', title: '기업부설연구소 명패' },
  { img: P + 'cert-rnd.jpg', title: '연구개발전담부서 인정' },
  { img: P + 'ex-startup.jpg', title: '창업기업 확인' },
  { img: P + 'cert-women.jpg', title: '여성기업 확인' },
  { img: P + 'cert-sme.jpg', title: '중소기업(소상공인) 확인' },
]

export const SITE_PHOTOS = [
  { img: P + 'site-factory.jpg', label: '금속 가공 공장' },
  { img: P + 'site-clinic.jpg', label: '병·의원 시술실' },
  { img: P + 'site-market.jpg', label: '마트·유통 매장' },
  { img: P + 'site-restaurant.jpg', label: '음식점' },
  { img: P + 'site-machine.jpg', label: '자동화 가공 설비' },
  { img: P + 'site-kitchen.jpg', label: '식품 작업장' },
  { img: P + 'site-plant.jpg', label: '설비 제작 현장' },
  { img: P + 'site-welding.jpg', label: '용접 자동화 공정' },
  { img: P + 'site-fashion.jpg', label: '의류 작업실' },
  { img: P + 'site-electric.jpg', label: '전기자재 작업장' },
  { img: P + 'site-logistics.jpg', label: '물류 작업장' },
  { img: P + 'site-workshop.jpg', label: '야외 작업장' },
]

// 직원 사진
export const TEAM: { img: string; label: string }[] = [
  { img: P + 'team-meeting.jpg', label: '팀 교육·회의' },
  { img: P + 'team-dinner.jpg', label: '함께하는 저녁' },
]

// 고객 후기. 실제 고객이 남긴 말이고 공개에 동의한 것만 넣는다. 이름은 "이*영 대표님" 처럼 가린다.
// 예: { name: '이*영 대표님', industry: '제조업', text: '고객이 실제로 한 말' }
export const REVIEWS: { name: string; industry: string; text: string }[] = []
