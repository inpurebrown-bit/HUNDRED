import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/migrate/backfill-ops
// 영업팀에서 넘어온 ops_cases에 has_cash/has_card/tax_invoice/contract_date 최신화
export async function POST() {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || !['ceo', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // customer_id가 있는 ops_cases (영업팀에서 넘어온 것) 전체 조회
  const { data: opsCases, error: opsErr } = await supabaseAdmin
    .from('ops_cases')
    .select('id, customer_id, details')
    .not('customer_id', 'is', null)

  if (opsErr) return NextResponse.json({ error: opsErr.message }, { status: 500 })
  if (!opsCases?.length) return NextResponse.json({ updated: 0, message: '대상 없음' })

  // 관련 customers 조회
  const customerIds = [...new Set(opsCases.map((c: any) => c.customer_id).filter(Boolean))]
  const { data: customers, error: custErr } = await supabaseAdmin
    .from('customers')
    .select('id, details')
    .in('id', customerIds)

  if (custErr) return NextResponse.json({ error: custErr.message }, { status: 500 })

  const customerMap: Record<string, any> = {}
  for (const c of customers || []) customerMap[c.id] = c.details || {}

  let updated = 0
  const errors: string[] = []

  for (const ops of opsCases) {
    const custDetails = customerMap[ops.customer_id]
    if (!custDetails) continue

    const existing = ops.details || {}

    // 영업팀 → 관리팀 매핑 (발급→희망, 미발급→미희망)
    const rawTaxInvoice = custDetails.tax_invoice
    const mappedTaxInvoice =
      rawTaxInvoice === '발급' ? '희망' :
      rawTaxInvoice === '미발급' ? '미희망' :
      rawTaxInvoice  // 이미 희망/미희망으로 저장된 경우 그대로

    const patch: Record<string, any> = {}

    // has_cash: 없으면 customers에서 채움
    if (existing.has_cash === undefined || existing.has_cash === null) {
      if (custDetails.has_cash !== undefined) patch.has_cash = custDetails.has_cash
    }
    // has_card: 없으면 customers에서 채움
    if (existing.has_card === undefined || existing.has_card === null) {
      if (custDetails.has_card !== undefined) patch.has_card = custDetails.has_card
    }
    // tax_invoice: 없으면 customers에서 매핑해서 채움
    if (!existing.tax_invoice && mappedTaxInvoice) {
      patch.tax_invoice = mappedTaxInvoice
    }
    // contract_date: 없으면 customers에서 채움
    if (!existing.contract_date && custDetails.contract_date) {
      patch.contract_date = custDetails.contract_date
    }
    // 카드결제면 발급완료도 자동 처리
    const hasCard = patch.has_card !== undefined ? patch.has_card : existing.has_card
    if (hasCard && !existing.tax_invoice_completed) {
      patch.tax_invoice_completed = true
    }

    if (Object.keys(patch).length === 0) continue

    const newDetails = { ...existing, ...patch }
    const { error: updateErr } = await supabaseAdmin
      .from('ops_cases')
      .update({ details: newDetails })
      .eq('id', ops.id)

    if (updateErr) {
      errors.push(`${ops.id}: ${updateErr.message}`)
    } else {
      updated++
    }
  }

  return NextResponse.json({
    updated,
    total: opsCases.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `${opsCases.length}건 중 ${updated}건 업데이트 완료`,
  })
}
