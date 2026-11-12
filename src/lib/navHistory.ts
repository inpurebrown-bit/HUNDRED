'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 화면 이동 기록 도구 (모든 대시보드 공통)
 *
 * 1) useHistoryState — 탭 같은 "지금 보는 화면"을 주소(#키=값)에 남긴다.
 *    · 뒤로가기/앞으로가기 → 바로 이전 탭으로 이동 (사이트 밖으로 나가지 않음)
 *    · 새로고침 → 보던 탭 그대로 (오래 두어 PIN 잠금이 걸리면 PIN 입력 후 같은 자리로 복귀)
 * 2) useBackToClose — 카드·모달·패널처럼 "열려 있는 것"을 뒤로가기로 닫는다.
 */

const readHash = (key: string): string | null => {
  try { return new URLSearchParams(window.location.hash.replace(/^#/, '')).get(key) } catch { return null }
}

export function useHistoryState<T extends string>(key: string, initial: T, valid?: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial)
  const ok = (v: string | null): v is T => !!v && (!valid || (valid as readonly string[]).includes(v))
  const validRef = useRef(valid); validRef.current = valid

  useEffect(() => {
    // 새로고침으로 다시 열렸을 때 주소에 남은 탭을 복원
    const first = readHash(key)
    if (ok(first)) setValue(first)
    // 뒤로/앞으로 가기 — 주소에 남은 값으로 이동 (없으면 처음 화면)
    const onPop = () => { const v = readHash(key); setValue(ok(v) ? v : initial) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const set = useCallback((v: T) => {
    try {
      const p = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      if (p.get(key) !== v) {
        p.set(key, v)
        window.history.pushState(window.history.state, '', window.location.pathname + window.location.search + '#' + p.toString())
      }
    } catch { /* 주소를 못 바꿔도 화면은 바꾼다 */ }
    setValue(v)
  }, [key])

  return [value, set]
}

// ── 열려 있는 것(카드·모달·패널)을 뒤로가기로 닫기 ──
type Entry = { id: number; close: () => void }
const stack: Entry[] = []
let seq = 0
let selfBack = 0          // 우리가 직접 history.back() 한 횟수 — 그 popstate 는 무시
let bound = false

function onPop() {
  if (selfBack > 0) { selfBack--; return }
  const top = stack.pop()   // 가장 위에 열린 것부터 닫는다
  top?.close()
}

export function useBackToClose(open: boolean, close: () => void) {
  const closeRef = useRef(close); closeRef.current = close
  useEffect(() => {
    if (!open) return
    if (!bound) { window.addEventListener('popstate', onPop); bound = true }
    const entry: Entry = { id: ++seq, close: () => closeRef.current() }
    stack.push(entry)
    try { window.history.pushState(window.history.state, '') } catch { /* ignore */ }
    return () => {
      const i = stack.indexOf(entry)
      if (i >= 0) {
        // 뒤로가기가 아니라 화면에서 직접 닫은 경우 — 우리가 쌓은 기록 한 칸을 되돌린다
        stack.splice(i, 1)
        selfBack++
        try { window.history.back() } catch { selfBack-- }
      }
    }
  }, [open])
}
