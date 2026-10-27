'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'

// 계약서(한글 파일) 만들기 — 인콜카드 우측 상단의 "계약서" 버튼에서 연다.
// 카드에 있는 값은 미리 채워 두고, 나머지만 입력하면 헌드레드 서식의 .hwpx 가 내려받아진다.
export interface ContractPrefill {
  company?: string; ceo?: string; address?: string; bizNo?: string
  managerName?: string; managerPhone?: string
  type?: 'fee' | 'nofee'; feePercent?: string
  customerId?: string; opsCaseId?: string
}

// 별지 1 업무 목록 (서버 생성기의 ITEM_ROWS 와 같은 키)
const ITEMS: { key: string; label: string; required?: boolean }[] = [
  { key: 'diag', label: '경영진단 및 자문', required: true },
  { key: 'venture', label: '벤처기업확인' },
  { key: 'lab', label: '기업부설연구소(연구개발전담부서) 설립 신고' },
  { key: 'inno', label: '이노비즈(기술혁신형 중소기업)' },
  { key: 'main', label: '메인비즈(경영혁신형 중소기업)' },
  { key: 'plan', label: '정부지원사업 사업계획서 작성' },
  { key: 'patent', label: '특허 가출원용 자료 작성' },
  { key: 'rnd', label: 'R&D 과제 사업계획서 작성' },
]

const inp = 'w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-2 text-[14px] text-[#0b2140] bg-white outline-none focus:border-[#b8995a]'
const num = (v: string) => parseInt(String(v).replace(/[^0-9]/g, ''), 10) || 0
const fmt = (n: number) => (n ? n.toLocaleString('ko-KR') : '')

export default function ContractWizard({ prefill, onClose, onDone }: { prefill: ContractPrefill; onClose: () => void; onDone?: () => void }) {
  const { data: session } = useSession()
  const isCeo = (session?.user as any)?.role === 'ceo'
  const [type, setType] = useState<'fee' | 'nofee' | ''>(prefill.type || '')
  const [feePercent, setFeePercent] = useState(prefill.feePercent ? String(prefill.feePercent).replace(/[^0-9.]/g, '') : '')
  const [company, setCompany] = useState(prefill.company || '')
  const [ceo, setCeo] = useState(prefill.ceo || '')
  const [address, setAddress] = useState(prefill.address || '')
  const [bizNo, setBizNo] = useState(prefill.bizNo || '')
  const [managerName, setManagerName] = useState(prefill.managerName || '')
  const [managerPhone, setManagerPhone] = useState(prefill.managerPhone || '')
  const [date, setDate] = useState(new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10))
  const [on, setOn] = useState<Record<string, boolean>>({})
  const [amt, setAmt] = useState<Record<string, string>>({})
  const [defaults, setDefaults] = useState<Record<string, number>>({})   // 대표가 정한 기본 금액 (체크하면 이 값이 채워진다)
  const [postCare, setPostCare] = useState(false)
  const [postPct, setPostPct] = useState('')
  const [pLine, setPLine] = useState(false)
  const [clauses, setClauses] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // 이 카드에서 지난번에 만든 계약서의 입력 내용 — 있으면 그대로 다시 채운다 (고쳐서 다시 뽑을 수 있게)
  const [draftNote, setDraftNote] = useState('')
  useEffect(() => {
    const q = new URLSearchParams()
    if (prefill.customerId) q.set('customerId', prefill.customerId)
    if (prefill.opsCaseId) q.set('opsCaseId', prefill.opsCaseId)
    if (!q.toString()) return
    fetch('/api/contract/generate?' + q.toString()).then(r => r.json()).then(j => {
      const d = j?.draft
      if (!d) return
      setType(d.type || ''); setFeePercent(d.feePercent ? String(d.feePercent) : '')
      const c = d.client || {}
      setCompany(c.company || ''); setCeo(c.ceo || ''); setAddress(c.address || ''); setBizNo(c.bizNo || '')
      setManagerName(c.managerName || ''); setManagerPhone(c.managerPhone || '')
      if (d.contractDate) setDate(d.contractDate)
      const o: Record<string, boolean> = {}, a: Record<string, string> = {}
      for (const [k, v] of Object.entries(d.items || {}) as [string, any][]) { o[k] = !!v?.on; a[k] = v?.on && v.amount ? fmt(Number(v.amount)) : '' }
      setOn(o); setAmt(a)
      setPostCare(!!d.postCare?.on); setPostPct(d.postCare?.percent ? String(d.postCare.percent) : '')
      setPLine(!!d.pLine); setClauses((d.extraClauses || []).join('\n'))
      setDraftNote(`지난번에 입력한 내용을 그대로 불러왔습니다 (${d.savedBy || ''} · ${d.savedAt ? new Date(d.savedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}). 고친 뒤 다시 생성하세요.`)
    }).catch(() => {})
  }, [prefill.customerId, prefill.opsCaseId])

  // 대표가 정한 기본 금액, 마지막에 쓴 담당자 연락처
  useEffect(() => {
    fetch('/api/contract/settings').then(r => r.json()).then(j => {
      setDefaults(j?.settings?.itemAmounts || {})
    }).catch(() => {})
    try { if (!prefill.managerPhone) { const v = localStorage.getItem('contract_manager_phone'); if (v) setManagerPhone(v) } } catch { /* 저장값 없음 */ }
  }, [prefill.managerPhone])

  // 카드에서 이미 유형이 정해져 열린 경우, 기본 금액이 도착하면 경영진단 금액을 채운다
  useEffect(() => {
    if (!type || !Object.keys(defaults).length) return
    setAmt(p => (p.diag ? p : { ...p, diag: fmt(Number(type === 'fee' ? (defaults.diagFee ?? 500000) : (defaults.diag ?? 2000000)) || 0) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults])

  // 계약 유형을 고르면 경영진단 금액이 기본값으로 들어간다 (수수료 있음 50만원 · 없음 200만원)
  function pickType(t: 'fee' | 'nofee') {
    setType(t)
    const v = t === 'fee' ? (defaults.diagFee ?? 500000) : (defaults.diag ?? 2000000)
    setAmt(p => ({ ...p, diag: fmt(Number(v) || 0) }))
  }
  // 업무를 켜면 기본 금액, 끄면 금액을 비운다
  function toggleItem(key: string, checked: boolean) {
    setOn(p => ({ ...p, [key]: checked }))
    setAmt(p => ({ ...p, [key]: checked ? fmt(Number(defaults[key]) || 0) : '' }))
  }

  const sum = useMemo(() => ITEMS.reduce((t, it) => t + ((it.required || on[it.key]) ? num(amt[it.key] || '') : 0), 0), [on, amt])
  const vat = Math.round(sum * 0.1)

  async function make(format: 'pdf' | 'hwpx' = 'pdf') {
    setErr(''); setMsg('')
    if (!type) { setErr('계약 유형(수수료 없음 / 수수료 있음)을 먼저 골라 주세요.'); return }
    if (type === 'fee' && !feePercent.trim()) { setErr('수수료가 있는 계약은 몇 %인지 입력해 주세요.'); return }
    if (!company.trim()) { setErr('업체명을 입력해 주세요.'); return }
    if (!ceo.trim()) { setErr('대표자명을 입력해 주세요.'); return }
    if (!address.trim()) { setErr('사업장 주소를 입력해 주세요.'); return }
    for (const it of ITEMS) if ((it.required || on[it.key]) && !num(amt[it.key] || '')) { setErr(`"${it.label}"을 체크했으면 금액을 입력해 주세요. (안 하는 업무는 체크를 해제하세요)`); return }
    if (postCare && !postPct.trim()) { setErr('과제 선정 이후 사후관리는 교부 지원금의 몇 %인지 입력해 주세요.'); return }
    setBusy(true)
    try {
      const items = Object.fromEntries(ITEMS.map(it => [it.key, { on: !!(it.required || on[it.key]), amount: num(amt[it.key] || '') }]))
      const r = await fetch('/api/contract/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type, feePercent: feePercent.trim(), contractDate: date,
          client: { company: company.trim(), ceo: ceo.trim(), address: address.trim(), bizNo: bizNo.trim(), managerName: managerName.trim(), managerPhone: managerPhone.trim() },
          items, postCare: { on: postCare, percent: postPct.trim() }, pLine,
          extraClauses: clauses.split('\n').map(s => s.trim()).filter(Boolean),
          customerId: prefill.customerId, opsCaseId: prefill.opsCaseId, format,
        }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error || '계약서를 만들지 못했습니다.'); return }
      const blob = await r.blob()
      const cd = r.headers.get('Content-Disposition') || ''
      const m = cd.match(/filename\*=UTF-8''([^;]+)/)
      const name = m ? decodeURIComponent(m[1]) : `계약서_${company}.${format}`
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      try { if (managerPhone.trim()) localStorage.setItem('contract_manager_phone', managerPhone.trim()) } catch { /* 저장 불가 */ }
      setMsg(`"${name}" 파일이 내려받아졌습니다. 내용을 확인한 뒤 모두싸인에 올려 주세요. (타임스탬프에 기록됨 · 입력한 내용은 저장되어 다시 열면 그대로 나옵니다)`)
      onDone?.()
    } catch { setErr('네트워크 오류로 계약서를 만들지 못했습니다.') }
    finally { setBusy(false) }
  }

  const chip = (active: boolean) => `px-4 py-2.5 rounded-xl text-[14px] font-bold border-2 transition-colors ${active ? 'bg-[#0b2140] text-white border-[#0b2140]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`
  const sec = 'text-[12.5px] font-black text-[#0b2140] mb-2 flex items-center gap-2'
  const step = (n: number) => <span className="w-5 h-5 rounded-full bg-[#b8995a] text-white text-[11px] font-black inline-flex items-center justify-center">{n}</span>

  return (
    <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-3" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between bg-gradient-to-br from-[#0e2446] to-[#0a1b36] shrink-0">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-[#C5A258] font-semibold">CONTRACT</p>
            <h2 className="text-white font-bold text-base">계약서 만들기 (PDF)</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-lg">✕</button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div>
            <p className={sec}>{step(1)} 계약 유형</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={chip(type === 'nofee')} onClick={() => pickType('nofee')}>월정기 (수수료 없음)</button>
              <button type="button" className={chip(type === 'fee')} onClick={() => pickType('fee')}>수수료 있음</button>
            </div>
          </div>

          <div>
            <p className={sec}>{step(2)} 업체 정보 <span className="font-normal text-gray-400">(인콜카드에서 가져온 값은 확인만 하세요)</span></p>
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2"><span className="text-[11.5px] text-gray-500 font-semibold">업체명 *</span><input className={inp} value={company} onChange={e => setCompany(e.target.value)} /></label>
              <label><span className="text-[11.5px] text-gray-500 font-semibold">대표자명 *</span><input className={inp} value={ceo} onChange={e => setCeo(e.target.value)} /></label>
              <label><span className="text-[11.5px] text-gray-500 font-semibold">사업자등록번호</span><input className={inp} value={bizNo} onChange={e => setBizNo(e.target.value)} placeholder="000-00-00000" /></label>
              <label className="col-span-2"><span className="text-[11.5px] text-gray-500 font-semibold">사업장 주소 *</span><input className={inp} value={address} onChange={e => setAddress(e.target.value)} placeholder="사업자등록증에 적힌 주소" /></label>
              <label><span className="text-[11.5px] text-gray-500 font-semibold">우리 담당자 (헌드레드)</span><input className={inp} value={managerName} onChange={e => setManagerName(e.target.value)} /></label>
              <label><span className="text-[11.5px] text-gray-500 font-semibold">담당자 연락처</span><input className={inp} value={managerPhone} onChange={e => setManagerPhone(e.target.value)} placeholder="010-0000-0000" /></label>
              <label><span className="text-[11.5px] text-gray-500 font-semibold">계약일 <span className="font-normal text-gray-400">(오늘 날짜 · 수정 가능)</span></span><input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} /></label>
            </div>
          </div>

          <div>
            <p className={sec}>{step(3)} 수행 업무와 금액 <span className="font-normal text-gray-400">(체크 안 한 업무는 금액란에 취소선이 자동으로 들어갑니다)</span></p>
            {type === 'fee' && (
              <div className="mb-2 rounded-2xl border-2 border-[#b8995a] bg-[#fffaf0] px-3 py-2.5 flex items-center gap-3">
                <span className="flex-1 text-[13.5px] font-black text-[#0b2140]">성과 수수료율 <span className="font-normal text-gray-500">(자금이 실행된 금액의 몇 %)</span></span>
                <div className="flex items-center gap-1 text-[13.5px] font-bold text-[#0b2140]">실행금액의
                  <input value={feePercent} onChange={e => setFeePercent(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0" className="w-16 text-center border-[1.5px] border-[#b8995a] rounded-lg px-2 py-1.5 outline-none bg-white" /> %</div>
              </div>
            )}
            {!type && <p className="text-[12.5px] text-[#b3261e] font-semibold mb-2">위에서 계약 유형을 먼저 고르면 기본 금액이 채워집니다.</p>}
            <div className="rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {ITEMS.map(it => {
                const checked = !!(it.required || on[it.key])
                return (
                  <div key={it.key} className="flex items-center gap-3 px-3 py-2">
                    <input type="checkbox" checked={checked} disabled={it.required} onChange={e => toggleItem(it.key, e.target.checked)} className="w-4 h-4" />
                    <span className={`flex-1 text-[13.5px] ${checked ? 'font-bold text-[#0b2140]' : 'text-gray-400 line-through'}`}>{it.label}</span>
                    <div className="flex items-center gap-1 w-40">
                      <input disabled={!checked} value={amt[it.key] || ''} onChange={e => setAmt(p => ({ ...p, [it.key]: fmt(num(e.target.value)) }))} inputMode="numeric" placeholder="금액" className="w-full text-right tabular-nums border-[1.5px] border-gray-200 rounded-lg px-2 py-1.5 text-[13.5px] outline-none focus:border-[#b8995a] disabled:bg-gray-50 disabled:text-gray-300" />
                      <span className="text-[12px] text-gray-400">원</span>
                    </div>
                  </div>
                )
              })}
              <div className="flex items-center gap-3 px-3 py-2">
                <input type="checkbox" checked={postCare} onChange={e => { setPostCare(e.target.checked); if (!e.target.checked) setPostPct('') }} className="w-4 h-4" />
                <span className={`flex-1 text-[13.5px] ${postCare ? 'font-bold text-[#0b2140]' : 'text-gray-400 line-through'}`}>과제 선정 이후 사후관리 <span className="font-normal text-gray-400">(과제 선정 후 받는 지원금 기준 · 위 성과 수수료와 다름)</span></span>
                <div className="flex items-center gap-1 w-40 justify-end text-[13px] text-gray-500">교부 지원금의 <input disabled={!postCare} value={postPct} onChange={e => setPostPct(e.target.value.replace(/[^0-9.]/g, ''))} className="w-12 text-center border-[1.5px] border-gray-200 rounded-lg px-1 py-1.5 outline-none focus:border-[#b8995a] disabled:bg-gray-50" /> %</div>
              </div>
              <div className="flex items-center gap-3 px-3 py-2">
                <input type="checkbox" checked={pLine} onChange={e => setPLine(e.target.checked)} className="w-4 h-4" />
                <span className={`flex-1 text-[13.5px] ${pLine ? 'font-bold text-[#0b2140]' : 'text-gray-400 line-through'}`}>P라인(프리미엄) <span className="font-normal text-gray-400">사업계획서·접수 대행·사후관리</span></span>
              </div>
            </div>
            <p className="text-[12.5px] text-gray-500 mt-2 tabular-nums">합계 <b>{sum.toLocaleString('ko-KR')}</b>원 + 부가세 {vat.toLocaleString('ko-KR')}원 = <b className="text-[#0b2140]">착수금 {(sum + vat).toLocaleString('ko-KR')}원</b> <span className="text-gray-400">(P라인·사후관리는 합계에 넣지 않습니다)</span></p>
          </div>

          <div>
            <p className={sec}>{step(4)} 추가 특약 <span className="font-normal text-gray-400">(없으면 비워 두세요 · 한 줄에 하나)</span></p>
            <textarea value={clauses} onChange={e => setClauses(e.target.value)} rows={3} placeholder="예) 착수금은 계약일로부터 3일 이내에 입금한다." className="w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-2 text-[13.5px] outline-none focus:border-[#b8995a] resize-none" />
          </div>

          {draftNote && <p className="text-[12.5px] font-semibold text-sky-700 bg-sky-50 rounded-xl px-3 py-2">{draftNote}</p>}
          {err && <p className="text-[13px] font-bold text-[#b3261e] bg-[#fde7e3] rounded-xl px-3 py-2">{err}</p>}
          {msg && <p className="text-[13px] font-bold text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">{msg}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 shrink-0">
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-semibold hover:bg-gray-50">닫기</button>
          {isCeo && <button onClick={() => make('hwpx')} disabled={busy} className="px-3 border border-gray-200 text-gray-500 py-3 rounded-xl text-[12px] font-semibold hover:bg-gray-50 disabled:opacity-50">한글 파일(대표)</button>}
          <button onClick={() => make('pdf')} disabled={busy} className="flex-[2] bg-gradient-to-r from-[#0b2140] to-[#4a5a9a] text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50">{busy ? '만드는 중…' : '계약서 생성 (PDF 다운로드)'}</button>
        </div>
      </div>
    </div>
  )
}
