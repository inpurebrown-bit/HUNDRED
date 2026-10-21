import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { buildSalesContractMap, calcRefundDeductions, calcSalesStructure, getPromo } from '@/lib/payrollCalc'
import { GET as revenueGET } from '@/app/api/revenue/route'

// 대표 플래너가 쓰는 CRM 실적 묶음 (단위: 원 → 화면에서 만원으로 변환)
function monthKey(offset = 0) {
  const k = new Date(Date.now() + 9 * 3600 * 1000)
  const d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + offset, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  if ((session.user as any).role !== 'ceo') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const ym = monthKey(0), ym1 = monthKey(-1), ym2 = monthKey(-2)

  // 영업팀 계약 (환불 차감·추가 입금 반영)
  const { data: customers } = await supabaseAdmin
    .from('customers')
    .select('id, owner_id, name, status, details, created_at')
    .or('status.in.(contracted,refunded),details->>refund_deduction_weight.not.is.null,details->extra_counts.not.is.null')
  const cust = customers || []

  const monthly = (m: string) => {
    const map = buildSalesContractMap(cust, m)
    const deds = calcRefundDeductions(cust, m)
    const out: Record<string, { count: number; revenue: number }> = {}
    for (const [name, v] of Object.entries(map)) out[name] = { count: v.count, revenue: v.revenue }
    for (const d of deds) {
      const key = Object.keys(out).find(k => k === d.name || k.includes(d.name) || d.name.includes(k)) || d.name
      if (!out[key]) out[key] = { count: 0, revenue: 0 }
      out[key].count = Math.max(0, out[key].count - d.weight)
      out[key].revenue = Math.max(0, out[key].revenue - d.amount)
    }
    return out
  }
  const cur = monthly(ym)
  const sumCount = (o: Record<string, { count: number }>) => Object.values(o).reduce((s, v) => s + v.count, 0)
  const people = Object.entries(cur).map(([name, v]) => {
    const promo = getPromo(v.count)
    const perf = v.count >= 12 ? Math.round(v.revenue * 0.05) : 0
    const st = calcSalesStructure({ revenue: v.revenue, perfBonus: perf, promo, payMode: 'all', yearMonth: ym })
    return { name, count: Math.round(v.count * 100) / 100, revenue: v.revenue, payAll: st.allTotal, payBase7: st.baseTotal }
  }).sort((a, b) => b.revenue - a.revenue)

  // 관리팀 수수료·별도계약 매출 (매출 API 재사용)
  let opsFee = 0, opsOwn = 0, salesRevenueTotal = 0
  try {
    const res = await revenueGET(req)
    const rv = await res.json()
    opsFee = (rv.thisMonthOps || []).reduce((s: number, e: any) => s + (e.amount || 0), 0)
    opsOwn = (rv.thisMonthOpsContracts || []).reduce((s: number, e: any) => s + (e.amount || 0), 0)
    salesRevenueTotal = (rv.thisMonthSales || []).reduce((s: number, e: any) => s + (e.amount || 0), 0)
  } catch { /* 매출 API 실패해도 나머지는 반환 */ }

  // 발굴팀 승인 건수(이번 달)
  const dig: { name: string; db: number }[] = []
  try {
    const { data: prospects } = await supabaseAdmin.from('dig_prospects').select('*')
    const cnt: Record<string, number> = {}
    for (const p of prospects || []) {
      if ((p.status === 'approved' || p.status === 'assigned') && String(p.call_date || p.approved_at || '').startsWith(ym)) {
        const nm = String(p.user_name || p.dig_user_name || p.dig_user_id || '').trim()
        if (nm) cnt[nm] = (cnt[nm] || 0) + 1
      }
    }
    for (const [name, db] of Object.entries(cnt)) dig.push({ name, db })
  } catch { /* ignore */ }

  // 직원 현황 (블락·테스트 제외)
  const { data: users } = await supabaseAdmin.from('users').select('name, role, username, blocked')
  const staff: Record<string, string[]> = { sales: [], ops: [], dig: [] }
  for (const u of users || []) {
    if (u.blocked || /tester/i.test(`${u.username} ${u.name}`)) continue
    if (staff[u.role]) staff[u.role].push(u.name)
  }

  // 영업 월 평균(지난 3개월 완료분) — 새 직원 성장 좌표용
  const avg = (() => {
    const ms = [monthKey(-1), monthKey(-2), monthKey(-3)].map(monthly)
    const cnt = ms.map(m => sumCount(m))
    const rev = ms.map(m => Object.values(m).reduce((s, v) => s + v.revenue, 0))
    return { count: cnt.reduce((a, b) => a + b, 0) / 3, revenue: rev.reduce((a, b) => a + b, 0) / 3 }
  })()

  return NextResponse.json({
    month: ym,
    sales: {
      count: Math.round(sumCount(cur) * 100) / 100,
      revenue: salesRevenueTotal || people.reduce((s, p) => s + p.revenue, 0),
      people,
      hist1: Math.round(sumCount(monthly(ym1)) * 100) / 100,
      hist2: Math.round(sumCount(monthly(ym2)) * 100) / 100,
      avg3: { count: Math.round(avg.count * 100) / 100, revenue: Math.round(avg.revenue) },
    },
    ops: { feeRevenue: opsFee, ownContractRevenue: opsOwn },
    dig,
    staff,
    syncedAt: new Date().toISOString(),
  })
}
