'use client'

import { useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'

// ── 숫자패드 서브컴포넌트 ──────────────────────────────────────────────
function PinInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6)
    onChange(v)
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-[#1B2A45]/60 mb-1.5">{label}</label>
      <div
        className="relative cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {/* dot indicators (visual) */}
        <div className="flex gap-2 p-3 bg-[#F5F3EE] rounded-xl border border-[#E8E2D4] w-full justify-center pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={[
                'w-3 h-3 rounded-full transition-all duration-150',
                i < value.length ? 'bg-[#1B2A45]' : 'bg-[#D5D0C8]',
              ].join(' ')}
            />
          ))}
        </div>
        {/* actual input — full coverage, fully transparent but still interactive */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          style={{ caretColor: 'transparent' }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10 bg-transparent border-0 outline-none"
        />
      </div>
    </div>
  )
}

// ── 메인 탭 ───────────────────────────────────────────────────────────
export default function MyProfileTab() {
  const { data: session } = useSession()
  const user = (session?.user as any) || {}

  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const roleLabel = user.role === 'ceo' ? '대표' : user.role === 'sales' ? '영업팀' : '자금팀'
  const roleBadgeColor =
    user.role === 'ceo'
      ? 'bg-amber-100 text-amber-700'
      : user.role === 'sales'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-emerald-100 text-emerald-700'

  const handleChangePin = useCallback(async () => {
    if (newPin.length !== 6) return setMsg({ type: 'err', text: '새 PIN은 6자리여야 합니다' })
    if (newPin !== confirmPin) return setMsg({ type: 'err', text: '새 PIN이 일치하지 않습니다' })
    if (currentPin.length !== 6) return setMsg({ type: 'err', text: '현재 PIN 6자리를 입력하세요' })

    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/pin/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsg({ type: 'ok', text: 'PIN이 변경되었습니다' })
        setCurrentPin('')
        setNewPin('')
        setConfirmPin('')
      } else {
        setMsg({ type: 'err', text: data.error || 'PIN 변경 실패' })
      }
    } catch {
      setMsg({ type: 'err', text: '서버 오류가 발생했습니다' })
    } finally {
      setSaving(false)
    }
  }, [currentPin, newPin, confirmPin])

  return (
    <div className="max-w-md mx-auto space-y-6 py-2">
      {/* 프로필 카드 */}
      <div className="bg-white rounded-2xl border border-[#E8E2D4] p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1B2A45] to-[#2D4070] flex items-center justify-center shadow-sm">
            <span className="text-white text-xl font-bold">
              {(user.name || '?').charAt(0)}
            </span>
          </div>
          <div>
            <p className="text-base font-bold text-[#1B2A45]">{user.name || '-'}</p>
            <p className="text-xs text-[#1B2A45]/50 mt-0.5">@{user.username || '-'}</p>
          </div>
          <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-semibold ${roleBadgeColor}`}>
            {roleLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[#F8F6F1] rounded-xl p-3">
            <p className="text-[10px] text-[#1B2A45]/40 font-medium mb-1">아이디</p>
            <p className="font-semibold text-[#1B2A45]">{user.username || '-'}</p>
          </div>
          <div className="bg-[#F8F6F1] rounded-xl p-3">
            <p className="text-[10px] text-[#1B2A45]/40 font-medium mb-1">소속</p>
            <p className="font-semibold text-[#1B2A45]">{roleLabel}</p>
          </div>
        </div>
      </div>

      {/* PIN 변경 카드 */}
      <div className="bg-white rounded-2xl border border-[#E8E2D4] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <div>
            <h3 className="text-sm font-bold text-[#1B2A45]">PIN 변경</h3>
            <p className="text-[11px] text-[#1B2A45]/40 mt-0.5">
              초기 PIN은 000000입니다. 본인만 아는 번호로 변경하세요.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <PinInput
            label="현재 PIN (6자리)"
            value={currentPin}
            onChange={setCurrentPin}
            disabled={saving}
          />
          <PinInput
            label="새 PIN (6자리)"
            value={newPin}
            onChange={setNewPin}
            disabled={saving}
          />
          <PinInput
            label="새 PIN 확인"
            value={confirmPin}
            onChange={setConfirmPin}
            disabled={saving}
          />
        </div>

        {msg && (
          <div className={`mt-4 px-3 py-2.5 rounded-xl text-sm font-medium ${
            msg.type === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-600 border border-red-200'
          }`}>
            {msg.text}
          </div>
        )}

        <button
          onClick={handleChangePin}
          disabled={saving || currentPin.length < 6 || newPin.length < 6 || confirmPin.length < 6}
          className="mt-4 w-full py-3 rounded-xl bg-[#1B2A45] text-white text-sm font-semibold
            hover:bg-[#2D4070] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? '변경 중...' : 'PIN 변경하기'}
        </button>
      </div>

      {/* 보안 안내 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-700 mb-1.5">PIN 보안 안내</p>
        <ul className="text-[11px] text-amber-700/80 space-y-1 leading-relaxed">
          <li>• PIN은 5회 연속 틀리면 계정이 자동 잠깁니다</li>
          <li>• 잠기면 대표에게 문의하여 초기화 받으세요</li>
          <li>• 생일, 전화번호 끝 등 추측하기 쉬운 번호는 피하세요</li>
          <li>• PIN은 암호화되어 저장됩니다</li>
        </ul>
      </div>
    </div>
  )
}
