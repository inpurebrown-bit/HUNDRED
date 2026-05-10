/**
 * 먼데이 전산 자료 → Supabase 마이그레이션 스크립트
 * 실행: node scripts/migrate-monday.cjs
 */

const xlsx   = require('../node_modules/xlsx')
const { createClient } = require('../node_modules/@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const sb = createClient(SUPABASE_URL, SERVICE_KEY)

const USERS = {
  '손제후': { id: '01f49706-01a7-4ff9-9df1-3ef0affae6d3', name: '손제후 수석팀장' },
  '김윤지': { id: '5279cef9-7443-49be-9047-aa73f5e66849', name: '김윤지 수석팀장' },
}

const BASE = 'C:/Users/user/Desktop/박원태/먼데이 전산 자료'

function readSheet(filePath, sheetIndex) {
  const wb = xlsx.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[sheetIndex || 0]]
  return xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' })
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

function parseIncallLog(rows) {
  const headers = rows[2]
  const results = []
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    if (!row[0] || row[0] === '') continue
    const obj = {}
    headers.forEach((h, idx) => { if (h) obj[h] = row[idx] })
    results.push({
      company:        obj['Name'] || '',
      name:           obj['이름'] || obj['Name'] || '',
      phone:          String(obj['전화번호'] || '').replace(/[^0-9]/g, ''),
      region:         obj['지역'] || '',
      reception_date: excelDateToStr(obj['접수일자']),
      business_type:  obj['업종'] || '',
      real_work:      obj['실제하는일'] || '',
      patent:         obj['특허 등 지식재산권'] || '',
      innovation:     obj['혁신성장요건'] || '',
      employee_count: String(obj['4대보험가입자 명수'] || ''),
      biz_size:       obj['사업장 규모'] || '',
      revenue_2026:   String(obj['2026년도 매출'] || ''),
      revenue_2025:   String(obj['2025년도 매출'] || ''),
      revenue_2024:   String(obj['2024년도 매출'] || ''),
      revenue_2023:   String(obj['2023년도 매출'] || ''),
      loan_kibo:      String(obj['기보 기대출'] || ''),
      loan_shinbo:    String(obj['신보 기대출'] || ''),
      loan_jaedan:    String(obj['재단 기대출'] || ''),
      loan_jinjong:   String(obj['중진공 기대출'] || ''),
      loan_sojin:     String(obj['소진공 기대출'] || ''),
      loan_other:     String(obj['이외 신용/담보 대출'] || ''),
      loan_total:     String(obj['기대출 합계'] || ''),
      credit_kcb:     String(obj['KCB 점수'] || ''),
      credit_nice:    String(obj['NICE 점수'] || ''),
      tax_status:     obj['세금체납 상태'] || '',
      assets:         String(obj['자산'] || ''),
      required_funds: String(obj['필요자금'] || ''),
      notes:          String(obj['통화내용'] || ''),
      solution:       String(obj['솔루션'] || ''),
      monday_id:      String(obj['Item ID (auto generated)'] || ''),
    })
  }
  return results
}

function parseIncallResult(rows) {
  const headers = rows[2]
  const results = {}
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    if (!row[0]) continue
    const obj = {}
    headers.forEach((h, idx) => { if (h) obj[h] = row[idx] })
    const mondayId = String(obj['Item ID (auto generated)'] || '')
    results[mondayId] = {
      call_result:    obj['결정전 결과'] || '',
      closing_result: obj['클로징 결과'] || '',
      follow_up_date: excelDateToStr(obj['재통화 일정']),
      inspector:      obj['심사원 배정'] || '',
      content:        String(obj['내용'] || ''),
      is_contracted:  !!obj['계약 기업'],
      is_rejected:    !!obj['거절'],
    }
  }
  return results
}

function parseUpdates(rows) {
  const hRow = (rows[0] && rows[0].includes('Item ID')) ? 0 : 1
  const headers = rows[hRow] || []
  const updates = {}
  for (let i = hRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row[0]) continue
    const obj = {}
    headers.forEach((h, idx) => { if (h) obj[h] = row[idx] })
    const id = String(obj['Item ID'] || row[0])
    if (!updates[id]) updates[id] = []
    if (obj['Update Content']) {
      updates[id].push({
        user:       obj['User'] || '',
        created_at: obj['Created At'] || '',
        content:    String(obj['Update Content'] || ''),
        type:       obj['Content Type'] || 'Update',
      })
    }
  }
  return updates
}

function parseRejectDb(rows, status) {
  const headers = rows[2]
  const results = []
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    if (!row[0]) continue
    const obj = {}
    headers.forEach((h, idx) => { if (h) obj[h] = row[idx] })
    results.push({
      company:       obj['Name'] || '',
      phone:         String(obj['전화번호'] || ''),
      region:        obj['지역'] || '',
      business_type: obj['업종'] || '',
      innovation:    obj['혁신성장요건'] || '',
      notes:         String(obj['내용'] || ''),
      monday_id:     String(obj['Item ID (auto generated)'] || ''),
      status,
    })
  }
  return results
}

async function migrate(personKey) {
  const user = USERS[personKey]
  const dir  = `${BASE}/영업팀/${personKey}`

  console.log(`\n=== ${personKey} 마이그레이션 시작 ===`)

  const logRows     = readSheet(`${dir}/${personKey} 인콜일지.xlsx`, 0)
  const resultRows  = readSheet(`${dir}/${personKey} 인콜 결과.xlsx`, 0)
  const updatesRows = readSheet(`${dir}/${personKey} 인콜 결과.xlsx`, 1)

  const logs    = parseIncallLog(logRows)
  const results = parseIncallResult(resultRows)
  const updates = parseUpdates(updatesRows)

  let rejected = [], selfRejected = []
  try { rejected     = parseRejectDb(readSheet(`${dir}/${personKey} 거절DB.xlsx`, 0), 'emotional') } catch(e) {}
  try { selfRejected = parseRejectDb(readSheet(`${dir}/${personKey} 자체거절DB.xlsx`, 0), 'trash') } catch(e) {}

  // 인콜일지 → customers
  let inserted = 0, failed = 0
  for (const log of logs) {
    const r = log.monday_id ? results[log.monday_id] : null
    const updateList = log.monday_id ? (updates[log.monday_id] || []) : []

    // DB: 'active'|'contracted' 만 허용, 나머지는 details.sub_status에 저장
    const frontStatus = r && r.is_contracted ? 'contracted' : r && r.is_rejected ? 'trash' : 'lead'
    const dbStatus = frontStatus === 'contracted' ? 'contracted' : 'active'

    const details = {
      company:        log.company,
      sales_user_name: user.name,
      reception_date: log.reception_date,
      region:         log.region,
      business_type:  log.business_type,
      real_work:      log.real_work,
      patent:         log.patent,
      innovation:     log.innovation,
      employee_count: log.employee_count,
      biz_size:       log.biz_size,
      revenue_2026:   log.revenue_2026,
      revenue_2025:   log.revenue_2025,
      revenue_2024:   log.revenue_2024,
      revenue_2023:   log.revenue_2023,
      loan_kibo:      log.loan_kibo,
      loan_shinbo:    log.loan_shinbo,
      loan_jaedan:    log.loan_jaedan,
      loan_jinjong:   log.loan_jinjong,
      loan_sojin:     log.loan_sojin,
      loan_other:     log.loan_other,
      loan_total:     log.loan_total,
      credit_kcb:     log.credit_kcb,
      credit_nice:    log.credit_nice,
      tax_status:     log.tax_status,
      assets:         log.assets,
      required_funds: log.required_funds,
      solution:       log.solution,
      monday_id:      log.monday_id,
      call_result:    r ? r.call_result    : '',
      closing_result: r ? r.closing_result : '',
      follow_up_date: r ? r.follow_up_date : '',
      inspector:      r ? r.inspector      : '',
      sub_status:     frontStatus !== 'contracted' ? frontStatus : undefined,
    }
    if (details.sub_status === undefined) delete details.sub_status

    const row = {
      name:         log.name || log.company,
      phone:        log.phone,
      loan_history: [log.loan_kibo, log.loan_shinbo, log.loan_jaedan].filter(Boolean).join(' / '),
      memo:         log.notes || (r ? r.content : ''),
      status:       dbStatus,
      owner_id:     user.id,
      source:       'self',
      details,
      call_timeline: updateList,
    }

    const { error } = await sb.from('customers').insert(row)
    if (error) { process.stdout.write('✗'); failed++; if(failed<=3) console.error('\n  오류:', error.message) }
    else { process.stdout.write('.'); inserted++ }
  }
  console.log(`\n  인콜일지: ${inserted}건 성공, ${failed}건 실패`)

  // 거절/자체거절
  let rIns = 0
  for (const r of [...rejected, ...selfRejected]) {
    const { error } = await sb.from('customers').insert({
      name:     r.company,
      phone:    r.phone,
      memo:     r.notes,
      status:   'active',   // DB는 active/contracted만 허용
      owner_id: user.id,
      source:   'self',
      details: {
        company: r.company, sales_user_name: user.name,
        region: r.region, business_type: r.business_type,
        innovation: r.innovation, monday_id: r.monday_id,
        sub_status: r.status,   // 'emotional' | 'trash'
      },
    })
    if (!error) rIns++
  }
  console.log(`  거절DB: ${rIns}건 삽입`)
}

;(async () => {
  await migrate('손제후')
  await migrate('김윤지')
  console.log('\n✅ 전체 마이그레이션 완료')
  process.exit(0)
})()
