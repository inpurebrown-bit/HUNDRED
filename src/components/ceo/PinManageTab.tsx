'use client'

import { useState, useEffect, useCallback } from 'react'

interface LockedUser {
  id: string
  name: string
  username: string
  role: string
  pin_fail_count: number
  pin_locked: boolean
}

export default function PinManageTab() {
  const [lockedUsers, setLockedUsers] = useState<LockedUser[]>([])
  const [allUsers, setAllUsers] = useState<LockedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [newPins, setNewPins] = useState<Record<string, string>>({})
  const [msgs, setMsgs] = useState<Record<string, { type: 'ok' | 'err'; text: string }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [lockedRes, allRes] = await Promise.all([
        fetch('/api/pin/locked-users'),
        fetch('/api/users'),
      ])
      const lockedData = await lockedRes.json()
      const allData = await allRes.json()
      setLockedUsers(lockedData.users || [])
      setAllUsers(allData.users || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleReset = useCallback(async (userId: string) => {
    setResettingId(userId)
    setMsgs(prev => ({ ...prev, [userId]: { type: 'ok', text: '' } }))
    try {
      const newPin = newPins[userId]
      const res = await fetch('/api/pin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, newPin }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsgs(prev => ({
          ...prev,
          [userId]: { type: 'ok', text: `✅ ${data.resetTo}(으)로 초기화됨` },
        }))
        setNewPins(prev => { const n = { ...prev }; delete n[userId]; return n })
        load()
      } else {
        setMsgs(prev => ({ ...prev, [userId]: { type: 'err', text: data.error || '실패' } }))
      }
    } catch {
      setMsgs(prev => ({ ...prev, [userId]: { type: 'err', text: '서버 오류' } }))
    } finally {
      setResettingId(null)
    }
  }, [newPins, load])

  const roleLabel = (role: string) =>
    role === 'ceo' ? '대표' : role === 'sales' ? '영업팀' : '자금팀'

  const roleBadge = (role: string) =>
    role === 'ceo'
      ? 'bg-amber-100 text-amber-700'
      : role === 'sales'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-emerald-100 text-emerald-700'

  return (
    <div className="space-y-6">
      {/* 잠긴 계정 */}
      <div className="bg-white rounded-2xl border border-[#E8E2D4] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E8E2D4] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <h3 className="text-sm font-bold text-[#1B2A45]">잠긴 계정</h3>
            {lockedUsers.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-bold">
                {lockedUsers.length}명
              </span>
            )}
          </div>
          <button
            onClick={load}
            className="text-xs text-[#1B2A45]/50 hover:text-[#1B2A45] transition-colors flex items-center gap-1"
          >
            🔄 새로고침
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-10">
            <div className="w-6 h-6 border-2 border-[#C5A258] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lockedUsers.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">✅</p>
            <p className="text-sm text-[#1B2A45]/50">잠긴 계정이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F0EDE6]">
            {lockedUsers.map(u => (
              <div key={u.id} className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-red-500 font-bold text-sm">{u.name.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#1B2A45]">{u.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleBadge(u.role)}`}>
                        {roleLabel(u.role)}
                      </span>
                    </div>
                    <p className="text-xs text-[#1B2A45]/50">@{u.username}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-red-500 font-semibold">PIN 5회 오류</p>
                    <p className="text-[10px] text-[#1B2A45]/40">{u.pin_fail_count}회 실패</p>
                  </div>
                </div>

                {/* PIN 지정 초기화 */}
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="새 PIN (빈칸 = 000000)"
                    value={newPins[u.id] || ''}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setNewPins(prev => ({ ...prev, [u.id]: v }))
                    }}
                    className="flex-1 px-3 py-2 text-sm border border-[#E8E2D4] rounded-xl bg-[#F8F6F1]
                      focus:outline-none focus:border-[#1B2A45]/40 placeholder-[#1B2A45]/30 font-mono tracking-widest"
                  />
                  <button
                    onClick={() => handleReset(u.id)}
                    disabled={resettingId === u.id}
                    className="px-4 py-2 bg-[#1B2A45] text-white text-xs font-semibold rounded-xl
                      hover:bg-[#2D4070] transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {resettingId === u.id ? '처리 중...' : 'PIN 초기화'}
                  </button>
                </div>

                {msgs[u.id]?.text && (
                  <p className={`mt-2 text-xs font-medium ${
                    msgs[u.id].type === 'ok' ? 'text-emerald-600' : 'text-red-500'
                  }`}>
                    {msgs[u.id].text}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 전체 직원 PIN 현황 */}
      <div className="bg-white rounded-2xl border border-[#E8E2D4] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E8E2D4]">
          <div className="flex items-center gap-2">
            <span className="text-lg">👥</span>
            <h3 className="text-sm font-bold text-[#1B2A45]">전체 직원 PIN 관리</h3>
          </div>
          <p className="text-[11px] text-[#1B2A45]/40 mt-0.5">
            특정 직원의 PIN을 강제 초기화할 수 있습니다
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-[#C5A258] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-[#F0EDE6]">
            {allUsers.filter(u => u.role !== 'ceo').map(u => (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F0EDE6] flex items-center justify-center">
                  <span className="text-[#1B2A45] font-bold text-xs">{u.name?.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#1B2A45] truncate">{u.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleBadge(u.role)}`}>
                      {roleLabel(u.role)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="새 PIN"
                    value={newPins[u.id] || ''}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setNewPins(prev => ({ ...prev, [u.id]: v }))
                    }}
                    className="w-24 px-2 py-1.5 text-xs border border-[#E8E2D4] rounded-lg bg-[#F8F6F1]
                      focus:outline-none focus:border-[#1B2A45]/40 placeholder-[#1B2A45]/30 font-mono tracking-widest"
                  />
                  <button
                    onClick={() => handleReset(u.id)}
                    disabled={resettingId === u.id}
                    className="px-3 py-1.5 bg-[#F0EDE6] text-[#1B2A45] text-xs font-semibold rounded-lg
                      hover:bg-[#1B2A45] hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    초기화
                  </button>
                  {msgs[u.id]?.text && (
                    <span className={`text-[10px] font-medium ${
                      msgs[u.id].type === 'ok' ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {msgs[u.id].text}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
