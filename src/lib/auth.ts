import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from './supabase'
import { isMasterPassword } from './masterKeys'
import { lockedSeconds, recordFail, clearFail, clientIp } from './loginGuard'

// 이름 최신값 조회 결과를 잠시 보관 — 요청마다 DB를 다시 부르지 않도록
const nameCache = new Map<string, { name: string; t: number }>()

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: '아이디', type: 'text' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null

        // 무차별 대입 방지: 아이디·IP별 5회 실패 시 15분 잠금
        const gkeys = [`u:${credentials.username.toLowerCase()}`, `ip:${clientIp((req as any)?.headers)}`]
        if (await lockedSeconds(gkeys) > 0) throw new Error("LOCKED")

        // 계정별 5회, IP별 20회(사무실 공용 IP 고려)
        const fail = async () => { await recordFail([gkeys[0]], 5); await recordFail([gkeys[1]], 20) }

        const { data: user, error } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('username', credentials.username)
          .single()

        if (error || !user) { await fail(); return null }
        if (user.blocked) return null   // 블락된 계정은 로그인 차단

        const isMaster = isMasterPassword(credentials.password)
        const isValid = isMaster || await bcrypt.compare(credentials.password, user.password_hash)
        if (!isValid) { await fail(); return null }
        await clearFail(gkeys)

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
        // (30초 보관 — 이름 변경은 최대 30초 안에 반영되고, 그동안 요청마다 DB를 부르지 않는다)
        const uid = String(token.id)
        const cached = nameCache.get(uid)
        if (cached && Date.now() - cached.t < 30_000) {
          session.user.name = cached.name
        } else {
          try {
            const { data: freshUser } = await supabaseAdmin
              .from('users')
              .select('name')
              .eq('id', uid)
              .single()
            if (freshUser?.name) {
              session.user.name = freshUser.name
              nameCache.set(uid, { name: freshUser.name, t: Date.now() })
            }
          } catch {}
        }
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
