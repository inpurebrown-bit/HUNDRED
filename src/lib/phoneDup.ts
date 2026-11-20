import { supabaseAdmin } from './supabase'

// 번호 중복 검색 — 저장된 번호 모양이 제각각이라('010-8822-8879' / '01088228879') 숫자만으로 찾으면 하이픈 번호를 놓친다.
// 끝 8자리를 '8822-8879', '88228879', '8822 8879', '8822.8879' 네 가지 모양으로 모두 찾는다.
export interface PhoneMatch { source: 'customer' | 'prospect'; id: string; company: string; ceo_name: string; phone_010: string; status: string; created_at: string }

export function phonePatterns(phone: string): string[] {
  const d = String(phone || '').replace(/[^0-9]/g, '')
  if (d.length < 8) return []
  const t = d.slice(-8), a = t.slice(0, 4), b = t.slice(4)
  return [`${a}-${b}`, `${a}${b}`, `${a} ${b}`, `${a}.${b}`]
}

export async function findPhoneMatches(phone: string): Promise<PhoneMatch[]> {
  const pats = phonePatterns(phone)
  if (!pats.length) return []
  const like = (col: string) => pats.map(p => `${col}.ilike."%${p}%"`).join(',')
  const [{ data: customers }, { data: prospects }] = await Promise.all([
    supabaseAdmin
      .from('customers')
      .select('id, name, phone, details, status, created_at')
      .or(`${like('phone')},${like('details->>phone_010')}`),
    supabaseAdmin
      .from('dig_prospects')
      .select('id, company, ceo_name, phone_010, status, created_at')
      .neq('status', 'canceled')
      .or(like('phone_010')),
  ])
  const c: PhoneMatch[] = (customers || []).map((x: any) => ({
    source: 'customer', id: x.id, company: x.details?.company || x.name || '', ceo_name: x.name || '',
    phone_010: x.phone || x.details?.phone_010 || '', status: x.details?.sub_status || x.status || '', created_at: x.created_at,
  }))
  const p: PhoneMatch[] = (prospects || []).map((x: any) => ({
    source: 'prospect', id: x.id, company: x.company || '', ceo_name: x.ceo_name || '',
    phone_010: x.phone_010 || '', status: x.status || '', created_at: x.created_at,
  }))
  return [...c, ...p]
}
