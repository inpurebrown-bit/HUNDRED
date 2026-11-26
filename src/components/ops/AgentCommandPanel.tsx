'use client'

// 관리팀 인콜카드 — '주황이 지시' 탭.
//  · 카톡방 이름은 적지 않는다. 주황이가 대표 이름·사업체명으로 방을 찾아 대화를 확인하고 알맞은 방을 고른다.
//  · 버튼을 누르면 확인창이 한 번 뜨고, 확인하면 주황이가 만들어서 바로 보낸다(CRM 에서 누른 요청은 승인 단계 없음).
//  · ① 계약 후 2·3·4일차 고정 자료는 CRM 이 매일 아침 자동으로 보낸다. ② 선택해서 만들기 ③ 기관 스크립트 ④ 자료 다 받은 걸로 간주하기
import { useEffect, useState, useCallback } from 'react'
import { AGENT_KIND_LIST, AUTO_KINDS, AUTO_COMMENTS, SCRIPT_KINDS, BATCH_KINDS, DIAG_STAGE_GROUPS } from '@/lib/agentKinds'

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

interface Job { id: string; updated_at?: string; kind: string; status: string; error?: string; draft?: { message?: string; missing?: string[]; source?: string }; created_at: string }
interface Output { kind: string; label: string; path: string; fileName: string; at: string }

const label = (k: string) => AGENT_KIND_LIST.find(x => x.key === k)?.label || k
const addDays = (ymd: string, n: number) => { const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(5, 10).replace('-', '/') }

export default function AgentCommandPanel({ caseId, companyName, contractDate = '', outputs = [], receivedAt = null, onReceived }: {
  caseId: string; companyName: string; contractDate?: string; outputs?: Output[]; receivedAt?: string | null; onReceived?: (at: string | null) => void
}) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [ask, setAsk] = useState<{ title: string; body: string; kinds: string[]; approveId?: string } | null>(null)

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

  async function run(kinds: string[], mode: 'send' | 'draft' = 'send') {
    setBusy(kinds.join(',')); setMsg(''); setAsk(null)
    try {
      const r = await fetch('/api/agent-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kinds, case_id: caseId, company: companyName, mode: mode === 'draft' ? 'draft' : undefined }),
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
  async function markReceived() {
    if (!window.confirm('고객 서류를 다 받았습니까?\n체크하면 주황이가 재무제표 분석·보고서·경영진단 통합 리포트·컨설팅 수행계획서를 만들어 보냅니다.')) return
    const at = new Date().toISOString()
    onReceived?.(at)
    await run(['finance', 'report', 'diag', 'plan'])
  }
  function unmarkReceived() {
    if (!window.confirm('자료 다 받음 체크를 풀까요?\n(이미 시작된 작업은 아래에서 중지하세요)')) return
    onReceived?.(null)
  }
  async function approve(id: string) {
    setBusy(id); setMsg('')
    try {
      const r = await fetch('/api/agent-jobs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'approve' }) })
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

  const confirmSend = (k: string, jobId: string) => setAsk({ title: label(k) + ' 전송', kinds: [k], approveId: jobId, body: '작성된 자료를 고객 카톡방에 지금 보냅니다.\n확인하면 주황이가 이 업체 카톡방을 찾아 보냅니다.' })
  const Chip = ({ k }: { k: string }) => {
    const j = latest(k); const st = j ? STATUS[j.status] : null
    return st ? <span className={`text-[9px] font-bold px-1.5 py-[1px] rounded border ${st.cls}`}>{st.label}</span> : null
  }
  // 한 줄 = 자료 1개: 진행 상황판(작성중 → 작성완료 → 전송중 → 전송완료) + [만들기] [전송] [중지]
  const STEPS = ['작성중', '작성완료', '전송중', '전송완료']
  const stepOf = (st?: string) => st === 'requested' || st === 'drafting' ? 0 : st === 'draft_ready' ? 1 : st === 'approved' || st === 'sending' ? 2 : st === 'sent' ? 3 : -1
  const Row = ({ k }: { k: string }) => {
    const j = latest(k), st = j?.status, step = stepOf(st)
    const no = AGENT_KIND_LIST.find(x => x.key === k)?.no
    const live = !!j && ACTIVE.includes(j.status)
    const bt = 'text-[10.5px] font-bold rounded-md px-2 py-1 border disabled:opacity-35 disabled:cursor-not-allowed'
    return (
      <div className="rounded-lg border border-orange-100 bg-white px-2.5 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11.5px] font-bold text-[#1B2A45] flex-1 min-w-[140px]">{no ? <span className="text-orange-500 mr-1">{no}.</span> : null}{label(k)}</p>
          <button type="button" disabled={!!busy || live} onClick={() => run([k], 'draft')} className={bt + ' border-sky-300 text-sky-700 hover:bg-sky-50'}>{st === 'sent' ? '다시 만들기' : '만들기'}</button>
          <button type="button" disabled={!!busy || st !== 'draft_ready'} onClick={() => j && confirmSend(k, j.id)} className={bt + ' border-emerald-300 text-emerald-700 hover:bg-emerald-50'}>전송</button>
          <button type="button" disabled={!!busy || !live} onClick={() => j && cancel(j.id)} className={bt + ' border-rose-300 text-rose-600 hover:bg-rose-50'}>중지</button>
        </div>
        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
          {STEPS.map((n, i) => (
            <span key={n} className={'text-[9.5px] font-bold px-1.5 py-[1px] rounded-full border ' + (i === step ? (step === 3 ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-orange-500 text-white border-orange-500') : i < step ? 'bg-orange-50 text-orange-500 border-orange-200' : 'bg-gray-50 text-gray-300 border-gray-100')}>{n}</span>
          ))}
          {st === 'failed' && <span className="text-[9.5px] font-bold text-rose-600 ml-1">실패 — 다시 만들기</span>}
          {st === 'canceled' && <span className="text-[9.5px] text-gray-400 ml-1">중지됨</span>}
          {j && <span className="text-[9.5px] text-gray-400 ml-auto">{String(j.updated_at || j.created_at || '').slice(5, 16).replace('T', ' ')}</span>}
        </div>
      </div>
    )
  }
  const Group = ({ g }: { g: { name: string; pct: number; kinds: string[] } }) => {
    const hit = g.kinds.map(k => jobs.find(j => j.kind === k && j.status === 'sent')).filter(Boolean) as Job[]
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-2 space-y-1.5">
        <div className="flex items-center gap-2 px-1 flex-wrap">
          <p className="text-[11.5px] font-black text-orange-700 flex-1">{g.name} <span className="font-normal text-gray-500">· 환불 정산 {g.pct}%</span></p>
          {hit.length > 0 ? <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-[1px]">교부됨 {String(hit[0].updated_at || '').slice(5, 10).replace('-', '/')} ({label(hit[0].kind)})</span> : <span className="text-[9.5px] text-gray-400">아직 교부 전</span>}
        </div>
        <p className="text-[10px] text-gray-500 px-1">아래 중 <b>하나만 보내도</b> 이 단계는 교부된 것으로 환불·정산에 자동 반영됩니다.</p>
        {g.kinds.map(k => <Row key={k} k={k} />)}
      </div>
    )
  }

  return (
    <div className="space-y-3.5">
      {/* ① 자료 다 받음 — 체크하면 재무제표 분석·보고서·통합 리포트·수행계획서를 한꺼번에 시작 */}
      <label className={'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer ' + (receivedAt ? 'border-emerald-300 bg-emerald-50' : 'border-orange-300 bg-orange-50')}>
        <input type="checkbox" className="w-4 h-4 accent-orange-500" checked={!!receivedAt} disabled={!!busy}
          onChange={e => e.target.checked ? markReceived() : unmarkReceived()} />
        <span className="text-[12.5px] font-black text-[#1B2A45]">자료 다 받음</span>
        <span className="text-[10.5px] text-gray-500 flex-1">
          {receivedAt ? `${new Date(receivedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} 체크 · 4종 작성 시작됨` : '체크하면 재무제표 분석·보고서·통합 리포트·수행계획서를 만들어 보냅니다'}
        </span>
      </label>

      {/* ② 자동 발송 */}
      <section>
        <p className="text-[11px] font-bold text-gray-700 mb-1.5">② 자동 발송 <span className="font-normal text-gray-400">· 계약 후 2·3·4일차에 하루 하나씩 알아서 나갑니다</span></p>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2 space-y-1.5">
          {AUTO_KINDS.map(a => {
            const j = latest(a.key)
            const when = contractDate ? `${addDays(contractDate, a.day - 1)} 오전` : `계약 ${a.day - 1}일 뒤`
            return (
              <div key={a.key} className="rounded-lg bg-white border border-emerald-100 px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 rounded px-1.5 py-0.5 shrink-0">{a.day}일차</span>
                  <span className="text-[11.5px] font-bold text-[#1B2A45] flex-1 min-w-0 truncate">{label(a.key)}</span>
                  {j ? <Chip k={a.key} /> : <span className="text-[10px] text-gray-400 shrink-0">{when} 예약</span>}
                  {(!j || ['failed', 'canceled'].includes(j.status)) && (
                    <button type="button" disabled={!!busy} onClick={() => confirmKinds(label(a.key) + ' 지금 보내기', [a.key], '자동 발송 일정을 기다리지 않고 지금 보냅니다.\n')}
                      className="text-[10px] font-semibold text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 shrink-0 hover:bg-emerald-50">지금 보내기</button>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-gray-500 whitespace-pre-line leading-snug border-l-2 border-emerald-200 pl-2">{AUTO_COMMENTS[a.key]}</p>
              </div>
            )
          })}
          <p className="text-[10px] text-gray-400 px-1">위 코멘트가 자료와 함께 카톡방에 올라갑니다. 따로 누를 필요가 없습니다.</p>
        </div>
      </section>

      {/* ③ 선택해서 만들기 — 환불 정산 3단계별 */}
      <section>
        <p className="text-[11px] font-bold text-gray-700 mb-1.5">③ 선택해서 만들기 <span className="font-normal text-gray-400">· 만들기 → 확인 → 전송 순서로 직접 조작합니다. 중지로 언제든 멈출 수 있습니다</span></p>
        <div className="space-y-2">{DIAG_STAGE_GROUPS.map(g => <Group key={g.name} g={g} />)}</div>
      </section>

      {/* ④ 기관 스크립트 */}
      <section>
        <p className="text-[11px] font-bold text-gray-700 mb-1.5">④ 기관 스크립트</p>
        <div className="space-y-1.5">{SCRIPT_KINDS.map(k => <Row key={k} k={k} />)}</div>
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
              <button type="button" disabled={!!busy} onClick={() => { if (ask.approveId) { const id = ask.approveId; setAsk(null); approve(id) } else run(ask.kinds) }} className="rounded-lg bg-orange-500 px-4 py-1.5 text-[12px] font-bold text-white hover:bg-orange-600 disabled:opacity-60">네, 보내세요</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
