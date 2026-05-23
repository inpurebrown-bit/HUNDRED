'use client'

import { useState, useRef, useCallback, ReactNode } from 'react'

const TRIGGER_THRESHOLD = 70   // 이 거리 이상 당기면 새로고침 실행
const MAX_PULL = 90            // 최대 당김 시각 거리 (px)

interface Props {
  onRefresh: () => Promise<void>
  children: ReactNode
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const [pullY, setPullY]         = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY    = useRef(0)
  const isPulling = useRef(false)
  const triggered = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // 최상단에서만 동작 (스크롤 중에는 무시)
    if (window.scrollY > 2) return
    startY.current  = e.touches[0].clientY
    isPulling.current = true
    triggered.current = false
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0) { setPullY(0); return }
    // 고무줄 효과 (당길수록 저항 증가)
    const rubber = MAX_PULL * (1 - Math.exp(-dy / (MAX_PULL * 2)))
    setPullY(rubber)
  }, [])

  const onTouchEnd = useCallback(async () => {
    if (!isPulling.current) return
    isPulling.current = false

    if (pullY >= TRIGGER_THRESHOLD) {
      triggered.current = true
      setRefreshing(true)
      setPullY(MAX_PULL) // 새로고침 중엔 고정
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullY(0)
      }
    } else {
      // 임계값 미달 → 원위치
      setPullY(0)
    }
  }, [pullY, onRefresh])

  // 진행률 0~1
  const progress = Math.min(pullY / TRIGGER_THRESHOLD, 1)
  // 아이콘 회전 각도 (당기면 180도 회전)
  const arrowDeg = progress * 180

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {/* ── 당김 인디케이터 ── */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200 ease-out"
        style={{ height: pullY }}
      >
        <div
          className={`w-9 h-9 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center transition-opacity ${
            pullY > 8 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {refreshing ? (
            /* 새로고침 중 — 스피너 */
            <svg
              className="w-5 h-5 text-[#1B2A45] animate-spin"
              viewBox="0 0 24 24" fill="none"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"
                strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
            </svg>
          ) : (
            /* 당기는 중 — 화살표 (당길수록 180° 회전) */
            <svg
              className="w-5 h-5 transition-transform duration-100"
              style={{
                color: progress >= 1 ? '#1B2A45' : '#9ca3af',
                transform: `rotate(${arrowDeg}deg)`,
              }}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>

        {/* 텍스트 힌트 */}
        {pullY > 30 && (
          <span className="ml-2 text-[11px] font-medium text-gray-400 select-none">
            {refreshing ? '새로고침 중...' : progress >= 1 ? '놓으면 새로고침' : '당겨서 새로고침'}
          </span>
        )}
      </div>

      {children}
    </div>
  )
}
