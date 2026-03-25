import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido' })

  const user = (req as any).user
  const isAdmin = user.tipo === 'admin'

  // Determine the dashboard view
  const requestedView = req.query.view as string | undefined
  const view = isAdmin && requestedView ? requestedView : user.tipo

  // Filter by vendedor unless admin or operador (operador sees all pedidos)
  const filterByVendedor = view === 'vendedor' && !isAdmin
  const vendedorFilter = filterByVendedor ? sql`AND vendedor_id = ${user.id}` : sql``

  const [
    monthlyPedidos,
    monthlyVendas,
    tipoProducao,
    statusPedidos,
    statusVendas,
    topClientes,
    currentMonthStats,
    previousMonthStats,
    totals,
  ] = await Promise.all([
    // Pedidos (internos) por mês — últimos 12 meses
    sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', COALESCE(data_producao, data_entrega, created_at)), 'YYYY-MM') as mes,
        COUNT(*) as total,
        COALESCE(SUM(quantidade), 0) as quantidade
      FROM pedidos
      WHERE (origem IS NULL OR origem != 'uniplus')
        AND COALESCE(data_producao, data_entrega, created_at) >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
        ${vendedorFilter}
      GROUP BY 1
      ORDER BY 1
    `,
    // Vendas (uniplus) por mês — últimos 12 meses
    sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', COALESCE(data_entrega, created_at)), 'YYYY-MM') as mes,
        COUNT(*) as total,
        COALESCE(SUM(valor_total), 0) as valor
      FROM pedidos
      WHERE origem = 'uniplus'
        AND COALESCE(data_entrega, created_at) >= DATE_TRUNC('month', NOW()) - INTERVAL '11 months'
        ${vendedorFilter}
      GROUP BY 1
      ORDER BY 1
    `,
    // Tipos de produção (para donut)
    sql`
      SELECT
        COALESCE(tipo_producao, 'Outros') as tipo,
        COUNT(*) as total
      FROM pedidos
      WHERE (origem IS NULL OR origem != 'uniplus')
        ${vendedorFilter}
      GROUP BY 1
      ORDER BY 2 DESC
    `,
    // Status dos pedidos internos
    sql`
      SELECT status, COUNT(*) as total
      FROM pedidos
      WHERE (origem IS NULL OR origem != 'uniplus')
        ${vendedorFilter}
      GROUP BY 1
    `,
    // Status das vendas (uniplus)
    sql`
      SELECT status, COUNT(*) as total
      FROM pedidos
      WHERE origem = 'uniplus'
        ${vendedorFilter}
      GROUP BY 1
    `,
    // Top 10 clientes por nº pedidos
    sql`
      SELECT
        COALESCE(c.razao_social, p.cliente_nome, 'Desconhecido') as nome,
        COUNT(*) as total,
        COALESCE(SUM(p.valor_total), 0) as valor
      FROM pedidos p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE true ${vendedorFilter}
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    `,
    // Stats do mês atual
    sql`
      SELECT
        COUNT(*) FILTER (WHERE (origem IS NULL OR origem != 'uniplus')) as pedidos_mes,
        COUNT(*) FILTER (WHERE origem = 'uniplus') as vendas_mes,
        COALESCE(SUM(valor_total) FILTER (WHERE origem = 'uniplus'), 0) as valor_vendas_mes,
        COALESCE(SUM(quantidade) FILTER (WHERE (origem IS NULL OR origem != 'uniplus')), 0) as quantidade_mes
      FROM pedidos
      WHERE DATE_TRUNC('month', COALESCE(data_producao, data_entrega, created_at)) = DATE_TRUNC('month', NOW())
        ${vendedorFilter}
    `,
    // Stats do mês anterior (para comparação)
    sql`
      SELECT
        COUNT(*) FILTER (WHERE (origem IS NULL OR origem != 'uniplus')) as pedidos_mes,
        COUNT(*) FILTER (WHERE origem = 'uniplus') as vendas_mes,
        COALESCE(SUM(valor_total) FILTER (WHERE origem = 'uniplus'), 0) as valor_vendas_mes,
        COALESCE(SUM(quantidade) FILTER (WHERE (origem IS NULL OR origem != 'uniplus')), 0) as quantidade_mes
      FROM pedidos
      WHERE DATE_TRUNC('month', COALESCE(data_producao, data_entrega, created_at)) = DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
        ${vendedorFilter}
    `,
    // Totais gerais
    sql`
      SELECT
        COUNT(*) as total_pedidos,
        COALESCE(SUM(valor_total), 0) as valor_total,
        (SELECT COUNT(*) FROM clientes WHERE ativo = true ${filterByVendedor ? sql`AND vendedor_id = ${user.id}` : sql``}) as total_clientes,
        (SELECT COUNT(*) FROM orcamentos WHERE true ${vendedorFilter}) as total_orcamentos
      FROM pedidos
      WHERE true ${vendedorFilter}
    `,
  ])

  // For operador view: strip financial data (faturamento, vendas, clientes)
  const isOperadorView = view === 'operador'

  return res.json({
    success: true,
    data: {
      view,
      monthlyPedidos: monthlyPedidos.map(r => ({ mes: r.mes, total: Number(r.total), quantidade: Number(r.quantidade) })),
      monthlyVendas: isOperadorView ? [] : monthlyVendas.map(r => ({ mes: r.mes, total: Number(r.total), valor: Number(r.valor) })),
      tipoProducao: tipoProducao.map(r => ({ tipo: r.tipo, total: Number(r.total) })),
      statusPedidos: Object.fromEntries(statusPedidos.map(r => [r.status, Number(r.total)])),
      statusVendas: isOperadorView ? {} : Object.fromEntries(statusVendas.map(r => [r.status, Number(r.total)])),
      topClientes: isOperadorView ? [] : topClientes.map(r => ({ nome: r.nome, total: Number(r.total), valor: Number(r.valor) })),
      currentMonth: {
        pedidos: Number(currentMonthStats[0].pedidos_mes),
        vendas: isOperadorView ? 0 : Number(currentMonthStats[0].vendas_mes),
        valorVendas: isOperadorView ? 0 : Number(currentMonthStats[0].valor_vendas_mes),
        quantidade: Number(currentMonthStats[0].quantidade_mes),
      },
      previousMonth: {
        pedidos: Number(previousMonthStats[0].pedidos_mes),
        vendas: isOperadorView ? 0 : Number(previousMonthStats[0].vendas_mes),
        valorVendas: isOperadorView ? 0 : Number(previousMonthStats[0].valor_vendas_mes),
        quantidade: Number(previousMonthStats[0].quantidade_mes),
      },
      totals: {
        pedidos: Number(totals[0].total_pedidos),
        valorTotal: isOperadorView ? 0 : Number(totals[0].valor_total),
        clientes: isOperadorView ? 0 : Number(totals[0].total_clientes),
        orcamentos: isOperadorView ? 0 : Number(totals[0].total_orcamentos),
      },
    },
  })
}

export default withAuth(handler)
