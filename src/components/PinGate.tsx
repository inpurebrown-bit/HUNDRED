'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'

const PIN_KEY = 'pin_verified_at'
const PIN_TTL = 5 * 60 * 1000 // 5분 (ms)

function isPinValid(): boolean {
  try {
    const ts = sessionStorage.getItem(PIN_KEY)
    if (!ts) return false
    return Date.now() - Number(ts) < PIN_TTL
  } catch {
    return false
  }
}

function markPinVerified() {
  try {
    sessionStorage.setItem(PIN_KEY, String(Date.now()))
  } catch {}
}

interface PinGateProps {
  children: React.ReactNode
}

export default function PinGate({ children }: PinGateProps) {
  const { status } = useSession()
  const [verified, setVerified] = useState(false)
  const [digits, setDigits] = useState('')   // 최대 6자리 문자열
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const hiddenRef = useRef<HTMLInputElement>(null)

  // 초기 PIN 유효성 확인
  useEffect(() => {
    if (isPinValid()) setVerified(true)
  }, [])

  // 1분마다 TTL 재확인
  useEffect(() => {
    if (!verified) return
    const id = setInterval(() => {
      if (!isPinValid()) {
        setVerified(false)
        setDigits('')
        setError(false)
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [verified])

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => {
      setShake(false)
      setDigits('')
      setError(false)
      hiddenRef.current?.focus()
    }, 600)
  }, [])

  const verifyPin = useCallback((pin: string) => {
    const correct = process.env.NEXT_PUBLIC_APP_PIN ?? ''
    if (pin === correct) {
      markPinVerified()
      setVerified(true)
    } else {
      setError(true)
      triggerShake()
    }
  }, [triggerShake])

  // 숫자 입력 (키패드 & 키보드 공용)
  const handleDigit = useCallback((d: string) => {
    setError(false)
    setDigits(prev => {
      if (prev.length >= 6) return prev
      const next = prev + d
      if (next.length === 6) {
        // 약간의 딜레이 후 검증 (마지막 점이 채워지는 걸 보여주기 위해)
        setTimeout(() => verifyPin(next), 80)
      }
      return next
    })
  }, [verifyPin])

  const handleDelete = useCallback(() => {
    setError(false)
    setDigits(prev => prev.slice(0, -1))
  }, [])

  // 실제 키보드 입력 처리 (숨겨진 input)
  const handleHiddenInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    // 새로 추가된 문자만 처리
    if (val.length > digits.length) {
      const newChar = val[val.length - 1]
      handleDigit(newChar)
    }
    // 항상 input value를 초기화해서 입력 계속 가능하게
    e.target.value = ''
  }, [digits.length, handleDigit])

  const handleHiddenKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') handleDelete()
  }, [handleDelete])

  // 화면 탭하면 숨겨진 input에 포커스 → 키보드 올라옴
  const focusHidden = useCallback(() => {
    hiddenRef.current?.focus()
  }, [])

  // NextAuth 세션 로딩 중
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAF8F3] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C5A258] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // PIN 인증 완료 → children 렌더
  if (verified) return <>{children}</>

  // 숫자패드 배열
  const PAD = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫'],
  ]

  return (
    <div
      className="min-h-screen bg-[#FAF8F3] flex flex-col items-center justify-center px-4"
      onClick={focusHidden}
    >
      {/* 숨겨진 실제 input (키보드 입력용) */}
      <input
        ref={hiddenRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        autoFocus
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
        <p className="text-[11px] text-[#1B2A45]/40 mb-6">6자리 숫자를 입력하세요</p>

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
                  ? error ? 'bg-red-400' : 'bg-[#1B2A45]'
                  : 'bg-[#E8E2D4]',
              ].join(' ')}
            />
          ))}
        </div>

        {/* 오류 메시지 */}
        <div className="h-5 mb-4">
          {error && <p className="text-xs text-red-500 font-medium">잘못된 PIN입니다</p>}
        </div>

        {/* 온스크린 숫자패드 */}
        <div className="space-y-2">
          {PAD.map((row, ri) => (
            <div key={ri} className="flex gap-2 justify-center">
              {row.map((key, ki) => (
                <button
                  key={ki}
                  type="button"
                  disabled={!key}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (key === '⌫') handleDelete()
                    else if (key) handleDigit(key)
                  }}
                  className={[
                    'w-16 h-12 rounded-xl text-base font-semibold transition-all select-none',
                    key === '⌫'
                      ? 'bg-red-50 text-red-400 hover:bg-red-100 active:scale-95'
                      : key
                      ? 'bg-[#F5F3EE] text-[#1B2A45] hover:bg-[#EAE8E2] active:bg-[#1B2A45] active:text-white active:scale-95'
                      : 'invisible',
                  ].join(' ')}
                >
                  {key}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-[10px] text-[#1B2A45]/30">
        PIN을 잊으셨나요? 관리자에게 문의하세요
      </p>
    </div>
  )
}
