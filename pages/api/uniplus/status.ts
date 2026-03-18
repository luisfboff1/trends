import type { NextApiResponse } from 'next'
import { withAdmin, type AuthenticatedRequest } from '@/lib/auth-middleware'
import sql from '@/lib/db'

export default withAdmin(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' })
  }

  // Check if sync is running
  if (req.query.running === 'true') {
    const [running] = await sql`
      SELECT id, tipo, started_at FROM uniplus_sync_log
      WHERE status = 'running' AND started_at > NOW() - INTERVAL '10 minutes'
      LIMIT 1
    `
    return res.json({ success: true, data: { running: !!running, log: running || null } })
  }

  // Get config status + recent logs
  const [config] = await sql`
    SELECT id, server_url, ativo, last_sync_at FROM uniplus_config WHERE ativo = true LIMIT 1
  `

  const logs = await sql`
    SELECT sl.*, u.nome as usuario_nome
    FROM uniplus_sync_log sl
    LEFT JOIN usuarios u ON sl.iniciado_por = u.id
    ORDER BY sl.started_at DESC
    LIMIT 20
  `

  // Count synced records
  const [counts] = await sql`
    SELECT
      (SELECT COUNT(*) FROM clientes WHERE uniplus_id IS NOT NULL) as clientes_sync,
      (SELECT COUNT(*) FROM tipos_papel WHERE uniplus_id IS NOT NULL) as produtos_sync,
      (SELECT COUNT(*) FROM condicoes_pagamento WHERE uniplus_id IS NOT NULL) as condicoes_sync,
      (SELECT COUNT(*) FROM pedidos WHERE uniplus_id IS NOT NULL) as pedidos_sync,
      (SELECT COUNT(*) FROM usuarios WHERE uniplus_id IS NOT NULL) as vendedores_sync
  `

  return res.json({
    success: true,
    data: {
      config: config || null,
      logs,
      counts: {
        clientes: Number(counts?.clientes_sync || 0),
        produtos: Number(counts?.produtos_sync || 0),
        condicoes_pagamento: Number(counts?.condicoes_sync || 0),
        pedidos: Number(counts?.pedidos_sync || 0),
        vendedores: Number(counts?.vendedores_sync || 0),
      }
    }
  })
})
