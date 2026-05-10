/**
 * DB 실제 스키마:
 *   owner_id, source('self'|'lead'), name, phone, loan_history,
 *   memo, status('active'|'contracted'), created_at, details(JSONB), call_timeline(array)
 *
 * Frontend 기대값:
 *   sales_user_id, company, notes, sales_user_name,
 *   status: 'lead'|'db010'|'contracted'|'emotional'|'trash'
 *
 * 이 파일이 양쪽을 중재합니다.
 */

/** DB 상태 → 프론트 상태 매핑 */
export function normalizeCustomer(raw: any) {
  if (!raw) return raw

  // sub_status가 있으면 그걸 status로 사용, 없으면 DB status 그대로
  const sub = raw.details?.sub_status
  const status = sub || (raw.status === 'contracted' ? 'contracted' : 'lead')

  return {
    ...raw,
    status,
    company:         raw.company         ?? raw.details?.company         ?? '',
    notes:           raw.notes           ?? raw.memo                     ?? raw.details?.notes ?? '',
    sales_user_id:   raw.sales_user_id   ?? raw.owner_id                 ?? '',
    sales_user_name: raw.sales_user_name ?? raw.details?.sales_user_name ?? '',
  }
}

export function normalizeCustomers(rows: any[]) {
  return (rows || []).map(normalizeCustomer)
}

/** 프론트 요청 바디 → DB insert/update row 변환 */
export function toDbRow(
  body: Record<string, any>,
  assignedUserId: string,
  assignedUserName: string,
  existingDetails?: Record<string, any>
) {
  const { name, phone, company, loan_history, notes, memo, status, details, source } = body

  const frontStatus = status || 'lead'
  // DB에서 허용하는 status: 'active' | 'contracted'
  const dbStatus = frontStatus === 'contracted' ? 'contracted' : 'active'

  const mergedDetails: Record<string, any> = {
    ...(existingDetails || {}),
    ...(details || {}),
    company:          company          ?? details?.company          ?? existingDetails?.company ?? '',
    sales_user_name:  assignedUserName ?? details?.sales_user_name  ?? '',
    // contracted가 아니면 sub_status에 실제 상태 저장
    sub_status:       frontStatus !== 'contracted' ? frontStatus : undefined,
  }
  // undefined 제거
  if (mergedDetails.sub_status === undefined) delete mergedDetails.sub_status

  return {
    name:         (name || '').trim(),
    phone:        phone        ?? '',
    loan_history: loan_history ?? '',
    memo:         memo ?? notes ?? details?.notes ?? '',
    status:       dbStatus,
    owner_id:     assignedUserId,
    source:       source ?? 'self',
    details:      mergedDetails,
  }
}

/** PATCH용: 상태만 변경할 때 */
export function statusPatch(newStatus: string, existingDetails: Record<string, any> = {}) {
  const dbStatus = newStatus === 'contracted' ? 'contracted' : 'active'
  const details = {
    ...existingDetails,
    sub_status: newStatus !== 'contracted' ? newStatus : undefined,
  }
  if (details.sub_status === undefined) delete details.sub_status
  return { status: dbStatus, details }
}
