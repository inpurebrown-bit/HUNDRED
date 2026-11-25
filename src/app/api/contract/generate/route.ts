import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { generateContractPdf, generateContract, type ContractInput } from '@/lib/contract/generate'
import { mergeContractSettings } from '@/lib/contract/settings'
import { withLog, nowKstIso } from '@/lib/activityLog'

export const runtime = 'nodejs'
export const maxDuration = 60

type Body = Partial<ContractInput> & { customerId?: string; opsCaseId?: string; format?: 'pdf' | 'hwpx'; blank?: boolean }

// 계약서 생성 — 영업팀·관리팀·대표. 기본은 수정할 수 없는 PDF.
// 생성할 때마다 해당 카드 타임스탬프에 남기고, 입력한 내용은 카드에 저장해 다음에 그대로 다시 열 수 있게 한다.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (!['sales', 'ops', 'ceo'].includes(user.role)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json().catch(() => null) as Body | null
  const blank = !!body?.blank   // 공계약서(미팅용): 아무것도 채우지 않고 월정기/수수료 서식만 뽑는다
  if (!blank && !body?.client?.company?.trim()) return NextResponse.json({ error: '업체명을 입력해 주세요' }, { status: 400 })
  if (!body || (body.type !== 'fee' && body.type !== 'nofee' && body.type !== 'v2')) return NextResponse.json({ error: '계약 유형을 선택해 주세요' }, { status: 400 })
  // 계약서에 들어가는 값은 모두 있어야 만든다
  const c = body.client || { company: '' }
  const digits = (v?: string) => (v || '').replace(/[^0-9]/g, '')
  const lacking: string[] = []
  if (!c.ceo?.trim()) lacking.push('대표자명')
  if (digits(c.bizNo).length !== 10) lacking.push('사업자등록번호')
  if (!c.address?.trim()) lacking.push('사업장 주소')
  if (!c.managerName?.trim()) lacking.push('우리 담당자')
  if (digits(c.managerPhone).length < 9) lacking.push('담당자 연락처')
  if (!body.contractDate) lacking.push('계약일')
  if (body.type === 'fee' && !String(body.feePercent || '').trim()) lacking.push('성과 수수료율')
  if (body.type === 'v2' && !blank) {
    const pre = Number(body.prepay) || 0, bal = Number(body.balance) || 0
    if (pre <= 0) lacking.push('선금')
    if (body.bookkeeping && pre !== 500000) lacking.push('세무기장 이용 시 선금은 500,000원')
    const others = Object.entries(body.items || {}).reduce((t, [k, v]: [string, any]) => t + (k !== 'diag' && v?.on ? Number(v.amount) || 0 : 0), 0)
    if (pre + bal < others) lacking.push('선금+잔금(착수금)이 다른 업무 금액 합계보다 작습니다')
  }
  if (!blank && lacking.length) return NextResponse.json({ error: '입력이 안 된 항목이 있습니다: ' + lacking.join(', ') }, { status: 400 })
  const format = body.format === 'hwpx' && user.role === 'ceo' ? 'hwpx' : 'pdf'   // 한글 파일은 대표만

  const { data: sv } = await supabaseAdmin.from('settings').select('value').eq('key', 'contract_settings').single()
  const settings = mergeContractSettings(sv?.value)

  const input: ContractInput = {
    type: body.type, feePercent: body.feePercent, client: c, contractDate: body.contractDate, blank,
    prepay: Number(body.prepay) || 0, balance: Number(body.balance) || 0, bookkeeping: !!body.bookkeeping,
    items: body.items || {}, postCare: body.postCare, pLine: !!body.pLine, extraClauses: body.extraClauses || [],
    company: settings.company, textOverrides: settings.textOverrides[body.type === 'v2' ? 'nofee' : body.type],
  }

  let buf: Buffer
  try {
    buf = format === 'pdf' ? await generateContractPdf(input) : await generateContract(input)
  } catch (e: any) {
    return NextResponse.json({ error: '계약서 생성에 실패했습니다: ' + (e?.message || '') }, { status: 500 })
  }

  // 타임스탬프 + 입력 내용 저장 (실패해도 계약서는 내려준다)
  try {
    if (blank && !body.customerId && !body.opsCaseId) throw new Error('기록할 카드 없음')
    const summary = body.type === 'v2' ? `선금 ${(Number(body.prepay) || 0).toLocaleString('ko-KR')}원 + 잔금 ${(Number(body.balance) || 0).toLocaleString('ko-KR')}원${body.bookkeeping ? ' (세무기장)' : ''}` : body.type === 'fee' ? `수수료 ${body.feePercent || ''}%` : '월정기(수수료 없음)'
    const logEntry = [{ at: nowKstIso(), by: user.name || '—', role: user.role, action: blank ? '공계약서 출력' : '계약서 생성', detail: blank ? `공계약서 · ${summary}` : `${c.company} · ${summary}` }]
    const draft = blank ? null : { ...input, company: undefined, textOverrides: undefined, savedAt: nowKstIso(), savedBy: user.name || '' }
    const save = async (table: 'customers' | 'ops_cases', id: string) => {
      const { data: row } = await supabaseAdmin.from(table).select('details').eq('id', id).single()
      if (row) await supabaseAdmin.from(table).update({ details: { ...withLog(row.details, row.details, logEntry), ...(draft ? { contract_draft: draft } : {}) } }).eq('id', id)
    }
    if (body.customerId) await save('customers', body.customerId)
    if (body.opsCaseId) await save('ops_cases', body.opsCaseId)
  } catch { /* 기록 실패는 무시 */ }

  const date = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  // 파일명: 경영지도 및 자문계약서_업체명_대표자명대표님.pdf
  const clean = (v?: string) => (v || '').replace(/[\\/:*?"<>|]/g, '').trim()
  const fname = blank
    ? `경영지도 및 자문계약서_${body.type === 'fee' ? '수수료' : body.type === 'v2' ? '선금잔금' : '월정기'}_공계약서.${format}`
    : `경영지도 및 자문계약서_${clean(c.company)}${clean(c.ceo) ? `_${clean(c.ceo)}대표님` : ''}.${format}`
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
      'Cache-Control': 'no-store',
    },
  })
}

// 지난번에 입력한 내용 불러오기 (카드마다 저장됨)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const role = (session.user as any).role
  if (!['sales', 'ops', 'ceo'].includes(role)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const customerId = req.nextUrl.searchParams.get('customerId')
  const opsCaseId = req.nextUrl.searchParams.get('opsCaseId')
  let draft: any = null
  if (opsCaseId) { const { data } = await supabaseAdmin.from('ops_cases').select('details').eq('id', opsCaseId).single(); draft = (data?.details as any)?.contract_draft || null }
  if (!draft && customerId) { const { data } = await supabaseAdmin.from('customers').select('details').eq('id', customerId).single(); draft = (data?.details as any)?.contract_draft || null }
  return NextResponse.json({ draft })
}
