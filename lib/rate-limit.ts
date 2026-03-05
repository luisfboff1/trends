import { NextApiRequest, NextApiResponse } from 'next'

interface RateLimitEntry { count: number; resetTime: number }
const rateLimitStore = new Map<string, RateLimitEntry>()
setInterval(() => {
  const now = Date.now()
  rateLimitStore.forEach((v, k) => { if (v.resetTime < now) rateLimitStore.delete(k) })
}, 5 * 60 * 1000)

export const RateLimitPresets = {
  LOGIN:   { maxRequests: 5,   windowMs: 15 * 60 * 1000 },
  GENERAL: { maxRequests: 100, windowMs: 60 * 1000 },
  HEAVY:   { maxRequests: 20,  windowMs: 60 * 1000 },
}

export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  keyGenerator?: (req: NextApiRequest) => string
}

function getClientId(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
  return req.socket.remoteAddress || 'unknown'
}

export function withRateLimit(
  config: RateLimitConfig,
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const now = Date.now()
    const key = `${config.keyGenerator ? config.keyGenerator(req) : getClientId(req)}:${req.url}`
    let entry = rateLimitStore.get(key)
    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + config.windowMs }
      rateLimitStore.set(key, entry)
    }
    entry.count++
    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString())
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - entry.count).toString())
    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
      res.setHeader('Retry-After', retryAfter.toString())
      return res.status(429).json({ success: false, message: 'Muitas requisições. Tente novamente mais tarde.', retryAfter })
    }
    return handler(req, res)
  }
}
