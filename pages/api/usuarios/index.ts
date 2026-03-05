import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user

  // GET — lista usuários (admin vê todos, vendedor não acessa)
  if (req.method === 'GET') {
    if (user.tipo !== 'admin') return res.status(403).json({ success: false, error: 'Acesso negado' })

    const status = req.query.status as string | undefined // 'pendente' | 'ativo' | 'todos'

    const data = await sql`
      SELECT id, nome, email, tipo, ativo, google_id, avatar_url, created_at, aprovado_em
      FROM usuarios
      WHERE ${status === 'pendente'
        ? sql`ativo = false`
        : status === 'ativo'
          ? sql`ativo = true`
          : sql`true`}
      ORDER BY ativo ASC, created_at DESC
    `
    return res.json({ success: true, data })
  }

  // POST — criar usuário manualmente (admin)
  if (req.method === 'POST') {
    if (user.tipo !== 'admin') return res.status(403).json({ success: false, error: 'Acesso negado' })
    const { nome, email, senha, tipo } = req.body
    if (!nome || !email || !senha) return res.status(400).json({ success: false, error: 'Nome, email e senha são obrigatórios' })

    const existing = await sql`SELECT id FROM usuarios WHERE email = ${email.toLowerCase()}`
    if (existing.length > 0) return res.status(409).json({ success: false, error: 'Email já cadastrado' })

    const senha_hash = bcrypt.hashSync(senha, 10)
    const [novo] = await sql`
      INSERT INTO usuarios (nome, email, senha_hash, tipo, ativo, aprovado_por, aprovado_em)
      VALUES (${nome}, ${email.toLowerCase()}, ${senha_hash}, ${tipo ?? 'vendedor'}, true, ${user.id}, NOW())
      RETURNING id, nome, email, tipo, ativo, created_at
    `
    return res.status(201).json({ success: true, data: novo })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
