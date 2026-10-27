// 인콜카드 타임스탬프 — CRM에서 버튼·선택·등록 같은 "행위"가 일어날 때마다 서버가 자동으로 남긴다.
// 글자 하나하나가 아니라 큰 변화(단계 변경, 기관 선택, DB 이동, 재통화 일정, 메모 등록 등)만 기록한다.
// 저장 위치: customers.details.activity_log (영업팀 행위) / ops_cases.details.activity_log (관리팀 행위)

export interface ActLog { at: string; by: string; role: string; action: string; detail?: string; n?: number }
export interface Actor { name: string; role: string }

const MAX_LOGS = 400
const UNDO_MS = 10 * 1000             // 10초 안에 같은 버튼을 되돌리면 기록을 남기지 않는다
const COALESCE_MS = 30 * 60 * 1000   // 같은 사람이 같은 종류를 30분 안에 반복 수정하면 한 줄로 합친다

export const nowKstIso = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('Z', '+09:00')

const BUCKET: Record<string, string> = { lead: '공가DB', consulting: '공가DB', db010: '직가DB', emotional: '감성톡', trash: '자체거절', contracted: '계약', active: '공가DB' }
const bk = (s: any) => BUCKET[String(s ?? '')] || String(s ?? '') || '없음'
const same = (a: any, b: any) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const str = (v: any) => (v === undefined || v === null ? '' : String(v))
const short = (v: any, n = 28) => { const t = str(v).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t }

type Rule = { label: string; kind: 'value' | 'edit' | 'flag' }   // value: 값을 보여줌 · edit: "수정"만 표시(합침) · flag: 켜짐/꺼짐

// ── 영업팀(customers.details) ─────────────────────────────────────────
const CUSTOMER_RULES: Record<string, Rule> = {
  follow_up_date:   { label: '재통화 일정', kind: 'value' },
  subcall_date:     { label: '재통화 일정', kind: 'value' },
  call_result:      { label: '결정전 결과', kind: 'value' },
  closing_result:   { label: '결정 결과', kind: 'value' },
  sensitivity:      { label: '감도', kind: 'value' },
  rejection_mood:   { label: '감성톡 감도', kind: 'value' },
  innovation:       { label: '혁신요건', kind: 'value' },
  inspection_status:{ label: '심사', kind: 'value' },
  as_requested:     { label: 'A/S 요청', kind: 'flag' },
  delete_requested: { label: '삭제 요청', kind: 'flag' },
  ops_transferred:  { label: '자금팀 전송', kind: 'flag' },
  is_cancelled:     { label: '계약 취소', kind: 'flag' },
  result_memo:      { label: '통화메모', kind: 'edit' },
  contract_fee:     { label: '계약 정보 입력', kind: 'edit' },
  required_funds:   { label: '필요자금 입력', kind: 'edit' },
  solution:         { label: '솔루션 입력', kind: 'edit' },
}

// ── 관리팀(ops_cases.details) ────────────────────────────────────────
const OPS_RULES: Record<string, Rule> = {
  direct_stage:      { label: '직접 단계', kind: 'value' },
  indirect_stage:    { label: '보증 단계', kind: 'value' },
  direct_visit_date: { label: '방문일(직접)', kind: 'value' },
  indirect_visit_date:{ label: '방문일(보증)', kind: 'value' },
  direct_inspection_date: { label: '심사일(직접)', kind: 'value' },
  indirect_inspection_date: { label: '심사일(보증)', kind: 'value' },
  deposit_date:      { label: '입금일', kind: 'value' },
  contract_date:     { label: '계약일', kind: 'value' },
  approval_amount:   { label: '승인금액', kind: 'value' },
  cert_status:       { label: '인증서 상태', kind: 'value' },
  tax_invoice_issued:{ label: '세금계산서 발행', kind: 'flag' },
  tax_invoice_requested: { label: '세금계산서 요청', kind: 'flag' },
  tax_invoice_completed: { label: '세금계산서 완료', kind: 'flag' },
  fee_locked:        { label: '1차 입금 잠금', kind: 'flag' },
  is_holding:        { label: '보류', kind: 'flag' },
  consulting_sent:   { label: '컨설팅 발송', kind: 'flag' },
  payment_entries:   { label: '입금 내역', kind: 'edit' },
  handling_memo:     { label: '처리 메모', kind: 'edit' },
  incall_journal:    { label: '인콜일지', kind: 'edit' },
  absorption_stage:  { label: '흡수 단계', kind: 'value' },
  revenue_owner:     { label: '매출 귀속', kind: 'value' },
  fee_payment_type:  { label: '수수료 결제방식', kind: 'value' },
  cert_programs:     { label: '인증서 프로그램', kind: 'edit' },
  consulting_status: { label: '컨설팅 상태', kind: 'value' },
  fee_amount:        { label: '수수료 입력', kind: 'edit' },
  contract_notes:    { label: '계약 메모', kind: 'edit' },
}

function push(out: ActLog[], a: Actor, action: string, detail?: string) {
  out.push({ at: nowKstIso(), by: a.name || '—', role: a.role, action, ...(detail ? { detail } : {}) })
}

function diffDetails(prev: any, next: any, rules: Record<string, Rule>, a: Actor, out: ActLog[]) {
  const seen = new Set<string>()
  for (const [key, rule] of Object.entries(rules)) {
    const pv = prev?.[key], nv = next?.[key]
    if (same(pv, nv)) continue
    if (rule.kind === 'edit') {
      if (str(nv) === '' && str(pv) === '') continue
      if (key === 'payment_entries' || key === 'incall_journal') { if (same(pv, nv)) continue }
      const tag = rule.label + ' 수정'
      if (seen.has(tag)) continue
      seen.add(tag); push(out, a, rule.label + (str(pv) ? ' 수정' : ' 등록'))
    } else if (rule.kind === 'flag') {
      if (!!pv === !!nv) continue
      push(out, a, rule.label + (nv ? ' 체크' : ' 해제'))
    } else {
      const label = rule.label
      if (str(pv) === str(nv)) continue
      push(out, a, label, nv ? (str(pv) ? `${short(pv)} → ${short(nv)}` : short(nv)) : `${short(pv)} 삭제`)
    }
  }
}

// 규칙에 없는 키라도 날짜·단계·상태·유형 값이 바뀌면 남긴다 (글자 입력성 필드는 제외)
function diffGeneric(prev: any, next: any, known: Set<string>, a: Actor, out: ActLog[]) {
  for (const k of Object.keys(next || {})) {
    if (known.has(k) || k === 'activity_log' || k === 'incall_journal' || k === 'sales_customer_info') continue
    const pv = prev?.[k], nv = next[k]
    if (same(pv, nv)) continue
    if (typeof nv === 'boolean' || typeof pv === 'boolean') { if (!!pv !== !!nv) push(out, a, `체크: ${k}`, nv ? '켬' : '끔'); continue }
    if (/(_date|_stage|_status|_type|_mood|_result)$/.test(k) && typeof nv !== 'object') push(out, a, k, nv ? (str(pv) ? `${short(pv)} → ${short(nv)}` : short(nv)) : `${short(pv)} 삭제`)
  }
}

/** 영업팀 고객 카드 변경 내역 */
export function diffCustomer(
  existing: { status?: string; owner_id?: string | null; details?: any; call_timeline?: any[] },
  next: { status?: string; owner_id?: string | null; details?: any; call_timeline?: any[] },
  a: Actor,
): ActLog[] {
  const out: ActLog[] = []
  const pd = existing.details || {}, nd = next.details || pd
  const prevB = pd.sub_status || existing.status, nextB = nd.sub_status || next.status || existing.status
  if (prevB !== nextB) push(out, a, nextB === 'contracted' ? '계약 완료' : 'DB 이동', nextB === 'contracted' ? undefined : `${bk(prevB)} → ${bk(nextB)}`)
  if (str(pd.sales_user_name) !== str(nd.sales_user_name) && str(nd.sales_user_name)) push(out, a, '담당자 변경', `${str(pd.sales_user_name) || '미배정'} → ${str(nd.sales_user_name)}`)
  const pt = existing.call_timeline || [], nt = next.call_timeline ?? pt
  if (nt.length > pt.length) push(out, a, '타임라인 기록 추가', short(nt[nt.length - 1]?.content, 30))
  else if (nt.length < pt.length) push(out, a, '타임라인 기록 삭제')
  diffDetails(pd, nd, CUSTOMER_RULES, a, out)
  diffGeneric(pd, nd, new Set([...Object.keys(CUSTOMER_RULES), 'sub_status', 'transfer_history', 'db010_month', 'sales_user_name']), a, out)
  return out
}

/** 관리팀 케이스 변경 내역 */
export function diffOps(
  existing: { stage?: string; institution?: string; owner_id?: any; ops_user_name?: string; details?: any; timeline?: any[] },
  patch: Record<string, any>,
  a: Actor,
): ActLog[] {
  const out: ActLog[] = []
  if (patch.stage !== undefined && patch.stage !== existing.stage) push(out, a, '진행단계', `${existing.stage || '없음'} → ${patch.stage}`)
  if (patch.institution !== undefined && str(patch.institution) !== str(existing.institution)) {
    const p = str(existing.institution).split(',').map(s => s.trim()).filter(Boolean)
    const n = str(patch.institution).split(',').map(s => s.trim()).filter(Boolean)
    const add = n.filter(x => !p.includes(x)), del = p.filter(x => !n.includes(x))
    push(out, a, '기관 선택', [...add.map(x => `+${x}`), ...del.map(x => `−${x}`)].join(' '))
  }
  if (patch.owner_id !== undefined && str(patch.owner_id) !== str(existing.owner_id)) push(out, a, '담당자 변경')
  const pt = existing.timeline || [], nt = patch.timeline
  if (Array.isArray(nt)) { if (nt.length > pt.length) push(out, a, '타임라인 기록 추가', short(nt[nt.length - 1]?.content, 30)); else if (nt.length < pt.length) push(out, a, '타임라인 기록 삭제') }
  if (patch.details) {
    const known = new Set(Object.keys(OPS_RULES))
    diffDetails(existing.details || {}, patch.details, OPS_RULES, a, out)
    // 규칙에 없는 true/false 버튼도 놓치지 않는다
    diffGeneric(existing.details || {}, patch.details, known, a, out)
  }
  return out
}

/** 기존 기록 뒤에 새 기록을 붙인다. 같은 사람의 같은 "수정"은 30분 안에 한 줄로 합친다. */
function invert(detail?: string) {
  if (!detail) return ''
  if (detail.includes(' → ')) { const [x, y] = detail.split(' → '); return `${y} → ${x}` }
  return detail.split(' ').map(t => (t.startsWith('+') ? '−' + t.slice(1) : t.startsWith('−') ? '+' + t.slice(1) : t)).join(' ')
}
const flagBase = (s: string) => s.replace(/ (체크|해제)$/, '')
function isUndo(prev: ActLog, e: ActLog) {
  if (prev.by !== e.by || Date.parse(e.at) - Date.parse(prev.at) > UNDO_MS) return false
  if (/ (체크|해제)$/.test(e.action) && /(체크|해제)$/.test(prev.action)) return flagBase(prev.action) === flagBase(e.action) && prev.action !== e.action
  if (prev.action !== e.action) return false
  if (e.action.startsWith('체크:')) return false
  return !!prev.detail && prev.detail === invert(e.detail)
}

export function mergeLogs(existing: ActLog[] | undefined, added: ActLog[]): ActLog[] {
  const log = [...(existing || [])]
  for (const e of added) {
    // 방금(10초 안에) 한 행위를 같은 사람이 되돌리면 둘 다 지운다
    const idx = log.length - 1 - [...log].reverse().findIndex(p => isUndo(p, e))
    if (log.length && [...log].reverse().some(p => isUndo(p, e))) { log.splice(idx, 1); continue }
    const last = log[log.length - 1]
    const mergeable = /(등록|수정)$/.test(e.action) || e.action === '인콜일지 수정'
    if (mergeable && last && last.action === e.action && last.by === e.by && Date.parse(e.at) - Date.parse(last.at) < COALESCE_MS) {
      log[log.length - 1] = { ...last, at: e.at, n: (last.n || 1) + 1 }
    } else log.push(e)
  }
  return log.slice(-MAX_LOGS)
}

/** details에 기록을 적용한다. 클라이언트가 보낸 activity_log는 무시하고 서버의 것을 유지한다. */
export function withLog(details: any, existingDetails: any, added: ActLog[]) {
  const base = { ...(details || {}) }
  // 서버가 따로 저장하는 값(계약서 입력 내용)은 클라이언트가 보낸 오래된 값으로 덮이지 않게 유지
  if (existingDetails && existingDetails.contract_draft !== undefined) base.contract_draft = existingDetails.contract_draft
  const merged = mergeLogs(existingDetails?.activity_log, added)
  if (merged.length) base.activity_log = merged
  else delete base.activity_log
  return base
}
