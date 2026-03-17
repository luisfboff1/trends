import type { NextApiRequest, NextApiResponse } from 'next'
import { withAdmin } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { Faca } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const facaId = Number(id)
  if (isNaN(facaId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  const [faca] = await sql`SELECT * FROM facas WHERE id = ${facaId}`
  if (!faca) return res.status(404).json({ success: false, error: 'Faca não encontrada' })

  if (req.method === 'GET') {
    return res.json({ success: true, data: faca as Faca })
  }

  if (req.method === 'PUT') {
    const body = req.body
    const [updated] = await sql`
      UPDATE facas SET
        nome                     = ${body.nome ?? faca.nome},
        tipo                     = ${body.tipo ?? faca.tipo},
        largura_mm               = ${body.largura_mm ?? faca.largura_mm},
        altura_mm                = ${body.altura_mm ?? faca.altura_mm},
        largura_papel_mm         = ${body.largura_papel_mm ?? faca.largura_papel_mm},
        colunas                  = ${body.colunas ?? faca.colunas},
        maquina                  = ${body.maquina ?? faca.maquina},
        percentual_adicional     = ${body.percentual_adicional ?? faca.percentual_adicional},
        velocidade_multiplicador = ${body.velocidade_multiplicador ?? faca.velocidade_multiplicador},
        ativo                    = ${body.ativo ?? faca.ativo},
        updated_at               = NOW()
      WHERE id = ${facaId}
      RETURNING *
    `
    return res.json({ success: true, data: updated as Faca })
  }

  if (req.method === 'DELETE') {
    await sql`UPDATE facas SET ativo = false, updated_at = NOW() WHERE id = ${facaId}`
    return res.json({ success: true, data: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAdmin(handler)
