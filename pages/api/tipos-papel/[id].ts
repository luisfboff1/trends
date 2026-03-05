import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth, withAdmin } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { ApiResponse, TipoPapel } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const tipoPapelId = Number(id)
  if (isNaN(tipoPapelId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  const [tipo] = await sql`SELECT * FROM tipos_papel WHERE id = ${tipoPapelId}`
  if (!tipo) return res.status(404).json({ success: false, error: 'Tipo de papel não encontrado' })

  if (req.method === 'GET') {
    return res.json({ success: true, data: tipo as TipoPapel })
  }

  if (req.method === 'PUT') {
    const body = req.body
    const [updated] = await sql`
      UPDATE tipos_papel SET
        nome       = ${body.nome ?? tipo.nome},
        descricao  = ${body.descricao ?? tipo.descricao},
        fornecedor = ${body.fornecedor ?? tipo.fornecedor},
        preco_m2   = ${body.preco_m2 ?? tipo.preco_m2},
        ativo      = ${body.ativo ?? tipo.ativo},
        updated_at = NOW()
      WHERE id = ${tipoPapelId}
      RETURNING *
    `
    return res.json({ success: true, data: updated as TipoPapel })
  }

  if (req.method === 'DELETE') {
    await sql`UPDATE tipos_papel SET ativo = false, updated_at = NOW() WHERE id = ${tipoPapelId}`
    return res.json({ success: true, data: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAdmin(handler)
