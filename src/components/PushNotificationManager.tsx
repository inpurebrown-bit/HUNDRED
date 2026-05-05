'use client'

import { useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'

export default function PushNotificationManager() {
  const { data: session, status } = useSession()
  const registered = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated' || registered.current) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    registered.current = true
    registerPush()
  }, [status])

  async function registerPush() {
    try {
      // 서비스 워커 등록
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready

      // 이미 구독 중인지 확인
      const existing = await reg.pushManager.getSubscription()
      if (existing) {
        // 서버에 구독 정보 동기화
        await saveSubscription(existing)
        return
      }

      // 알림 권한 요청
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      // 푸시 구독 생성
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      await saveSubscription(subscription)
    } catch (err) {
      console.error('[Push] 등록 실패:', err)
    }
  }

  async function saveSubscription(subscription: PushSubscription) {
    try {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })
    } catch (err) {
      console.error('[Push] 구독 저장 실패:', err)
    }
  }

  return null
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}
