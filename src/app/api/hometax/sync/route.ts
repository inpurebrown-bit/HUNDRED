import { NextRequest, NextResponse, after } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { CODEF_PATHS, asArray, codefConfigured, codefPost, simpleAuthBase, type CodefProfile, type CodefResult } from '@/lib/codef'
import { DEFAULT_TAX_2026, type TaxData } from '@/lib/taxCalc'
import { aggregateCash, aggregateTaxInvoice, type HometaxData } from '@/lib/hometaxData'

// 홈택스(CODEF) 불러오기 — 대표 전용.
// 한 번 승인으로 여러 항목을 읽는다: 같은 세션 식별값으로 여러 조회를 동시에 걸어 두면,
// 첫 조회가 승인(2차 인증)을 받는 동안 나머지는 대기하다가 승인 한 번으로 모두 처리된다.
//  GET  : 연결 정보·읽어 둔 원자료·키 설정 여부
//  POST { action:'start', kinds:[...], secret7? }  → 조회를 동시에 걸고, 승인에 쓸 정보를 돌려준다
//  POST { action:'confirm', kind, sid, twoWay, secret7? } → 승인 뒤 첫 조회를 확정 (대기 중이던 나머지는 백그라운드에서 끝나 저장됨)
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

// 항목별로 따로 저장해 두고(동시에 끝나도 서로 덮어쓰지 않게) 조회할 때 합친다
const partKey = (k: Kind) => `hometax_${k}`
async function readMerged(): Promise<HometaxData> {
  const parts = await Promise.all([...KINDS.map(k => readSetting(partKey(k))), readSetting('hometax_data')])
  const out: HometaxData = { fetched: {}, ranges: {} }
  for (const p of parts as (HometaxData | null)[]) {
    if (!p) continue
    Object.assign(out, { ...p, fetched: { ...out.fetched, ...(p.fetched || {}) }, ranges: { ...out.ranges, ...(p.ranges || {}) } })
  }
  return out
}

export async function GET() {
  const deny = await ceoOnly(); if (deny) return deny
  const [profile, data] = await Promise.all([readSetting('codef_profile'), readMerged()])
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

function buildRequest(kind: Kind, profile: CodefProfile, sid: string, secret7?: string): { path: string; body: Record<string, any>; range: any } | { error: string } {
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
  return { path: CODEF_PATHS.taxInvoiceStat, range: { start: w.startM, end: w.endM }, body: { ...common, organization: '0002', loginIdentity: id13, inquiryType: '01', searchType: '01', startDate: w.startM, endDate: w.endM, type: '0', ...(biz ? { identity: biz } : {}) } }
}

const timeoutMsg = '홈택스 응답이 늦어 중단했습니다. 잠시 뒤 다시 시도해 주세요.'

export async function POST(req: NextRequest) {
  const deny = await ceoOnly(); if (deny) return deny
  if (!codefConfigured()) return NextResponse.json({ status: 'error', message: 'CODEF 키가 아직 설정되지 않았습니다. Vercel 환경변수 CODEF_CLIENT_ID, CODEF_CLIENT_SECRET을 넣어 주세요.' })

  const body = await req.json().catch(() => ({}))
  const profile = (await readSetting('codef_profile')) as CodefProfile | null
  if (!profile?.userName || !profile?.birth || !profile?.phoneNo) return NextResponse.json({ status: 'error', message: '연결 정보(이름·생년월일·전화번호)를 먼저 저장해 주세요.' })
  const secret7 = body.secret7 ? String(body.secret7) : undefined

  try {
    // ── 시작: 여러 조회를 같은 세션으로 동시에 건다 ──
    if (body.action === 'start') {
      const wanted: Kind[] = (Array.isArray(body.kinds) && body.kinds.length ? body.kinds : ['vatCert', 'cashSales', 'cashBuy']).filter((k: any) => KINDS.includes(k))
      if (!wanted.length) return NextResponse.json({ status: 'error', message: '불러올 항목을 골라 주세요.' })
      const sid = 'crm-' + randomUUID()
      type Job = { kind: Kind; rq: { path: string; body: Record<string, any>; range: any }; res?: CodefResult; err?: any; done: boolean; p?: Promise<void> }
      const jobs: Job[] = []
      const skipped: string[] = []
      for (const kind of wanted) {
        const rq = buildRequest(kind, profile, sid, secret7)
        if ('error' in rq) { skipped.push(kind + ': ' + rq.error); continue }
        jobs.push({ kind, rq, done: false })
      }
      if (!jobs.length) return NextResponse.json({ status: 'error', message: skipped.join(' / ') })
      // 동시에 요청 (각 57초 제한)
      for (const j of jobs) j.p = codefPost(j.rq.path, j.rq.body, 57_000).then(r => { j.res = r; j.done = true }, e => { j.err = e; j.done = true })
      // 첫 응답들이 모일 때까지 잠깐 기다린다 (승인 대기로 들어간 조회가 먼저 돌아온다)
      const t0 = Date.now()
      while (Date.now() - t0 < 12_000 && !jobs.some(j => j.res?.code === 'CF-03002' || j.res?.data?.continue2Way) && jobs.some(j => !j.done)) await new Promise(r => setTimeout(r, 300))
      const leader = jobs.find(j => j.res?.code === 'CF-03002' || j.res?.data?.continue2Way)
      const failed = jobs.filter(j => j.done && j !== leader && (j.err || j.res?.code !== 'CF-00000')).map(j => ({ kind: j.kind, code: j.res?.code || '', message: j.err ? (j.err.name === 'TimeoutError' ? timeoutMsg : j.err.message) : j.res?.message }))
      const pendingKinds = jobs.filter(j => !j.done).map(j => j.kind)

      // 승인 없이 바로 끝난 조회(이미 세션이 열려 있는 경우)와, 승인 뒤 대기가 풀려 끝나는 조회를 저장한다
      after(async () => {
        await Promise.all(jobs.map(j => j.p))
        for (const j of jobs) { if (j !== leader && j.res?.code === 'CF-00000') await finish(j.kind, j.res.data, j.rq.range).catch(() => {}) }
      })

      if (leader) {
        const d = leader.res!.data || {}
        return NextResponse.json({ status: 'need-auth', sid, leader: leader.kind, kinds: jobs.map(j => j.kind), pending: pendingKinds, failed, skipped, method: d.method || '', twoWay: { jobIndex: d.jobIndex, threadIndex: d.threadIndex, jti: d.jti, twoWayTimestamp: d.twoWayTimestamp }, startedAt: new Date().toISOString() })
      }
      // 승인 요청이 없고 모두 끝났거나 실패한 경우
      const ok = jobs.filter(j => j.res?.code === 'CF-00000').map(j => j.kind)
      if (ok.length) return NextResponse.json({ status: 'collecting', kinds: jobs.map(j => j.kind), pending: pendingKinds, failed, skipped, startedAt: new Date().toISOString() })
      const first = jobs[0]
      return NextResponse.json({ status: 'error', code: first.res?.code, message: first.err ? (first.err.name === 'TimeoutError' ? timeoutMsg : first.err.message) : first.res?.message, extra: first.res?.extraMessage })
    }

    // ── 확정: 승인 뒤 첫 조회를 마친다 (대기 중이던 나머지는 시작 요청 쪽에서 이어서 끝나 저장됨) ──
    if (body.action === 'confirm') {
      const kind = body.kind as Kind
      if (!KINDS.includes(kind)) return NextResponse.json({ status: 'error', message: '불러올 항목을 골라 주세요.' })
      if (!body.twoWay || !body.sid) return NextResponse.json({ status: 'error', message: '인증 정보가 없습니다. 처음부터 다시 시도해 주세요.' })
      const rq = buildRequest(kind, profile, String(body.sid), secret7)
      if ('error' in rq) return NextResponse.json({ status: 'error', message: rq.error })
      const r = await codefPost(rq.path, { ...rq.body, simpleAuth: '1', is2Way: true, twoWayInfo: body.twoWay }, 55_000)
      if (r.code === 'CF-03002' || r.data?.continue2Way) return NextResponse.json({ status: 'need-auth', retry: true, kind, sid: body.sid, twoWay: body.twoWay, message: '아직 승인되지 않았습니다. 카카오톡에서 승인한 뒤 다시 눌러 주세요.' })
      if (r.code !== 'CF-00000') return NextResponse.json({ status: 'error', code: r.code, message: r.message, extra: r.extraMessage })
      await finish(kind, r.data, rq.range)
      return NextResponse.json({ status: 'confirmed', kind })
    }
    return NextResponse.json({ status: 'error', message: '알 수 없는 요청입니다.' })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e?.name === 'TimeoutError' ? timeoutMsg : (e?.message || '홈택스 불러오기에 실패했습니다.') })
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
  await supabaseAdmin.from('settings').upsert({ key: partKey(kind), value: part }, { onConflict: 'key' })
}
