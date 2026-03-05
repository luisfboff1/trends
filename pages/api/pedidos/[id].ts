import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { ApiResponse, Pedido } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const user = (req as any).user
  const pedidoId = Number(id)
  if (isNaN(pedidoId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  const [pedido] = await sql`SELECT * FROM pedidos WHERE id = ${pedidoId}`
  if (!pedido) return res.status(404).json({ success: false, error: 'Pedido não encontrado' })
  if (user.tipo !== 'admin' && pedido.vendedor_id !== user.id) {
    return res.status(403).json({ success: false, error: 'Sem permissão' })
  }

  if (req.method === 'GET') {
    return res.json({ success: true, data: pedido as Pedido })
  }

  if (req.method === 'PUT') {
    const body = req.body
    const [updated] = await sql`
      UPDATE pedidos SET
        status       = ${body.status ?? pedido.status},
        observacoes  = ${body.observacoes ?? pedido.observacoes},
        data_entrega = ${body.data_entrega ?? pedido.data_entrega},
        updated_at   = NOW()
      WHERE id = ${pedidoId}
      RETURNING *
    `
    return res.json({ success: true, data: updated as Pedido })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
