import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { FornecedorPapel } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user
  const { id } = req.query
  const tipoPapelId = Number(id)
  if (isNaN(tipoPapelId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  // Verify tipo_papel exists
  const [tipoPapel] = await sql`SELECT id FROM tipos_papel WHERE id = ${tipoPapelId}`
  if (!tipoPapel) return res.status(404).json({ success: false, error: 'Tipo de papel não encontrado' })

  if (req.method === 'GET') {
    const data = await sql<FornecedorPapel[]>`
      SELECT * FROM fornecedores_papel
      WHERE tipo_papel_id = ${tipoPapelId} AND ativo = true
      ORDER BY fornecedor
    `
    return res.json({ success: true, data })
  }

  if (req.method === 'POST') {
    if (user.tipo !== 'admin') return res.status(403).json({ success: false, error: 'Apenas administradores' })
    const body = req.body
    if (!body.fornecedor || !body.preco_m2) {
      return res.status(400).json({ success: false, error: 'Fornecedor e preço são obrigatórios' })
    }
    const [fornecedor] = await sql`
      INSERT INTO fornecedores_papel (tipo_papel_id, fornecedor, preco_m2, pago, icms, ipi, frete, total, data_compra)
      VALUES (
        ${tipoPapelId},
        ${body.fornecedor},
        ${body.preco_m2},
        ${body.pago ?? null},
        ${body.icms ?? null},
        ${body.ipi ?? null},
        ${body.frete ?? null},
        ${body.total ?? null},
        ${body.data_compra ?? null}
      )
      RETURNING *
    `
    // Recalculate average
    await sql`
      UPDATE tipos_papel SET
        preco_m2_medio = (
          SELECT AVG(preco_m2) FROM fornecedores_papel
          WHERE tipo_papel_id = ${tipoPapelId} AND ativo = true
        ),
        updated_at = NOW()
      WHERE id = ${tipoPapelId}
    `
    return res.status(201).json({ success: true, data: fornecedor as FornecedorPapel })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
