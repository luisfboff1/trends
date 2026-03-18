import { z } from 'zod'

export const uniplusConfigSchema = z.object({
  server_url: z.string()
    .min(1, 'URL do servidor é obrigatória')
    .url('URL inválida')
    .refine(url => url.startsWith('https://'), 'URL deve começar com https://'),
  auth_code: z.string().min(1, 'Código de autenticação é obrigatório'),
  user_id: z.string().min(1, 'ID do usuário é obrigatório'),
  user_password: z.string().min(1, 'Senha do usuário é obrigatória'),
})

export const syncRequestSchema = z.object({
  tipo: z.enum(['clientes', 'produtos', 'condicoes_pagamento', 'vendas', 'vendedores', 'full']),
  direcao: z.enum(['import', 'export']).default('import'),
})

export const exportRequestSchema = z.object({
  tipo: z.enum(['cliente', 'orcamento', 'pedido']),
  id: z.number().int().positive(),
})

export type UniplusConfigInput = z.infer<typeof uniplusConfigSchema>
export type SyncRequestInput = z.infer<typeof syncRequestSchema>
export type ExportRequestInput = z.infer<typeof exportRequestSchema>
