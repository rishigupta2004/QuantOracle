// Cache control profiles for API responses

export const CACHE_PROFILES = {
  live_quotes:   'public, max-age=30, stale-while-revalidate=60',
  chart_data:    'public, max-age=900, stale-while-revalidate=1800',
  signals:       'public, max-age=300, stale-while-revalidate=600',
  news:          'public, max-age=1800, stale-while-revalidate=3600',
  screener:      'public, max-age=3600, stale-while-revalidate=7200',
  fundamentals:  'public, max-age=86400, stale-while-revalidate=172800',
  macro:         'public, max-age=86400, stale-while-revalidate=172800',
  sectors:       'public, max-age=300, stale-while-revalidate=600',
  social:        'public, max-age=300, stale-while-revalidate=600',
  clips:         'public, max-age=14400, stale-while-revalidate=28800', // 4 hours
}

/**
 * Create a cached JSON response with appropriate cache headers
 */
export function cachedResponse(data: unknown, profile: keyof typeof CACHE_PROFILES): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': CACHE_PROFILES[profile],
    }
  })
}

/**
 * Create a response with no-cache headers
 */
export function noCacheResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, must-revalidate',
    }
  })
}
