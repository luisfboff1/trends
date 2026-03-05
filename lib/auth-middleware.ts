import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export interface AuthenticatedRequest extends NextApiRequest {
  user: {
    id: string
    name: string
    email: string
    tipo: string
  }
}

/**
 * HOF that protects API routes — requires valid NextAuth session
 * Adapts MeguisPet's withSupabaseAuth pattern for NextAuth + Neon
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
 * HOF that requires specific user type (admin)
 */
export function withAdmin(
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void
) {
  return withAuth(async (req, res) => {
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({ success: false, error: 'Acesso negado. Apenas administradores.' })
    }
    return handler(req, res)
  })
}
