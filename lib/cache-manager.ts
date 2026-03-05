const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

type CacheEntry = { data: unknown; timestamp: number } | null

let dashboardCache: CacheEntry = null

export const cacheManager = {
  dashboard: {
    get: () => dashboardCache,
    set: (data: unknown) => { dashboardCache = { data, timestamp: Date.now() } },
    invalidate: () => { dashboardCache = null },
    isValid: () => !!dashboardCache && (Date.now() - dashboardCache.timestamp) < CACHE_TTL,
  },
  invalidateAll: () => { dashboardCache = null },
}

export const invalidateCacheAfterMutation = () => cacheManager.invalidateAll()
