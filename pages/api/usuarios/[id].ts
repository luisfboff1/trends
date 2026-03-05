import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'
import bcrypt from 'bcryptjs'
import sql from '@/lib/db'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = (req as any).user
  if (user.tipo !== 'admin') return res.status(403).json({ success: false, error: 'Acesso negado' })

  const { id } = req.query
  const usuarioId = Number(id)
  if (isNaN(usuarioId)) return res.status(400).json({ success: false, error: 'ID inválido' })

  // PATCH — aprovar/rejeitar/atualizar usuário
  if (req.method === 'PATCH') {
    const body = req.body

    const fields: string[] = []
    const updates: Record<string, any> = {}

    if (typeof body.ativo === 'boolean') {
      updates.ativo = body.ativo
      if (body.ativo) {
        updates.aprovado_por = user.id
        updates.aprovado_em = new Date().toISOString()
      }
    }
    if (body.tipo) updates.tipo = body.tipo
    if (body.nome) updates.nome = body.nome
    if (body.senha) updates.senha_hash = bcrypt.hashSync(body.senha, 10)

    const [updated] = await sql`
      UPDATE usuarios SET
        ativo        = ${updates.ativo        !== undefined ? updates.ativo        : sql`ativo`},
        tipo         = ${updates.tipo         !== undefined ? updates.tipo         : sql`tipo`},
        nome         = ${updates.nome         !== undefined ? updates.nome         : sql`nome`},
        senha_hash   = ${updates.senha_hash   !== undefined ? updates.senha_hash   : sql`senha_hash`},
        aprovado_por = ${updates.aprovado_por !== undefined ? updates.aprovado_por : sql`aprovado_por`},
        aprovado_em  = ${updates.aprovado_em  !== undefined ? updates.aprovado_em  : sql`aprovado_em`},
        updated_at   = NOW()
      WHERE id = ${usuarioId}
      RETURNING id, nome, email, tipo, ativo, created_at, aprovado_em
    `
    return res.json({ success: true, data: updated })
  }

  // DELETE — remover usuário
  if (req.method === 'DELETE') {
    if (usuarioId === user.id) return res.status(400).json({ success: false, error: 'Não é possível remover sua própria conta' })
    await sql`DELETE FROM usuarios WHERE id = ${usuarioId}`
    return res.json({ success: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
}

export default withAuth(handler)
