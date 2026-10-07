'use client'

import { ReactNode } from 'react'
import { SessionProvider } from 'next-auth/react'
import '@/lib/fetchCache'

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
