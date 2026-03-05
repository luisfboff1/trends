import { z } from 'zod'

export const tipoPapelSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  descricao: z.string().optional(),
  fornecedor: z.string().optional(),
  preco_m2: z.number().positive('Preço por m² deve ser positivo'),
})

export type TipoPapelInput = z.infer<typeof tipoPapelSchema>
