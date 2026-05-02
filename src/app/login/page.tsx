'use client'

import { useState } from 'react'
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

  async function handleSubmit(e: React.FormEvent) {
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
    <div className="min-h-screen bg-[#FAF8F3] flex flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <div className="relative w-16 h-16 mx-auto mb-3">
          <Image src="/images/logo.png" alt="HUNDRED" fill className="object-contain" unoptimized />
        </div>
        <p className="text-xs tracking-[0.3em] text-[#C5A258] uppercase font-bold">HUNDRED</p>
        <p className="text-[10px] tracking-[0.2em] text-[#1B2A45]/40 uppercase mt-0.5">직원 전용 로그인</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#E8E2D4] p-8 w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1B2A45]/60 mb-1.5">아이디</label>
            <input type="text" value={username}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              className="w-full border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-4 py-3 text-sm text-[#1B2A45] bg-[#FAF8F3] outline-none transition-colors"
              placeholder="아이디 입력" required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1B2A45]/60 mb-1.5">비밀번호</label>
            <input type="password" value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              className="w-full border border-[#E8E2D4] focus:border-[#C5A258]/60 rounded-xl px-4 py-3 text-sm text-[#1B2A45] bg-[#FAF8F3] outline-none transition-colors"
              placeholder="비밀번호 입력" required />
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-[#C5A258] hover:bg-[#D4B568] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors">
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>

      <Link href="/" className="mt-6 text-xs text-[#1B2A45]/30 hover:text-[#C5A258]/60 transition-colors">
        ← 홈페이지로 돌아가기
      </Link>
    </div>
  )
}
