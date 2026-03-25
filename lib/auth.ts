import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import sql from './db'
import { DEFAULT_PERMISSIONS, ALL_FEATURES } from '@/types'
import type { UserTipo } from '@/types'

/** Insert default permissions for a user based on their role */
async function insertDefaultPermissions(userId: number, tipo: UserTipo) {
  const defaults = DEFAULT_PERMISSIONS[tipo] ?? DEFAULT_PERMISSIONS.vendedor
  for (const feature of ALL_FEATURES) {
    await sql`
      INSERT INTO usuario_permissoes (usuario_id, feature, habilitado)
      VALUES (${userId}, ${feature}, ${defaults[feature] ?? false})
      ON CONFLICT (usuario_id, feature) DO NOTHING
    `
  }
}

/** Load permissions from DB for a user */
async function loadPermissions(userId: number, tipo: UserTipo): Promise<Record<string, boolean>> {
  const rows = await sql`
    SELECT feature, habilitado FROM usuario_permissoes WHERE usuario_id = ${userId}
  `
  if (rows.length === 0) {
    // No permissions yet — return defaults (will be seeded on next login via insertDefaultPermissions)
    return { ...(DEFAULT_PERMISSIONS[tipo] ?? DEFAULT_PERMISSIONS.vendedor) }
  }
  const perms: Record<string, boolean> = {}
  for (const r of rows) perms[r.feature] = r.habilitado
  return perms
}

export const authOptions: NextAuthOptions = {
  providers: [
    // ── Google OAuth ────────────────────────────────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ── Email + Senha ────────────────────────────────────────────────────────
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          const [user] = await sql`
            SELECT id, nome, email, senha_hash, tipo, ativo
            FROM usuarios
            WHERE email = ${credentials.email.toLowerCase()} AND senha_hash IS NOT NULL
            LIMIT 1
          `
          if (!user) return null
          if (!user.ativo) return null  // admin não aprovou ainda
          const valid = bcrypt.compareSync(credentials.password, user.senha_hash)
          if (!valid) return null
          const permissoes = await loadPermissions(user.id, user.tipo as UserTipo)
          return { id: String(user.id), name: user.nome, email: user.email, tipo: user.tipo, ativo: true, permissoes }
        } catch (error) {
          console.error('[Auth] Error:', error)
          return null
        }
      },
    }),
  ],

  callbacks: {
    // ── signIn: chamado após autenticar, antes de criar sessão ───────────────
    async signIn({ user, account }) {
      // Apenas fluxo Google
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase()
        if (!email) return false

        const [existing] = await sql`
          SELECT id, ativo, tipo, nome FROM usuarios WHERE email = ${email} LIMIT 1
        `

        if (!existing) {
          // Novo usuário via Google → criar conta pendente (ativo = false)
          const [newUser] = await sql`
            INSERT INTO usuarios (nome, email, google_id, avatar_url, tipo, ativo)
            VALUES (${user.name ?? email}, ${email}, ${user.id}, ${user.image ?? null}, 'vendedor', false)
            RETURNING id
          `
          // Insert default vendedor permissions
          await insertDefaultPermissions(newUser.id, 'vendedor')
          // Redireciona para tela de aguardando aprovação
          return '/aguardando-aprovacao?novo=1'
        }

        if (!existing.ativo) {
          // Usuário existe mas ainda não aprovado
          return '/aguardando-aprovacao'
        }

        // Usuário aprovado → atualiza google_id e avatar se necessário
        await sql`
          UPDATE usuarios SET google_id = ${user.id}, avatar_url = ${user.image ?? null}, updated_at = NOW()
          WHERE email = ${email}
        `
        // Load permissions
        const permissoes = await loadPermissions(existing.id, existing.tipo as UserTipo)
        // Injeta dados extras no objeto user para os callbacks abaixo
        user.id = String(existing.id)
        ;(user as any).tipo = existing.tipo
        ;(user as any).ativo = true
        ;(user as any).nome = existing.nome
        ;(user as any).permissoes = permissoes
      }

      return true
    },

    // ── JWT: persiste dados no token ─────────────────────────────────────────
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.tipo = (user as any).tipo ?? 'vendedor'
        token.ativo = (user as any).ativo ?? true
        token.permissoes = (user as any).permissoes ?? {}
      }
      return token
    },

    // ── Session: expõe dados ao cliente ──────────────────────────────────────
    session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id as string
        ;(session.user as any).tipo = token.tipo as string
        ;(session.user as any).ativo = token.ativo
        ;(session.user as any).permissoes = token.permissoes ?? {}
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
}
