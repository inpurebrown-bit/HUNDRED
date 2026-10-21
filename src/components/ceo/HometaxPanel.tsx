'use client'

import { useEffect, useRef, useState } from 'react'
import { computeTax, type TaxData } from '@/lib/taxCalc'

interface Profile { userName: string; birth: string; phoneNo: string; telecom: string; authLevel: string; bizNo: string }
const EMPTY: Profile = { userName: '', birth: '', phoneNo: '', telecom: '0', authLevel: '1', bizNo: '' }
const AUTHS: [string, string][] = [['1', '카카오톡'], ['3', '삼성패스'], ['4', 'KB모바일'], ['5', '통신사(PASS)'], ['6', '네이버'], ['8', '토스']]

type Phase = 'idle' | 'requesting' | 'waiting' | 'loading' | 'done' | 'error'
const won = (v: any) => { const n = typeof v === 'number' ? Math.round(v) : parseInt(String(v ?? '').replace(/[^0-9-]/g, ''), 10); return isNaN(n) ? String(v ?? '') : n.toLocaleString('ko-KR') }

export default function HometaxPanel({ data, onFetched }: { data?: TaxData; onFetched?: () => void }) {
  const [info, setInfo] = useState<{ configured: boolean; env: string } | null>(null)
  const [profile, setProfile] = useState<Profile>(EMPTY)
  const [profileMsg, setProfileMsg] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [msg, setMsg] = useState('')
  const [result, setResult] = useState<any>(null)
  const [left, setLeft] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const ctx = useRef<{ sid: string; twoWay: any; range: any } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    fetch('/api/hometax/sync', { cache: 'no-store' }).then(r => r.json()).then(j => {
      setInfo({ configured: !!j.configured, env: j.env })
      if (j.profile) setProfile({ ...EMPTY, ...j.profile })
      if (j.last) setResult(j.last)
    }).catch(() => setMsg('연결 상태를 불러오지 못했습니다'))
  }, [])

  useEffect(() => {
    if (phase !== 'waiting') return
    setLeft(270)
    const id = setInterval(() => setLeft(s => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [phase])

  async function saveProfile() {
    const p = { ...profile, phoneNo: profile.phoneNo.replace(/[^0-9]/g, ''), birth: profile.birth.replace(/[^0-9]/g, ''), bizNo: profile.bizNo.replace(/[^0-9]/g, '') }
    const r = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _key: 'codef_profile', ...p }) })
    setProfile(p)
    setProfileMsg(r.ok ? '저장했습니다' : '저장 실패')
    setTimeout(() => setProfileMsg(''), 2500)
  }

  async function call(body: any) {
    const ac = new AbortController()
    abortRef.current = ac
    const r = await fetch('/api/hometax/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ac.signal })
    return r.json()
  }
  function cancel() {
    abortRef.current?.abort()
    ctx.current = null
    setPhase('idle'); setMsg('취소했습니다')
  }
  async function start() {
    setPhase('requesting'); setMsg('')
    try {
      const j = await call({ action: 'start' })
      handle(j)
    } catch (e: any) { if (e?.name !== 'AbortError') { setPhase('error'); setMsg('요청에 실패했습니다') } }
  }
  async function confirm() {
    if (!ctx.current) return
    setPhase('loading'); setMsg('홈택스에서 신고 내역을 가져오는 중입니다. 최대 1분 걸릴 수 있어요…')
    try {
      const j = await call({ action: 'confirm', sid: ctx.current.sid, twoWay: ctx.current.twoWay, range: ctx.current.range })
      handle(j)
    } catch (e: any) { if (e?.name !== 'AbortError') { setPhase('error'); setMsg('요청에 실패했습니다') } }
  }
  function handle(j: any) {
    if (j.status === 'need-auth') {
      ctx.current = { sid: j.sid, twoWay: j.twoWay, range: j.range }
      setPhase('waiting'); setMsg(j.message || '')
    } else if (j.status === 'done') {
      setResult(j); setPhase('done'); setMsg(''); onFetched?.()
    } else {
      setPhase('error'); setMsg([j.code, j.message, j.extra].filter(Boolean).join(' · ') || '알 수 없는 오류')
    }
  }

  const upd = (k: keyof Profile, v: string) => setProfile(p => ({ ...p, [k]: v }))
  const inCls = 'w-full text-[14px] font-bold text-[#0b2140] bg-white border-[1.5px] border-gray-200 focus:border-[#b8995a] rounded-xl px-3 py-2 outline-none'

  return (
    <div className="rounded-3xl bg-white border border-gray-100 shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[18px] font-black text-[#0b2140]">홈택스에서 불러오기 <span className="text-[13px] font-bold text-gray-400">CODEF 간편인증 · {info?.env === 'prod' ? '정식' : info?.env === 'sandbox' ? '샌드박스(테스트 데이터)' : '데모'}</span></p>
          <p className="text-[13px] text-gray-500 mt-0.5">신고된 부가세 신고서를 가져와 아래 표와 비교합니다. 표의 숫자는 자동으로 바꾸지 않습니다.</p>
        </div>
        {info && !info.configured && <span className="text-[12.5px] font-bold text-[#b3261e] bg-[#fde7e3] px-3 py-1.5 rounded-full">CODEF 키 미설정</span>}
      </div>

      {/* 연결 정보 */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[13.5px] font-bold text-[#0b2140]">연결 정보 {profile.userName ? `· ${profile.userName}` : '(입력 필요)'}</summary>
        <div className="grid sm:grid-cols-3 gap-3 mt-3">
          <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">이름</span><input className={inCls} value={profile.userName} onChange={e => upd('userName', e.target.value)} /></label>
          <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">생년월일 (YYYYMMDD)</span><input className={inCls} inputMode="numeric" value={profile.birth} onChange={e => upd('birth', e.target.value)} placeholder="19900101" /></label>
          <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">전화번호</span><input className={inCls} inputMode="numeric" value={profile.phoneNo} onChange={e => upd('phoneNo', e.target.value)} placeholder="01012345678" /></label>
          <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">간편인증 종류</span>
            <select className={inCls} value={profile.authLevel} onChange={e => upd('authLevel', e.target.value)}>{AUTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {profile.authLevel === '5' && (
            <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">통신사</span>
              <select className={inCls} value={profile.telecom} onChange={e => upd('telecom', e.target.value)}><option value="0">SKT(알뜰폰)</option><option value="1">KT(알뜰폰)</option><option value="2">LG U+(알뜰폰)</option></select></label>
          )}
          <label className="block"><span className="text-[12.5px] font-semibold text-gray-600">사업자번호 <span className="font-normal text-gray-400">(없으면 비움)</span></span><input className={inCls} inputMode="numeric" value={profile.bizNo} onChange={e => upd('bizNo', e.target.value)} /></label>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button onClick={saveProfile} className="px-4 py-2 rounded-full text-[13px] font-bold text-white bg-[#0b2140]">연결 정보 저장</button>
          <span className="text-[12.5px] text-gray-500">대표 계정에서만 보이며 CRM 설정에 저장됩니다.</span>
          {profileMsg && <span className="text-[12.5px] font-bold text-emerald-600">{profileMsg}</span>}
        </div>
      </details>

      {/* 실행 */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {(phase === 'idle' || phase === 'done' || phase === 'error') && (
          <button onClick={start} disabled={!info?.configured}
            className="px-6 py-2.5 rounded-full text-[14px] font-bold text-white bg-gradient-to-r from-[#0b2140] to-[#4a5a9a] disabled:opacity-40">
            {phase === 'done' ? '다시 불러오기' : '홈택스 불러오기'}
          </button>
        )}
        {phase === 'requesting' && (<><span className="text-[14px] font-bold text-[#0b2140]">인증을 요청하는 중…</span><button onClick={cancel} className="px-4 py-2 rounded-full text-[13px] font-bold text-gray-500 bg-white border border-gray-200">취소</button></>)}
        {phase === 'waiting' && (
          <div className="rounded-2xl bg-[#fffaf0] border-[1.5px] border-[#ecd9a6] px-4 py-3 flex flex-wrap items-center gap-3">
            <div>
              <p className="text-[14px] font-black text-[#0b2140]">{AUTHS.find(a => a[0] === profile.authLevel)?.[1] || '간편인증'} 앱에서 인증 요청을 승인하세요</p>
              <p className="text-[12.5px] text-gray-500">승인한 뒤 아래 버튼을 눌러 주세요 · 남은 시간 {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}{msg ? ' · ' + msg : ''}</p>
            </div>
            <button onClick={confirm} className="px-5 py-2 rounded-full text-[14px] font-bold text-white bg-[#0b2140]">승인했어요</button>
            <button onClick={() => { setPhase('idle'); setMsg('') }} className="px-4 py-2 rounded-full text-[13px] font-bold text-gray-500 bg-white border border-gray-200">취소</button>
          </div>
        )}
        {phase === 'loading' && (<><span className="text-[14px] font-bold text-[#0b2140]">{msg}</span><button onClick={cancel} className="px-4 py-2 rounded-full text-[13px] font-bold text-gray-500 bg-white border border-gray-200">취소</button></>)}
        {phase === 'error' && <span className="text-[13.5px] font-bold text-[#b3261e]">{msg}</span>}
        {phase === 'idle' && msg && <span className="text-[13px] font-semibold text-gray-500">{msg}</span>}
      </div>

      {/* 결과 */}
      {result?.rows && (
        <div className="mt-4">
          <p className="text-[13px] font-bold text-gray-500 mb-2">부가세과세표준증명 {result.count ?? result.rows.length}건 · {new Date(result.fetchedAt).toLocaleString('ko-KR')}{result.applied?.length ? ' · 세금 계산에 적용: ' + result.applied.join(', ') : ''}</p>
          {result.rows.length === 0 && <p className="text-[13.5px] text-gray-500">조회 기간에 발급된 증명이 없습니다. (아직 신고가 끝나지 않은 기간은 나오지 않습니다)</p>}
          {result.rows.length > 0 && (() => {
            const sheet = data ? computeTax({ ...data, reported: undefined }) : null
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead><tr className="text-gray-400 text-[12px]"><th className="text-left font-semibold py-1">과세기간</th><th className="text-right font-semibold">매출과세표준 계</th><th className="text-right font-semibold">면세분</th><th className="text-right font-semibold">납부할 세액</th><th className="text-right font-semibold">엑셀 표 합계</th><th className="text-right font-semibold">차이</th></tr></thead>
                  <tbody>{result.rows.map((r: any, i: number) => {
                    const half = r.start?.slice(4, 6) === '01' ? 'h1' : r.start?.slice(4, 6) === '07' ? 'h2' : ''
                    const mine = sheet && data && String(r.start).startsWith(String(data.year)) && half ? (sheet as any)[half].sales.supply : null
                    return (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-1.5">{r.start}~{r.end} <span className="text-gray-400">발급 {r.issuedAt}</span></td>
                        <td className="text-right tabular-nums font-bold">{won(r.total)}</td>
                        <td className="text-right tabular-nums text-gray-400">{won(r.exempt)}</td>
                        <td className="text-right tabular-nums">{won(r.tax)}</td>
                        <td className="text-right tabular-nums text-gray-500">{mine != null ? won(mine) : '-'}</td>
                        <td className={'text-right tabular-nums font-bold ' + (mine != null && Math.abs(r.total - mine) > 1000 ? 'text-[#b3261e]' : 'text-emerald-600')}>{mine != null ? (() => { const d = Math.round(r.total - mine); return d === 0 ? '0' : (d > 0 ? '+' : '') + won(d) })() : '-'}</td>
                      </tr>
                    )
                  })}</tbody>
                </table>
                <p className="text-[12px] text-gray-400 mt-2">홈택스에 신고된 반기별 과세표준(공급가액)입니다. 올해 해당 반기는 아래 세금 계산에 자동으로 적용되며, 엑셀 표의 카드·현금 칸은 바꾸지 않습니다. 매입은 이 증명서에 없어 엑셀 값을 씁니다.</p>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
