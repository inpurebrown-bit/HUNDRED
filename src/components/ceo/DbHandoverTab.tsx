'use client'

import { useEffect, useMemo, useState } from 'react'

// 퇴사·블락 직원이 들고 있던 DB(와 담당자 없는 DB)를 다른 영업팀원에게 나눠주는 탭 — 대표 전용
interface UserRow { id: string; name: string; role: string; blocked?: boolean }
const BUCKET_LABEL: Record<string, string> = { lead: '공가DB', consulting: '공가DB', db010: '직가DB', emotional: '감성톡' }
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10)

export default function DbHandoverTab({ onCount }: { onCount?: (n: number) => void }) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('all')
  const [bucket, setBucket] = useState('all')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [targets, setTargets] = useState<string[]>([])
  const [moveTo, setMoveTo] = useState<'keep' | 'lead' | 'db010'>('keep')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function load() {
    setLoading(true)
    const [u, c] = await Promise.all([fetch('/api/users').then(r => r.json()), fetch('/api/customers').then(r => r.json())])
    setUsers(u.users || []); setCustomers(c.customers || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const departed = useMemo(() => users.filter(u => u.role === 'sales' && u.blocked), [users])
  const departedIds = useMemo(() => new Set(departed.map(u => u.id)), [departed])
  const active = useMemo(() => users.filter(u => u.role === 'sales' && !u.blocked && !/tester/i.test(u.name)), [users])
  const nameOf = (id: string) => users.find(u => u.id === id)?.name

  // 분배 대상: 퇴사·블락한 직원 소유 또는 담당자 없는 DB (계약·거절 제외)
  const pool = useMemo(() => customers.filter(c => {
    if (['contracted', 'trash'].includes(c.status)) return false
    const owner = c.sales_user_id || c.owner_id || ''
    return !owner || departedIds.has(owner)
  }), [customers, departedIds])
  useEffect(() => { onCount?.(pool.length) }, [pool.length, onCount])

  const ownerKey = (c: any) => (c.sales_user_id || c.owner_id || '') || '__none'
  const list = pool.filter(c => {
    if (from !== 'all' && ownerKey(c) !== from) return false
    if (bucket !== 'all' && (BUCKET_LABEL[c.status] || c.status) !== bucket) return false
    if (q.trim()) {
      const t = q.trim().toLowerCase()
      if (!`${c.details?.company || ''} ${c.name || ''} ${c.phone || ''}`.toLowerCase().includes(t)) return false
    }
    return true
  })
  const counts = (key: string) => pool.filter(c => ownerKey(c) === key).length

  const toggle = (id: string) => setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleTarget = (id: string) => setTargets(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))
  const picked = list.filter(c => sel.has(c.id))

  async function run() {
    if (!picked.length || !targets.length) return
    const names = targets.map(t => nameOf(t)).join(', ')
    if (!confirm(`선택한 DB ${picked.length}건을 ${names}에게 ${targets.length > 1 ? '골고루 ' : ''}배정합니다.\n담당자가 바뀌고 이동 기록이 남습니다. 진행할까요?`)) return
    setBusy(true); setMsg('')
    let ok = 0, fail = 0
    for (let i = 0; i < picked.length; i++) {
      const c = picked[i]
      const tid = targets[i % targets.length]
      const tname = nameOf(tid) || ''
      const d = c.details || {}
      const body: any = {
        owner_id: tid,
        details: {
          sales_user_name: tname,
          ...(moveTo === 'db010' ? { db010_month: today().slice(0, 7), is_direct: true } : {}),
          transfer_history: [...(d.transfer_history || []), { from: d.sales_user_name || '—', to: tname, at: today(), by: 'CEO', reason: '퇴사자 DB 분배' }],
        },
      }
      if (moveTo !== 'keep') body.status = moveTo
      try { const r = await fetch('/api/customers/' + c.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); r.ok ? ok++ : fail++ } catch { fail++ }
    }
    setBusy(false); setSel(new Set())
    setMsg(`${ok}건 배정 완료${fail ? ` · ${fail}건 실패` : ''}`)
    await load()
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">불러오는 중…</p>

  const pill = (on: boolean) => `px-3 py-1.5 rounded-full text-[12.5px] font-bold border transition-colors ${on ? 'bg-[#0b2140] text-white border-[#0b2140]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[18px] font-black text-[#0b2140]">퇴사자 DB 분배</h3>
        <p className="text-[13px] text-gray-500 mt-0.5">퇴사·블락한 직원이 들고 있던 DB와 담당자 없는 DB를 다른 영업사원에게 나눠줍니다. 계약·자체거절 DB는 제외됩니다. 원래 메뉴(직가DB·공가DB·감성톡)는 그대로 유지할 수 있습니다.</p>
      </div>

      {pool.length === 0 ? (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-5 py-8 text-center text-[14px] font-bold text-emerald-700">분배할 DB가 없습니다 ✓</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button className={pill(from === 'all')} onClick={() => { setFrom('all'); setSel(new Set()) }}>전체 {pool.length}</button>
            {departed.filter(u => counts(u.id) > 0).map(u => <button key={u.id} className={pill(from === u.id)} onClick={() => { setFrom(u.id); setSel(new Set()) }}>{u.name} (퇴사) {counts(u.id)}</button>)}
            {counts('__none') > 0 && <button className={pill(from === '__none')} onClick={() => { setFrom('__none'); setSel(new Set()) }}>담당자 없음 {counts('__none')}</button>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {['all', '직가DB', '공가DB', '감성톡'].map(b => <button key={b} className={pill(bucket === b)} onClick={() => setBucket(b)}>{b === 'all' ? '모든 메뉴' : b}</button>)}
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="업체·대표·전화 검색" className="ml-auto border border-gray-200 rounded-full px-3 py-1.5 text-[13px] outline-none focus:border-[#b8995a]" />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 text-[12.5px] font-bold text-gray-500">
              <input type="checkbox" checked={list.length > 0 && picked.length === list.length} onChange={e => setSel(e.target.checked ? new Set(list.map(c => c.id)) : new Set())} />
              <span>{picked.length}건 선택 / {list.length}건</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
              {list.map(c => (
                <label key={c.id} className="flex items-center gap-3 px-4 py-2 text-[13px] cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="font-bold text-[#0b2140] min-w-0 truncate flex-1">{c.details?.company || c.company || c.name}</span>
                  <span className="text-gray-400 hidden sm:block">{c.name}</span>
                  <span className="text-gray-400 tabular-nums hidden sm:block">{c.phone}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">{BUCKET_LABEL[c.status] || c.status}</span>
                  <span className="text-[11px] text-gray-400 w-16 text-right">{nameOf(ownerKey(c)) || '미배정'}</span>
                </label>
              ))}
              {list.length === 0 && <p className="text-center text-sm text-gray-300 py-6">조건에 맞는 DB가 없습니다</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-[#ecd9a6] bg-[#fffaf0] p-4 space-y-3">
            <div>
              <p className="text-[13px] font-black text-[#0b2140] mb-1.5">받을 영업사원 <span className="font-normal text-gray-500">(여러 명을 고르면 골고루 나눕니다)</span></p>
              <div className="flex flex-wrap gap-2">{active.map(u => <button key={u.id} className={pill(targets.includes(u.id))} onClick={() => toggleTarget(u.id)}>{u.name}</button>)}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-black text-[#0b2140]">메뉴</span>
              {([['keep', '원래 메뉴 유지'], ['db010', '직가DB로'], ['lead', '공가DB로']] as const).map(([k, l]) => <button key={k} className={pill(moveTo === k)} onClick={() => setMoveTo(k)}>{l}</button>)}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={run} disabled={busy || !picked.length || !targets.length} className="px-6 py-2.5 rounded-full text-[14px] font-bold text-white bg-[#0b2140] disabled:opacity-40">{busy ? '배정 중…' : `선택한 ${picked.length}건 배정하기`}</button>
              {msg && <span className="text-[13px] font-bold text-emerald-700">{msg}</span>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
