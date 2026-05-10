/**
 * 관리팀(백승협) 먼데이 전산 자료 → Supabase ops_cases 마이그레이션
 * 실행: node scripts/migrate-ops.cjs
 */

const xlsx = require('../node_modules/xlsx')
const { createClient } = require('../node_modules/@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SERVICE_KEY  = process.env.SERVICE_KEY  || ''
const sb = createClient(SUPABASE_URL, SERVICE_KEY)

// 관리팀 담당자 백승협
const OPS_USER_ID = '01f49706-01a7-4ff9-9df1-3ef0affae6d3' // placeholder – update if needed

// 영업팀 담당자 매핑 (담당자 컬럼 값 → owner_id)
const SALES_USERS = {
  '손제후': '01f49706-01a7-4ff9-9df1-3ef0affae6d3',
  '김윤지': '5279cef9-7443-49be-9047-aa73f5e66849',
  '백승협': '01f49706-01a7-4ff9-9df1-3ef0affae6d3', // fallback to 손제후
}

const BASE = 'C:/Users/user/Desktop/박원태/먼데이 전산 자료/관리팀'

// 기관 그룹 헤더 → institution_type 매핑
const INST_GROUP_MAP = {
  '중진공':   'jungzin',
  '신취':     'sojin_new',
  '혁신':     'sojin_innov',
  '재도전':   'sojin_retry',
  '기보':     'kibo',
  '신보':     'shinbo',
  '재단':     'foundation',
  '미소':     'foundation',
  '대안 없음 걍 핸들링': null,  // skip
}

// Excel stage → DB stage (허용값: 검토중, 접수, 진행중, 완료)
function mapStage(excelStage, isCompleted, isRefund) {
  if (isCompleted || isRefund) return '완료'
  const s = String(excelStage || '').trim()
  if (!s) return '검토중'
  if (s.includes('서류')) return '검토중'
  if (s.includes('홀딩')) return '검토중'
  if (s.includes('보정')) return '검토중'
  if (s.includes('접수 전') || s === '접수전') return '접수'
  if (s.includes('신청')) return '진행중'
  if (s.includes('승인')) return '진행중'
  if (s.includes('부결')) return '완료'
  return '검토중'
}

function excelDateToStr(v) {
  if (!v) return ''
  if (typeof v === 'string' && v.match(/\d{4}-\d{2}/)) return v.slice(0, 10)
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400000)
    return d.toISOString().slice(0, 10)
  }
  return String(v)
}

function readSheet(filePath, sheetIndex) {
  const wb = xlsx.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[sheetIndex || 0]]
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' })
}

function isGroupHeader(row, headers) {
  // 그룹 헤더: Name 컬럼값이 기관명이고 stage 컬럼이 비어있거나
  // 또는 Name=="Name" (반복 헤더행)
  if (!row[0] || row[0] === '') return true  // empty row
  const nameVal = String(row[0]).trim()
  if (nameVal === 'Name') return true  // repeated header
  if (INST_GROUP_MAP.hasOwnProperty(nameVal)) return true
  return false
}

function parseOpsFile(filePath, fileType) {
  // fileType: 'active' | 'completed' | 'refund'
  const rows = readSheet(filePath, 0)
  const results = []

  let headers = null
  let currentInstitutionType = 'new'  // default for rows before any group header

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row[0] && !row[1]) continue  // completely empty row

    const nameVal = String(row[0]).trim()

    // Detect header row
    if (nameVal === 'Name') {
      headers = row
      continue
    }

    // Detect institution group headers
    if (INST_GROUP_MAP.hasOwnProperty(nameVal)) {
      const mappedType = INST_GROUP_MAP[nameVal]
      if (mappedType === null) {
        // Skip rows until next group header
        currentInstitutionType = null
        continue
      }
      currentInstitutionType = mappedType
      continue
    }

    // Skip title/subtitle rows (rows 0, 1 and section separators)
    if (i < 3) continue
    if (!headers) continue
    if (currentInstitutionType === null) continue  // in "skip" section

    // Build object from headers
    const obj = {}
    headers.forEach((h, idx) => { if (h) obj[String(h).trim()] = row[idx] })

    const companyName = String(obj['Name'] || obj['신규업체'] || '').trim()
    if (!companyName || companyName === '종료 업체' || companyName === '환불 업체' || companyName === '신규 업체') continue

    const isRefund    = fileType === 'refund'
    const isCompleted = fileType === 'completed' || fileType === 'refund'
    const excelStage  = String(obj['현재 진행 상태'] || '').trim()
    const stage       = mapStage(excelStage, isCompleted, isRefund)

    const contractDate   = excelDateToStr(obj['계약 날짜'])
    const contractFee    = Number(obj['계약금 (부가세 제외)'] || 0)
    const paidFee        = Number(obj['입금액 (부가세 제외)'] || 0)
    const approvedAmount = Number(obj['승인금액'] || 0)
    const commissionRate = Number(obj['수수료율'] || 0)
    const commission     = Number(obj['수수료'] || 0)
    const revenue        = Number(obj['총 매출'] || paidFee || 0)

    const managerName   = String(obj['담당자'] || '').trim()
    const salesOwnerId  = SALES_USERS[managerName] || SALES_USERS['손제후']

    const phone = String(obj['Item ID (auto generated)'] || '').trim()

    results.push({
      company_name:      companyName,
      phone,
      institution_type:  currentInstitutionType || 'new',
      stage,
      excel_stage:       excelStage,  // for memo
      memo:              String(obj['자금 디테일 내용'] || '').trim(),
      next_plan:         String(obj['이후 진행 예정'] || '').trim(),
      required_checks:   String(obj['신청전 필수 확인할거'] || '').trim(),
      fund_solution:     String(obj['이전 접수 내용'] || '').trim(),
      revenue,
      approved_amount:   approvedAmount,
      commission_amount: commission,
      visit_date:        contractDate || null,
      is_refund:         isRefund,
      is_completed:      isCompleted,
      sales_owner_id:    salesOwnerId,
      manager_name:      managerName,
    })
  }

  return results
}

async function getOrCreateCustomer(companyName, salesOwnerId) {
  // Search by name
  const { data } = await sb.from('customers')
    .select('id')
    .ilike('name', companyName)
    .limit(1)

  if (data && data.length > 0) return data[0].id

  // Also try details->company
  const { data: d2 } = await sb.from('customers')
    .select('id')
    .contains('details', { company: companyName })
    .limit(1)
  if (d2 && d2.length > 0) return d2[0].id

  // Create new customer
  const { data: newCust, error } = await sb.from('customers').insert({
    name:     companyName,
    phone:    '',
    status:   'contracted',
    owner_id: salesOwnerId,
    source:   'self',
    details:  { company: companyName },
  }).select('id').single()

  if (error) throw new Error('고객 생성 실패: ' + error.message)
  return newCust.id
}

async function migrateOps() {
  console.log('\n=== 관리팀(백승협) 마이그레이션 시작 ===\n')

  // First, find백승협's ops user id
  const { data: opsUser } = await sb.from('users').select('id').eq('name', '백승협').limit(1)
  const opsOwnerId = (opsUser && opsUser.length > 0) ? opsUser[0].id : OPS_USER_ID
  console.log('관리팀 owner_id:', opsOwnerId)

  const activeRows    = parseOpsFile(BASE + '/백승협 진행업체.xlsx', 'active')
  const completedRows = parseOpsFile(BASE + '/백승협 종료업체.xlsx', 'completed')
  const refundRows    = parseOpsFile(BASE + '/백승협 환불업체.xlsx', 'refund')
  const allRows       = [...activeRows, ...completedRows, ...refundRows]

  console.log(`파싱 완료: 진행 ${activeRows.length}건, 종료 ${completedRows.length}건, 환불 ${refundRows.length}건`)
  console.log('총:', allRows.length + '건\n')

  let success = 0, failed = 0, errors = []

  for (const row of allRows) {
    try {
      // 1) 고객 조회/생성
      const customerId = await getOrCreateCustomer(row.company_name, row.sales_owner_id)

      // 2) 계약 생성
      const { data: contract, error: contractErr } = await sb.from('contracts').insert({
        customer_id:    customerId,
        sales_owner_id: row.sales_owner_id,
      }).select('id').single()

      if (contractErr) throw new Error('계약 생성 실패: ' + contractErr.message)

      // 3) ops_case 생성
      const memoText = [
        row.excel_stage ? `[원본단계: ${row.excel_stage}]` : '',
        row.memo || '',
      ].filter(Boolean).join('\n')

      const { error: opsErr } = await sb.from('ops_cases').insert({
        contract_id:      contract.id,
        owner_id:         opsOwnerId,
        customer_name:    row.company_name,
        phone:            row.phone || '',
        institution_type: row.institution_type,
        stage:            row.stage,
        memo:             memoText,
        next_plan:        row.next_plan || '',
        required_checks:  row.required_checks || '',
        fund_solution:    row.fund_solution || '',
        revenue:          row.revenue || 0,
        approved_amount:  row.approved_amount || 0,
        commission_amount: row.commission_amount || 0,
        visit_date:       row.visit_date || null,
        is_refund:        row.is_refund || false,
        is_completed:     row.is_completed || false,
      })

      if (opsErr) throw new Error('ops_case 생성 실패: ' + opsErr.message)

      process.stdout.write('.')
      success++
    } catch (e) {
      process.stdout.write('✗')
      failed++
      errors.push(`${row.company_name}: ${e.message}`)
    }
  }

  console.log(`\n\n결과: ${success}건 성공, ${failed}건 실패`)
  if (errors.length > 0) {
    console.log('\n실패 목록:')
    errors.forEach(e => console.log(' -', e))
  }
  console.log('\n✅ 마이그레이션 완료')
}

;(async () => {
  await migrateOps()
  process.exit(0)
})()
