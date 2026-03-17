import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import type { TabelaMargem, FaixaMargem } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user

  if (req.method === 'GET') {
    const tabelas = await sql<TabelaMargem[]>`
      SELECT tm.*,
        (SELECT COUNT(*) FROM usuarios u WHERE u.tabela_margem_id = tm.id AND u.ativo = true)::int as vendedores_count
      FROM tabelas_margem tm
      WHERE tm.ativo = true
      ORDER BY tm.nome
    `
    // Load faixas for each tabela
    for (const tabela of tabelas) {
      tabela.faixas = await sql<FaixaMargem[]>`
        SELECT * FROM faixas_margem
        WHERE tabela_margem_id = ${tabela.id}
        ORDER BY min_rolos
      `
    }
    return res.json({ success: true, data: { data: tabelas, total: tabelas.length, page: 1, limit: tabelas.length, totalPages: 1 } })
  }

  if (req.method === 'POST') {
    if (user.tipo !== 'admin') return res.status(403).json({ success: false, error: 'Apenas administradores' })
    const body = req.body
    if (!body.nome || !body.faixas || !body.faixas.length) {
      return res.status(400).json({ success: false, error: 'Nome e pelo menos uma faixa são obrigatórios' })
    }
    // Create tabela
    const [tabela] = await sql`
      INSERT INTO tabelas_margem (nome, descricao)
      VALUES (${body.nome}, ${body.descricao ?? null})
      RETURNING *
    `
    // Create faixas
    const faixas: FaixaMargem[] = []
    for (const f of body.faixas) {
      const [faixa] = await sql`
        INSERT INTO faixas_margem (tabela_margem_id, min_rolos, max_rolos, percentual)
        VALUES (${tabela.id}, ${f.min_rolos}, ${f.max_rolos ?? null}, ${f.percentual})
        RETURNING *
      `
      faixas.push(faixa as FaixaMargem)
    }
    return res.status(201).json({ success: true, data: { ...tabela, faixas } as TabelaMargem })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
