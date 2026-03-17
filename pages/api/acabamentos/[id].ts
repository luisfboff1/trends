import type { NextApiRequest, NextApiResponse } from 'next'
import { withAdmin } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { Acabamento } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const acabamentoId = Number(id)
  if (isNaN(acabamentoId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  const [acabamento] = await sql`SELECT * FROM acabamentos WHERE id = ${acabamentoId}`
  if (!acabamento) return res.status(404).json({ success: false, error: 'Acabamento não encontrado' })

  if (req.method === 'GET') {
    return res.json({ success: true, data: acabamento as Acabamento })
  }

  if (req.method === 'PUT') {
    const body = req.body
    const [updated] = await sql`
      UPDATE acabamentos SET
        nome                 = ${body.nome ?? acabamento.nome},
        percentual_adicional = ${body.percentual_adicional ?? acabamento.percentual_adicional},
        descricao            = ${body.descricao ?? acabamento.descricao},
        ativo                = ${body.ativo ?? acabamento.ativo},
        updated_at           = NOW()
      WHERE id = ${acabamentoId}
      RETURNING *
    `
    return res.json({ success: true, data: updated as Acabamento })
  }

  if (req.method === 'DELETE') {
    await sql`UPDATE acabamentos SET ativo = false, updated_at = NOW() WHERE id = ${acabamentoId}`
    return res.json({ success: true, data: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAdmin(handler)
