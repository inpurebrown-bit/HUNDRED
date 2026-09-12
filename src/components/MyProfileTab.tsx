'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'

// ── PIN 입력 컴포넌트 ──────────────────────────────────────────────────
function PinInput({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (v: string) => void; disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label className="block text-xs font-semibold text-[#1B2A45]/60 mb-1.5">{label}</label>
      <div className="relative cursor-text" onClick={() => inputRef.current?.focus()}>
        <div className="flex gap-2 p-3 bg-[#F5F3EE] rounded-xl border border-[#E8E2D4] w-full justify-center pointer-events-none">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full transition-all duration-150 ${i < value.length ? 'bg-[#1B2A45]' : 'bg-[#D5D0C8]'}`} />
          ))}
        </div>
        <input
          ref={inputRef}
          type="tel" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={disabled}
          style={{ caretColor: 'transparent' }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text z-10 bg-transparent border-0 outline-none"
        />
      </div>
    </div>
  )
}

// ── 텍스트 입력 ────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, type = 'text', readOnly }: {
  label: string; value: string; onChange?: (v: string) => void; placeholder?: string; type?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#1B2A45]/60 mb-1.5">{label}</label>
      {readOnly ? (
        <div className="px-3 py-2.5 bg-[#F5F3EE] border border-[#E8E2D4] rounded-xl text-sm text-[#1B2A45]/60 font-mono">
          {value || '-'}
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 bg-[#F5F3EE] border border-[#E8E2D4] rounded-xl text-sm text-[#1B2A45] focus:outline-none focus:border-[#1B2A45]/40 focus:ring-1 focus:ring-[#1B2A45]/10 transition-colors"
        />
      )}
    </div>
  )
}

const BANKS = ['카카오뱅크', '토스뱅크', '국민은행', '신한은행', '하나은행', '우리은행', '농협', '기업은행', '케이뱅크', '씨티은행', '기타']

// ── 메인 ─────────────────────────────────────────────────────────────
export default function MyProfileTab() {
  const { data: session } = useSession()
  const user = (session?.user as any) || {}

  // 프로필 데이터
  const [profile, setProfile] = useState({
    name: '', username: '', role: '',
    phone: '', address: '', bank_account: '', bank_name: '카카오뱅크', join_date: '',
    info_locked: false,
  })
  const [loadingProfile, setLoadingProfile] = useState(true)

  // 기본정보 편집
  const [infoEditing, setInfoEditing] = useState(false)
  const [infoForm, setInfoForm] = useState({ ...profile })
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoMsg, setInfoMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // 비밀번호 변경
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // PIN 변경
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [pinMsg, setPinMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const roleLabel = { ceo: '대표', sales: '영업팀', ops: '관리팀', dig: '발굴팀' }[profile.role] || profile.role
  const roleBadge = { ceo: 'bg-amber-100 text-amber-700', sales: 'bg-blue-100 text-blue-700', ops: 'bg-violet-100 text-violet-700', dig: 'bg-orange-100 text-orange-700' }[profile.role] || 'bg-gray-100 text-gray-600'

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        if (d.profile) {
          setProfile(d.profile)
          setInfoForm(d.profile)
        }
      })
      .finally(() => setLoadingProfile(false))
  }, [])

  // ── 기본정보 저장 ──────────────────────────────────────────────────
  const saveInfo = useCallback(async () => {
    setInfoSaving(true)
    setInfoMsg(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: infoForm.name,
          phone: infoForm.phone,
          address: infoForm.address,
          bank_account: infoForm.bank_account,
          bank_name: infoForm.bank_name,
          join_date: infoForm.join_date,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setProfile(prev => ({ ...prev, ...infoForm, name: data.name || infoForm.name, info_locked: true }))
        setInfoEditing(false)
        setInfoMsg({ type: 'ok', text: '저장되었습니다. 이후 수정은 대표에게 요청하세요.' })
        setTimeout(() => setInfoMsg(null), 4000)
      } else {
        setInfoMsg({ type: 'err', text: data.error || '저장 실패' })
      }
    } catch {
      setInfoMsg({ type: 'err', text: '서버 오류가 발생했습니다' })
    } finally {
      setInfoSaving(false)
    }
  }, [infoForm])

  // ── 비밀번호 변경 ──────────────────────────────────────────────────
  const savePassword = useCallback(async () => {
    if (pwForm.next !== pwForm.confirm) return setPwMsg({ type: 'err', text: '새 비밀번호가 일치하지 않습니다' })
    if (pwForm.next.length < 4) return setPwMsg({ type: 'err', text: '비밀번호는 4자 이상이어야 합니다' })
    setPwSaving(true)
    setPwMsg(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      })
      const data = await res.json()
      if (data.ok) {
        setPwMsg({ type: 'ok', text: '비밀번호가 변경되었습니다' })
        setPwForm({ current: '', next: '', confirm: '' })
      } else {
        setPwMsg({ type: 'err', text: data.error || '변경 실패' })
      }
    } catch {
      setPwMsg({ type: 'err', text: '서버 오류가 발생했습니다' })
    } finally {
      setPwSaving(false)
    }
  }, [pwForm])

  // ── PIN 변경 ───────────────────────────────────────────────────────
  const savePin = useCallback(async () => {
    if (newPin.length !== 6) return setPinMsg({ type: 'err', text: '새 PIN은 6자리여야 합니다' })
    if (newPin !== confirmPin) return setPinMsg({ type: 'err', text: '새 PIN이 일치하지 않습니다' })
    if (currentPin.length !== 6) return setPinMsg({ type: 'err', text: '현재 PIN 6자리를 입력하세요' })
    setPinSaving(true)
    setPinMsg(null)
    try {
      const res = await fetch('/api/pin/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPin, newPin }),
      })
      const data = await res.json()
      if (data.ok) {
        setPinMsg({ type: 'ok', text: 'PIN이 변경되었습니다' })
        setCurrentPin(''); setNewPin(''); setConfirmPin('')
      } else {
        setPinMsg({ type: 'err', text: data.error || 'PIN 변경 실패' })
      }
    } catch {
      setPinMsg({ type: 'err', text: '서버 오류가 발생했습니다' })
    } finally {
      setPinSaving(false)
    }
  }, [currentPin, newPin, confirmPin])

  if (loadingProfile) return <div className="py-16 text-center text-sm text-gray-400">불러오는 중...</div>

  return (
    <div className="max-w-md mx-auto space-y-5 py-2">

      {/* ── 계정 카드 ── */}
      <div className="bg-white rounded-2xl border border-[#E8E2D4] p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1B2A45] to-[#2D4070] flex items-center justify-center shadow-sm">
            <span className="text-white text-xl font-bold">{(profile.name || '?').charAt(0)}</span>
          </div>
          <div>
            <p className="text-base font-bold text-[#1B2A45]">{profile.name || '-'}</p>
            <p className="text-xs text-[#1B2A45]/50 mt-0.5">@{profile.username || '-'}</p>
          </div>
          <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-semibold ${roleBadge}`}>{roleLabel}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[#F8F6F1] rounded-xl p-3">
            <p className="text-[10px] text-[#1B2A45]/40 font-medium mb-1">아이디 (변경 불가)</p>
            <p className="font-semibold text-[#1B2A45] font-mono text-xs">{profile.username || '-'}</p>
          </div>
          <div className="bg-[#F8F6F1] rounded-xl p-3">
            <p className="text-[10px] text-[#1B2A45]/40 font-medium mb-1">소속</p>
            <p className="font-semibold text-[#1B2A45]">{roleLabel}</p>
          </div>
        </div>
      </div>

      {/* ── 기본정보 ── */}
      <div className="bg-white rounded-2xl border border-[#E8E2D4] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold text-[#1B2A45]">기본정보</h3>
            <p className="text-[11px] text-[#1B2A45]/40 mt-0.5">이름·연락처·계좌 등 대표에게 공유되는 정보</p>
          </div>
          {!infoEditing && (
            profile.info_locked ? (
              <span className="text-xs px-3 py-1.5 rounded-xl bg-gray-100 text-gray-400 font-medium flex items-center gap-1">
                🔒 수정 잠금 (대표 해제 필요)
              </span>
            ) : (
              <button onClick={() => { setInfoEditing(true); setInfoForm({ ...profile }) }}
                className="text-xs px-3 py-1.5 rounded-xl bg-[#1B2A45]/10 text-[#1B2A45] hover:bg-[#1B2A45]/20 font-medium transition-colors">
                수정
              </button>
            )
          )}
        </div>

        {infoEditing ? (
          <div className="space-y-3">
            <Field label="이름 (실명)" value={infoForm.name} onChange={v => setInfoForm(f => ({ ...f, name: v }))} placeholder="홍길동" />
            <Field label="연락처" value={infoForm.phone} onChange={v => setInfoForm(f => ({ ...f, phone: v }))} placeholder="010-0000-0000" />
            <Field label="주소" value={infoForm.address} onChange={v => setInfoForm(f => ({ ...f, address: v }))} placeholder="서울시 ..." />
            <div>
              <label className="block text-xs font-semibold text-[#1B2A45]/60 mb-1.5">은행</label>
              <select
                value={infoForm.bank_name}
                onChange={e => setInfoForm(f => ({ ...f, bank_name: e.target.value }))}
                className="w-full px-3 py-2.5 bg-[#F5F3EE] border border-[#E8E2D4] rounded-xl text-sm text-[#1B2A45] focus:outline-none focus:border-[#1B2A45]/40">
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <Field label="계좌번호" value={infoForm.bank_account} onChange={v => setInfoForm(f => ({ ...f, bank_account: v }))} placeholder="000-000000-00-000" />
            <Field label="입사일" value={infoForm.join_date} onChange={v => setInfoForm(f => ({ ...f, join_date: v }))} type="date" />
            {infoMsg && (
              <div className={`px-3 py-2.5 rounded-xl text-sm font-medium ${infoMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {infoMsg.text}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={saveInfo} disabled={infoSaving}
                className="flex-1 py-2.5 rounded-xl bg-[#1B2A45] text-white text-sm font-semibold hover:bg-[#2D4070] transition-colors disabled:opacity-40">
                {infoSaving ? '저장 중...' : '저장'}
              </button>
              <button onClick={() => { setInfoEditing(false); setInfoMsg(null) }}
                className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors">
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {[
              { label: '이름', value: profile.name },
              { label: '연락처', value: profile.phone },
              { label: '주소', value: profile.address },
              { label: '은행', value: profile.bank_name },
              { label: '계좌번호', value: profile.bank_account },
              { label: '입사일', value: profile.join_date },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-b-0">
                <span className="text-[11px] text-[#1B2A45]/40 font-medium w-16 shrink-0">{label}</span>
                <span className="text-sm text-[#1B2A45] font-medium">{value || <span className="text-gray-300">미입력</span>}</span>
              </div>
            ))}
            {infoMsg?.type === 'ok' && (
              <div className="mt-2 px-3 py-2 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">{infoMsg.text}</div>
            )}
          </div>
        )}
      </div>

      {/* ── 비밀번호 변경 ── */}
      <div className="bg-white rounded-2xl border border-[#E8E2D4] p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-sm font-bold text-[#1B2A45]">비밀번호 변경</h3>
          <p className="text-[11px] text-[#1B2A45]/40 mt-0.5">초기 비밀번호는 1234입니다. 본인만 아는 비밀번호로 변경하세요</p>
        </div>
        <div className="space-y-3">
          {[
            { label: '현재 비밀번호', key: 'current' as const },
            { label: '새 비밀번호', key: 'next' as const },
            { label: '새 비밀번호 확인', key: 'confirm' as const },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-[#1B2A45]/60 mb-1.5">{label}</label>
              <input
                type="password"
                value={pwForm[key]}
                onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={key === 'current' ? '현재 비밀번호 입력' : '4자 이상'}
                className="w-full px-3 py-2.5 bg-[#F5F3EE] border border-[#E8E2D4] rounded-xl text-sm text-[#1B2A45] focus:outline-none focus:border-[#1B2A45]/40 focus:ring-1 focus:ring-[#1B2A45]/10"
              />
            </div>
          ))}
        </div>
        {pwMsg && (
          <div className={`mt-4 px-3 py-2.5 rounded-xl text-sm font-medium ${pwMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {pwMsg.text}
          </div>
        )}
        <button
          onClick={savePassword}
          disabled={pwSaving || !pwForm.current || pwForm.next.length < 4 || !pwForm.confirm}
          className="mt-4 w-full py-3 rounded-xl bg-[#1B2A45] text-white text-sm font-semibold hover:bg-[#2D4070] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {pwSaving ? '변경 중...' : '비밀번호 변경'}
        </button>
      </div>

      {/* ── PIN 변경 ── */}
      <div className="bg-white rounded-2xl border border-[#E8E2D4] p-6 shadow-sm">
        <div className="mb-5">
          <h3 className="text-sm font-bold text-[#1B2A45]">PIN 변경</h3>
          <p className="text-[11px] text-[#1B2A45]/40 mt-0.5">초기 PIN은 000000입니다. 본인만 아는 번호로 변경하세요</p>
        </div>
        <div className="space-y-4">
          <PinInput label="현재 PIN (6자리)" value={currentPin} onChange={setCurrentPin} disabled={pinSaving} />
          <PinInput label="새 PIN (6자리)" value={newPin} onChange={setNewPin} disabled={pinSaving} />
          <PinInput label="새 PIN 확인" value={confirmPin} onChange={setConfirmPin} disabled={pinSaving} />
        </div>
        {pinMsg && (
          <div className={`mt-4 px-3 py-2.5 rounded-xl text-sm font-medium ${pinMsg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {pinMsg.text}
          </div>
        )}
        <button
          onClick={savePin}
          disabled={pinSaving || currentPin.length < 6 || newPin.length < 6 || confirmPin.length < 6}
          className="mt-4 w-full py-3 rounded-xl bg-[#1B2A45] text-white text-sm font-semibold hover:bg-[#2D4070] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {pinSaving ? '변경 중...' : 'PIN 변경하기'}
        </button>
      </div>

      {/* 보안 안내 */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-700 mb-1.5">보안 안내</p>
        <ul className="text-[11px] text-amber-700/80 space-y-1 leading-relaxed">
          <li>• 아이디는 변경할 수 없습니다</li>
          <li>• PIN은 5회 연속 틀리면 계정이 자동 잠깁니다</li>
          <li>• 잠기면 대표에게 문의하여 초기화 받으세요</li>
          <li>• 생일, 전화번호 끝 등 추측하기 쉬운 번호는 피하세요</li>
        </ul>
      </div>
    </div>
  )
}
