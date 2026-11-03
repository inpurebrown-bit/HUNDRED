import { supabaseAdmin } from '@/lib/supabase'

// 발굴팀 승인 건 → 영업팀 공급DB 배정.
// 대표가 퇴근 전에 배정해 두면 "예약"으로 쌓였다가 다음 영업일 아침(RELEASE_HOUR_KST시)에 한꺼번에 해당 사원 DB로 들어간다.
// 긴급배정 건은 즉시 배정한다. 예약 목록은 settings 'dig_assign_queue' 에 보관.
export const RELEASE_HOUR_KST = 9
const QUEUE_KEY = 'dig_assign_queue'

export interface QueueItem { prospect_id: string; assigned_to: string; assigned_to_name: string; release_at: string; queued_by: string; queued_at: string }
export interface Actor { name: string; role: string }

const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000)
const kstIso = () => kstNow().toISOString().replace('Z', '+09:00')

/** 지금 이후 처음 오는 RELEASE_HOUR_KST시 (이미 지났으면 내일) */
export function nextReleaseAt(): string {
  const k = kstNow()
  const day = k.toISOString().slice(0, 10)
  const hh = String(RELEASE_HOUR_KST).padStart(2, '0')
  let target = new Date(`${day}T${hh}:00:00+09:00`)
  if (target.getTime() <= Date.now()) target = new Date(target.getTime() + 24 * 3600 * 1000)
  return target.toISOString()
}

export async function loadQueue(): Promise<QueueItem[]> {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', QUEUE_KEY).maybeSingle()
  return (data?.value?.items as QueueItem[]) || []
}
async function saveQueue(items: QueueItem[]) {
  await supabaseAdmin.from('settings').upsert({ key: QUEUE_KEY, value: { items } }, { onConflict: 'key' })
}

export async function queueAssign(ids: string[], assigned_to: string, assigned_to_name: string, actor: Actor) {
  const items = await loadQueue()
  const release_at = nextReleaseAt()
  const now = new Date().toISOString()
  const keep = items.filter(i => !ids.includes(i.prospect_id))
  for (const id of ids) keep.push({ prospect_id: id, assigned_to, assigned_to_name, release_at, queued_by: actor.name, queued_at: now })
  await saveQueue(keep)
  return release_at
}

export async function cancelQueue(id: string) {
  const items = await loadQueue()
  await saveQueue(items.filter(i => i.prospect_id !== id))
}

/** 승인된 가망 1건을 영업 직원의 공급DB 고객으로 만든다. 이미 배정됐으면 건너뛴다. */
export async function assignProspect(id: string, assigned_to: string, assigned_to_name: string, actor: Actor): Promise<{ ok: boolean; error?: string }> {
  // 먼저 선점 (동시에 두 번 배정되는 것 방지)
  const { data: claimed } = await supabaseAdmin
    .from('dig_prospects')
    .update({ status: 'assigned', assigned_to, assigned_to_name, assigned_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'approved')
    .select('*').maybeSingle()
  if (!claimed) return { ok: false, error: '승인 상태의 가망이 아니거나 이미 배정됨' }
  const prospect: any = claimed
  const revert = async () => { await supabaseAdmin.from('dig_prospects').update({ status: 'approved', assigned_to: null, assigned_to_name: null, assigned_at: null }).eq('id', id) }

  // 통화메모 → 영업 타임라인 / 통화 희망시간 → 영업사원 재통화 일정
  const ra = (prospect.recording_analysis || {}) as any
  const pct = String(prospect.preferred_call_time || '')
  let cbDate = '', cbTime = ''
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(pct.slice(0, 16)) && !/(Z|[+-]\d{2}:?\d{2})$/.test(pct)) {
    cbDate = pct.slice(0, 10); cbTime = pct.slice(11, 16)
  } else if (pct) {
    const d = new Date(pct)
    if (!isNaN(d.getTime())) {
      const kst = d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
      cbDate = kst.slice(0, 10); cbTime = kst.slice(11, 16)
    }
  }
  // 타임라인 메모: "통화 희망 + 특이사항" (AI 요약은 넣지 않음)
  const note = String(ra.dig_note || '').trim() || String(prospect.memo || '').trim() || String(prospect.required_fund || '').trim()
  const memoParts: string[] = []
  if (cbDate) memoParts.push(`통화희망 ${cbDate.slice(5).replace('-', '/')} ${cbTime}`)
  if (note) memoParts.push(`특이사항: ${note}`)
  const digTimeline = memoParts.length ? [{ user: prospect.dig_user_name || '발굴', content: memoParts.join('\n'), created_at: kstIso() }] : []
  const at = kstIso()

  const { data: newCustomer, error: custErr } = await supabaseAdmin
    .from('customers')
    .insert({
      name: prospect.ceo_name || '(미입력)',
      phone: prospect.phone_010 || prospect.phone,
      source: 'lead',          // DB CHECK: 'self'|'lead' — 자체공급도 공급파이프라인(공가) 경로
      status: 'active',        // DB CHECK: 'active'|'contracted'
      owner_id: assigned_to,
      call_timeline: digTimeline,
      details: {
        sub_status: 'lead',
        ...(cbDate ? { follow_up_date: cbDate, follow_up_time: cbTime } : {}),
        ...(prospect.urgent_assign ? { urgent_assign: true } : {}),
        supply_source: 'self_supply',   // 자체공급 식별자 (대표 화면 전용)
        reception_date: kstNow().toISOString().slice(0, 10),
        company: prospect.company,
        sales_user_name: assigned_to_name,
        years_in_business: prospect.business_age,
        business_type: prospect.industry,
        revenue_2026: prospect.annual_revenue,
        credit_score: prospect.credit_score,
        tax_delinquency: prospect.memo || (prospect.has_delinquency ? '있음' : '없음'),
        required_funds: prospect.required_fund,
        business_age: prospect.business_age,
        annual_revenue: prospect.annual_revenue,
        industry: prospect.industry,
        has_delinquency: prospect.has_delinquency,
        required_fund: prospect.required_fund,
        dig_prospect_id: prospect.id,
        dig_user_name: prospect.dig_user_name,
        dig_phone_010: prospect.phone_010,
        activity_log: [
          { at, by: actor.name || '대표', role: actor.role, action: 'DB 등록', detail: `담당 ${assigned_to_name}` },
          ...(cbDate ? [{ at, by: actor.name || '대표', role: actor.role, action: '재통화 일정', detail: `${cbDate} ${cbTime}` }] : []),
        ],
      },
    })
    .select()
    .single()
  if (custErr || !newCustomer) { await revert(); return { ok: false, error: custErr?.message || '고객 생성 실패' } }

  await supabaseAdmin.from('dig_prospects').update({ customer_id: newCustomer.id }).eq('id', id)

  // 자체공급 카운트 자동 증가 (supply-config self_supplied)
  const { data: cfgRow } = await supabaseAdmin.from('notices').select('id, content').eq('notice_type', 'supply_config').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (cfgRow) {
    try {
      const cfg = JSON.parse(cfgRow.content || '{}')
      const people = cfg.people || {}
      const emp = people[assigned_to_name] || { supplied: 0, goal: 30, base: 0, self_supplied: 0 }
      emp.self_supplied = (emp.self_supplied || 0) + 1
      people[assigned_to_name] = emp
      cfg.people = people
      await supabaseAdmin.from('notices').update({ content: JSON.stringify(cfg) }).eq('id', cfgRow.id)
    } catch {}
  }
  return { ok: true }
}

/** 시각이 된 예약 배정을 실제로 넣는다 (cron 과 고객·가망 조회 때 함께 호출) */
export async function releaseDue(): Promise<number> {
  const items = await loadQueue()
  if (!items.length) return 0
  const now = Date.now()
  const due = items.filter(i => Date.parse(i.release_at) <= now)
  if (!due.length) return 0
  // 같은 항목을 다른 요청이 동시에 처리하지 않게 먼저 목록에서 뺀다 (assignProspect 도 중복을 막는다)
  await saveQueue(items.filter(i => Date.parse(i.release_at) > now))
  let n = 0
  for (const i of due) {
    const r = await assignProspect(i.prospect_id, i.assigned_to, i.assigned_to_name, { name: i.queued_by || '대표', role: 'ceo' })
    if (r.ok) n++
  }
  return n
}
