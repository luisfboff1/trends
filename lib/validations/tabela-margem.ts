import { z } from 'zod'

const faixaMargemSchema = z.object({
  min_rolos: z.number().int().min(1, 'Mínimo de rolos obrigatório'),
  max_rolos: z.number().int().min(1).nullable().optional(),
  percentual: z.number().min(0, 'Percentual deve ser positivo'),
})

export const tabelaMargemSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  descricao: z.string().optional(),
  faixas: z.array(faixaMargemSchema).min(1, 'Pelo menos uma faixa obrigatória'),
})

export type TabelaMargemInput = z.infer<typeof tabelaMargemSchema>
export type FaixaMargemInput = z.infer<typeof faixaMargemSchema>
