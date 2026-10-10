'use client'

import { useEffect } from 'react'

// 화면에 보이는 숫자 중 소수점 3자리 이상(예: 6.800000000000001)은 소수점 둘째 자리까지만 보이도록 정리한다.
// 입력칸(input·textarea)과 스크립트/스타일은 건드리지 않는다. 0 으로 끝나는 자리는 지운다(6.80 → 6.8).
const RE = /(\d+)\.(\d{3,})/g
const HAS = /\d+\.\d{3,}/ // 검사용 (전역 플래그가 없어 상태가 남지 않는다)

function tidy(text: string): string {
  return text.replace(RE, (m, _i, _f) => {
    const n = Number(m)
    if (!isFinite(n)) return m
    return String(parseFloat(n.toFixed(2)))
  })
}

function fixNode(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement
      if (!p) return NodeFilter.FILTER_REJECT
      const tag = p.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'NOSCRIPT') return NodeFilter.FILTER_REJECT
      if (p.isContentEditable) return NodeFilter.FILTER_REJECT
      return HAS.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    },
  })
  const hits: Text[] = []
  let n: Node | null
  while ((n = walker.nextNode())) hits.push(n as Text)
  for (const t of hits) {
    const next = tidy(t.nodeValue || '')
    if (next !== t.nodeValue) t.nodeValue = next
  }
}

export default function DecimalGuard() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const pending = new Set<Node>()
    const flush = () => {
      timer = null
      pending.forEach(n => { if (n.isConnected) fixNode(n) })
      pending.clear()
    }
    const schedule = (n: Node) => { pending.add(n); if (!timer) timer = setTimeout(flush, 30) }

    fixNode(document.body)
    const mo = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.type === 'characterData') { if (m.target.parentElement) schedule(m.target.parentElement) }
        else m.addedNodes.forEach(n => schedule(n.nodeType === 1 ? n : (n.parentElement as Node) || n))
      }
    })
    mo.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => { mo.disconnect(); if (timer) clearTimeout(timer) }
  }, [])
  return null
}
