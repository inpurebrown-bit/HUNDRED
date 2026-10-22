// CODEF API (홈택스) 서버용 도우미 — 키는 환경변수(CODEF_CLIENT_ID / CODEF_CLIENT_SECRET)에서만 읽는다
// 데모: development.codef.io (기본), 정식: api.codef.io (CODEF_ENV=prod), 샌드박스: sandbox.codef.io (CODEF_ENV=sandbox) — 키 종류와 서버가 맞아야 한다

const OAUTH_URL = 'https://oauth.codef.io/oauth/token'
const base = () => (process.env.CODEF_ENV === 'prod' ? 'https://api.codef.io' : process.env.CODEF_ENV === 'sandbox' ? 'https://sandbox.codef.io' : 'https://development.codef.io')

export const CODEF_PATHS = {
  taxReportList: '/v1/kr/public/nt/hometax/tax-report-details',     // 세금신고내역 (세목별 신고 목록)
  generalVat: '/v1/kr/public/nt/report/general-taxpayer-vat',       // 일반과세자 부가가치세 신고서
  vatStandardCert: '/v1/kr/public/nt/proof-issue/additional-tax-standard',   // 부가세과세표준증명 (반기별 신고 매출)
  cashSales: '/v1/kr/public/nt/cash-receipt/sales-details',          // 현금영수증 매출내역
  cashBuy: '/v1/kr/public/nt/cash-receipt/purchase-details',        // 현금영수증 매입내역
  taxInvoiceStat: '/v1/kr/public/nt/tax-invoice/sales-purchase-statistics', // 전자세금계산서 기간별 매출/매입 통계
} as const

export function codefConfigured(): boolean {
  return !!(process.env.CODEF_CLIENT_ID && process.env.CODEF_CLIENT_SECRET)
}

let tokenCache: { token: string; exp: number } | null = null

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token
  const id = process.env.CODEF_CLIENT_ID, secret = process.env.CODEF_CLIENT_SECRET
  if (!id || !secret) throw new Error('CODEF 키가 설정되지 않았습니다 (CODEF_CLIENT_ID / CODEF_CLIENT_SECRET)')
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64') },
    body: 'grant_type=client_credentials&scope=read',
  })
  const j: any = await res.json().catch(() => ({}))
  if (!res.ok || !j.access_token) throw new Error('CODEF 토큰 발급 실패 (키 값과 데모/정식 구분을 확인하세요)')
  tokenCache = { token: j.access_token, exp: Date.now() + (Number(j.expires_in) || 600_000) * 1000 }
  return j.access_token
}

// CODEF 응답은 URL 인코딩된 JSON 문자열로 올 수 있어 둘 다 처리한다
export function parseCodefText(text: string): any {
  try { return JSON.parse(text) } catch { /* 인코딩된 응답 */ }
  try { return JSON.parse(decodeURIComponent(text.replace(/\+/g, ' '))) } catch { return null }
}

export interface CodefResult { code: string; message: string; extraMessage: string; data: any }

export async function codefPost(path: string, body: Record<string, any>, timeoutMs = 50_000): Promise<CodefResult> {
  const token = await getToken()
  const res = await fetch(base() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),   // 홈택스 응답이 길어져도 서버가 무한정 붙잡지 않도록
  })
  const parsed = parseCodefText(await res.text())
  if (!parsed?.result) throw new Error('CODEF 응답을 읽지 못했습니다 (HTTP ' + res.status + ')')
  return { code: String(parsed.result.code || ''), message: String(parsed.result.message || ''), extraMessage: String(parsed.result.extraMessage || ''), data: parsed.data }
}

export const asArray = (x: any): any[] => (Array.isArray(x) ? x : x && typeof x === 'object' ? [x] : [])
export const yyyymmdd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

export interface CodefProfile {
  userName: string
  birth: string          // YYYYMMDD
  phoneNo: string        // 숫자만
  telecom?: string       // 0:SKT 1:KT 2:LG U+ (통신사 PASS일 때만)
  authLevel: string      // 1:카카오톡 3:삼성패스 4:KB 5:PASS 6:네이버 8:토스 ...
  bizNo?: string         // 사업자번호 (선택)
}

// 간편인증 공통 요청 값
export function simpleAuthBase(p: CodefProfile, sid: string) {
  return {
    organization: '0005',
    loginType: '5',
    loginTypeLevel: String(p.authLevel || '1'),
    userName: p.userName,
    phoneNo: String(p.phoneNo || '').replace(/[^0-9]/g, ''),
    ...(p.authLevel === '5' ? { telecom: p.telecom || '0' } : {}),
    id: sid,
  }
}
