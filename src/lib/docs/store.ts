// 규정·서식 보관함 저장소 (settings 테이블의 JSON + Supabase Storage 비공개 버킷)
import { supabaseAdmin } from '@/lib/supabase'

export const BUCKET = 'company-docs'

export interface DocFile { path: string; name: string; size: number; kind: string; version: number; uploadedAt: string; uploadedBy: string }
export interface LibDoc {
  id: string; title: string
  team: string            // 공통 · 관리팀 · 영업팀 · 발굴팀
  category: string        // 계약서 · 입사 · 교육 · 프로그램 사용법 · 규정 · 지급 · 퇴사 …
  desc: string
  text?: string           // 복사해서 쓰는 문구 (카톡 통지 문구 등)
  files: DocFile[]        // 현재 쓰는 파일 (출력·다운로드 대상)
  history: DocFile[]      // 교체되어 보관 중인 이전 파일
  createdAt: string; updatedAt: string; updatedBy: string
}
export interface LibData { docs: LibDoc[]; categories: string[]; teams: string[] }

export const DEFAULT_TEAMS = ['공통', '관리팀', '영업팀', '발굴팀']
export const DEFAULT_CATEGORIES = ['계약서', '입사', '교육', '프로그램 사용법', '규정', '지급', '퇴사', '기타']

export async function readSetting<T = any>(key: string): Promise<T | null> {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', key).single()
  return (data?.value as T) ?? null
}
export async function writeSetting(key: string, value: any) {
  const { error } = await supabaseAdmin.from('settings').upsert({ key, value }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}
export async function readLib(): Promise<LibData> {
  const v = await readSetting<LibData>('company_docs')
  return { docs: v?.docs || [], categories: v?.categories?.length ? v.categories : DEFAULT_CATEGORIES, teams: v?.teams?.length ? v.teams : DEFAULT_TEAMS }
}
export async function ensureBucket() {
  await supabaseAdmin.storage.createBucket(BUCKET, { public: false }).catch(() => {})
}
