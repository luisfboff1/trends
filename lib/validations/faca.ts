import { z } from 'zod'

export const facaSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  tipo: z.enum(['rotativa_160', 'rotativa_250', 'batida'], { message: 'Tipo obrigatório' }),
  largura_mm: z.number().positive('Largura deve ser positiva'),
  altura_mm: z.number().positive('Altura deve ser positiva'),
  largura_papel_mm: z.number().positive().optional(),
  colunas: z.number().int().min(1).max(10).default(1),
  maquina: z.string().optional(),
  percentual_adicional: z.number().min(0).max(100).default(0),
  velocidade_multiplicador: z.number().positive().default(1.0),
})

export type FacaInput = z.infer<typeof facaSchema>
