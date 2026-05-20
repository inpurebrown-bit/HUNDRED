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
}

interface AllowanceDetail {
  name: string
  amount: number
}

interface EmpFinancial {
  revenue: number
  allowance: number
  allowance_details: AllowanceDetail[]
  contract_count: number    // 이달 계약 건수 (12개 이상이면 30%)
  galsu_promo: number       // 갯수프로모션 금액
  deduction: number         // 환수금 합계
  refund_companies: string  // 환수금 업체명 (쉼표 구분)
}

const COMPANY = {
  business_number: '533-36-01551',
  phone: '010-9806-4095',
  address: '서울특별시 구로구 디지털로 243, 911호',
  ceo_name: '백승협',
  bank_account: '3333-09-9388152',
  bank_name: '카카오뱅크',
}

const DEFAULT_FINANCIAL: EmpFinancial = {
  revenue: 0,
  allowance: 0,
  allowance_details: [],
  contract_count: 0,
  galsu_promo: 0,
  deduction: 0,
  refund_companies: '',
}

// 갯수프로모션 티어 (대표가 직접 설정 가능 — 현재는 기본값)
const GALSU_TIERS = [
  { min: 3, max: 4, label: '3~4개', amount: 50000 },
  { min: 5, max: 6, label: '5~6개', amount: 100000 },
  { min: 7, max: 8, label: '7~8개', amount: 150000 },
  { min: 9, max: 10, label: '9~10개', amount: 200000 },
  { min: 11, max: 11, label: '11개', amount: 250000 },
  { min: 12, max: 999, label: '12개 이상', amount: 300000 },
]

function getGalsuTier(count: number) {
  return GALSU_TIERS.find(t => count >= t.min && count <= t.max) || null
}

function thisMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function newEmp(): EmpPersonal {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    name: '',
    resident_id: '',
    address: '',
    phone: '',
    bank_account: '',
    bank_name: '카카오뱅크',
    team: 'sales',
  }
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

// ─── 지급내역서 문서 컴포넌트 ─────────────────────────────

function PayslipDocument({
  emp,
  financial,
  yearMonth,
}: {
  emp: EmpPersonal
  financial: EmpFinancial
  yearMonth: string
}) {
  const count = financial.contract_count || 0
  // 용역비율: 기본 25%, 12개 이상이면 30%
  const rate = count >= 12 ? 30 : 25
  const revenue = financial.revenue
  const allowance = financial.allowance
  const galsuPromo = financial.galsu_promo || 0

  const commissionAmt = Math.round(revenue * rate / 100)
  const baseAfterAllow = commissionAmt - allowance
  const preTax = baseAfterAllow + galsuPromo - financial.deduction
  const incomeTax = Math.round(preTax * 0.03)
  const localTax = Math.round(preTax * 0.003)
  const totalDeduction = incomeTax + localTax
  const actualPay = preTax - incomeTax - localTax

  const [year, month] = yearMonth.split('-')
  const title = `${year}년 ${Number(month)}월 용역비 지급내역서`
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const maskedResidentId = emp.resident_id
    ? emp.resident_id.replace(/^(\d{6})-?(\d{1})\d{6}$/, '$1-$2******')
    : ''

  const tdL = 'border border-gray-400 px-2 py-1 text-xs bg-gray-100 font-medium whitespace-nowrap'
  const tdV = 'border border-gray-400 px-2 py-1 text-xs'
  const tdN = 'border border-gray-400 px-2 py-1 text-xs text-right'

  const tier = getGalsuTier(count)
  const refundNames = financial.refund_companies?.trim()
    ? financial.refund_companies.split(',').map(s => s.trim()).filter(Boolean)
    : []

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

      {/* 발행 회사 정보 (compact) */}
      <div className="flex justify-between items-start mb-3 text-xs text-gray-500 border-b border-gray-200 pb-2">
        <div className="space-y-0.5">
          <span className="font-semibold text-gray-700">헌드레드 컨설팅</span>
          <span className="ml-3">사업자: {COMPANY.business_number}</span>
          <span className="ml-3">대표: {COMPANY.ceo_name}</span>
          <span className="ml-3">전화: {COMPANY.phone}</span>
        </div>
        <div className="text-right space-y-0.5">
          <div>기준월: <b className="text-gray-800">{yearMonth}</b></div>
          <div>매출: <b className="text-gray-800">{fmt(revenue)}원</b></div>
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
            <td className={tdL}>① 용역비</td>
            <td className={tdV}>
              {fmt(revenue)} × {rate}%
              {count > 0 && (
                <span className={`ml-1 font-medium ${count >= 12 ? 'text-blue-700' : 'text-gray-600'}`}>
                  ({count}건{count >= 12 ? ' — 12개↑ 30% 적용' : count >= 3 ? ` — 갯수프로모션 ${tier ? tier.label : ''}` : ''})
                </span>
              )}
            </td>
            <td className={tdN}>{fmt(commissionAmt)}</td>
          </tr>
          <tr>
            <td className={tdL}>② 제수당</td>
            <td className={tdV}>하단 상세내역 참조</td>
            <td className={tdN}>{fmt(allowance)}</td>
          </tr>
          <tr className="font-semibold bg-gray-50">
            <td className="border border-gray-400 px-2 py-1 text-xs font-bold">기본 계 (①-②)</td>
            <td className={tdV}></td>
            <td className={tdN + ' font-bold'}>{fmt(baseAfterAllow)}</td>
          </tr>
          {/* 갯수프로모션 */}
          {galsuPromo > 0 && (
            <tr>
              <td className={tdL}>갯수프로모션</td>
              <td className={tdV}>
                {count}건 계약
                {tier && <span className="ml-1 text-emerald-700 font-medium">({tier.label} 구간)</span>}
              </td>
              <td className={tdN + ' text-emerald-700 font-semibold'}>{fmt(galsuPromo)}</td>
            </tr>
          )}
          {/* 환수금 */}
          <tr>
            <td className={tdL + ' text-red-700'}>환수금</td>
            <td className={tdV + ' text-red-600'}>
              {refundNames.length > 0 ? refundNames.join(', ') : '-'}
            </td>
            <td className={tdN + ' text-red-700'}>
              {financial.deduction > 0 ? `-${fmt(financial.deduction)}` : '-'}
            </td>
          </tr>
          {/* 공제 전 총액 */}
          <tr>
            <td colSpan={2}
              className="border border-gray-400 px-2 py-1 text-xs bg-blue-100 font-bold text-blue-900">
              공제 전 지급 총액
            </td>
            <td className="border border-gray-400 px-2 py-1 text-sm font-bold text-blue-700 text-right bg-blue-50">
              {fmt(preTax)}
            </td>
          </tr>
          {/* 원천세 (두 줄) */}
          <tr>
            <td className={tdL}>원천세 — 소득세 3.0%</td>
            <td className={tdV}>{fmt(preTax)} × 3.0%</td>
            <td className={tdN + ' text-red-600'}>-{fmt(incomeTax)}</td>
          </tr>
          <tr>
            <td className={tdL}>원천세 — 지방소득세 0.3%</td>
            <td className={tdV}>{fmt(preTax)} × 0.3%</td>
            <td className={tdN + ' text-red-600'}>-{fmt(localTax)}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 text-xs bg-gray-100 font-bold">원천세 합계</td>
            <td className={tdV}></td>
            <td className={tdN + ' text-red-600 font-bold'}>-{fmt(totalDeduction)}</td>
          </tr>
          {/* 실지급액 */}
          <tr>
            <td colSpan={2}
              className="border border-gray-400 px-2 py-1 bg-emerald-100 font-bold text-emerald-900">
              실지급액
            </td>
            <td className="border border-gray-400 px-2 py-1 text-base font-black text-emerald-700 text-right bg-emerald-50">
              {fmt(actualPay)}원
            </td>
          </tr>
        </tbody>
      </table>

      {/* 갯수프로모션 티어 안내 */}
      <table className="border-collapse text-xs w-full mb-3">
        <thead>
          <tr>
            <th colSpan={8} className="border border-gray-400 px-2 py-1 bg-gray-100 text-center font-bold">
              갯수프로모션 구간 안내
            </th>
          </tr>
          <tr>
            {GALSU_TIERS.map(t => (
              <th key={t.label}
                className={`border border-gray-400 px-1.5 py-1 text-center text-[10px] font-medium ${
                  count >= t.min && count <= t.max ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-50 text-gray-500'
                }`}>
                {t.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {GALSU_TIERS.map(t => (
              <td key={t.label}
                className={`border border-gray-400 px-1.5 py-1 text-center text-[10px] ${
                  count >= t.min && count <= t.max ? 'bg-emerald-50 font-bold text-emerald-700' : 'text-gray-500'
                }`}>
                {(t.amount / 10000).toFixed(0)}만원
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* 제수당 상세내역 */}
      {financial.allowance_details.length > 0 && (
        <table className="border-collapse text-xs w-full mb-3">
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
            {financial.allowance_details.map((item, idx) => (
              <tr key={idx}>
                <td className={tdV}>{item.name}</td>
                <td className={tdN}>{fmt(item.amount)}</td>
              </tr>
            ))}
            <tr>
              <td className={tdL + ' font-bold'}>합계</td>
              <td className={tdN + ' font-bold'}>{fmt(allowance)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* 개인정보 섹션 — 지급 결의서 형태 */}
      <div className="mt-4 border-t border-gray-300 pt-4 text-xs text-gray-700 space-y-1 print:block">
        <p className="font-bold text-gray-600 mb-1.5">◆ 수급자 확인</p>
        <p>성명: <span className="font-semibold">{emp.name || '—'}</span></p>
        <p>주민번호: <span className="font-mono">{maskedResidentId || '—'}</span></p>
        <p>주소: {emp.address || '—'}</p>
        <p>계좌: {emp.bank_name} {emp.bank_account || '—'}</p>
      </div>

      {/* 감사 메시지 */}
      <div className="mt-5 text-center text-sm text-gray-600 py-3 border-t border-gray-200">
        ♥ 귀하의 노고에 진심으로 감사드립니다. -헌드레드 컨설팅
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
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/payslip-settings')
        const json = await res.json()
        if (json.settings?.employees) setEmployees(json.settings.employees)
      } catch { /* no settings yet */ }
    }
    loadSettings()
  }, [])

  const selectedEmp = employees.find(e => e.id === selectedId) || null
  const currentFinancial: EmpFinancial = selectedId
    ? (financials[selectedId] || { ...DEFAULT_FINANCIAL })
    : { ...DEFAULT_FINANCIAL }

  function updateSelectedEmp(field: keyof EmpPersonal, value: string) {
    if (!selectedId) return
    setEmployees(prev => prev.map(e => e.id === selectedId ? { ...e, [field]: value } : e))
  }

  function updateFinancial(patch: Partial<EmpFinancial>) {
    if (!selectedId) return
    setFinancials(prev => ({
      ...prev,
      [selectedId]: { ...(prev[selectedId] || DEFAULT_FINANCIAL), ...patch },
    }))
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/payslip-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employees }),
      })
      const json = await res.json()
      setMsg(json.settings ? '✅ 저장 완료' : '❌ 저장 실패')
    } catch { setMsg('❌ 저장 실패') }
    finally { setSaving(false) }
  }, [employees])

  // 급여대장에서 매출 자동 불러오기 (없으면 고객 DB로 폴백)
  async function handleLoad() {
    setLoading(true)
    setMsg('')
    try {
      const res = await fetch(`/api/payroll?year_month=${yearMonth}`)
      const json = await res.json()
      if (json.record?.employees) {
        // 급여대장 데이터 있음
        const emps = json.record.employees
        const allEmps: any[] = [
          ...(emps.ops_employees || []).map((e: any) => ({ ...e, team: 'ops' })),
          ...(emps.sales_employees || []).map((e: any) => ({ ...e, team: 'sales' })),
        ]
        const updates: Record<string, Partial<EmpFinancial>> = {}
        for (const emp of allEmps) {
          if (!emp.name) continue
          const match = employees.find(e => e.name === emp.name || e.name.startsWith(emp.name) || emp.name.startsWith(e.name))
          if (match) {
            const rev = Number(emp.contract_revenue || 0)
            updates[match.id] = {
              ...(financials[match.id] || DEFAULT_FINANCIAL),
              revenue: rev,
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
        setMsg('✅ 급여대장에서 매출 불러오기 완료')
      } else {
        // 폴백: 고객 DB에서 직접 계산
        const custRes = await fetch('/api/customers')
        const custJson = await custRes.json()
        const custs: any[] = custJson.customers || []
        const updates: Record<string, Partial<EmpFinancial>> = {}
        employees.forEach(emp => {
          const cleanN = (s: string) => s.replace(/\s*(수석팀장|팀장|팀원|대리|과장|부장|차장|이사|수석|매니저|주임|사원).*/g, '').trim()
          const myContracts = custs.filter((c: any) =>
            c.status === 'contracted' &&
            ((c.details?.contract_date || '').slice(0, 7) === yearMonth) &&
            (() => {
              const owner = (c.details?.sales_user_name || c.sales_user_name || '').trim()
              return owner === emp.name || cleanN(owner) === cleanN(emp.name)
            })()
          )
          const revenue = myContracts.reduce((s: number, c: any) =>
            s + (parseInt(String(c.details?.my_revenue || '0').replace(/[^0-9]/g, ''), 10) || 0), 0)
          const count = myContracts.reduce((s: number, c: any) => {
            const amt = Number(c.details?.payment_amount || 0)
            return s + (amt <= 330000 && amt > 0 ? 0.5 : 1)
          }, 0)
          if (revenue > 0 || count > 0) {
            const tier = getGalsuTier(count)
            updates[emp.id] = {
              ...(financials[emp.id] || DEFAULT_FINANCIAL),
              revenue,
              contract_count: count,
              galsu_promo: tier ? tier.amount : 0,
            }
          }
        })
        setFinancials(prev => {
          const next = { ...prev }
          for (const [id, patch] of Object.entries(updates)) {
            next[id] = { ...(next[id] || DEFAULT_FINANCIAL), ...patch }
          }
          return next
        })
        setMsg(Object.keys(updates).length > 0 ? '✅ 고객 DB에서 매출 불러오기 완료' : '이달 계약 데이터가 없습니다.')
      }
    } catch { setMsg('❌ 불러오기 실패') }
    finally { setLoading(false) }
  }

  function handlePrint() { window.print() }

  function addEmployee() {
    const emp = newEmp()
    setEmployees(prev => [...prev, emp])
    setSelectedId(emp.id)
    setEditMode(true)
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #payslip-print, #payslip-print * { visibility: visible !important; }
          #payslip-print {
            position: fixed !important;
            top: 0; left: 0;
            width: 100%;
            background: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            padding: 20px !important;
          }
          /* A4 1명 1페이지 */
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          /* 불필요한 UI 버튼 숨김 */
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="space-y-4 pb-8">
        {/* 상단 컨트롤 바 */}
        <div className="no-print bg-[#1B2A45] rounded-xl px-5 py-3 flex items-center gap-3 flex-wrap">
          <input
            type="month"
            value={yearMonth}
            onChange={e => setYearMonth(e.target.value)}
            className="border border-white/20 bg-white/10 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          />
          <button onClick={handleLoad} disabled={loading}
            className="bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
            {loading ? '불러오는 중...' : '📥 매출 자동불러오기'}
          </button>
          <button onClick={handleSave} disabled={saving}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
            {saving ? '저장 중...' : '💾 직원 정보 저장'}
          </button>
          <button onClick={handlePrint}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
            🖨️ 인쇄
          </button>
          {msg && <span className="text-xs text-white/80">{msg}</span>}
        </div>

        <div className="flex gap-4">
          {/* 왼쪽: 직원 목록 */}
          <div className="no-print w-56 shrink-0">
            <div className="bg-white rounded-xl border border-[#E8E2D4] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E8E2D4] flex items-center justify-between">
                <p className="text-xs font-bold text-gray-600">프리랜서 목록</p>
                <button onClick={addEmployee}
                  className="text-xs bg-[#1B2A45] text-white px-2 py-0.5 rounded-lg">
                  + 추가
                </button>
              </div>
              {employees.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  <p>등록된 직원이 없습니다</p>
                  <button onClick={addEmployee}
                    className="mt-2 text-blue-500 underline text-xs">직원 추가하기</button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {employees.map(emp => {
                    const fin = financials[emp.id]
                    const count = fin?.contract_count || 0
                    const rate = count >= 12 ? 30 : 25
                    return (
                      <button key={emp.id}
                        onClick={() => { setSelectedId(emp.id); setEditMode(false) }}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          selectedId === emp.id ? 'bg-[#1B2A45]' : 'hover:bg-gray-50'
                        }`}>
                        <p className={`text-sm font-semibold ${selectedId === emp.id ? 'text-white' : 'text-gray-800'}`}>
                          {emp.name || '(이름 없음)'}
                        </p>
                        <p className={`text-[10px] mt-0.5 ${selectedId === emp.id ? 'text-white/60' : 'text-gray-400'}`}>
                          {emp.team === 'ops' ? '관리팀' : '영업팀'} · {rate}%
                          {fin?.revenue ? ` · ${(fin.revenue / 10000).toFixed(0)}만` : ''}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 내용 */}
          <div className="flex-1 min-w-0">
            {!selectedEmp ? (
              <div className="bg-white rounded-xl border border-[#E8E2D4] p-12 text-center text-gray-400 text-sm">
                <p>왼쪽에서 직원을 선택하세요</p>
                <p className="text-xs mt-1 text-gray-300">이름을 클릭하면 지급내역서를 확인할 수 있습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 직원 헤더 + 편집 토글 */}
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
                      {editMode ? '✓ 미리보기' : '✏️ 편집'}
                    </button>
                    <button onClick={() => {
                      if (!confirm('이 직원을 삭제하시겠습니까?')) return
                      setEmployees(p => p.filter(e => e.id !== selectedEmp.id))
                      setSelectedId(null)
                    }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-400 hover:bg-red-50">
                      삭제
                    </button>
                  </div>
                </div>

                {editMode ? (
                  /* ── 편집 폼 ── */
                  <div className="no-print bg-white rounded-xl border border-[#E8E2D4] p-5 space-y-5">
                    {/* 개인 정보 */}
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-3">👤 개인 정보</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          ['name', '성명', 'text'],
                          ['resident_id', '주민등록번호', 'text'],
                          ['phone', '전화번호', 'text'],
                          ['bank_name', '은행명', 'text'],
                          ['bank_account', '계좌번호', 'text'],
                        ] as [keyof EmpPersonal, string, string][]).map(([field, label]) => (
                          <div key={field}>
                            <label className="text-xs text-gray-500 block mb-1">{label}</label>
                            <input
                              value={selectedEmp[field] as string}
                              onChange={e => updateSelectedEmp(field, e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </div>
                        ))}
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">팀</label>
                          <select
                            value={selectedEmp.team}
                            onChange={e => updateSelectedEmp('team', e.target.value as 'ops' | 'sales')}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400">
                            <option value="sales">영업팀</option>
                            <option value="ops">관리팀</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500 block mb-1">주소</label>
                          <input
                            value={selectedEmp.address}
                            onChange={e => updateSelectedEmp('address', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                      </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* 재무 정보 */}
                    <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-3">💰 이달 재무 정보</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            이달 매출 (원)
                            <span className="text-gray-400 ml-1">"매출 자동불러오기" 사용 가능</span>
                          </label>
                          <input type="number" value={currentFinancial.revenue}
                            onChange={e => updateFinancial({ revenue: Number(e.target.value) })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            이달 계약 건수
                            <span className={`ml-2 font-semibold text-[10px] px-1.5 py-0.5 rounded ${
                              currentFinancial.contract_count >= 12
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {currentFinancial.contract_count >= 12 ? '30% 적용' : '25% 적용'}
                            </span>
                          </label>
                          <input type="number" value={currentFinancial.contract_count}
                            onChange={e => {
                              const cnt = Number(e.target.value)
                              const tier = getGalsuTier(cnt)
                              updateFinancial({ contract_count: cnt, galsu_promo: tier ? tier.amount : 0 })
                            }}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">
                            갯수프로모션 금액 (원)
                            {currentFinancial.contract_count >= 3 && (
                              <span className="ml-1 text-emerald-600 text-[10px]">
                                추천: {fmt(getGalsuTier(currentFinancial.contract_count)?.amount || 0)}원
                              </span>
                            )}
                          </label>
                          <input type="number" value={currentFinancial.galsu_promo}
                            onChange={e => updateFinancial({ galsu_promo: Number(e.target.value) })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">제수당 합계 (원)</label>
                          <input type="number" value={currentFinancial.allowance}
                            onChange={e => updateFinancial({ allowance: Number(e.target.value) })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">환수금 합계 (원)</label>
                          <input type="number" value={currentFinancial.deduction}
                            onChange={e => updateFinancial({ deduction: Number(e.target.value) })}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">환수금 업체명 (쉼표 구분)</label>
                          <input type="text" value={currentFinancial.refund_companies}
                            onChange={e => updateFinancial({ refund_companies: e.target.value })}
                            placeholder="예: (주)ABC, 테크주식회사"
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                      </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* 제수당 상세 */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-700">제수당 상세내역</h4>
                        <button
                          onClick={() => updateFinancial({
                            allowance_details: [...currentFinancial.allowance_details, { name: '', amount: 0 }]
                          })}
                          className="text-xs text-blue-600 border border-blue-200 rounded px-2 py-0.5 hover:bg-blue-50">
                          + 항목 추가
                        </button>
                      </div>
                      <div className="space-y-2">
                        {currentFinancial.allowance_details.map((item, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <input
                              value={item.name}
                              onChange={e => {
                                const updated = currentFinancial.allowance_details.map((d, i) =>
                                  i === idx ? { ...d, name: e.target.value } : d)
                                updateFinancial({ allowance_details: updated })
                              }}
                              placeholder="항목명"
                              className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none" />
                            <input
                              type="number"
                              value={item.amount}
                              onChange={e => {
                                const updated = currentFinancial.allowance_details.map((d, i) =>
                                  i === idx ? { ...d, amount: Number(e.target.value) } : d)
                                updateFinancial({ allowance_details: updated })
                              }}
                              className="w-32 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none" />
                            <button
                              onClick={() => updateFinancial({
                                allowance_details: currentFinancial.allowance_details.filter((_, i) => i !== idx)
                              })}
                              className="text-red-400 hover:text-red-600 text-xs">삭제</button>
                          </div>
                        ))}
                        {currentFinancial.allowance_details.length === 0 && (
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
                  /* ── 지급내역서 미리보기 ── */
                  <div className="bg-white rounded-xl border border-[#E8E2D4] p-4">
                    <PayslipDocument
                      emp={selectedEmp}
                      financial={currentFinancial}
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
