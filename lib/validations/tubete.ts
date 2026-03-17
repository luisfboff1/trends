import { z } from 'zod'

export const tubeteSchema = z.object({
  diametro_mm: z.number().int().positive('Diâmetro obrigatório'),
  descricao: z.string().optional(),
  custo_unidade: z.number().min(0, 'Custo deve ser positivo ou zero'),
})

export type TubeteInput = z.infer<typeof tubeteSchema>
