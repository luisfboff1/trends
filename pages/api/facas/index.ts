import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { Faca } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user

  if (req.method === 'GET') {
    const apenasAtivos = req.query.ativo !== 'false'
    const tipo = req.query.tipo as string | undefined

    let data: Faca[]
    if (tipo) {
      data = await sql<Faca[]>`
        SELECT * FROM facas
        WHERE ${apenasAtivos ? sql`ativo = true` : sql`true`}
          AND tipo = ${tipo}
        ORDER BY nome
      `
    } else {
      data = await sql<Faca[]>`
        SELECT * FROM facas
        WHERE ${apenasAtivos ? sql`ativo = true` : sql`true`}
        ORDER BY tipo, nome
      `
    }
    return res.json({ success: true, data: { data, total: data.length, page: 1, limit: data.length, totalPages: 1 } })
  }

  if (req.method === 'POST') {
    if (user.tipo !== 'admin') return res.status(403).json({ success: false, error: 'Apenas administradores' })
    const body = req.body
    if (!body.nome || !body.tipo || !body.largura_mm || !body.altura_mm) {
      return res.status(400).json({ success: false, error: 'Nome, tipo, largura e altura são obrigatórios' })
    }
    const [faca] = await sql`
      INSERT INTO facas (nome, tipo, largura_mm, altura_mm, largura_papel_mm, colunas, maquina, percentual_adicional, velocidade_multiplicador)
      VALUES (
        ${body.nome},
        ${body.tipo},
        ${body.largura_mm},
        ${body.altura_mm},
        ${body.largura_papel_mm ?? null},
        ${body.colunas ?? 1},
        ${body.maquina ?? null},
        ${body.percentual_adicional ?? 0},
        ${body.velocidade_multiplicador ?? 1.0}
      )
      RETURNING *
    `
    return res.status(201).json({ success: true, data: faca as Faca })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
