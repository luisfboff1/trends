import { z } from 'zod'

export const tipoPapelSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  descricao: z.string().optional(),
  fornecedor: z.string().optional(),
  preco_m2: z.number().positive('Preço por m² deve ser positivo'),
  pago: z.number().optional(),
  icms: z.number().min(0).max(100).optional(),
  ipi: z.number().min(0).max(100).optional(),
  frete: z.number().min(0).optional(),
  total: z.number().optional(),
  data_compra: z.string().optional(),
})

export type TipoPapelInput = z.infer<typeof tipoPapelSchema>
