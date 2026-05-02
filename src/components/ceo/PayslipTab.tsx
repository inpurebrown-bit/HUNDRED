'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── 타입 정의 ────────────────────────────────────────────

interface EmpPersonal {
  id: string
  name: string
  resident_id: string
  address: string
  phone: string
  bank_account: string
  bank_name: string
  team: 'ops' | 'sales'
  commission_rate: number
}

interface AllowanceDetail {
  name: string
  amount: number
}

interface EmpFinancial {
  revenue: number
  allowance: number
  contract_incentive: number
  fee_incentive: number
  performance_bonus: number
  deduction: number
  deduction_count: number
  allowance_details: AllowanceDetail[]
}

interface CompanyInfo {
  business_number: string
  address: string
  ceo_name: string
  bank_account: string
}

const DEFAULT_COMPANY: CompanyInfo = {
  business_number: '333-36-01551',
  address: '서울특별시 구로구 디지털로 243, 911호',
  ceo_name: '백승혁',
  bank_account: '3333-09-9388152',
}

const DEFAULT_FINANCIAL: EmpFinancial = {
  revenue: 0,
  allowance: 0,
  contract_incentive: 0,
  fee_incentive: 0,
  performance_bonus: 0,
  deduction: 0,
  deduction_count: 0,
  allowance_details: [],
}

function thisMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function newEmp(): EmpPersonal {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    name: '',
    resident_id: '',
    address: '',
    phone: '',
    bank_account: '',
    bank_name: '카카오뱅크',
    team: 'ops',
    commission_rate: 25,
  }
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

// ─── 지급내역서 문서 컴포넌트 ─────────────────────────────

function PayslipDocument({
  emp,
  financial,
  company,
  yearMonth,
}: {
  emp: EmpPersonal
  financial: EmpFinancial
  company: CompanyInfo
  yearMonth: string
}) {
  const rate = emp.commission_rate
  const revenue = financial.revenue
  const allowance = financial.allowance
  const commissionAmt = Math.round(revenue * rate / 100)
  const baseTotal = commissionAmt - allowance
  const extraTotal = financial.contract_incentive + financial.fee_incentive + financial.performance_bonus
  const preTax = baseTotal + extraTotal - financial.deduction
  const incomeTax = Math.round(preTax * 0.03)
  const localTax = Math.round(preTax * 0.003)
  const totalDeduction = incomeTax + localTax
  const actualPay = preTax - incomeTax - localTax

  const [year, month] = yearMonth.split('-')
  const title = `${year}년 ${Number(month)}월 용역비 지급내역서`
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

  // Mask resident ID
  const maskedResidentId = emp.resident_id
    ? emp.resident_id.replace(/^(\d{6})-?(\d{1})\d{6}$/, '$1-$2******')
    : ''

  const tdL = 'border border-gray-400 px-2 py-1 text-xs bg-gray-100 font-medium whitespace-nowrap'
  const tdV = 'border border-gray-400 px-2 py-1 text-xs'
  const tdN = 'border border-gray-400 px-2 py-1 text-xs text-right'

  return (
    <div
      id="payslip-print"
      className="bg-white p-6 text-gray-900 relative"
      style={{ fontFamily: 'Malgun Gothic, 맑은 고딕, sans-serif', minWidth: 600, maxWidth: 800, margin: '0 auto' }}
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

      {/* 상단 정보 박스 */}
      <div className="flex justify-end mb-3">
        <table className="border-collapse text-xs">
          <tbody>
            <tr>
              <td className={tdL}>기준 날짜</td>
              <td className={tdV}>{yearMonth}</td>
            </tr>
            <tr>
              <td className={tdL}>소득자명</td>
              <td className={tdV}>{emp.name || '-'}</td>
            </tr>
            <tr>
              <td className={tdL}>매출</td>
              <td className={tdN}>{fmt(revenue)}원</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 지급자 / 소득자 정보 */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* 지급자 */}
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr>
              <th colSpan={2} className="border border-gray-400 px-2 py-1 bg-gray-200 text-center font-bold">
                지급자 (사업주)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={tdL}>사업자등록번호</td>
              <td className={tdV}>{company.business_number}</td>
            </tr>
            <tr>
              <td className={tdL}>주소</td>
              <td className={tdV}>{company.address}</td>
            </tr>
            <tr>
              <td className={tdL}>계좌 (카카오뱅크)</td>
              <td className={tdV}>{company.bank_account}</td>
            </tr>
            <tr>
              <td className={tdL}>대표자</td>
              <td className={tdV}>{company.ceo_name}</td>
            </tr>
          </tbody>
        </table>

        {/* 소득자 */}
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr>
              <th colSpan={2} className="border border-gray-400 px-2 py-1 bg-gray-200 text-center font-bold">
                소득자 (수급자)
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={tdL}>성명</td>
              <td className={tdV}>{emp.name || '-'}</td>
            </tr>
            <tr>
              <td className={tdL}>주민등록번호</td>
              <td className={tdV}>{maskedResidentId || '-'}</td>
            </tr>
            <tr>
              <td className={tdL}>주소</td>
              <td className={tdV}>{emp.address || '-'}</td>
            </tr>
            <tr>
              <td className={tdL}>전화번호</td>
              <td className={tdV}>{emp.phone || '-'}</td>
            </tr>
            <tr>
              <td className={tdL}>계좌 ({emp.bank_name})</td>
              <td className={tdV}>{emp.bank_account || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 메인 계산 테이블 */}
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
          <tr>
            <td className={tdL}>이달의 매출</td>
            <td className={tdV}></td>
            <td className={tdN}>{fmt(revenue)}</td>
          </tr>
          <tr>
            <td className={tdL}>기본 - ①용역비</td>
            <td className={tdV}>비율 {rate}% 적용 → {fmt(revenue)} × {rate}% = {fmt(commissionAmt)}원</td>
            <td className={tdN}>{fmt(commissionAmt)}</td>
          </tr>
          <tr>
            <td className={tdL}>기본 - ②제수당</td>
            <td className={tdV}>하단 제수당 상세내역 참조</td>
            <td className={tdN}>{fmt(allowance)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="border border-gray-400 px-2 py-1 text-xs bg-gray-100 font-bold">기본 계 (①-②)</td>
            <td className={tdV}></td>
            <td className={tdN + ' font-bold'}>{fmt(baseTotal)}</td>
          </tr>
          <tr>
            <td className={tdL}>기본 외 - 인센티브(계약)</td>
            <td className={tdV}></td>
            <td className={tdN}>{fmt(financial.contract_incentive)}</td>
          </tr>
          <tr>
            <td className={tdL}>기본 외 - 추가 인센티브(수수료)</td>
            <td className={tdV}></td>
            <td className={tdN}>{fmt(financial.fee_incentive)}</td>
          </tr>
          <tr>
            <td className={tdL}>기본 외 - 성과보수(프로모션 등)</td>
            <td className={tdV}></td>
            <td className={tdN}>{fmt(financial.performance_bonus)}</td>
          </tr>
          <tr className="font-semibold">
            <td className="border border-gray-400 px-2 py-1 text-xs bg-gray-100 font-bold">기본 외 계</td>
            <td className={tdV}></td>
            <td className={tdN + ' font-bold'}>{fmt(extraTotal)}</td>
          </tr>
          <tr>
            <td className={tdL + ' text-red-700'}>환수금</td>
            <td className={tdV}>{financial.deduction_count}건</td>
            <td className={tdN + ' text-red-700'}>-{fmt(financial.deduction)}</td>
          </tr>
          <tr>
            <td
              colSpan={2}
              className="border border-gray-400 px-2 py-1 text-xs bg-blue-100 font-bold text-blue-900"
            >
              공제 전 지급 총액
            </td>
            <td className="border border-gray-400 px-2 py-1 text-sm font-bold text-blue-700 text-right bg-blue-50">
              {fmt(preTax)}
            </td>
          </tr>
          <tr>
            <td className={tdL}>재공제 - 소득세 3.0%</td>
            <td className={tdV}>({fmt(preTax)} × 3.0%) = {fmt(incomeTax)}원</td>
            <td className={tdN + ' text-red-600'}>-{fmt(incomeTax)}</td>
          </tr>
          <tr>
            <td className={tdL}>재공제 - 지방소득세 0.3%</td>
            <td className={tdV}>({fmt(preTax)} × 0.3%) = {fmt(localTax)}원</td>
            <td className={tdN + ' text-red-600'}>-{fmt(localTax)}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 text-xs bg-gray-100 font-bold">재공제 계</td>
            <td className={tdV}></td>
            <td className={tdN + ' text-red-600 font-bold'}>-{fmt(totalDeduction)}</td>
          </tr>
          <tr>
            <td
              colSpan={2}
              className="border border-gray-400 px-2 py-1 bg-emerald-100 font-bold text-emerald-900"
            >
              실지급액
            </td>
            <td className="border border-gray-400 px-2 py-1 text-base font-black text-emerald-700 text-right bg-emerald-50">
              {fmt(actualPay)}원
            </td>
          </tr>
        </tbody>
      </table>

      {/* 제수당 상세내역 */}
      <table className="border-collapse text-xs w-full">
        <thead>
          <tr>
            <th colSpan={2} className="border border-gray-400 px-2 py-1 bg-gray-200 text-center font-bold">
              제수당 상세내역
            </th>
          </tr>
          <tr>
            <th className="border border-gray-400 px-2 py-1 bg-gray-100 text-center">항목명</th>
            <th className="border border-gray-400 px-2 py-1 bg-gray-100 text-center">금액 (원)</th>
          </tr>
        </thead>
        <tbody>
          {financial.allowance_details.length === 0 ? (
            <tr>
              <td colSpan={2} className="border border-gray-400 px-2 py-2 text-center text-gray-400">
                제수당 내역 없음
              </td>
            </tr>
          ) : (
            financial.allowance_details.map((item: AllowanceDetail, idx: number) => (
              <tr key={idx}>
                <td className={tdV}>{item.name}</td>
                <td className={tdN}>{fmt(item.amount)}</td>
              </tr>
            ))
          )}
          <tr>
            <td className={tdL + ' font-bold'}>합계</td>
            <td className={tdN + ' font-bold'}>{fmt(allowance)}</td>
          </tr>
        </tbody>
      </table>

      {/* 서명란 */}
      <div className="mt-6 flex justify-end gap-8 text-xs text-gray-500">
        <div className="text-center">
          <div className="border-b border-gray-400 w-24 mb-1"></div>
          <span>지급자 (인)</span>
        </div>
        <div className="text-center">
          <div className="border-b border-gray-400 w-24 mb-1"></div>
          <span>수령인 (인)</span>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────

export default function PayslipTab() {
  const [yearMonth, setYearMonth] = useState<string>(thisMonth())
  const [employees, setEmployees] = useState<EmpPersonal[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [financials, setFinancials] = useState<Record<string, EmpFinancial>>({})
  const [company, setCompany] = useState<CompanyInfo>(DEFAULT_COMPANY)
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'payslip'>('payslip')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // 설정 로드
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/payslip-settings')
        const json = await res.json()
        if (json.settings) {
          if (json.settings.employees) setEmployees(json.settings.employees)
          if (json.settings.company_info) setCompany({ ...DEFAULT_COMPANY, ...json.settings.company_info })
        }
      } catch {
        // 설정 없음 - 기본값 사용
      }
    }
    loadSettings()
  }, [])

  const selectedEmp = employees.find((e) => e.id === selectedId) || null
  const currentFinancial = selectedId ? (financials[selectedId] || { ...DEFAULT_FINANCIAL }) : null

  function updateSelectedEmp(field: keyof EmpPersonal, value: string | number) {
    if (!selectedId) return
    setEmployees((prev) =>
      prev.map((e) => (e.id === selectedId ? { ...e, [field]: value } : e))
    )
  }

  function updateFinancial(field: keyof EmpFinancial, value: number | AllowanceDetail[]) {
    if (!selectedId) return
    setFinancials((prev) => ({
      ...prev,
      [selectedId]: { ...(prev[selectedId] || DEFAULT_FINANCIAL), [field]: value },
    }))
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/payslip-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees, company_info: company }),
      })
      const json = await res.json()
      setMsg(json.settings ? '저장 완료' : '저장 실패: ' + json.error)
    } catch {
      setMsg('저장 실패')
    } finally {
      setSaving(false)
    }
  }, [employees, company])

  async function handleLoad() {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch(`/api/payroll?year_month=${yearMonth}`)
      const json = await res.json()
      if (json.record?.employees) {
        const emps = json.record.employees
        const allEmps: any[] = [
          ...(emps.ops_employees || []).map((e: any) => ({ ...e, team: 'ops' })),
          ...(emps.sales_employees || []).map((e: any) => ({ ...e, team: 'sales' })),
        ]
        const newFinancials: Record<string, EmpFinancial> = {}
        setEmployees((prev) => {
          const updated = [...prev]
          for (const emp of allEmps) {
            if (!emp.name) continue
            const match = updated.find((e) => e.name === emp.name)
            if (match) {
              // 영업팀
              if (emp.team === 'sales') {
                const contractIncentiveAmt = Math.round(Number(emp.contract_revenue || 0) * Number(emp.contract_incentive_rate || 0) / 100)
                newFinancials[match.id] = {
                  ...(newFinancials[match.id] || DEFAULT_FINANCIAL),
                  revenue: Number(emp.contract_revenue || 0),
                  contract_incentive: contractIncentiveAmt,
                  fee_incentive: Number(emp.fee_incentive || 0),
                  performance_bonus: Number(emp.performance_bonus || 0),
                  deduction: Number(emp.deduction || 0),
                }
              } else {
                // 관리팀
                const contractIncentive = Math.round(Number(emp.contract_revenue || 0) * 0.5)
                const feeIncentive = Math.round(Number(emp.fee_revenue || 0) * 0.1)
                newFinancials[match.id] = {
                  ...(newFinancials[match.id] || DEFAULT_FINANCIAL),
                  revenue: Number(emp.contract_revenue || 0) + Number(emp.fee_revenue || 0),
                  contract_incentive: contractIncentive,
                  fee_incentive: feeIncentive,
                  performance_bonus: Number(emp.performance_bonus || 0),
                  deduction: Number(emp.deduction || 0),
                }
              }
            }
          }
          return updated
        })
        setFinancials((prev) => ({ ...prev, ...newFinancials }))
        setMsg('불러오기 완료')
      } else {
        setMsg('저장된 급여 데이터가 없습니다.')
      }
    } catch {
      setMsg('불러오기 실패')
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  function addEmployee() {
    const emp = newEmp()
    setEmployees((prev) => [...prev, emp])
    setSelectedId(emp.id)
  }

  return (
    <>
      {/* 인쇄 스타일 */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #payslip-print, #payslip-print * { visibility: visible !important; }
          #payslip-print {
            position: fixed !important;
            top: 0; left: 0;
            width: 100%;
            background: white !important;
            padding: 20px !important;
          }
        }
      `}</style>

      <div className="space-y-4 pb-8">
        {/* 상단 컨트롤 */}
        <div className="flex items-center gap-2 flex-wrap bg-white rounded-xl border border-gray-100 p-3">
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={handleLoad}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-1.5 rounded text-sm font-medium"
          >
            {loading ? '불러오는 중...' : '불러오기'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-1.5 rounded text-sm font-medium"
          >
            {saving ? '저장 중...' : '설정 저장'}
          </button>
          <button
            onClick={handlePrint}
            className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-1.5 rounded text-sm font-medium"
          >
            인쇄
          </button>
          {msg && <span className="text-xs text-gray-500">{msg}</span>}
        </div>

        {/* 2열 레이아웃 */}
        <div className="flex gap-4">
          {/* 왼쪽: 직원 목록 (30%) */}
          <div className="w-72 shrink-0 space-y-2">
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">직원 목록</h3>
                <button
                  onClick={addEmployee}
                  className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-0.5"
                >
                  + 직원 추가
                </button>
              </div>
              {employees.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">직원을 추가해주세요</p>
              ) : (
                <div className="space-y-1">
                  {employees.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedId(emp.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedId === emp.id
                          ? 'bg-gray-900 text-white'
                          : 'hover:bg-gray-50 border border-gray-100'
                      }`}
                    >
                      <div className="font-medium">{emp.name || '(이름 없음)'}</div>
                      <div className={`text-xs ${selectedId === emp.id ? 'text-gray-300' : 'text-gray-400'}`}>
                        {emp.team === 'ops' ? '관리팀' : '영업팀'} · {emp.commission_rate}%
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 회사 정보 편집 */}
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">회사 정보</h3>
              <div className="space-y-2">
                {([
                  ['business_number', '사업자등록번호'],
                  ['address', '주소'],
                  ['ceo_name', '대표자'],
                  ['bank_account', '계좌번호'],
                ] as [keyof CompanyInfo, string][]).map(([field, label]) => (
                  <div key={field}>
                    <label className="text-xs text-gray-500">{label}</label>
                    <input
                      value={company[field]}
                      onChange={(e) => setCompany((prev) => ({ ...prev, [field]: e.target.value }))}
                      className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 w-full mt-0.5"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 오른쪽: 편집/지급내역서 (70%) */}
          <div className="flex-1 min-w-0">
            {!selectedEmp ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400 text-sm">
                왼쪽에서 직원을 선택하거나 추가하세요
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {/* 서브 탭 */}
                <div className="flex border-b border-gray-100">
                  {[
                    { key: 'payslip', label: '지급내역서' },
                    { key: 'settings', label: '설정' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveSubTab(tab.key as 'settings' | 'payslip')}
                      className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                        activeSubTab === tab.key
                          ? 'border-b-2 border-gray-900 text-gray-900'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* 설정 탭 */}
                {activeSubTab === 'settings' && (
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">성명</label>
                        <input
                          value={selectedEmp.name}
                          onChange={(e) => updateSelectedEmp('name', e.target.value)}
                          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">주민등록번호</label>
                        <input
                          value={selectedEmp.resident_id}
                          onChange={(e) => updateSelectedEmp('resident_id', e.target.value)}
                          placeholder="000000-0000000"
                          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">전화번호</label>
                        <input
                          value={selectedEmp.phone}
                          onChange={(e) => updateSelectedEmp('phone', e.target.value)}
                          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">팀</label>
                        <select
                          value={selectedEmp.team}
                          onChange={(e) => updateSelectedEmp('team', e.target.value as 'ops' | 'sales')}
                          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        >
                          <option value="ops">관리팀</option>
                          <option value="sales">영업팀</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">은행명</label>
                        <input
                          value={selectedEmp.bank_name}
                          onChange={(e) => updateSelectedEmp('bank_name', e.target.value)}
                          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">계좌번호</label>
                        <input
                          value={selectedEmp.bank_account}
                          onChange={(e) => updateSelectedEmp('bank_account', e.target.value)}
                          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500 block mb-1">주소</label>
                        <input
                          value={selectedEmp.address}
                          onChange={(e) => updateSelectedEmp('address', e.target.value)}
                          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">용역비 비율 (%)</label>
                        <input
                          type="number"
                          value={selectedEmp.commission_rate}
                          onChange={(e) => updateSelectedEmp('commission_rate', Number(e.target.value))}
                          min={0}
                          max={100}
                          className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                        />
                      </div>
                    </div>

                    <hr className="border-gray-100" />
                    <h4 className="text-sm font-semibold text-gray-700">재무 정보</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {([
                        ['revenue', '이달의 매출'],
                        ['allowance', '②제수당 합계'],
                        ['contract_incentive', '인센티브(계약)'],
                        ['fee_incentive', '추가 인센티브(수수료)'],
                        ['performance_bonus', '성과보수(프로모션)'],
                        ['deduction', '환수금'],
                        ['deduction_count', '환수금 건수'],
                      ] as [keyof EmpFinancial, string][]).map(([field, label]) => (
                        <div key={field}>
                          <label className="text-xs text-gray-500 block mb-1">{label}</label>
                          <input
                            type="number"
                            value={currentFinancial ? (currentFinancial[field] as number) : 0}
                            onChange={(e) => updateFinancial(field, Number(e.target.value))}
                            min={0}
                            className="border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                          />
                        </div>
                      ))}
                    </div>

                    <hr className="border-gray-100" />
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-700">제수당 상세내역</h4>
                      <button
                        onClick={() => {
                          const current = currentFinancial || DEFAULT_FINANCIAL
                          updateFinancial('allowance_details', [
                            ...current.allowance_details,
                            { name: '', amount: 0 },
                          ])
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-0.5"
                      >
                        + 항목 추가
                      </button>
                    </div>
                    {(currentFinancial?.allowance_details || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          value={item.name}
                          onChange={(e) => {
                            const current = currentFinancial || DEFAULT_FINANCIAL
                            const updated = current.allowance_details.map((d, i) =>
                              i === idx ? { ...d, name: e.target.value } : d
                            )
                            updateFinancial('allowance_details', updated)
                          }}
                          placeholder="항목명"
                          className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 flex-1"
                        />
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => {
                            const current = currentFinancial || DEFAULT_FINANCIAL
                            const updated = current.allowance_details.map((d, i) =>
                              i === idx ? { ...d, amount: Number(e.target.value) } : d
                            )
                            updateFinancial('allowance_details', updated)
                          }}
                          min={0}
                          className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
                        />
                        <button
                          onClick={() => {
                            const current = currentFinancial || DEFAULT_FINANCIAL
                            updateFinancial(
                              'allowance_details',
                              current.allowance_details.filter((_: AllowanceDetail, i: number) => i !== idx)
                            )
                          }}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          삭제
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() => setActiveSubTab('payslip')}
                      className="bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      지급내역서 미리보기
                    </button>
                  </div>
                )}

                {/* 지급내역서 탭 */}
                {activeSubTab === 'payslip' && currentFinancial && (
                  <div className="p-4">
                    <PayslipDocument
                      emp={selectedEmp}
                      financial={currentFinancial}
                      company={company}
                      yearMonth={yearMonth}
                    />
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
