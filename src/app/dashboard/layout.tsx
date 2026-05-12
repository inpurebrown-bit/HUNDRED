import type { ReactNode } from 'react'
import PinGate from '@/components/PinGate'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <PinGate>{children}</PinGate>
}
