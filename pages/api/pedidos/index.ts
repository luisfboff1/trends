import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { ApiResponse, PaginatedResponse, Pedido } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user

  if (req.method === 'GET') {
    const page = Number(req.query.page) || 1
    const limit = Number(req.query.limit) || 20
    const offset = (page - 1) * limit
    const status = req.query.status as string | undefined
    const origem = req.query.origem as string | undefined
    const exclude_origem = req.query.exclude_origem as string | undefined
    const tipo_producao = req.query.tipo_producao as string | undefined
    const material = req.query.material as string | undefined
    const cliente = req.query.cliente as string | undefined
    const mes = req.query.mes as string | undefined
    const ano = req.query.ano ? Number(req.query.ano) : undefined
    const mes_num = req.query.mes_num ? Number(req.query.mes_num) : undefined
    const isAdmin = user.tipo === 'admin'

    const [{ count }] = await sql`
      SELECT COUNT(*) FROM pedidos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE ${isAdmin ? sql`true` : sql`p.vendedor_id = ${user.id}`}
      ${status ? sql`AND p.status = ${status}` : sql``}
      ${origem ? sql`AND p.origem = ${origem}` : sql``}
      ${exclude_origem ? sql`AND (p.origem IS NULL OR p.origem != ${exclude_origem})` : sql``}
      ${tipo_producao ? sql`AND p.tipo_producao = ${tipo_producao}` : sql``}
      ${material ? sql`AND p.material ILIKE ${'%' + material + '%'}` : sql``}
      ${cliente ? sql`AND (p.cliente_nome ILIKE ${'%' + cliente + '%'} OR c.razao_social ILIKE ${'%' + cliente + '%'})` : sql``}
      ${mes ? sql`AND p.mes_referencia = ${mes}` : sql``}
      ${ano ? sql`AND EXTRACT(YEAR FROM COALESCE(p.data_producao, p.data_entrega)) = ${ano}` : sql``}
      ${mes_num ? sql`AND EXTRACT(MONTH FROM COALESCE(p.data_producao, p.data_entrega)) = ${mes_num}` : sql``}
    `
    const data = await sql`
      SELECT p.*, c.razao_social as cliente_razao_social, u.nome as vendedor_nome
      FROM pedidos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      LEFT JOIN usuarios u ON p.vendedor_id = u.id
      WHERE ${isAdmin ? sql`true` : sql`p.vendedor_id = ${user.id}`}
      ${status ? sql`AND p.status = ${status}` : sql``}
      ${origem ? sql`AND p.origem = ${origem}` : sql``}
      ${exclude_origem ? sql`AND (p.origem IS NULL OR p.origem != ${exclude_origem})` : sql``}
      ${tipo_producao ? sql`AND p.tipo_producao = ${tipo_producao}` : sql``}
      ${material ? sql`AND p.material ILIKE ${'%' + material + '%'}` : sql``}
      ${cliente ? sql`AND (p.cliente_nome ILIKE ${'%' + cliente + '%'} OR c.razao_social ILIKE ${'%' + cliente + '%'})` : sql``}
      ${mes ? sql`AND p.mes_referencia = ${mes}` : sql``}
      ${ano ? sql`AND EXTRACT(YEAR FROM COALESCE(p.data_producao, p.data_entrega)) = ${ano}` : sql``}
      ${mes_num ? sql`AND EXTRACT(MONTH FROM COALESCE(p.data_producao, p.data_entrega)) = ${mes_num}` : sql``}
      ORDER BY COALESCE(p.data_producao, p.data_entrega, p.created_at) DESC
      LIMIT ${limit} OFFSET ${offset}
    `
    return res.json({
      success: true,
      data: { data: data as unknown as Pedido[], total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) }
    })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
