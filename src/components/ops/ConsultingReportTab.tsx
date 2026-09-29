'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const DOC_TYPES: { key: string; label: string; hint?: string }[] = [
  { key: 'biz_reg',      label: '사업자등록증' },
  { key: 'id_card',      label: '신분증' },
  { key: 'biz_lease',    label: '사업장 임대차계약서', hint: '자가면 시세자료' },
  { key: 'home_lease',   label: '자택 임대차계약서',   hint: '자가면 시세자료' },
  { key: 'vehicle',      label: '차량보유현황' },
  { key: 'tax_paid',     label: '국세·지방세 완납증명서' },
  { key: 'sales_data',   label: '매출자료', hint: '부가세과세표준증명 또는 표준재무제표 3개년' },
  { key: 'insurance',    label: '4대보험 가입자명부' },
  { key: 'shareholders', label: '법인주주명부' },
]

interface DocState { path?: string; fileName?: string; none?: boolean }
interface Item { heading: string; text: string }
interface Section { key: string; title: string; items: Item[] }
export interface ConsultingReport {
  headline: string
  riskLevel: string
  riskScore: number
  metrics: { label: string; value: string }[]
  crossCheck: { item: string; incall: string; document: string; status: string }[]
  sections: Section[]
  roadmap: { period: string; title: string; detail: string }[]
  generatedAt: string
  missingDocs?: string[]
}

const RISK_COLOR: Record<string, string> = {
  '낮음': '#059669', '보통': '#d97706', '높음': '#dc2626',
}
const STATUS_STYLE: Record<string, string> = {
  '일치': 'background:#ecfdf5;color:#047857',
  '불일치': 'background:#fef2f2;color:#b91c1c',
  '확인필요': 'background:#fffbeb;color:#b45309',
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
  const [docs, setDocs] = useState<Record<string, DocState>>(savedDocs || {})
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

  async function upload(type: string, file: File) {
    setBusy(type); setErr('')
    try {
      const res = await fetch('/api/consulting-docs-upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, caseId, docType: type }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || '업로드 준비 실패')
      const up = await supabase.storage.from('consulting-docs').uploadToSignedUrl(j.path, j.token, file)
      if (up.error) throw new Error(up.error.message)
      if (docs[type]?.path) {
        fetch('/api/consulting-docs-upload', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: docs[type].path }),
        }).catch(() => {})
      }
      persistDocs({ ...docs, [type]: { path: j.path, fileName: file.name } })
    } catch (e: any) {
      setErr('업로드 실패: ' + (e?.message || ''))
    } finally { setBusy('') }
  }

  async function removeDoc(type: string) {
    const p = docs[type]?.path
    if (p) fetch('/api/consulting-docs-upload', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p }),
    }).catch(() => {})
    const next = { ...docs }; delete next[type]
    persistDocs(next)
  }

  async function generate() {
    setBusy('generate'); setErr('')
    try {
      const payload = DOC_TYPES.map(d => ({ type: d.key, label: d.label, path: docs[d.key]?.path || '' }))
        .filter(d => !docs[d.type]?.none)
      const res = await fetch('/api/consulting-report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incall, credit, docs: payload }),
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

  const uploaded = DOC_TYPES.filter(d => docs[d.key]?.path).length
  const dateStr = report ? new Date(report.generatedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }) : ''

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #consulting-report-print, #consulting-report-print * { visibility: visible !important; }
          #consulting-report-print { position: absolute; left: 0; top: 0; width: 100%; }
          .crp-noprint { display: none !important; }
          .crp-section { break-inside: avoid; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      {/* 서류 체크리스트 */}
      {!view && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-800">제출 서류 <span className="text-xs font-normal text-gray-400">({uploaded}/{DOC_TYPES.length} 업로드)</span></p>
            <p className="text-[10px] text-gray-400">PDF · JPG · PNG / 없는 서류는 &quot;없음&quot; 처리</p>
          </div>
          <div className="space-y-1.5">
            {DOC_TYPES.map(d => {
              const st = docs[d.key]
              return (
                <div key={d.key} className="flex items-center gap-2 text-xs border border-gray-100 rounded-lg px-3 py-2">
                  <span className={`w-2 h-2 rounded-full ${st?.path ? 'bg-emerald-500' : st?.none ? 'bg-gray-300' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-700">{d.label}</span>
                    {d.hint && <span className="text-[10px] text-gray-400 ml-1.5">{d.hint}</span>}
                    {st?.fileName && <p className="text-[10px] text-emerald-600 truncate">{st.fileName}</p>}
                    {st?.none && <p className="text-[10px] text-gray-400">서류 없음 — 없는 대로 진행</p>}
                  </div>
                  <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden"
                    ref={el => { fileRefs.current[d.key] = el }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) upload(d.key, f); e.target.value = '' }} />
                  {busy === d.key ? <span className="text-[10px] text-indigo-500">업로드 중…</span> : (
                    <>
                      <button type="button" onClick={() => fileRefs.current[d.key]?.click()}
                        className="px-2 py-1 rounded bg-indigo-50 text-indigo-600 font-semibold hover:bg-indigo-100">
                        {st?.path ? '교체' : '업로드'}
                      </button>
                      {st?.path && <button type="button" onClick={() => removeDoc(d.key)} className="px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-gray-100">삭제</button>}
                      {!st?.path && (
                        <button type="button" onClick={() => persistDocs({ ...docs, [d.key]: st?.none ? {} : { none: true } })}
                          className="px-2 py-1 rounded bg-gray-50 text-gray-500 hover:bg-gray-100">{st?.none ? '없음 해제' : '없음'}</button>
                      )}
                    </>
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
          {busy === 'generate' ? '분석·작성 중… (30초~1분)' : report ? '보고서 다시 생성' : 'AI 보고서 생성'}
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
            {view && <button type="button" onClick={() => window.print()} className="ml-auto px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold">PDF 출력</button>}
          </>
        )}
        {err && <span className="text-xs text-red-500">{err}</span>}
      </div>
      {report?.generatedAt && !view && <p className="text-[10px] text-gray-400">최근 생성: {dateStr}</p>}

      {/* 보고서 본문 */}
      {report && view && (
        <div id="consulting-report-print" className="bg-white border border-gray-200 rounded-xl overflow-hidden text-gray-800" style={{ fontFamily: 'Pretendard, "Malgun Gothic", sans-serif' }}>
          {/* 표지 */}
          <div style={{ background: 'linear-gradient(135deg,#1B2A45 0%,#2c4370 100%)', color: '#fff', padding: '28px 28px 24px' }}>
            <p style={{ fontSize: 10, letterSpacing: 3, opacity: .7 }}>BUSINESS CONSULTING PROPOSAL</p>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '6px 0 2px' }}>기업 컨설팅 제안 보고서</h1>
            <p style={{ fontSize: 13, opacity: .9 }}>{companyName}{incall.representative ? ` · 대표 ${incall.representative}` : ''}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 10, opacity: .75 }}>
              <span>작성일 {dateStr}</span><span>본 문서는 분석 시점 기준의 제안·계획이며 승인·선정을 보장하지 않습니다</span>
            </div>
          </div>

          <div style={{ padding: 22 }} className="space-y-5">
            {/* 요약 */}
            <div className="crp-section" style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
                <p style={{ fontSize: 10, color: '#6b7280' }}>종합 진단</p>
                {editing
                  ? <textarea value={report.headline} onChange={e => setReport({ ...report, headline: e.target.value })} className="w-full text-sm border rounded p-1 mt-1" rows={3} />
                  : <p style={{ fontSize: 14, fontWeight: 700, marginTop: 4, lineHeight: 1.5 }}>{report.headline}</p>}
              </div>
              <div style={{ width: 130, border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: '#6b7280' }}>재무 위험도</p>
                <p style={{ fontSize: 26, fontWeight: 800, color: RISK_COLOR[report.riskLevel] || '#374151' }}>{report.riskLevel}</p>
                <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 4 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <span key={n} style={{ width: 14, height: 6, borderRadius: 3, background: n <= report.riskScore ? (RISK_COLOR[report.riskLevel] || '#374151') : '#e5e7eb' }} />
                  ))}
                </div>
              </div>
            </div>

            <div className="crp-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
              {report.metrics.map((m, i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                  <p style={{ fontSize: 10, color: '#6b7280' }}>{m.label}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* 대조 */}
            {report.crossCheck?.length > 0 && (
              <div className="crp-section">
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1B2A45', borderLeft: '4px solid #1B2A45', paddingLeft: 8, marginBottom: 8 }}>인콜카드 · 제출서류 대조</h2>
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead><tr style={{ background: '#f1f5f9' }}>
                    {['항목', '인콜카드', '서류', '결과'].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #e5e7eb' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>{report.crossCheck.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb', fontWeight: 600 }}>{r.item}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>{r.incall}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>{r.document}</td>
                      <td style={{ padding: '6px 8px', border: '1px solid #e5e7eb' }}>
                        <span style={{ ...Object.fromEntries((STATUS_STYLE[r.status] || '').split(';').filter(Boolean).map(s => s.split(':'))), padding: '2px 8px', borderRadius: 10, fontWeight: 700, fontSize: 10 }}>{r.status}</span>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
                {!!report.missingDocs?.length && <p style={{ fontSize: 10, color: '#b45309', marginTop: 6 }}>미제출/미확인 서류: {report.missingDocs.join(', ')}</p>}
              </div>
            )}

            {/* 섹션 */}
            {report.sections.map((s, si) => (
              <div key={s.key} className="crp-section">
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1B2A45', borderLeft: '4px solid #1B2A45', paddingLeft: 8, marginBottom: 8 }}>{s.title}</h2>
                <div className="space-y-2.5">
                  {s.items.map((it, ii) => (
                    <div key={ii} style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
                      {editing ? (
                        <>
                          <div className="flex gap-1">
                            <input value={it.heading} onChange={e => patchItem(si, ii, { heading: e.target.value })} className="flex-1 text-xs font-bold border rounded px-1.5 py-1" />
                            <button type="button" onClick={() => delItem(si, ii)} className="text-[10px] text-red-500 px-1.5">삭제</button>
                          </div>
                          <textarea value={it.text} onChange={e => patchItem(si, ii, { text: e.target.value })} rows={4} className="w-full text-xs border rounded p-1.5 mt-1" />
                        </>
                      ) : (
                        <>
                          <p style={{ fontSize: 12, fontWeight: 700, color: '#1B2A45' }}>{it.heading}</p>
                          <p style={{ fontSize: 11.5, lineHeight: 1.7, marginTop: 3, whiteSpace: 'pre-wrap' }}>{it.text}</p>
                        </>
                      )}
                    </div>
                  ))}
                  {editing && <button type="button" onClick={() => addItem(si)} className="text-[11px] text-indigo-600 font-semibold crp-noprint">+ 항목 추가</button>}
                </div>
              </div>
            ))}

            {/* 로드맵 */}
            {report.roadmap?.length > 0 && (
              <div className="crp-section">
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#1B2A45', borderLeft: '4px solid #1B2A45', paddingLeft: 8, marginBottom: 10 }}>12개월 진행 로드맵 (제안)</h2>
                <div style={{ position: 'relative', paddingLeft: 18, borderLeft: '2px solid #cbd5e1', marginLeft: 6 }}>
                  {report.roadmap.map((r, i) => (
                    <div key={i} style={{ position: 'relative', marginBottom: 12 }}>
                      <span style={{ position: 'absolute', left: -25, top: 3, width: 12, height: 12, borderRadius: 6, background: '#1B2A45' }} />
                      {editing ? (
                        <div className="space-y-1">
                          <input value={r.period} onChange={e => setReport({ ...report, roadmap: report.roadmap.map((x, k) => k === i ? { ...x, period: e.target.value } : x) })} className="text-[10px] border rounded px-1 py-0.5 w-32" />
                          <input value={r.title} onChange={e => setReport({ ...report, roadmap: report.roadmap.map((x, k) => k === i ? { ...x, title: e.target.value } : x) })} className="text-xs font-bold border rounded px-1.5 py-0.5 w-full" />
                          <textarea value={r.detail} onChange={e => setReport({ ...report, roadmap: report.roadmap.map((x, k) => k === i ? { ...x, detail: e.target.value } : x) })} rows={2} className="text-xs border rounded p-1 w-full" />
                        </div>
                      ) : (
                        <>
                          <p style={{ fontSize: 10, color: '#6366f1', fontWeight: 700 }}>{r.period}</p>
                          <p style={{ fontSize: 12, fontWeight: 700 }}>{r.title}</p>
                          <p style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>{r.detail}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: 9, color: '#9ca3af', borderTop: '1px solid #e5e7eb', paddingTop: 8 }}>
              ※ 본 보고서는 고객이 제공한 자료와 작성일 시점의 정보를 바탕으로 한 분석 및 진행 제안이며, 정책자금 승인·인증 선정 등 결과를 보장하지 않습니다. 각 기관의 최신 공고 및 심사 결과에 따라 달라질 수 있습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
