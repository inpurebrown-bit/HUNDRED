import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { CODEF_PATHS, asArray, codefConfigured, codefPost, simpleAuthBase, type CodefProfile, type CodefResult } from '@/lib/codef'
import { DEFAULT_TAX_2026, type TaxData } from '@/lib/taxCalc'
import { readHometax, hometaxPartKey } from '@/lib/hometaxStore'
import { aggregateCash, aggregateTaxInvoice, type HometaxData } from '@/lib/hometaxData'

// 홈택스(CODEF) 불러오기 — 대표 전용.
// 항목을 같은 세션으로 하나씩 차례로 읽는다 (동시에 걸면 항목마다 승인 요청이 따로 와서 꼬인다).
// 승인(2차 인증)이 필요한 항목에서 멈추고, 승인 뒤 이어서 읽는다. 클라이언트가 응답의 queue를 들고 다음 요청을 보낸다.
//  GET  : 연결 정보·읽어 둔 원자료·키 설정 여부
//  POST { action:'start', kinds:[...], secret7? }  → 새 세션으로 읽기 시작. need-auth(승인 필요) | next(남은 항목 있음) | done
//  POST { action:'next', sid, kinds:[...], secret7? } → 같은 세션으로 남은 항목을 이어 읽기
//  POST { action:'confirm', kind, sid, twoWay, queue, secret7? } → 승인한 항목을 확정하고 남은 queue를 돌려준다
export const maxDuration = 60

type Kind = 'vatCert' | 'taxInvoice' | 'cashSales' | 'cashBuy'
const KINDS: Kind[] = ['vatCert', 'taxInvoice', 'cashSales', 'cashBuy']

async function ceoOnly() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  if ((session.user as any).role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  return null
}
async function readSetting(key: string) {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', key).single()
  return data?.value ?? null
}
const envName = () => (process.env.CODEF_ENV === 'prod' ? 'prod' : process.env.CODEF_ENV === 'sandbox' ? 'sandbox' : 'demo')

export async function GET() {
  const deny = await ceoOnly(); if (deny) return deny
  const [profile, data] = await Promise.all([readSetting('codef_profile'), readHometax()])
  return NextResponse.json({ configured: codefConfigured(), env: envName(), profile, data })
}

const kst = () => new Date(Date.now() + 9 * 3600 * 1000)
// 부가세과세표준증명: 7월 이후면 올해 1기까지, 그 전이면 작년 2기까지 (신고 전인 기간은 증명서가 나오지 않음)
function halfRange() {
  const k = kst(), y = k.getUTCFullYear(), m = k.getUTCMonth() + 1
  return m >= 7 ? { start: `${y - 1}07`, end: `${y}01` } : { start: `${y - 1}01`, end: `${y - 1}07` }
}
// 월별 자료: 13개월 전 1일부터 오늘까지
function monthWindow() {
  const k = kst(), from = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() - 13, 1))
  const to = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()))
  const u = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  return { startD: u(from), endD: u(to), startM: u(from).slice(0, 6), endM: u(to).slice(0, 6) }
}

function buildRequest(kind: Kind, profile: CodefProfile, sid: string, secret7?: string): { path: string; body: Record<string, any>; range: any; alts?: Record<string, any>[] } | { error: string } {
  const c: any = simpleAuthBase(profile, sid)
  // 상품마다 세션 식별값 이름이 달라 id, ssoId 둘 다 보낸다
  const common: Record<string, any> = { loginType: '5', loginTypeLevel: c.loginTypeLevel, userName: c.userName, phoneNo: c.phoneNo, ...(c.telecom ? { telecom: c.telecom } : {}), id: sid, ssoId: sid }
  const biz = profile.bizNo ? String(profile.bizNo).replace(/[^0-9]/g, '') : ''
  const w = monthWindow()
  if (kind === 'vatCert') {
    const r = halfRange()
    return { path: CODEF_PATHS.vatStandardCert, range: r, body: { ...common, organization: '0001', loginIdentity: profile.birth, startDate: r.start, endDate: r.end, isIdentityViewYN: '0', usePurposes: '99', submitTargets: '99', applicationType: '01', ...(biz ? { identity: biz } : {}), originDataYN: '0', originDataYN1: '0' } }
  }
  if (kind === 'cashSales' || kind === 'cashBuy') {
    return { path: kind === 'cashSales' ? CODEF_PATHS.cashSales : CODEF_PATHS.cashBuy, range: { start: w.startD, end: w.endD }, body: { ...common, organization: '0003', loginIdentity: profile.birth, ...(biz ? { identity: biz } : {}), startDate: w.startD, endDate: w.endD, orderBy: '1', inquiryType: '0' } }
  }
  // 세금계산서 통계: 주민등록번호 13자리가 필요하다 (뒤 7자리는 저장하지 않고 요청에만 사용)
  if (!secret7 || !/^\d{7}$/.test(secret7)) return { error: '세금계산서 조회에는 주민등록번호 뒤 7자리가 필요합니다. (저장하지 않고 이번 요청에만 사용합니다)' }
  const id13 = String(profile.birth).slice(2, 8) + secret7
  // 올해 1월부터 이번 달까지만 조회한다 (홈택스 통계 화면은 기간이 길면 CF-12701로 실패하는 경우가 있다). 그래도 실패하면 조건을 바꿔 다시 시도한다.
  const k = kst(), ym = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  const startY = `${k.getUTCFullYear()}01`, endY = ym(k), start3 = ym(new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() - 2, 1)))
  const mk = (startDate: string, withBiz: boolean) => ({ ...common, organization: '0002', loginIdentity: id13, inquiryType: '01', searchType: '01', startDate, endDate: endY, type: '0', ...(withBiz && biz ? { identity: biz } : {}) })
  return { path: CODEF_PATHS.taxInvoiceStat, range: { start: startY, end: endY }, body: mk(startY, true), alts: [mk(startY, false), mk(start3 < startY ? startY : start3, true)] }
}

const timeoutMsg = '홈택스 응답이 늦어 중단했습니다. 잠시 뒤 다시 시도해 주세요.'
const errText = (e: any) => (e?.name === 'TimeoutError' ? timeoutMsg : e?.message || '홈택스 불러오기에 실패했습니다.')
const is2way = (r: CodefResult) => r.code === 'CF-03002' || !!r.data?.continue2Way
const twoWayOf = (r: CodefResult) => { const y = r.data || {}; return { jobIndex: y.jobIndex, threadIndex: y.threadIndex, jti: y.jti, twoWayTimestamp: y.twoWayTimestamp } }
const failText = (r: CodefResult) => [r.code, r.message, r.extraMessage].filter(Boolean).join(' ')

// 홈택스 화면 오류(CF-12xxx 등)로 실패하면 대체 조건으로 다시 시도한다. 성공하지 못하면 처음 오류를 그대로 돌려준다.
async function retryVariants(rq: { path: string; alts?: Record<string, any>[] }, r: CodefResult, budgetMs: number): Promise<CodefResult> {
  if (is2way(r) || r.code === 'CF-00000') return r
  for (const alt of rq.alts || []) {
    try { const x = await codefPost(rq.path, alt, budgetMs); if (x.code === 'CF-00000') return x } catch { /* 다음 조건 */ }
  }
  return rq.alts?.length ? { ...r, extraMessage: [r.extraMessage, '(대체 조건 ' + rq.alts.length + '가지도 실패 — 조회 기간에 세금계산서가 없어도 홈택스가 이렇게 실패로 응답할 수 있습니다)'].filter(Boolean).join(' ') } : r
}

// 항목을 순서대로 한 번에 하나씩 읽는다. 승인 요청(2차 인증)이 나오면 거기서 멈추고 어떤 항목의 승인인지 알려 준다.
// 같은 세션(sid)으로 이어 읽어서 앞 승인이 뒤 항목에도 통하면 추가 승인 없이 끝나고, 통하지 않으면 그 항목만 다시 승인받는다.
async function advance(profile: CodefProfile, sid: string, queue: Kind[], secret7?: string) {
  const t0 = Date.now()
  const rest = [...queue]
  const done: Kind[] = [], failed: { kind: Kind; message: string }[] = []
  let first = true
  while (rest.length) {
    // 한 요청은 60초 안에 끝나야 하므로 오래 걸렸으면 나머지는 다음 요청으로 넘긴다
    if (!first && Date.now() - t0 > 15_000) return { status: 'next', sid, queue: rest, done, failed }
    first = false
    const kind = rest.shift()!
    const rq = buildRequest(kind, profile, sid, secret7)
    if ('error' in rq) { failed.push({ kind, message: rq.error }); continue }
    let r: CodefResult
    try { r = await codefPost(rq.path, rq.body, Math.max(10_000, 56_000 - (Date.now() - t0))); r = await retryVariants(rq, r, Math.max(8_000, 56_000 - (Date.now() - t0))) } catch (e: any) { failed.push({ kind, message: errText(e) }); continue }
    if (is2way(r)) return { status: 'need-auth', sid, kind, twoWay: twoWayOf(r), method: r.data?.method || '', queue: rest, done, failed }
    if (r.code !== 'CF-00000') { failed.push({ kind, message: failText(r) }); continue }
    try { await finish(kind, r.data, rq.range); done.push(kind) } catch (e: any) { failed.push({ kind, message: errText(e) }) }
  }
  return { status: 'done', sid, queue: [] as Kind[], done, failed }
}

export async function POST(req: NextRequest) {
  const deny = await ceoOnly(); if (deny) return deny
  if (!codefConfigured()) return NextResponse.json({ status: 'error', message: 'CODEF 키가 아직 설정되지 않았습니다. Vercel 환경변수 CODEF_CLIENT_ID, CODEF_CLIENT_SECRET을 넣어 주세요.' })

  const body = await req.json().catch(() => ({}))
  const profile = (await readSetting('codef_profile')) as CodefProfile | null
  if (!profile?.userName || !profile?.birth || !profile?.phoneNo) return NextResponse.json({ status: 'error', message: '연결 정보(이름·생년월일·전화번호)를 먼저 저장해 주세요.' })
  const secret7 = body.secret7 ? String(body.secret7) : undefined
  const pick = (ks: any): Kind[] => (Array.isArray(ks) ? ks : []).filter((k: any) => KINDS.includes(k))

  try {
    // ── 시작 / 이어서 읽기 ──
    if (body.action === 'start' || body.action === 'next') {
      const wanted = pick(body.kinds)
      if (!wanted.length) return NextResponse.json({ status: 'error', message: '불러올 항목을 골라 주세요.' })
      const sid = body.action === 'next' && body.sid ? String(body.sid) : 'crm-' + randomUUID()
      return NextResponse.json(await advance(profile, sid, wanted, secret7))
    }

    // ── 확정: 승인한 항목 하나를 마치고, 남은 항목 목록(queue)을 돌려준다 ──
    if (body.action === 'confirm') {
      const kind = body.kind as Kind
      if (!KINDS.includes(kind)) return NextResponse.json({ status: 'error', message: '불러올 항목을 골라 주세요.' })
      if (!body.twoWay || !body.sid) return NextResponse.json({ status: 'error', message: '인증 정보가 없습니다. 처음부터 다시 시도해 주세요.' })
      const queue = pick(body.queue)
      const rq = buildRequest(kind, profile, String(body.sid), secret7)
      if ('error' in rq) return NextResponse.json({ status: 'next', sid: body.sid, queue, done: [], failed: [{ kind, message: rq.error }] })
      const t0 = Date.now()
      let r = await codefPost(rq.path, { ...rq.body, simpleAuth: '1', is2Way: true, twoWayInfo: body.twoWay }, 55_000)
      r = await retryVariants(rq, r, Math.max(8_000, 58_000 - (Date.now() - t0)))
      if (is2way(r)) return NextResponse.json({ status: 'need-auth', retry: true, sid: body.sid, kind, twoWay: body.twoWay, queue, done: [], failed: [], message: '아직 승인되지 않았습니다. 승인한 뒤 다시 눌러 주세요. (홈택스 응답: ' + (failText(r) || '없음') + ')' })
      if (r.code !== 'CF-00000') return NextResponse.json({ status: 'next', sid: body.sid, queue, done: [], failed: [{ kind, message: failText(r) }] })
      await finish(kind, r.data, rq.range)
      return NextResponse.json({ status: 'next', sid: body.sid, queue, done: [kind], failed: [] })
    }
    return NextResponse.json({ status: 'error', message: '알 수 없는 요청입니다.' })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: errText(e) })
  }
}

const num = (v: any) => { const x = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return isNaN(x) ? 0 : x }

// 읽은 자료를 월별·반기별로 정리해 항목별 키에 저장한다. 거래 상세는 저장하지 않고 합계만 남긴다.
async function finish(kind: Kind, data: any, range: { start: string; end: string }) {
  const part: HometaxData = { fetched: { [kind]: new Date().toISOString() }, ranges: { [kind]: `${range.start}~${range.end}` } }
  if (kind === 'cashSales') {
    part.cashSales = aggregateCash(asArray(data), 'all')
  } else if (kind === 'cashBuy') {
    const rows = asArray(data); part.cashBuy = aggregateCash(rows, 'deduct'); part.cashBuyNonDeduct = aggregateCash(rows, 'nondeduct')
  } else if (kind === 'taxInvoice') {
    const a = aggregateTaxInvoice(asArray(data)); part.taxInvoiceSales = a.sales; part.taxInvoiceBuy = a.buy
  } else {
    const certs = asArray(data).filter(x => x && (x.commStartDate || x.resIncomeTotalAmt != null))
    part.halves = certs.map(x => ({ start: String(x.commStartDate || ''), end: String(x.commEndDate || ''), issuedAt: String(x.resIssueDate || ''), total: num(x.resIncomeTotalAmt), exempt: num(x.resDutyFreeAmt), tax: num(x.resTaxAmt) }))
    // 올해 반기 신고 과세표준은 세금 계산(reported)에도 반영
    const { data: row } = await supabaseAdmin.from('settings').select('value').eq('key', 'tax_calc').single()
    const t: TaxData = ((row?.value as any)?.quarters ? row!.value : DEFAULT_TAX_2026) as TaxData
    const reported = { ...(t.reported || {}) } as any
    let changed = false
    for (const h of part.halves) {
      if (!h.start.startsWith(String(t.year))) continue
      const half = h.start.slice(4, 6) === '01' ? 'h1' : h.start.slice(4, 6) === '07' ? 'h2' : null
      if (!half) continue
      reported[half] = { supply: h.total, tax: Math.round(h.total * 0.1), issuedAt: h.issuedAt, period: `${h.start}~${h.end}` }; changed = true
    }
    if (changed) await supabaseAdmin.from('settings').upsert({ key: 'tax_calc', value: { ...t, reported, source: '홈택스', syncedAt: new Date().toISOString() } }, { onConflict: 'key' })
  }
  await supabaseAdmin.from('settings').upsert({ key: hometaxPartKey(kind), value: part }, { onConflict: 'key' })
}
