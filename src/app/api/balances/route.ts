import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isV2Contract, parseMoney, V2_START } from '@/lib/payrollV2'

// 잔금 관리 — 1년 관리비(선금·잔금) 계약의 잔금을 놓치지 않게: 남은 잔금, 기한(업무 세팅 후 90일), 요청 이력, 완납 표시.
// 대표는 전부, 관리팀은 자기가 맡은 건만 본다.
function kstToday() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10) }
function addDays(d: string, n: number) { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10) }
function diffDays(a: string, b: string) { return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000) }

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const me = session.user as any
  if (me.role !== 'ceo' && me.role !== 'ops') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  let all: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from('customers').select('id, name, phone, status, details, owner_id').eq('status', 'contracted').range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    all = all.concat(data || [])
    if (!data || data.length < 1000) break
  }
  const targets = all.filter(c => isV2Contract(c) && parseMoney(c.details?.contract_fee) > 0)

  // 관리팀 담당자 (ops_cases)
  const ids = targets.map(c => c.id)
  const opsByCustomer: Record<string, string> = {}
  if (ids.length) {
    const { data: cases } = await supabaseAdmin.from('ops_cases').select('customer_id, ops_user_name, details').in('customer_id', ids)
    for (const oc of cases || []) opsByCustomer[oc.customer_id] = String(oc.ops_user_name || oc.details?.ops_user_name || '').trim()
  }

  const today = kstToday()
  const items = targets.map(c => {
    const d = c.details || {}
    const total = parseMoney(d.contract_fee)
    const extras: any[] = Array.isArray(d.extra_counts) ? d.extra_counts : []
    const extraSum = extras.reduce((s, e) => s + (parseFloat(String(e?.amount ?? 0).replace(/[^0-9.-]/g, '')) || 0), 0)
    const prepaid = parseMoney(d.net_paid) || (d.vat_included ? Math.round(parseMoney(d.payment_amount) / 1.1) : parseMoney(d.payment_amount))
    const remaining = Math.max(0, total - prepaid - Math.round(extraSum))
    const setupDate = String(d.setup_done_date || d.contract_date || '').slice(0, 10)
    const due = String(d.balance_due_date || (setupDate ? addDays(setupDate, 90) : '')).slice(0, 10)
    const done = remaining <= 0 || d.balance_done === true
    const reqs: any[] = Array.isArray(d.balance_requests) ? d.balance_requests : []
    return {
      id: c.id, company: d.company || c.name, phone: c.phone, sales: String(d.sales_user_name || '').trim(), ops: opsByCustomer[c.id] || '',
      contractDate: String(d.contract_date || '').slice(0, 10), setupDate, due,
      dday: due ? diffDays(due, today) : null,
      total, prepaid, paidExtra: Math.round(extraSum), remaining, done, doneManual: d.balance_done === true && remaining > 0,
      requests: reqs.slice(-5), requestCount: reqs.length,
      payments: extras.map(e => ({ date: String(e.date || '').slice(0, 10), amount: Math.round(parseFloat(String(e?.amount ?? 0).replace(/[^0-9.-]/g, '')) || 0), label: e.label || '잔금' })),
      note: String(d.balance_note || ''),
    }
  }).filter(it => me.role === 'ceo' || (it.ops && it.ops === String(me.name || '').trim()))
  items.sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9999').localeCompare(b.due || '9999'))
  return NextResponse.json({ items, today, since: V2_START })
}

// 잔금 요청 기록 / 잔금 입금 기록 / 완납 표시 / 기한·세팅일·메모 수정
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  const me = session.user as any
  if (me.role !== 'ceo' && me.role !== 'ops') return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const id = String(body.id || '')
  const action = String(body.action || '')
  if (!id) return NextResponse.json({ error: '고객이 필요합니다' }, { status: 400 })
  const { data: c } = await supabaseAdmin.from('customers').select('id, details').eq('id', id).single()
  if (!c) return NextResponse.json({ error: '고객 없음' }, { status: 404 })
  if (me.role === 'ops') {
    const { data: oc } = await supabaseAdmin.from('ops_cases').select('ops_user_name, details').eq('customer_id', id)
    const mine = (oc || []).some(x => String(x.ops_user_name || x.details?.ops_user_name || '').trim() === String(me.name || '').trim())
    if (!mine) return NextResponse.json({ error: '내가 맡은 건이 아닙니다' }, { status: 403 })
  }
  const d: any = { ...(c.details || {}) }
  const today = kstToday()

  if (action === 'request') {
    const reqs = Array.isArray(d.balance_requests) ? d.balance_requests : []
    d.balance_requests = [...reqs, { date: String(body.date || today).slice(0, 10), note: String(body.note || '').slice(0, 200), by: me.name || '' }]
  } else if (action === 'payment') {
    let amt = Math.round(Number(body.amount) || 0)
    if (amt <= 0) return NextResponse.json({ error: '입금액을 입력하세요' }, { status: 400 })
    if (body.vatIncluded) amt = Math.round(amt / 1.1)
    const list = Array.isArray(d.extra_counts) ? d.extra_counts : []
    // 급여·매출이 읽는 기록 형식 (weight: 입금액 10만원당 0.2 — 새 구조 급여는 금액만 쓴다)
    list.push({ date: String(body.date || today).slice(0, 10), weight: Math.max(0.01, Math.round(amt / 100000 * 0.2 * 100) / 100), amount: amt, label: String(body.label || '잔금') })
    d.extra_counts = list
  } else if (action === 'done') {
    d.balance_done = true
  } else if (action === 'undo') {
    d.balance_done = false
  } else if (action === 'edit') {
    if (body.setupDate !== undefined) d.setup_done_date = String(body.setupDate || '').slice(0, 10)
    if (body.due !== undefined) d.balance_due_date = String(body.due || '').slice(0, 10)
    if (body.note !== undefined) d.balance_note = String(body.note || '').slice(0, 300)
  } else {
    return NextResponse.json({ error: '알 수 없는 동작' }, { status: 400 })
  }
  const { error } = await supabaseAdmin.from('customers').update({ details: d }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
