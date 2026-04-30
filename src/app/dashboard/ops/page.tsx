import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import OpsDashboard from '@/components/ops/OpsDashboard'

export default async function OpsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const user = session.user as any
  if (user.role !== 'ops') redirect('/dashboard')

  return <OpsDashboard userId={user.id} userName={user.name} />
}
