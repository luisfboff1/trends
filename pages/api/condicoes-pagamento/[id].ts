import type { NextApiRequest, NextApiResponse } from 'next'
import { withAdmin } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { CondicaoPagamento } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const condicaoId = Number(id)
  if (isNaN(condicaoId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  const [condicao] = await sql`SELECT * FROM condicoes_pagamento WHERE id = ${condicaoId}`
  if (!condicao) return res.status(404).json({ success: false, error: 'Condição não encontrada' })

  if (req.method === 'GET') {
    return res.json({ success: true, data: condicao as CondicaoPagamento })
  }

  if (req.method === 'PUT') {
    const body = req.body
    const [updated] = await sql`
      UPDATE condicoes_pagamento SET
        nome      = ${body.nome ?? condicao.nome},
        descricao = ${body.descricao ?? condicao.descricao},
        ativo     = ${body.ativo ?? condicao.ativo},
        updated_at = NOW()
      WHERE id = ${condicaoId}
      RETURNING *
    `
    return res.json({ success: true, data: updated as CondicaoPagamento })
  }

  if (req.method === 'DELETE') {
    await sql`UPDATE condicoes_pagamento SET ativo = false, updated_at = NOW() WHERE id = ${condicaoId}`
    return res.json({ success: true, data: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAdmin(handler)
