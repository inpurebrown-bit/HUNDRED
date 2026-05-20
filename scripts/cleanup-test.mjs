import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TEST_KEYWORDS = ['test1', 'test2', 'test 1', 'test 2']

function isTest(val) {
  if (!val) return false
  const v = String(val).toLowerCase().trim()
  return TEST_KEYWORDS.some(k => v === k || v.includes(k))
}

// ── 1. ops_cases 검색 ─────────────────────────────────
const { data: allCases } = await supabase.from('ops_cases').select('id, customer_name, details, owner_id')
const testCases = (allCases || []).filter(c =>
  isTest(c.customer_name) ||
  isTest(c.details?.company) ||
  isTest(c.details?.incall_journal?.company) ||
  isTest(c.details?.sales_customer_info?.company)
)

// ── 2. customers 검색 ─────────────────────────────────
const { data: allCusts } = await supabase.from('customers').select('id, name, details')
const testCusts = (allCusts || []).filter(c =>
  isTest(c.name) ||
  isTest(c.details?.company)
)

console.log('\n==============================')
console.log('삭제 대상 ops_cases:')
testCases.forEach(c => console.log(` - [${c.id}] ${c.customer_name} / ${c.details?.company || ''}`))
console.log('\n삭제 대상 customers:')
testCusts.forEach(c => console.log(` - [${c.id}] ${c.name} / ${c.details?.company || ''}`))
console.log('==============================\n')

if (testCases.length === 0 && testCusts.length === 0) {
  console.log('✅ 삭제할 테스트 데이터 없음')
  process.exit(0)
}

// ── 3. ops_cases 삭제 ─────────────────────────────────
if (testCases.length > 0) {
  const ids = testCases.map(c => c.id)
  const { error: e1 } = await supabase.from('ops_cases').delete().in('id', ids)
  if (e1) console.error('ops_cases 삭제 오류:', e1.message)
  else console.log(`✅ ops_cases ${ids.length}건 삭제 완료`)
}

// ── 4. customers 삭제 ─────────────────────────────────
if (testCusts.length > 0) {
  const ids = testCusts.map(c => c.id)
  const { error: e2 } = await supabase.from('customers').delete().in('id', ids)
  if (e2) console.error('customers 삭제 오류:', e2.message)
  else console.log(`✅ customers ${ids.length}건 삭제 완료`)
}

console.log('\n🎉 테스트 데이터 정리 완료')
