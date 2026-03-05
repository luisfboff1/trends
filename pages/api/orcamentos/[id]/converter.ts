import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { ApiResponse, Pedido } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Método não permitido' })

  const { id } = req.query
  const user = (req as any).user
  const orcId = Number(id)

  const [orc] = await sql`SELECT * FROM orcamentos WHERE id = ${orcId}`
  if (!orc) return res.status(404).json({ success: false, error: 'Orçamento não encontrado' })
  if (user.tipo !== 'admin' && orc.vendedor_id !== user.id) {
    return res.status(403).json({ success: false, error: 'Sem permissão' })
  }
  if (orc.status !== 'aprovado') {
    return res.status(400).json({ success: false, error: 'Somente orçamentos aprovados podem ser convertidos' })
  }

  const year = new Date().getFullYear()
  const [{ nextval }] = await sql`SELECT nextval('pedido_seq') as nextval`.catch(async () => {
    await sql`CREATE SEQUENCE IF NOT EXISTS pedido_seq START 1`
    return sql`SELECT nextval('pedido_seq') as nextval`
  })
  const numero = `PED-${year}-${String(nextval).padStart(4, '0')}`

  const [pedido] = await sql`
    INSERT INTO pedidos (numero, orcamento_id, cliente_id, vendedor_id, status, valor_total, observacoes)
    VALUES (${numero}, ${orcId}, ${orc.cliente_id}, ${orc.vendedor_id}, 'pendente', ${orc.valor_total}, ${orc.observacoes})
    RETURNING *
  `

  await sql`UPDATE orcamentos SET status = 'convertido', updated_at = NOW() WHERE id = ${orcId}`

  return res.status(201).json({ success: true, data: pedido as Pedido })
}

export default withAuth(handler)
