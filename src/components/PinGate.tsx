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

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAF8F3] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C5A258] border-t-transparent rounded-full animate-spin" />
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
    <div
      className="min-h-screen bg-[#FAF8F3] flex flex-col items-center justify-center px-4"
      onClick={locked ? undefined : focusHidden}
    >
      <input
        ref={hiddenRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        autoFocus
        disabled={locked || loading}
        className="fixed opacity-0 pointer-events-none w-0 h-0 border-0"
        onChange={handleHiddenInput}
        onKeyDown={handleHiddenKeyDown}
      />

      {/* 로고 */}
      <div className="mb-8 text-center">
        <div className="relative w-14 h-14 mx-auto mb-3">
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain" unoptimized />
        </div>
        <p className="text-xs tracking-[0.3em] text-[#C5A258] uppercase font-bold">HUNDRED</p>
      </div>

      {/* 카드 */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E8E2D4] px-8 py-7 w-full max-w-xs text-center">
        <h2 className="text-sm font-semibold text-[#1B2A45] mb-1">보안 PIN 입력</h2>
        <p className="text-[11px] text-[#1B2A45]/40 mb-6">
          {locked ? '계정이 잠겼습니다' : '6자리 숫자를 입력하세요'}
        </p>

        {locked ? (
          <div className="py-4 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
              <span className="text-2xl">🔒</span>
            </div>
            <p className="text-sm font-semibold text-red-500">PIN 5회 오류로 잠겼습니다</p>
            <p className="text-[11px] text-[#1B2A45]/50 leading-relaxed">
              대표에게 연락하여<br />PIN 초기화를 요청하세요
            </p>
          </div>
        ) : (
          <>
            {/* 점(dot) 표시 */}
            <div
              style={{ animation: shake ? 'shake 0.5s ease' : 'none' }}
              className="flex gap-3 justify-center mb-2"
              onClick={focusHidden}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={[
                    'w-3.5 h-3.5 rounded-full transition-all duration-150',
                    i < digits.length
                      ? error ? 'bg-red-400' : loading ? 'bg-[#C5A258]' : 'bg-[#1B2A45]'
                      : 'bg-[#E8E2D4]',
                  ].join(' ')}
                />
              ))}
            </div>

            {/* 오류 메시지 */}
            <div className="h-5 mb-4">
              {error  && <p className="text-xs text-red-500 font-medium">{error}</p>}
              {loading && !error && <p className="text-xs text-[#C5A258] font-medium">확인 중...</p>}
            </div>

            {/* 숫자패드 */}
            <div className="space-y-2">
              {PAD.map((row, ri) => (
                <div key={ri} className="flex gap-2 justify-center">
                  {row.map((key, ki) => (
                    <button
                      key={ki}
                      type="button"
                      disabled={!key || loading}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (key === '⌫') handleDelete()
                        else if (key) handleDigit(key)
                      }}
                      className={[
                        'w-16 h-12 rounded-xl text-base font-semibold transition-all select-none',
                        key === '⌫'
                          ? 'bg-red-50 text-red-400 hover:bg-red-100 active:scale-95 disabled:opacity-40'
                          : key
                          ? 'bg-[#F5F3EE] text-[#1B2A45] hover:bg-[#EAE8E2] active:bg-[#1B2A45] active:text-white active:scale-95 disabled:opacity-40'
                          : 'invisible',
                      ].join(' ')}
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

      <p className="mt-6 text-[10px] text-[#1B2A45]/30">
        {locked ? 'PIN 5회 오류 — 대표 문의 필요' : 'PIN을 잊으셨나요? 관리자에게 문의하세요'}
      </p>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  )
}
