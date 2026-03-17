import type { NextApiRequest, NextApiResponse } from 'next'
import { withAdmin } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { CorPantone } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const corId = Number(id)
  if (isNaN(corId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  const [cor] = await sql`SELECT * FROM cores_pantone WHERE id = ${corId}`
  if (!cor) return res.status(404).json({ success: false, error: 'Cor não encontrada' })

  if (req.method === 'GET') {
    return res.json({ success: true, data: cor as CorPantone })
  }

  if (req.method === 'PUT') {
    const body = req.body
    const [updated] = await sql`
      UPDATE cores_pantone SET
        codigo                    = ${body.codigo ?? cor.codigo},
        nome                      = ${body.nome ?? cor.nome},
        custo_m2                  = ${body.custo_m2 ?? cor.custo_m2},
        percentual_hora_separacao = ${body.percentual_hora_separacao ?? cor.percentual_hora_separacao},
        ativo                     = ${body.ativo ?? cor.ativo},
        updated_at                = NOW()
      WHERE id = ${corId}
      RETURNING *
    `
    return res.json({ success: true, data: updated as CorPantone })
  }

  if (req.method === 'DELETE') {
    await sql`UPDATE cores_pantone SET ativo = false, updated_at = NOW() WHERE id = ${corId}`
    return res.json({ success: true, data: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAdmin(handler)
