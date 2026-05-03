import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('supply_db')
      .select('*')
      .order('reception_date', { ascending: false })

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return NextResponse.json({ items: [] })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ items: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const user = session.user as any
  if (user.role !== 'ceo') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      reception_date,
      company_name,
      region,
      business_number,
      customer_name,
      phone,
      industry,
      last_year_revenue,
      credit_score,
      tax_delinquent,
      required_funds,
      notes,
    } = body

    const { data, error } = await supabaseAdmin
      .from('supply_db')
      .insert({
        reception_date,
        company_name,
        region,
        business_number,
        customer_name,
        phone,
        industry,
        last_year_revenue,
        credit_score,
        tax_delinquent,
        required_funds,
        notes,
        status: 'unassigned',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      if (error.message.includes('relation') || error.message.includes('does not exist')) {
        return NextResponse.json({ error: '테이블이 존재하지 않습니다' }, { status: 500 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ item: data }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
