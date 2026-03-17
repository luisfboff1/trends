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
      SELECT i.*,
        t.nome as tipo_papel_nome, t.preco_m2, t.preco_m2_medio,
        f.nome as faca_nome,
        cp.codigo as cor_pantone_codigo,
        tb.diametro_mm as tubete_diametro_mm
      FROM itens_orcamento i
      LEFT JOIN tipos_papel t ON i.tipo_papel_id = t.id
      LEFT JOIN facas f ON i.faca_id = f.id
      LEFT JOIN cores_pantone cp ON i.cor_pantone_id = cp.id
      LEFT JOIN tubetes tb ON i.tubete_id = tb.id
      WHERE i.orcamento_id = ${orcId}
      ORDER BY i.id
    `
    const [cliente] = await sql`SELECT razao_social, cnpj, email, telefone, endereco, cidade, estado FROM clientes WHERE id = ${orc.cliente_id}`
    const [vendedor] = await sql`SELECT nome, email FROM usuarios WHERE id = ${orc.vendedor_id}`
    const condicao = orc.condicao_pagamento_id
      ? (await sql`SELECT nome FROM condicoes_pagamento WHERE id = ${orc.condicao_pagamento_id}`)[0]
      : null

    return res.json({
      success: true,
      data: {
        ...orc,
        itens,
        cliente,
        vendedor_nome: vendedor?.nome,
        condicao_pagamento_nome: condicao?.nome,
      } as any
    })
  }

  if (req.method === 'PUT') {
    const body = req.body
    const [updated] = await sql`
      UPDATE orcamentos SET
        tipo_margem            = ${body.tipo_margem ?? orc.tipo_margem},
        status                 = ${body.status ?? orc.status},
        observacoes            = ${body.observacoes ?? orc.observacoes},
        valor_total            = ${body.valor_total ?? orc.valor_total},
        condicao_pagamento_id  = ${body.condicao_pagamento_id ?? orc.condicao_pagamento_id},
        frete_tipo             = ${body.frete_tipo ?? orc.frete_tipo},
        frete_valor            = ${body.frete_valor ?? orc.frete_valor},
        frete_percentual       = ${body.frete_percentual ?? orc.frete_percentual},
        updated_at             = NOW()
      WHERE id = ${orcId}
      RETURNING *
    `

    if (body.itens) {
      await sql`DELETE FROM itens_orcamento WHERE orcamento_id = ${orcId}`
      for (const item of body.itens) {
        await sql`
          INSERT INTO itens_orcamento (
            orcamento_id, tipo_papel_id, largura_mm, altura_mm, colunas, quantidade,
            tipo_produto, faca_id, cor_tipo, cor_pantone_id,
            tubete_id, acabamentos_ids, quantidade_por_rolo,
            quantidade_rolos, metragem_linear,
            imagem_url, observacoes
          )
          VALUES (
            ${orcId}, ${item.tipo_papel_id}, ${item.largura_mm}, ${item.altura_mm},
            ${item.colunas ?? 1}, ${item.quantidade},
            ${item.tipo_produto ?? 'etiqueta'},
            ${item.faca_id ?? null},
            ${item.cor_tipo ?? 'branca'},
            ${item.cor_pantone_id ?? null},
            ${item.tubete_id ?? null},
            ${item.acabamentos_ids ?? []},
            ${item.quantidade_por_rolo ?? null},
            ${item.quantidade_rolos ?? null},
            ${item.metragem_linear ?? null},
            ${item.imagem_url ?? null},
            ${item.observacoes ?? null}
          )
        `
      }
    }

    // Save freight history if frete_valor > 0
    if (body.frete_valor && body.frete_valor > 0) {
      await sql`
        INSERT INTO historico_frete (cliente_id, valor, orcamento_id)
        VALUES (${orc.cliente_id}, ${body.frete_valor}, ${orcId})
      `
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
