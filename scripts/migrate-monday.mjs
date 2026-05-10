/**
 * 먼데이 전산 자료 → Supabase 마이그레이션 스크립트
 * 실행: node scripts/migrate-monday.mjs
 */

import { createClient } from '../node_modules/@supabase/supabase-js/dist/module/index.js'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// xlsx (CJS) 동적 임포트
const { readFile, utils } = await import('../node_modules/xlsx/dist/xlsx.mjs').catch(() => {
  const xlsx = (await import('../node_modules/xlsx/dist/xlsx.mjs'))
  return xlsx
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const sb = createClient(SUPABASE_URL, SERVICE_KEY)

// 사용자 ID 맵
const USERS = {
  '손제후': { id: '01f49706-01a7-4ff9-9df1-3ef0affae6d3', name: '손제후 수석팀장' },
  '김윤지': { id: '5279cef9-7443-49be-9047-aa73f5e66849', name: '김윤지 수석팀장' },
}

const BASE = 'C:/Users/user/Desktop/박원태/먼데이 전산 자료'

function readSheet(filePath, sheetIndex = 0) {
  const wb = readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[sheetIndex]]
  return utils.sheet_to_json(ws, { header: 1, defval: '' })
}

/** 엑셀 시리얼 날짜 → YYYY-MM-DD */
function excelDateToStr(v) {
  if (!v) return ''
  if (typeof v === 'string' && v.includes('-')) return v.slice(0,10)
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400000)
    return d.toISOString().slice(0,10)
  }
  return String(v)
}

/** 인콜일지 파싱 */
function parseIncallLog(rows) {
  const headers = rows[2]   // 3번째 줄이 헤더
  const results = []
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    if (!row[0] || row[0] === '') continue  // 빈 행 스킵

    const obj = {}
    headers.forEach((h, idx) => { if(h) obj[h] = row[idx] })

    results.push({
      company:         obj['Name'] || '',
      name:            obj['이름'] || obj['Name'] || '',
      phone:           String(obj['전화번호'] || '').replace(/[^0-9]/g,'') || '',
      region:          obj['지역'] || '',
      reception_date:  excelDateToStr(obj['접수일자']),
      business_type:   obj['업종'] || '',
      real_work:       obj['실제하는일'] || '',
      patent:          obj['특허 등 지식재산권'] || '',
      innovation:      obj['혁신성장요건'] || '',
      employee_count:  String(obj['4대보험가입자 명수'] || ''),
      biz_size:        obj['사업장 규모'] || '',
      revenue_2026:    String(obj['2026년도 매출'] || ''),
      revenue_2025:    String(obj['2025년도 매출'] || ''),
      revenue_2024:    String(obj['2024년도 매출'] || ''),
      revenue_2023:    String(obj['2023년도 매출'] || ''),
      loan_kibo:       String(obj['기보 기대출'] || ''),
      loan_shinbo:     String(obj['신보 기대출'] || ''),
      loan_jaedan:     String(obj['재단 기대출'] || ''),
      loan_jinjong:    String(obj['중진공 기대출'] || ''),
      loan_sojin:      String(obj['소진공 기대출'] || ''),
      loan_other:      String(obj['이외 신용/담보 대출'] || ''),
      loan_total:      String(obj['기대출 합계'] || ''),
      loan_personal:   String(obj['가계 대출'] || ''),
      credit_kcb:      String(obj['KCB 점수'] || ''),
      credit_nice:     String(obj['NICE 점수'] || ''),
      tax_status:      obj['세금체납 상태'] || '',
      tax_amount:      String(obj['세금체납'] || ''),
      assets:          String(obj['자산'] || ''),
      required_funds:  String(obj['필요자금'] || ''),
      notes:           String(obj['통화내용'] || ''),
      solution:        String(obj['솔루션'] || ''),
      monday_id:       String(obj['Item ID (auto generated)'] || ''),
    })
  }
  return results
}

/** 인콜결과 파싱 */
function parseIncallResult(rows) {
  const headers = rows[2]
  const results = {}
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    if (!row[0]) continue
    const obj = {}
    headers.forEach((h, idx) => { if(h) obj[h] = row[idx] })
    const mondayId = String(obj['Item ID (auto generated)'] || '')
    results[mondayId] = {
      company:         obj['Name'] || '',
      call_result:     obj['결정전 결과'] || '',
      closing_result:  obj['클로징 결과'] || '',
      follow_up_date:  excelDateToStr(obj['재통화 일정']),
      inspector:       obj['심사원 배정'] || '',
      status_label:    obj['상태'] || '',
      content:         String(obj['내용'] || ''),
      is_contracted:   obj['계약 기업'] ? true : false,
      innovation:      obj['혁신성장 요건'] || '',
      is_rejected:     obj['거절'] ? true : false,
    }
  }
  return results
}

/** updates 시트 파싱 (row0이 Item ID row인 경우) */
function parseUpdates(rows) {
  // row[0]이 헤더인 경우와 row[1]이 헤더인 경우가 있음
  const hRow = rows[0]?.includes?.('Item ID') ? 0 : 1
  const headers = rows[hRow] || []
  const updates = {}
  for (let i = hRow + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row[0]) continue
    const obj = {}
    headers.forEach((h, idx) => { if(h) obj[h] = row[idx] })
    const id = String(obj['Item ID'] || row[0])
    if (!updates[id]) updates[id] = []
    if (obj['Update Content'] || obj['Content Type']) {
      updates[id].push({
        user:      obj['User'] || '',
        created_at: obj['Created At'] || '',
        content:   String(obj['Update Content'] || ''),
        type:      obj['Content Type'] || 'Update',
      })
    }
  }
  return updates
}

/** 거절DB 파싱 */
function parseRejectDb(rows, status) {
  const headers = rows[2]
  const results = []
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i]
    if (!row[0]) continue
    const obj = {}
    headers.forEach((h, idx) => { if(h) obj[h] = row[idx] })
    results.push({
      company:    obj['Name'] || '',
      phone:      String(obj['전화번호'] || ''),
      region:     obj['지역'] || '',
      business_type: obj['업종'] || '',
      innovation: obj['혁신성장요건'] || '',
      notes:      String(obj['내용'] || ''),
      monday_id:  String(obj['Item ID (auto generated)'] || ''),
      status,
    })
  }
  return results
}

async function migrate(personKey) {
  const user = USERS[personKey]
  const dir = `${BASE}/영업팀/${personKey}`

  console.log(`\n=== ${personKey} 마이그레이션 시작 ===`)

  // 1. 인콜일지 파싱
  const logRows    = readSheet(`${dir}/${personKey} 인콜일지.xlsx`)
  const resultRows = readSheet(`${dir}/${personKey} 인콜 결과.xlsx`, 0)
  const updatesRows = readSheet(`${dir}/${personKey} 인콜 결과.xlsx`, 1)

  const logs    = parseIncallLog(logRows)
  const results = parseIncallResult(resultRows)
  const updates = parseUpdates(updatesRows)

  // 2. 거절/자체거절
  let rejected = [], selfRejected = []
  try { rejected    = parseRejectDb(readSheet(`${dir}/${personKey} 거절DB.xlsx`), 'emotional') } catch(e){}
  try { selfRejected = parseRejectDb(readSheet(`${dir}/${personKey} 자체거절DB.xlsx`), 'trash') } catch(e){}

  // 3. 인콜일지 데이터 → customers 테이블
  let inserted = 0, skipped = 0
  for (const log of logs) {
    const resultData = log.monday_id ? results[log.monday_id] : null
    const updateList = log.monday_id ? (updates[log.monday_id] || []) : []

    // 인콜 결과에서 status 결정
    let status = 'lead'
    if (resultData?.is_contracted) status = 'contracted'
    else if (resultData?.is_rejected) status = 'trash'

    const details = {
      company:         log.company,
      sales_user_name: user.name,
      reception_date:  log.reception_date,
      region:          log.region,
      business_type:   log.business_type,
      real_work:       log.real_work,
      patent:          log.patent,
      innovation:      log.innovation,
      employee_count:  log.employee_count,
      biz_size:        log.biz_size,
      revenue_2026:    log.revenue_2026,
      revenue_2025:    log.revenue_2025,
      revenue_2024:    log.revenue_2024,
      revenue_2023:    log.revenue_2023,
      loan_kibo:       log.loan_kibo,
      loan_shinbo:     log.loan_shinbo,
      loan_jaedan:     log.loan_jaedan,
      loan_jinjong:    log.loan_jinjong,
      loan_sojin:      log.loan_sojin,
      loan_other:      log.loan_other,
      loan_total:      log.loan_total,
      credit_kcb:      log.credit_kcb,
      credit_nice:     log.credit_nice,
      tax_status:      log.tax_status,
      assets:          log.assets,
      required_funds:  log.required_funds,
      solution:        log.solution,
      monday_id:       log.monday_id,
      // 인콜결과 병합
      call_result:     resultData?.call_result || '',
      closing_result:  resultData?.closing_result || '',
      follow_up_date:  resultData?.follow_up_date || '',
      inspector:       resultData?.inspector || '',
    }

    const row = {
      name:         log.name || log.company,
      phone:        log.phone,
      loan_history: [log.loan_kibo, log.loan_shinbo, log.loan_jaedan].filter(Boolean).join(' / '),
      memo:         log.notes || resultData?.content || '',
      status,
      owner_id:     user.id,
      source:       'monday',
      details,
      call_timeline: updateList.map(u => ({
        user: u.user,
        created_at: u.created_at,
        content: u.content,
        type: u.type,
      })),
    }

    const { error } = await sb.from('customers').insert(row)
    if (error) {
      console.error(`  ✗ ${log.company}: ${error.message}`)
      skipped++
    } else {
      process.stdout.write('.')
      inserted++
    }
  }
  console.log(`\n  인콜일지: ${inserted}건 삽입, ${skipped}건 실패`)

  // 4. 거절DB → customers
  let rejInserted = 0
  for (const r of [...rejected, ...selfRejected]) {
    const { error } = await sb.from('customers').insert({
      name:     r.company,
      phone:    r.phone,
      memo:     r.notes,
      status:   r.status,
      owner_id: user.id,
      source:   'monday',
      details: {
        company: r.company,
        sales_user_name: user.name,
        region: r.region,
        business_type: r.business_type,
        innovation: r.innovation,
        monday_id: r.monday_id,
      },
    })
    if (!error) { process.stdout.write('r'); rejInserted++ }
  }
  console.log(`\n  거절DB: ${rejInserted}건 삽입`)
  console.log(`=== ${personKey} 완료 ===`)
}

// 실행
await migrate('손제후')
await migrate('김윤지')
console.log('\n✅ 전체 마이그레이션 완료')
process.exit(0)
