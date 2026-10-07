'use client'

import { useState, useEffect, useCallback } from 'react'

interface Req {
  id: string; at: string; exp: number; type: 'id' | 'pw'; code: string; tries: number; used: boolean; expired: boolean
  by?: { name: string; phone: string; username: string; at: string }; last_try?: string
}

export default function AuthCodeTab() {
  const [items, setItems] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/auth-help', { cache: 'no-store' })
      const j = await r.json()
      setItems(j.items || [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(() => { load(); setNow(Date.now()) }, 15000)
    return () => clearInterval(t)
  }, [load])

  async function remove(id: string) {
    await fetch(`/api/auth-help?id=${id}`, { method: 'DELETE' })
    load()
  }

  const status = (i: Req) =>
    i.used ? { t: '사용 완료', c: 'bg-emerald-100 text-emerald-700' }
    : i.tries >= 5 ? { t: '오입력 폐기', c: 'bg-red-100 text-red-600' }
    : i.exp < now ? { t: '만료', c: 'bg-gray-100 text-gray-500' }
    : { t: `유효 ${Math.max(1, Math.ceil((i.exp - now) / 60000))}분`, c: 'bg-amber-100 text-amber-700' }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-black text-[#1B2A45]">코드 요청</h2>
        <p className="text-xs text-[#1B2A45]/55 mt-1 leading-relaxed">
          로그인 화면에서 '코드 요청'을 누르면 여기에 코드가 생깁니다. 누가 요청했는지는 알 수 없으니
          <b>전화·대면으로 본인이 맞는지 확인한 뒤</b> 코드를 알려주세요. 코드를 받은 사람이 이름·연락처까지 맞게 입력해야 처리됩니다.
          코드는 30분간 유효하고 1회만 쓸 수 있습니다.
        </p>
      </div>

      {loading ? <p className="text-sm text-gray-400">불러오는 중...</p>
        : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E2D4] p-12 text-center text-sm text-[#1B2A45]/40">요청이 없습니다</div>
        ) : (
          <div className="space-y-3">
            {items.map(i => {
              const st = status(i)
              const live = !i.used && !i.expired && i.tries < 5
              return (
                <div key={i.id} className={`bg-white rounded-2xl border border-[#E8E2D4] p-4 flex items-center gap-4 flex-wrap ${live ? '' : 'opacity-60'}`}>
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#1B2A45]">{i.type === 'id' ? '아이디 찾기' : '비밀번호 재설정'} 요청</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${st.c}`}>{st.t}</span>
                    </div>
                    <p className="text-xs text-[#1B2A45]/55 mt-1.5">
                      {new Date(i.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 요청
                      {i.by && <> · <b className="text-[#1B2A45]/80">{i.by.name}</b> ({i.by.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')}) · 아이디 {i.by.username}</>}
                      {!i.by && i.last_try && <> · 입력된 이름 "{i.last_try}" (불일치 {i.tries}회)</>}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-[#1B2A45]/40 mb-0.5">인증 코드</p>
                    <p className="text-2xl font-black tracking-[0.25em] tabular-nums text-[#1B2A45]">{live ? i.code : '······'}</p>
                  </div>
                  <button onClick={() => remove(i.id)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1">삭제</button>
                </div>
              )
            })}
          </div>
        )}
    </div>
  )
}
