import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

// 로그인 후 역할에 따라 자동 이동
export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')

  const role = (session.user as any).role

  if (role === 'ceo') redirect('/dashboard/ceo')
  if (role === 'sales') redirect('/dashboard/sales')
  if (role === 'ops') redirect('/dashboard/ops')
  if (role === 'dig') redirect('/dashboard/dig')

  redirect('/login')
}
