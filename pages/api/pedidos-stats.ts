import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido' })

  const user = (req as any).user
  const isAdmin = user.tipo === 'admin'
  const vendedorFilter = isAdmin ? sql`` : sql`AND vendedor_id = ${user.id}`

  const [vendasStats, pedidosStats] = await Promise.all([
    sql`
      SELECT
        COUNT(*) as total_mes,
        COALESCE(SUM(valor_total), 0) as valor_mes
      FROM pedidos
      WHERE origem = 'uniplus'
        AND DATE_TRUNC('month', COALESCE(data_entrega, created_at)) = DATE_TRUNC('month', NOW())
        ${vendedorFilter}
    `,
    sql`
      SELECT
        COUNT(*) as total_mes,
        COALESCE(SUM(quantidade), 0) as quantidade_mes
      FROM pedidos
      WHERE (origem IS NULL OR origem != 'uniplus')
        AND DATE_TRUNC('month', COALESCE(data_producao, data_entrega, created_at)) = DATE_TRUNC('month', NOW())
        ${vendedorFilter}
    `,
  ])

  return res.json({
    success: true,
    data: {
      vendas: {
        totalMes: Number(vendasStats[0].total_mes),
        valorMes: Number(vendasStats[0].valor_mes),
      },
      pedidos: {
        totalMes: Number(pedidosStats[0].total_mes),
        quantidadeMes: Number(pedidosStats[0].quantidade_mes),
      },
    },
  })
}

export default withAuth(handler)
