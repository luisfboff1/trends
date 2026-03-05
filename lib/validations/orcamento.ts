import { z } from 'zod'

export const itemOrcamentoSchema = z.object({
  tipo_papel_id: z.number().int().positive('Selecione o tipo de papel'),
  largura_mm: z.number().positive('Largura obrigatória'),
  altura_mm: z.number().positive('Altura obrigatória'),
  colunas: z.number().int().min(1).max(10).default(1),
  quantidade: z.number().int().min(1, 'Quantidade obrigatória'),
  imagem_url: z.string().url().optional().or(z.literal('')),
  observacoes: z.string().optional(),
})

export const orcamentoSchema = z.object({
  cliente_id: z.number().int().positive('Selecione um cliente'),
  tipo_margem: z.enum(['vendedor', 'revenda']).default('vendedor'),
  status: z.enum(['rascunho', 'enviado', 'aprovado', 'convertido']).default('rascunho'),
  observacoes: z.string().optional(),
  itens: z.array(itemOrcamentoSchema).min(1, 'Adicione ao menos um item'),
})

export type OrcamentoInput = z.infer<typeof orcamentoSchema>
export type ItemOrcamentoInput = z.infer<typeof itemOrcamentoSchema>
