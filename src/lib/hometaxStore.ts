// 홈택스(CODEF)로 읽어 둔 원자료를 서버에서 합쳐 읽는 도우미 (settings 테이블의 hometax_* 항목)
import { supabaseAdmin } from './supabase'
import type { HometaxData } from './hometaxData'

export const HOMETAX_KINDS = ['vatCert', 'taxInvoice', 'cashSales', 'cashBuy'] as const
export type HometaxKind = (typeof HOMETAX_KINDS)[number]
export const hometaxPartKey = (k: HometaxKind) => `hometax_${k}`

async function readSetting(key: string) {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', key).single()
  return data?.value ?? null
}

// 항목별로 따로 저장해 두고(서로 덮어쓰지 않게) 읽을 때 합친다
export async function readHometax(): Promise<HometaxData> {
  const parts = await Promise.all([...HOMETAX_KINDS.map(k => readSetting(hometaxPartKey(k))), readSetting('hometax_data')])
  const out: HometaxData = { fetched: {}, ranges: {} }
  for (const p of parts as (HometaxData | null)[]) {
    if (!p) continue
    Object.assign(out, { ...p, fetched: { ...out.fetched, ...(p.fetched || {}) }, ranges: { ...out.ranges, ...(p.ranges || {}) } })
  }
  return out
}
