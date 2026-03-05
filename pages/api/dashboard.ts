import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido' })

  const user = (req as any).user
  const isAdmin = user.tipo === 'admin'

  const vendedorFilter = isAdmin ? sql`` : sql`AND vendedor_id = ${user.id}`

  const [clientes, orcamentosStats, pedidosStats, recentOrcamentos] = await Promise.all([
    sql`SELECT COUNT(*) as total FROM clientes WHERE ativo = true ${isAdmin ? sql`` : sql`AND vendedor_id = ${user.id}`}`,
    sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'rascunho') as rascunho,
        COUNT(*) FILTER (WHERE status = 'enviado') as enviado,
        COUNT(*) FILTER (WHERE status = 'aprovado') as aprovado,
        COALESCE(SUM(valor_total) FILTER (WHERE status = 'aprovado'), 0) as valor_aprovado
      FROM orcamentos
      WHERE true ${vendedorFilter}
    `,
    sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pendente') as pendente,
        COUNT(*) FILTER (WHERE status = 'producao') as producao,
        COALESCE(SUM(valor_total), 0) as valor_total
      FROM pedidos
      WHERE true ${vendedorFilter}
    `,
    sql`
      SELECT o.numero, o.status, o.valor_total, o.created_at, c.razao_social as cliente_nome
      FROM orcamentos o
      LEFT JOIN clientes c ON o.cliente_id = c.id
      WHERE true ${vendedorFilter}
      ORDER BY o.created_at DESC
      LIMIT 5
    `,
  ])

  return res.json({
    success: true,
    data: {
      clientes: Number(clientes[0].total),
      orcamentos: { ...orcamentosStats[0], valor_aprovado: Number(orcamentosStats[0].valor_aprovado) },
      pedidos: { ...pedidosStats[0], valor_total: Number(pedidosStats[0].valor_total) },
      recentOrcamentos,
    }
  })
}

export default withAuth(handler)
