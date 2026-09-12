import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const phone = req.nextUrl.searchParams.get('phone')?.replace(/[^0-9]/g, '') || ''
  if (phone.length < 9) return NextResponse.json({ results: [] })

  // customers.phone = 최상위 컬럼 (핵심)
  // customers.details->>phone_010 = JSONB 안 추가 번호 (있으면)
  // dig_prospects.phone_010 = 발굴팀 가망 번호
  const [{ data: customers }, { data: prospects }] = await Promise.all([
    supabaseAdmin
      .from('customers')
      .select('id, name, phone, details, status, created_at')
      .or(`phone.ilike.%${phone}%,details->>phone_010.ilike.%${phone}%`),
    supabaseAdmin
      .from('dig_prospects')
      .select('id, company, ceo_name, phone_010, status, created_at')
      .ilike('phone_010', `%${phone}%`),
  ])

  const customerMatches = (customers || []).map((c: any) => ({
    source: 'customer',
    id: c.id,
    company: c.details?.company || c.name || '',
    ceo_name: c.name || '',
    phone_010: c.phone || c.details?.phone_010 || '',
    status: c.details?.sub_status || c.status || '',
    created_at: c.created_at,
  }))

  const prospectMatches = (prospects || []).map((p: any) => ({
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
