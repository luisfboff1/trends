import { z } from 'zod'

export const condicaoPagamentoSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  descricao: z.string().optional(),
})

export type CondicaoPagamentoInput = z.infer<typeof condicaoPagamentoSchema>
