'use client'

// 인콜카드 "환불·정산" 탭 — 만약 환불(해지·정산)해 준다면 얼마가 나가야 하는지 계산하고,
// 이미 교부(전달)된 내용이 언제(날짜·시간) 됐는지 체크해 둔다. 관리팀은 이걸 보면서 핸들링한다.
//  · 계산식(정관·계약서 제10조·별지2): 반환액 = 착수금 − (업무수행비용 + 관리비 + 위약금) → 부가세 10% 가산
//     관리비 = 착수금 × 월 8% × 경과 월수(1개월 미만은 1개월), 총한도 50만원 / 위약금 = 착수금 × 10%
//     업무수행비용 = 교부된 단계의 업무금액 × 단계 비율(별지2)
//  · 지급일 = 해지 확정일 다음 달 10일(주말이면 다음 월요일)
//  · 교부 시각은 주황이가 자료를 보낼 때 자동으로 남기고(/api/agent/deliveries), 관리팀이 직접 고칠 수도 있다.
import { useEffect, useMemo, useState } from 'react'

type Stage = { name: string; pct: number; kinds?: string[] }
const STAGES: Record<string, { label: string; stages: Stage[] }> = {
  diag:    { label: '경영진단 및 자문', stages: [{ name: '업체 진단 및 진단보고서 전달', pct: 50, kinds: ['report', 'diag', 'finance'] }, { name: '회사소개서 작성 및 전달', pct: 20 }, { name: '연간 계획 및 자문', pct: 30, kinds: ['plan'] }] },
  venture: { label: '벤처기업확인', stages: [{ name: '요건 진단 및 설계', pct: 20 }, { name: '평가서류 작성 완료', pct: 40 }, { name: '접수 후 심사 대응 및 보완', pct: 40 }] },
  lab:     { label: '기업부설연구소 설립 신고', stages: [{ name: '요건 진단 및 인력·공간 설계', pct: 25 }, { name: '신고서류 작성 완료', pct: 45 }, { name: '신고 접수 및 보완 대응 완료', pct: 30 }] },
  inno:    { label: '이노비즈', stages: [{ name: '요건 진단 및 자가진단 설계', pct: 20 }, { name: '평가서류 작성 및 온라인 평가 완료', pct: 45 }, { name: '현장평가 대응 및 보완 완료', pct: 35 }] },
  main:    { label: '메인비즈', stages: [{ name: '요건 진단 및 자가진단 설계', pct: 20 }, { name: '평가서류 작성 및 온라인 평가 완료', pct: 45 }, { name: '현장평가 대응 및 보완 완료', pct: 35 }] },
  plan:    { label: '정부지원사업 사업계획서 작성', stages: [{ name: '과제 선정 및 작성 전략 수립', pct: 25 }, { name: '사업계획서 작성 완료 및 전달', pct: 50, kinds: ['bizplan'] }, { name: '접수 지원 및 보완·발표 대응', pct: 25 }] },
  patent:  { label: '특허 가출원용 자료 작성', stages: [{ name: '발명 내용 정리 및 선행기술 조사', pct: 30 }, { name: '기술자료 작성 완료', pct: 50 }, { name: '변리사사무소 전달 및 보완 자료 제공', pct: 20 }] },
  rnd:     { label: 'R&D 과제 사업계획서 작성', stages: [{ name: '기술 분석 및 과제 매칭', pct: 20 }, { name: '사업계획서 작성 완료 및 전달', pct: 50 }, { name: '접수 지원 및 평가 대응', pct: 30 }] },
}
const KIND_LABEL: Record<string, string> = { g9: '재무제표 핵심 가이드', g10: '절세요령', g11: '정부지원금·인증 로드맵', finance: '재무제표 분석', report: '보고서', diag: '경영진단 통합 리포트', plan: '컨설팅 수행계획서', bizplan: '사업계획서', road: '로드맵' }

const money = (v: any) => parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10) || 0
const won = (n: number) => Math.round(n).toLocaleString('ko-KR') + '원'
const kstNow = () => new Date(Date.now() + 9 * 3600 * 1000)
const toLocalInput = (iso: string) => { if (!iso) return ''; const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000); return d.toISOString().slice(0, 16) }
const fromLocalInput = (v: string) => (v ? new Date(v + ':00+09:00').toISOString() : '')
const show = (iso: string) => iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : ''
function nextMonth10(dateStr: string) {
  const [y, m] = dateStr.slice(0, 7).split('-').map(Number)
  let d = new Date(Date.UTC(y, m, 10))   // m 은 1~12 → 다음 달 10일
  while ([0, 6].includes(d.getUTCDay())) d = new Date(d.getTime() + 86400000)
  return d.toISOString().slice(0, 10)
}

interface Delivery { id: string; label: string; at: string; by: string; note?: string; key?: string }

export default function RefundTab({ caseId, company, custDetails, opsDetails, onSave }: {
  caseId: string; company: string; custDetails: any; opsDetails: any; onSave: (patch: Record<string, any>) => void
}) {
  const cd = custDetails || {}, od = opsDetails || {}
  const draft = od.contract_draft || cd.contract_draft || null
  const saved = od.refund_calc || {}
  const [cancelDate, setCancelDate] = useState<string>(saved.cancelDate || kstNow().toISOString().slice(0, 10))
  const [done, setDone] = useState<Record<string, string>>(saved.stagesDone || {})
  const [paidOv, setPaidOv] = useState<string>(saved.paidOverride ? String(saved.paidOverride) : '')
  const [deliveries, setDeliveries] = useState<Delivery[]>(Array.isArray(od.deliveries) ? od.deliveries : [])
  const [jobs, setJobs] = useState<any[]>([])
  const [newLabel, setNewLabel] = useState(''), [newAt, setNewAt] = useState(toLocalInput(new Date().toISOString()))

  useEffect(() => {
    fetch(`/api/agent-jobs?case_id=${encodeURIComponent(caseId)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setJobs(j.jobs || [])).catch(() => {})
  }, [caseId])
  useEffect(() => { if (Array.isArray(od.deliveries)) setDeliveries(od.deliveries) }, [od.deliveries])

  // 계약 항목과 금액 (계약서 만들 때 저장된 내용이 있으면 그대로, 없으면 착수금 전체를 경영진단 금액으로)
  const items = useMemo(() => {
    const out: { key: string; amount: number }[] = []
    const di = draft?.items
    if (di) for (const k of Object.keys(STAGES)) { const v = di[k]; if (v?.on && Number(v.amount) > 0) out.push({ key: k, amount: Number(v.amount) }) }
    if (!out.length) { const fee = money(cd.contract_fee) || money(cd.payment_amount); if (fee > 0) out.push({ key: 'diag', amount: fee }) }
    return out
  }, [draft, cd.contract_fee, cd.payment_amount])
  const fee = items.reduce((s, i) => s + i.amount, 0) || money(cd.contract_fee)
  const prepaid = money(cd.net_paid) || (cd.vat_included ? Math.round(money(cd.payment_amount) / 1.1) : money(cd.payment_amount))
  const extras = (Array.isArray(cd.extra_counts) ? cd.extra_counts : []).reduce((s: number, e: any) => s + money(e?.amount), 0)
  const paid = paidOv ? money(paidOv) : prepaid + extras
  const contractDate = String(cd.contract_date || '').slice(0, 10)

  // 자동 발송된 자료의 전송 시각 (이 업무 단계의 교부 근거)
  const sentAt = (kinds?: string[]) => {
    if (!kinds) return ''
    const j = jobs.filter(x => x.status === 'sent' && kinds.includes(x.kind)).sort((a, b) => String(a.updated_at).localeCompare(String(b.updated_at)))[0]
    return j ? j.updated_at : ''
  }
  const stageKey = (k: string, i: number) => `${k}:${i}`
  const doneAt = (k: string, st: Stage, i: number) => done[stageKey(k, i)] ?? sentAt(st.kinds) ?? ''

  // 계산
  const workCost = items.reduce((s, it) => s + STAGES[it.key].stages.reduce((t, st, i) => t + (doneAt(it.key, st, i) ? it.amount * st.pct / 100 : 0), 0), 0)
  const monthsElapsed = (() => {
    if (!contractDate) return 1
    const days = Math.max(0, (new Date(cancelDate).getTime() - new Date(contractDate).getTime()) / 86400000)
    return Math.max(1, Math.ceil(days / 30))
  })()
  const mgmt = Math.min(500000, Math.round(fee * 0.08 * monthsElapsed))
  const penalty = Math.round(fee * 0.10)
  const deduct = workCost + mgmt + penalty
  const refundSupply = Math.max(0, paid - deduct)
  const refund = Math.round(refundSupply * 1.1)
  const payDay = nextMonth10(cancelDate)

  function persist(next: { cancelDate?: string; stagesDone?: Record<string, string>; paidOverride?: string }) {
    onSave({ refund_calc: { cancelDate, stagesDone: done, paidOverride: paidOv ? money(paidOv) : 0, ...next, updated_at: new Date().toISOString() } })
  }
  function setStage(k: string, i: number, iso: string) {
    const next = { ...done, [stageKey(k, i)]: iso }
    setDone(next); persist({ stagesDone: next })
  }
  function addDelivery() {
    const label = newLabel.trim(); if (!label) return
    const list = [...deliveries, { id: 'm' + Date.now(), label, at: fromLocalInput(newAt) || new Date().toISOString(), by: '관리팀' }]
    setDeliveries(list); onSave({ deliveries: list }); setNewLabel('')
  }
  function delDelivery(id: string) { const list = deliveries.filter(d => d.id !== id); setDeliveries(list); onSave({ deliveries: list }) }

  const sentJobs = jobs.filter(j => j.status === 'sent').sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
  const box = 'rounded-xl border border-gray-100 bg-white px-3 py-3'
  const Row = ({ l, v, strong, minus }: { l: string; v: string; strong?: boolean; minus?: boolean }) => (
    <div className={`flex items-center justify-between py-1.5 ${strong ? 'border-t border-gray-200 mt-1 pt-2.5' : ''}`}>
      <span className={`text-[12px] ${strong ? 'font-black text-[#1B2A45]' : 'text-gray-600'}`}>{l}</span>
      <span className={`tabular-nums text-[13px] ${strong ? 'font-black text-rose-600 text-base' : minus ? 'text-rose-500' : 'font-bold text-[#1B2A45]'}`}>{v}</span>
    </div>
  )

  if (!fee) return <div className={box}><p className="text-sm text-gray-500">계약 금액(착수금)이 아직 입력되지 않았습니다. 입금/계약 탭에서 계약 정보를 먼저 입력해 주세요.</p></div>

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2.5">
        <p className="text-xs font-black text-rose-700">환불·정산 계산 <span className="font-normal text-gray-500">· 만약 해지·환불해 준다면 얼마가 나가야 하는지</span></p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">반환액 = 착수금 − (업무수행비용 + 관리비 + 위약금) 에 부가세 10%를 더한 금액. 교부(전달)된 단계만 공제합니다. 최종 처리는 대표가 합니다.</p>
      </div>

      <div className={box}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <label className="text-[11px] text-gray-500 font-semibold">해지 확정일<input type="date" value={cancelDate} onChange={e => { setCancelDate(e.target.value); persist({ cancelDate: e.target.value }) }} className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" /></label>
          <label className="text-[11px] text-gray-500 font-semibold">실제 입금한 금액(공급가) <span className="font-normal text-gray-400">비우면 자동</span><input value={paidOv} onChange={e => setPaidOv(e.target.value.replace(/[^0-9]/g, ''))} onBlur={() => persist({ paidOverride: paidOv })} placeholder={won(prepaid + extras)} className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right tabular-nums" /></label>
          <div className="text-[11px] text-gray-500 font-semibold">계약일<p className="mt-1 text-sm text-[#1B2A45] font-bold">{contractDate || '미입력'} <span className="text-gray-400 font-normal">· {monthsElapsed}개월 경과</span></p></div>
        </div>
      </div>

      {items.map(it => (
        <div key={it.key} className={box}>
          <p className="text-[12.5px] font-black text-[#1B2A45] mb-1.5">{STAGES[it.key].label} <span className="font-normal text-gray-400">· 업무금액 {won(it.amount)}</span></p>
          <div className="space-y-1.5">
            {STAGES[it.key].stages.map((st, i) => {
              const at = doneAt(it.key, st, i), auto = done[stageKey(it.key, i)] === undefined && !!at
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5">
                  <label className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <input type="checkbox" checked={!!at} onChange={e => setStage(it.key, i, e.target.checked ? new Date().toISOString() : '')} className="w-4 h-4" />
                    <span className={`text-[12px] ${at ? 'font-bold text-[#1B2A45]' : 'text-gray-500'}`}>{st.name} <span className="text-gray-400">({st.pct}% · {won(it.amount * st.pct / 100)})</span></span>
                  </label>
                  {at && (<>
                    <input type="datetime-local" value={toLocalInput(at)} onChange={e => setStage(it.key, i, fromLocalInput(e.target.value))} className="border border-gray-200 rounded-md px-1.5 py-1 text-[11px]" />
                    {auto && <span className="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-200 rounded px-1.5 py-0.5">주황이 전송 기록</span>}
                  </>)}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div className={box}>
        <Row l="착수금 (공급가)" v={won(fee)} />
        <Row l="실제 입금액 (공급가)" v={won(paid)} />
        <Row l="업무수행비용 (교부된 단계)" v={'− ' + won(workCost)} minus />
        <Row l={`관리비 (월 8% × ${monthsElapsed}개월, 총한도 50만원)`} v={'− ' + won(mgmt)} minus />
        <Row l="위약금 (착수금 10%)" v={'− ' + won(penalty)} minus />
        <Row l="공제 합계" v={won(deduct)} />
        <Row l={`반환액 (공급가 ${won(refundSupply)} + 부가세 10%)`} v={won(refund)} strong />
        <p className="text-[11px] text-gray-500 mt-2">지급일 <b className="text-[#1B2A45]">{payDay}</b> (해지 확정 다음 달 10일, 주말이면 다음 월요일 · 공휴일은 직접 확인) · 매출에서 차감할 금액(부가세 제외) <b className="text-[#1B2A45]">{won(refundSupply)}</b></p>
        {paid < deduct && <p className="text-[11px] text-amber-600 mt-1">공제가 입금액보다 커서 반환액은 0원입니다. 초과분은 청구하지 않습니다(계약서 제10조 제5항).</p>}
        <p className="text-[10px] text-gray-400 mt-1">P라인·과제 선정 이후 사후관리 등 별도 정산 항목은 이 계산에 들어 있지 않습니다. 잔금을 아직 내지 않은 해지도 같은 기준입니다.</p>
      </div>

      <div className={box}>
        <p className="text-[12.5px] font-black text-[#1B2A45] mb-1.5">교부 이력 <span className="font-normal text-gray-400">· 고객에게 무엇을 언제 전달했는지 (주황이가 자료를 보내면 자동으로 남습니다)</span></p>
        <ul className="space-y-1">
          {sentJobs.map(j => (
            <li key={j.id} className="flex items-center justify-between rounded-lg bg-sky-50/60 border border-sky-100 px-2.5 py-1.5">
              <span className="text-[12px] text-[#1B2A45]"><b>{KIND_LABEL[j.kind] || j.kind}</b> 전송 <span className="text-gray-400">· {j.room || '카톡방'}</span></span>
              <span className="text-[11px] font-bold text-sky-700 tabular-nums">{show(j.updated_at)}</span>
            </li>
          ))}
          {deliveries.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).map(d => (
            <li key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1.5">
              <span className="text-[12px] text-[#1B2A45]"><b>{d.label}</b> <span className="text-gray-400">· {d.by}{d.note ? ` · ${d.note}` : ''}</span></span>
              <span className="flex items-center gap-2"><span className="text-[11px] font-bold text-gray-600 tabular-nums">{show(d.at)}</span>
                <button type="button" onClick={() => delDelivery(d.id)} className="text-[10px] text-gray-300 hover:text-rose-500">삭제</button></span>
            </li>
          ))}
          {!sentJobs.length && !deliveries.length && <li className="text-[11px] text-gray-400">아직 기록된 교부 내역이 없습니다.</li>}
        </ul>
        <div className="flex flex-wrap gap-2 mt-2">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="직접 기록 (예: 진단보고서 대면 전달)" className="flex-1 min-w-[180px] border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px]" />
          <input type="datetime-local" value={newAt} onChange={e => setNewAt(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-[11px]" />
          <button type="button" onClick={addDelivery} className="px-3 py-1.5 rounded-lg bg-[#1B2A45] text-white text-[12px] font-bold">기록 추가</button>
        </div>
      </div>
    </div>
  )
}
