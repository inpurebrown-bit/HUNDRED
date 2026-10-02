import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as { role?: string }
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const year_month = req.nextUrl.searchParams.get('year_month')
  if (!year_month) return NextResponse.json({ error: 'year_month 파라미터 필요' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('payroll_records')
    .select('*')
    .eq('year_month', year_month)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ record: data ?? null })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const user = session.user as { role?: string }
  if (user.role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json()
  const { year_month, edited } = body
  const { memo } = body
  let { employees } = body

  // 사용자가 직접 편집하지 않은 저장(자동 불러오기·월 전환 등)은 기존에 입력된
  // 시상금·직원 명단·기타비용 항목을 지우지 못하게 보존한다.
  if (!edited && employees) {
    const { data: existing } = await supabaseAdmin
      .from('payroll_records').select('employees').eq('year_month', year_month).maybeSingle()
    const old = existing?.employees
    if (old) {
      const merged = { ...employees }
      for (const g of ['ops_employees', 'sales_employees', 'dig_employees']) {
        const oldList: any[] = Array.isArray(old[g]) ? old[g] : []
        const incList: any[] = Array.isArray(merged[g]) ? merged[g].map((e: any) => ({ ...e })) : []
        for (const o of oldList) {
          const name = String(o?.name || '').trim()
          if (!name) continue
          const hit = incList.find(e => String(e?.name || '').trim() === name)
          if (!hit) incList.push({ ...o })
          else if (!(hit.awards || []).length && (o.awards || []).length) hit.awards = o.awards
        }
        merged[g] = incList
      }
      const oldItems = old.other_costs?.sales_other_items
      if (Array.isArray(oldItems) && oldItems.length && !(merged.other_costs?.sales_other_items || []).length) {
        merged.other_costs = { ...(merged.other_costs || {}), sales_other_items: oldItems }
      }
      employees = merged
    }
  }

  const { data, error } = await supabaseAdmin
    .from('payroll_records')
    .upsert(
      {
        year_month,
        employees,
        memo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'year_month' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ record: data })
}
