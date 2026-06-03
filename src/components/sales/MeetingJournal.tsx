'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

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

/* ── 섹션 색상 ── */
const G  = '#d4e8b8'; const GB = '#4a7a30'  // 녹색
const O  = '#fde4b8'; const OB = '#b86a10'  // 주황 (제조)
const B  = '#c8dff7'; const BB = '#2a5faa'  // 파랑 (정보통신)
const P  = '#e2d4f8'; const PB = '#6030b8'  // 보라 (법인)

type CS = React.CSSProperties

/* 체크 옵션 버튼 */
function Opt({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      border: `1px solid ${checked ? '#1a2a40' : '#bbb'}`,
      background: checked ? '#1a2a40' : '#fff',
      color: checked ? '#fff' : '#444',
      borderRadius: 2, padding: '0 3px', fontSize: '0.82em',
      fontWeight: checked ? 700 : 400, marginRight: 2,
      whiteSpace: 'nowrap', verticalAlign: 'middle',
      WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any,
    }}>{label}</span>
  )
}

/* 빈 밑줄 */
function Blank({ w = 50 }: { w?: number }) {
  return <span style={{ display: 'inline-block', borderBottom: '1.5px solid #bbb', minWidth: w, height: 12, marginBottom: -2 }} />
}

/* 작은 레이블 */
function L({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: '0.8em', color: '#555', fontWeight: 700, whiteSpace: 'nowrap' }}>{children}</span>
}

/* 인콜에서 채워진 값 */
function Val({ v }: { v?: string | null }) {
  return v && String(v).trim()
    ? <span style={{ color: '#1a2a40', fontWeight: 700, display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{v}</span>
    : <span style={{ color: '#ccc', fontSize: '0.8em' }}>—</span>
}

/* 헤더 TH */
function TH(bg: string, bc: string, p: string, extra: CS = {}): CS {
  return {
    background: bg, border: `1px solid ${bc}`, padding: p,
    fontSize: 'inherit', fontWeight: 700, color: '#1a2a40',
    textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap',
    overflow: 'hidden',
    WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any,
    ...extra,
  }
}
/* 데이터 TD */
function TD(bc: string, p: string, extra: CS = {}): CS {
  return {
    border: `1px solid ${bc}`, padding: p,
    fontSize: 'inherit', color: '#222', verticalAlign: 'middle',
    overflow: 'hidden',
    ...extra,
  }
}

/* 섹션 구분 배너 */
function SectBanner({ bg, bc, color, children, isPrint = false }: { bg: string; bc: string; color: string; children: React.ReactNode; isPrint?: boolean }) {
  return (
    <tr>
      <td colSpan={13} style={{
        background: bg, border: `1px solid ${bc}`, color,
        fontWeight: 700, fontSize: '0.88em', padding: isPrint ? '1px 5px' : '3px 7px',
        letterSpacing: '0.3px',
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any,
      }}>{children}</td>
    </tr>
  )
}

/* ── 메인 컴포넌트 ── */
export default function MeetingJournal({ customer, onClose }: MeetingJournalProps) {
  const [mounted, setMounted] = useState(false)
  const d = customer.details || {}
  const company  = d.company  || customer.company || ''
  const name     = customer.name  || ''
  const phone    = customer.phone || ''
  const corpType = d.corp_type || ''
  const today    = new Date()
  const dateStr  = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const props = { d, company, name, phone, dateStr, corpType }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        #mj-print-body { display: none; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; }
          body > * { display: none !important; }
          #mj-print-body { display: block !important; zoom: 0.78; }
          @page { size: A4 portrait; margin: 5mm 5mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box !important; }
          #mj-print-body table { table-layout: fixed !important; width: 100% !important; }
          #mj-print-body td, #mj-print-body th { overflow: hidden !important; }
        }
      `}} />

      {/* ── 미리보기 모달 ── */}
      <div
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
        style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.72)', overflowY: 'auto', padding: '12px 8px' }}
      >
        <div style={{ maxWidth: 860, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.35)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 18px', borderBottom: '1px solid #e5e7eb',
            background: '#f9fafb', borderRadius: '12px 12px 0 0',
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#1a2a40' }}>미팅일지 미리보기 — {company}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => window.print()}
                style={{ padding: '6px 16px', borderRadius: 8, background: '#1a2a40', color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                출력 / PDF 저장
              </button>
              <button onClick={onClose}
                style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
                ✕ 닫기
              </button>
            </div>
          </div>
          <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
            <div style={{ fontSize: 10, lineHeight: 1.5, fontFamily: '"Malgun Gothic","Apple SD Gothic Neo",sans-serif' }}>
              <JournalBody {...props} isPrint={false} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 프린트 Portal (body 직속) ── */}
      {mounted && createPortal(
        <div id="mj-print-body" style={{
          fontFamily: '"Malgun Gothic","Apple SD Gothic Neo",sans-serif',
          background: '#fff', padding: '0', margin: '0',
          fontSize: 7, lineHeight: 1.3,
        }}>
          <JournalBody {...props} isPrint={true} />
        </div>,
        document.body
      )}
    </>
  )
}

/* ══════════════════════════════════════════════════════════════════
   JournalBody
══════════════════════════════════════════════════════════════════ */
interface BodyProps {
  d: Record<string, any>
  company: string
  name: string
  phone: string
  dateStr: string
  corpType: string
  isPrint: boolean
}

function JournalBody({ d, company, name, phone, dateStr, corpType, isPrint }: BodyProps) {
  const p  = isPrint ? '2px 3px'  : '4px 6px'    // 셀 패딩
  const th = (bg: string, bc: string, extra: CS = {}) => TH(bg, bc, p, extra)
  const td = (bc: string, extra: CS = {}) => TD(bc, p, extra)

  return (
    <div style={{
      fontFamily: 'inherit',
      ...(isPrint ? {
        display: 'block',
        width: '100%',
      } : {}),
    }}>

      {/* ══ 헤더 ══ */}
      <div style={{
        background: '#1a2a40',
        borderRadius: isPrint ? 0 : 8,
        padding: isPrint ? '5px 8px 6px' : '12px 16px 14px',
        marginBottom: isPrint ? 4 : 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any,
      }}>
        {/* 로고 */}
        <img src="/images/logo.png" alt="HUNDRED"
          style={{ height: isPrint ? 20 : 36, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />

        {/* 업체명 */}
        <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
          <div style={{ fontSize: isPrint ? '1.6em' : '2em', fontWeight: 900, color: '#ffffff', letterSpacing: 2, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
            {company || <span style={{ opacity: 0.4 }}>업체명</span>}
          </div>
          <div style={{ fontSize: '0.75em', color: 'rgba(255,255,255,0.55)', marginTop: 1, letterSpacing: 1 }}>MEETING JOURNAL</div>
        </div>

        {/* 일시 / 대표자 / 연락처 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: isPrint ? 2 : 4, minWidth: isPrint ? 130 : 160 }}>
          {[['일시', dateStr], ['대표자', name], ['연락처', phone]].map(([lb, val]) => (
            <div key={lb} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8em', fontWeight: 700, width: 38, flexShrink: 0 }}>{lb}</span>
              <span style={{
                flex: 1, borderBottom: '1px solid rgba(255,255,255,0.35)',
                color: '#fff', fontSize: '0.85em', fontWeight: 600,
                paddingLeft: 3, paddingBottom: 1,
              }}>{val || ' '}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ 메인 테이블 ══ */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 'inherit' }}>
        <colgroup>
          <col style={{ width: '5%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7.5%' }} />
          <col style={{ width: '7.5%' }} />
          <col style={{ width: '7.5%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '6.5%' }} />
        </colgroup>
        <tbody>

          {/* ━━ 사업자 ━━ */}
          <tr>
            <td rowSpan={6} style={th(G, GB, { fontSize: '0.9em' })}>사업자</td>
            <td style={th(G, GB)}>종류</td>
            <td style={td(GB)}><Opt label="개인" checked={corpType === '개인'} /><Opt label="법인" checked={corpType === '법인'} /></td>
            <td style={th(G, GB)} colSpan={2}>매출</td>
            <td style={td(GB)}><L>26년(월)</L><br /><Val v={d.revenue_2026} /></td>
            <td style={td(GB)}><L>25년</L><br /><Val v={d.revenue_2025} /></td>
            <td style={td(GB)}><L>24년</L><br /><Val v={d.revenue_2024} /></td>
            <td style={td(GB)}><L>23년</L><br /><Val v={d.revenue_2023} /></td>
            <td style={td(GB)}><L>22년</L><br /><Blank w={40} /></td>
            <td style={td(GB, { padding: p })} colSpan={3}></td>
          </tr>
          <tr>
            <td style={th(G, GB)}>업태 / 업종</td>
            <td style={td(GB)}><Val v={d.business_type} /></td>
            <td style={th(G, GB)} rowSpan={3}>체납<br />사신</td>
            <td style={td(GB)} colSpan={8}>
              <L>국세&nbsp; 지방세&nbsp; 카드&nbsp; 중소세&nbsp; 원산세&nbsp; 무가세&nbsp; 4대보험&nbsp; 그외기타</L>
              <br /><Val v={d.tax_status || d.tax_delinquency} />
            </td>
            <td style={td(GB)}><L>KCB</L><br /><Val v={d.credit_kcb || d.credit_score} /></td>
          </tr>
          <tr>
            <td style={th(G, GB)}>업력 (개업일)</td>
            <td style={td(GB)}><Val v={d.years_in_business || d.biz_size} /></td>
            <td style={td(GB)} colSpan={8}></td>
            <td style={td(GB)}><L>NICE</L><br /><Val v={d.credit_nice} /></td>
          </tr>
          <tr>
            <td style={th(G, GB)}>직원 수<br /><span style={{ fontWeight: 400, fontSize: '0.8em' }}>(4대보험)</span></td>
            <td style={td(GB)}><Val v={d.employee_count} /></td>
            <td style={td(GB)} colSpan={3}></td>
            <td style={td(GB)}><L>부채비율</L><br /><Blank w={44} /></td>
            <td style={td(GB)}><L>이자보상배수</L><br /><Blank w={44} /></td>
            <td style={td(GB)}><L>공정과정</L><br /><Blank w={44} /></td>
            <td style={td(GB)} colSpan={2}></td>
          </tr>
          <tr>
            <td style={th(G, GB)}>사업장 위치</td>
            <td style={td(GB)} colSpan={11}><Val v={d.region} /></td>
          </tr>
          <tr>
            <td style={th(G, GB)}>사업내용</td>
            <td style={td(GB, { minHeight: 20 })} colSpan={11}><Val v={d.real_work || d.business_description} /></td>
          </tr>

          {/* ━━ 기대출 ━━ */}
          <tr>
            <td rowSpan={3} style={th(G, GB, { fontSize: '0.9em' })}>기대출</td>
            <td style={th(G, GB)}>정책자금</td>
            <td style={td(GB)} colSpan={8}><Val v={d.loan_kibo || d.loan_policy} /></td>
            <td style={td(GB)}><L>부채비율</L><br /><Blank w={40} /></td>
            <td style={td(GB)} colSpan={2}></td>
          </tr>
          <tr>
            <td style={th(G, GB)}>신용 대출</td>
            <td style={td(GB)} colSpan={6}>
              {[['신보', d.loan_shinbo], ['재단', d.loan_jaedan], ['중진공', d.loan_jinjong], ['소진공', d.loan_sojin], ['기타', d.loan_other || d.loan_credit]].map(([lb, v]) =>
                v ? <span key={lb as string} style={{ marginRight: 6 }}><b>{lb}</b>: <Val v={v as string} /></span> : null
              )}
              {!d.loan_shinbo && !d.loan_jaedan && !d.loan_jinjong && !d.loan_sojin && !d.loan_other && !d.loan_credit && <Val v="" />}
            </td>
            <td style={td(GB)}><L>합계</L><br /><Val v={d.loan_total} /></td>
            <td style={td(GB)}></td>
            <td style={td(GB)}><L>이자보상배수</L><br /><Blank w={40} /></td>
            <td style={td(GB)} colSpan={2}></td>
          </tr>
          <tr>
            <td style={th(G, GB)}>담보 대출</td>
            <td style={td(GB)} colSpan={4}><Val v={d.loan_mortgage} /></td>
            <td style={td(GB)}><L>세무서(연락처)</L><br /><Blank w={48} /></td>
            <td style={td(GB)}><L>회생여부</L><br /><Blank w={36} /></td>
            <td style={td(GB)}><L>별도사업자</L><br /><Blank w={36} /></td>
            <td style={td(GB)} colSpan={4}></td>
          </tr>

          {/* ━━ 대표자 ━━ */}
          <tr>
            <td rowSpan={6} style={th(G, GB, { fontSize: '0.9em' })}>대표자</td>
            <td style={th(G, GB)}>성별</td>
            <td style={td(GB)}><Opt label="남" /><Opt label="여" /></td>
            <td style={th(G, GB)}>수출</td>
            <td style={td(GB)} colSpan={2}><L>직원채용예정</L><br /><Blank w={65} /></td>
            <td style={td(GB)} colSpan={2}><L>수출실적증명</L><br /><Blank w={65} /></td>
            <td style={td(GB)}><L>회생여부</L><br /><Blank w={40} /></td>
            <td style={td(GB)}><L>별도사업자</L><br /><Blank w={40} /></td>
            <td style={td(GB)} colSpan={3}></td>
          </tr>
          <tr>
            <td style={th(G, GB)}>나이</td>
            <td style={td(GB)}><Blank w={44} /></td>
            <td style={th(G, GB)} rowSpan={2}>사업에<br />투자한<br />비용</td>
            <td style={td(GB)} colSpan={2} rowSpan={2}><Blank w={70} /></td>
            <td style={th(G, GB)} rowSpan={2}>기계/도구<br />(스마트기기)</td>
            <td style={td(GB)} colSpan={2} rowSpan={2}><Blank w={70} /></td>
            <td style={td(GB)} rowSpan={2}><L>고객관리S/W</L><br /><Opt label="有" /><Opt label="無" /></td>
            <td style={td(GB)} colSpan={3} rowSpan={2}></td>
          </tr>
          <tr>
            <td style={th(G, GB)}>혼인여부</td>
            <td style={td(GB)}>
              <Opt label="有" /><Opt label="無" />
              <br /><L>자녀: </L><Blank w={24} />
            </td>
          </tr>
          <tr>
            <td style={th(G, GB)}>동종업 경력</td>
            <td style={td(GB)} colSpan={2}><Blank w={80} /></td>
            <td style={th(G, GB)}>특허 / 인증</td>
            <td style={td(GB)} colSpan={8}><Val v={d.patent} /></td>
          </tr>
          <tr>
            <td style={th(G, GB)}>보유자산<br /><span style={{ fontWeight: 400, fontSize: '0.8em' }}>(진기/사무실)</span></td>
            <td style={td(GB)} colSpan={2}><Val v={d.assets} /></td>
            <td style={th(G, GB)} colSpan={2}>고객관리 도구</td>
            <td style={td(GB)} colSpan={7}>
              <L>☐ 데이터베이스&nbsp;&nbsp;☐ 홈페이지&nbsp;&nbsp;☐ 예약시스템&nbsp;&nbsp;☐ POS&nbsp;&nbsp;☐ 기타:</L>&nbsp;<Blank w={44} />
            </td>
          </tr>
          <tr>
            <td style={th(G, GB)}>필요자금</td>
            <td style={td(GB)}><Val v={d.required_funds} /></td>
            <td style={th(G, GB)}>용도</td>
            <td style={td(GB)} colSpan={10}><Blank w={180} /></td>
          </tr>

          {/* ━━ 특허 ━━ */}
          <tr>
            <td style={th(G, GB, { fontSize: '0.82em' })}>특허<br />(상표권·실용<br />신안·디자인권)</td>
            <td style={th(G, GB)}>내용</td>
            <td style={td(GB)}><Val v={d.patent} /></td>
            <td style={th(G, GB)}>등록원</td>
            <td style={td(GB)}><Blank w={44} /></td>
            <td style={th(G, GB)}>매출 영향</td>
            <td style={td(GB)}><Blank w={44} /></td>
            <td style={th(G, GB)} colSpan={2}>특허권자</td>
            <td style={th(G, GB)}>등급</td>
            <td style={td(GB)} colSpan={3}><L>가치평가&nbsp;</L><Opt label="有" /><Opt label="無" /></td>
          </tr>

          {/* ━━ 제조 (주황) ━━ */}
          <SectBanner bg="#fff3e0" bc={OB} color="#7a3000" isPrint={isPrint}>▶ 제조업 해당 시 작성</SectBanner>
          <tr>
            <td rowSpan={3} style={th(O, OB, { fontSize: '0.9em' })}>제조</td>
            <td style={th(O, OB)}>제작 방식</td>
            <td style={td(OB)}><Opt label="시장" /><Opt label="주문" /></td>
            <td style={th(O, OB)} rowSpan={2}>기계</td>
            <td style={th(O, OB)}>설비</td>
            <td style={th(O, OB)}>종류</td>
            <td style={th(O, OB)}>가격</td>
            <td style={td(OB)} colSpan={5}>거래 내역 <Blank w={100} /></td>
            <td style={td(OB)}></td>
          </tr>
          <tr>
            <td style={th(O, OB)}>직접/OEM/ODM</td>
            <td style={td(OB)}><Opt label="직접" /><Opt label="OEM" /><Opt label="ODM" /></td>
            <td style={td(OB)}><Blank w={36} /></td>
            <td style={td(OB)}><Blank w={36} /></td>
            <td style={td(OB)}><Blank w={36} /></td>
            <td style={td(OB)} colSpan={4}><L>공장: </L><Opt label="자가" /><Opt label="임차" />&nbsp;<L>시세: </L><Blank w={52} /></td>
            <td style={td(OB)} colSpan={2}></td>
          </tr>
          <tr>
            <td style={th(O, OB)}>판매처</td>
            <td style={td(OB)} colSpan={3}><Opt label="B2B" /><Opt label="B2C" />&nbsp;<Blank w={80} /></td>
            <td style={th(O, OB)} colSpan={2}>제품매출 비중</td>
            <td style={td(OB)} colSpan={6}><L>OEM </L><Blank w={24} />%&nbsp;<L>ODM </L><Blank w={24} />%&nbsp;<L>기타 </L><Blank w={24} />%</td>
          </tr>

          {/* ━━ 정보통신 (파랑) ━━ */}
          <SectBanner bg="#e8f2ff" bc={BB} color="#0a2a5a" isPrint={isPrint}>▶ 정보통신업 해당 시 작성</SectBanner>
          <tr>
            <td rowSpan={2} style={th(B, BB, { fontSize: '0.9em' })}>정보<br />통신</td>
            <td style={th(B, BB)}>개발 단계</td>
            <td style={td(BB)}><Opt label="전" /><Opt label="중" /><Opt label="후" /></td>
            <td style={th(B, BB)}>사업화 계획</td>
            <td style={td(BB)}><Blank w={44} /></td>
            <td style={th(B, BB)}>제작팀</td>
            <td style={td(BB)}><Opt label="자체" /><Opt label="외주" /></td>
            <td style={th(B, BB)}>인력/경력</td>
            <td style={td(BB)}><Blank w={36} /></td>
            <td style={th(B, BB)}>발생매출</td>
            <td style={td(BB)} colSpan={3}><Opt label="자점" /><Opt label="대여" /></td>
          </tr>
          <tr>
            <td style={th(B, BB)}>제목 및 진도율</td>
            <td style={td(BB)} colSpan={5}><Blank w={190} /></td>
            <td style={th(B, BB)}>인력</td>
            <td style={td(BB)} colSpan={2}><Blank w={75} /></td>
            <td style={td(BB)} colSpan={2}><L>실물확인&nbsp;</L><Opt label="有" /><Opt label="無" /></td>
          </tr>

          {/* ━━ 법인 (보라) ━━ */}
          <SectBanner bg="#f3eeff" bc={PB} color="#2e0870" isPrint={isPrint}>▶ 법인 해당 시 작성</SectBanner>
          <tr>
            <td rowSpan={5} style={th(P, PB, { fontSize: '0.9em' })}>법인</td>
            <td style={th(P, PB)}>실제경영자</td>
            <td style={td(PB)}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(P, PB)} colSpan={2}>관계회사 유/무</td>
            <td style={td(PB)} colSpan={2}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(P, PB)} rowSpan={5}>재무<br />제표</td>
            <td style={th(P, PB)} colSpan={2}>영업이익</td>
            <td style={td(PB)} colSpan={4}><Opt label="흑자" /><Opt label="적자" /></td>
          </tr>
          <tr>
            <td style={th(P, PB)}>최대주주</td>
            <td style={td(PB)}><Blank w={55} /></td>
            <td style={th(P, PB)} colSpan={2}>관계회사 대표자</td>
            <td style={td(PB)} colSpan={2}><Blank w={55} /></td>
            <td style={th(P, PB)} colSpan={2}>자본금 (5천이상)</td>
            <td style={td(PB)} colSpan={4}><Blank w={50} /></td>
          </tr>
          <tr>
            <td style={th(P, PB)}>단독/공동/각시</td>
            <td style={td(PB)}><Opt label="단독" /><Opt label="공동" /><Opt label="각시" /></td>
            <td style={th(P, PB)} colSpan={2}>관계회사 주주여부</td>
            <td style={td(PB)} colSpan={2}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(P, PB)} colSpan={2}>3년간 자본증자</td>
            <td style={td(PB)} colSpan={4}><Blank w={50} /></td>
          </tr>
          <tr>
            <td style={th(P, PB)}>최근1년<br />대표자변경</td>
            <td style={td(PB)}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(P, PB)} colSpan={2}>관계회사 서로 매입출</td>
            <td style={td(PB)} colSpan={2}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(P, PB)} colSpan={2}>가수금 / 가지급금</td>
            <td style={td(PB)} colSpan={4}><Blank w={50} /></td>
          </tr>
          <tr>
            <td style={th(P, PB)}>임원 사고</td>
            <td style={td(PB)}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(P, PB)} colSpan={2}>관계회사 세금체납</td>
            <td style={td(PB)} colSpan={2}><Opt label="有" /><Opt label="無" /></td>
            <td style={th(P, PB)} colSpan={2}>단기/장기 차입금</td>
            <td style={td(PB)} colSpan={4}><Blank w={50} /></td>
          </tr>

        </tbody>
      </table>

      {/* ━━ 미팅 메모 (빈 필기란) ━━ */}
      <div style={{
        minHeight: isPrint ? 0 : 80,
        border: `1px solid ${GB}`, marginTop: -1, padding: '5px 8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
          <span style={{ fontWeight: 700, fontSize: '1.05em', color: '#1a2a40', letterSpacing: 0.5 }}>미팅 메모</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {['작성자', '확인자'].map(label => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ fontSize: '0.85em', color: '#666', fontWeight: 700 }}>{label}</span>
                <div style={{ border: '1px solid #aaa', width: 58, height: 30, borderRadius: 3 }} />
              </div>
            ))}
          </div>
        </div>
        <div>
          {Array.from({ length: isPrint ? 7 : 5 }).map((_, i) => (
            <div key={i} style={{
              borderBottom: '1px solid #ddd',
              height: isPrint ? '7mm' : 18,
              marginBottom: isPrint ? 0 : 4,
            }} />
          ))}
        </div>
      </div>

    </div>
  )
}
