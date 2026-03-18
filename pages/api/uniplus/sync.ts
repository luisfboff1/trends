import type { NextApiResponse } from 'next'
import { withAdmin, type AuthenticatedRequest } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import { createClientFromConfig, syncFull, syncClientes, syncProdutos, syncCondicoesPagamento, syncVendedores, syncVendas } from '@/lib/uniplus-sync'
import { syncRequestSchema } from '@/lib/validations/uniplus'

export default withAdmin(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' })
  }

  const parsed = syncRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' })
  }

  // Check if there's already a sync running
  const [running] = await sql`
    SELECT id FROM uniplus_sync_log
    WHERE status = 'running' AND started_at > NOW() - INTERVAL '10 minutes'
    LIMIT 1
  `
  if (running) {
    return res.status(409).json({ success: false, error: 'Já existe uma sincronização em andamento. Aguarde.' })
  }

  const { tipo } = parsed.data
  const userId = Number(req.user.id)

  try {
    const client = await createClientFromConfig(sql)

    const syncFunctions: Record<string, () => Promise<unknown>> = {
      full: () => syncFull(client, sql, userId),
      clientes: () => syncClientes(client, sql, userId),
      produtos: () => syncProdutos(client, sql, userId),
      condicoes_pagamento: () => syncCondicoesPagamento(client, sql, userId),
      vendedores: () => syncVendedores(client, sql, userId),
      vendas: () => syncVendas(client, sql, userId),
    }

    const syncFn = syncFunctions[tipo]
    if (!syncFn) {
      return res.status(400).json({ success: false, error: 'Tipo de sync inválido' })
    }

    const result = await syncFn()
    return res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro na sincronização'
    return res.status(500).json({ success: false, error: message })
  }
})
