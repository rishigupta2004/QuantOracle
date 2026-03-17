import { NextRequest } from "next/server"
import { getNews, getNewsSnapshotInfo } from "@/lib/news"
import { cachedResponse } from "@/lib/cache"
import { checkDataRateLimit } from "@/lib/ratelimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  // Rate limit check
  const rateLimit = checkDataRateLimit('news', req)
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds}s`, retryAfter: rateLimit.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
    )
  }

  const q = req.nextUrl.searchParams.get("q") || ""
  const symbol = req.nextUrl.searchParams.get("symbol")
  const limit = Number(req.nextUrl.searchParams.get("limit") || "16")
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 40) : 16
  
  const [items, snapshot] = await Promise.all([getNews(q), getNewsSnapshotInfo()])
  const sliced = items.slice(0, safeLimit)
  const sourceMode = sliced[0]?.provider === "published_intel" ? "published_intel" : "live"
  
  // Add source_id to each item for favicon
  const results = sliced.map((item: any) => ({
    ...item,
    source_id: item.source_id || item.source?.id || extractDomain(item.link),
  }))
  
  return cachedResponse({
    query: q,
    symbol,
    count: Math.min(items.length, safeLimit),
    results,
    source_mode: sourceMode,
    snapshot,
    as_of_utc: new Date().toISOString()
  }, 'news')
}

function extractDomain(url?: string): string {
  if (!url) return 'unknown'
  try {
    const domain = new URL(url).hostname
    return domain.replace('www.', '')
  } catch {
    return 'unknown'
  }
}
