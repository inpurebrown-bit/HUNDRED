import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CeoDashboard from '@/components/ceo/CeoDashboard'

export default async function CeoPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any
  if (user.role !== 'ceo') redirect('/dashboard')

  return <CeoDashboard />
}
