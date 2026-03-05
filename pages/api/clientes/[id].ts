import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { ApiResponse, Cliente } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const user = (req as any).user
  const clienteId = Number(id)

  if (isNaN(clienteId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  const [cliente] = await sql`SELECT * FROM clientes WHERE id = ${clienteId} AND ativo = true`
  if (!cliente) return res.status(404).json({ success: false, error: 'Cliente não encontrado' })

  if (user.tipo !== 'admin' && cliente.vendedor_id !== user.id) {
    return res.status(403).json({ success: false, error: 'Sem permissão' })
  }

  if (req.method === 'GET') {
    return res.json({ success: true, data: cliente as Cliente })
  }

  if (req.method === 'PUT') {
    const body = req.body
    const [updated] = await sql`
      UPDATE clientes SET
        razao_social = ${body.razao_social ?? cliente.razao_social},
        email        = ${body.email ?? cliente.email},
        telefone     = ${body.telefone ?? cliente.telefone},
        endereco     = ${body.endereco ?? cliente.endereco},
        cidade       = ${body.cidade ?? cliente.cidade},
        estado       = ${body.estado ?? cliente.estado},
        vendedor_id  = ${user.tipo === 'admin' && body.vendedor_id ? body.vendedor_id : cliente.vendedor_id},
        updated_at   = NOW()
      WHERE id = ${clienteId}
      RETURNING *
    `
    return res.json({ success: true, data: updated as Cliente })
  }

  if (req.method === 'DELETE') {
    await sql`UPDATE clientes SET ativo = false, updated_at = NOW() WHERE id = ${clienteId}`
    return res.json({ success: true, data: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
