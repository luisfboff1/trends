import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export interface AuthenticatedRequest extends NextApiRequest {
  user: {
    id: string
    name: string
    email: string
    tipo: string
    permissoes: Record<string, boolean>
  }
}

/**
 * HOF that protects API routes — requires valid NextAuth session
 */
export function withAuth(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user) {
      return res.status(401).json({ success: false, error: 'Não autorizado' })
    }
    const authedReq = req as AuthenticatedRequest
    authedReq.user = session.user as AuthenticatedRequest['user']
    return handler(authedReq, res)
  }
}

/**
 * HOF that requires specific roles
 */
export function withRole(
  roles: string[],
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void
) {
  return withAuth(async (req, res) => {
    if (!roles.includes(req.user.tipo)) {
      return res.status(403).json({ success: false, error: 'Acesso negado. Permissão insuficiente.' })
    }
    return handler(req, res)
  })
}

/**
 * HOF that requires admin role
 */
export function withAdmin(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void
) {
  return withRole(['admin'], handler)
}
