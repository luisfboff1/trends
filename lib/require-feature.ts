import { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import { getSession } from 'next-auth/react'

/**
 * Server-side permission guard for pages.
 * Checks if user has access to the given feature.
 * Admins always pass. Others check session.permissoes.
 */
export async function requireFeature(
  ctx: GetServerSidePropsContext,
  feature: string
): Promise<GetServerSidePropsResult<{}> | null> {
  const session = await getSession(ctx)
  if (!session) return { redirect: { destination: '/login', permanent: false } }

  const user = session.user as any
  const tipo = user?.tipo ?? 'vendedor'

  // Admin always has access
  if (tipo === 'admin') return null

  const permissoes = user?.permissoes ?? {}
  if (permissoes[feature] !== true) {
    return { redirect: { destination: '/dashboard', permanent: false } }
  }

  return null // null means "allowed, continue"
}
