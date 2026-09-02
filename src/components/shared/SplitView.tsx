'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  onClose: () => void
  initialUrl?: string
}

export default function SplitView({ onClose, initialUrl }: Props) {
  const [leftWidth, setLeftWidth] = useState(50)
  const currentUrl = initialUrl ?? (typeof window !== 'undefined' ? window.location.href : '/')
  const dragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const pct = ((e.clientX - rect.left) / rect.width) * 100
    setLeftWidth(Math.min(80, Math.max(20, pct)))
  }, [])
  const onMouseUp = useCallback(() => { dragging.current = false }, [])

  useEffect(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-[#0f1117]"
      style={{ userSelect: 'none' }}
    >
      {/* 상단 바 */}
      <div className="h-7 bg-[#0f1117] flex items-center px-3 gap-2 shrink-0 border-b border-white/5">
        <span className="text-[11px] text-[#C5A258] font-semibold tracking-wide">⊞ 창 분할 모드</span>
        <span className="text-[10px] text-gray-500">· 각 패널에서 메뉴를 독립적으로 탐색할 수 있습니다</span>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setLeftWidth(50)}
            className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
            title="50:50 균등 분할"
          >
            균등
          </button>
          <button
            onClick={() => setLeftWidth(66)}
            className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
            title="좌측 2/3"
          >
            2:1
          </button>
          <button
            onClick={() => setLeftWidth(33)}
            className="text-[10px] text-gray-500 hover:text-gray-300 px-1.5 py-0.5 rounded hover:bg-white/10 transition-colors"
            title="우측 2/3"
          >
            1:2
          </button>
          <div className="w-px h-3 bg-white/10" />
          <button
            onClick={onClose}
            className="text-[10px] text-gray-500 hover:text-red-400 px-2 py-0.5 rounded hover:bg-white/10 transition-colors"
          >
            ✕ 닫기
          </button>
        </div>
      </div>

      {/* 패널 영역 */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* 왼쪽 패널 */}
        <div style={{ width: `${leftWidth}%` }} className="h-full flex flex-col overflow-hidden">
          <div className="h-5 bg-[#1a1f2e] flex items-center justify-center shrink-0 border-b border-white/5">
            <span className="text-[9px] text-gray-500 font-medium tracking-widest uppercase">Left Panel</span>
          </div>
          <iframe
            src={currentUrl}
            className="flex-1 w-full border-0"
            title="좌측 패널"
            style={{ display: 'block' }}
          />
        </div>

        {/* 드래그 구분선 */}
        <div
          className="w-1.5 h-full bg-[#1e2330] hover:bg-[#C5A258]/60 active:bg-[#C5A258] cursor-col-resize shrink-0 transition-colors relative group"
          onMouseDown={(e) => { e.preventDefault(); dragging.current = true }}
          title="드래그로 패널 크기 조절"
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-0.5 h-4 bg-[#C5A258]/60 rounded-full" />
            ))}
          </div>
        </div>

        {/* 오른쪽 패널 */}
        <div className="flex-1 h-full flex flex-col overflow-hidden">
          <div className="h-5 bg-[#1a1f2e] flex items-center justify-center shrink-0 border-b border-white/5">
            <span className="text-[9px] text-gray-500 font-medium tracking-widest uppercase">Right Panel</span>
          </div>
          <iframe
            src={currentUrl}
            className="flex-1 w-full border-0"
            title="우측 패널"
            style={{ display: 'block' }}
          />
        </div>
      </div>
    </div>
  )
}
