/**
 * GitHub Actions용 DB 백업 스크립트
 * 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 환경변수 SUPABASE_URL, SUPABASE_SERVICE_KEY 필요')
  process.exit(1)
}

const TABLES = [
  'users',
  'customers',
  'ops_cases',
  'reports',
  'contracts',
  'minutes',
  'events',
  'notices',
  'dig_prospects',
  'payroll_records',
  'payrate_records',
  'pnl_records',
  'sales_goals',
  'as_requests',
  'customer_profiles',
  'payslip_settings',
  'settings',
  'push_subscriptions',
  'ai_chat_logs',
]

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const now = new Date()
const pad = n => String(n).padStart(2, '0')
const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
const timestamp = `${kst.getFullYear()}-${pad(kst.getMonth()+1)}-${pad(kst.getDate())}_${pad(kst.getHours())}-${pad(kst.getMinutes())}`

const outDir = `/tmp/db_backup/${timestamp}`
mkdirSync(outDir, { recursive: true })

console.log(`\n📦 DB 백업 시작: ${timestamp} (KST)`)
console.log(`📁 저장 위치: ${outDir}\n`)

const summary = []
let totalRows = 0

for (const table of TABLES) {
  try {
    let allData = []
    let from = 0
    const PAGE = 1000
    let skipped = false

    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(from, from + PAGE - 1)

      if (error) {
        if (error.code === '42P01') {
          console.log(`  ⚠️  ${table}: 테이블 없음 (스킵)`)
          summary.push({ table, rows: 0, status: '테이블 없음' })
        } else {
          console.log(`  ❌ ${table}: 오류 - ${error.message}`)
          summary.push({ table, rows: 0, status: `오류: ${error.message}` })
        }
        skipped = true
        break
      }

      allData = allData.concat(data || [])
      if (!data || data.length < PAGE) break
      from += PAGE
    }

    if (skipped) continue

    writeFileSync(join(outDir, `${table}.json`), JSON.stringify(allData, null, 2), 'utf-8')
    totalRows += allData.length
    console.log(`  ✅ ${table}: ${allData.length}개 행`)
    summary.push({ table, rows: allData.length, status: '완료' })

  } catch (e) {
    console.log(`  ❌ ${table}: 예외 - ${e.message}`)
    summary.push({ table, rows: 0, status: `예외: ${e.message}` })
  }
}

writeFileSync(join(outDir, '_summary.json'), JSON.stringify({
  backup_time: now.toISOString(),
  timestamp,
  total_rows: totalRows,
  tables: summary,
}, null, 2), 'utf-8')

console.log(`\n${'='.repeat(50)}`)
console.log(`✅ 백업 완료: ${summary.filter(s=>s.status==='완료').length}개 테이블 / ${totalRows.toLocaleString()}개 행`)
console.log(`${'='.repeat(50)}\n`)
