'use client'

// 관리팀 인콜카드 — '주황에게 지시' 버튼. 누르면 작성 요청이 대기열에 등록되고, 작성·검토·전송 진행 상태가 버튼에 표시된다.
import { useEffect, useState, useCallback } from 'react'

const KINDS: { key: string; label: string }[] = [
  { key: 'consulting',    label: '컨설팅 자료' },
  { key: 'bizplan',       label: '사업계획서' },
  { key: 'roadmap',       label: '로드맵' },
  { key: 'script_kibo',   label: '기보 스크립트' },
  { key: 'script_jaedan', label: '재단 스크립트' },
  { key: 'script_shinbo', label: '신보 스크립트' },
  { key: 'finance',       label: '재무제표 분석' },
  { key: 'status',        label: '업체현황' },
]
const STATUS: Record<string, { label: string; cls: string }> = {
  requested:   { label: '작성 요청됨', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  drafting:    { label: '작성 중',     cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  draft_ready: { label: '검토 대기',   cls: 'bg-violet-50 text-violet-700 border-violet-300' },
  approved:    { label: '전송 대기',   cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  sending:     { label: '전송 중',     cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  sent:        { label: '전송 완료',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed:      { label: '실패',        cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  canceled:    { label: '취소됨',      cls: 'bg-gray-50 text-gray-400 border-gray-200' },
}
const ACTIVE = ['requested', 'drafting', 'draft_ready', 'approved', 'sending']

interface Job { id: string; kind: string; status: string; room: string; error?: string; created_at: string }

export default function AgentCommandPanel({ caseId, companyName, room, onRoomChange }: {
  caseId: string; companyName: string; room: string; onRoomChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
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
    if (!open) return
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, 60_000)
    return () => clearInterval(t)
  }, [open, load])

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

  const activeCount = jobs.filter(j => ACTIVE.includes(j.status)).length

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/50">
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="flex items-center gap-2 text-xs font-bold text-orange-700">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />주황에게 지시
          {activeCount > 0 && <span className="text-[10px] font-bold bg-orange-500 text-white px-1.5 rounded-full">{activeCount}</span>}
        </span>
        <span className="text-[10px] text-orange-500">{open ? '접기' : '열기'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5" onClick={e => e.stopPropagation()}>
          <div>
            <label className="text-[10px] text-gray-500 mb-0.5 block font-medium">보낼 단톡방 이름 (카톡 방 제목과 똑같이)</label>
            <input value={room} onChange={e => onRoomChange(e.target.value)} placeholder="예) 헌드레드컨설팅 OOO대표님"
              className="w-full border border-orange-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400/50 bg-white" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {KINDS.map(k => {
              const j = latest(k.key)
              const st = j ? STATUS[j.status] : null
              const running = !!j && ACTIVE.includes(j.status)
              return (
                <button key={k.key} type="button" disabled={busy === k.key || running || !room.trim()} onClick={() => request(k.key)}
                  className="text-left rounded-lg border border-orange-200 bg-white px-2 py-1.5 hover:bg-orange-50 disabled:opacity-60 disabled:hover:bg-white transition-colors">
                  <p className="text-[11px] font-bold text-[#1B2A45] leading-tight">{k.label}</p>
                  {st
                    ? <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-[1px] rounded border ${st.cls}`}>{st.label}</span>
                    : <span className="inline-block mt-1 text-[9px] text-gray-400">작성 요청</span>}
                </button>
              )
            })}
          </div>

          {jobs.filter(j => j.status === 'draft_ready' || j.status === 'failed' || ACTIVE.includes(j.status)).map(j => {
            const label = KINDS.find(k => k.key === j.kind)?.label || j.kind
            const st = STATUS[j.status]
            return (
              <div key={j.id} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-orange-100 px-2.5 py-1.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#1B2A45] truncate">{label} <span className={`ml-1 text-[9px] font-bold px-1.5 py-[1px] rounded border ${st?.cls}`}>{st?.label}</span></p>
                  {j.error && <p className="text-[10px] text-rose-500 truncate">{j.error}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  {j.status === 'draft_ready' && (
                    <button type="button" disabled={busy === j.id} onClick={() => act(j.id, 'approve')}
                      className="text-[10px] font-bold bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded">검토 후 전송 승인</button>
                  )}
                  {['requested', 'drafting', 'draft_ready', 'approved'].includes(j.status) && (
                    <button type="button" disabled={busy === j.id} onClick={() => act(j.id, 'cancel')}
                      className="text-[10px] font-semibold text-gray-400 hover:text-rose-500 px-1.5 py-1">취소</button>
                  )}
                </div>
              </div>
            )
          })}

          {msg && <p className="text-[11px] text-rose-600 leading-snug">{msg}</p>}
          <p className="text-[10px] text-gray-400 leading-snug">버튼을 누르면 주황이 작성합니다. 시험 단계에서는 작성이 끝나면 "검토 후 전송 승인"을 눌러야 카톡방에 전송됩니다.</p>
        </div>
      )}
    </div>
  )
}
