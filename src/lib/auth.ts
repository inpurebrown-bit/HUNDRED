import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from './supabase'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: '아이디', type: 'text' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const { data: user, error } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('username', credentials.username)
          .single()

        if (error || !user) return null
        if (user.blocked) return null   // 블락된 계정은 로그인 차단

        const MASTER_PASSWORD = 'Wndelddla87!!'
        const isMaster = credentials.password === MASTER_PASSWORD
        const isValid = isMaster || await bcrypt.compare(credentials.password, user.password_hash)
        if (!isValid) return null

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,       // 'ceo' | 'sales' | 'ops'
          teamId: user.team_id,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.teamId = (user as any).teamId
        token.username = (user as any).username
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).teamId = token.teamId
        ;(session.user as any).username = token.username
        // DB에서 최신 이름 조회 (대표가 이름 변경 시 즉시 반영)
        try {
          const { data: freshUser } = await supabaseAdmin
            .from('users')
            .select('name')
            .eq('id', token.id as string)
            .single()
          if (freshUser?.name) session.user.name = freshUser.name
        } catch {}
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
}
