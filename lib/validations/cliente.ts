import { z } from 'zod'

export const clienteSchema = z.object({
  razao_social: z.string().min(2, 'Razão social obrigatória'),
  cnpj: z.string().min(14, 'CNPJ inválido').max(18),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  endereco: z.string().optional().or(z.literal('')),
  cidade: z.string().optional().or(z.literal('')),
  estado: z.string().max(2).optional().or(z.literal('')),
  vendedor_id: z.number().int().positive().optional(),
})

export const clienteUpdateSchema = clienteSchema.partial()

export type ClienteInput = z.infer<typeof clienteSchema>
export type ClienteUpdateInput = z.infer<typeof clienteUpdateSchema>
