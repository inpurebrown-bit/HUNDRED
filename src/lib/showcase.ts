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

// 직원 사진: 사진 한 장 옆에 글을 붙여 한 줄씩 보여 준다
export const TEAM: { img: string; kicker: string; title: string; body: string[] }[] = [
  {
    img: P + 'team-meeting.jpg', kicker: 'STUDY & MEETING', title: '같은 기준으로 말하기 위해, 함께 공부합니다',
    body: [
      '정책자금과 인증의 기준은 자주 바뀝니다. 그래서 한 사람의 감이 아니라 팀이 함께 확인한 내용으로 상담하려고 합니다.',
      '바뀐 공고를 나누고, 어려웠던 상담을 같이 되짚으며, 대표님께 드리는 설명이 담당자마다 달라지지 않도록 맞춰 갑니다.',
      '가능한 것은 근거를 들어, 어려운 것은 어렵다고 솔직하게 말씀드리는 것이 우리가 지키려는 기준입니다.',
    ],
  },
  {
    img: P + 'team-dinner.jpg', kicker: 'TOGETHER', title: '함께 뛰고, 함께 먹으며 한 팀이 됩니다',
    body: [
      '단체 체육대회를 마치고 모인 저녁 자리입니다. 같이 땀 흘린 하루는 회의실에서 쌓기 어려운 믿음을 만들어 줍니다.',
      '서로를 믿는 팀은 일을 미루지 않고, 막힌 건이 있으면 먼저 손을 내밉니다. 한 업체를 한 사람이 아니라 팀이 함께 챙기는 이유입니다.',
      '구성원이 오래 함께하는 회사여야 대표님의 다음 단계도 끝까지 곁에서 볼 수 있다고 믿습니다.',
    ],
  },
]

// 고객 후기. 실제 고객이 남긴 말이고 공개에 동의한 것만 넣는다. 이름은 "이*영 대표님" 처럼 가린다.
// 예: { name: '이*영 대표님', industry: '제조업', text: '고객이 실제로 한 말' }
export const REVIEWS: { name: string; industry: string; text: string }[] = []
