import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { TipoPapel } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user

  if (req.method === 'GET') {
    const apenasAtivos = req.query.ativo !== 'false'
    const data = await sql<TipoPapel[]>`
      SELECT * FROM tipos_papel
      WHERE ${apenasAtivos ? sql`ativo = true` : sql`true`}
      ORDER BY nome
    `
    return res.json({ success: true, data: { data, total: data.length, page: 1, limit: data.length, totalPages: 1 } })
  }

  if (req.method === 'POST') {
    if (user.tipo !== 'admin') return res.status(403).json({ success: false, error: 'Apenas administradores' })
    const body = req.body
    if (!body.nome || !body.preco_m2) {
      return res.status(400).json({ success: false, error: 'Nome e preço são obrigatórios' })
    }
    const [tipo] = await sql`
      INSERT INTO tipos_papel (nome, descricao, fornecedor, preco_m2)
      VALUES (${body.nome}, ${body.descricao ?? null}, ${body.fornecedor ?? null}, ${body.preco_m2})
      RETURNING *
    `
    return res.status(201).json({ success: true, data: tipo as TipoPapel })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
