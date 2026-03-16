type RateLimitConfig = {
  windowMs: number
  maxRequests: number
}

type RateLimitEntry = {
  count: number
  resetTime: number
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "signal-explain": { windowMs: 60 * 60 * 1000, maxRequests: 10 },
  "portfolio-brief": { windowMs: 24 * 60 * 60 * 1000, maxRequests: 1 },
  "lab-interpret": { windowMs: 24 * 60 * 60 * 1000, maxRequests: 5 },
}

const userRateLimits = new Map<string, Map<string, RateLimitEntry>>()

function getClientKey(request: Request): string {
  return request.headers.get("x-user-id") || "anonymous"
}

export function checkRateLimit(
  endpoint: string,
  request: Request,
): { allowed: boolean; remaining: number; resetInMinutes: number } {
  const clientKey = getClientKey(request)
  const limit = RATE_LIMITS[endpoint]

  if (!limit) {
    return { allowed: true, remaining: 0, resetInMinutes: 0 }
  }

  const now = Date.now()
  const clientLimits = userRateLimits.get(clientKey) || new Map()
  const entry = clientLimits.get(endpoint)

  if (!entry || now > entry.resetTime) {
    const resetTime = now + limit.windowMs
    clientLimits.set(endpoint, { count: 1, resetTime })
    userRateLimits.set(clientKey, clientLimits)
    return { allowed: true, remaining: limit.maxRequests - 1, resetInMinutes: Math.ceil(limit.windowMs / 60000) }
  }

  if (entry.count >= limit.maxRequests) {
    const resetInMinutes = Math.ceil((entry.resetTime - now) / 60000)
    return { allowed: false, remaining: 0, resetInMinutes }
  }

  entry.count++
  clientLimits.set(endpoint, entry)
  userRateLimits.set(clientKey, clientLimits)

  return {
    allowed: true,
    remaining: limit.maxRequests - entry.count,
    resetInMinutes: Math.ceil((entry.resetTime - now) / 60000),
  }
}

export function resetRateLimit(endpoint: string, request: Request): void {
  const clientKey = getClientKey(request)
  const clientLimits = userRateLimits.get(clientKey)
  if (clientLimits) {
    clientLimits.delete(endpoint)
    userRateLimits.set(clientKey, clientLimits)
  }
}
