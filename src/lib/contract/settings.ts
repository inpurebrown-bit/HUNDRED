// 계약서 기본값 (대표가 수정) — settings 테이블의 'contract_settings' 키에 저장
import { DEFAULT_COMPANY, ITEM_ROWS, type CompanyInfo } from './generate'

export interface ContractSettings {
  company: CompanyInfo
  itemAmounts: Record<string, number>           // 업무별 기본 금액 (diag: 월정기 계약 · diagFee: 수수료 있는 계약의 경영진단 금액)
  textOverrides: { fee: Record<string, string>; nofee: Record<string, string> }   // 대표가 고친 본문 (원문 → 새 문구)
  updatedAt?: string
  updatedBy?: string
}

export const defaultContractSettings = (): ContractSettings => ({
  company: { ...DEFAULT_COMPANY },
  itemAmounts: { ...Object.fromEntries(ITEM_ROWS.map(r => [r.key, r.amount])), diagFee: 500_000 },
  textOverrides: { fee: {}, nofee: {} },
})

export function mergeContractSettings(saved: any): ContractSettings {
  const d = defaultContractSettings()
  if (!saved || typeof saved !== 'object') return d
  return {
    company: { ...d.company, ...(saved.company || {}) },
    itemAmounts: { ...d.itemAmounts, ...(saved.itemAmounts || {}) },
    textOverrides: { fee: { ...(saved.textOverrides?.fee || {}) }, nofee: { ...(saved.textOverrides?.nofee || {}) } },
    updatedAt: saved.updatedAt, updatedBy: saved.updatedBy,
  }
}
