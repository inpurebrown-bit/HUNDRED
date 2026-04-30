import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { signOut } from 'next-auth/react'
import SalesDashboard from '@/components/sales/SalesDashboard'

export default async function SalesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any
  if (user.role !== 'sales') redirect('/dashboard')

  return <SalesDashboard userId={user.id} userName={user.name} />
}
