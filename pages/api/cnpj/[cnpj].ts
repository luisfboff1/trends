import type { NextApiRequest, NextApiResponse } from 'next'
import { withAuth } from '@/lib/auth-middleware'

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Método não permitido' })

  const cnpj = (req.query.cnpj as string).replace(/\D/g, '')
  if (cnpj.length !== 14) return res.status(400).json({ success: false, error: 'CNPJ inválido' })

  function formatFromBrasil(data: any) {
    return {
      razao_social: data.razao_social ?? data.nome ?? '',
      cnpj: data.cnpj ?? cnpj,
      email: data.email ?? '',
      telefone: data.ddd_telefone_1 ?? data.telefone ?? '',
      endereco: data.logradouro
        ? `${data.logradouro}, ${data.numero}${data.complemento ? ' ' + data.complemento : ''}`
        : data.endereco ?? '',
      cidade: data.municipio ?? data.municipio ?? '',
      estado: data.uf ?? data.estado ?? '',
    }
  }

  try {
    // Primary: BrasilAPI
    const brasilRes = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: AbortSignal.timeout(8000) })
    if (brasilRes.ok) {
      const data = await brasilRes.json()
      return res.json({ success: true, data: formatFromBrasil(data) })
    }

    // Fallback: ReceitaWS
    const receitaRes = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, { signal: AbortSignal.timeout(8000) })
    if (receitaRes.ok) {
      const data = await receitaRes.json()
      if (data.status === 'ERROR') return res.status(404).json({ success: false, error: data.message ?? 'CNPJ não encontrado' })
      return res.json({
        success: true,
        data: {
          razao_social: data.nome ?? '',
          cnpj: data.cnpj ?? cnpj,
          email: data.email ?? '',
          telefone: data.telefone ?? '',
          endereco: data.logradouro
            ? `${data.logradouro}, ${data.numero}${data.complemento ? ' ' + data.complemento : ''}`
            : '',
          cidade: data.municipio ?? '',
          estado: data.uf ?? '',
        }
      })
    }

    return res.status(404).json({ success: false, error: 'CNPJ não encontrado em nenhuma base' })
  } catch {
    return res.status(500).json({ success: false, error: 'Erro ao consultar CNPJ' })
  }
}

export default withAuth(handler)
