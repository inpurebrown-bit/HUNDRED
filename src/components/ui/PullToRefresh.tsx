'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

const TRIGGER_THRESHOLD = 72   // 이 거리 이상 당기면 새로고침 실행
const MAX_PULL = 96            // 최대 당김 시각 거리 (px)

interface Props {
  onRefresh: () => Promise<void>
  children: ReactNode
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [pullY, setPullY]           = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const containerRef  = useRef<HTMLDivElement>(null)
  const startY        = useRef(0)
  const isPulling     = useRef(false)
  const pullYRef      = useRef(0)          // state와 동기화된 ref (이벤트 핸들러용)
  const isRefreshing  = useRef(false)      // refreshing state ref
  const onRefreshRef  = useRef(onRefresh)  // stale closure 방지

  useEffect(() => { onRefreshRef.current = onRefresh }, [onRefresh])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // ── touchstart: 맨 위일 때만 당기기 시작 ──
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 1 || isRefreshing.current) return
      startY.current    = e.touches[0].clientY
      isPulling.current = true
    }

    // ── touchmove: preventDefault로 브라우저 스크롤/바운스 차단 ──
    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0) {
        if (pullYRef.current > 0) { pullYRef.current = 0; setPullY(0) }
        return
      }
      // passive: false로 등록했기 때문에 preventDefault 사용 가능
      e.preventDefault()
      // 고무줄 효과 (당길수록 저항 증가)
      const rubber = MAX_PULL * (1 - Math.exp(-dy / (MAX_PULL * 2.2)))
      pullYRef.current = rubber
      setPullY(rubber)
    }

    // ── touchend: 임계값 초과 시 새로고침 ──
    const onTouchEnd = async () => {
      if (!isPulling.current) return
      isPulling.current = false
      const py = pullYRef.current

      if (py >= TRIGGER_THRESHOLD) {
        isRefreshing.current = true
        setRefreshing(true)
        pullYRef.current = MAX_PULL
        setPullY(MAX_PULL)
        try {
          await onRefreshRef.current()
        } finally {
          isRefreshing.current = false
          setRefreshing(false)
          pullYRef.current = 0
          setPullY(0)
        }
      } else {
        pullYRef.current = 0
        setPullY(0)
      }
    }

    // touchmove만 passive: false (preventDefault 필요), 나머지는 passive
    el.addEventListener('touchstart',  onTouchStart, { passive: true  })
    el.addEventListener('touchmove',   onTouchMove,  { passive: false })
    el.addEventListener('touchend',    onTouchEnd,   { passive: true  })
    el.addEventListener('touchcancel', onTouchEnd,   { passive: true  })

    return () => {
      el.removeEventListener('touchstart',  onTouchStart)
      el.removeEventListener('touchmove',   onTouchMove)
      el.removeEventListener('touchend',    onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, []) // onRefresh는 ref로 관리하므로 deps 불필요

  const progress = Math.min(pullY / TRIGGER_THRESHOLD, 1)
  const arrowDeg = progress * 180

  return (
    <div ref={containerRef}>
      {/* ── 당김 인디케이터 — 네이비 배경, 아이콘만 ── */}
      <div
        className="flex items-center justify-center overflow-hidden bg-[#1B2A45]"
        style={{
          height: pullY,
          transition: isPulling.current ? 'none' : 'height 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {pullY > 4 && (
          refreshing ? (
            /* 새로고침 중 — 흰색 스피너 */
            <svg
              className="w-6 h-6 text-white animate-spin"
              viewBox="0 0 24 24" fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"
                strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
            </svg>
          ) : (
            /* 당기는 중 — 흰색 화살표 (당길수록 180° 회전) */
            <svg
              className="w-6 h-6"
              style={{
                color: progress >= 1 ? '#C5A258' : 'rgba(255,255,255,0.5)',
                transform: `rotate(${arrowDeg}deg)`,
                transition: 'transform 0.1s ease-out, color 0.15s ease-out',
              }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          )
        )}
      </div>

      {children}
    </div>
  )
}
