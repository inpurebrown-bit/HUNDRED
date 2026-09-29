'use client'

import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import ReportDoc, { type ConsultingReport, type Item } from './ConsultingReportDoc'
export type { ConsultingReport }

type DocKind = 'file' | 'amount' | 'vehicle'
const DOC_TYPES: { key: string; label: string; hint?: string; kind: DocKind; amountLabel?: string }[] = [
  { key: 'biz_reg',      label: '사업자등록증', kind: 'file' },
  { key: 'id_card',      label: '신분증', kind: 'file' },
  { key: 'biz_lease',    label: '사업장 임대차계약서', kind: 'amount', amountLabel: '자가 시세 / 보증금·월세' },
  { key: 'home_lease',   label: '자택 임대차계약서',   kind: 'amount', amountLabel: '자가 시세 / 보증금·월세' },
  { key: 'vehicle',      label: '차량보유현황', kind: 'vehicle' },
  { key: 'tax_paid',     label: '국세·지방세 완납증명서', kind: 'file' },
  { key: 'sales_data',   label: '매출자료', hint: '부가세과세표준증명·재무제표 등 여러 파일 가능', kind: 'file' },
  { key: 'insurance',    label: '4대보험 가입자명부', kind: 'file' },
  { key: 'corp_reg',     label: '법인등기부등본', hint: '법인인 경우', kind: 'file' },
  { key: 'shareholders', label: '법인주주명부', hint: '법인인 경우', kind: 'file' },
  { key: 'etc',          label: '기타자료', hint: '추가로 참고할 자료', kind: 'file' },
]

interface DocFile { path: string; fileName: string }
interface DocState { files?: DocFile[]; none?: boolean; amount?: string; owned?: boolean; price?: string }

// 이전 단일파일 형식 호환
function normalizeDocs(raw: Record<string, any> | null): Record<string, DocState> {
  const out: Record<string, DocState> = {}
  for (const [k, v] of Object.entries(raw || {})) {
    const files: DocFile[] = Array.isArray(v?.files) ? v.files : (v?.path ? [{ path: v.path, fileName: v.fileName || '' }] : [])
    out[k] = { ...v, files }
  }
  return out
}
export default function ConsultingReportTab({ caseId, companyName, incall, credit, savedDocs, savedReport, onSave }: {
  caseId: string
  companyName: string
  incall: Record<string, any>
  credit: any
  savedDocs: Record<string, DocState> | null
  savedReport: ConsultingReport | null
  onSave: (patch: Record<string, any>) => void
}) {
  const [docs, setDocs] = useState<Record<string, DocState>>(() => normalizeDocs(savedDocs))
  const [dragKey, setDragKey] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)
  const [report, setReport] = useState<ConsultingReport | null>(savedReport)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<string>('')
  const [err, setErr] = useState('')
  const [view, setView] = useState(!!savedReport)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function persistDocs(next: Record<string, DocState>) {
    setDocs(next)
    onSave({ consulting_docs: next })
  }

  async function uploadMany(type: string, list: File[]) {
    const ok = list.filter(f => /\.(pdf|png|jpe?g|webp)$/i.test(f.name))
    if (ok.length < list.length) setErr('PDF·JPG·PNG 파일만 가능합니다 (그 외 파일은 제외됨)')
    else setErr('')
    if (!ok.length) return
    setBusy(type)
    try {
      const added: DocFile[] = []
      for (const file of ok) {
        const res = await fetch('/api/consulting-docs-upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, caseId, docType: type }),
        })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || '업로드 준비 실패')
        const up = await supabase.storage.from('consulting-docs').uploadToSignedUrl(j.path, j.token, file)
        if (up.error) throw new Error(up.error.message)
        added.push({ path: j.path, fileName: file.name })
      }
      const cur = docs[type] || {}
      persistDocs({ ...docs, [type]: { ...cur, none: false, files: [...(cur.files || []), ...added] } })
    } catch (e: any) {
      setErr('업로드 실패: ' + (e?.message || ''))
    } finally { setBusy('') }
  }

  function removeFile(type: string, idx: number) {
    const cur = docs[type]
    const f = cur?.files?.[idx]
    if (!cur || !f) return
    fetch('/api/consulting-docs-upload', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: f.path }),
    }).catch(() => {})
    persistDocs({ ...docs, [type]: { ...cur, files: (cur.files || []).filter((_, i) => i !== idx) } })
  }

  function patchDoc(type: string, patch: Partial<DocState>) {
    persistDocs({ ...docs, [type]: { ...(docs[type] || {}), ...patch } })
  }

  async function generate() {
    setBusy('generate'); setErr('')
    try {
      const payload = DOC_TYPES.flatMap(d =>
        docs[d.key]?.none ? [] : (docs[d.key]?.files || []).map(f => ({ type: d.key, label: d.label, path: f.path })))
      const absent = DOC_TYPES.filter(d => d.kind === 'file' && (docs[d.key]?.none || !(docs[d.key]?.files || []).length) && d.key !== 'etc').map(d => d.label)
      const extras = DOC_TYPES.flatMap(d => {
        const s = docs[d.key] || {}
        if (d.kind === 'amount' && s.amount) return [{ label: d.label, value: `${d.amountLabel}: ${s.amount}` }]
        if (d.kind === 'vehicle') return [{ label: d.label, value: s.owned ? `보유, 대략 가격: ${s.price || '미입력'}` : '미보유' }]
        return []
      })
      setBusy('research')
      let research: any = null
      try {
        const rr = await fetch('/api/consulting-report', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'research', incall }),
        })
        if (rr.ok) research = (await rr.json()).research
      } catch {}
      setBusy('generate')
      const res = await fetch('/api/consulting-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'generate', incall, credit, docs: payload, extras, absent, research }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '생성 실패')
      setReport(j.report); setView(true); setEditing(false)
      onSave({ consulting_report: j.report })
    } catch (e: any) {
      setErr(e?.message || '생성 실패')
    } finally { setBusy('') }
  }

  function saveReport() {
    if (!report) return
    onSave({ consulting_report: report })
    setEditing(false)
  }

  function patchItem(si: number, ii: number, patch: Partial<Item>) {
    if (!report) return
    const sections = report.sections.map((s, a) => a !== si ? s : {
      ...s, items: s.items.map((it, b) => b !== ii ? it : { ...it, ...patch }),
    })
    setReport({ ...report, sections })
  }
  function addItem(si: number) {
    if (!report) return
    setReport({ ...report, sections: report.sections.map((s, a) => a !== si ? s : { ...s, items: [...s.items, { heading: '새 항목', text: '' }] }) })
  }
  function delItem(si: number, ii: number) {
    if (!report) return
    setReport({ ...report, sections: report.sections.map((s, a) => a !== si ? s : { ...s, items: s.items.filter((_, b) => b !== ii) }) })
  }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const calc = () => setScale(Math.min(1, Math.max(0.3, (el.clientWidth - 16) / 794)))
    calc()
    const ro = new ResizeObserver(calc); ro.observe(el)
    return () => ro.disconnect()
  }, [view, editing, report])

  function printReport() {
    const host = pagesRef.current
    if (!host) return
    const safe = (companyName || '업체').replace(/[\/:*?"<>|]/g, '').trim()
    const title = '헌드레드컨설팅_' + safe + ' 보고서'
    const w = window.open('', '_blank')
    if (!w) { setErr('팝업이 차단되었습니다. 팝업 허용 후 다시 눌러주세요.'); return }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + title + '</title><style>' +
      '@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}' +
      '*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}' +
      '.crd-page{width:794px!important;height:1122px!important;overflow:hidden;page-break-after:always;break-after:page;position:relative}.crd-page:last-child{page-break-after:auto;break-after:auto}' +
      '</style></head><body>' + host.innerHTML + '</body></html>')
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 600)
  }

  const uploaded = DOC_TYPES.filter(d => (docs[d.key]?.files || []).length > 0).length
  const dateStr = report ? new Date(report.generatedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }) : ''

  return (
    <div className="space-y-4">

      {/* 서류 체크리스트 */}
      {!view && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-800">제출 서류 <span className="text-xs font-normal text-gray-400">({uploaded}/{DOC_TYPES.length} 업로드)</span></p>
            <p className="text-[10px] text-gray-400">파일을 각 항목에 끌어다 놓기 · PDF/JPG/PNG · 여러 개 가능</p>
          </div>
          <div className="space-y-1.5">
            {DOC_TYPES.map(d => {
              const st = docs[d.key] || {}
              const files = st.files || []
              const hasData = files.length > 0 || !!st.amount || (d.kind === 'vehicle' && st.owned !== undefined)
              const dropHere = dragKey === d.key
              return (
                <div key={d.key}
                  onDragOver={e => { e.preventDefault(); setDragKey(d.key) }}
                  onDragLeave={() => setDragKey('')}
                  onDrop={e => { e.preventDefault(); setDragKey(''); uploadMany(d.key, Array.from(e.dataTransfer.files || [])) }}
                  className={`text-xs border rounded-lg px-3 py-2 transition-colors ${dropHere ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${hasData ? 'bg-emerald-500' : st.none ? 'bg-gray-300' : 'bg-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-700">{d.label}</span>
                      {d.hint && <span className="text-[10px] text-gray-400 ml-1.5">{d.hint}</span>}
                      {st.none && !hasData && <span className="text-[10px] text-gray-400 ml-1.5">없음 — 없는 대로 진행</span>}
                    </div>
                    <input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden"
                      ref={el => { fileRefs.current[d.key] = el }}
                      onChange={e => { uploadMany(d.key, Array.from(e.target.files || [])); e.target.value = '' }} />
                    {busy === d.key ? <span className="text-[10px] text-indigo-500">업로드 중…</span> : (
                      <>
                        <button type="button" onClick={() => fileRefs.current[d.key]?.click()}
                          className="px-2 py-1 rounded bg-indigo-50 text-indigo-600 font-semibold hover:bg-indigo-100">
                          {files.length ? '+ 추가' : '업로드'}
                        </button>
                        {d.kind === 'file' && d.key !== 'etc' && !files.length && (
                          <button type="button" onClick={() => patchDoc(d.key, { none: !st.none })}
                            className="px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-gray-100">{st.none ? '없음 해제' : '없음'}</button>
                        )}
                      </>
                    )}
                  </div>

                  {d.kind === 'amount' && (
                    <div className="flex items-center gap-2 mt-1.5 pl-4">
                      <span className="text-[10px] text-gray-500 whitespace-nowrap">{d.amountLabel}</span>
                      <input value={st.amount || ''} onChange={e => patchDoc(d.key, { amount: e.target.value })}
                        placeholder="예) 자가 시세 5억 / 보증금 3천 월 100"
                        className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
                    </div>
                  )}

                  {d.kind === 'vehicle' && (
                    <div className="flex items-center gap-2 mt-1.5 pl-4">
                      <label className="flex items-center gap-1 text-[11px] text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={!!st.owned} onChange={e => patchDoc(d.key, { owned: e.target.checked })} />
                        차량 보유
                      </label>
                      {st.owned && (
                        <input value={st.price || ''} onChange={e => patchDoc(d.key, { price: e.target.value })}
                          placeholder="대략 가격 (예: 3,000만원)"
                          className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs" />
                      )}
                    </div>
                  )}

                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5 pl-4">
                      {files.map((f, i) => (
                        <span key={f.path} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 rounded px-2 py-0.5 text-[10px] max-w-[220px]">
                          <span className="truncate">{f.fileName}</span>
                          <button type="button" onClick={() => removeFile(d.key, i)} className="text-emerald-500 hover:text-red-500 font-bold">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">인콜일지·여신구분 탭에 입력된 내용도 자동으로 함께 분석됩니다.</p>
        </div>
      )}

      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-2 crp-noprint">
        <button type="button" disabled={!!busy} onClick={generate}
          className="px-4 py-2 rounded-lg bg-[#1B2A45] text-white text-xs font-bold disabled:opacity-50 hover:bg-[#25395f]">
          {busy === 'research' ? '웹 조사 중… (1/2)' : busy === 'generate' ? '보고서 작성 중… (2/2, 1분 내외)' : report ? '보고서 다시 생성' : 'AI 보고서 생성'}
        </button>
        {report && (
          <>
            <button type="button" onClick={() => setView(v => !v)}
              className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold">{view ? '서류 관리' : '보고서 보기'}</button>
            {view && (editing ? (
              <button type="button" onClick={saveReport} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">수정 저장</button>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="px-3 py-2 rounded-lg bg-violet-100 text-violet-700 text-xs font-semibold">편집</button>
            ))}
            {view && <button type="button" onClick={printReport} className="ml-auto px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold">PDF 출력</button>}
          </>
        )}
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>
      {report?.generatedAt && !view && <p className="text-[10px] text-gray-400">최근 생성: {dateStr}</p>}

      {/* 보고서 본문 */}
      {report && view && !editing && (
        <div ref={wrapRef} className="rounded-xl border border-gray-200 bg-slate-200 p-2 overflow-hidden">
          <div style={{ zoom: scale } as React.CSSProperties}>
            <div ref={pagesRef} style={{ display: 'grid', gap: 14, justifyContent: 'center' }}>
              <ReportDoc report={report} companyName={companyName} representative={incall.representative} />
            </div>
          </div>
        </div>
      )}

      {/* 편집 패널 */}
      {report && view && editing && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4 text-xs">
          <p className="text-[11px] text-gray-500">본문 텍스트를 수정한 뒤 &quot;수정 저장&quot;을 누르면 보고서에 반영됩니다. (그래프 수치는 &quot;보고서 다시 생성&quot;으로 갱신)</p>
          <div>
            <p className="font-bold text-gray-700 mb-1">종합진단 한 줄</p>
            <textarea value={report.headline} onChange={e => setReport({ ...report, headline: e.target.value })} rows={2} className="w-full border rounded p-1.5" />
            <p className="font-bold text-gray-700 mt-2 mb-1">종합 분석</p>
            <textarea value={report.summary || ''} onChange={e => setReport({ ...report, summary: e.target.value })} rows={6} className="w-full border rounded p-1.5" />
          </div>
          {report.sections.map((s, si) => (
            <div key={s.key}>
              <p className="font-bold text-[#1B2A45] mb-1">{s.title}</p>
              <div className="space-y-2">
                {s.items.map((it, ii) => (
                  <div key={ii} className="bg-gray-50 rounded-lg p-2">
                    <div className="flex gap-1">
                      <input value={it.heading} onChange={e => patchItem(si, ii, { heading: e.target.value })} className="flex-1 font-bold border rounded px-1.5 py-1" />
                      <button type="button" onClick={() => delItem(si, ii)} className="text-[10px] text-red-500 px-1.5">삭제</button>
                    </div>
                    <textarea value={it.text} onChange={e => patchItem(si, ii, { text: e.target.value })} rows={4} className="w-full border rounded p-1.5 mt-1" />
                  </div>
                ))}
                <button type="button" onClick={() => addItem(si)} className="text-[11px] text-indigo-600 font-semibold">+ 항목 추가</button>
              </div>
            </div>
          ))}
          <div>
            <p className="font-bold text-[#1B2A45] mb-1">로드맵 상세</p>
            {report.roadmap.map((rm, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-2 mb-1.5 space-y-1">
                <input value={rm.title} onChange={e => setReport({ ...report, roadmap: report.roadmap.map((x, k) => k === i ? { ...x, title: e.target.value } : x) })} className="w-full font-bold border rounded px-1.5 py-1" />
                <textarea value={rm.detail} onChange={e => setReport({ ...report, roadmap: report.roadmap.map((x, k) => k === i ? { ...x, detail: e.target.value } : x) })} rows={2} className="w-full border rounded p-1.5" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
