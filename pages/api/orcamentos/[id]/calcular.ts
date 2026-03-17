import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import { calcularItem, calcularMultiplasQuantidades, buscarMargemPorRolos } from '@/lib/pricing'
import type { FaixaMargem } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' })
  }

  const user = (req as any).user
  const body = req.body

  if (!body.itens?.length) {
    return res.status(400).json({ success: false, error: 'Adicione ao menos um item' })
  }

  // Load the seller's margin table
  let faixas_margem: FaixaMargem[] = []
  const [vendedor] = await sql`SELECT tabela_margem_id FROM usuarios WHERE id = ${user.id}`
  if (vendedor?.tabela_margem_id) {
    faixas_margem = await sql<FaixaMargem[]>`
      SELECT * FROM faixas_margem
      WHERE tabela_margem_id = ${vendedor.tabela_margem_id}
      ORDER BY min_rolos
    `
  }

  const results = []
  for (const item of body.itens) {
    // Load faca data if faca_id provided
    let largura_mm = item.largura_mm
    let altura_mm = item.altura_mm
    let colunas = item.colunas ?? 1
    let velocidade_multiplicador = 1.0
    let percentual_adicional_faca = 0

    if (item.faca_id) {
      const [faca] = await sql`SELECT * FROM facas WHERE id = ${item.faca_id}`
      if (faca) {
        largura_mm = faca.largura_mm
        altura_mm = faca.altura_mm
        colunas = faca.colunas
        velocidade_multiplicador = Number(faca.velocidade_multiplicador) || 1.0
        percentual_adicional_faca = Number(faca.percentual_adicional) || 0
      }
    }

    // Load paper price
    let preco_m2 = 0
    if (item.tipo_papel_id) {
      const [papel] = await sql`SELECT preco_m2, preco_m2_medio FROM tipos_papel WHERE id = ${item.tipo_papel_id}`
      if (papel) {
        preco_m2 = Number(papel.preco_m2_medio) || Number(papel.preco_m2) || 0
      }
    }

    // Load pantone color cost
    let cor_custo_m2 = 0.30
    let cor_percentual_separacao = 0
    if (item.cor_tipo === 'pantone' && item.cor_pantone_id) {
      const [cor] = await sql`SELECT custo_m2, percentual_hora_separacao FROM cores_pantone WHERE id = ${item.cor_pantone_id}`
      if (cor) {
        cor_custo_m2 = Number(cor.custo_m2) || 0.30
        cor_percentual_separacao = Number(cor.percentual_hora_separacao) || 0
      }
    }

    // Load tubete cost
    let tubete_custo_unidade = 0
    if (item.tubete_id) {
      const [tubete] = await sql`SELECT custo_unidade FROM tubetes WHERE id = ${item.tubete_id}`
      if (tubete) { tubete_custo_unidade = Number(tubete.custo_unidade) || 0 }
    }

    // Load acabamentos percentuals
    const acabamentos_percentuais: number[] = []
    if (item.acabamentos_ids?.length) {
      const acabamentos = await sql`
        SELECT percentual_adicional FROM acabamentos WHERE id = ANY(${item.acabamentos_ids})
      `
      for (const a of acabamentos) {
        acabamentos_percentuais.push(Number(a.percentual_adicional) || 0)
      }
    }

    const baseParams = {
      largura_mm: Number(largura_mm),
      altura_mm: Number(altura_mm),
      colunas: Number(colunas),
      preco_m2: Number(preco_m2),
      cor_tipo: item.cor_tipo || 'branca',
      cor_custo_m2,
      cor_percentual_separacao,
      tubete_custo_unidade,
      velocidade_multiplicador,
      percentual_adicional_faca,
      acabamentos_percentuais,
      faixas_margem,
      tipo_margem_fallback: body.tipo_margem ?? 'vendedor',
      quantidade_por_rolo: item.quantidade_por_rolo,
    }

    // If multiple quantities provided, calculate all
    if (item.quantidades && Array.isArray(item.quantidades) && item.quantidades.length > 0) {
      const multiResults = calcularMultiplasQuantidades(
        baseParams,
        item.quantidades.map(Number),
      )
      results.push({ item_index: results.length, quantidades: multiResults })
    } else {
      const calc = calcularItem({
        ...baseParams,
        quantidade_desejada: Number(item.quantidade),
      })
      results.push({ item_index: results.length, calc })
    }
  }

  return res.json({ success: true, data: results })
}

export default withAuth(handler)
