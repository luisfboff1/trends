import type { NextApiResponse } from 'next'
import { withAdmin, type AuthenticatedRequest } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import { UniplusClient } from '@/lib/uniplus-client'

const ALLOWED_TYPES = ['entidades', 'produtos', 'vendas'] as const
type BrowseType = (typeof ALLOWED_TYPES)[number]

async function getClient(): Promise<UniplusClient> {
  const [config] = await sql`
    SELECT server_url, auth_code, user_id, user_password
    FROM uniplus_config WHERE ativo = true LIMIT 1
  `
  if (!config) throw new Error('UniPlus não configurado')
  return new UniplusClient({
    serverUrl: config.server_url,
    authCode: config.auth_code,
    userId: config.user_id,
    userPassword: config.user_password,
  })
}

export default withAdmin(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' })
  }

  const tipo = req.query.tipo as string
  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0

  if (!ALLOWED_TYPES.includes(tipo as BrowseType)) {
    return res.status(400).json({ success: false, error: 'Tipo inválido. Use: entidades, produtos, vendas' })
  }

  try {
    const client = await getClient()

    let data: unknown[]

    switch (tipo as BrowseType) {
      case 'entidades':
        data = await client.get('/public-api/v1/entidades', { limit, offset })
        break
      case 'produtos':
        data = await client.get('/public-api/v1/produtos', { limit, offset })
        break
      case 'vendas':
        data = await client.get('/public-api/v2/venda', { limit, offset })
        break
      default:
        data = []
    }

    return res.json({
      success: true,
      data,
      meta: { tipo, limit, offset, count: data.length },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao buscar dados'
    return res.status(500).json({ success: false, error: message })
  }
})
