import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido' })

  const cnpj = (req.query.cnpj as string).replace(/\D/g, '')
  if (cnpj.length !== 14) return res.status(400).json({ success: false, error: 'CNPJ inválido' })

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
    if (!response.ok) return res.status(404).json({ success: false, error: 'CNPJ não encontrado' })
    const data = await response.json()
    return res.json({
      success: true,
      data: {
        razao_social: data.razao_social,
        cnpj: data.cnpj,
        email: data.email ?? '',
        telefone: data.ddd_telefone_1 ?? '',
        endereco: `${data.logradouro}, ${data.numero}${data.complemento ? ' ' + data.complemento : ''}`,
        cidade: data.municipio,
        estado: data.uf,
      }
    })
  } catch {
    return res.status(500).json({ success: false, error: 'Erro ao consultar CNPJ' })
  }
}

export default withAuth(handler)
