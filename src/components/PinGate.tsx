'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'
import AuthShell from './AuthShell'
import PinPad from './PinPad'
import { getPinUserId, isPinVerified, isActivityFresh, markPinVerified, bumpActivity, clearPin } from '@/lib/pinStore'

export default function PinGate({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession()
  const [verified, setVerified] = useState(false)
  const userId = (session?.user as any)?.id as string | undefined

  useEffect(() => {
    if (status === 'loading' || !userId) return
    // 다른 계정이 PIN 인증한 기록이면 초기화
    const stored = getPinUserId()
    if (stored && stored !== userId) { clearPin(); return }
    if (isPinVerified(userId) && isActivityFresh()) setVerified(true)
  }, [status, userId])

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
      // 무활동 또는 계정 불일치 → 잠금
      const stale = !isActivityFresh()
      const mismatch = userId && getPinUserId() !== userId
      if (stale || mismatch) { clearPin(); setVerified(false) }
    }, 60_000)
    return () => clearInterval(id)
  }, [verified, userId])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#C5A258] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (verified) return <>{children}</>

  return (
    <AuthShell>
      <div className="hc-in">
        <PinPad
          userId={userId || ''}
          onVerified={() => { markPinVerified(userId ?? 'unknown'); setVerified(true) }}
          onCancel={async () => { clearPin(); await signOut({ callbackUrl: '/login' }) }}
        />
      </div>
    </AuthShell>
  )
}
