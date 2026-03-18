import type { NextApiResponse } from 'next'
import { withAdmin, type AuthenticatedRequest } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import { createClientFromConfig, exportCliente, exportOrcamento } from '@/lib/uniplus-sync'
import { exportRequestSchema } from '@/lib/validations/uniplus'

export default withAdmin(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' })
  }

  const parsed = exportRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' })
  }

  const { tipo, id } = parsed.data

  try {
    const client = await createClientFromConfig(sql)

    let result
    switch (tipo) {
      case 'cliente':
        result = await exportCliente(client, sql, id)
        break
      case 'orcamento':
        result = await exportOrcamento(client, sql, id)
        break
      case 'pedido':
        // Reuse orcamento export logic for pedidos (both map to DAV)
        result = await exportOrcamento(client, sql, id)
        break
      default:
        return res.status(400).json({ success: false, error: 'Tipo de export inválido' })
    }

    return res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro na exportação'
    return res.status(500).json({ success: false, error: message })
  }
})
