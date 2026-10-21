import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { CODEF_PATHS, asArray, codefConfigured, codefPost, simpleAuthBase, type CodefProfile } from '@/lib/codef'
import { DEFAULT_TAX_2026, type TaxData } from '@/lib/taxCalc'

// 홈택스(CODEF) 불러오기 — 대표 전용. 부가세과세표준증명(간편인증)으로 반기별 신고 매출을 가져온다.
//  GET  : 연결 정보·마지막 불러온 결과·키 설정 여부
//  POST : { action: 'start' }  → 간편인증 요청 (카카오톡 등에서 승인)
//         { action: 'confirm', sid, twoWay, range } → 승인 후 증명서 조회
// 조회 한 건마다 간편인증 승인이 한 번씩 필요하므로, 한 번의 불러오기에 조회는 한 번만 한다.
export const maxDuration = 60

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

export async function GET() {
  const deny = await ceoOnly(); if (deny) return deny
  const [profile, last] = await Promise.all([readSetting('codef_profile'), readSetting('hometax_sync')])
  return NextResponse.json({ configured: codefConfigured(), env: process.env.CODEF_ENV === 'prod' ? 'prod' : process.env.CODEF_ENV === 'sandbox' ? 'sandbox' : 'demo', profile, last })
}

// 조회 기간: 7월 이후면 올해 1기까지, 그 전이면 작년 2기까지 (아직 신고 전인 기간은 증명서가 나오지 않음)
function periodRange() {
  const k = new Date(Date.now() + 9 * 3600 * 1000)
  const y = k.getUTCFullYear(), m = k.getUTCMonth() + 1
  return m >= 7 ? { start: `${y - 1}07`, end: `${y}01` } : { start: `${y - 1}01`, end: `${y - 1}07` }
}

function certBody(profile: CodefProfile, sid: string, range: { start: string; end: string }) {
  const c: any = simpleAuthBase(profile, sid)
  return {
    organization: '0001', loginType: '5', loginTypeLevel: c.loginTypeLevel, userName: c.userName, loginIdentity: profile.birth, phoneNo: c.phoneNo,
    ...(c.telecom ? { telecom: c.telecom } : {}),
    id: sid, startDate: range.start, endDate: range.end,
    isIdentityViewYN: '0', usePurposes: '99', submitTargets: '99', applicationType: '01',
    ...(profile.bizNo ? { identity: String(profile.bizNo).replace(/[^0-9]/g, '') } : {}),
    originDataYN: '0', originDataYN1: '0',
  } as Record<string, any>
}

export async function POST(req: NextRequest) {
  const deny = await ceoOnly(); if (deny) return deny
  if (!codefConfigured()) return NextResponse.json({ status: 'error', message: 'CODEF 키가 아직 설정되지 않았습니다. Vercel 환경변수 CODEF_CLIENT_ID, CODEF_CLIENT_SECRET을 넣어 주세요.' })

  const body = await req.json().catch(() => ({}))
  const profile = (await readSetting('codef_profile')) as CodefProfile | null
  if (!profile?.userName || !profile?.birth || !profile?.phoneNo) {
    return NextResponse.json({ status: 'error', message: '연결 정보(이름·생년월일·전화번호)를 먼저 저장해 주세요.' })
  }
  const range = body.range?.start && body.range?.end ? body.range : periodRange()
  const sid = String(body.sid || 'crm-' + randomUUID())
  const reqBody = certBody(profile, sid, range)

  try {
    let r
    if (body.action === 'start') {
      r = await codefPost(CODEF_PATHS.vatStandardCert, reqBody)
      if (r.code === 'CF-03002' || r.data?.continue2Way) {
        const d = r.data || {}
        return NextResponse.json({ status: 'need-auth', sid, range, method: d.method || '', twoWay: { jobIndex: d.jobIndex, threadIndex: d.threadIndex, jti: d.jti, twoWayTimestamp: d.twoWayTimestamp } })
      }
    } else if (body.action === 'confirm') {
      if (!body.twoWay) return NextResponse.json({ status: 'error', message: '인증 정보가 없습니다. 처음부터 다시 시도해 주세요.' })
      r = await codefPost(CODEF_PATHS.vatStandardCert, { ...reqBody, simpleAuth: '1', is2Way: true, twoWayInfo: body.twoWay })
      if (r.code === 'CF-03002' || r.data?.continue2Way) {
        return NextResponse.json({ status: 'need-auth', sid, range, twoWay: body.twoWay, retry: true, message: '아직 승인되지 않았습니다. 카카오톡에서 승인한 뒤 다시 눌러 주세요.' })
      }
    } else {
      return NextResponse.json({ status: 'error', message: '알 수 없는 요청입니다.' })
    }
    if (r.code !== 'CF-00000') return NextResponse.json({ status: 'error', code: r.code, message: r.message, extra: r.extraMessage })
    return NextResponse.json(await finish(r.data, range))
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e?.name === 'TimeoutError' ? '홈택스 응답이 늦어 중단했습니다. 잠시 뒤 다시 시도해 주세요.' : (e?.message || '홈택스 불러오기에 실패했습니다.') })
  }
}

const num = (v: any) => { const n = parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return isNaN(n) ? 0 : n }

// 증명서 → 반기별 신고 매출 → 세금계산(reported)에 반영하고 저장
async function finish(data: any, range: { start: string; end: string }) {
  const certs = asArray(data).filter(x => x && (x.commStartDate || x.resIncomeTotalAmt != null))
  const rows = certs.map(x => ({
    start: String(x.commStartDate || ''), end: String(x.commEndDate || ''), issuedAt: String(x.resIssueDate || ''),
    company: String(x.resCompanyNm || ''), taxable: num(x.resIncomeAmt), exempt: num(x.resDutyFreeAmt), total: num(x.resIncomeTotalAmt), tax: num(x.resTaxAmt),
  }))
  // 올해 반기에 해당하는 값만 세금계산에 적용
  const { data: row } = await supabaseAdmin.from('settings').select('value').eq('key', 'tax_calc').single()
  const cur: TaxData = ((row?.value as any)?.quarters ? row!.value : DEFAULT_TAX_2026) as TaxData
  const reported = { ...(cur.reported || {}) } as any
  const applied: string[] = []
  for (const r of rows) {
    if (!r.start.startsWith(String(cur.year))) continue
    const half = r.start.slice(4, 6) === '01' ? 'h1' : r.start.slice(4, 6) === '07' ? 'h2' : null
    if (!half) continue
    reported[half] = { supply: r.total, tax: Math.round(r.total * 0.1), issuedAt: r.issuedAt, period: `${r.start}~${r.end}` }
    applied.push(half === 'h1' ? '1~6월' : '7~12월')
  }
  if (applied.length) await supabaseAdmin.from('settings').upsert({ key: 'tax_calc', value: { ...cur, reported, source: '홈택스', syncedAt: new Date().toISOString() } }, { onConflict: 'key' })
  const payload = { fetchedAt: new Date().toISOString(), range, count: rows.length, rows, applied }
  await supabaseAdmin.from('settings').upsert({ key: 'hometax_sync', value: payload }, { onConflict: 'key' })
  return { status: 'done', ...payload }
}
