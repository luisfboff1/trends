import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { HistoricoFrete } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { clienteId } = req.query
  const cId = Number(clienteId)
  if (isNaN(cId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  if (req.method === 'GET') {
    const data = await sql<HistoricoFrete[]>`
      SELECT hf.*, o.numero as orcamento_numero
      FROM historico_frete hf
      LEFT JOIN orcamentos o ON o.id = hf.orcamento_id
      WHERE hf.cliente_id = ${cId}
      ORDER BY hf.data DESC
      LIMIT 10
    `
    return res.json({ success: true, data })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
