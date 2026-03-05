import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { ApiResponse, PaginatedResponse, Orcamento } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user

  if (req.method === 'GET') {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const offset = (page - 1) * limit
    const status = req.query.status as string | undefined

    const isAdmin = user.tipo === 'admin'
    const [{ count }] = await sql`
      SELECT COUNT(*) FROM orcamentos o
      WHERE ${isAdmin ? sql`true` : sql`o.vendedor_id = ${user.id}`}
      ${status ? sql`AND o.status = ${status}` : sql``}
    `
    const data = await sql`
      SELECT o.*, c.razao_social as cliente_nome, u.nome as vendedor_nome
      FROM orcamentos o
      LEFT JOIN clientes c ON o.cliente_id = c.id
      LEFT JOIN usuarios u ON o.vendedor_id = u.id
      WHERE ${isAdmin ? sql`true` : sql`o.vendedor_id = ${user.id}`}
      ${status ? sql`AND o.status = ${status}` : sql``}
      ORDER BY o.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    return res.json({
      success: true,
      data: { data: data as unknown as Orcamento[], total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) }
    })
  }

  if (req.method === 'POST') {
    const body = req.body
    if (!body.cliente_id) return res.status(400).json({ success: false, error: 'Cliente obrigatório' })
    if (!body.itens?.length) return res.status(400).json({ success: false, error: 'Adicione ao menos um item' })

    const year = new Date().getFullYear()
    const [{ nextval }] = await sql`SELECT nextval('orcamento_seq') as nextval` .catch(async () => {
      await sql`CREATE SEQUENCE IF NOT EXISTS orcamento_seq START 1`
      return sql`SELECT nextval('orcamento_seq') as nextval`
    })
    const numero = `ORC-${year}-${String(nextval).padStart(4, '0')}`

    const [orc] = await sql`
      INSERT INTO orcamentos (numero, cliente_id, vendedor_id, tipo_margem, status, observacoes)
      VALUES (${numero}, ${body.cliente_id}, ${user.id}, ${body.tipo_margem ?? 'vendedor'}, 'rascunho', ${body.observacoes ?? null})
      RETURNING *
    `

    for (const item of body.itens) {
      await sql`
        INSERT INTO itens_orcamento (orcamento_id, tipo_papel_id, largura_mm, altura_mm, colunas, quantidade, imagem_url, observacoes)
        VALUES (${orc.id}, ${item.tipo_papel_id}, ${item.largura_mm}, ${item.altura_mm}, ${item.colunas ?? 1}, ${item.quantidade}, ${item.imagem_url ?? null}, ${item.observacoes ?? null})
      `
    }

    return res.status(201).json({ success: true, data: orc as Orcamento })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
