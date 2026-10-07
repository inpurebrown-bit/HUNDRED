'use client'

import { useEffect, useState } from 'react'
import { COMPANY } from '@/lib/companyInfo'

// 홈페이지 첫 화면 안내 팝업 2개 — 각각 "1일 동안 보지 않기" 가능
const DAY = 24 * 60 * 60 * 1000
const KEYS = { scam: 'hc_notice_scam_until', broker: 'hc_notice_broker_until' }

function hiddenNow(key: string): boolean {
  try { return Number(localStorage.getItem(key) || 0) > Date.now() } catch { return false }
}
function hideOneDay(key: string) {
  try { localStorage.setItem(key, String(Date.now() + DAY)) } catch { /* 저장 불가 시 이번만 닫힘 */ }
}

const BROKER_TYPES: { no: string; tag: string; text: string; law: string }[] = [
  { no: '①', tag: '계약 불이행', text: '성공 조건부 계약을 체결하고, 수수료를 선지급 받은 후 대출 실패 시 선지급금 반환청구에 응하지 않는 경우', law: '형법 제347조에 의한 사기에 해당' },
  { no: '②', tag: '대출심사 허위 대응', text: '재무제표 분석, 사업계획 과대포장 등 허위로 신청서류를 작성해주고 수수료를 요구하는 경우', law: '형법 제347조에 의한 사기에 해당' },
  { no: '③', tag: '허위 대출약속', text: '지원자격이 안되는 기업(요건미흡 등)을 대상으로 정책자금을 받아주겠다며 대가를 요구하는 경우', law: '형법 제347조에 의한 사기에 해당' },
  { no: '④', tag: '부정청탁', text: '정부기관, 공공기관 직원 등과의 인적 네트워크를 통해 정책자금 지원이 가능하도록 하겠다고 약속하고, 착수금 등을 요구하는 경우', law: '형법 제347조에 의한 사기에 해당, 청탁금지법 제5조에 의한 부정청탁의 금지 위반' },
  { no: '⑤', tag: '정부기관 등 사칭', text: '제3자가 정부 공무원이나 공공기관 직원의 명함을 임의로 사용하거나 허위로 정책자금 관련 기관 직원을 사칭하는 경우', law: '형법 제347조에 해당, 형법 제118조에 의한 공무원자격사칭에 해당' },
  { no: '⑥', tag: '부당 보험영업 행위', text: '보험계약 모집 시 보험계약자에게 정책자금 신청 등을 대행해 주거나, 대행을 약속하고 보험을 모집하는 경우', law: '보험업법 제98조에 의한 특별이익의 제공 금지 위반' },
]

export default function NoticePopups() {
  const [ready, setReady] = useState(false)
  const [openScam, setOpenScam] = useState(false)
  const [openBroker, setOpenBroker] = useState(false)

  // 저장된 "1일 보지 않기" 확인 후, 화면이 자리 잡은 뒤 부드럽게 표시
  useEffect(() => {
    const s = !hiddenNow(KEYS.scam)
    const b = !hiddenNow(KEYS.broker)
    if (!s && !b) return
    const t = setTimeout(() => { setOpenScam(s); setOpenBroker(b); setReady(true) }, 700)
    return () => clearTimeout(t)
  }, [])

  if (!(ready && (openScam || openBroker))) return null

  const closeAll = () => { setOpenScam(false); setOpenBroker(false) }

  const footer = (key: string, close: () => void) => (
    <div className="grid grid-cols-2 border-t border-[#e4e7ee] text-[12.5px] shrink-0 bg-white">
      <button type="button" onClick={() => { hideOneDay(key); close() }}
        className="py-3 text-[#0b2140]/55 hover:bg-[#f4f5f8] transition-colors border-r border-[#e4e7ee]">1일 동안 보지 않기</button>
      <button type="button" onClick={close}
        className="py-3 font-bold text-[#0b2140] hover:bg-[#f4f5f8] transition-colors">닫기</button>
    </div>
  )

  const header = (eyebrow: string, title: React.ReactNode, onClose: () => void, sub?: React.ReactNode) => (
    <div className="relative px-5 pt-5 pb-4 text-center bg-gradient-to-br from-[#10203a] to-[#0a1424] shrink-0">
      <p className="text-[9.5px] tracking-[0.35em] text-[#C5A258] font-semibold mb-1.5">{eyebrow}</p>
      <h2 className="text-[16px] font-black leading-snug text-white">{title}</h2>
      {sub && <p className="text-[11px] text-white/55 mt-1.5 leading-relaxed">{sub}</p>}
      <button type="button" aria-label="닫기" onClick={onClose}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg border border-[#C5A258]/45 text-white/65 hover:text-white hover:border-[#C5A258] transition-colors text-sm">✕</button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center gap-3 p-4 bg-[#0b1220]/45 backdrop-blur-[3px]"
      style={{ animation: 'hcNoticeFade .5s ease both' }}
      onClick={e => { if (e.target === e.currentTarget) closeAll() }}>
      <style>{`
        @keyframes hcNoticeFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes hcNoticeRise { from { opacity: 0; transform: translateY(16px) scale(.98) } to { opacity: 1; transform: none } }
      `}</style>

      {/* ── 1) 사칭 주의 ── */}
      {openScam && (
        <div className="w-full max-w-[320px] rounded-2xl overflow-hidden bg-white shadow-[0_30px_70px_-25px_rgba(11,18,32,.6)] flex flex-col max-h-[78vh]"
          style={{ animation: 'hcNoticeRise .7s cubic-bezier(.16,1,.3,1) both' }}>
          {header('고객 보호 안내', <><span className="mr-1">📢</span>헌드레드컨설팅 <span className="text-[#E8D080]">사칭에 유의</span>하세요</>, () => setOpenScam(false))}
          <div className="px-5 py-4 overflow-y-auto">
            <p className="text-[12px] text-[#0b2140]/65 leading-relaxed text-center">
              최근 당사를 사칭한 연락이 늘고 있어 안내드립니다.<br />
              헌드레드컨설팅은 <b className="text-[#0b2140]">정식 상담 절차</b>를 통해서만 진행하며,<br />
              아래와 같은 요구는 저희와 무관합니다.
            </p>
            <div className="mt-3 rounded-xl bg-[#f4f5f8] border border-[#e4e7ee] p-3.5">
              <p className="text-[12px] font-bold text-[#b42b2b] mb-2">⚠ 이런 요구는 의심하세요</p>
              <ul className="space-y-1.5">
                {[
                  '정부·공공기관 소속이라며 접근해 오는 경우',
                  '승인·대출을 무조건 받게 해 준다고 장담하는 경우',
                  '업무를 시작하기도 전에 수수료나 착수금을 요구하는 경우',
                  '매출이나 서류를 부풀려 꾸미자고 권하는 경우',
                  '직원이라며 개인 계좌로 입금을 요구하는 경우',
                ].map(t => (
                  <li key={t} className="flex gap-2 text-[11.5px] text-[#0b2140]/75 leading-snug">
                    <span className="text-[#c0392b] font-black shrink-0">✕</span>{t}
                  </li>
                ))}
              </ul>
            </div>
            <a href={COMPANY.phoneHref}
              className="mt-3 block rounded-xl text-center py-3 bg-gradient-to-br from-[#10203a] to-[#0a1424] hover:brightness-110 transition">
              <span className="block text-[10.5px] text-white/55">의심스러운 연락을 받으셨다면</span>
              <span className="block text-[17px] font-black text-[#E8D080] mt-0.5 tracking-wide">대표번호 {COMPANY.phone}</span>
            </a>
          </div>
          {footer(KEYS.scam, () => setOpenScam(false))}
        </div>
      )}

      {/* ── 2) 불법 브로커 안내 (소진공 신고센터 안내 수록) ── */}
      {openBroker && (
        <div className={`w-full max-w-[360px] rounded-2xl overflow-hidden bg-white shadow-[0_30px_70px_-25px_rgba(11,18,32,.6)] flex-col max-h-[78vh] ${openScam ? 'hidden md:flex' : 'flex'}`}
          style={{ animation: 'hcNoticeRise .8s .1s cubic-bezier(.16,1,.3,1) both' }}>
          {header('공공기관 안내', <>정책자금 <span className="text-[#E8D080]">불법 브로커</span>, 꼭 확인하세요</>, () => setOpenBroker(false), '소상공인시장진흥공단 안내 내용을 그대로 옮겼습니다.')}

          <div className="px-4 py-3.5 overflow-y-auto space-y-3">
            <p className="text-[11.5px] text-center font-black text-[#0b2140]">소상공인 정책자금 불법 브로커 신고센터</p>

            <ul className="rounded-lg border border-[#b9dcdc] bg-[#eef8f8] p-3 space-y-1">
              {[
                '입력하신 내용은 정책자금 불법 브로커 신고 관련 민원처리 목적으로만 사용됩니다.',
                '민원의 조사·처리 과정에서 신고자의 비밀은 관련 법령 및 규정에 따라 보장됩니다.',
                '신고 후 신고번호와 비밀번호로 신고현황을 조회할 수 있으므로 분실 및 외부 노출되지 않도록 유의하여 주시기 바랍니다.',
              ].map(t => <li key={t} className="text-[10.5px] leading-relaxed text-[#0b2140]/70 flex gap-1.5"><span className="text-[#2f8a8a]">*</span>{t}</li>)}
            </ul>

            <div className="rounded-lg overflow-hidden p-1" style={{ background: 'repeating-linear-gradient(135deg,#f2c200 0 11px,#1a1a1a 11px 22px)' }}>
              <div className="bg-white rounded-md px-3.5 py-3">
                <p className="text-[13px] font-black text-[#0b2140] text-center"><span className="text-[#e0a800] mr-1">⚠</span>정책자금 제3자 부당개입이 아닌 경우</p>
                <ul className="mt-2 space-y-0.5 text-[11.5px] text-[#0b2140]/80 font-semibold pl-2">
                  {['단순 신청 대행', '플랫폼 내 정책자금 신청 단기 인력 구인 공고', '상호 계약에 의한 계약금, 수수료 지급', '컨설팅 업체 등의 단순 모객 연락'].map(t => <li key={t}>- {t}</li>)}
                </ul>
              </div>
            </div>

            <div>
              <p className="text-[11.5px] font-black text-[#0b2140] mb-1.5">불법 브로커 신고 유형 및 판단기준</p>
              <div className="rounded-lg border border-[#e4e7ee] overflow-hidden text-[10.5px]">
                <div className="grid grid-cols-[54px_1fr] bg-[#eef1f6] text-[#0b2140] font-bold">
                  <div className="px-2 py-1.5 border-r border-[#e4e7ee] text-center">구분</div>
                  <div className="px-2 py-1.5 text-center">내용</div>
                </div>
                <div className="grid grid-cols-[54px_1fr] border-t border-[#e4e7ee]">
                  <div className="px-1.5 py-2 border-r border-[#e4e7ee] text-center text-[#0b2140]/70 font-bold">정의</div>
                  <div className="px-2.5 py-2 text-[#0b2140]/70 leading-relaxed">정책자금 신청업체에 재직하지 아니하면서 정책자금 신청·대출과정에 사업자의 피해를 유발하고 정책목적을 훼손하는 행위</div>
                </div>
                {BROKER_TYPES.map((t, i) => (
                  <div key={t.no} className="grid grid-cols-[54px_1fr] border-t border-[#e4e7ee]">
                    <div className="px-1.5 py-2 border-r border-[#e4e7ee] text-center text-[10px] text-[#a8873f] font-bold leading-snug">
                      {i === 0 ? '피해 유발 행위' : i === 1 ? '정책 목적 훼손' : ''}
                    </div>
                    <div className="px-2.5 py-2 leading-relaxed">
                      <p className="text-[#0b2140]/75"><b className="text-[#0b2140]">{t.no} ({t.tag})</b> {t.text}</p>
                      <p className="text-[#b42b2b] mt-0.5">- {t.law}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10.5px] text-[#0b2140]/50 leading-relaxed text-center">
              위 사례에 해당하는 연락을 받으셨다면 소상공인시장진흥공단 신고센터에 신고하실 수 있으며,
              궁금한 점은 대표번호 <a href={COMPANY.phoneHref} className="text-[#a8873f] font-bold">{COMPANY.phone}</a>로 문의해 주세요.
            </p>
          </div>
          {footer(KEYS.broker, () => setOpenBroker(false))}
        </div>
      )}
    </div>
  )
}
