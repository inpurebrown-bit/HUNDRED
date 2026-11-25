// 홈페이지 "지원 사례" 구역에 보여 줄 자료. 사실로 확인된 것만 넣는다. 빈 목록은 화면에 나오지 않는다.

// 헌드레드가 지원해 고객이 받은 확인서. 이름·번호·주소·문서번호·QR 은 가린 이미지만 올린다.
export const CERTS = [
  { img: '/images/portfolio/cert-rnd.jpg', title: '연구개발전담부서 인정', date: '2026.10', org: '한국산업기술진흥협회' },
  { img: '/images/portfolio/cert-women.jpg', title: '여성기업 확인', date: '2026.11', org: '경기지방중소벤처기업청' },
  { img: '/images/portfolio/cert-sme.jpg', title: '중소기업(소상공인) 확인', date: '2026.08', org: '중소벤처기업부' },
]

export const SITE_PHOTOS = [
  { img: '/images/portfolio/site-plant.jpg', label: '설비 제작 현장' },
  { img: '/images/portfolio/site-welding.jpg', label: '용접 자동화 공정' },
  { img: '/images/portfolio/site-fashion.jpg', label: '의류 작업실' },
  { img: '/images/portfolio/site-electric.jpg', label: '전기자재 작업장' },
  { img: '/images/portfolio/site-logistics.jpg', label: '물류 작업장' },
  { img: '/images/portfolio/site-workshop.jpg', label: '야외 작업장' },
]

// 직원 사진 (받으면 채운다). 예: { img: '/images/team/a.jpg', name: '홍○○', role: '영업팀' }
export const TEAM: { img: string; name: string; role: string }[] = []

// 고객 후기. 실제 고객이 남긴 말이고 공개에 동의한 것만 넣는다. 이름은 "이*영 대표님" 처럼 가린다.
// 예: { name: '이*영 대표님', industry: '제조업', text: '고객이 실제로 한 말' }
export const REVIEWS: { name: string; industry: string; text: string }[] = []
