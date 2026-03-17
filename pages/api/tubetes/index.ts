import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { Tubete } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user

  if (req.method === 'GET') {
    const apenasAtivos = req.query.ativo !== 'false'
    const data = await sql<Tubete[]>`
      SELECT * FROM tubetes
      WHERE ${apenasAtivos ? sql`ativo = true` : sql`true`}
      ORDER BY diametro_mm
    `
    return res.json({ success: true, data: { data, total: data.length, page: 1, limit: data.length, totalPages: 1 } })
  }

  if (req.method === 'POST') {
    if (user.tipo !== 'admin') return res.status(403).json({ success: false, error: 'Apenas administradores' })
    const body = req.body
    if (!body.diametro_mm || body.custo_unidade == null) {
      return res.status(400).json({ success: false, error: 'Diâmetro e custo são obrigatórios' })
    }
    const [tubete] = await sql`
      INSERT INTO tubetes (diametro_mm, descricao, custo_unidade)
      VALUES (${body.diametro_mm}, ${body.descricao ?? null}, ${body.custo_unidade})
      RETURNING *
    `
    return res.status(201).json({ success: true, data: tubete as Tubete })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
