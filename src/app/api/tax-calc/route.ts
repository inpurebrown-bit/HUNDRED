import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { readHometax } from '@/lib/hometaxStore'
import { DEFAULT_TAX_2026, computeTax, type TaxData } from '@/lib/taxCalc'

// 세금 계산(홈택스 신고 기준) 조회 — 분기 매출·매입은 홈택스에서 읽은 값으로 자동 계산한다.
// 예전에 엑셀 값으로 채워 두었던 분기 칸(v가 2 미만)은 한 번만 비우고(원래 값은 tax_calc_excel_backup에 보관),
// 낸 세금·카드 월별 입력 같은 직접 입력 값은 그대로 둔다.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  if ((session.user as any).role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { data: row } = await supabaseAdmin.from('settings').select('value').eq('key', 'tax_calc').single()
  let saved = (row?.value || null) as TaxData | null
  if (saved && Array.isArray(saved.quarters) && saved.quarters.length === 4 && (saved.v ?? 1) < 2) {
    await supabaseAdmin.from('settings').upsert({ key: 'tax_calc_excel_backup', value: saved }, { onConflict: 'key' })
    saved = { ...saved, quarters: DEFAULT_TAX_2026.quarters, asOf: '', source: '홈택스', v: 2 }
    await supabaseAdmin.from('settings').upsert({ key: 'tax_calc', value: saved }, { onConflict: 'key' })
  }
  const data: TaxData = saved && Array.isArray(saved.quarters) && saved.quarters.length === 4 ? saved : DEFAULT_TAX_2026
  const hd = await readHometax()
  return NextResponse.json({ data, hd, summary: computeTax(data, undefined, hd), saved: !!saved })
}
