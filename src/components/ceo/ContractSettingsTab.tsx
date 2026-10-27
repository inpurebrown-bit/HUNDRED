'use client'

import { useEffect, useState } from 'react'

// 대표 전용: 계약서 기본값 — 회사 정보 · 업무별 기본 금액 · 본문 문구
interface Company { name: string; bizNo: string; address: string; ceo: string; bank: string; account: string; holder: string }
interface Settings { company: Company; itemAmounts: Record<string, number>; textOverrides: { fee: Record<string, string>; nofee: Record<string, string> }; updatedAt?: string; updatedBy?: string }

const ITEMS: [string, string][] = [
  ['diag', '경영진단 및 자문 (월정기·수수료 없음)'], ['diagFee', '경영진단 및 자문 (수수료 있는 계약)'], ['venture', '벤처기업확인'], ['lab', '기업부설연구소 설립 신고'], ['inno', '이노비즈'],
  ['main', '메인비즈'], ['plan', '정부지원사업 사업계획서 작성'], ['patent', '특허 가출원용 자료 작성'], ['rnd', 'R&D 과제 사업계획서 작성'],
]
const COMPANY_FIELDS: [keyof Company, string][] = [
  ['name', '회사명'], ['bizNo', '사업자등록번호'], ['address', '사업장 주소'], ['ceo', '대표자'], ['bank', '은행'], ['account', '계좌번호'], ['holder', '예금주'],
]
const inp = 'w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-2 text-[14px] text-[#0b2140] bg-white outline-none focus:border-[#b8995a]'

export default function ContractSettingsTab() {
  const [st, setSt] = useState<Settings | null>(null)
  const [paras, setParas] = useState<{ fee: string[]; nofee: string[] }>({ fee: [], nofee: [] })
  const [kind, setKind] = useState<'fee' | 'nofee'>('fee')
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/contract/settings?paragraphs=1').then(r => r.json()).then(j => { setSt(j.settings); if (j.paragraphs) setParas(j.paragraphs) }).catch(() => setMsg('불러오지 못했습니다'))
  }, [])

  async function save() {
    if (!st) return
    setSaving(true); setMsg('')
    const r = await fetch('/api/contract/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(st) })
    const j = await r.json().catch(() => ({}))
    setSaving(false)
    if (r.ok) { setSt(j.settings); setMsg('저장했습니다. 지금부터 만드는 계약서에 바로 반영됩니다.') } else setMsg(j.error || '저장 실패')
    setTimeout(() => setMsg(''), 5000)
  }

  if (!st) return <p className="text-sm text-gray-400 py-10 text-center">{msg || '불러오는 중…'}</p>
  const ov = st.textOverrides[kind]
  const list = paras[kind].filter(t => !q.trim() || t.includes(q.trim()) || (ov[t] || '').includes(q.trim()))
  const edited = Object.keys(ov).length

  return (
    <div className="space-y-5 pb-10">
      <div>
        <h3 className="text-[20px] font-black text-[#0b2140]">계약서 설정</h3>
        <p className="text-[13px] text-gray-500 mt-0.5">영업팀·관리팀이 &quot;계약서&quot; 버튼으로 만드는 계약서의 기본값입니다. 여기서 고치면 앞으로 만드는 모든 계약서가 바뀐 내용으로 나갑니다.{st.updatedAt ? ` · 마지막 수정 ${new Date(st.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ${st.updatedBy || ''}` : ''}</p>
      </div>

      <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
        <p className="text-[15px] font-black text-[#0b2140] mb-3">회사 정보 <span className="text-[12px] text-gray-400 font-bold">&quot;을&quot; 칸과 계좌 안내에 들어갑니다</span></p>
        <div className="grid sm:grid-cols-2 gap-3">
          {COMPANY_FIELDS.map(([k, l]) => (
            <label key={k} className={k === 'address' || k === 'holder' ? 'sm:col-span-2' : ''}><span className="text-[12px] font-semibold text-gray-500">{l}</span>
              <input className={inp} value={st.company[k]} onChange={e => setSt({ ...st, company: { ...st.company, [k]: e.target.value } })} /></label>
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
        <p className="text-[15px] font-black text-[#0b2140] mb-3">업무별 기본 금액 <span className="text-[12px] text-gray-400 font-bold">계약서 만들기 창에 미리 채워지는 금액 (부가세 별도)</span></p>
        <div className="grid sm:grid-cols-2 gap-3">
          {ITEMS.map(([k, l]) => (
            <label key={k} className="flex items-center gap-2"><span className="flex-1 text-[13.5px] font-semibold text-[#0b2140]">{l}</span>
              <input className={inp + ' w-40 text-right tabular-nums'} inputMode="numeric" value={(st.itemAmounts[k] || 0).toLocaleString('ko-KR')}
                onChange={e => setSt({ ...st, itemAmounts: { ...st.itemAmounts, [k]: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0 } })} />
              <span className="text-[12px] text-gray-400">원</span></label>
          ))}
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-[15px] font-black text-[#0b2140]">본문 문구 수정 <span className="text-[12px] text-gray-400 font-bold">고친 문단 {edited}개</span></p>
          <div className="flex gap-2">
            {([['fee', '수수료 있는 계약서'], ['nofee', '월정기(수수료 없음)']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setKind(k)} className={`px-3.5 py-1.5 rounded-full text-[13px] font-bold border ${kind === k ? 'bg-[#0b2140] text-white border-[#0b2140]' : 'bg-white text-gray-600 border-gray-200'}`}>{l}</button>
            ))}
          </div>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="문구 검색 (예: 위약금, 특약)" className={inp + ' mb-3'} />
        <p className="text-[12.5px] text-gray-500 mb-3">금액·업체명 같은 자리는 계약서를 만들 때 자동으로 채워지니, 여기서는 고정 문구만 고치세요. 글자모양(굵기·크기)은 기본 서식 그대로 유지됩니다.</p>
        <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
          {list.map((orig, i) => {
            const cur = ov[orig] ?? orig
            const changed = ov[orig] != null && ov[orig] !== orig
            return (
              <div key={i} className={`rounded-2xl border p-2.5 ${changed ? 'border-[#b8995a] bg-[#fffaf0]' : 'border-gray-100'}`}>
                <textarea value={cur} rows={Math.min(6, Math.max(1, Math.ceil(cur.length / 60)))}
                  onChange={e => setSt({ ...st, textOverrides: { ...st.textOverrides, [kind]: { ...ov, [orig]: e.target.value } } })}
                  className="w-full text-[13.5px] text-[#0b2140] bg-transparent outline-none resize-y" />
                {changed && <button onClick={() => { const n = { ...ov }; delete n[orig]; setSt({ ...st, textOverrides: { ...st.textOverrides, [kind]: n } }) }} className="text-[12px] font-bold text-[#b3261e]">원래대로</button>}
              </div>
            )
          })}
          {list.length === 0 && <p className="text-center text-sm text-gray-300 py-6">해당하는 문구가 없습니다</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 sticky bottom-3">
        <button onClick={save} disabled={saving} className="px-8 py-3 rounded-full text-[14px] font-bold text-white bg-gradient-to-r from-[#0b2140] to-[#4a5a9a] shadow-lg disabled:opacity-50">{saving ? '저장 중…' : '저장하기'}</button>
        {msg && <span className="text-[13px] font-bold text-emerald-700 bg-white/90 px-3 py-1.5 rounded-full">{msg}</span>}
      </div>
    </div>
  )
}
