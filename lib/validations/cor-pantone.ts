import { z } from 'zod'

export const corPantoneSchema = z.object({
  codigo: z.string().min(1, 'Código obrigatório'),
  nome: z.string().optional(),
  custo_m2: z.number().min(0).default(0.30),
  percentual_hora_separacao: z.number().min(0).max(100).default(0),
})

export type CorPantoneInput = z.infer<typeof corPantoneSchema>
