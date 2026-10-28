'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// 대표 전용 — 규정·서식: 서식·문서 보관함 + 정관·규정
interface DocFile { path: string; name: string; size: number; kind: string; version: number; uploadedAt: string; uploadedBy: string }
interface LibDoc { id: string; title: string; team: string; category: string; desc: string; text?: string; files: DocFile[]; history: DocFile[]; createdAt: string; updatedAt: string; updatedBy: string }
type Block = { t: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'note'; text: string } | { t: 'table'; rows: string[][] }
interface Rules { title: string; subtitle?: string; blocks: Block[]; version: number; updatedAt: string; updatedBy: string; note?: string }

const BUCKET = 'company-docs'
const fmtSize = (n: number) => (n > 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB')
const fmtDate = (s: string) => (s ? new Date(s).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' }) : '')
const kindOf = (name: string) => (name.split('.').pop() || '').toLowerCase()
const inp = 'w-full border-[1.5px] border-gray-200 rounded-xl px-3 py-2 text-[14px] text-[#0b2140] bg-white outline-none focus:border-[#b8995a]'

async function post(url: string, body: any) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || '요청에 실패했습니다')
  return j
}
async function uploadFile(file: File, url = '/api/company-docs'): Promise<DocFile> {
  const j = await post(url, { action: 'upload-url', filename: file.name })
  const up = await supabase.storage.from(BUCKET).uploadToSignedUrl(j.path, j.token, file)
  if (up.error) throw new Error(up.error.message)
  return { path: j.path, name: file.name, size: file.size, kind: kindOf(file.name), version: 1, uploadedAt: new Date().toISOString(), uploadedBy: '' }
}
async function openFile(f: DocFile, download: boolean) {
  const j = await post('/api/company-docs', { action: 'sign', path: f.path, download, name: f.name })
  if (download) { const a = document.createElement('a'); a.href = j.url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove() }
  else window.open(j.url, '_blank')
}

export default function CompanyRulesTab() {
  const [sub, setSub] = useState<'docs' | 'rules'>('docs')
  return (
    <div>
      <div className="flex gap-2 mb-5 border-b border-gray-100 pb-3">
        {([['docs', '서식·문서 보관함'], ['rules', '정관·규정']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} className={`px-5 py-2 rounded-full text-[14px] font-bold ${sub === k ? 'bg-[#0b2140] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'}`}>{l}</button>
        ))}
      </div>
      {sub === 'docs' ? <DocLibrary /> : <RulesViewer />}
    </div>
  )
}

// ───────────────────────── 서식·문서 보관함 ─────────────────────────
function DocLibrary() {
  const [docs, setDocs] = useState<LibDoc[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState('전체')
  const [cat, setCat] = useState('전체')
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<LibDoc> | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const searchRef = useRef<HTMLInputElement>(null)
  const wrap = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const j = await fetch('/api/company-docs', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
    if (j?.docs) { setDocs(j.docs); setCats(j.categories || []); setTeams(j.teams || []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  // Ctrl+F 는 이 화면의 검색칸으로
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && wrap.current?.offsetParent) { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  const list = useMemo(() => docs.filter(d =>
    (team === '전체' || d.team === team) && (cat === '전체' || d.category === cat) &&
    (!q.trim() || `${d.title} ${d.desc} ${d.category} ${d.team} ${d.files.map(f => f.name).join(' ')} ${d.text || ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [docs, team, cat, q])

  async function saveDoc(d: Partial<LibDoc>) {
    await post('/api/company-docs', { action: 'save', doc: { files: [], history: [], desc: '', ...d } })
    await load()
  }
  async function attach(d: LibDoc, fileList: FileList | null, mode: 'replace' | 'add') {
    if (!fileList?.length) return
    setBusy(d.id); setMsg('')
    try {
      const ups: DocFile[] = []
      for (const f of Array.from(fileList)) ups.push(await uploadFile(f))
      const maxV = Math.max(0, ...[...d.files, ...d.history].map(f => f.version || 1))
      const stamped = ups.map(u => ({ ...u, version: mode === 'replace' ? maxV + 1 : 1 }))
      const files = mode === 'replace' ? stamped : [...d.files, ...stamped]
      const history = mode === 'replace' ? [...d.files, ...d.history] : d.history
      await saveDoc({ ...d, files, history })
      setMsg(`"${d.title}" 파일을 ${mode === 'replace' ? '교체' : '추가'}했습니다`)
    } catch (e: any) { setMsg('실패: ' + e.message) }
    setBusy('')
  }
  async function removeFile(d: LibDoc, f: DocFile) {
    if (!confirm(`"${f.name}" 파일을 목록에서 뺄까요?\n(이전 파일 이력으로 옮겨 보관합니다)`)) return
    await saveDoc({ ...d, files: d.files.filter(x => x.path !== f.path), history: [f, ...d.history] }); setMsg('파일을 뺐습니다')
  }
  // 출력: PDF 가 있으면 열어서 바로 인쇄할 수 있게, 없으면 파일을 내려받는다 (한글·워드는 해당 프로그램에서 출력)
  async function print(d: LibDoc) {
    const pdf = d.files.find(f => f.kind === 'pdf')
    if (pdf) return openFile(pdf, false)
    if (d.files[0]) { setMsg('PDF 가 없어 원본 파일을 내려받습니다. 한글·워드에서 열어 인쇄하세요 (파일 추가로 PDF 를 같이 올려 두면 바로 출력됩니다)'); return openFile(d.files[0], true) }
    setMsg('아직 올려진 파일이 없습니다')
  }
  const del = async (d: LibDoc) => { if (confirm(`"${d.title}" 문서를 삭제할까요? 올려 둔 파일도 함께 지워집니다.`)) { await post('/api/company-docs', { action: 'delete', id: d.id }); await load() } }

  if (loading) return <p className="text-sm text-gray-400 py-10 text-center">불러오는 중…</p>
  const chip = (on: boolean) => `px-3.5 py-1.5 rounded-full text-[13px] font-bold border transition-colors ${on ? 'bg-[#0b2140] text-white border-[#0b2140]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`

  return (
    <div ref={wrap} className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[22px] font-black text-[#0b2140]">서식·문서 보관함</h3>
          <p className="text-[13px] text-gray-500 mt-0.5">계약서, 교육자료, 사용법, 퇴사 서식까지 최종본을 여기에 두고 언제든 출력하고 내려받습니다. 파일을 교체해도 이전 파일은 이력에 남습니다.</p>
        </div>
        <button onClick={() => setEdit({ title: '', team: '공통', category: cats[0] || '기타', desc: '', files: [], history: [] })} className="px-5 py-2.5 rounded-full text-[14px] font-bold text-white bg-gradient-to-r from-[#0b2140] to-[#4a5a9a]">+ 새 문서 추가</button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 items-center"><span className="text-[12px] font-bold text-gray-400 w-10">팀</span>{['전체', ...teams].map(t => <button key={t} className={chip(team === t)} onClick={() => setTeam(t)}>{t}</button>)}</div>
        <div className="flex flex-wrap gap-2 items-center"><span className="text-[12px] font-bold text-gray-400 w-10">항목</span>{['전체', ...cats].map(t => <button key={t} className={chip(cat === t)} onClick={() => setCat(t)}>{t}</button>)}</div>
        <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} placeholder="문서 검색 (Ctrl+F) — 제목·설명·파일명·문구" className={inp} />
      </div>
      {msg && <p className="text-[13px] font-bold text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">{msg}</p>}

      <div className="space-y-3">
        {list.map(d => (
          <div key={d.id} className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[17px] font-black text-[#0b2140]">{d.title}</p>
                  <span className="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700">{d.team}</span>
                  <span className="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700">{d.category}</span>
                  {!d.files.length && !d.text && <span className="text-[11.5px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-600">파일 없음</span>}
                </div>
                {d.desc && <p className="text-[13px] text-gray-500 mt-1 whitespace-pre-wrap">{d.desc}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button onClick={() => print(d)} disabled={!d.files.length} className="px-4 py-2 rounded-full text-[13px] font-bold text-white bg-[#0b2140] disabled:opacity-30">🖨 출력</button>
                <label className={`px-4 py-2 rounded-full text-[13px] font-bold border cursor-pointer ${busy === d.id ? 'opacity-50' : 'border-[#b8995a] text-[#8a6d2b] hover:bg-[#fffaf0]'}`}>
                  {d.files.length ? '파일 교체' : '파일 올리기'}
                  <input type="file" multiple className="hidden" disabled={busy === d.id} onChange={e => { attach(d, e.target.files, 'replace'); e.target.value = '' }} />
                </label>
                <label className="px-3 py-2 rounded-full text-[13px] font-bold border border-gray-200 text-gray-600 cursor-pointer hover:bg-gray-50">+ 추가
                  <input type="file" multiple className="hidden" onChange={e => { attach(d, e.target.files, 'add'); e.target.value = '' }} />
                </label>
                <button onClick={() => setEdit(d)} className="px-3 py-2 rounded-full text-[13px] font-bold border border-gray-200 text-gray-600 hover:bg-gray-50">수정</button>
              </div>
            </div>

            {d.files.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {d.files.map(f => (
                  <span key={f.path} className="inline-flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 pl-3 pr-1.5 py-1.5 text-[12.5px] text-[#0b2140]">
                    <button onClick={() => openFile(f, true)} className="font-semibold hover:underline" title="내려받기">⬇ {f.name}</button>
                    <span className="text-gray-400">{fmtSize(f.size)} · {fmtDate(f.uploadedAt)}{f.version > 1 ? ` · v${f.version}` : ''}</span>
                    <button onClick={() => removeFile(d, f)} className="text-gray-300 hover:text-red-500 px-1" title="목록에서 빼기">✕</button>
                  </span>
                ))}
              </div>
            )}
            {d.text && (
              <div className="mt-3 rounded-2xl bg-[#fffaf0] border border-[#ecd9a6] p-3">
                <div className="flex items-center justify-between mb-1"><span className="text-[12px] font-bold text-[#8a6d2b]">복사해서 쓰는 문구</span>
                  <button onClick={() => { navigator.clipboard.writeText(d.text || ''); setMsg('문구를 복사했습니다') }} className="text-[12px] font-bold text-[#0b2140] px-3 py-1 rounded-full bg-white border border-gray-200">복사</button></div>
                <pre className="text-[13px] text-[#0b2140] whitespace-pre-wrap font-sans">{d.text}</pre>
              </div>
            )}
            {d.history.length > 0 && (
              <div className="mt-2">
                <button onClick={() => setOpen(o => ({ ...o, [d.id]: !o[d.id] }))} className="text-[12px] font-bold text-gray-400 hover:text-gray-600">이전 파일 {d.history.length}개 {open[d.id] ? '▲' : '▼'}</button>
                {open[d.id] && <div className="mt-1.5 flex flex-wrap gap-2">{d.history.map(f => <button key={f.path} onClick={() => openFile(f, true)} className="text-[12px] text-gray-500 bg-gray-50 rounded-lg px-2.5 py-1 hover:bg-gray-100">⬇ {f.name} <span className="text-gray-400">v{f.version} · {fmtDate(f.uploadedAt)}</span></button>)}</div>}
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <p className="text-center text-gray-300 text-sm py-10">조건에 맞는 문서가 없습니다</p>}
      </div>

      {edit && <DocEditor doc={edit} teams={teams} cats={cats} onClose={() => setEdit(null)} onSave={async d => { await saveDoc(d); setEdit(null) }} onDelete={edit.id ? async () => { await del(edit as LibDoc); setEdit(null) } : undefined} />}
    </div>
  )
}

function DocEditor({ doc, teams, cats, onClose, onSave, onDelete }: { doc: Partial<LibDoc>; teams: string[]; cats: string[]; onClose: () => void; onSave: (d: Partial<LibDoc>) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [d, setD] = useState<Partial<LibDoc>>(doc)
  const [newCat, setNewCat] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof LibDoc, v: any) => setD(p => ({ ...p, [k]: v }))
  async function go(files?: FileList | null) {
    if (!d.title?.trim()) { setErr('제목을 입력해 주세요'); return }
    setBusy(true); setErr('')
    try {
      let cur = d
      if (files?.length) { const ups: DocFile[] = []; for (const f of Array.from(files)) ups.push(await uploadFile(f)); cur = { ...d, files: [...(d.files || []), ...ups] } }
      await onSave({ ...cur, category: newCat.trim() || cur.category })
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-3" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 space-y-3">
        <p className="text-[18px] font-black text-[#0b2140]">{d.id ? '문서 수정' : '새 문서 추가'}</p>
        <label className="block"><span className="text-[12px] font-semibold text-gray-500">제목</span><input className={inp} value={d.title || ''} onChange={e => set('title', e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-[12px] font-semibold text-gray-500">팀</span><select className={inp} value={d.team} onChange={e => set('team', e.target.value)}>{teams.map(t => <option key={t}>{t}</option>)}</select></label>
          <label className="block"><span className="text-[12px] font-semibold text-gray-500">항목</span><select className={inp} value={d.category} onChange={e => set('category', e.target.value)}>{cats.map(t => <option key={t}>{t}</option>)}</select></label>
        </div>
        <label className="block"><span className="text-[12px] font-semibold text-gray-500">새 항목 이름 <span className="font-normal text-gray-400">(없는 항목이면 여기에 적으면 만들어집니다)</span></span><input className={inp} value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="예) 세무" /></label>
        <label className="block"><span className="text-[12px] font-semibold text-gray-500">설명</span><textarea className={inp + ' resize-none'} rows={2} value={d.desc || ''} onChange={e => set('desc', e.target.value)} /></label>
        <label className="block"><span className="text-[12px] font-semibold text-gray-500">복사해서 쓰는 문구 <span className="font-normal text-gray-400">(카톡 통지 문구 등 · 선택)</span></span><textarea className={inp + ' resize-none'} rows={3} value={d.text || ''} onChange={e => set('text', e.target.value)} /></label>
        {!d.id && <label className="block"><span className="text-[12px] font-semibold text-gray-500">파일 올리기 <span className="font-normal text-gray-400">(한글·워드·PDF·엑셀·PPT 모두 가능)</span></span><input type="file" multiple onChange={e => go(e.target.files)} className="block w-full text-[13px] mt-1" disabled={busy} /></label>}
        {err && <p className="text-[13px] font-bold text-[#b3261e]">{err}</p>}
        <div className="flex gap-2 pt-1">
          {onDelete && <button onClick={onDelete} className="px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold">삭제</button>}
          <button onClick={onClose} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold">닫기</button>
          <button onClick={() => go()} disabled={busy} className="flex-1 bg-[#0b2140] text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50">{busy ? '저장 중…' : d.id ? '저장' : '문서만 추가 (파일은 나중에)'}</button>
        </div>
      </div>
    </div>
  )
}

// ───────────────────────── 정관·규정 ─────────────────────────
function RulesViewer() {
  const [rules, setRules] = useState<Rules | null>(null)
  const [hist, setHist] = useState<{ version: number; at: string; by: string; note: string; blocks: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [q, setQ] = useState('')
  const [cur, setCur] = useState(0)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [showHist, setShowHist] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const wrap = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const j = await fetch('/api/company-rules', { cache: 'no-store' }).then(r => r.json()).catch(() => null)
    if (j) { setRules(j.rules); setHist(j.history || []); setBlocks(j.rules?.blocks || []) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && wrap.current?.offsetParent) { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select() } }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  const needle = q.trim().toLowerCase()
  const hl = (text: string): React.ReactNode => {
    if (!needle) return text
    const parts: React.ReactNode[] = []
    const low = text.toLowerCase(); let i = 0, k = 0
    for (;;) { const j = low.indexOf(needle, i); if (j < 0) break; if (j > i) parts.push(text.slice(i, j)); parts.push(<mark key={k++} data-hl="1" className="bg-yellow-200 rounded px-0.5">{text.slice(i + (j - i), j + needle.length)}</mark>); i = j + needle.length }
    parts.push(text.slice(i)); return parts
  }
  const matchCount = useMemo(() => (needle ? blocks.reduce((n, b) => n + (b.t === 'table' ? b.rows.flat() : [b.text]).reduce((m, t) => m + (t.toLowerCase().split(needle).length - 1), 0), 0) : 0), [blocks, needle])
  useEffect(() => { setCur(0) }, [needle])
  useEffect(() => {
    const marks = Array.from(box.current?.querySelectorAll('mark[data-hl]') || []) as HTMLElement[]
    marks.forEach((m, i) => { m.className = (i === cur ? 'bg-orange-300 ring-2 ring-orange-400' : 'bg-yellow-200') + ' rounded px-0.5' })
    if (marks[cur]) marks[cur].scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [cur, needle, blocks, editing])
  const step = (d: number) => { if (matchCount) setCur(c => (c + d + matchCount) % matchCount) }

  async function save() {
    const note = prompt('이번 수정 내용을 짧게 적어 주세요 (이력에 남습니다)', '내용 수정')
    if (note === null) return
    setBusy(true)
    try {
      const r = await fetch('/api/company-rules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: { title: rules?.title, subtitle: rules?.subtitle, blocks }, note }) })
      const j = await r.json(); if (!r.ok) throw new Error(j.error)
      setEditing(false); setMsg(`v${j.rules.version}으로 저장했습니다`); await load()
    } catch (e: any) { setMsg('저장 실패: ' + e.message) } finally { setBusy(false) }
  }
  async function replaceFile(f: File) {
    if (!confirm(`"${f.name}" 내용으로 정관을 교체할까요?\n(지금 내용은 이력에 보관되어 언제든 되돌릴 수 있습니다)`)) return
    setBusy(true); setMsg('')
    try {
      const j = await post('/api/company-rules', { action: 'upload-url', filename: f.name })
      const up = await supabase.storage.from(BUCKET).uploadToSignedUrl(j.path, j.token, f); if (up.error) throw new Error(up.error.message)
      const r = await post('/api/company-rules', { action: 'import', path: j.path, filename: f.name })
      setMsg(`파일을 읽어 교체했습니다 (${r.count}개 항목, v${r.rules.version})`); await load()
    } catch (e: any) { setMsg('교체 실패: ' + e.message) } finally { setBusy(false) }
  }
  const dl = (format: 'hwpx' | 'pdf') => { window.location.href = `/api/company-rules/export?format=${format}` }
  const restore = async (version: number) => { if (!confirm(`v${version} 내용으로 되돌릴까요? (지금 내용도 이력에 남습니다)`)) return; await post('/api/company-rules', { action: 'restore', version }); setMsg(`v${version}로 되돌렸습니다`); await load() }

  const toc = useMemo(() => blocks.map((b, i) => ({ b, i })).filter(x => x.b.t === 'h1' || x.b.t === 'h2') as { b: { t: 'h1' | 'h2'; text: string }; i: number }[], [blocks])
  const upd = (i: number, v: Partial<Block>) => setBlocks(bs => bs.map((b, k) => (k === i ? ({ ...b, ...v } as Block) : b)))
  const mv = (i: number, d: number) => setBlocks(bs => { const n = [...bs]; const j = i + d; if (j < 0 || j >= n.length) return bs; [n[i], n[j]] = [n[j], n[i]]; return n })
  const add = (i: number, t: 'p' | 'h2') => setBlocks(bs => [...bs.slice(0, i + 1), { t, text: t === 'h2' ? '새 조문 제목' : '새 내용' }, ...bs.slice(i + 1)])

  if (loading) return <p className="text-sm text-gray-400 py-10 text-center">불러오는 중…</p>
  if (!rules) return <p className="text-sm text-gray-400 py-10 text-center">저장된 정관이 아직 없습니다. 아래 "파일 교체"로 한글·워드 파일을 올리면 만들어집니다.<br /><label className="inline-block mt-3 px-5 py-2.5 rounded-full text-[14px] font-bold text-white bg-[#0b2140] cursor-pointer">파일 올려서 만들기<input type="file" accept=".hwp,.hwpx,.docx,.txt" className="hidden" onChange={e => { if (e.target.files?.[0]) replaceFile(e.target.files[0]) }} /></label></p>

  return (
    <div ref={wrap} className="pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-[22px] font-black text-[#0b2140]">{rules.title}</h3>
          <p className="text-[12.5px] text-gray-500 mt-0.5">v{rules.version} · {new Date(rules.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {rules.updatedBy} · {rules.note}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {!editing ? (
            <>
              <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-full text-[13px] font-bold text-white bg-[#0b2140]">✏️ CRM에서 수정</button>
              <button onClick={() => dl('hwpx')} className="px-4 py-2 rounded-full text-[13px] font-bold border border-gray-300 text-[#0b2140] hover:bg-gray-50">한글 파일 받기</button>
              <button onClick={() => dl('pdf')} className="px-4 py-2 rounded-full text-[13px] font-bold border border-gray-300 text-[#0b2140] hover:bg-gray-50">🖨 PDF 출력</button>
              <label className={`px-4 py-2 rounded-full text-[13px] font-bold border cursor-pointer border-[#b8995a] text-[#8a6d2b] hover:bg-[#fffaf0] ${busy ? 'opacity-50' : ''}`}>한글 파일로 교체
                <input type="file" accept=".hwp,.hwpx,.docx,.txt" className="hidden" disabled={busy} onChange={e => { if (e.target.files?.[0]) replaceFile(e.target.files[0]); e.target.value = '' }} />
              </label>
              <button onClick={() => setShowHist(s => !s)} className="px-3 py-2 rounded-full text-[13px] font-bold text-gray-500 border border-gray-200">이력 {hist.length}</button>
            </>
          ) : (
            <>
              <button onClick={save} disabled={busy} className="px-5 py-2 rounded-full text-[13px] font-bold text-white bg-emerald-600 disabled:opacity-50">{busy ? '저장 중…' : '저장하기'}</button>
              <button onClick={() => { setEditing(false); setBlocks(rules.blocks) }} className="px-4 py-2 rounded-full text-[13px] font-bold border border-gray-300 text-gray-600">취소</button>
            </>
          )}
        </div>
      </div>
      {msg && <p className="text-[13px] font-bold text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2 mb-3">{msg}</p>}
      {showHist && (
        <div className="rounded-2xl border border-gray-100 bg-white p-3 mb-3 space-y-1">
          {hist.length === 0 && <p className="text-[13px] text-gray-400">이전 버전이 없습니다</p>}
          {hist.map(h => <div key={h.version} className="flex items-center gap-3 text-[13px]"><b className="text-[#0b2140]">v{h.version}</b><span className="text-gray-500">{new Date(h.at).toLocaleDateString('ko-KR')} · {h.by} · {h.note}</span><button onClick={() => restore(h.version)} className="ml-auto text-[12px] font-bold text-[#8a6d2b] hover:underline">이 버전으로 되돌리기</button></div>)}
        </div>
      )}

      {/* 검색 (Ctrl+F) */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur py-2 flex items-center gap-2">
        <input ref={searchRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') step(e.shiftKey ? -1 : 1) }} placeholder="정관 안에서 검색 (Ctrl+F · Enter 다음 · Shift+Enter 이전)" className={inp} />
        {needle && <><span className="text-[13px] font-bold text-gray-500 whitespace-nowrap">{matchCount ? `${cur + 1} / ${matchCount}` : '없음'}</span>
          <button onClick={() => step(-1)} className="px-2.5 py-2 rounded-lg border border-gray-200">▲</button><button onClick={() => step(1)} className="px-2.5 py-2 rounded-lg border border-gray-200">▼</button></>}
      </div>

      <div className="grid lg:grid-cols-[250px_1fr] gap-5 mt-2">
        <aside className="hidden lg:block">
          <div className="sticky top-16 max-h-[78vh] overflow-y-auto rounded-2xl border border-gray-100 bg-white p-3 text-[12.5px]">
            <p className="font-black text-[#0b2140] mb-2">목차</p>
            {toc.map(x => (
              <button key={x.i} onClick={() => document.getElementById('b-' + x.i)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`block w-full text-left py-1 hover:text-[#8a6d2b] ${x.b.t === 'h1' ? 'font-bold text-[#0b2140] mt-2' : 'pl-3 text-gray-500'}`}>{x.b.text}</button>
            ))}
          </div>
        </aside>

        <div ref={box} className="rounded-3xl bg-white border border-gray-100 shadow-sm p-6 md:p-8 min-w-0">
          {blocks.map((b, i) => {
            const tools = editing && (
              <span className="inline-flex gap-1 ml-2 align-middle opacity-60 hover:opacity-100">
                <button onClick={() => mv(i, -1)} className="text-[11px] px-1.5 border rounded">↑</button><button onClick={() => mv(i, 1)} className="text-[11px] px-1.5 border rounded">↓</button>
                <button onClick={() => add(i, 'p')} className="text-[11px] px-1.5 border rounded">+문단</button><button onClick={() => add(i, 'h2')} className="text-[11px] px-1.5 border rounded">+조문</button>
                <button onClick={() => setBlocks(bs => bs.filter((_, k) => k !== i))} className="text-[11px] px-1.5 border rounded text-red-500">삭제</button>
              </span>
            )
            if (b.t === 'table') {
              return (
                <div key={i} id={'b-' + i} className="my-3 overflow-x-auto">
                  <table className="w-full text-[13px] border-collapse">
                    <tbody>{b.rows.map((r, ri) => (
                      <tr key={ri}>{r.map((c, ci) => ri === 0
                        ? <th key={ci} className="border border-gray-300 bg-[#0b2140] text-white px-2.5 py-1.5 text-left font-bold">{editing ? <input className="w-full bg-transparent outline-none" value={c} onChange={e => upd(i, { rows: b.rows.map((rr, a) => rr.map((cc, d) => (a === ri && d === ci ? e.target.value : cc))) } as any)} /> : hl(c)}</th>
                        : <td key={ci} className={'border border-gray-300 px-2.5 py-1.5 align-top whitespace-pre-wrap ' + (ci === 0 ? 'bg-[#eef1f7] font-semibold' : '')}>{editing ? <textarea rows={Math.max(1, c.split('\n').length)} className="w-full bg-transparent outline-none resize-none" value={c} onChange={e => upd(i, { rows: b.rows.map((rr, a) => rr.map((cc, d) => (a === ri && d === ci ? e.target.value : cc))) } as any)} /> : hl(c)}</td>)}</tr>
                    ))}</tbody>
                  </table>{tools}
                </div>
              )
            }
            const cls = b.t === 'h1' ? 'text-[22px] font-black text-[#0b2140] mt-10 mb-3 pb-2 border-b-2 border-[#b8995a]'
              : b.t === 'h2' ? 'text-[16.5px] font-black text-[#0b2140] mt-6 mb-1.5 pl-3 border-l-4 border-[#b8995a]'
              : b.t === 'h3' ? 'text-[14.5px] font-bold text-[#0b2140] mt-4 mb-1'
              : b.t === 'note' ? 'text-[12px] text-gray-400 my-1'
              : b.t === 'li' ? 'text-[14px] text-[#1b2438] leading-relaxed my-0.5 pl-4' : 'text-[14px] text-[#1b2438] leading-relaxed my-1'
            return (
              <div key={i} id={'b-' + i} className={cls}>
                {editing ? <textarea rows={Math.max(1, Math.ceil(b.text.length / 70))} className={'w-full bg-yellow-50/60 rounded-lg px-2 py-1 outline-none resize-y border border-yellow-200 ' + (b.t.startsWith('h') ? 'font-bold' : '')} value={b.text} onChange={e => upd(i, { text: e.target.value })} /> : hl(b.text)}
                {tools}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
