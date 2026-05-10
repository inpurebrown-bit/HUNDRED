import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// 프론트 alias → DB 컬럼명 변환
function toDbPatch(body: Record<string, any>) {
  const patch: Record<string, any> = {}
  const ALLOWED = [
    'customer_name','phone','institution','institution_type','solution',
    'memo','revenue','visit_date','script_delivered','next_plan',
    'required_checks','fund_solution','tax_invoice_requested',
    'is_refund','is_completed','approved_amount','commission_amount','owner_id',
  ]
  for (const k of ALLOWED) {
    if (body[k] !== undefined) patch[k] = body[k]
  }
  // 프론트 alias 처리
  if (body.progress_stage !== undefined) patch.stage = body.progress_stage
  if (body.progress_memo  !== undefined) patch.memo  = body.progress_memo
  if (body.stage          !== undefined) patch.stage = body.stage
  return patch
}

// PATCH: 케이스 진행현황 업데이트
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  const body = await req.json()
  const { id } = await context.params

  // 권한 확인
  const { data: existing } = await supabaseAdmin
    .from('ops_cases')
    .select('owner_id')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: '케이스 없음' }, { status: 404 })
  if (user.role === 'ops' && existing.owner_id !== user.id) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const patch = toDbPatch(body)
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '수정할 필드 없음' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('ops_cases')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ case: { ...data, progress_stage: data.stage, progress_memo: data.memo } })
}
