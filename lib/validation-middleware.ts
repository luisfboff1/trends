import { NextApiRequest, NextApiResponse } from 'next'
import { ZodSchema, ZodError } from 'zod'
import { sanitizeInput } from './sanitization'

export interface ValidationError { field: string; message: string }

export function validateRequestBody<T>(
  schema: ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; errors: ValidationError[] } {
  try {
    return { success: true, data: schema.parse(body) }
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: error.issues.map(e => ({ field: e.path.join('.'), message: e.message })) }
    }
    throw error
  }
}

export function withValidation<T, TReq extends NextApiRequest = NextApiRequest>(
  schema: ZodSchema<T>,
  handler: (req: TReq, res: NextApiResponse, validatedData: T) => Promise<void> | void
) {
  return async (req: TReq, res: NextApiResponse) => {
    try {
      const sanitizedBody = sanitizeInput(req.body)
      const validation = validateRequestBody(schema, sanitizedBody)
      if (!validation.success) {
        return res.status(400).json({ success: false, message: 'Dados inválidos', errors: validation.errors })
      }
      return await handler(req, res, validation.data)
    } catch (error) {
      console.error('[Validation] Unexpected error:', error)
      return res.status(500).json({ success: false, message: 'Erro interno do servidor' })
    }
  }
}
