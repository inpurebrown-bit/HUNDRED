// 대표용 DB 필터 — 인콜카드에 적힌 값(업종·매출·법인/개인 등)을 느슨하게 읽어서 걸러낸다.
// 손으로 적은 값이라 오타·변형이 많다(재조업, 의류제조업, 3천만원 미만, 1-3억 …) → 키워드 포함·범위 해석으로 처리.

export type Cust = { id: string; name: string; phone: string; company?: string; status: string; memo?: string; notes?: string; details?: Record<string, any>; sales_user_name?: string }

// ── 글자 정리 (오타 교정 포함) ──
const TYPO: [RegExp, string][] = [
  [/재조/g, '제조'], [/써비스/g, '서비스'], [/서비쓰/g, '서비스'], [/소프트웨아/g, '소프트웨어'],
  [/도\s*\/\s*소매/g, '도소매'], [/도매\s*및\s*소매/g, '도소매'], [/도\s*소매/g, '도소매'],
  [/건축업/g, '건설업'], [/아이티/gi, 'it'], [/ｉｔ/gi, 'it'],
]
export function norm(s: any): string {
  let t = String(s ?? '').toLowerCase().replace(/[\s·,./()\[\]\-_&]+/g, '')
  for (const [a, b] of TYPO) t = t.replace(a, b)
  return t
}

// ── 업종 묶음 — kw: 업종칸·업종메모에서 찾을 말, nm: 상호에서도 찾을 말(너무 흔한 말은 뺀다) ──
export const INDUSTRY_GROUPS: { key: string; label: string; kw: string[]; nm: string[] }[] = [
  { key: 'mfg', label: '제조업', kw: ['제조', '생산', '가공', '공장', '임가공', '정미', '제작', '제과', '제빵', '인쇄', '금속', '기계', '공업', '화학', '섬유', '봉제', '주조', '용접', '플라스틱', '포장', '부품', '반도체', '식품제조', '의류제조', '전자부품', '도금', '사출', '목공', '가구제조', '공예'], nm: ['제조', '공업', '정밀', '산업', '테크', '엔지니어링', '기계', '금속', '전자', '화학', '플라스틱', '인쇄', '공방'] },
  { key: 'it', label: 'IT·개발업', kw: ['소프트웨어', '개발', '앱', '어플', '플랫폼', '정보통신', '프로그램', '웹', '시스템', '솔루션', '게임', '데이터', '클라우드', '인공지능', '사이트', '홈페이지', '전자상거래', '온라인'], nm: ['소프트', '솔루션', '시스템', '테크', '랩스', '랩', '데이터', '네트웍', '네트워크', '소프트웨어', '게임즈', '앱', 'soft', 'tech'] },
  { key: 'build', label: '건설·인테리어', kw: ['건설', '건축', '인테리어', '시공', '토목', '설비', '전기공사', '철거', '조경', '타일', '도장', '방수', '단열', '리모델링', '공사', '엔지니어링'], nm: ['건설', '건축', '인테리어', '시공', '종합건', '설비', '전기', '토건'] },
  { key: 'trade', label: '도소매·유통', kw: ['도소매', '도매', '소매', '유통', '무역', '판매', '통신판매', '쇼핑몰', '스토어', '커머스', '수입', '수출', '상사', '마트', '편의점', '납품'], nm: ['상사', '유통', '무역', '트레이딩', '마트', '상회', '스토어', '몰'] },
  { key: 'food', label: '음식·외식', kw: ['음식', '식당', '음식점', '외식', '카페', '커피', '주점', '호프', '분식', '치킨', '고깃집', '요리', '배달', '베이커리', '한식', '양식', '일식', '중식', '정육'], nm: ['식당', '카페', '커피', '치킨', '분식', '갈비', '국밥', '반점', '횟집', '주점', '푸드'] },
  { key: 'service', label: '서비스업', kw: ['서비스', '청소', '세탁', '대행', '컨설팅', '광고', '디자인', '스튜디오', '촬영', '렌탈', '임대', '수리', '정비', '인력', '경비', '용역'], nm: ['서비스', '컨설팅', '디자인', '스튜디오', '클린', '에이전시'] },
  { key: 'edu', label: '교육·학원', kw: ['학원', '교육', '교습', '과외', '어학', '코딩', '유치원', '아카데미'], nm: ['학원', '교육', '아카데미', '교습소', '스쿨'] },
  { key: 'estate', label: '부동산·임대', kw: ['부동산', '중개', '임대', '공간임대', '건물', '숙박', '펜션', '민박', '모텔', '호텔'], nm: ['부동산', '공인중개', '펜션', '민박', '호텔'] },
  { key: 'logi', label: '운수·물류', kw: ['운수', '운송', '물류', '택배', '화물', '배송', '창고', '이사', '렌터카', '운전', '택시', '버스'], nm: ['운송', '물류', '택배', '화물', '로지스', '익스프레스', '운수'] },
  { key: 'agri', label: '농림어업·식품', kw: ['농업', '농산', '축산', '수산', '어업', '식품', '원예', '농원', '영농', '임업', '양봉', '과수'], nm: ['농장', '농원', '영농', '수산', '푸드', '식품', '축산'] },
  { key: 'beauty', label: '미용·의료·건강', kw: ['미용', '네일', '피부', '헤어', '의료', '병원', '의원', '약국', '한의', '건강', '요가', '필라테스', '헬스', '골프', '스포츠', '마사지', '왁싱', '속눈썹', '반려', '동물'], nm: ['네일', '헤어', '의원', '병원', '약국', '한의원', '요가', '필라테스', '헬스', '뷰티', '클리닉', '스포츠'] },
  { key: 'culture', label: '문화·콘텐츠', kw: ['문화', '콘텐츠', '영화', '음악', '공연', '출판', '영상', '미디어', '방송', '예술', '사진', '웹툰'], nm: ['미디어', '필름', '픽쳐스', '스튜디오', '프로덕션', '엔터'] },
]

const CORP_NAME = /(주식회사|㈜|\(주\)|유한회사|\(유\)|합자회사|주\)|\.주|^주\.|사단법인|재단법인|협동조합)/

export function industryText(c: Cust): string {
  const d = c.details || {}
  return [d.business_type, d.industry, d.asset_biz_type, d.biz_size].filter(Boolean).join(' ')
}
export function companyName(c: Cust): string { return String(c.company || c.details?.company || '') }

/** 업종 묶음에 걸리면 근거(걸린 말)를 돌려준다. 없으면 '' */
export function matchGroup(c: Cust, g: { kw: string[]; nm: string[] }, withMemo: boolean): string {
  const ind = norm(industryText(c))
  for (const k of g.kw) if (ind.includes(norm(k))) return `업종:${k}`
  const nm = norm(companyName(c))
  for (const k of g.nm) if (nm.includes(norm(k))) return `상호:${k}`
  if (withMemo) {
    const memo = norm([c.details?.result_memo, c.memo, c.notes, c.details?.solution].filter(Boolean).join(' '))
    for (const k of g.kw) if (k.length >= 2 && memo.includes(norm(k))) return `메모:${k}`
  }
  return ''
}
export function matchFree(c: Cust, words: string[], withMemo: boolean): string {
  const hay = norm([industryText(c), companyName(c), withMemo ? [c.details?.result_memo, c.memo, c.notes].join(' ') : ''].join(' '))
  for (const w of words) { const k = norm(w); if (k && hay.includes(k)) return `키워드:${w}` }
  return ''
}

// ── 매출 읽기 — "3천만원 미만", "1-3억", "1억2천", "5천", "8억" → [하한, 상한] (원) ──
export type Range = { lo: number; hi: number } | null
function amountOf(s: string): number {
  // 1억2천 / 3천만원 / 5천 / 200만 / 12000만원 / 150000000
  let rest = s.replace(/[,원\s]/g, ''), total = 0, any = false
  const eok = rest.match(/(\d+(?:\.\d+)?)억/)
  if (eok) { total += parseFloat(eok[1]) * 1e8; rest = rest.replace(eok[0], ''); any = true }
  const cheon = rest.match(/(\d+(?:\.\d+)?)천(?:만)?/)
  if (cheon) { total += parseFloat(cheon[1]) * 1e7; rest = rest.replace(cheon[0], ''); any = true }
  const baek = rest.match(/(\d+(?:\.\d+)?)백(?:만)?/)
  if (baek) { total += parseFloat(baek[1]) * 1e6; rest = rest.replace(baek[0], ''); any = true }
  const man = rest.match(/(\d+(?:\.\d+)?)만/)
  if (man) { total += parseFloat(man[1]) * 1e4; rest = rest.replace(man[0], ''); any = true }
  if (!any) { const n = rest.match(/^\d+(?:\.\d+)?$/); if (n) { const v = parseFloat(n[0]); total = v >= 1e6 ? v : v * 1e4; any = v > 0 } }
  return any ? total : NaN
}
export function parseRevenue(raw: any): Range {
  const s = String(raw ?? '').trim()
  if (!s || /^(x|없음|현재없다|비슷|모름|미상|\?|-)$/i.test(s)) return null
  if (/^0+$/.test(s)) return { lo: 0, hi: 0 }
  // 범위: 1-3억, 3~5억
  const r = s.replace(/\s/g, '').match(/^(\d+(?:\.\d+)?)(억|천만|천|만)?[-~](\d+(?:\.\d+)?)(억|천만|천|만)?/)
  if (r) {
    const u2 = r[4] || r[2] || '억', u1 = r[2] || u2
    const m = (n: string, u: string) => parseFloat(n) * (u === '억' ? 1e8 : u === '천만' || u === '천' ? 1e7 : 1e4)
    return { lo: m(r[1], u1), hi: m(r[3], u2) }
  }
  const v = amountOf(s)
  if (Number.isNaN(v)) return null
  if (/미만|이하|못|안됨|안돼/.test(s)) return { lo: 0, hi: v }
  if (/이상|넘|초과|\+/.test(s)) return { lo: v, hi: Infinity }
  return { lo: v, hi: v }
}
export function revenueOf(c: Cust): { range: Range; text: string } {
  const d = c.details || {}
  for (const k of ['revenue_2025', 'annual_revenue', 'revenue_2026', 'revenue_2024']) {
    const r = parseRevenue(d[k]); if (r) return { range: r, text: String(d[k]) }
  }
  return { range: null, text: String(d.revenue_2025 ?? d.annual_revenue ?? '') }
}

// ── 법인/개인, 직원수, 업력 ──
export function entityOf(c: Cust): '법인' | '개인' | '' {
  const t = String(c.details?.corp_type || '')
  if (/법인/.test(t)) return '법인'
  if (/개인/.test(t)) return '개인'
  const nm = companyName(c)
  if (CORP_NAME.test(nm)) return '법인'
  return ''
}
export function employeesOf(c: Cust): number | null {
  const s = String(c.details?.employee_count ?? '').trim()
  if (!s || /^x$/i.test(s)) return null
  if (/혼자|대표만|1인|없/.test(s)) return 0
  const n = s.match(/\d+/); return n ? parseInt(n[0], 10) : null
}
export function yearsOf(c: Cust): number | null {
  const s = String(c.details?.years_in_business ?? c.details?.business_age ?? '').trim()
  const y = s.match(/(19|20)\d{2}/)
  if (y) return new Date().getFullYear() - parseInt(y[0], 10)
  const n = s.match(/(\d+(?:\.\d+)?)\s*년/); if (n) return parseFloat(n[1])
  const m = s.match(/(\d+)\s*개월/); if (m) return parseInt(m[1], 10) / 12
  return null
}

// ── 제외 ──
export function isSelfRejected(c: Cust): boolean {
  const d = c.details || {}
  return d.closing_result === '자체거절' || d.call_result === '자체거절' || !!d.self_rejection_reason
}
export function isContracted(c: Cust): boolean { return c.status === 'contracted' }

export function fmtWon(n: number): string {
  if (!isFinite(n)) return '∞'
  if (n >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억'
  if (n >= 1e4) return Math.round(n / 1e4).toLocaleString() + '만'
  return String(n)
}
