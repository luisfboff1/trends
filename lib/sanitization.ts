export function sanitizeHTML(dirty: string): string {
  if (typeof dirty !== 'string') return ''
  let cleaned = dirty.replace(/<[^>]*>/g, '')
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  cleaned = cleaned.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
  cleaned = cleaned.replace(/on\w+\s*=\s*[^\s>]*/gi, '')
  cleaned = cleaned.replace(/javascript:/gi, '')
  return cleaned.trim()
}

export function sanitizeText(text: string): string {
  if (typeof text !== 'string') return ''
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
}

export function sanitizeInput<T = unknown>(input: T): T {
  if (input === null || input === undefined) return input
  if (typeof input === 'string') return sanitizeHTML(input) as T
  if (Array.isArray(input)) return input.map(sanitizeInput) as T
  if (typeof input === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      sanitized[sanitizeText(key)] = sanitizeInput(value)
    }
    return sanitized as T
  }
  return input
}

export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') return null
  const sanitized = email.toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) return null
  return sanitized
}

export function sanitizeDocument(doc: string): string {
  if (typeof doc !== 'string') return ''
  return doc.replace(/\D/g, '')
}
