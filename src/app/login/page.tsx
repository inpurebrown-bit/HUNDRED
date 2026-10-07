'use client'

import { useState, useRef, FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { getSession, signOut } from 'next-auth/react'
import AuthShell from '@/components/AuthShell'
import PinPad from '@/components/PinPad'
import { markPinVerified, clearPin } from '@/lib/pinStore'
import Link from 'next/link'

type Mode = 'login' | 'id' | 'pw'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // 찾기 요청
  const [hName, setHName] = useState('')
  const [hPhone, setHPhone] = useState('')
  const [hUser, setHUser] = useState('')
  const [hWebsite, setHWebsite] = useState('') // honeypot — 사람은 보지 못함
  const [hDone, setHDone] = useState('')
  const [step, setStep] = useState<'req' | 'code' | 'info' | 'done'>('req')
  const [hCode, setHCode] = useState('')
  const [hNew, setHNew] = useState('')
  const [hNew2, setHNew2] = useState('')
  const [foundId, setFoundId] = useState('')
  const openedAt = useRef(Date.now())
  // 로그인 성공 → 우측 폼이 사라지고 PIN 입력이 나타난다
  const [stage, setStage] = useState<'form' | 'pin'>('form')
  const [leaving, setLeaving] = useState(false)
  const [pinUser, setPinUser] = useState('')

  function finishPin() {
    markPinVerified(pinUser || 'unknown')
    router.push('/dashboard')
    router.refresh()
  }
  async function cancelPin() {
    clearPin()
    await signOut({ redirect: false })
    setStage('form'); setLeaving(false); setPassword(''); setError('')
  }

  function go(m: Mode) { setMode(m); setError(''); setHDone(''); setStep('req'); setHCode(''); setHNew(''); setHNew2(''); setFoundId(''); openedAt.current = Date.now() }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { username, password, redirect: false })
    setLoading(false)
    if (result?.error) {
      setError(result.error.includes('LOCKED')
        ? '로그인 시도가 너무 많아 15분간 잠겼습니다. 잠시 후 다시 시도해 주세요.'
        : '아이디 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    const s = await getSession()
    setPinUser(String((s?.user as any)?.id || ''))
    setLeaving(true)
    setTimeout(() => setStage('pin'), 500)
  }

  async function handleHelp(e?: FormEvent) {
    e?.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth-help', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', type: mode, website: hWebsite, t: openedAt.current }),
      })
      const j = await res.json()
      if (!res.ok) setError(j.error || '요청에 실패했습니다.')
      else { setHDone(j.message); setStep('code') }
    } catch { setError('네트워크 오류가 발생했습니다.') }
    setLoading(false)
  }

  // 코드만 먼저 확인 → 맞으면 이름·연락처 입력칸 열기
  async function handleCheck(e: FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth-help', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', type: mode, code: hCode }),
      })
      const j = await res.json()
      if (!res.ok) setError(j.error || '확인에 실패했습니다.')
      else setStep('info')
    } catch { setError('네트워크 오류가 발생했습니다.') }
    setLoading(false)
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (mode === 'pw') {
      if (hNew !== hNew2) { setError('새 비밀번호가 서로 다릅니다.'); return }
      if (hNew.length < 6) { setError('새 비밀번호는 6자 이상이어야 합니다.'); return }
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth-help', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', type: mode, name: hName, phone: hPhone, code: hCode, newPassword: hNew }),
      })
      const j = await res.json()
      if (!res.ok) { setError(j.error || '확인에 실패했습니다.'); if (/폐기|만료/.test(j.error || '')) setStep('code') }
      else { setFoundId(j.username); setStep('done') }
    } catch { setError('네트워크 오류가 발생했습니다.') }
    setLoading(false)
  }

  const field = 'w-full bg-white border-[1.5px] border-[#e4e7ee] focus:border-[#a8873f] rounded-xl px-4 py-3.5 text-sm text-[#111827] outline-none transition-all duration-300 focus:shadow-[0_0_0_4px_rgba(168,135,63,.16)]'
  const label = 'block text-[13px] font-semibold text-[#111827] mb-2'

  return (
    <AuthShell>
      {stage === 'pin' ? (
        <div className="hc-in">
          <PinPad userId={pinUser} onVerified={finishPin} onCancel={cancelPin} />
        </div>
      ) : (
        <div className={'transition-all duration-500 ease-out ' + (leaving ? 'opacity-0 -translate-y-3 blur-sm pointer-events-none' : '')}>
            <div key={mode} className="hc-in">
              {mode === 'login' && (
                <>
                  <h2 className="text-[28px] font-black text-[#111827] tracking-tight">직원 로그인</h2>
                  <p className="text-sm text-[#6b7280] mt-2 mb-9">발급받은 아이디와 비밀번호로 로그인하세요.</p>
                  <form onSubmit={handleSubmit} className="space-y-5" autoComplete="on">
                    <div>
                      <label className={label}>아이디</label>
                      <input type="text" name="username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className={field} placeholder="아이디" required />
                    </div>
                    <div>
                      <label className={label}>비밀번호</label>
                      <input type="password" name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={field} placeholder="비밀번호" required />
                    </div>
                    {error && <p className="text-red-500 text-xs leading-relaxed hc-in">{error}</p>}
                    <button type="submit" disabled={loading}
                      className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 bg-gradient-to-r from-[#0b2140] to-[#4a5a9a] shadow-[0_10px_24px_-10px_rgba(11,33,64,.7)] hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-10px_rgba(11,33,64,.75)] transition-all duration-300">
                      {loading ? '확인 중...' : '로그인'}
                    </button>
                  </form>
                  <div className="mt-6 flex items-center justify-center gap-4 text-xs text-[#6b7280]">
                    <button type="button" onClick={() => go('id')} className="hover:text-[#a8873f] transition-colors">아이디 찾기</button>
                    <span className="w-px h-3 bg-[#d9d0b6]" />
                    <button type="button" onClick={() => go('pw')} className="hover:text-[#a8873f] transition-colors">비밀번호 찾기</button>
                  </div>
                </>
              )}

              {mode !== 'login' && (
                <>
                  <h2 className="text-[28px] font-black text-[#111827] tracking-tight">{mode === 'id' ? '아이디 찾기' : '비밀번호 찾기'}</h2>
                  <p className="text-sm text-[#6b7280] mt-2 mb-7 leading-relaxed">
                    {step === 'req' && <>보안을 위해 <b className="text-[#111827]">인증 코드</b>가 필요합니다.<br />먼저 코드를 요청하면 대표님이 본인 확인 후 코드를 알려드립니다.</>}
                    {step === 'code' && <>대표님께 받은 <b className="text-[#111827]">6자리 코드</b>를 입력해 주세요.</>}
                    {step === 'info' && <>코드가 확인되었습니다. 본인 정보를 입력해 주세요.</>}
                    {step === 'done' && <>본인 확인이 완료되었습니다.</>}
                  </p>

                  {step === 'req' && (
                    <form onSubmit={handleHelp} className="space-y-5">
                      {/* honeypot */}
                      <input type="text" tabIndex={-1} autoComplete="off" value={hWebsite} onChange={e => setHWebsite(e.target.value)}
                        className="absolute -left-[9999px] w-px h-px opacity-0" aria-hidden />
                      {error && <p className="text-red-500 text-xs hc-in">{error}</p>}
                      <button type="submit" disabled={loading}
                        className="w-full py-3.5 rounded-xl text-sm font-bold text-[#111827] disabled:opacity-60 bg-gradient-to-r from-[#b8995a] to-[#e6d4a3] hover:-translate-y-0.5 transition-all duration-300 shadow-[0_10px_24px_-10px_rgba(168,135,63,.7)]">
                        {loading ? '요청 중...' : '코드 요청하기'}
                      </button>
                      <button type="button" onClick={() => { setError(''); setStep('code') }} className="block mx-auto text-xs text-[#a8873f] hover:underline">이미 코드를 받으셨나요? 코드 입력하기</button>
                    </form>
                  )}

                  {step === 'code' && (
                    <form onSubmit={handleCheck} className="space-y-5">
                      {hDone && <div className="rounded-xl border-[1.5px] border-[#e4e7ee] bg-white/80 px-4 py-3 text-xs text-[#111827] leading-relaxed hc-in">✓ {hDone}</div>}
                      <div>
                        <label className={label}>인증 코드</label>
                        <input type="text" inputMode="numeric" autoComplete="one-time-code" value={hCode} onChange={e => setHCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className={field + ' tracking-[0.4em] text-center text-lg font-bold'} placeholder="000000" maxLength={6} required />
                      </div>
                      {error && <p className="text-red-500 text-xs hc-in">{error}</p>}
                      <button type="submit" disabled={loading || hCode.length !== 6}
                        className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 bg-gradient-to-r from-[#0b2140] to-[#4a5a9a] shadow-[0_10px_24px_-10px_rgba(11,33,64,.7)] hover:-translate-y-0.5 transition-all duration-300">
                        {loading ? '확인 중...' : '코드 확인'}
                      </button>
                      <button type="button" onClick={() => { setError(''); setStep('req') }} className="block mx-auto text-xs text-[#6b7280] hover:text-[#a8873f]">코드 다시 요청하기</button>
                    </form>
                  )}

                  {step === 'info' && (
                    <form onSubmit={handleVerify} className="space-y-5">
                      <div>
                        <label className={label}>이름</label>
                        <input type="text" value={hName} onChange={e => setHName(e.target.value)} className={field} placeholder="실명" maxLength={20} required />
                      </div>
                      <div>
                        <label className={label}>연락처</label>
                        <input type="tel" inputMode="numeric" value={hPhone} onChange={e => setHPhone(e.target.value)} className={field} placeholder="01012345678" maxLength={13} required />
                      </div>
                      {mode === 'pw' && (
                        <>
                          <div>
                            <label className={label}>새 비밀번호 <span className="text-[#6b7280] font-normal">(6자 이상)</span></label>
                            <input type="password" autoComplete="new-password" value={hNew} onChange={e => setHNew(e.target.value)} className={field} required />
                          </div>
                          <div>
                            <label className={label}>새 비밀번호 확인</label>
                            <input type="password" autoComplete="new-password" value={hNew2} onChange={e => setHNew2(e.target.value)} className={field} required />
                          </div>
                        </>
                      )}
                      {error && <p className="text-red-500 text-xs hc-in">{error}</p>}
                      <button type="submit" disabled={loading}
                        className="w-full py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 bg-gradient-to-r from-[#0b2140] to-[#4a5a9a] shadow-[0_10px_24px_-10px_rgba(11,33,64,.7)] hover:-translate-y-0.5 transition-all duration-300">
                        {loading ? '확인 중...' : mode === 'id' ? '아이디 확인' : '비밀번호 변경'}
                      </button>
                    </form>
                  )}

                  {step === 'done' && (
                    <div className="rounded-2xl border-[1.5px] border-[#e4e7ee] bg-white/80 p-6 text-sm text-[#111827] leading-relaxed hc-in">
                      {mode === 'id'
                        ? <>회원님의 아이디는 <b className="text-lg text-[#a8873f]">{foundId}</b> 입니다.</>
                        : <>비밀번호가 변경되었습니다. 아이디 <b className="text-[#a8873f]">{foundId}</b> 로 새 비밀번호로 로그인해 주세요.</>}
                    </div>
                  )}
                  <button type="button" onClick={() => go('login')} className="mt-6 block mx-auto text-xs text-[#6b7280] hover:text-[#a8873f] transition-colors">← 로그인으로 돌아가기</button>
                </>
              )}
            </div>

            <div className="mt-12 text-center">
              <Link href="/" className="text-xs text-[#6b7280]/70 hover:text-[#a8873f] transition-colors">← 홈페이지로 돌아가기</Link>
            </div>
        </div>
      )}
    </AuthShell>
  )
}
