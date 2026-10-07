'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

const PAD = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', '⌫']]

// 보안 PIN 6자리 입력 (로그인 화면 우측 / PinGate 공용)
export default function PinPad({ userId, onVerified, onCancel }: {
  userId: string
  onVerified: () => void
  onCancel?: () => void
}) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  const hiddenRef = useRef<HTMLInputElement>(null)

  // 터치 기기(폰/태블릿)는 화면 숫자패드로만 입력 — 시스템 키패드가 올라오지 않도록 입력칸을 만들지 않는다
  const [touch, setTouch] = useState(true)
  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
    setTouch(coarse)
    if (!coarse) hiddenRef.current?.focus()
  }, [])

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => { setShake(false); setDigits(''); hiddenRef.current?.focus() }, 600)
  }, [])

  const verifyPin = useCallback(async (pin: string) => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/pin/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) })
      const data = await res.json()
      if (data.ok) { setOk(true); setTimeout(onVerified, 450) }
      else {
        setError(data.error || '잘못된 PIN입니다')
        if (data.locked) setLocked(true)
        else triggerShake()
      }
    } catch { setError('서버 오류가 발생했습니다'); triggerShake() }
    finally { setLoading(false) }
  }, [loading, triggerShake, onVerified])

  const handleDigit = useCallback((d: string) => {
    if (locked || loading || ok) return
    setError('')
    setDigits(prev => {
      if (prev.length >= 6) return prev
      const next = prev + d
      if (next.length === 6) setTimeout(() => verifyPin(next), 80)
      return next
    })
  }, [locked, loading, ok, verifyPin])

  const handleDelete = useCallback(() => { if (!locked && !ok) { setError(''); setDigits(p => p.slice(0, -1)) } }, [locked, ok])

  const onHiddenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    if (val.length > digits.length) handleDigit(val[val.length - 1])
    e.target.value = ''
  }

  return (
    <div onClick={() => !locked && !touch && hiddenRef.current?.focus()} data-pin-user={userId}>
      {!touch && (
        <input ref={hiddenRef} type="password" autoComplete="off"
          disabled={locked || loading || ok}
          className="fixed opacity-0 pointer-events-none w-0 h-0 border-0"
          onChange={onHiddenChange} onKeyDown={e => { if (e.key === 'Backspace') handleDelete() }} />
      )}

      <p className="text-[11px] tracking-[0.3em] text-[#a8873f] font-semibold mb-3">SECURITY</p>
      <h2 className="text-[28px] font-black text-[#111827] tracking-tight">보안 PIN 입력</h2>
      <p className="text-sm text-[#6b7280] mt-2 mb-9">{locked ? '계정이 잠겼습니다.' : ok ? '확인되었습니다. 이동합니다...' : '6자리 숫자를 입력하세요.'}</p>

      {locked ? (
        <div className="rounded-2xl border-[1.5px] border-[#e4e7ee] bg-white/80 p-8 text-center">
          <div className="text-3xl mb-3">🔒</div>
          <p className="text-sm font-semibold text-red-500">PIN 5회 오류로 잠겼습니다</p>
          <p className="text-xs text-[#6b7280] mt-2 leading-relaxed">대표에게 연락하여 PIN 초기화를 요청하세요.</p>
        </div>
      ) : (
        <>
          <div style={{ animation: shake ? 'shake 0.5s ease' : 'none' }} className="flex gap-3.5 justify-center mb-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={'w-4 h-4 rounded-full transition-all duration-300 ' + (i < digits.length
                ? (error ? 'bg-red-400 scale-110' : ok ? 'bg-emerald-500 scale-110' : 'bg-[#0b2140] scale-110')
                : 'bg-transparent border-2 border-[#b8995a]/60')} />
            ))}
          </div>
          <div className="h-5 mb-5 text-center">
            {error && <p className="text-xs text-red-500 font-medium hc-in">{error}</p>}
            {loading && !error && <p className="text-xs text-[#a8873f] font-medium">확인 중...</p>}
          </div>
          <div className="space-y-2.5">
            {PAD.map((row, ri) => (
              <div key={ri} className="flex gap-2.5 justify-center">
                {row.map((key, ki) => (
                  <button key={ki} type="button" disabled={!key || loading || ok}
                    onClick={e => { e.stopPropagation(); if (key === '⌫') handleDelete(); else if (key) handleDigit(key) }}
                    className={'w-[88px] h-14 rounded-2xl text-lg font-bold select-none disabled:opacity-40 ' + (key === '⌫'
                      ? 'bg-red-50 text-red-400 hover:bg-red-100 active:scale-95'
                      : key ? 'bg-white border-[1.5px] border-[#e4e7ee] text-[#111827] hover:border-[#a8873f] hover:-translate-y-0.5 active:scale-95 active:bg-[#0b2140] active:text-white'
                      : 'invisible')}>
                    {key}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mt-8 text-center space-y-2">
        <p className="text-[11px] text-[#6b7280]/80">PIN을 잊으셨나요? 대표에게 문의하세요.</p>
        {onCancel && <button type="button" onClick={onCancel} className="text-xs text-[#6b7280] hover:text-[#a8873f] transition-colors">← 다른 계정으로 로그인</button>}
      </div>
    </div>
  )
}
