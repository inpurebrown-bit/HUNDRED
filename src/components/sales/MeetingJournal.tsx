'use client'

import { useEffect } from 'react'

interface MeetingJournalProps {
  customer: {
    name: string
    phone: string
    company: string
    details?: Record<string, any>
    notes?: string
  }
  onClose: () => void
}

function V({ v, placeholder = '' }: { v?: string | null; placeholder?: string }) {
  if (v && String(v).trim()) {
    return <span className="text-[#1B2A45] font-semibold">{v}</span>
  }
  return <span className="text-gray-300 text-[10px]">{placeholder}</span>
}

const TH = 'bg-[#c6d9b0] border border-[#7a9a5a] text-[10px] font-bold text-[#1B2A45] text-center align-middle px-1 py-1 whitespace-nowrap'
const TD = 'border border-[#7a9a5a] text-[10px] text-gray-700 px-1.5 py-1 align-middle'
const LABEL = 'text-[9px] font-bold text-gray-500 whitespace-nowrap'
const LINE = 'border-b border-gray-300 min-w-[60px] inline-block text-[10px] px-1'

export default function MeetingJournal({ customer, onClose }: MeetingJournalProps) {
  const d = customer.details || {}
  const company = d.company || customer.company || ''
  const name = customer.name || ''
  const phone = customer.phone || ''

  const today = new Date()
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`

  // Prevent body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handlePrint() {
    window.print()
  }

  return (
    <>
      {/* ── 프린트용 전용 CSS ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body > * { display: none !important; }
          #mj-print-root { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
          #mj-print-root .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 10mm; }
          #mj-print-root table { border-collapse: collapse !important; }
          #mj-print-root td, #mj-print-root th { border: 1px solid #4a7a2a !important; }
        }
      `}} />

      {/* ── 모달 오버레이 ── */}
      <div
        className="fixed inset-0 z-[600] bg-black/70 overflow-y-auto py-4"
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-2xl">

          {/* ── 컨트롤 바 (프린트 시 숨김) ── */}
          <div className="no-print flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[#1B2A45]">📋 미팅일지 미리보기</span>
              <span className="text-xs text-gray-400">{company}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1B2A45] hover:bg-[#253B5E] text-white text-xs font-semibold transition-colors"
              >
                🖨️ 출력 / PDF 저장
              </button>
              <button
                onClick={onClose}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 text-xs font-semibold transition-colors"
              >
                ✕ 닫기
              </button>
            </div>
          </div>

          {/* ── 프린트 본문 ── */}
          <div id="mj-print-root" className="p-6" style={{ fontFamily: 'Malgun Gothic, Apple SD Gothic Neo, sans-serif' }}>

            {/* ── 최상단: 로고 + 회사정보 ── */}
            <div className="flex items-start justify-between mb-3">
              {/* 로고 */}
              <div className="flex flex-col items-start">
                <img src="/images/logo.png" alt="HUNDRED" style={{ height: 40, objectFit: 'contain' }} />
              </div>
              {/* 업체명 + 일시 */}
              <div className="flex flex-col items-end gap-0.5 text-[11px]">
                <div className="text-xl font-bold text-[#1B2A45] mb-1 self-center">
                  {company || <span className="text-gray-300">업체명</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-semibold">일시 :</span>
                  <span className="border-b border-gray-400 min-w-[140px] pl-1 text-[#1B2A45]">{dateStr}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-semibold">대표사 :</span>
                  <span className="border-b border-gray-400 min-w-[140px] pl-1 text-[#1B2A45]">{name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-semibold">전화번호 :</span>
                  <span className="border-b border-gray-400 min-w-[140px] pl-1 text-[#1B2A45]">{phone}</span>
                </div>
              </div>
            </div>

            {/* ── 메인 테이블 ── */}
            <table className="w-full border-collapse text-[10px]" style={{ borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '11%' }} />
              </colgroup>

              {/* ══════════════════════════════════════════
                  SECTION 1: 사업자
              ══════════════════════════════════════════ */}
              <tbody>
                {/* 사업자 Row 1: 종류 + 매출 */}
                <tr>
                  <td rowSpan={6} className={TH}>사업자</td>
                  <td className={TH}>종류</td>
                  <td className={TD}>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold mr-1 ${d.corp_type === '개인' ? 'bg-blue-500 text-white' : 'border border-gray-300 text-gray-400'}`}>개인</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${d.corp_type === '법인' ? 'bg-blue-500 text-white' : 'border border-gray-300 text-gray-400'}`}>법인</span>
                  </td>
                  <td className={TH} colSpan={2}>매출</td>
                  <td className={TD}><span className={LABEL}>26년(월)</span><br /><V v={d.revenue_2026} /></td>
                  <td className={TD}><span className={LABEL}>25년</span><br /><V v={d.revenue_2025} /></td>
                  <td className={TD}><span className={LABEL}>24년</span><br /><V v={d.revenue_2024} /></td>
                  <td className={TD}><span className={LABEL}>23년</span><br /><V v={d.revenue_2023} /></td>
                  <td className={TD}><span className={LABEL}>22년</span><br /><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TD}></td>
                </tr>

                {/* 사업자 Row 2: 업태/업종 + 체납 */}
                <tr>
                  <td className={TH}>업태/업종</td>
                  <td className={TD}><V v={d.business_type} /></td>
                  <td className={TH} rowSpan={3}>체납<br />사신</td>
                  <td className={TD} colSpan={6}>
                    <span className={LABEL}>국세</span>&nbsp;
                    <span className={LABEL}>지방세</span>&nbsp;
                    <span className={LABEL}>카드</span>&nbsp;
                    <span className={LABEL}>중소세</span>&nbsp;
                    <span className={LABEL}>원산세</span>&nbsp;
                    <span className={LABEL}>무가세</span>&nbsp;
                    <span className={LABEL}>4대보험</span>&nbsp;
                    <span className={LABEL}>그외기타</span>
                    <br />
                    <V v={d.tax_status || d.tax_delinquency} />
                  </td>
                  <td className={TD}><span className={LABEL}>KCB</span><br /><V v={d.credit_kcb || d.credit_score} /></td>
                </tr>

                {/* 사업자 Row 3: 업력 + NICE */}
                <tr>
                  <td className={TH}>업력 (개업일)</td>
                  <td className={TD}><V v={d.years_in_business || d.biz_size} /></td>
                  <td className={TD} colSpan={6}></td>
                  <td className={TD}><span className={LABEL}>NICE</span><br /><V v={d.credit_nice} /></td>
                </tr>

                {/* 사업자 Row 4: 직원수 + 부채비율/이자보상배수 */}
                <tr>
                  <td className={TH}>직원 수<br /><span className="font-normal text-[8px]">(4대보험기준)</span></td>
                  <td className={TD}><V v={d.employee_count} /></td>
                  <td className={TD} colSpan={3}></td>
                  <td className={TD}><span className={LABEL}>부채비율</span><br /><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TD}><span className={LABEL}>이자보상배수</span><br /><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TD}><span className={LABEL}>공정과정</span><br /><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                </tr>

                {/* 사업자 Row 5: 사업장위치 */}
                <tr>
                  <td className={TH}>사업장 위치</td>
                  <td className={TD} colSpan={8}><V v={d.region} /></td>
                </tr>

                {/* 사업자 Row 6: 사업내용 */}
                <tr>
                  <td className={TH}>사업내용</td>
                  <td className={TD} colSpan={8} style={{ minHeight: 28 }}>
                    <V v={d.real_work || d.business_description} />
                  </td>
                  <td className={TD}></td>
                </tr>

                {/* ══════════════════════════════════════════
                    SECTION 2: 기대출
                ══════════════════════════════════════════ */}
                <tr>
                  <td rowSpan={3} className={TH}>기대출</td>
                  <td className={TH}>정책자금</td>
                  <td className={TD} colSpan={7}><V v={d.loan_kibo || d.loan_policy} placeholder="없음" /></td>
                  <td className={TD}><span className={LABEL}>부채비율</span><br /><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                </tr>
                <tr>
                  <td className={TH}>신용 대출</td>
                  <td className={TD} colSpan={5}>
                    <div className="flex flex-wrap gap-2 text-[9px]">
                      {[
                        ['신보', d.loan_shinbo],
                        ['재단', d.loan_jaedan],
                        ['중진공', d.loan_jinjong],
                        ['소진공', d.loan_sojin],
                        ['기타', d.loan_other || d.loan_credit],
                      ].map(([label, val]) => val ? (
                        <span key={label as string}><b>{label}</b>: <V v={val as string} /></span>
                      ) : null)}
                      {!d.loan_shinbo && !d.loan_jaedan && !d.loan_jinjong && !d.loan_sojin && !d.loan_other && !d.loan_credit && <V v="" placeholder="—" />}
                    </div>
                  </td>
                  <td className={TD}><span className={LABEL}>합계</span><br /><V v={d.loan_total} /></td>
                  <td className={TD}></td>
                  <td className={TD}><span className={LABEL}>이자보상배수</span><br /><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                </tr>
                <tr>
                  <td className={TH}>담보 대출</td>
                  <td className={TD} colSpan={4}><V v={d.loan_mortgage} placeholder="—" /></td>
                  <td className={TD}><span className={LABEL}>세무서(연락처)</span><br /><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TD}><span className={LABEL}>회생여부(회사)</span><br /><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TD}><span className={LABEL}>별도 사업자</span><br /><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TD}></td>
                </tr>

                {/* ══════════════════════════════════════════
                    SECTION 3: 대표자
                ══════════════════════════════════════════ */}
                <tr>
                  <td rowSpan={6} className={TH}>대표자</td>
                  <td className={TH}>성별</td>
                  <td className={TD}>
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px] mr-1">남</span>
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px]">여</span>
                  </td>
                  <td className={TH}>수출</td>
                  <td className={TD} colSpan={2}>
                    <span className={LABEL}>직원채용예정(공고)</span><br />
                    <span className="border-b border-gray-300 inline-block min-w-[80px]">&nbsp;</span>
                  </td>
                  <td className={TD} colSpan={2}>
                    <span className={LABEL}>수출(수출실적증명)</span><br />
                    <span className="border-b border-gray-300 inline-block min-w-[80px]">&nbsp;</span>
                  </td>
                  <td className={TD}>
                    <span className={LABEL}>회생여부(회사)</span><br />
                    <span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span>
                  </td>
                  <td className={TD}>
                    <span className={LABEL}>별도사업자</span><br />
                    <span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span>
                  </td>
                </tr>
                <tr>
                  <td className={TH}>나이</td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TH} rowSpan={2}>사업에<br />투자한<br />비용</td>
                  <td className={TD} colSpan={2} rowSpan={2}>
                    <span className="border-b border-gray-300 block min-h-[32px]">&nbsp;</span>
                  </td>
                  <td className={TH} rowSpan={2}>기계/도구<br />(스마트기기)</td>
                  <td className={TD} colSpan={2} rowSpan={2}>
                    <span className="border-b border-gray-300 block min-h-[32px]">&nbsp;</span>
                  </td>
                  <td className={TD} rowSpan={2}>
                    <span className={LABEL}>고객관리</span><br />
                    <span className="text-[9px] text-gray-400">데이터베이스<br />종래이지<br />예약하기판들기</span>
                  </td>
                </tr>
                <tr>
                  <td className={TH}>혼인여부</td>
                  <td className={TD}>
                    <span className="text-[9px]">여&nbsp;</span>
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px]">有</span>
                    &nbsp;/&nbsp;
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px]">無</span>
                    <br /><span className={LABEL}>자녀: </span>
                    <span className="border-b border-gray-300 inline-block min-w-[30px]">&nbsp;</span>
                  </td>
                </tr>
                <tr>
                  <td className={TH}>동종업 경력</td>
                  <td className={TD} colSpan={2}><span className="border-b border-gray-300 inline-block min-w-[80px]">&nbsp;</span></td>
                  <td className={TH}>특허/인증</td>
                  <td className={TD} colSpan={5}><V v={d.patent} /></td>
                </tr>
                <tr>
                  <td className={TH}>보유자산<br /><span className="font-normal text-[8px]">(진기/사무실)</span></td>
                  <td className={TD} colSpan={2}><V v={d.assets} /></td>
                  <td className={TH} colSpan={2}>고객관리 도구</td>
                  <td className={TD} colSpan={4}>
                    <span className="text-[9px] text-gray-400">☐ 데이터베이스&nbsp;&nbsp;☐ 홈페이지&nbsp;&nbsp;☐ 예약시스템&nbsp;&nbsp;☐ POS&nbsp;&nbsp;☐ 기타:</span>
                    <span className="border-b border-gray-300 inline-block min-w-[60px]">&nbsp;</span>
                  </td>
                  <td className={TD}></td>
                </tr>
                <tr>
                  <td className={TH}>필요자금</td>
                  <td className={TD}><V v={d.required_funds} /></td>
                  <td className={TH}>용도</td>
                  <td className={TD} colSpan={7}><span className="border-b border-gray-300 inline-block min-w-[200px]">&nbsp;</span></td>
                </tr>

                {/* ══════════════════════════════════════════
                    SECTION 4: 특허
                ══════════════════════════════════════════ */}
                <tr>
                  <td className={TH}>특허<br /><span className="font-normal text-[8px]">(상표권,실용신안<br />디자인권 등<br />지식재산권)</span></td>
                  <td className={TH}>내용</td>
                  <td className={TD}><V v={d.patent} /></td>
                  <td className={TH}>등록원</td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TH}>매출 영향</td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TH} colSpan={2}>특허권자(개인/법인)</td>
                  <td className={TH}>등급</td>
                  <td className={TD}>
                    <span className={LABEL}>가치평가</span><br />
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px] mr-1">有</span>
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px]">無</span>
                  </td>
                </tr>

                {/* ══════════════════════════════════════════
                    SECTION 5: 제조
                ══════════════════════════════════════════ */}
                <tr>
                  <td rowSpan={4} className={TH}>제조</td>
                  <td className={TH}>제작 방식<br /><span className="font-normal text-[8px]">(시장/주문)</span></td>
                  <td className={TD}>
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px] mr-1">시장</span>
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px]">주문</span>
                  </td>
                  <td className={TH} rowSpan={2}>기계</td>
                  <td className={TH}>기계설비</td>
                  <td className={TH}>기계종류</td>
                  <td className={TH}>기계가격</td>
                  <td className={TH} colSpan={3}>거래 내역</td>
                  <td className={TD}></td>
                </tr>
                <tr>
                  <td className={TH}>직접제작<br />/OEM,ODM</td>
                  <td className={TD}>
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px] mr-1">직접</span>
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px] mr-1">OEM</span>
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px]">ODM</span>
                  </td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TD} colSpan={3}>
                    <span className={LABEL}>공장: </span>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-1">자가</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">임차</span>
                    <br />
                    <span className={LABEL}>시세/보증금: </span>
                    <span className="border-b border-gray-300 inline-block min-w-[60px]">&nbsp;</span>
                  </td>
                  <td className={TD}></td>
                </tr>
                <tr>
                  <td className={TH}>제품매출<br />비중</td>
                  <td className={TD} colSpan={4}>
                    <span className={LABEL}>OEM</span>&nbsp;
                    <span className="border-b border-gray-300 inline-block min-w-[30px]">&nbsp;</span>%&nbsp;&nbsp;
                    <span className={LABEL}>ODM</span>&nbsp;
                    <span className="border-b border-gray-300 inline-block min-w-[30px]">&nbsp;</span>%&nbsp;&nbsp;
                    <span className={LABEL}>기타</span>&nbsp;
                    <span className="border-b border-gray-300 inline-block min-w-[30px]">&nbsp;</span>%
                  </td>
                  <td className={TD} colSpan={4}>
                    <span className={LABEL}>ODM: 재품의 기획과 생산 전부</span><br />
                    <span className="border-b border-gray-300 inline-block min-w-[120px]">&nbsp;</span>
                  </td>
                  <td className={TD}></td>
                </tr>
                <tr>
                  <td className={TH}>판매처<br />(B2B,B2C)</td>
                  <td className={TD} colSpan={3}>
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px] mr-1">B2B</span>
                    <span className="border border-gray-300 px-1 py-0.5 rounded text-[9px]">B2C</span>
                    &nbsp;
                    <span className="border-b border-gray-300 inline-block min-w-[80px]">&nbsp;</span>
                  </td>
                  <td className={TH}>자가/임차</td>
                  <td className={TD} colSpan={4}><span className="border-b border-gray-300 inline-block min-w-[120px]">&nbsp;</span></td>
                  <td className={TD}></td>
                </tr>

                {/* ══════════════════════════════════════════
                    SECTION 6: 정보통신
                ══════════════════════════════════════════ */}
                <tr>
                  <td rowSpan={2} className={TH}>정보통신</td>
                  <td className={TH}>개발 단계<br /><span className="font-normal text-[8px]">(전/중/후)</span></td>
                  <td className={TD}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">전</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">중</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">후</span>
                  </td>
                  <td className={TH}>사업화<br />계획</td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                  <td className={TH}>제작팀 현황<br />(자체/외주)</td>
                  <td className={TD}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">자체</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">외주</span>
                  </td>
                  <td className={TH}>인력/경력</td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[40px]">&nbsp;</span></td>
                  <td className={TH}>발생매출<br />(자점/대여)</td>
                  <td className={TD}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">자점</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">대여</span>
                  </td>
                </tr>
                <tr>
                  <td className={TH}>제목 및<br />진도율</td>
                  <td className={TD} colSpan={5}><span className="border-b border-gray-300 inline-block min-w-[200px]">&nbsp;</span></td>
                  <td className={TH}>인력/경력</td>
                  <td className={TD} colSpan={2}><span className="border-b border-gray-300 inline-block min-w-[80px]">&nbsp;</span></td>
                  <td className={TD}><span className={LABEL}>실물확인</span><br /><span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">有</span><span className="border border-gray-300 px-1 rounded text-[9px]">無</span></td>
                </tr>

                {/* ══════════════════════════════════════════
                    SECTION 7: 법인
                ══════════════════════════════════════════ */}
                <tr>
                  <td rowSpan={5} className={TH}>법인</td>
                  <td className={TH}>실제경영자</td>
                  <td className={TD}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">有</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">無</span>
                  </td>
                  <td className={TH} colSpan={2}>관계회사 유/무</td>
                  <td className={TD} colSpan={2}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">有</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">無</span>
                  </td>
                  <td className={TH} rowSpan={5}>재무제표</td>
                  <td className={TH} colSpan={2}>영업이익 흑자/적자</td>
                  <td className={TD}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">흑자</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">적자</span>
                  </td>
                </tr>
                <tr>
                  <td className={TH}>최대주주</td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[60px]">&nbsp;</span></td>
                  <td className={TH} colSpan={2}>관계회사 대표자</td>
                  <td className={TD} colSpan={2}><span className="border-b border-gray-300 inline-block min-w-[60px]">&nbsp;</span></td>
                  <td className={TH} colSpan={2}>자본금(5천이상)</td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                </tr>
                <tr>
                  <td className={TH}>단독/공동/각시</td>
                  <td className={TD}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">단독</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">공동</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">각시</span>
                  </td>
                  <td className={TH} colSpan={2}>관계회사의 주주 여부</td>
                  <td className={TD} colSpan={2}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">有</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">無</span>
                  </td>
                  <td className={TH} colSpan={2}>3년간 자본증자(합법)</td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                </tr>
                <tr>
                  <td className={TH}>최근1년<br />대표자변경</td>
                  <td className={TD}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">有</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">無</span>
                  </td>
                  <td className={TH} colSpan={2}>관계회사 서로 매입-출</td>
                  <td className={TD} colSpan={2}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">有</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">無</span>
                  </td>
                  <td className={TH} colSpan={2}>가수금, 가지급금</td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                </tr>
                <tr>
                  <td className={TH}>임원 사고</td>
                  <td className={TD}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">有</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">無</span>
                  </td>
                  <td className={TH} colSpan={2}>관계회사 세금체납</td>
                  <td className={TD} colSpan={2}>
                    <span className="border border-gray-300 px-1 rounded text-[9px] mr-0.5">有</span>
                    <span className="border border-gray-300 px-1 rounded text-[9px]">無</span>
                  </td>
                  <td className={TH} colSpan={2}>단기/장기 차입금</td>
                  <td className={TD}><span className="border-b border-gray-300 inline-block min-w-[50px]">&nbsp;</span></td>
                </tr>

                {/* ══════════════════════════════════════════
                    메모 / 혁신요건 요약
                ══════════════════════════════════════════ */}
                {(d.innovation || d.result_memo || customer.notes) && (
                  <tr>
                    <td className={TH} colSpan={2}>미팅 메모</td>
                    <td className={TD} colSpan={9} style={{ whiteSpace: 'pre-wrap', verticalAlign: 'top', minHeight: 40 }}>
                      {d.innovation && (
                        <div className="mb-1">
                          <span className="font-bold text-violet-700 text-[9px]">혁신요건: </span>
                          <span className="text-[10px]">{d.innovation}</span>
                        </div>
                      )}
                      <span className="text-[10px]">{d.result_memo || customer.notes || ''}</span>
                    </td>
                  </tr>
                )}

              </tbody>
            </table>

            {/* ── 하단 서명란 ── */}
            <div className="mt-4 flex justify-end gap-8">
              {['작성자', '확인자'].map(label => (
                <div key={label} className="flex flex-col items-center">
                  <span className="text-[10px] text-gray-500 font-semibold mb-1">{label}</span>
                  <div className="border border-gray-300 w-20 h-12 rounded" />
                </div>
              ))}
            </div>

          </div>{/* end #mj-print-root */}
        </div>
      </div>
    </>
  )
}
