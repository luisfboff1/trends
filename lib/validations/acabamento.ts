import { z } from 'zod'

export const acabamentoSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  percentual_adicional: z.number().min(0).max(100, 'Máximo 100%'),
  descricao: z.string().optional(),
})

export type AcabamentoInput = z.infer<typeof acabamentoSchema>
