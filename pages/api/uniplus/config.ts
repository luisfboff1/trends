import type { NextApiResponse } from 'next'
import { withAdmin, type AuthenticatedRequest } from '@/lib/auth-middleware'
import sql from '@/lib/db'
import { UniplusClient } from '@/lib/uniplus-client'
import { uniplusConfigSchema } from '@/lib/validations/uniplus'

export default withAdmin(async (req: AuthenticatedRequest, res: NextApiResponse) => {
  if (req.method === 'GET') {
    const [config] = await sql`
      SELECT id, server_url, user_id, ativo, last_sync_at, created_at, updated_at
      FROM uniplus_config WHERE ativo = true LIMIT 1
    `
    return res.json({ success: true, data: config || null })
  }

  if (req.method === 'POST') {
    const test = req.query.test === 'true'

    const parsed = uniplusConfigSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' })
    }

    const { server_url, auth_code, user_id, user_password } = parsed.data

    if (test) {
      const client = new UniplusClient({ serverUrl: server_url, authCode: auth_code, userId: user_id, userPassword: user_password })
      const result = await client.testConnection()
      return res.json({ success: result.ok, error: result.error })
    }

    // Upsert config (only one active config)
    const [existing] = await sql`SELECT id FROM uniplus_config WHERE ativo = true LIMIT 1`

    if (existing) {
      await sql`
        UPDATE uniplus_config SET
          server_url = ${server_url},
          auth_code = ${auth_code},
          user_id = ${user_id},
          user_password = ${user_password},
          updated_at = NOW()
        WHERE id = ${existing.id}
      `
    } else {
      await sql`
        INSERT INTO uniplus_config (server_url, auth_code, user_id, user_password)
        VALUES (${server_url}, ${auth_code}, ${user_id}, ${user_password})
      `
    }

    return res.json({ success: true })
  }

  return res.status(405).json({ success: false, error: 'Método não permitido' })
})
