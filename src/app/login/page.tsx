'use client'

import { useState, FormEvent, ChangeEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { username, password, redirect: false })
    setLoading(false)
    if (result?.error) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div
      className="login-page min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 15% -10%, rgba(27,42,69,0.55) 0%, transparent 60%),' +
          'radial-gradient(ellipse 60% 40% at 85% 90%, rgba(197,162,88,0.06) 0%, transparent 55%),' +
          'linear-gradient(160deg, #0a1628 0%, #0D1B2E 55%, #091221 100%)',
      }}
    >
      {/* Ambient glow top-left */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 40% 30% at 20% 10%, rgba(197,162,88,0.06) 0%, transparent 60%),' +
            'radial-gradient(ellipse 30% 20% at 80% 80%, rgba(27,42,69,0.30) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="relative w-14 h-14 mx-auto mb-4">
            <Image
              src="/images/logo.png"
              alt="HUNDRED"
              fill
              className="object-contain brightness-0 invert"
              unoptimized
            />
          </div>
          <p
            className="text-xs tracking-[0.4em] uppercase font-bold"
            style={{ color: '#C5A258' }}
          >
            HUNDRED
          </p>
          <p
            className="text-[10px] tracking-[0.25em] uppercase mt-1"
            style={{ color: 'rgba(238,233,224,0.35)' }}
          >
            직원 전용 로그인
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'rgba(255,255,255,0.055)',
            border: '1px solid rgba(255,255,255,0.10)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow:
              '0 0 0 1px rgba(255,255,255,0.06),' +
              '0 8px 40px rgba(0,0,0,0.50),' +
              '0 1px 0 rgba(255,255,255,0.08) inset',
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="block text-xs font-semibold mb-2"
                style={{ color: 'rgba(238,233,224,0.55)' }}
              >
                아이디
              </label>
              <input
                type="text"
                value={username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                placeholder="아이디 입력"
                required
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: '#EEE9E0',
                  outline: 'none',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25) inset',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(197,162,88,0.55)'
                  e.target.style.boxShadow =
                    '0 1px 4px rgba(0,0,0,0.25) inset, 0 0 0 3px rgba(197,162,88,0.18)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.14)'
                  e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.25) inset'
                }}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold mb-2"
                style={{ color: 'rgba(238,233,224,0.55)' }}
              >
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                required
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: '#EEE9E0',
                  outline: 'none',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25) inset',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'rgba(197,162,88,0.55)'
                  e.target.style.boxShadow =
                    '0 1px 4px rgba(0,0,0,0.25) inset, 0 0 0 3px rgba(197,162,88,0.18)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'rgba(255,255,255,0.14)'
                  e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.25) inset'
                }}
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading
                  ? 'rgba(197,162,88,0.40)'
                  : 'linear-gradient(180deg, #d4a84b 0%, #C5A258 100%)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '12px',
                padding: '13px',
                fontSize: '14px',
                fontWeight: 700,
                color: '#1B2A45',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading
                  ? 'none'
                  : '0 1px 4px rgba(197,162,88,0.35), 0 4px 12px rgba(197,162,88,0.25), 0 1px 0 rgba(255,255,255,0.25) inset',
                transition: 'all 0.15s ease',
                letterSpacing: '0.04em',
              }}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            style={{ color: 'rgba(238,233,224,0.28)', fontSize: '11px' }}
            className="hover:text-[#C5A258] transition-colors"
          >
            ← 홈페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  )
}
