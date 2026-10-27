import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { mergeContractSettings } from '@/lib/contract/settings'
import { listBodyParagraphs } from '@/lib/contract/generate'

// 계약서 기본값: 영업·관리·대표가 읽고, 수정은 대표만
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const role = (session.user as any).role
  if (!['sales', 'ops', 'ceo'].includes(role)) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', 'contract_settings').single()
  const settings = mergeContractSettings(data?.value)
  // 대표 화면: 고칠 수 있는 본문 문단 목록도 함께 준다
  const withParagraphs = role === 'ceo' && req.nextUrl.searchParams.get('paragraphs') === '1'
  return NextResponse.json({
    settings,
    ...(withParagraphs ? { paragraphs: { fee: await listBodyParagraphs('fee'), nofee: await listBodyParagraphs('nofee') } } : {}),
  })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  if ((session.user as any).role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const merged = mergeContractSettings(body)
  // 원문과 같은 문구는 저장하지 않는다 (고친 것만 남김)
  for (const k of ['fee', 'nofee'] as const) for (const [orig, nw] of Object.entries(merged.textOverrides[k])) if (!nw || nw === orig) delete merged.textOverrides[k][orig]
  const value = { ...merged, updatedAt: new Date().toISOString(), updatedBy: (session.user as any).name }
  const { error } = await supabaseAdmin.from('settings').upsert({ key: 'contract_settings', value }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, settings: value })
}
