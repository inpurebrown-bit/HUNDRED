import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

// 전화번호 중복 검색 — 발굴팀 전용
// customers.details.phone_010, customers.name(phone), dig_prospects.phone_010 조회
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const phone = req.nextUrl.searchParams.get('phone')?.replace(/[^0-9]/g, '') || ''
  if (phone.length < 9) return NextResponse.json({ results: [] })

  // customers 테이블: details JSONB에서 phone_010 검색
  const { data: customers } = await supabaseAdmin
    .from('customers')
    .select('id, name, details, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const customerMatches = (customers || []).filter((c: any) => {
    const p010 = String(c.details?.phone_010 || '').replace(/[^0-9]/g, '')
    const pMain = String(c.details?.phone || c.name || '').replace(/[^0-9]/g, '')
    return p010.includes(phone) || pMain.includes(phone)
  }).map((c: any) => ({
    source: 'customer',
    id: c.id,
    company: c.details?.company || c.name || '',
    ceo_name: c.details?.sales_user_name || '',
    phone_010: c.details?.phone_010 || '',
    status: c.status || '',
    created_at: c.created_at,
  }))

  // dig_prospects 테이블
  const { data: prospects } = await supabaseAdmin
    .from('dig_prospects')
    .select('id, company, ceo_name, phone_010, status, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  const prospectMatches = (prospects || []).filter((p: any) => {
    const p010 = String(p.phone_010 || '').replace(/[^0-9]/g, '')
    return p010.includes(phone)
  }).map((p: any) => ({
    source: 'prospect',
    id: p.id,
    company: p.company || '',
    ceo_name: p.ceo_name || '',
    phone_010: p.phone_010 || '',
    status: p.status || '',
    created_at: p.created_at,
  }))

  return NextResponse.json({ results: [...customerMatches, ...prospectMatches] })
}
