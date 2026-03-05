import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { ApiResponse, PaginatedResponse, Pedido } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user

  if (req.method === 'GET') {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const offset = (page - 1) * limit
    const status = req.query.status as string | undefined
    const isAdmin = user.tipo === 'admin'

    const [{ count }] = await sql`
      SELECT COUNT(*) FROM pedidos p
      WHERE ${isAdmin ? sql`true` : sql`p.vendedor_id = ${user.id}`}
      ${status ? sql`AND p.status = ${status}` : sql``}
    `
    const data = await sql`
      SELECT p.*, c.razao_social as cliente_nome, u.nome as vendedor_nome
      FROM pedidos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN usuarios u ON p.vendedor_id = u.id
      WHERE ${isAdmin ? sql`true` : sql`p.vendedor_id = ${user.id}`}
      ${status ? sql`AND p.status = ${status}` : sql``}
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    return res.json({
      success: true,
      data: { data: data as unknown as Pedido[], total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) }
    })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
