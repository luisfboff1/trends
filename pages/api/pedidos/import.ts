import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { ApiResponse } from '@/types'

const BATCH_SIZE = 100

async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const user = (req as any).user

  if (user.tipo !== 'admin') {
    return res.status(403).json({ success: false, error: 'Apenas administradores podem importar pedidos' })
  }

  if (req.method === 'POST') {
    const { records, clearPrevious } = req.body as {
      records: Array<{
        numero: string
        cliente_nome?: string
        status?: string
        valor_total?: number | null
        data_entrega?: string | null
        data_producao?: string | null
        ordem_fabricacao?: string | null
        material?: string | null
        codigo_faca?: string | null
        etiqueta_dimensao?: string | null
        quantidade?: number | null
        produzido_por?: string | null
        tipo_producao?: string | null
        ordem_compra?: string | null
        mes_referencia?: string | null
        origem?: string
      }>
      clearPrevious?: boolean
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum registro fornecido' })
    }

    // Optionally clear previous imports
    if (clearPrevious) {
      await sql`DELETE FROM pedidos WHERE origem = 'importacao'`
    }

    let inserted = 0
    let errors = 0

    // Process in batches
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE)

      try {
        const values = batch.map(r => ({
          numero: r.numero,
          cliente_nome: r.cliente_nome || null,
          status: r.status || 'pendente',
          valor_total: r.valor_total ?? null,
          data_entrega: r.data_entrega || null,
          observacoes: null,
          ordem_fabricacao: r.ordem_fabricacao || null,
          material: r.material || null,
          codigo_faca: r.codigo_faca || null,
          etiqueta_dimensao: r.etiqueta_dimensao || null,
          quantidade: r.quantidade ?? null,
          produzido_por: r.produzido_por || null,
          tipo_producao: r.tipo_producao || null,
          ordem_compra: r.ordem_compra || null,
          data_producao: r.data_producao || null,
          mes_referencia: r.mes_referencia || null,
          origem: r.origem || 'importacao',
        }))

        await sql`
          INSERT INTO pedidos ${sql(values, 
            'numero', 'cliente_nome', 'status', 'valor_total', 'data_entrega',
            'observacoes', 'ordem_fabricacao', 'material', 'codigo_faca',
            'etiqueta_dimensao', 'quantidade', 'produzido_por', 'tipo_producao',
            'ordem_compra', 'data_producao', 'mes_referencia', 'origem'
          )}
          ON CONFLICT (numero) DO NOTHING
        `
        inserted += batch.length
      } catch (err: any) {
        console.error(`Erro no batch ${i}-${i + batch.length}:`, err.message)
        errors += batch.length
      }
    }

    return res.json({
      success: true,
      data: { inserted, errors, total: records.length },
      message: `Importação concluída: ${inserted} inseridos, ${errors} erros`
    })
  }

  if (req.method === 'DELETE') {
    const result = await sql`DELETE FROM pedidos WHERE origem = 'importacao'`
    return res.json({
      success: true,
      message: `${result.count} registros importados removidos`
    })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
