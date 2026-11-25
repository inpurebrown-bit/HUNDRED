'use client'

// 관리팀 인콜카드 — '주황이 지시' 탭.
//  · 카톡방 이름은 적지 않는다. 주황이가 대표 이름·사업체명으로 방을 찾아 대화를 확인하고 알맞은 방을 고른다.
//  · 버튼을 누르면 확인창이 한 번 뜨고, 확인하면 주황이가 만들어서 바로 보낸다(CRM 에서 누른 요청은 승인 단계 없음).
//  · ① 계약 후 2·3·4일차 고정 자료는 CRM 이 매일 아침 자동으로 보낸다. ② 선택해서 만들기 ③ 기관 스크립트 ④ 자료 다 받은 걸로 간주하기
import { useEffect, useState, useCallback } from 'react'
import { AGENT_KIND_LIST, AUTO_KINDS, AUTO_FILES, PICK_KINDS, SCRIPT_KINDS, BATCH_KINDS } from '@/lib/agentKinds'

const STATUS: Record<string, { label: string; cls: string }> = {
  requested:   { label: '작성 요청됨', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  drafting:    { label: '작성 중',     cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  draft_ready: { label: '작성 완료 · 전송 확인 대기', cls: 'bg-violet-50 text-violet-700 border-violet-300' },
  approved:    { label: '전송 대기',   cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  sending:     { label: '전송 중',     cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  sent:        { label: '전송 완료',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed:      { label: '실패',        cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  canceled:    { label: '취소됨',      cls: 'bg-gray-50 text-gray-400 border-gray-200' },
}
const ACTIVE = ['requested', 'drafting', 'draft_ready', 'approved', 'sending']

interface Job { id: string; kind: string; status: string; error?: string; draft?: { message?: string; missing?: string[]; source?: string }; created_at: string }
interface Output { kind: string; label: string; path: string; fileName: string; at: string }

const label = (k: string) => AGENT_KIND_LIST.find(x => x.key === k)?.label || k
const addDays = (ymd: string, n: number) => { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(5, 10).replace('-', '/') }

export default function AgentCommandPanel({ caseId, companyName, contractDate = '', outputs = [] }: {
  caseId: string; companyName: string; contractDate?: string; outputs?: Output[]
}) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [ask, setAsk] = useState<{ title: string; body: string; kinds: string[] } | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/agent-jobs?case_id=${encodeURIComponent(caseId)}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) { setMsg(j.error || ''); return }
      setMsg(''); setJobs(j.jobs || [])
    } catch { /* 일시 오류는 무시 */ }
  }, [caseId])

  useEffect(() => {
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, 30_000)
    return () => clearInterval(t)
  }, [load])

  const latest = (kind: string) => jobs.find(j => j.kind === kind)
  const running = (kind: string) => { const j = latest(kind); return !!j && ACTIVE.includes(j.status) }

  async function run(kinds: string[]) {
    setBusy(kinds.join(',')); setMsg(''); setAsk(null)
    try {
      const r = await fetch('/api/agent-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kinds, case_id: caseId, company: companyName }),
      })
      const j = await r.json()
      if (!r.ok) setMsg(j.error || '요청 실패')
      else await load()
    } catch { setMsg('네트워크 오류') }
    setBusy('')
  }
  async function cancel(id: string) {
    setBusy(id); setMsg('')
    try {
      const r = await fetch('/api/agent-jobs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'cancel' }) })
      const j = await r.json()
      if (!r.ok) setMsg(j.error || '처리 실패'); else await load()
    } catch { setMsg('네트워크 오류') }
    setBusy('')
  }
  async function download(path: string, name: string) {
    try {
      const r = await fetch(`/api/agent-jobs/file?path=${encodeURIComponent(path)}&case_id=${encodeURIComponent(caseId)}`)
      const j = await r.json()
      if (j.url) { const a = document.createElement('a'); a.href = j.url; a.download = name; a.target = '_blank'; a.click() } else setMsg(j.error || '다운로드 실패')
    } catch { setMsg('네트워크 오류') }
  }

  const sendNote = '확인하면 주황이가 이 업체 카톡방을 찾아 만들어서 바로 보냅니다.'
  const confirmKinds = (title: string, kinds: string[], extra = '') => setAsk({ title, kinds, body: `${kinds.map(label).join(' · ')}\n${extra}${sendNote}` })

  const Chip = ({ k }: { k: string }) => {
    const j = latest(k); const st = j ? STATUS[j.status] : null
    return st ? <span className={`text-[9px] font-bold px-1.5 py-[1px] rounded border ${st.cls}`}>{st.label}</span> : null
  }
  const KindBtn = ({ k, sub }: { k: string; sub?: string }) => {
    const no = AGENT_KIND_LIST.find(x => x.key === k)?.no
    return (
      <button type="button" disabled={!!busy || running(k)} onClick={() => confirmKinds(label(k) + ' 보내기', [k])}
        className="text-left rounded-lg border border-orange-200 bg-white px-2.5 py-2 hover:bg-orange-50 disabled:opacity-60 disabled:hover:bg-white transition-colors">
        <p className="text-[11.5px] font-bold text-[#1B2A45] leading-tight">{no ? <span className="text-orange-500 mr-1">{no}.</span> : null}{label(k)}</p>
        <div className="mt-1 flex items-center gap-1 flex-wrap">{latest(k) ? <Chip k={k} /> : <span className="text-[9px] text-gray-400">{sub || '만들어서 보내기'}</span>}</div>
      </button>
    )
  }

  return (
    <div className="space-y-3.5">
      <div className="rounded-xl border border-orange-200 bg-orange-50/50 px-3 py-2.5">
        <p className="text-xs font-bold text-orange-700 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-orange-500" />주황이에게 지시</p>
        <p className="text-[10.5px] text-gray-500 mt-1 leading-snug">카톡방 이름은 적지 않아도 됩니다. 주황이가 대표 이름·사업체명으로 방을 찾아 대화를 확인한 뒤 알맞은 방에 보냅니다. 버튼을 누르면 <b>확인창이 한 번</b> 뜨고, 확인하면 만들어서 바로 보냅니다. 고객이 카톡방에 올린 서류는 주황이가 자동으로 고객서류 탭에 올리고 관리팀방에 알립니다.</p>
      </div>

      {/* ① 자동 발송 */}
      <section>
        <p className="text-[11px] font-bold text-gray-700 mb-1.5">① 자동 발송 <span className="font-normal text-gray-400">· 계약 후 2·3·4일차에 하루 하나씩 알아서 나갑니다</span></p>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2 space-y-1.5">
          {AUTO_KINDS.map(a => {
            const j = latest(a.key)
            const when = contractDate ? `${addDays(contractDate, a.day - 1)} 오전` : `계약 ${a.day - 1}일 뒤`
            return (
              <div key={a.key} className="flex items-center gap-2 rounded-lg bg-white border border-emerald-100 px-2.5 py-1.5">
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5 shrink-0">{a.day}일차</span>
                <span className="text-[11.5px] font-bold text-[#1B2A45] flex-1 min-w-0 truncate">{label(a.key)}</span>
                <a href={AUTO_FILES[a.key]} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-sky-700 border border-sky-200 rounded px-1.5 py-0.5 shrink-0 hover:bg-sky-50">📎 자료 보기</a>
                {j ? <Chip k={a.key} /> : <span className="text-[10px] text-gray-400 shrink-0">{when} 예약</span>}
                {(!j || ['failed', 'canceled'].includes(j.status)) && (
                  <button type="button" disabled={!!busy} onClick={() => confirmKinds(label(a.key) + ' 지금 보내기', [a.key], '자동 발송 일정을 기다리지 않고 지금 보냅니다.\n')}
                    className="text-[10px] font-semibold text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 shrink-0 hover:bg-emerald-50">지금 보내기</button>
                )}
              </div>
            )
          })}
          <p className="text-[10px] text-gray-400 px-1">&quot;대표님 사업하시면서 알아두셔야 할 정보를 보내드립니다&quot; 취지로 자동 발송됩니다. 따로 누를 필요가 없습니다.</p>
        </div>
      </section>

      {/* ② 선택해서 만들기 */}
      <section>
        <p className="text-[11px] font-bold text-gray-700 mb-1.5">② 선택해서 만들기</p>
        <div className="grid grid-cols-3 gap-1.5">{PICK_KINDS.map(k => <KindBtn key={k} k={k} />)}</div>
      </section>

      {/* ③ 기관 스크립트 */}
      <section>
        <p className="text-[11px] font-bold text-gray-700 mb-1.5">③ 기관 스크립트</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">{SCRIPT_KINDS.map(k => <KindBtn key={k} k={k} />)}</div>
      </section>

      {/* ④ 자료 다 받은 걸로 간주하기 */}
      <section>
        <p className="text-[11px] font-bold text-gray-700 mb-1.5">④ 자료 다 받은 걸로 간주하기</p>
        <button type="button" disabled={!!busy || BATCH_KINDS.every(running)}
          onClick={() => confirmKinds('자료 다 받은 걸로 간주하고 3종 보내기', BATCH_KINDS, '받은 자료로 최대한 만들고, 부족한 부분은 앞으로 이렇게 하면 좋아진다는 내용으로 채웁니다.\n')}
          className="w-full text-left rounded-xl border-2 border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-2.5 hover:from-orange-100 hover:to-amber-100 disabled:opacity-60 transition-colors">
          <p className="text-[12.5px] font-black text-orange-700">자료 다 받은 걸로 간주하기</p>
          <p className="text-[10.5px] text-gray-600 mt-0.5 leading-snug">{BATCH_KINDS.map(label).join(' · ')} 를 만들어서 한꺼번에 보냅니다. 세 문서는 내용이 비슷해서 함께 보냅니다.</p>
          <div className="mt-1 flex items-center gap-1 flex-wrap">{BATCH_KINDS.map(k => latest(k) && <span key={k} className="flex items-center gap-1 text-[9.5px] text-gray-500">{label(k)} <Chip k={k} /></span>)}</div>
        </button>
      </section>

      {/* 진행 중·실패 */}
      {jobs.filter(j => ACTIVE.includes(j.status) || j.status === 'failed').map(j => {
        const st = STATUS[j.status]
        return (
          <div key={j.id} className="rounded-lg bg-white border border-orange-100 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-[#1B2A45] truncate">{label(j.kind)} <span className={`ml-1 text-[9px] font-bold px-1.5 py-[1px] rounded border ${st?.cls}`}>{st?.label}</span></p>
              {['requested', 'drafting', 'draft_ready', 'approved'].includes(j.status) && (
                <button type="button" disabled={busy === j.id} onClick={() => cancel(j.id)} className="text-[10px] font-semibold text-gray-400 hover:text-rose-500 px-1.5 py-1 shrink-0">취소</button>
              )}
            </div>
            {j.error && <p className="text-[10px] text-rose-500 mt-0.5">{j.error}</p>}
            {j.draft?.message && <p className="text-[10.5px] text-gray-600 mt-1 whitespace-pre-line leading-snug">{j.draft.message}</p>}
            {!!j.draft?.missing?.length && <p className="text-[10.5px] text-amber-700 mt-1 leading-snug">⚠ 확인 필요: {j.draft.missing.join(', ')}</p>}
          </div>
        )
      })}

      <div>
        <p className="text-[11px] font-bold text-gray-600 mb-1.5">만들어진 자료 {outputs.length > 0 && <span className="font-normal text-gray-400">({outputs.length}개)</span>}</p>
        {outputs.length === 0 ? <p className="text-[11px] text-gray-400">아직 주황이가 만든 자료가 없습니다.</p> : (
          <ul className="space-y-1">
            {[...outputs].reverse().map((o, i) => (
              <li key={o.path + i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-2.5 py-1.5">
                <span className="text-[11px] text-[#1B2A45] truncate"><b>{o.label}</b> <span className="text-gray-400">· {o.fileName} · {String(o.at || '').slice(5, 16).replace('T', ' ')}</span></span>
                <button type="button" onClick={() => download(o.path, o.fileName)} className="text-[10px] font-bold text-orange-600 border border-orange-200 rounded px-2 py-0.5 shrink-0">열기</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {msg && <p className="text-[11px] text-rose-600 leading-snug">{msg}</p>}

      {/* 확인창 — 잘못 누르는 것을 막는다 */}
      {ask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4" onClick={() => setAsk(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-[13px] font-black text-[#1B2A45]">{ask.title}</p>
            <p className="mt-1 text-[11.5px] font-semibold text-gray-700">{companyName || '이 업체'}</p>
            <p className="mt-2 text-[11.5px] text-gray-600 leading-relaxed whitespace-pre-line">{ask.body}</p>
            <div className="mt-3.5 flex justify-end gap-2">
              <button type="button" onClick={() => setAsk(null)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-500 hover:bg-gray-50">취소</button>
              <button type="button" disabled={!!busy} onClick={() => run(ask.kinds)} className="rounded-lg bg-orange-500 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-orange-600 disabled:opacity-60">네, 보내세요</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
