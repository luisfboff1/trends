import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'
import { DEFAULT_PERMISSIONS, ALL_FEATURES } from '@/types'
import type { UserTipo } from '@/types'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user

  // GET — lista usuários
  // ?role=vendedores → qualquer autenticado, retorna apenas id+nome dos ativos
  // sem role  → apenas admin, retorna lista completa
  if (req.method === 'GET') {
    if (req.query.role === 'vendedores') {
      const data = await sql`
        SELECT id, nome FROM usuarios WHERE ativo = true ORDER BY nome ASC
      `
      return res.json({ success: true, data })
    }

    if (user.tipo !== 'admin') return res.status(403).json({ success: false, error: 'Acesso negado' })

    const status = req.query.status as string | undefined // 'pendente' | 'ativo' | 'todos'

    const data = await sql`
      SELECT u.id, u.nome, u.email, u.tipo, u.ativo, u.google_id, u.avatar_url, u.created_at, u.aprovado_em, u.tabela_margem_id, tm.nome as tabela_margem_nome
      FROM usuarios u
      LEFT JOIN tabelas_margem tm ON tm.id = u.tabela_margem_id
      WHERE ${status === 'pendente'
        ? sql`u.ativo = false`
        : status === 'ativo'
          ? sql`u.ativo = true`
          : sql`true`}
      ORDER BY u.ativo ASC, u.created_at DESC
    `

    // Attach permissions for each user
    const userIds = data.map((u: any) => u.id)
    let permRows: any[] = []
    if (userIds.length > 0) {
      permRows = await sql`
        SELECT usuario_id, feature, habilitado FROM usuario_permissoes WHERE usuario_id = ANY(${userIds})
      `
    }
    const permMap: Record<number, Record<string, boolean>> = {}
    for (const r of permRows) {
      if (!permMap[r.usuario_id]) permMap[r.usuario_id] = {}
      permMap[r.usuario_id][r.feature] = r.habilitado
    }
    const enriched = data.map((u: any) => ({ ...u, permissoes: permMap[u.id] ?? {} }))

    return res.json({ success: true, data: enriched })
  }

  // POST — criar usuário manualmente (admin)
  if (req.method === 'POST') {
    if (user.tipo !== 'admin') return res.status(403).json({ success: false, error: 'Acesso negado' })
    const { nome, email, senha, tipo } = req.body
    if (!nome || !email || !senha) return res.status(400).json({ success: false, error: 'Nome, email e senha são obrigatórios' })

    const existing = await sql`SELECT id FROM usuarios WHERE email = ${email.toLowerCase()}`
    if (existing.length > 0) return res.status(409).json({ success: false, error: 'Email já cadastrado' })

    const senha_hash = bcrypt.hashSync(senha, 10)
    const userTipo: UserTipo = ['admin', 'operador', 'vendedor'].includes(tipo) ? tipo : 'vendedor'
    const [novo] = await sql`
      INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo, aprovado_por, aprovado_em)
      VALUES (${nome}, ${email.toLowerCase()}, ${senha_hash}, ${userTipo}, true, ${user.id}, NOW())
      RETURNING id, nome, email, tipo, ativo, created_at
    `
    // Insert default permissions
    const defaults = DEFAULT_PERMISSIONS[userTipo] ?? DEFAULT_PERMISSIONS.vendedor
    for (const feature of ALL_FEATURES) {
      await sql`
        INSERT INTO usuario_permissoes (usuario_id, feature, habilitado)
        VALUES (${novo.id}, ${feature}, ${defaults[feature] ?? false})
        ON CONFLICT (usuario_id, feature) DO NOTHING
      `
    }
    return res.status(201).json({ success: true, data: novo })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
