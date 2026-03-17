import type { NextApiRequest, NextApiResponse } from 'next'
import { withAdmin } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { FornecedorPapel } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, fornecedorId } = req.query
  const tipoPapelId = Number(id)
  const fId = Number(fornecedorId)
  if (isNaN(tipoPapelId) || isNaN(fId)) return res.status(400).json({ success: false, error: 'IDs inválidos' })

  const [fornecedor] = await sql`
    SELECT * FROM fornecedores_papel WHERE id = ${fId} AND tipo_papel_id = ${tipoPapelId}
  `
  if (!fornecedor) return res.status(404).json({ success: false, error: 'Fornecedor não encontrado' })

  if (req.method === 'PUT') {
    const body = req.body
    const [updated] = await sql`
      UPDATE fornecedores_papel SET
        fornecedor  = ${body.fornecedor ?? fornecedor.fornecedor},
        preco_m2    = ${body.preco_m2 ?? fornecedor.preco_m2},
        pago        = ${body.pago ?? fornecedor.pago},
        icms        = ${body.icms ?? fornecedor.icms},
        ipi         = ${body.ipi ?? fornecedor.ipi},
        frete       = ${body.frete ?? fornecedor.frete},
        total       = ${body.total ?? fornecedor.total},
        data_compra = ${body.data_compra ?? fornecedor.data_compra},
        ativo       = ${body.ativo ?? fornecedor.ativo},
        updated_at  = NOW()
      WHERE id = ${fId}
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
    return res.json({ success: true, data: updated as FornecedorPapel })
  }

  if (req.method === 'DELETE') {
    await sql`UPDATE fornecedores_papel SET ativo = false, updated_at = NOW() WHERE id = ${fId}`
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
    return res.json({ success: true, data: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAdmin(handler)
