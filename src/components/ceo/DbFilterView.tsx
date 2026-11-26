'use client'

import React, { useMemo, useState } from 'react'
import { INDUSTRY_GROUPS, Cust, matchGroup, matchFree, revenueOf, entityOf, employeesOf, yearsOf, isSelfRejected, isContracted, companyName, industryText, fmtWon } from '@/lib/dbFilter'

const STATUS_LABEL: Record<string, string> = { lead: '고객DB', consulting: '고객DB', db010: '010DB', emotional: '감성톡', trash: '거절DB', refunded: '환불' }
const RESULTS = ['결정업체', '고민중', '재통화', '부재', '거절']

type Row = { c: Cust; why: string[]; rev: ReturnType<typeof revenueOf>; ent: string; emp: number | null; yrs: number | null }

const inp = 'border border-[#E8E2D4] rounded-lg px-2.5 py-1.5 text-sm bg-white'
const chip = (on: boolean) => 'px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ' + (on ? 'bg-[#1B2A45] text-white border-[#1B2A45]' : 'bg-white text-gray-600 border-[#E8E2D4] hover:border-[#1B2A45]/40')

export default function DbFilterView({ customers, onClose }: { customers: Cust[]; onClose: () => void }) {
  const [groups, setGroups] = useState<string[]>([])
  const [free, setFree] = useState('')
  const [withMemo, setWithMemo] = useState(false)
  const [revMin, setRevMin] = useState('')      // 억 단위
  const [revMax, setRevMax] = useState('')
  const [strict, setStrict] = useState(false)   // 범위 값은 하한 기준으로만
  const [revUnknown, setRevUnknown] = useState(false)
  const [entity, setEntity] = useState<'all' | '법인' | '개인'>('all')
  const [empMin, setEmpMin] = useState('')
  const [yrMin, setYrMin] = useState('')
  const [region, setRegion] = useState('')
  const [results, setResults] = useState<string[]>([])
  const [statuses, setStatuses] = useState<string[]>([])
  const [owner, setOwner] = useState('all')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(150)
  const [msg, setMsg] = useState('')

  // 기본 제외: 계약된 DB, 자체거절 DB
  const pool = useMemo(() => customers.filter(c => !isContracted(c) && !isSelfRejected(c)), [customers])
  const owners = useMemo(() => Array.from(new Set(pool.map(c => c.sales_user_name || c.details?.sales_user_name || '').filter(Boolean))), [pool])

  const rows = useMemo<Row[]>(() => {
    const words = free.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    const gs = INDUSTRY_GROUPS.filter(g => groups.includes(g.key))
    const minV = revMin !== '' ? parseFloat(revMin) * 1e8 : null
    const maxV = revMax !== '' ? parseFloat(revMax) * 1e8 : null
    const out: Row[] = []
    for (const c of pool) {
      const d = c.details || {}
      if (statuses.length && !statuses.includes(c.status === 'consulting' ? 'lead' : c.status)) continue
      if (results.length && !results.includes(String(d.closing_result || ''))) continue
      if (owner !== 'all' && (c.sales_user_name || d.sales_user_name || '') !== owner) continue
      if (region.trim() && !String(d.region || '').includes(region.trim())) continue
      const ent = entityOf(c)
      if (entity !== 'all' && ent !== entity) continue
      const emp = employeesOf(c), yrs = yearsOf(c)
      if (empMin !== '' && !(emp != null && emp >= parseInt(empMin, 10))) continue
      if (yrMin !== '' && !(yrs != null && yrs >= parseFloat(yrMin))) continue
      const rev = revenueOf(c)
      if (minV != null || maxV != null) {
        if (!rev.range) { if (!revUnknown) continue }
        else {
          const { lo, hi } = rev.range
          if (minV != null && !((strict ? lo : hi) >= minV)) continue
          if (maxV != null && !(lo <= maxV)) continue
        }
      }
      const why: string[] = []
      if (gs.length || words.length) {
        for (const g of gs) { const m = matchGroup(c, g, withMemo); if (m) why.push(`${g.label}(${m})`) }
        if (words.length) { const m = matchFree(c, words, withMemo); if (m) why.push(m) }
        if (!why.length) continue
      }
      out.push({ c, why, rev, ent, emp, yrs })
    }
    return out
  }, [pool, groups, free, withMemo, revMin, revMax, strict, revUnknown, entity, empMin, yrMin, region, results, statuses, owner])

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
  const picked = rows.filter(r => sel.has(r.c.id))
  const target = picked.length ? picked : rows
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  const copyPhones = async () => {
    const t = target.map(r => `${companyName(r.c) || r.c.name}\t${r.c.name}\t${r.c.phone}`).join('\n')
    try { await navigator.clipboard.writeText(t); flash(`${target.length}명 복사했습니다 (업체 · 이름 · 전화번호)`) } catch { flash('복사 실패') }
  }
  const csv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = ['업체', '이름', '전화번호', '업종', '법인/개인', '매출(원문)', '직원수', '업력', '지역', '담당 영업', 'DB', '결과', '걸린 이유']
    const lines = target.map(r => [companyName(r.c), r.c.name, r.c.phone, industryText(r.c), r.ent, r.rev.text, r.c.details?.employee_count ?? '', r.c.details?.years_in_business ?? '', r.c.details?.region ?? '', r.c.sales_user_name || r.c.details?.sales_user_name || '', STATUS_LABEL[r.c.status] || r.c.status, r.c.details?.closing_result ?? '', r.why.join(' / ')].map(esc).join(','))
    const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `DB필터_${new Date().toISOString().slice(0, 10)}_${target.length}명.csv`; a.click()
    flash(`${target.length}명 파일로 저장했습니다`)
  }
  const reset = () => { setGroups([]); setFree(''); setRevMin(''); setRevMax(''); setEntity('all'); setEmpMin(''); setYrMin(''); setRegion(''); setResults([]); setStatuses([]); setOwner('all'); setSel(new Set()) }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base">🎯 DB 필터 <span className="text-xs font-normal text-gray-500">· 계약된 DB와 자체거절 DB는 빼고, 전체 DB에서 조건에 맞는 사람만 뽑습니다</span></h3>
        <button onClick={onClose} className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-1 hover:bg-gray-50">← 고객 목록</button>
      </div>

      <div className="bg-white border border-[#E8E2D4] rounded-xl p-4 space-y-3">
        <div>
          <p className="text-xs font-bold text-gray-500 mb-1.5">업종 (여러 개 선택 가능 · 오타·변형·상호까지 함께 잡습니다)</p>
          <div className="flex flex-wrap gap-1.5">
            {INDUSTRY_GROUPS.map(g => <button key={g.key} type="button" className={chip(groups.includes(g.key))} onClick={() => toggle(groups, g.key, setGroups)}>{g.label}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <input className={inp + ' w-72'} placeholder="직접 입력 (쉼표로 여러 개) 예: 의류, 화장품" value={free} onChange={e => setFree(e.target.value)} />
            <label className="text-xs text-gray-600 flex items-center gap-1"><input type="checkbox" checked={withMemo} onChange={e => setWithMemo(e.target.checked)} />결과 메모에 적힌 말까지 검색</label>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <label className="text-xs text-gray-500">매출 최소 (억)
            <input className={inp + ' w-full mt-0.5'} inputMode="decimal" placeholder="예: 3" value={revMin} onChange={e => setRevMin(e.target.value)} /></label>
          <label className="text-xs text-gray-500">매출 최대 (억)
            <input className={inp + ' w-full mt-0.5'} inputMode="decimal" placeholder="비움" value={revMax} onChange={e => setRevMax(e.target.value)} /></label>
          <label className="text-xs text-gray-500">직원 최소 (명)
            <input className={inp + ' w-full mt-0.5'} inputMode="numeric" placeholder="비움" value={empMin} onChange={e => setEmpMin(e.target.value)} /></label>
          <label className="text-xs text-gray-500">업력 최소 (년)
            <input className={inp + ' w-full mt-0.5'} inputMode="numeric" placeholder="비움" value={yrMin} onChange={e => setYrMin(e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
          <label className="flex items-center gap-1"><input type="checkbox" checked={strict} onChange={e => setStrict(e.target.checked)} />매출이 "1-3억"처럼 범위면 <b>아래쪽 값</b> 기준으로 엄격하게</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={revUnknown} onChange={e => setRevUnknown(e.target.checked)} />매출을 모르는(x·빈칸) 사람도 포함</label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs font-bold text-gray-500">법인/개인</span>
          {(['all', '법인', '개인'] as const).map(v => <button key={v} type="button" className={chip(entity === v)} onClick={() => setEntity(v)}>{v === 'all' ? '전체' : v}</button>)}
          <input className={inp + ' w-32 ml-2'} placeholder="지역 (예: 경기)" value={region} onChange={e => setRegion(e.target.value)} />
          <select className={inp} value={owner} onChange={e => setOwner(e.target.value)}>
            <option value="all">담당 영업 전체</option>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-gray-500 mr-1">DB 종류</span>
          {[['lead', '고객DB'], ['db010', '010DB'], ['emotional', '감성톡'], ['trash', '거절DB']].map(([k, l]) => <button key={k} type="button" className={chip(statuses.includes(k))} onClick={() => toggle(statuses, k, setStatuses)}>{l}</button>)}
          <span className="text-xs font-bold text-gray-500 ml-3 mr-1">통화 결과</span>
          {RESULTS.map(r => <button key={r} type="button" className={chip(results.includes(r))} onClick={() => toggle(results, r, setResults)}>{r}</button>)}
          <button type="button" onClick={reset} className="ml-auto text-xs text-gray-500 underline">조건 초기화</button>
        </div>
        <p className="text-[11px] text-gray-400">선택을 안 한 항목은 "전체"로 봅니다. 인콜카드에 손으로 적은 값을 읽기 때문에, 맨 오른쪽 "걸린 이유"를 보고 이상한 것은 체크를 빼면 됩니다.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">조건에 맞는 사람 <span className="text-[#C5A258]">{rows.length}</span>명 <span className="text-xs font-normal text-gray-400">/ 대상 DB {pool.length}명</span></span>
        <span className="text-xs text-gray-500">{picked.length ? `체크한 ${picked.length}명 기준` : '체크하지 않으면 전체 기준'}</span>
        <button onClick={copyPhones} disabled={!target.length} className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1B2A45] text-white disabled:opacity-40">📋 연락처 복사</button>
        <button onClick={csv} disabled={!target.length} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white disabled:opacity-40">⬇ 엑셀(CSV) 저장</button>
      </div>
      {msg && <p className="text-xs text-emerald-700 font-bold">{msg}</p>}

      <div className="bg-white border border-[#E8E2D4] rounded-xl overflow-x-auto">
        <table className="w-full text-xs min-w-[900px]">
          <thead className="bg-[#F7F4EC] text-gray-600">
            <tr>
              <th className="p-2 w-8"><input type="checkbox" checked={rows.length > 0 && rows.slice(0, limit).every(r => sel.has(r.c.id))} onChange={e => setSel(e.target.checked ? new Set(rows.slice(0, limit).map(r => r.c.id)) : new Set())} /></th>
              <th className="p-2 text-left">업체</th><th className="p-2 text-left">이름 · 연락처</th><th className="p-2 text-left">업종</th>
              <th className="p-2">법인/개인</th><th className="p-2">매출</th><th className="p-2">직원</th><th className="p-2">담당</th><th className="p-2">DB · 결과</th><th className="p-2 text-left">걸린 이유</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map(r => (
              <tr key={r.c.id} className="border-t border-gray-100 hover:bg-[#FBFAF5]">
                <td className="p-2 text-center"><input type="checkbox" checked={sel.has(r.c.id)} onChange={() => setSel(s => { const n = new Set(s); n.has(r.c.id) ? n.delete(r.c.id) : n.add(r.c.id); return n })} /></td>
                <td className="p-2 font-bold text-[#1B2A45]">{companyName(r.c) || '—'}</td>
                <td className="p-2">{r.c.name}<br /><span className="text-gray-500">{r.c.phone}</span></td>
                <td className="p-2">{industryText(r.c) || '—'}</td>
                <td className="p-2 text-center">{r.ent || '—'}</td>
                <td className="p-2 text-center">{r.rev.text ? <>{r.rev.text}{r.rev.range && isFinite(r.rev.range.hi) && r.rev.range.hi !== r.rev.range.lo ? <span className="text-gray-400"><br />{fmtWon(r.rev.range.lo)}~{fmtWon(r.rev.range.hi)}</span> : null}</> : '—'}</td>
                <td className="p-2 text-center">{r.c.details?.employee_count || '—'}</td>
                <td className="p-2 text-center">{r.c.sales_user_name || r.c.details?.sales_user_name || '—'}</td>
                <td className="p-2 text-center">{STATUS_LABEL[r.c.status] || r.c.status}<br /><span className="text-gray-500">{r.c.details?.closing_result || ''}</span></td>
                <td className="p-2 text-gray-500">{r.why.join(' · ') || '조건만 일치'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} className="p-8 text-center text-gray-400">조건에 맞는 사람이 없습니다</td></tr>}
          </tbody>
        </table>
        {rows.length > limit && <button onClick={() => setLimit(l => l + 200)} className="w-full py-2 text-xs text-[#C5A258] font-bold border-t border-gray-100">더 보기 ({limit}/{rows.length})</button>}
      </div>
    </div>
  )
}
