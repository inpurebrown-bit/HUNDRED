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
  } catch {
    // sessionStorage 접근 불가 환경 대비
  }
}

interface PinGateProps {
  children: React.ReactNode
}

export default function PinGate({ children }: PinGateProps) {
  const { status } = useSession()
  const [verified, setVerified] = useState(false)
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // 초기 PIN 유효성 확인
  useEffect(() => {
    if (isPinValid()) {
      setVerified(true)
    }
  }, [])

  // 1분마다 TTL 재확인
  useEffect(() => {
    if (!verified) return
    const id = setInterval(() => {
      if (!isPinValid()) {
        setVerified(false)
        setDigits(['', '', '', '', '', ''])
        setError(false)
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [verified])

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => {
      setShake(false)
      setDigits(['', '', '', '', '', ''])
      setError(false)
      // 첫 번째 칸으로 포커스 이동
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
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

  const handleChange = useCallback(
    (index: number, value: string) => {
      // 숫자만 허용, 마지막 입력 문자 1개만 사용
      const char = value.replace(/\D/g, '').slice(-1)
      if (!char) return

      const next = [...digits]
      next[index] = char
      setDigits(next)
      setError(false)

      if (index < 5) {
        inputRefs.current[index + 1]?.focus()
      }

      // 6자리 모두 입력 시 자동 검증
      if (index === 5) {
        const pin = [...next].join('')
        if (pin.length === 6) {
          verifyPin(pin)
        }
      } else {
        const pin = next.join('')
        if (pin.length === 6) {
          verifyPin(pin)
        }
      }
    },
    [digits, verifyPin],
  )

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (digits[index]) {
          const next = [...digits]
          next[index] = ''
          setDigits(next)
        } else if (index > 0) {
          const next = [...digits]
          next[index - 1] = ''
          setDigits(next)
          inputRefs.current[index - 1]?.focus()
        }
      }
    },
    [digits],
  )

  // NextAuth 세션 로딩 중
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAF8F3] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C5A258] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // PIN 인증 완료 → children 렌더
  if (verified) {
    return <>{children}</>
  }

  // PIN 입력 UI
  return (
    <div className="min-h-screen bg-[#FAF8F3] flex flex-col items-center justify-center px-4">
      {/* 로고 */}
      <div className="mb-10 text-center">
        <div className="relative w-16 h-16 mx-auto mb-3">
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain" unoptimized />
        </div>
        <p className="text-xs tracking-[0.3em] text-[#C5A258] uppercase font-bold">HUNDRED</p>
      </div>

      {/* 카드 */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#E8E2D4] p-8 w-full max-w-xs text-center">
        <h2 className="text-sm font-semibold text-[#1B2A45] mb-1">보안 PIN을 입력하세요</h2>
        <p className="text-[11px] text-[#1B2A45]/40 mb-6">6자리 숫자 PIN</p>

        {/* 6자리 박스 */}
        <div
          style={{ animation: shake ? 'shake 0.5s ease' : 'none' }}
          className="flex gap-2 justify-center mb-4"
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              className={[
                'w-10 h-12 text-center text-lg font-bold rounded-xl border-2 outline-none transition-colors bg-[#FAF8F3]',
                error
                  ? 'border-red-400 text-red-500'
                  : d
                  ? 'border-[#C5A258] text-[#1B2A45]'
                  : 'border-[#E8E2D4] text-[#1B2A45]',
              ].join(' ')}
            />
          ))}
        </div>

        {/* 오류 메시지 */}
        <div className="h-5 mb-2">
          {error && (
            <p className="text-xs text-red-500 font-medium">잘못된 PIN입니다</p>
          )}
        </div>
      </div>

      {/* 하단 안내 */}
      <p className="mt-6 text-[10px] text-[#1B2A45]/30">
        PIN을 잊으셨나요? 관리자에게 문의하세요
      </p>
    </div>
  )
}
