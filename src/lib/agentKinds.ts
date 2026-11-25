// 주황이(카톡·자료 작성 에이전트) 작업 종류 — CRM '주황이 지시' 탭, 작업 대기열 API, 주황이용 API 가 함께 쓴다.
//  where 'crm'    : 비밀통로 없이 CRM 안(고객서류 탭 기능)에서 바로 작성
//  where 'secret' : 비밀사이트(문서 메뉴판) 번호를 눌러 PDF 를 만든다. fixed 는 업체별 작성이 아닌 고정 자료(3종세트)
export type AgentKind = { key: string; label: string; where: 'crm' | 'secret'; no?: number; fixed?: boolean; hint?: string }

export const AGENT_KIND_LIST: AgentKind[] = [
  { key: 'finance', label: '재무제표 분석', where: 'crm' },
  { key: 'report',  label: '보고서',        where: 'crm', hint: '경영진단·컨설팅 보고서(고객서류 탭 보고서)' },
  { key: 'bizplan', label: '사업계획서',    where: 'crm' },
  { key: 'jaedan',  label: '신용보증재단 스크립트', where: 'secret', no: 1 },
  { key: 'kibo',    label: '기술보증기금 스크립트', where: 'secret', no: 2 },
  { key: 'shinbo',  label: '신용보증기금 스크립트', where: 'secret', no: 3 },
  { key: 'kosmes',  label: '중진공 스크립트',       where: 'secret', no: 4 },
  { key: 'semas',   label: '소진공 스크립트',       where: 'secret', no: 5 },
  { key: 'miso',    label: '미소 스크립트',         where: 'secret', no: 6 },
  { key: 'road',    label: '로드맵',                where: 'secret', no: 7 },
  { key: 'plan',    label: '컨설팅 수행계획서',     where: 'secret', no: 8 },
  { key: 'g9',      label: '재무제표 핵심 가이드',  where: 'secret', no: 9, fixed: true },
  { key: 'g10',     label: '절세요령',              where: 'secret', no: 10, fixed: true },
  { key: 'g11',     label: '정부지원금·인증 로드맵', where: 'secret', no: 11, fixed: true },
  { key: 'diag',    label: '경영진단 통합 리포트',  where: 'secret', no: 12 },
]
export const AGENT_KIND_KEYS = AGENT_KIND_LIST.map(k => k.key)

// 고객이 카톡방에 올린 서류를 CRM 고객서류 탭(consulting_docs)에 넣을 때의 분류
export const CUSTOMER_DOC_TYPES = [
  'biz_reg', 'id_card', 'biz_lease', 'home_lease', 'vehicle', 'tax_paid', 'financials', 'vat_cert',
  'patent', 'sales_data', 'insurance', 'corp_reg', 'shareholders', 'etc',
] as const

// '주황이 지시' 탭의 묶음 (2026-11-23 대표 지시)
//  AUTO   계약 후 2·3·4일차에 CRM 이 자동으로 작업을 만들어 주황이가 그냥 보낸다(고정 자료 3종)
//  PICK   선택해서 만들기
//  SCRIPT 기관 스크립트
//  BATCH  '자료 다 받은 걸로 간주하기' 한 번에 만들어 보낸다(서로 비슷한 내용의 문서 3개)
export const AUTO_KINDS: { key: string; day: number }[] = [{ key: 'g9', day: 2 }, { key: 'g10', day: 3 }, { key: 'g11', day: 4 }]
// 2·3·4일차 고정 자료 원본 PDF(대표 확인용) — 주황이가 보내는 내용과 같은 문서
export const AUTO_FILES: Record<string, string> = { g9: '/guides/day2_fin_guide.pdf', g10: '/guides/day3_tax_tips.pdf', g11: '/guides/day4_gov_roadmap.pdf' }
export const PICK_KINDS = ['finance', 'bizplan', 'road']
export const SCRIPT_KINDS = ['jaedan', 'kibo', 'shinbo', 'kosmes', 'semas', 'miso']
export const BATCH_KINDS = ['report', 'diag', 'plan']
