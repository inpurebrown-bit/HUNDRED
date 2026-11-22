'use client'

// 관리팀 인콜카드 — '주황이 지시' 탭. 1~12번 문서와 재무제표 분석·보고서·사업계획서를 주황이에게 요청한다.
// 요청하면 작업 대기열에 등록 → 주황이가 인콜일지·여신구분·고객서류를 읽고 작성 → 결과물을 이 업체 고객서류에 올리고 주황이방에 "전송할까요?"로 확인한다.
import { useEffect, useState, useCallback } from 'react'
import { AGENT_KIND_LIST } from '@/lib/agentKinds'

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

interface Job { id: string; kind: string; status: string; room: string; error?: string; draft?: { message?: string; missing?: string[] }; created_at: string }
interface Output { kind: string; label: string; path: string; fileName: string; at: string }

export default function AgentCommandPanel({ caseId, companyName, room, onRoomChange, outputs = [] }: {
  caseId: string; companyName: string; room: string; onRoomChange: (v: string) => void; outputs?: Output[]
}) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

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

  async function request(kind: string) {
    setBusy(kind); setMsg('')
    try {
      const r = await fetch('/api/agent-jobs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, case_id: caseId, company: companyName, room }),
      })
      const j = await r.json()
      if (!r.ok) setMsg(j.error || '요청 실패')
      else await load()
    } catch { setMsg('네트워크 오류') }
    setBusy('')
  }
  async function act(id: string, action: 'cancel' | 'approve') {
    setBusy(id); setMsg('')
    try {
      const r = await fetch('/api/agent-jobs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
      const j = await r.json()
      if (!r.ok) setMsg(j.error || '처리 실패')
      else await load()
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

  const Btn = ({ k }: { k: typeof AGENT_KIND_LIST[number] }) => {
    const j = latest(k.key)
    const st = j ? STATUS[j.status] : null
    const running = !!j && ACTIVE.includes(j.status)
    return (
      <button type="button" disabled={busy === k.key || running || !room.trim()} onClick={() => request(k.key)} title={k.hint}
        className="text-left rounded-lg border border-orange-200 bg-white px-2.5 py-2 hover:bg-orange-50 disabled:opacity-60 disabled:hover:bg-white transition-colors">
        <p className="text-[11.5px] font-bold text-[#1B2A45] leading-tight">{k.no ? <span className="text-orange-500 mr-1">{k.no}.</span> : null}{k.label}</p>
        <div className="mt-1 flex items-center gap-1 flex-wrap">
          {k.fixed && <span className="text-[9px] font-bold px-1.5 py-[1px] rounded bg-gray-100 text-gray-500">고정 자료</span>}
          {st ? <span className={`text-[9px] font-bold px-1.5 py-[1px] rounded border ${st.cls}`}>{st.label}</span> : <span className="text-[9px] text-gray-400">작성 요청</span>}
        </div>
      </button>
    )
  }

  const front = AGENT_KIND_LIST.filter(k => k.where === 'crm')
  const secret = AGENT_KIND_LIST.filter(k => k.where === 'secret')

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-orange-200 bg-orange-50/50 px-3 py-2.5">
        <p className="text-xs font-bold text-orange-700 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-orange-500" />주황이에게 지시</p>
        <p className="text-[10.5px] text-gray-500 mt-1 leading-snug">버튼을 누르면 주황이가 이 업체의 인콜일지·여신구분·고객서류를 읽고 작성합니다. 만든 파일은 아래 &quot;만들어진 자료&quot;에 올라가고, 주황이방에서 &quot;전송할까요?&quot;로 확인합니다. 고객이 카톡방에 올린 서류는 주황이가 먼저 고객서류 탭에 올려 두고, 빠진 건 윤지 실장이 추가합니다.</p>
        <label className="text-[10px] text-gray-500 mt-2 mb-0.5 block font-medium">보낼 단톡방 이름 (카톡 방 제목과 똑같이)</label>
        <input value={room} onChange={e => onRoomChange(e.target.value)} placeholder="예) 헌드레드컨설팅 OOO대표님"
          className="w-full border border-orange-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400/50 bg-white" />
        {!room.trim() && <p className="text-[10px] text-rose-500 mt-1">단톡방 이름을 먼저 입력해야 요청할 수 있습니다.</p>}
      </div>

      <div>
        <p className="text-[11px] font-bold text-gray-600 mb-1.5">바로 작성 <span className="font-normal text-gray-400">(고객서류 탭 기능 · 비밀통로 불필요)</span></p>
        <div className="grid grid-cols-3 gap-1.5">{front.map(k => <Btn key={k.key} k={k} />)}</div>
      </div>

      <div>
        <p className="text-[11px] font-bold text-gray-600 mb-1.5">문서 1~12번 <span className="font-normal text-gray-400">(주황이가 비밀통로에서 작성)</span></p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">{secret.map(k => <Btn key={k.key} k={k} />)}</div>
      </div>

      {jobs.filter(j => j.status === 'draft_ready' || j.status === 'failed' || ACTIVE.includes(j.status)).map(j => {
        const label = AGENT_KIND_LIST.find(k => k.key === j.kind)?.label || j.kind
        const st = STATUS[j.status]
        return (
          <div key={j.id} className="rounded-lg bg-white border border-orange-100 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-[#1B2A45] truncate">{label} <span className={`ml-1 text-[9px] font-bold px-1.5 py-[1px] rounded border ${st?.cls}`}>{st?.label}</span></p>
              <div className="flex gap-1 shrink-0">
                {j.status === 'draft_ready' && (
                  <button type="button" disabled={busy === j.id} onClick={() => act(j.id, 'approve')}
                    className="text-[10px] font-bold bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded">전송 승인</button>
                )}
                {['requested', 'drafting', 'draft_ready', 'approved'].includes(j.status) && (
                  <button type="button" disabled={busy === j.id} onClick={() => act(j.id, 'cancel')}
                    className="text-[10px] font-semibold text-gray-400 hover:text-rose-500 px-1.5 py-1">취소</button>
                )}
              </div>
            </div>
            {j.error && <p className="text-[10px] text-rose-500 mt-0.5">{j.error}</p>}
            {j.draft?.message && <p className="text-[10.5px] text-gray-600 mt-1 whitespace-pre-line leading-snug">{j.draft.message}</p>}
            {!!j.draft?.missing?.length && <p className="text-[10.5px] text-amber-700 mt-1 leading-snug">⚠ 누락: {j.draft.missing.join(', ')} — 윤지 실장님이 고객서류 탭에 추가해 주세요.</p>}
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
    </div>
  )
}
