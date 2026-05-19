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

// ── 인콜 값이 있으면 표시, 없으면 빈 밑줄
function V({ v, placeholder = '' }: { v?: string | null; placeholder?: string }) {
  if (v && String(v).trim()) {
    return <span style={{ color: '#1B2A45', fontWeight: 700 }}>{v}</span>
  }
  return <span style={{ color: '#ccc', fontSize: 9 }}>{placeholder}</span>
}

// ── 섹션 헤더 색상 상수 (인쇄용 inline style)
const GRN  = '#c6d9b0'  // 사업자 / 기대출 / 대표자 / 특허
const GRN_B = '#5a8a3a' // 해당 테두리
const ORG  = '#fde4b8'  // 제조
const ORG_B = '#c8822a'
const BLU  = '#c6dcf5'  // 정보통신
const BLU_B = '#3a72b8'
const PRP  = '#e0d4f7'  // 법인 / 재무제표
const PRP_B = '#7040c0'

// cell base style
function th(bg: string, border: string, extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: bg,
    border: `1px solid ${border}`,
    fontSize: 9,
    fontWeight: 700,
    color: '#1B2A45',
    textAlign: 'center',
    verticalAlign: 'middle',
    padding: '3px 4px',
    whiteSpace: 'nowrap',
    printColorAdjust: 'exact',
    WebkitPrintColorAdjust: 'exact',
    ...extra,
  }
}
function td(border: string, extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    border: `1px solid ${border}`,
    fontSize: 9,
    color: '#444',
    padding: '3px 5px',
    verticalAlign: 'middle',
    ...extra,
  }
}

// 체크박스 스타일 버튼
function Opt({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      border: `1px solid ${checked ? '#1B2A45' : '#aaa'}`,
      background: checked ? '#1B2A45' : 'transparent',
      color: checked ? '#fff' : '#666',
      borderRadius: 3,
      padding: '1px 5px',
      fontSize: 9,
      fontWeight: checked ? 700 : 400,
      marginRight: 3,
    }}>{label}</span>
  )
}

// 빈 밑줄
function Blank({ w = 60 }: { w?: number }) {
  return <span style={{ display: 'inline-block', borderBottom: '1px solid #aaa', minWidth: w, height: 12 }} />
}

// 작은 레이블
function Lbl({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 8, color: '#666', fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>
}

export default function MeetingJournal({ customer, onClose }: MeetingJournalProps) {
  const d = customer.details || {}
  const company = d.company || customer.company || ''
  const name    = customer.name  || ''
  const phone   = customer.phone || ''
  const corpType = d.corp_type || ''

  const today   = new Date()
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      {/* ── 프린트 CSS: visibility 방식 (display:none 부모 문제 우회) ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden !important; }
          #mj-content, #mj-content * { visibility: visible !important; }
          #mj-content {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            background: white !important;
            z-index: 99999 !important;
          }
          .mj-no-print { display: none !important; }
          @page { size: A4 portrait; margin: 8mm 10mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}} />

      {/* ── 모달 오버레이 ── */}
      <div
        className="mj-no-print"
        style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.72)',
          overflowY: 'auto', padding: '16px 8px' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{ maxWidth: 860, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }}>

          {/* 컨트롤 바 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb',
            borderRadius: '12px 12px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#1B2A45' }}>📋 미팅일지 미리보기</span>
              <span style={{ fontSize: 11, color: '#6b7280' }}>{company}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
                  borderRadius: 8, background: '#1B2A45', color: '#fff', fontSize: 12,
                  fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                🖨️ 출력 / PDF 저장
              </button>
              <button onClick={onClose}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
                  background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                ✕ 닫기
              </button>
            </div>
          </div>

          {/* ── 인쇄 본문 래퍼 (스크롤용) ── */}
          <div style={{ padding: '16px 20px' }}>
            <JournalContent d={d} company={company} name={name} phone={phone} dateStr={dateStr} corpType={corpType} customer={customer} />
          </div>
        </div>
      </div>

      {/* ── 프린트 전용 고정 레이어 (화면에는 숨겨져 있음) ── */}
      <div id="mj-content" style={{ display: 'none', padding: '0 10px', background: '#fff', fontFamily: 'Malgun Gothic, Apple SD Gothic Neo, sans-serif' }}>
        <JournalContent d={d} company={company} name={name} phone={phone} dateStr={dateStr} corpType={corpType} customer={customer} />
      </div>
    </>
  )
}

// ── 실제 미팅일지 내용 (모달 미리보기 + 프린트 둘 다 사용) ──────────────────
function JournalContent({ d, company, name, phone, dateStr, corpType, customer }: {
  d: Record<string, any>
  company: string
  name: string
  phone: string
  dateStr: string
  corpType: string
  customer: { notes?: string }
}) {
  return (
    <div style={{ fontFamily: 'Malgun Gothic, Apple SD Gothic Neo, sans-serif', background: '#fff' }}>

      {/* ── 헤더: 로고 + 업체명 + 일시 ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <img src="/images/logo.png" alt="HUNDRED" style={{ height: 36, objectFit: 'contain' }} />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1B2A45', letterSpacing: 1 }}>
            {company || <span style={{ color: '#ccc' }}>업체명</span>}
          </div>
        </div>
        <div style={{ fontSize: 10, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
          {[
            ['일시', dateStr],
            ['대표자', name],
            ['전화번호', phone],
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#666', fontWeight: 700, whiteSpace: 'nowrap' }}>{label} :</span>
              <span style={{ borderBottom: '1px solid #888', minWidth: 120, paddingLeft: 4, color: '#1B2A45', fontWeight: 600 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 메인 테이블 ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
        <colgroup>
          <col style={{ width: '5%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '6%' }} />
        </colgroup>
        <tbody>

          {/* ══════════════════════════════════════════
              [녹색] 사업자
          ══════════════════════════════════════════ */}
          <tr>
            <td rowSpan={6} style={th(GRN, GRN_B)}>사업자</td>
            <td style={th(GRN, GRN_B)}>종류</td>
            <td style={td(GRN_B)}>
              <Opt label="개인" checked={corpType === '개인'} />
              <Opt label="법인" checked={corpType === '법인'} />
            </td>
            <td style={th(GRN, GRN_B)} colSpan={2}>매출</td>
            <td style={td(GRN_B)}><Lbl>26년(월)</Lbl><br /><V v={d.revenue_2026} /></td>
            <td style={td(GRN_B)}><Lbl>25년</Lbl><br /><V v={d.revenue_2025} /></td>
            <td style={td(GRN_B)}><Lbl>24년</Lbl><br /><V v={d.revenue_2024} /></td>
            <td style={td(GRN_B)}><Lbl>23년</Lbl><br /><V v={d.revenue_2023} /></td>
            <td style={td(GRN_B)}><Lbl>22년</Lbl><br /><Blank w={50} /></td>
            <td style={td(GRN_B)} colSpan={2}></td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>업태/업종</td>
            <td style={td(GRN_B)}><V v={d.business_type} /></td>
            <td style={th(GRN, GRN_B)} rowSpan={3}>체납<br />사신</td>
            <td style={td(GRN_B)} colSpan={7}>
              <span style={{ fontSize: 8, color: '#555' }}>국세&nbsp;&nbsp;지방세&nbsp;&nbsp;카드&nbsp;&nbsp;중소세&nbsp;&nbsp;원산세&nbsp;&nbsp;무가세&nbsp;&nbsp;4대보험&nbsp;&nbsp;그외기타</span>
              <br /><V v={d.tax_status || d.tax_delinquency} />
            </td>
            <td style={td(GRN_B)}><Lbl>KCB</Lbl><br /><V v={d.credit_kcb || d.credit_score} /></td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>업력 (개업일)</td>
            <td style={td(GRN_B)}><V v={d.years_in_business || d.biz_size} /></td>
            <td style={td(GRN_B)} colSpan={7}></td>
            <td style={td(GRN_B)}><Lbl>NICE</Lbl><br /><V v={d.credit_nice} /></td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>직원 수<br /><span style={{ fontWeight: 400, fontSize: 8 }}>(4대보험)</span></td>
            <td style={td(GRN_B)}><V v={d.employee_count} /></td>
            <td style={td(GRN_B)} colSpan={3}></td>
            <td style={td(GRN_B)}><Lbl>부채비율</Lbl><br /><Blank w={50} /></td>
            <td style={td(GRN_B)}><Lbl>이자보상배수</Lbl><br /><Blank w={50} /></td>
            <td style={td(GRN_B)}><Lbl>공정과정</Lbl><br /><Blank w={50} /></td>
            <td style={td(GRN_B)}></td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>사업장 위치</td>
            <td style={td(GRN_B)} colSpan={10}><V v={d.region} /></td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>사업내용</td>
            <td style={td(GRN_B, { minHeight: 24 })} colSpan={10}>
              <V v={d.real_work || d.business_description} />
            </td>
          </tr>

          {/* ══════════════════════════════════════════
              [녹색] 기대출
          ══════════════════════════════════════════ */}
          <tr>
            <td rowSpan={3} style={th(GRN, GRN_B)}>기대출</td>
            <td style={th(GRN, GRN_B)}>정책자금</td>
            <td style={td(GRN_B)} colSpan={7}><V v={d.loan_kibo || d.loan_policy} placeholder="없음" /></td>
            <td style={td(GRN_B)}><Lbl>부채비율</Lbl><br /><Blank w={50} /></td>
            <td style={td(GRN_B)} colSpan={2}></td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>신용 대출</td>
            <td style={td(GRN_B)} colSpan={5}>
              {[['신보', d.loan_shinbo], ['재단', d.loan_jaedan], ['중진공', d.loan_jinjong], ['소진공', d.loan_sojin], ['기타', d.loan_other || d.loan_credit]].map(([lb, val]) =>
                val ? <span key={lb as string} style={{ marginRight: 6, fontSize: 9 }}><b>{lb}</b>: <V v={val as string} /></span> : null
              )}
              {!d.loan_shinbo && !d.loan_jaedan && !d.loan_jinjong && !d.loan_sojin && !d.loan_other && !d.loan_credit && <V v="" placeholder="—" />}
            </td>
            <td style={td(GRN_B)}><Lbl>합계</Lbl><br /><V v={d.loan_total} /></td>
            <td style={td(GRN_B)}></td>
            <td style={td(GRN_B)}><Lbl>이자보상배수</Lbl><br /><Blank w={50} /></td>
            <td style={td(GRN_B)} colSpan={2}></td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>담보 대출</td>
            <td style={td(GRN_B)} colSpan={4}><V v={d.loan_mortgage} placeholder="—" /></td>
            <td style={td(GRN_B)}><Lbl>세무서(연락처)</Lbl><br /><Blank w={55} /></td>
            <td style={td(GRN_B)}><Lbl>회생여부</Lbl><br /><Blank w={40} /></td>
            <td style={td(GRN_B)}><Lbl>별도사업자</Lbl><br /><Blank w={40} /></td>
            <td style={td(GRN_B)} colSpan={3}></td>
          </tr>

          {/* ══════════════════════════════════════════
              [녹색] 대표자
          ══════════════════════════════════════════ */}
          <tr>
            <td rowSpan={6} style={th(GRN, GRN_B)}>대표자</td>
            <td style={th(GRN, GRN_B)}>성별</td>
            <td style={td(GRN_B)}><Opt label="남" /><Opt label="여" /></td>
            <td style={th(GRN, GRN_B)}>수출</td>
            <td style={td(GRN_B)} colSpan={2}><Lbl>직원채용예정(공고)</Lbl><br /><Blank w={70} /></td>
            <td style={td(GRN_B)} colSpan={2}><Lbl>수출(수출실적증명)</Lbl><br /><Blank w={70} /></td>
            <td style={td(GRN_B)}><Lbl>회생여부</Lbl><br /><Blank w={45} /></td>
            <td style={td(GRN_B)}><Lbl>별도사업자</Lbl><br /><Blank w={45} /></td>
            <td style={td(GRN_B)} colSpan={2}></td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>나이</td>
            <td style={td(GRN_B)}><Blank w={50} /></td>
            <td style={th(GRN, GRN_B)} rowSpan={2}>사업에<br />투자한<br />비용</td>
            <td style={td(GRN_B)} colSpan={2} rowSpan={2}><Blank w={80} /></td>
            <td style={th(GRN, GRN_B)} rowSpan={2}>기계/도구<br />(스마트기기)</td>
            <td style={td(GRN_B)} colSpan={2} rowSpan={2}><Blank w={80} /></td>
            <td style={td(GRN_B)} rowSpan={2}><Lbl>고객관리S/W</Lbl><br /><Opt label="有" /><Opt label="無" /></td>
            <td style={td(GRN_B)} colSpan={2} rowSpan={2}></td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>혼인여부</td>
            <td style={td(GRN_B)}><Opt label="有" /><Opt label="無" /><br /><Lbl>자녀: </Lbl><Blank w={25} /></td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>동종업 경력</td>
            <td style={td(GRN_B)} colSpan={2}><Blank w={80} /></td>
            <td style={th(GRN, GRN_B)}>특허/인증</td>
            <td style={td(GRN_B)} colSpan={7}><V v={d.patent} /></td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>보유자산<br /><span style={{ fontWeight: 400, fontSize: 8 }}>(진기/사무실)</span></td>
            <td style={td(GRN_B)} colSpan={2}><V v={d.assets} /></td>
            <td style={th(GRN, GRN_B)} colSpan={2}>고객관리 도구</td>
            <td style={td(GRN_B)} colSpan={6}>
              <span style={{ fontSize: 9 }}>☐ 데이터베이스&nbsp;&nbsp;☐ 홈페이지&nbsp;&nbsp;☐ 예약시스템&nbsp;&nbsp;☐ POS&nbsp;&nbsp;☐ 기타: </span>
              <Blank w={50} />
            </td>
          </tr>
          <tr>
            <td style={th(GRN, GRN_B)}>필요자금</td>
            <td style={td(GRN_B)}><V v={d.required_funds} /></td>
            <td style={th(GRN, GRN_B)}>용도</td>
            <td style={td(GRN_B)} colSpan={9}><Blank w={200} /></td>
          </tr>

          {/* ══════════════════════════════════════════
              [녹색] 특허
          ══════════════════════════════════════════ */}
          <tr>
            <td style={th(GRN, GRN_B)}>특허<br /><span style={{ fontWeight: 400, fontSize: 8 }}>(상표권,실용신안<br />디자인권 등)</span></td>
            <td style={th(GRN, GRN_B)}>내용</td>
            <td style={td(GRN_B)}><V v={d.patent} /></td>
            <td style={th(GRN, GRN_B)}>등록원</td>
            <td style={td(GRN_B)}><Blank w={45} /></td>
            <td style={th(GRN, GRN_B)}>매출 영향</td>
            <td style={td(GRN_B)}><Blank w={45} /></td>
            <td style={th(GRN, GRN_B)} colSpan={2}>특허권자(개인/법인)</td>
            <td style={th(GRN, GRN_B)}>등급</td>
            <td style={td(GRN_B)} colSpan={2}>
              <Lbl>가치평가&nbsp;</Lbl><Opt label="有" /><Opt label="無" />
            </td>
          </tr>

          {/* ══════════════════════════════════════════
              [주황] 제조 ── 해당 시 작성
          ══════════════════════════════════════════ */}
          <tr>
            <td colSpan={12} style={{ background: ORG, border: `1px solid ${ORG_B}`, fontSize: 9, fontWeight: 700, color: '#7a3800', padding: '2px 6px', letterSpacing: 0.5 }}>
              ▶ 제조업 해당 시 작성
            </td>
          </tr>
          <tr>
            <td rowSpan={4} style={th(ORG, ORG_B)}>제조</td>
            <td style={th(ORG, ORG_B)}>제작 방식</td>
            <td style={td(ORG_B)}><Opt label="시장" /><Opt label="주문" /></td>
            <td style={th(ORG, ORG_B)} rowSpan={2}>기계</td>
            <td style={th(ORG, ORG_B)}>설비</td>
            <td style={th(ORG, ORG_B)}>종류</td>
            <td style={th(ORG, ORG_B)}>가격</td>
            <td style={td(ORG_B)} colSpan={4}>거래내역</td>
            <td style={td(ORG_B)}></td>
          </tr>
          <tr>
            <td style={th(ORG, ORG_B)}>직접/OEM/ODM</td>
            <td style={td(ORG_B)}><Opt label="직접" /><Opt label="OEM" /><Opt label="ODM" /></td>
            <td style={td(ORG_B)}><Blank w={40} /></td>
            <td style={td(ORG_B)}><Blank w={40} /></td>
            <td style={td(ORG_B)}><Blank w={40} /></td>
            <td style={td(ORG_B)} colSpan={3}><Lbl>공장: </Lbl><Opt label="자가" /><Opt label="임차" /><br /><Lbl>시세: </Lbl><Blank w={60} /></td>
            <td style={td(ORG_B)} colSpan={2}></td>
          </tr>
          <tr>
            <td style={th(ORG, ORG_B)}>제품매출 비중</td>
            <td style={td(ORG_B)} colSpan={3}>
              <Lbl>OEM </Lbl><Blank w={28} />%&nbsp;
              <Lbl>ODM </Lbl><Blank w={28} />%&nbsp;
              <Lbl>기타 </Lbl><Blank w={28} />%
            </td>
            <td style={td(ORG_B)} colSpan={7}></td>
          </tr>
          <tr>
            <td style={th(ORG, ORG_B)}>판매처</td>
            <td style={td(ORG_B)} colSpan={3}><Opt label="B2B" /><Opt label="B2C" />&nbsp;<Blank w={80} /></td>
            <td style={th(ORG, ORG_B)}>공장 자가/임차</td>
            <td style={td(ORG_B)} colSpan={6}><Blank w={120} /></td>
          </tr>

          {/* ══════════════════════════════════════════
              [파랑] 정보통신 ── 해당 시 작성
          ══════════════════════════════════════════ */}
          <tr>
            <td colSpan={12} style={{ background: BLU, border: `1px solid ${BLU_B}`, fontSize: 9, fontWeight: 700, color: '#0c3060', padding: '2px 6px' }}>
              ▶ 정보통신업 해당 시 작성
            </td>
          </tr>
          <tr>
            <td rowSpan={2} style={th(BLU, BLU_B)}>정보통신</td>
            <td style={th(BLU, BLU_B)}>개발 단계</td>
            <td style={td(BLU_B)}><Opt label="전" /><Opt label="중" /><Opt label="후" /></td>
            <td style={th(BLU, BLU_B)}>사업화 계획</td>
            <td style={td(BLU_B)}><Blank w={50} /></td>
            <td style={th(BLU, BLU_B)}>제작팀</td>
            <td style={td(BLU_B)}><Opt label="자체" /><Opt label="외주" /></td>
            <td style={th(BLU, BLU_B)}>인력/경력</td>
            <td style={td(BLU_B)}><Blank w={40} /></td>
            <td style={th(BLU, BLU_B)}>발생매출</td>
            <td style={td(BLU_B)} colSpan={2}><Opt label="자점" /><Opt label="대여" /></td>
          </tr>
          <tr>
            <td style={th(BLU, BLU_B)}>제목 및 진도율</td>
            <td style={td(BLU_B)} colSpan={5}><Blank w={200} /></td>
            <td style={th(BLU, BLU_B)}>인력</td>
            <td style={td(BLU_B)} colSpan={2}><Blank w={80} /></td>
            <td style={td(BLU_B)}><Lbl>실물확인</Lbl>&nbsp;<Opt label="有" /><Opt label="無" /></td>
            <td style={td(BLU_B)}></td>
          </tr>

          {/* ══════════════════════════════════════════
              [보라] 법인 ── 해당 시 작성
          ══════════════════════════════════════════ */}
          <tr>
            <td colSpan={12} style={{ background: PRP, border: `1px solid ${PRP_B}`, fontSize: 9, fontWeight: 700, color: '#3a0870', padding: '2px 6px' }}>
              ▶ 법인 해당 시 작성
            </td>
          </tr>
          <tr>
            <td rowSpan={5} style={th(PRP, PRP_B)}>법인</td>
            <td style={th(PRP, PRP_B)}>실제경영자</td>
            <td style={td(PRP_B)}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(PRP, PRP_B)} colSpan={2}>관계회사 유/무</td>
            <td style={td(PRP_B)} colSpan={2}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(PRP, PRP_B)} rowSpan={5}>재무<br />제표</td>
            <td style={th(PRP, PRP_B)} colSpan={2}>영업이익</td>
            <td style={td(PRP_B)} colSpan={3}><Opt label="흑자" /><Opt label="적자" /></td>
          </tr>
          <tr>
            <td style={th(PRP, PRP_B)}>최대주주</td>
            <td style={td(PRP_B)}><Blank w={60} /></td>
            <td style={th(PRP, PRP_B)} colSpan={2}>관계회사 대표자</td>
            <td style={td(PRP_B)} colSpan={2}><Blank w={60} /></td>
            <td style={th(PRP, PRP_B)} colSpan={2}>자본금(5천이상)</td>
            <td style={td(PRP_B)} colSpan={3}><Blank w={55} /></td>
          </tr>
          <tr>
            <td style={th(PRP, PRP_B)}>단독/공동/각시</td>
            <td style={td(PRP_B)}><Opt label="단독" /><Opt label="공동" /><Opt label="각시" /></td>
            <td style={th(PRP, PRP_B)} colSpan={2}>관계회사 주주여부</td>
            <td style={td(PRP_B)} colSpan={2}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(PRP, PRP_B)} colSpan={2}>3년간 자본증자</td>
            <td style={td(PRP_B)} colSpan={3}><Blank w={55} /></td>
          </tr>
          <tr>
            <td style={th(PRP, PRP_B)}>최근1년 대표자변경</td>
            <td style={td(PRP_B)}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(PRP, PRP_B)} colSpan={2}>관계회사 서로 매입출</td>
            <td style={td(PRP_B)} colSpan={2}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(PRP, PRP_B)} colSpan={2}>가수금 / 가지급금</td>
            <td style={td(PRP_B)} colSpan={3}><Blank w={55} /></td>
          </tr>
          <tr>
            <td style={th(PRP, PRP_B)}>임원 사고</td>
            <td style={td(PRP_B)}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(PRP, PRP_B)} colSpan={2}>관계회사 세금체납</td>
            <td style={td(PRP_B)} colSpan={2}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(PRP, PRP_B)} colSpan={2}>단기/장기 차입금</td>
            <td style={td(PRP_B)} colSpan={3}><Blank w={55} /></td>
          </tr>

          {/* ══════════════════════════════════════════
               미팅 메모 (혁신요건 + 통화메모)
          ══════════════════════════════════════════ */}
          {(d.innovation || d.result_memo || customer.notes) && (
            <tr>
              <td style={th(GRN, GRN_B)} colSpan={2}>미팅 메모</td>
              <td style={{ ...td(GRN_B), whiteSpace: 'pre-wrap', verticalAlign: 'top', minHeight: 40 }} colSpan={10}>
                {d.innovation && (
                  <div style={{ marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, color: '#6d28d9', fontSize: 9 }}>혁신요건: </span>
                    <span>{d.innovation}</span>
                  </div>
                )}
                <span>{d.result_memo || customer.notes || ''}</span>
              </td>
            </tr>
          )}

        </tbody>
      </table>

      {/* 서명란 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 32, marginTop: 12 }}>
        {['작성자', '확인자'].map(label => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: '#666', fontWeight: 700 }}>{label}</span>
            <div style={{ border: '1px solid #aaa', width: 70, height: 44, borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
