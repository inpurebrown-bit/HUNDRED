'use client'

import { useEffect } from 'react'

// 홈페이지의 사진·글을 쉽게 퍼가지 못하게 막는다(우클릭·끌기·선택·복사·저장 단축키).
// 완전한 차단은 불가능하다(화면 캡처, 개발자 도구). 입력칸에서는 평소처럼 쓸 수 있다.
export default function ContentGuard() {
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof Element && !!t.closest('input, textarea, select, [contenteditable="true"]')
    const block = (e: Event) => { if (!typing(e.target)) e.preventDefault() }
    const keys = (e: KeyboardEvent) => {
      if (typing(e.target) || !(e.ctrlKey || e.metaKey)) return
      if (['s', 'u', 'c', 'x', 'a', 'p'].includes(e.key.toLowerCase())) e.preventDefault()
    }
    const events = ['contextmenu', 'dragstart', 'selectstart', 'copy', 'cut'] as const
    events.forEach(n => document.addEventListener(n, block))
    document.addEventListener('keydown', keys)
    return () => {
      events.forEach(n => document.removeEventListener(n, block))
      document.removeEventListener('keydown', keys)
    }
  }, [])

  return (
    <style>{`
      body { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
      input, textarea, select, [contenteditable="true"] { -webkit-user-select: text; user-select: text; }
      img { pointer-events: none; -webkit-user-drag: none; }
      @media print { body { display: none !important; } }
    `}</style>
  )
}
