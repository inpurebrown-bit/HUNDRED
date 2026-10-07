// 무거운 조회 API(GET)를 짧게 공유해서 중복 다운로드를 막는다.
// - 같은 주소를 동시에 여러 곳에서 부르면 요청 1번만 보내고 결과를 나눠 쓴다 (15초)
// - 저장·수정·삭제(GET 이외) 요청이 하나라도 나가면 캐시를 모두 비워 최신 값을 보장한다
const TTL = 15_000
const CACHEABLE = [/^\/api\/customers(\?.*)?$/, /^\/api\/ops-cases(\?.*)?$/, /^\/api\/revenue(\?.*)?$/, /^\/api\/payrate(\?.*)?$/, /^\/api\/users(\?.*)?$/]

declare global { interface Window { __hcFetchCache?: boolean } }

if (typeof window !== 'undefined' && !window.__hcFetchCache) {
  window.__hcFetchCache = true
  const orig = window.fetch.bind(window)
  const cache = new Map<string, { t: number; p: Promise<Response> }>()

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.pathname + input.search : (input as Request).url
      const method = (init?.method || (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET') || 'GET').toUpperCase()
      const path = rawUrl.replace(/^https?:\/\/[^/]+/, '')
      if (path.startsWith('/api/') && method !== 'GET') {
        cache.clear()
        return orig(input, init)
      }
      if (method === 'GET' && !init?.signal && CACHEABLE.some(re => re.test(path))) {
        const hit = cache.get(path)
        if (hit && Date.now() - hit.t < TTL) return hit.p.then(r => r.clone())
        const p = orig(input, init)
        cache.set(path, { t: Date.now(), p })
        p.then(r => { if (!r.ok) cache.delete(path) }).catch(() => cache.delete(path))
        return p.then(r => r.clone())
      }
    } catch { /* 캐시 실패 시 일반 fetch */ }
    return orig(input, init)
  }
}

export {}
