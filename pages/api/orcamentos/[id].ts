import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { ApiResponse, Orcamento, ItemOrcamento } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const user = (req as any).user
  const orcId = Number(id)
  if (isNaN(orcId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  const [orc] = await sql`SELECT * FROM orcamentos WHERE id = ${orcId}`
  if (!orc) return res.status(404).json({ success: false, error: 'Orçamento não encontrado' })
  if (user.tipo !== 'admin' && orc.vendedor_id !== user.id) {
    return res.status(403).json({ success: false, error: 'Sem permissão' })
  }

  if (req.method === 'GET') {
    const itens = await sql<ItemOrcamento[]>`
      SELECT i.*, t.nome as tipo_papel_nome, t.preco_m2
      FROM itens_orcamento i
      LEFT JOIN tipos_papel t ON i.tipo_papel_id = t.id
      WHERE i.orcamento_id = ${orcId}
      ORDER BY i.id
    `
    const [cliente] = await sql`SELECT razao_social, cnpj FROM clientes WHERE id = ${orc.cliente_id}`
    return res.json({ success: true, data: { ...orc, itens, cliente } as any })
  }

  if (req.method === 'PUT') {
    const body = req.body
    const [updated] = await sql`
      UPDATE orcamentos SET
        tipo_margem = ${body.tipo_margem ?? orc.tipo_margem},
        status      = ${body.status ?? orc.status},
        observacoes = ${body.observacoes ?? orc.observacoes},
        valor_total = ${body.valor_total ?? orc.valor_total},
        updated_at  = NOW()
      WHERE id = ${orcId}
      RETURNING *
    `

    if (body.itens) {
      await sql`DELETE FROM itens_orcamento WHERE orcamento_id = ${orcId}`
      for (const item of body.itens) {
        await sql`
          INSERT INTO itens_orcamento (orcamento_id, tipo_papel_id, largura_mm, altura_mm, colunas, quantidade, imagem_url, observacoes)
          VALUES (${orcId}, ${item.tipo_papel_id}, ${item.largura_mm}, ${item.altura_mm}, ${item.colunas ?? 1}, ${item.quantidade}, ${item.imagem_url ?? null}, ${item.observacoes ?? null})
        `
      }
    }

    return res.json({ success: true, data: updated as Orcamento })
  }

  if (req.method === 'DELETE') {
    if (orc.status !== 'rascunho') {
      return res.status(400).json({ success: false, error: 'Apenas rascunhos podem ser excluídos' })
    }
    await sql`DELETE FROM orcamentos WHERE id = ${orcId}`
    return res.json({ success: true, data: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
