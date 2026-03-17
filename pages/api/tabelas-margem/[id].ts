import type { NextApiRequest, NextApiResponse } from 'next'
import { withAdmin } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { TabelaMargem, FaixaMargem } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  const tabelaId = Number(id)
  if (isNaN(tabelaId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  const [tabela] = await sql`SELECT * FROM tabelas_margem WHERE id = ${tabelaId}`
  if (!tabela) return res.status(404).json({ success: false, error: 'Tabela não encontrada' })

  if (req.method === 'GET') {
    const faixas = await sql<FaixaMargem[]>`
      SELECT * FROM faixas_margem WHERE tabela_margem_id = ${tabelaId} ORDER BY min_rolos
    `
    return res.json({ success: true, data: { ...tabela, faixas } })
  }

  if (req.method === 'PUT') {
    const body = req.body
    // Update tabela
    const [updated] = await sql`
      UPDATE tabelas_margem SET
        nome       = ${body.nome ?? tabela.nome},
        descricao  = ${body.descricao ?? tabela.descricao},
        ativo      = ${body.ativo ?? tabela.ativo},
        updated_at = NOW()
      WHERE id = ${tabelaId}
      RETURNING *
    `
    // Replace faixas if provided
    let faixas: FaixaMargem[] = []
    if (body.faixas && body.faixas.length > 0) {
      await sql`DELETE FROM faixas_margem WHERE tabela_margem_id = ${tabelaId}`
      for (const f of body.faixas) {
        const [faixa] = await sql`
          INSERT INTO faixas_margem (tabela_margem_id, min_rolos, max_rolos, percentual)
          VALUES (${tabelaId}, ${f.min_rolos}, ${f.max_rolos ?? null}, ${f.percentual})
          RETURNING *
        `
        faixas.push(faixa as FaixaMargem)
      }
    } else {
      faixas = await sql<FaixaMargem[]>`
        SELECT * FROM faixas_margem WHERE tabela_margem_id = ${tabelaId} ORDER BY min_rolos
      `
    }
    return res.json({ success: true, data: { ...updated, faixas } as TabelaMargem })
  }

  if (req.method === 'DELETE') {
    await sql`UPDATE tabelas_margem SET ativo = false, updated_at = NOW() WHERE id = ${tabelaId}`
    return res.json({ success: true, data: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAdmin(handler)
