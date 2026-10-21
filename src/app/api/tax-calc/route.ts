import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { DEFAULT_TAX_2026, computeTax, type TaxData } from '@/lib/taxCalc'

// 세금 계산(홈택스 신고 기준) 조회 — 저장된 값이 없으면 대표가 엑셀로 관리하던 값(2026)을 기본으로 사용
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  if ((session.user as any).role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const { data: row } = await supabaseAdmin.from('settings').select('value').eq('key', 'tax_calc').single()
  const saved = (row?.value || null) as TaxData | null
  const data: TaxData = saved && Array.isArray(saved.quarters) && saved.quarters.length === 4 ? saved : DEFAULT_TAX_2026
  return NextResponse.json({ data, summary: computeTax(data), saved: !!saved })
}
