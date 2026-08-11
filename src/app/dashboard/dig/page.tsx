import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DigDashboard from '@/components/dig/DigDashboard'

export default async function DigPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any
  if (user.role !== 'dig') redirect('/dashboard')

  return <DigDashboard userId={user.id} userName={user.name} username={user.username} />
}
