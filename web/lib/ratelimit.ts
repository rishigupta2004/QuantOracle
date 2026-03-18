// Data API rate limiting (IP-based for Vercel)

type RateLimitConfig = {
  max: number
  windowMs: number
}

type RateLimitEntry = {
  count: number
  resetTime: number
}

const DATA_LIMITS: Record<string, RateLimitConfig> = {
  'quotes':  { max: 60,  windowMs: 60_000 },   // 60/min
  'chart':   { max: 120, windowMs: 60_000 },   // 120/min
  'signals': { max: 20,  windowMs: 60_000 },   // 20/min
  'screener':{ max: 10,  windowMs: 60_000 },   // 10/min
  'sectors': { max: 10,  windowMs: 60_000 },   // 10/min
  'social':  { max: 20,  windowMs: 60_000 },   // 20/min
  'clips':   { max: 10,  windowMs: 60_000 },   // 10/min
}

const ipRateLimits = new Map<string, Map<string, RateLimitEntry>>()

/**
 * Extract client IP from request headers (Vercel-compatible)
 */
export function getClientIP(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() 
      ?? request.headers.get('x-real-ip') 
      ?? 'unknown'
}

/**
 * Check rate limit for a data endpoint
 */
export function checkDataRateLimit(
  endpoint: string,
  request: Request
): { allowed: boolean; remaining: number; resetInSeconds: number } {
  const clientIP = getClientIP(request)
  const limit = DATA_LIMITS[endpoint]

  if (!limit) {
    return { allowed: true, remaining: 0, resetInSeconds: 0 }
  }

  const now = Date.now()
  const clientLimits = ipRateLimits.get(clientIP) || new Map()
  const entry = clientLimits.get(endpoint)

  if (!entry || now > entry.resetTime) {
    const resetTime = now + limit.windowMs
    clientLimits.set(endpoint, { count: 1, resetTime })
    ipRateLimits.set(clientIP, clientLimits)
    return { allowed: true, remaining: limit.max - 1, resetInSeconds: Math.ceil(limit.windowMs / 1000) }
  }

  if (entry.count >= limit.max) {
    const resetInSeconds = Math.ceil((entry.resetTime - now) / 1000)
    return { allowed: false, remaining: 0, resetInSeconds }
  }

  entry.count++
  clientLimits.set(endpoint, entry)
  ipRateLimits.set(clientIP, clientLimits)

  return {
    allowed: true,
    remaining: limit.max - entry.count,
    resetInSeconds: Math.ceil((entry.resetTime - now) / 1000),
  }
}

/**
 * Create a rate limit response if exceeded
 */
export function rateLimitResponse(endpoint: string, request: Request) {
  const result = checkDataRateLimit(endpoint, request)
  
  if (!result.allowed) {
    return {
      error: `Rate limit exceeded for ${endpoint}. Try again in ${result.resetInSeconds}s`,
      retryAfter: result.resetInSeconds,
    }
  }
  
  return null // null means allowed
}
