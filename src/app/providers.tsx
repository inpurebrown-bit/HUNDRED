'use client'

import { ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import '@/lib/fetchCache'
import DecimalGuard from '@/components/DecimalGuard'

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider><DecimalGuard />{children}</SessionProvider>
}
