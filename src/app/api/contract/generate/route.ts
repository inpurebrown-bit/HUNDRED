import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { generateContractPdf, generateContract, type ContractInput } from '@/lib/contract/generate'
import { mergeContractSettings } from '@/lib/contract/settings'
import { withLog, nowKstIso } from '@/lib/activityLog'

export const runtime = 'nodejs'
export const maxDuration = 60

type Body = Partial<ContractInput> & { customerId?: string; opsCaseId?: string; format?: 'pdf' | 'hwpx' }

// 계약서 생성 — 영업팀·관리팀·대표. 기본은 수정할 수 없는 PDF.
// 생성할 때마다 해당 카드 타임스탬프에 남기고, 입력한 내용은 카드에 저장해 다음에 그대로 다시 열 수 있게 한다.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as any
  if (!['sales', 'ops', 'ceo'].includes(user.role)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json().catch(() => null) as Body | null
  if (!body?.client?.company?.trim()) return NextResponse.json({ error: '업체명을 입력해 주세요' }, { status: 400 })
  if (body.type !== 'fee' && body.type !== 'nofee') return NextResponse.json({ error: '계약 유형을 선택해 주세요' }, { status: 400 })
  const format = body.format === 'hwpx' && user.role === 'ceo' ? 'hwpx' : 'pdf'   // 한글 파일은 대표만

  const { data: sv } = await supabaseAdmin.from('settings').select('value').eq('key', 'contract_settings').single()
  const settings = mergeContractSettings(sv?.value)

  const input: ContractInput = {
    type: body.type, feePercent: body.feePercent, client: body.client, contractDate: body.contractDate,
    items: body.items || {}, postCare: body.postCare, pLine: !!body.pLine, extraClauses: body.extraClauses || [],
    company: settings.company, textOverrides: settings.textOverrides[body.type],
  }

  let buf: Buffer
  try {
    buf = format === 'pdf' ? await generateContractPdf(input) : await generateContract(input)
  } catch (e: any) {
    return NextResponse.json({ error: '계약서 생성에 실패했습니다: ' + (e?.message || '') }, { status: 500 })
  }

  // 타임스탬프 + 입력 내용 저장 (실패해도 계약서는 내려준다)
  try {
    const summary = body.type === 'fee' ? `수수료 ${body.feePercent || ''}%` : '월정기(수수료 없음)'
    const logEntry = [{ at: nowKstIso(), by: user.name || '—', role: user.role, action: '계약서 생성', detail: `${body.client.company} · ${summary}` }]
    const draft = { ...input, company: undefined, textOverrides: undefined, savedAt: nowKstIso(), savedBy: user.name || '' }
    const save = async (table: 'customers' | 'ops_cases', id: string) => {
      const { data: row } = await supabaseAdmin.from(table).select('details').eq('id', id).single()
      if (row) await supabaseAdmin.from(table).update({ details: { ...withLog(row.details, row.details, logEntry), contract_draft: draft } }).eq('id', id)
    }
    if (body.customerId) await save('customers', body.customerId)
    if (body.opsCaseId) await save('ops_cases', body.opsCaseId)
  } catch { /* 기록 실패는 무시 */ }

  const date = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)
  // 파일명: 경영지도 및 자문계약서_업체명_대표자명대표님.pdf
  const clean = (v?: string) => (v || '').replace(/[\\/:*?"<>|]/g, '').trim()
  const fname = `경영지도 및 자문계약서_${clean(body.client.company)}${clean(body.client.ceo) ? `_${clean(body.client.ceo)}대표님` : ''}.${format}`
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
