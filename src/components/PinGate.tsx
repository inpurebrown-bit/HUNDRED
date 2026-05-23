'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'

const PIN_KEY = 'pin_verified'
const ACTIVITY_KEY = 'pin_last_activity'
const INACTIVITY_LIMIT = 30 * 60 * 1000

function isPinVerified(): boolean {
  try { return sessionStorage.getItem(PIN_KEY) === '1' } catch { return false }
}
function isActivityFresh(): boolean {
  try {
    const ts = sessionStorage.getItem(ACTIVITY_KEY)
    if (!ts) return false
    return Date.now() - Number(ts) < INACTIVITY_LIMIT
  } catch { return false }
}
function markPinVerified() {
  try {
    sessionStorage.setItem(PIN_KEY, '1')
    sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()))
  } catch {}
}
function bumpActivity() {
  try { sessionStorage.setItem(ACTIVITY_KEY, String(Date.now())) } catch {}
}
function clearPin() {
  try {
    sessionStorage.removeItem(PIN_KEY)
    sessionStorage.removeItem(ACTIVITY_KEY)
  } catch {}
}

interface PinGateProps { children: React.ReactNode }

/* ── dark bg shared style ── */
const DARK_BG: React.CSSProperties = {
  background:
    'radial-gradient(ellipse 80% 50% at 15% -10%, rgba(27,42,69,0.55) 0%, transparent 60%),' +
    'radial-gradient(ellipse 60% 40% at 85% 90%, rgba(197,162,88,0.06) 0%, transparent 55%),' +
    'linear-gradient(160deg, #0a1628 0%, #0D1B2E 55%, #091221 100%)',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 16px',
}

export default function PinGate({ children }: PinGateProps) {
  const { status } = useSession()
  const [verified, setVerified]   = useState(false)
  const [digits, setDigits]       = useState('')
  const [error, setError]         = useState('')
  const [shake, setShake]         = useState(false)
  const [locked, setLocked]       = useState(false)
  const [loading, setLoading]     = useState(false)
  const hiddenRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isPinVerified() && isActivityFresh()) setVerified(true)
  }, [])

  useEffect(() => {
    if (!verified) return
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    const onActivity = () => bumpActivity()
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, onActivity))
  }, [verified])

  useEffect(() => {
    if (!verified) return
    const id = setInterval(() => {
      if (!isActivityFresh()) { clearPin(); setVerified(false); setDigits(''); setError('') }
    }, 60_000)
    return () => clearInterval(id)
  }, [verified])

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => { setShake(false); setDigits(''); hiddenRef.current?.focus() }, 600)
  }, [])

  const verifyPin = useCallback(async (pin: string) => {
    if (loading) return
    setLoading(true)
    try {
      const res  = await fetch('/api/pin/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) })
      const data = await res.json()
      if (data.ok) { markPinVerified(); setVerified(true) }
      else {
        setError(data.error || '잘못된 PIN입니다')
        if (data.locked) setLocked(true)
        else triggerShake()
      }
    } catch {
      setError('서버 오류가 발생했습니다'); triggerShake()
    } finally { setLoading(false) }
  }, [loading, triggerShake])

  const handleDigit = useCallback((d: string) => {
    if (locked || loading) return
    setError('')
    setDigits(prev => {
      if (prev.length >= 6) return prev
      const next = prev + d
      if (next.length === 6) setTimeout(() => verifyPin(next), 80)
      return next
    })
  }, [locked, loading, verifyPin])

  const handleDelete = useCallback(() => {
    if (locked) return
    setError('')
    setDigits(prev => prev.slice(0, -1))
  }, [locked])

  const handleHiddenInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    if (val.length > digits.length) handleDigit(val[val.length - 1])
    e.target.value = ''
  }, [digits.length, handleDigit])

  const handleHiddenKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') handleDelete()
  }, [handleDelete])

  const focusHidden = useCallback(() => hiddenRef.current?.focus(), [])

  /* ── Session loading ── */
  if (status === 'loading') {
    return (
      <div style={DARK_BG}>
        <div style={{ width: 32, height: 32, border: '2.5px solid rgba(197,162,88,0.30)', borderTopColor: '#C5A258', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (verified) return <>{children}</>

  const PAD = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['', '0','⌫'],
  ]

  return (
    <div style={DARK_BG} onClick={locked ? undefined : focusHidden}>
      <input
        ref={hiddenRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        autoFocus
        disabled={locked || loading}
        style={{ position:'fixed', opacity:0, pointerEvents:'none', width:0, height:0, border:0 }}
        onChange={handleHiddenInput}
        onKeyDown={handleHiddenKeyDown}
      />

      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ position:'relative', width:56, height:56, margin:'0 auto 14px' }}>
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain brightness-0 invert" unoptimized />
        </div>
        <p style={{ fontSize:11, letterSpacing:'0.4em', color:'#C5A258', fontWeight:700, textTransform:'uppercase' }}>HUNDRED</p>
        <p style={{ fontSize:10, letterSpacing:'0.25em', color:'rgba(238,233,224,0.30)', textTransform:'uppercase', marginTop:4 }}>보안 PIN 확인</p>
      </div>

      {/* Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 300,
          background: 'rgba(255,255,255,0.055)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 20,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 8px 40px rgba(0,0,0,0.50), 0 1px 0 rgba(255,255,255,0.08) inset',
          padding: '28px 28px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize:13, fontWeight:600, color:'#EEE9E0', marginBottom:4 }}>
          {locked ? '계정이 잠겼습니다' : '6자리 PIN 입력'}
        </p>
        <p style={{ fontSize:11, color:'rgba(238,233,224,0.38)', marginBottom: locked ? 24 : 20 }}>
          {locked ? 'PIN 5회 오류' : '숫자를 눌러 입력하세요'}
        </p>

        {locked ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, paddingBlock:8 }}>
            <div style={{ width:56, height:56, borderRadius:'50%', background:'rgba(239,68,68,0.14)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>🔒</div>
            <p style={{ fontSize:13, fontWeight:600, color:'#f87171' }}>잠금 상태</p>
            <p style={{ fontSize:11, color:'rgba(238,233,224,0.45)', lineHeight:1.6 }}>
              대표에게 연락하여<br />PIN 초기화를 요청하세요
            </p>
          </div>
        ) : (
          <>
            {/* Dot indicators */}
            <div
              style={{
                display:'flex', gap:10, justifyContent:'center', marginBottom:8,
                animation: shake ? 'pin-shake 0.5s ease' : 'none',
              }}
              onClick={focusHidden}
            >
              {Array.from({length:6}).map((_,i) => (
                <div
                  key={i}
                  style={{
                    width: 14, height: 14, borderRadius: '50%',
                    transition: 'all 0.15s ease',
                    background: i < digits.length
                      ? (error ? '#f87171' : loading ? '#C5A258' : '#EEE9E0')
                      : 'rgba(255,255,255,0.14)',
                    boxShadow: i < digits.length && !error
                      ? '0 0 8px rgba(197,162,88,0.40)'
                      : 'none',
                  }}
                />
              ))}
            </div>

            {/* Error / loading */}
            <div style={{ height:20, marginBottom:16 }}>
              {error  && <p style={{ fontSize:12, color:'#f87171', fontWeight:500 }}>{error}</p>}
              {loading && !error && <p style={{ fontSize:12, color:'#C5A258', fontWeight:500 }}>확인 중...</p>}
            </div>

            {/* Numpad */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {PAD.map((row, ri) => (
                <div key={ri} style={{ display:'flex', gap:8, justifyContent:'center' }}>
                  {row.map((key, ki) => (
                    <button
                      key={ki}
                      type="button"
                      disabled={!key || loading}
                      onClick={e => { e.stopPropagation(); if (key === '⌫') handleDelete(); else if (key) handleDigit(key) }}
                      style={{
                        width: 64, height: 48, borderRadius: 12,
                        fontSize: key === '⌫' ? 18 : 16, fontWeight: 600,
                        border: '1px solid rgba(255,255,255,0.10)',
                        cursor: key ? 'pointer' : 'default',
                        visibility: key ? 'visible' : 'hidden',
                        transition: 'all 0.1s ease',
                        background: key === '⌫'
                          ? 'rgba(239,68,68,0.15)'
                          : 'rgba(255,255,255,0.07)',
                        color: key === '⌫' ? '#f87171' : '#EEE9E0',
                        userSelect: 'none',
                      }}
                      onMouseDown={e => { if (!key || loading) return; (e.target as HTMLElement).style.background = key === '⌫' ? 'rgba(239,68,68,0.30)' : 'rgba(255,255,255,0.18)'; (e.target as HTMLElement).style.transform = 'scale(0.95)' }}
                      onMouseUp={e   => { (e.target as HTMLElement).style.background = key === '⌫' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)'; (e.target as HTMLElement).style.transform = 'scale(1)' }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)' }}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p style={{ marginTop:24, fontSize:10, color:'rgba(238,233,224,0.25)' }}>
        {locked ? 'PIN 5회 오류 — 대표 문의 필요' : 'PIN을 잊으셨나요? 관리자에게 문의하세요'}
      </p>

      <style>{`
        @keyframes pin-shake {
          0%,100%{transform:translateX(0)}
          15%{transform:translateX(-8px)}
          30%{transform:translateX(8px)}
          45%{transform:translateX(-6px)}
          60%{transform:translateX(6px)}
          75%{transform:translateX(-3px)}
          90%{transform:translateX(3px)}
        }
      `}</style>
    </div>
  )
}
