import type { NextApiRequest, NextApiResponse } from 'next'
import { withAdmin } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { Tubete } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const tubeteId = Number(id)
  if (isNaN(tubeteId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  const [tubete] = await sql`SELECT * FROM tubetes WHERE id = ${tubeteId}`
  if (!tubete) return res.status(404).json({ success: false, error: 'Tubete não encontrado' })

  if (req.method === 'GET') {
    return res.json({ success: true, data: tubete as Tubete })
  }

  if (req.method === 'PUT') {
    const body = req.body
    const [updated] = await sql`
      UPDATE tubetes SET
        diametro_mm   = ${body.diametro_mm ?? tubete.diametro_mm},
        descricao     = ${body.descricao ?? tubete.descricao},
        custo_unidade = ${body.custo_unidade ?? tubete.custo_unidade},
        ativo         = ${body.ativo ?? tubete.ativo},
        updated_at    = NOW()
      WHERE id = ${tubeteId}
      RETURNING *
    `
    return res.json({ success: true, data: updated as Tubete })
  }

  if (req.method === 'DELETE') {
    await sql`UPDATE tubetes SET ativo = false, updated_at = NOW() WHERE id = ${tubeteId}`
    return res.json({ success: true, data: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAdmin(handler)
