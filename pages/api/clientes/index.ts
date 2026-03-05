import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { Cliente } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user

  if (req.method === 'GET') {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const offset = (page - 1) * limit
    const search = (req.query.search as string) || ''

    const isAdmin = user.tipo === 'admin'

    const [{ count }] = await sql`
      SELECT COUNT(*) FROM clientes c
      WHERE c.ativo = true
      AND ${isAdmin ? sql`true` : sql`c.vendedor_id = ${user.id}`}
      AND ${search ? sql`(c.razao_social ILIKE ${'%' + search + '%'} OR c.cnpj ILIKE ${'%' + search + '%'})` : sql`true`}
    `
    const data = await sql`
      SELECT c.*, u.nome as vendedor_nome
      FROM clientes c
      LEFT JOIN usuarios u ON c.vendedor_id = u.id
      WHERE c.ativo = true
      AND ${isAdmin ? sql`true` : sql`c.vendedor_id = ${user.id}`}
      AND ${search ? sql`(c.razao_social ILIKE ${'%' + search + '%'} OR c.cnpj ILIKE ${'%' + search + '%'})` : sql`true`}
      ORDER BY c.razao_social
      LIMIT ${limit} OFFSET ${offset}
    `

    return res.json({
      success: true,
      data: { data: data as unknown as Cliente[], total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) }
    })
  }

  if (req.method === 'POST') {
    const body = req.body
    if (!body.razao_social || !body.cnpj) {
      return res.status(400).json({ success: false, error: 'Razão social e CNPJ são obrigatórios' })
    }
    const vendedor_id = user.tipo === 'admin' ? (body.vendedor_id ?? user.id) : user.id

    const existing = await sql`SELECT id FROM clientes WHERE cnpj = ${body.cnpj.replace(/\D/g, '')}`
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'CNPJ já cadastrado' })
    }

    const cnpj = body.cnpj.replace(/\D/g, '')
    const [cliente] = await sql`
      INSERT INTO clientes (razao_social, cnpj, email, telefone, endereco, cidade, estado, vendedor_id)
      VALUES (${body.razao_social}, ${cnpj}, ${body.email || null}, ${body.telefone || null},
              ${body.endereco || null}, ${body.cidade || null}, ${body.estado || null}, ${vendedor_id})
      RETURNING *
    `
    return res.status(201).json({ success: true, data: cliente as Cliente })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
