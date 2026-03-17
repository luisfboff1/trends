import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { CorPantone } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user

  if (req.method === 'GET') {
    const apenasAtivos = req.query.ativo !== 'false'
    const data = await sql<CorPantone[]>`
      SELECT * FROM cores_pantone
      WHERE ${apenasAtivos ? sql`ativo = true` : sql`true`}
      ORDER BY codigo
    `
    return res.json({ success: true, data: { data, total: data.length, page: 1, limit: data.length, totalPages: 1 } })
  }

  if (req.method === 'POST') {
    if (user.tipo !== 'admin') return res.status(403).json({ success: false, error: 'Apenas administradores' })
    const body = req.body
    if (!body.codigo) return res.status(400).json({ success: false, error: 'Código obrigatório' })
    const [cor] = await sql`
      INSERT INTO cores_pantone (codigo, nome, custo_m2, percentual_hora_separacao)
      VALUES (
        ${body.codigo},
        ${body.nome ?? null},
        ${body.custo_m2 ?? 0.30},
        ${body.percentual_hora_separacao ?? 0}
      )
      RETURNING *
    `
    return res.status(201).json({ success: true, data: cor as CorPantone })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
