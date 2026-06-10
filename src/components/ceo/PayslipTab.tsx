'use client'

import { useState, useEffect, useCallback } from 'react'
import { contractWeight } from '@/lib/supplyRules'

// ─── 타입 ─────────────────────────────────────────────────

interface EmpPersonal {
  id: string
  name: string
  resident_id: string
  address: string
  phone: string
  bank_account: string
  bank_name: string
  team: 'ops' | 'sales'
}

interface AwardItem { reason: string; amount: number }
interface AllowanceDetail { name: string; amount: number }

interface EmpFinancial {
  // 영업팀
  contract_revenue: number
  contract_count: number
  performance_bonus: number  // 12건+ → 5%
  promo: number              // 승급프로모션
  awards: AwardItem[]
  // 관리팀
  base_salary: number
  fee_revenue: number
  puto_revenue: number
  ops_performance_bonus: number
  // 공통
  allowance_details: AllowanceDetail[]
  deduction: number
  refund_companies: string
}

const DEFAULT_FINANCIAL: EmpFinancial = {
  contract_revenue: 0,
  contract_count: 0,
  performance_bonus: 0,
  promo: 0,
  awards: [],
  base_salary: 0,
  fee_revenue: 0,
  puto_revenue: 0,
  ops_performance_bonus: 0,
  allowance_details: [],
  deduction: 0,
  refund_companies: '',
}

const COMPANY = {
  business_number: '533-36-01551',
  phone: '010-9806-4095',
  address: '서울특별시 구로구 디지털로 243, 911호',
  ceo_name: '백승협',
}

// 승급프로모션 (PayrollTab과 동일)
function getPromo(n: number): number {
  if (n >= 40) return 1_500_000
  if (n >= 30) return 1_000_000
  if (n >= 25) return   700_000
  if (n >= 20) return   500_000
  return 0
}

function thisMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function newEmp(): EmpPersonal {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    name: '', resident_id: '', address: '', phone: '',
    bank_account: '', bank_name: '카카오뱅크', team: 'sales',
  }
}

function fmt(n: number): string { return Math.round(n).toLocaleString('ko-KR') }

// ─── 지급내역서 문서 ──────────────────────────────────────

function PayslipDocument({ emp, financial, yearMonth }: {
  emp: EmpPersonal; financial: EmpFinancial; yearMonth: string
}) {
  const [year, month] = yearMonth.split('-')
  const title = `${year}년 ${Number(month)}월 용역비 지급내역서`
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const maskedResidentId = emp.resident_id
    ? emp.resident_id.replace(/^(\d{6})-?(\d{1})\d{6}$/, '$1-$2******')
    : ''

  const tdL = 'border border-gray-400 px-2 py-1 text-xs bg-gray-100 font-medium whitespace-nowrap'
  const tdV = 'border border-gray-400 px-2 py-1 text-xs'
  const tdN = 'border border-gray-400 px-2 py-1 text-xs text-right'

  const refundNames = financial.refund_companies?.trim()
    ? financial.refund_companies.split(',').map(s => s.trim()).filter(Boolean)
    : []

  // ── 영업팀 계산 ──
  const salesCalc = (() => {
    const contractInc = Math.round(financial.contract_revenue * 0.25)
    const perfBonus   = Number(financial.performance_bonus)
    const promo       = Number(financial.promo)
    const awardsSum   = (financial.awards || []).reduce((s, a) => s + Number(a.amount || 0), 0)
    const allowSum    = (financial.allowance_details || []).reduce((s, a) => s + Number(a.amount || 0), 0)
    const subtotal    = contractInc + perfBonus + promo + awardsSum + allowSum
    const beforeTax   = subtotal - financial.deduction
    const incomeTax   = Math.round(beforeTax * 0.03)
    const localTax    = Math.round(beforeTax * 0.003)
    const actualPay   = beforeTax - incomeTax - localTax
    return { contractInc, perfBonus, promo, awardsSum, allowSum, subtotal, beforeTax, incomeTax, localTax, actualPay }
  })()

  // ── 관리팀 계산 ──
  const opsCalc = (() => {
    const feeInc    = Math.round(Number(financial.fee_revenue) * 0.10)
    const putoInc   = Math.round(Number(financial.puto_revenue) * 0.35)
    const allowSum  = (financial.allowance_details || []).reduce((s, a) => s + Number(a.amount || 0), 0)
    const subtotal  = Number(financial.base_salary) + feeInc + putoInc + Number(financial.ops_performance_bonus) + allowSum
    const beforeTax = subtotal - financial.deduction
    const incomeTax = Math.round(beforeTax * 0.03)
    const localTax  = Math.round(beforeTax * 0.003)
    const actualPay = beforeTax - incomeTax - localTax
    return { feeInc, putoInc, allowSum, subtotal, beforeTax, incomeTax, localTax, actualPay }
  })()

  const isSales = emp.team === 'sales'
  const { beforeTax, incomeTax, localTax, actualPay } = isSales ? salesCalc : opsCalc

  return (
    <div
      id="payslip-print"
      className="bg-white p-6 text-gray-900 relative"
      style={{ fontFamily: 'Malgun Gothic, 맑은 고딕, sans-serif', minWidth: 580, maxWidth: 780, margin: '0 auto' }}
    >
      {/* 워터마크 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0" style={{ opacity: 0.055 }}>
        <div className="text-center">
          <div className="font-black leading-none" style={{ color: '#C5A258', fontFamily: 'serif', fontSize: 120 }}>100</div>
          <div className="font-bold tracking-[0.3em]" style={{ color: '#1B2A45', fontSize: 28 }}>HUNDRED</div>
          <div className="tracking-[0.5em]" style={{ color: '#1B2A45', fontSize: 12 }}>CONSULTANCY</div>
        </div>
      </div>

      {/* 작성일 */}
      <div className="text-right text-xs mb-1 text-gray-500">작성일: {today}</div>

      {/* 제목 */}
      <div className="bg-gray-200 border border-gray-400 text-center py-3 mb-3">
        <h1 className="text-lg font-bold tracking-widest">{title}</h1>
      </div>

      {/* 발행사 정보 */}
      <div className="flex justify-between items-start mb-3 text-xs text-gray-500 border-b border-gray-200 pb-2">
        <div className="space-y-0.5">
          <span className="font-semibold text-gray-700">헌드레드 컨설팅</span>
          <span className="ml-3">사업자: {COMPANY.business_number}</span>
          <span className="ml-3">대표: {COMPANY.ceo_name}</span>
          <span className="ml-3">전화: {COMPANY.phone}</span>
        </div>
        <div className="text-right space-y-0.5">
          <div>기준월: <b className="text-gray-800">{yearMonth}</b></div>
          <div>팀: <b className="text-gray-800">{isSales ? '영업팀' : '관리팀'}</b></div>
        </div>
      </div>

      {/* 소득자 정보 */}
      <table className="border-collapse text-xs w-full mb-3">
        <thead>
          <tr>
            <th colSpan={4} className="border border-gray-400 px-2 py-1 bg-gray-200 text-center font-bold">
              소득자 (수급자) 정보
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdL}>성명</td>
            <td className={tdV}>{emp.name || '-'}</td>
            <td className={tdL}>주민등록번호</td>
            <td className={tdV}>{maskedResidentId || '-'}</td>
          </tr>
          <tr>
            <td className={tdL}>전화번호</td>
            <td className={tdV}>{emp.phone || '-'}</td>
            <td className={tdL}>계좌 ({emp.bank_name})</td>
            <td className={tdV}>{emp.bank_account || '-'}</td>
          </tr>
          <tr>
            <td className={tdL}>주소</td>
            <td className={tdV} colSpan={3}>{emp.address || '-'}</td>
          </tr>
        </tbody>
      </table>

      {/* 용역비 지급 내역 */}
      <table className="border-collapse text-xs w-full mb-3">
        <thead>
          <tr>
            <th colSpan={3} className="border border-gray-400 px-2 py-1 bg-gray-200 text-center font-bold">
              용역비 지급 내역
            </th>
          </tr>
          <tr>
            <th className="border border-gray-400 px-2 py-1 bg-gray-100 text-center w-1/3">항목</th>
            <th className="border border-gray-400 px-2 py-1 bg-gray-100 text-center w-1/3">내용</th>
            <th className="border border-gray-400 px-2 py-1 bg-gray-100 text-center w-1/3">금액 (원)</th>
          </tr>
        </thead>
        <tbody>
          {isSales ? (
            <>
              {/* 영업팀 */}
              <tr>
                <td className={tdL}>이달 매출</td>
                <td className={tdV}></td>
                <td className={tdN}>{fmt(financial.contract_revenue)}</td>
              </tr>
              <tr>
                <td className={tdL}>① 용역비 (25%)</td>
                <td className={tdV}>{fmt(financial.contract_revenue)} × 25%</td>
                <td className={tdN}>{fmt(salesCalc.contractInc)}</td>
              </tr>
              <tr>
                <td className={tdL}>② 성과급{financial.contract_count >= 12 ? ' (5%)' : ''}</td>
                <td className={tdV}>
                  {financial.contract_count > 0 && (
                    <span className={financial.contract_count >= 12 ? 'text-blue-700 font-medium' : 'text-gray-500'}>
                      {financial.contract_count}건 {financial.contract_count >= 12 ? '— 5% 자동지급' : '— 12건 미만'}
                    </span>
                  )}
                </td>
                <td className={tdN + (salesCalc.perfBonus > 0 ? ' text-blue-700 font-semibold' : '')}>
                  {salesCalc.perfBonus > 0 ? fmt(salesCalc.perfBonus) : '-'}
                </td>
              </tr>
              <tr>
                <td className={tdL}>③ 프로모션</td>
                <td className={tdV}>
                  {financial.contract_count >= 20
                    ? <span className="text-emerald-700 font-medium">{financial.contract_count}건 구간</span>
                    : <span className="text-gray-400">20건 미만</span>}
                </td>
                <td className={tdN + (salesCalc.promo > 0 ? ' text-emerald-700 font-semibold' : '')}>
                  {salesCalc.promo > 0 ? fmt(salesCalc.promo) : '-'}
                </td>
              </tr>
              <tr>
                <td className={tdL}>④ 시상금</td>
                <td className={tdV}>
                  {(financial.awards || []).length > 0
                    ? (financial.awards || []).map(a => a.reason || '-').join(', ')
                    : '-'}
                </td>
                <td className={tdN + (salesCalc.awardsSum > 0 ? ' text-amber-700 font-semibold' : '')}>
                  {salesCalc.awardsSum > 0 ? fmt(salesCalc.awardsSum) : '-'}
                </td>
              </tr>
              {(financial.allowance_details || []).map((a, i) => (
                <tr key={i}>
                  <td className={tdL}>제수당</td>
                  <td className={tdV}>{a.name || '-'}</td>
                  <td className={tdN}>{fmt(a.amount)}</td>
                </tr>
              ))}
            </>
          ) : (
            <>
              {/* 관리팀 */}
              <tr>
                <td className={tdL}>① 기본급</td>
                <td className={tdV}></td>
                <td className={tdN}>{financial.base_salary > 0 ? fmt(financial.base_salary) : '-'}</td>
              </tr>
              <tr>
                <td className={tdL}>② 수수료 인센(10%)</td>
                <td className={tdV}>수수료매출(VAT제외) {fmt(financial.fee_revenue)} × 10%</td>
                <td className={tdN}>{opsCalc.feeInc > 0 ? fmt(opsCalc.feeInc) : '-'}</td>
              </tr>
              <tr>
                <td className={tdL}>③ 뿌토 인센(35%)</td>
                <td className={tdV}>뿌토매출(VAT제외) {fmt(financial.puto_revenue)} × 35%</td>
                <td className={tdN}>{opsCalc.putoInc > 0 ? fmt(opsCalc.putoInc) : '-'}</td>
              </tr>
              <tr>
                <td className={tdL}>④ 성과급</td>
                <td className={tdV}></td>
                <td className={tdN}>{financial.ops_performance_bonus > 0 ? fmt(financial.ops_performance_bonus) : '-'}</td>
              </tr>
              {(financial.allowance_details || []).map((a, i) => (
                <tr key={i}>
                  <td className={tdL}>제수당</td>
                  <td className={tdV}>{a.name || '-'}</td>
                  <td className={tdN}>{fmt(a.amount)}</td>
                </tr>
              ))}
            </>
          )}

          {/* 소계 */}
          <tr className="bg-gray-50">
            <td className="border border-gray-400 px-2 py-1 text-xs font-bold">소계</td>
            <td className={tdV}></td>
            <td className={tdN + ' font-bold'}>{fmt(isSales ? salesCalc.subtotal : opsCalc.subtotal)}</td>
          </tr>

          {/* 환수금 */}
          <tr>
            <td className={tdL + ' text-red-700'}>환수금</td>
            <td className={tdV + ' text-red-600'}>{refundNames.length > 0 ? refundNames.join(', ') : '-'}</td>
            <td className={tdN + ' text-red-700'}>{financial.deduction > 0 ? `-${fmt(financial.deduction)}` : '-'}</td>
          </tr>

          {/* 공제 전 총액 */}
          <tr>
            <td colSpan={2} className="border border-gray-400 px-2 py-1 text-xs bg-blue-100 font-bold text-blue-900">
              공제 전 지급 총액
            </td>
            <td className="border border-gray-400 px-2 py-1 text-sm font-bold text-blue-700 text-right bg-blue-50">
              {fmt(beforeTax)}
            </td>
          </tr>

          {/* 원천세 */}
          <tr>
            <td className={tdL}>원천세 — 소득세 3.0%</td>
            <td className={tdV}>{fmt(beforeTax)} × 3.0%</td>
            <td className={tdN + ' text-red-600'}>-{fmt(incomeTax)}</td>
          </tr>
          <tr>
            <td className={tdL}>원천세 — 지방소득세 0.3%</td>
            <td className={tdV}>{fmt(beforeTax)} × 0.3%</td>
            <td className={tdN + ' text-red-600'}>-{fmt(localTax)}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 text-xs bg-gray-100 font-bold">원천세 합계</td>
            <td className={tdV}></td>
            <td className={tdN + ' text-red-600 font-bold'}>-{fmt(incomeTax + localTax)}</td>
          </tr>

          {/* 실지급액 */}
          <tr>
            <td colSpan={2} className="border border-gray-400 px-2 py-1 bg-emerald-100 font-bold text-emerald-900">
              실지급액
            </td>
            <td className="border border-gray-400 px-2 py-1 text-base font-black text-emerald-700 text-right bg-emerald-50">
              {fmt(actualPay)}원
            </td>
          </tr>
        </tbody>
      </table>

      {/* 승급프로모션 안내 (영업팀만) */}
      {isSales && (
        <table className="border-collapse text-xs w-full mb-3">
          <thead>
            <tr>
              <th colSpan={5} className="border border-gray-400 px-2 py-1 bg-gray-100 text-center font-bold">
                프로모션 구간 안내
              </th>
            </tr>
            <tr>
              {[
                { label: '20건 이상', amount: 500_000 },
                { label: '25건 이상', amount: 700_000 },
                { label: '30건 이상', amount: 1_000_000 },
                { label: '40건 이상', amount: 1_500_000 },
              ].map(t => (
                <th key={t.label}
                  className={`border border-gray-400 px-2 py-1 text-center text-[10px] font-medium w-1/4 ${
                    financial.contract_count > 0 && getPromo(financial.contract_count) === t.amount
                      ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-50 text-gray-500'
                  }`}>
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {[500_000, 700_000, 1_000_000, 1_500_000].map(amt => (
                <td key={amt}
                  className={`border border-gray-400 px-2 py-1 text-center text-[10px] ${
                    financial.contract_count > 0 && getPromo(financial.contract_count) === amt
                      ? 'bg-emerald-50 font-bold text-emerald-700' : 'text-gray-500'
                  }`}>
                  {(amt / 10000).toFixed(0)}만원
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}

      {/* 수급자 확인 */}
      <div className="mt-4 border-t border-gray-300 pt-4 text-xs text-gray-700 space-y-1">
        <p className="font-bold text-gray-600 mb-1.5">◆ 수급자 확인</p>
        <p>성명: <span className="font-semibold">{emp.name || '—'}</span></p>
        <p>주민번호: <span className="font-mono">{maskedResidentId || '—'}</span></p>
        <p>주소: {emp.address || '—'}</p>
        <p>계좌: {emp.bank_name} {emp.bank_account || '—'}</p>
      </div>

      <div className="mt-5 text-center text-sm text-gray-600 py-3 border-t border-gray-200">
        ♥ 귀하의 노고에 진심으로 감사드립니다. -헌드레드 컨설팅
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────

export default function PayslipTab() {
  const [yearMonth, setYearMonth]   = useState<string>(thisMonth())
  const [employees, setEmployees]   = useState<EmpPersonal[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [financials, setFinancials] = useState<Record<string, EmpFinancial>>({})
  const [saving, setSaving]         = useState(false)
  const [loading, setLoading]       = useState(false)
  const [msg, setMsg]               = useState('')
  const [editMode, setEditMode]     = useState(false)

  // 직원 개인정보 로드
  useEffect(() => {
    fetch('/api/payslip-settings')
      .then(r => r.json())
      .then(j => { if (j.settings?.employees) setEmployees(j.settings.employees) })
      .catch(() => {})
  }, [])

  const selectedEmp = employees.find(e => e.id === selectedId) || null
  const currentFin: EmpFinancial = selectedId
    ? (financials[selectedId] || { ...DEFAULT_FINANCIAL })
    : { ...DEFAULT_FINANCIAL }

  function updateSelectedEmp(field: keyof EmpPersonal, value: string) {
    if (!selectedId) return
    setEmployees(prev => prev.map(e => e.id === selectedId ? { ...e, [field]: value } : e))
  }

  function updateFin(patch: Partial<EmpFinancial>) {
    if (!selectedId) return
    setFinancials(prev => ({
      ...prev,
      [selectedId]: { ...(prev[selectedId] || DEFAULT_FINANCIAL), ...patch },
    }))
  }

  const handleSave = useCallback(async () => {
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/payslip-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees }),
      })
      const json = await res.json()
      setMsg(json.settings ? '저장 완료' : '저장 실패')
    } catch { setMsg('저장 실패') }
    finally { setSaving(false) }
  }, [employees])

  // 급여계산기(payroll) 에서 자동 불러오기
  // ★ 계약 데이터는 저장된 payroll이 아닌 customers DB 실시간값 사용 (저장 시점 무관)
  async function handleLoad() {
    setLoading(true); setMsg('')
    try {
      const [payRes, custRes] = await Promise.all([
        fetch(`/api/payroll?year_month=${yearMonth}`),
        fetch('/api/customers'),
      ])
      const [json, custJson] = await Promise.all([payRes.json(), custRes.json()])

      const emps = json.record?.employees
      const opsList: any[] = emps?.ops_employees || []

      // ── 해당 월 계약 실시간 집계 (contractWeight 기준) ──
      const parseMon = (v: any) => parseInt(String(v || '0').replace(/[^0-9]/g, ''), 10) || 0
      const liveByName: Record<string, { revenue: number; count: number }> = {}
      ;(custJson.customers || []).forEach((c: any) => {
        if (c.status !== 'contracted') return
        const contractMonth = (c.details?.contract_date || c.created_at || '').slice(0, 7)
        if (contractMonth !== yearMonth) return
        const name = (c.details?.sales_user_name || c.sales_user_name || '').trim()
        if (!name) return
        // my_revenue 없으면 payment_amount 로 폴백 (미입력 계약 누락 방지)
        const rev = parseMon(c.details?.my_revenue) || parseMon(c.details?.payment_amount)
        const w   = contractWeight(c.details?.payment_amount, c.details?.vat_included)
        if (!liveByName[name]) liveByName[name] = { revenue: 0, count: 0 }
        liveByName[name].revenue += rev
        liveByName[name].count   += w > 0 ? w : 1
      })

      const updates: Record<string, Partial<EmpFinancial>> = {}
      for (const emp of employees) {
        const nameMatch = (a: string, b: string) =>
          a === b || a.includes(b) || b.includes(a)

        if (emp.team === 'sales') {
          // 실시간 계약 데이터 우선 — 저장된 payroll은 awards/성과급 보조용으로만 사용
          const liveKey    = Object.keys(liveByName).find(k => nameMatch(emp.name, k))
          const savedMatch = (emps?.sales_employees || []).find((e: any) => nameMatch(emp.name, e.name || ''))

          if (liveKey) {
            const live  = liveByName[liveKey]
            const count = live.count
            updates[emp.id] = {
              contract_revenue:  live.revenue,
              contract_count:    count,
              // 성과급: 저장된 값 유지 (수동 조정 가능), 12건 이상이면 자동 계산
              performance_bonus: count >= 12
                ? Math.round(live.revenue * 0.05)
                : Number(savedMatch?.performance_bonus || 0),
              promo:  getPromo(count),
              awards: savedMatch?.awards || [],
            }
          } else if (savedMatch) {
            // 해당 월 계약 없으면 저장된 payroll 사용
            const count = Number(savedMatch.contract_count || 0)
            const rev   = Number(savedMatch.contract_revenue || 0)
            updates[emp.id] = {
              contract_revenue:  rev,
              contract_count:    count,
              performance_bonus: Number(savedMatch.performance_bonus || 0),
              promo: getPromo(count),
              awards: savedMatch.awards || [],
            }
          }
        } else {
          const match = opsList.find((e: any) => nameMatch(emp.name, e.name || ''))
          if (match) {
            updates[emp.id] = {
              base_salary:           Number(match.base_salary || 0),
              fee_revenue:           Number(match.fee_revenue || 0),
              puto_revenue:          Number(match.puto_revenue || 0),
              ops_performance_bonus: Number(match.performance_bonus || 0),
            }
          }
        }
      }

      setFinancials(prev => {
        const next = { ...prev }
        for (const [id, patch] of Object.entries(updates)) {
          next[id] = { ...(next[id] || DEFAULT_FINANCIAL), ...patch }
        }
        return next
      })
      const loaded = Object.keys(updates).length
      setMsg(loaded > 0 ? `${loaded}명 데이터 불러오기 완료 (실시간 계약 반영)` : '이름이 일치하는 직원이 없습니다')
    } catch { setMsg('불러오기 실패') }
    finally { setLoading(false) }
  }

  function addEmployee() {
    const emp = newEmp()
    setEmployees(prev => [...prev, emp])
    setSelectedId(emp.id)
    setEditMode(true)
  }

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400'
  const lbl = 'text-xs text-gray-500 block mb-1'

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #payslip-print, #payslip-print * { visibility: visible !important; }
          #payslip-print {
            position: fixed !important;
            top: 0; left: 0; width: 100%;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            padding: 20px !important;
          }
          @page { size: A4 portrait; margin: 15mm; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="space-y-4 pb-8">
        {/* 상단 바 */}
        <div className="no-print bg-[#1B2A45] rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap">
          <input type="month" value={yearMonth} onChange={e => setYearMonth(e.target.value)}
            className="border border-white/20 bg-white/10 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
          <button onClick={handleLoad} disabled={loading}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
            {loading ? '불러오는 중...' : '급여계산기에서 불러오기'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
            {saving ? '저장 중...' : '직원 정보 저장'}
          </button>
          <button onClick={() => window.print()}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
            인쇄
          </button>
          {msg && <span className="text-xs text-white/80">{msg}</span>}
        </div>

        <div className="flex gap-4">
          {/* 왼쪽: 직원 목록 */}
          <div className="no-print w-56 shrink-0">
            <div className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E8E2D4] flex items-center justify-between">
                <p className="text-xs font-bold text-gray-600">프리랜서 관리대장</p>
                <button onClick={addEmployee}
                  className="text-xs bg-[#1B2A45] text-white px-2 py-0.5 rounded-lg">+ 추가</button>
              </div>
              <div className="px-3 py-2 bg-gray-50 border-b border-[#E8E2D4] text-[10px] text-gray-400 leading-relaxed">
                팀 선택 시 <b className="text-gray-500">영업팀·관리팀</b> 모두 지원<br/>급여·손익탭과 자동 연동
              </div>
              {employees.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  <p>등록된 직원이 없습니다</p>
                  <button onClick={addEmployee} className="mt-2 text-blue-500 underline text-xs">직원 추가하기</button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {/* 영업팀 */}
                  {employees.filter(e => e.team === 'sales').length > 0 && (
                    <div className="px-3 pt-2 pb-0.5 text-[10px] font-bold text-gray-400 uppercase">영업팀</div>
                  )}
                  {employees.filter(e => e.team === 'sales').map(emp => (
                    <EmpListItem key={emp.id} emp={emp} fin={financials[emp.id]} selectedId={selectedId}
                      onSelect={() => { setSelectedId(emp.id); setEditMode(false) }} />
                  ))}
                  {/* 관리팀 */}
                  {employees.filter(e => e.team === 'ops').length > 0 && (
                    <div className="px-3 pt-2 pb-0.5 text-[10px] font-bold text-gray-400 uppercase">관리팀</div>
                  )}
                  {employees.filter(e => e.team === 'ops').map(emp => (
                    <EmpListItem key={emp.id} emp={emp} fin={financials[emp.id]} selectedId={selectedId}
                      onSelect={() => { setSelectedId(emp.id); setEditMode(false) }} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽 */}
          <div className="flex-1 min-w-0">
            {!selectedEmp ? (
              <div className="bg-white rounded-xl border border-[#E8E2D4] p-12 text-center text-gray-400 text-sm">
                <p>왼쪽에서 직원을 선택하세요</p>
                <p className="text-xs mt-1 text-gray-300">이름을 클릭하면 지급내역서를 확인할 수 있습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 직원 헤더 */}
                <div className="no-print bg-white rounded-xl border border-[#E8E2D4] px-5 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900">{selectedEmp.name || '(이름 없음)'}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{selectedEmp.team === 'ops' ? '관리팀' : '영업팀'} · {yearMonth}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditMode(m => !m)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        editMode ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {editMode ? '✓ 미리보기' : '편집'}
                    </button>
                    <button onClick={() => {
                      if (!confirm('이 직원을 삭제하시겠습니까?')) return
                      setEmployees(p => p.filter(e => e.id !== selectedEmp.id))
                      setSelectedId(null)
                    }} className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-400 hover:bg-red-50">
                      삭제
                    </button>
                  </div>
                </div>

                {editMode ? (
                  <div className="no-print bg-white rounded-xl border border-[#E8E2D4] p-5 space-y-5">
                    {/* 개인 정보 */}
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-3">개인 정보</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          ['name', '성명'],
                          ['resident_id', '주민등록번호'],
                          ['phone', '전화번호'],
                          ['bank_name', '은행명'],
                          ['bank_account', '계좌번호'],
                        ] as [keyof EmpPersonal, string][]).map(([field, label]) => (
                          <div key={field}>
                            <label className={lbl}>{label}</label>
                            <input value={selectedEmp[field] as string}
                              onChange={e => updateSelectedEmp(field, e.target.value)} className={inp} />
                          </div>
                        ))}
                        <div>
                          <label className={lbl}>팀</label>
                          <select value={selectedEmp.team}
                            onChange={e => updateSelectedEmp('team', e.target.value)}
                            className={inp}>
                            <option value="sales">영업팀</option>
                            <option value="ops">관리팀</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className={lbl}>주소</label>
                          <input value={selectedEmp.address}
                            onChange={e => updateSelectedEmp('address', e.target.value)} className={inp} />
                        </div>
                      </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* 재무 정보 — 팀별 분기 */}
                    {selectedEmp.team === 'sales' ? (
                      <SalesFinancialForm fin={currentFin} update={updateFin} />
                    ) : (
                      <OpsFinancialForm fin={currentFin} update={updateFin} />
                    )}

                    {/* 공통: 환수금 */}
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-3">환수금</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={lbl}>환수금 합계 (원)</label>
                          <input type="number" value={currentFin.deduction}
                            onChange={e => updateFin({ deduction: Number(e.target.value) })}
                            className={inp} />
                        </div>
                        <div>
                          <label className={lbl}>환수금 업체명 (쉼표 구분)</label>
                          <input type="text" value={currentFin.refund_companies}
                            onChange={e => updateFin({ refund_companies: e.target.value })}
                            placeholder="예: (주)ABC, 테크주식회사" className={inp} />
                        </div>
                      </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* 제수당 */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-700">제수당 상세내역</h4>
                        <button onClick={() => updateFin({ allowance_details: [...currentFin.allowance_details, { name: '', amount: 0 }] })}
                          className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50">+ 항목 추가</button>
                      </div>
                      <div className="space-y-2">
                        {currentFin.allowance_details.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input value={item.name}
                              onChange={e => updateFin({ allowance_details: currentFin.allowance_details.map((d, i) => i === idx ? { ...d, name: e.target.value } : d) })}
                              placeholder="항목명" className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none" />
                            <input type="number" value={item.amount}
                              onChange={e => updateFin({ allowance_details: currentFin.allowance_details.map((d, i) => i === idx ? { ...d, amount: Number(e.target.value) } : d) })}
                              className="w-32 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none" />
                            <button onClick={() => updateFin({ allowance_details: currentFin.allowance_details.filter((_, i) => i !== idx) })}
                              className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                          </div>
                        ))}
                        {currentFin.allowance_details.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">제수당 항목 없음</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button onClick={() => setEditMode(false)}
                        className="bg-[#1B2A45] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#243552]">
                        지급내역서 미리보기 →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-[#E8E2D4] p-4">
                    <PayslipDocument emp={selectedEmp} financial={currentFin} yearMonth={yearMonth} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── 목록 아이템 ───────────────────────────────────────────

function EmpListItem({ emp, fin, selectedId, onSelect }: {
  emp: EmpPersonal; fin?: EmpFinancial; selectedId: string | null; onSelect: () => void
}) {
  const isSales = emp.team === 'sales'
  const preview = isSales
    ? (fin?.contract_revenue ? `${(fin.contract_revenue / 10000).toFixed(0)}만` : '')
    : (fin?.fee_revenue || fin?.puto_revenue
        ? `수${(Number(fin!.fee_revenue||0)/10000).toFixed(0)}·뿌${(Number(fin!.puto_revenue||0)/10000).toFixed(0)}만`
        : '')

  return (
    <button onClick={onSelect}
      className={`w-full text-left px-4 py-3 transition-colors ${selectedId === emp.id ? 'bg-[#1B2A45]' : 'hover:bg-gray-50'}`}>
      <p className={`text-sm font-semibold ${selectedId === emp.id ? 'text-white' : 'text-gray-800'}`}>
        {emp.name || '(이름 없음)'}
      </p>
      {preview && (
        <p className={`text-[10px] mt-0.5 ${selectedId === emp.id ? 'text-white/60' : 'text-gray-400'}`}>
          {preview}
        </p>
      )}
    </button>
  )
}

// ─── 영업팀 재무 편집 폼 ───────────────────────────────────

function SalesFinancialForm({ fin, update }: { fin: EmpFinancial; update: (p: Partial<EmpFinancial>) => void }) {
  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400'
  const lbl = 'text-xs text-gray-500 block mb-1'

  return (
    <div>
      <h4 className="text-sm font-bold text-gray-700 mb-3">영업팀 재무 정보</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>이달 매출 (원) <span className="text-gray-400 text-[10px]">자동불러오기 가능</span></label>
          <input type="number" value={fin.contract_revenue}
            onChange={e => update({ contract_revenue: Number(e.target.value) })} className={inp} />
        </div>
        <div>
          <label className={lbl}>
            이달 계약 건수
            <span className={`ml-2 font-semibold text-[10px] px-1.5 py-0.5 rounded ${
              fin.contract_count >= 12 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {fin.contract_count >= 12 ? '성과급 5% 지급' : '12건 미만 — 성과급 없음'}
            </span>
          </label>
          <input type="number" value={fin.contract_count}
            onChange={e => {
              const cnt = Number(e.target.value)
              update({
                contract_count: cnt,
                performance_bonus: cnt >= 12 ? Math.round(fin.contract_revenue * 0.05) : 0,
                promo: getPromo(cnt),
              })
            }} className={inp} />
        </div>
        <div>
          <label className={lbl}>성과급 (원) <span className="text-gray-400 text-[10px]">12건+ 자동산출</span></label>
          <input type="number" value={fin.performance_bonus}
            onChange={e => update({ performance_bonus: Number(e.target.value) })} className={inp} />
        </div>
        <div>
          <label className={lbl}>승급프로모션 (원) <span className="text-gray-400 text-[10px]">건수에 따라 자동산출</span></label>
          <input type="number" value={fin.promo}
            onChange={e => update({ promo: Number(e.target.value) })} className={inp} />
        </div>
      </div>

      {/* 시상금 */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-gray-600">시상금</label>
          <button onClick={() => update({ awards: [...(fin.awards||[]), { reason: '', amount: 0 }] })}
            className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50">+ 추가</button>
        </div>
        <div className="space-y-2">
          {(fin.awards || []).map((a, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input value={a.reason} placeholder="사유"
                onChange={e => update({ awards: fin.awards.map((x, j) => j === i ? { ...x, reason: e.target.value } : x) })}
                className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none" />
              <input type="number" value={a.amount}
                onChange={e => update({ awards: fin.awards.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x) })}
                className="w-32 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none" />
              <button onClick={() => update({ awards: fin.awards.filter((_, j) => j !== i) })}
                className="text-red-400 hover:text-red-600 text-xs">삭제</button>
            </div>
          ))}
          {(fin.awards || []).length === 0 && <p className="text-xs text-gray-400 py-1">시상금 없음</p>}
        </div>
      </div>
    </div>
  )
}

// ─── 관리팀 재무 편집 폼 ───────────────────────────────────

function OpsFinancialForm({ fin, update }: { fin: EmpFinancial; update: (p: Partial<EmpFinancial>) => void }) {
  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400'
  const lbl = 'text-xs text-gray-500 block mb-1'

  return (
    <div>
      <h4 className="text-sm font-bold text-gray-700 mb-3">관리팀 재무 정보</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>기본급 (원) <span className="text-gray-400 text-[10px]">자동불러오기 가능</span></label>
          <input type="number" value={fin.base_salary}
            onChange={e => update({ base_salary: Number(e.target.value) })} className={inp} />
        </div>
        <div>
          <label className={lbl}>성과급 (원)</label>
          <input type="number" value={fin.ops_performance_bonus}
            onChange={e => update({ ops_performance_bonus: Number(e.target.value) })} className={inp} />
        </div>
        <div>
          <label className={lbl}>수수료매출 VAT제외 (원) <span className="text-gray-400 text-[10px]">인센 10% 자동계산</span></label>
          <input type="number" value={fin.fee_revenue}
            onChange={e => update({ fee_revenue: Number(e.target.value) })} className={inp} />
          {fin.fee_revenue > 0 && (
            <p className="text-[10px] text-blue-600 mt-0.5">인센: {Math.round(fin.fee_revenue * 0.1).toLocaleString()}원</p>
          )}
        </div>
        <div>
          <label className={lbl}>뿌토매출 VAT제외 (원) <span className="text-gray-400 text-[10px]">인센 35% 자동계산</span></label>
          <input type="number" value={fin.puto_revenue}
            onChange={e => update({ puto_revenue: Number(e.target.value) })} className={inp} />
          {fin.puto_revenue > 0 && (
            <p className="text-[10px] text-violet-600 mt-0.5">인센: {Math.round(fin.puto_revenue * 0.35).toLocaleString()}원</p>
          )}
        </div>
      </div>
    </div>
  )
}
