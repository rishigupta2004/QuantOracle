export type NewsItem = {
  headline: string
  summary: string
  url: string
  source: string
  datetime: string
  provider?: string
  source_tier?: "official" | "wire" | "media" | "unknown"
  impact?: {
    affected_assets: string[]
    affected_sectors: string[]
    affected_regions: string[]
    risk_level: "low" | "medium" | "high"
    summary: string
  }
  tags?: string[]
  oil_refinery?: {
    relevant: boolean
    score: number
  }
}

export type NewsConfigStatus = {
  keys: {
    newsdata_api_key: boolean
    thenewsapi_api_key: boolean
    gnews_api_key: boolean
    news_intel_url: boolean
  }
  providers: {
    published_intel: boolean
    newsdata: boolean
    thenewsapi: boolean
    gnews: boolean
    rss: boolean
  }
  snapshot: {
    url: string | null
  }
}

export type NewsSnapshotInfo = {
  url: string | null
  available: boolean
  fresh: boolean
  as_of_utc: string | null
  count: number
  official_count: number
  oil_refinery_count: number
  error: string | null
}

type IntelCacheEntry = {
  expiresAt: number
  payload: NewsIntelPayload | null
  error: string | null
  url: string | null
}

type NewsQueryCacheEntry = {
  expiresAt: number
  items: NewsItem[]
}

const NEWS_INTEL_CACHE_TTL_MS = (() => {
  const raw = Number(process.env.QUANTORACLE_NEWS_INTEL_CACHE_TTL_MS ?? "60000")
  if (!Number.isFinite(raw)) {
    return 60_000
  }
  return Math.max(10_000, Math.min(300_000, Math.round(raw)))
})()

const NEWS_QUERY_CACHE_TTL_MS = (() => {
  const raw = Number(process.env.QUANTORACLE_NEWS_QUERY_CACHE_TTL_MS ?? "30000")
  if (!Number.isFinite(raw)) {
    return 30_000
  }
  return Math.max(10_000, Math.min(120_000, Math.round(raw)))
})()

let intelCache: IntelCacheEntry | null = null
const newsQueryCache = new Map<string, NewsQueryCacheEntry>()

function hasValue(v: string | undefined): boolean {
  return Boolean((v ?? "").trim())
}

function nowMs(): number {
  return Date.now()
}

function toNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function buildNewsIntelUrl(): string | null {
  const direct = (process.env.QUANTORACLE_NEWS_INTEL_URL ?? "").trim()
  if (direct) {
    return direct
  }

  const supabaseUrl = (process.env.SUPABASE_URL ?? "").trim().replace(/\/$/, "")
  const bucket = (process.env.SUPABASE_BUCKET ?? "").trim()
  const prefix = (process.env.QUANTORACLE_NEWS_PREFIX ?? "news/intel")
    .trim()
    .replace(/^\//, "")
    .replace(/\/$/, "")

  if (!supabaseUrl || !bucket || !prefix) {
    return null
  }
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${prefix}/latest.json`
}

function parseIso(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null
  }
  const d = new Date(raw)
  return Number.isNaN(d.valueOf()) ? null : d.toISOString()
}

function staleFromAsOf(asOfUtc: string | null): boolean {
  if (!asOfUtc) {
    return true
  }
  const maxAge = toNumber(process.env.QUANTORACLE_NEWS_STALE_MINUTES ?? "2160") || 2160
  const asOfMs = new Date(asOfUtc).valueOf()
  if (!Number.isFinite(asOfMs)) {
    return true
  }
  return nowMs() - asOfMs > maxAge * 60 * 1000
}

type NewsIntelPayload = {
  as_of_utc?: string
  generated_at_utc?: string
  count?: number
  quality?: {
    official_count?: number
    oil_refinery_count?: number
  }
  items?: unknown[]
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { cache: "no-store", signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchNewsIntelPayload(): Promise<{
  url: string | null
  payload: NewsIntelPayload | null
  error: string | null
}> {
  if (intelCache && intelCache.expiresAt > nowMs()) {
    return {
      url: intelCache.url,
      payload: intelCache.payload,
      error: intelCache.error
    }
  }

  const url = buildNewsIntelUrl()
  if (!url) {
    return { url: null, payload: null, error: "news intel URL not configured" }
  }

  try {
    const r = await fetchWithTimeout(url, 7000)
    if (!r.ok) {
      const miss = { url, payload: null, error: `snapshot HTTP ${r.status}` }
      intelCache = {
        expiresAt: nowMs() + NEWS_INTEL_CACHE_TTL_MS,
        payload: miss.payload,
        error: miss.error,
        url: miss.url
      }
      return miss
    }
    const payload = (await r.json()) as NewsIntelPayload
    if (!payload || typeof payload !== "object") {
      const miss = { url, payload: null, error: "snapshot JSON invalid" }
      intelCache = {
        expiresAt: nowMs() + NEWS_INTEL_CACHE_TTL_MS,
        payload: miss.payload,
        error: miss.error,
        url: miss.url
      }
      return miss
    }
    const hit = { url, payload, error: null }
    intelCache = {
      expiresAt: nowMs() + NEWS_INTEL_CACHE_TTL_MS,
      payload: hit.payload,
      error: hit.error,
      url: hit.url
    }
    return hit
  } catch {
    const miss = { url, payload: null, error: "snapshot fetch failed" }
    intelCache = {
      expiresAt: nowMs() + NEWS_INTEL_CACHE_TTL_MS,
      payload: miss.payload,
      error: miss.error,
      url: miss.url
    }
    return miss
  }
}

function normalizeSnapshotItem(item: unknown): NewsItem | null {
  if (!item || typeof item !== "object") {
    return null
  }
  const n = item as Record<string, unknown>
  const headline = String(n.headline ?? "").trim()
  const url = String(n.url ?? "").trim()
  if (!headline || !url) {
    return null
  }

  const impactRaw = n.impact
  let riskLevel: "low" | "medium" | "high" = "low"
  if (impactRaw && typeof impactRaw === "object") {
    const rawRisk = String((impactRaw as Record<string, unknown>).risk_level ?? "low")
    if (rawRisk === "high" || rawRisk === "medium" || rawRisk === "low") {
      riskLevel = rawRisk
    }
  }
  const impact =
    impactRaw && typeof impactRaw === "object"
      ? {
          affected_assets: Array.isArray((impactRaw as Record<string, unknown>).affected_assets)
            ? ((impactRaw as Record<string, unknown>).affected_assets as unknown[])
                .map((x) => String(x))
                .slice(0, 8)
            : [],
          affected_sectors: Array.isArray((impactRaw as Record<string, unknown>).affected_sectors)
            ? ((impactRaw as Record<string, unknown>).affected_sectors as unknown[])
                .map((x) => String(x))
                .slice(0, 8)
            : [],
          affected_regions: Array.isArray((impactRaw as Record<string, unknown>).affected_regions)
            ? ((impactRaw as Record<string, unknown>).affected_regions as unknown[])
                .map((x) => String(x))
                .slice(0, 8)
            : [],
          risk_level: riskLevel,
          summary: String((impactRaw as Record<string, unknown>).summary ?? "").slice(0, 240)
        }
      : undefined

  const sourceTier =
    String(n.source_tier ?? "unknown") === "official"
      ? "official"
      : String(n.source_tier ?? "unknown") === "wire"
        ? "wire"
        : String(n.source_tier ?? "unknown") === "media"
          ? "media"
          : "unknown"

  const oilRaw = n.oil_refinery
  const oil =
    oilRaw && typeof oilRaw === "object"
      ? {
          relevant: Boolean((oilRaw as Record<string, unknown>).relevant),
          score: toNumber((oilRaw as Record<string, unknown>).score)
        }
      : undefined

  return {
    headline,
    summary: clean(String(n.summary ?? "")),
    url,
    source: String(n.source ?? "Published Intel"),
    datetime: String(n.datetime ?? "Recent"),
    provider: String(n.provider ?? "published_intel"),
    source_tier: sourceTier,
    impact,
    tags: Array.isArray(n.tags) ? (n.tags as unknown[]).map((x) => String(x)).slice(0, 12) : [],
    oil_refinery: oil
  }
}

function matchesQuery(item: NewsItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) {
    return true
  }
  const hay = `${item.headline} ${item.summary} ${item.source} ${(item.tags ?? []).join(" ")}`.toLowerCase()
  return hay.includes(q)
}

async function fromPublishedIntel(query: string): Promise<NewsItem[]> {
  const intel = await fetchNewsIntelPayload()
  if (!intel.payload || !Array.isArray(intel.payload.items)) {
    return []
  }
  const out: NewsItem[] = []
  for (const item of intel.payload.items) {
    const normalized = normalizeSnapshotItem(item)
    if (!normalized) {
      continue
    }
    if (matchesQuery(normalized, query)) {
      out.push(normalized)
    }
  }
  return out.slice(0, 40)
}

export async function getNewsSnapshotInfo(): Promise<NewsSnapshotInfo> {
  const intel = await fetchNewsIntelPayload()
  if (!intel.payload) {
    return {
      url: intel.url,
      available: false,
      fresh: false,
      as_of_utc: null,
      count: 0,
      official_count: 0,
      oil_refinery_count: 0,
      error: intel.error
    }
  }

  const asOfUtc =
    parseIso(intel.payload.as_of_utc) ?? parseIso(intel.payload.generated_at_utc) ?? null
  const stale = staleFromAsOf(asOfUtc)
  const count = Array.isArray(intel.payload.items)
    ? intel.payload.items.length
    : toNumber(intel.payload.count)

  return {
    url: intel.url,
    available: true,
    fresh: !stale,
    as_of_utc: asOfUtc,
    count,
    official_count: toNumber(intel.payload.quality?.official_count),
    oil_refinery_count: toNumber(intel.payload.quality?.oil_refinery_count),
    error: null
  }
}

export function getNewsConfigStatus(): NewsConfigStatus {
  const keys = {
    newsdata_api_key: hasValue(process.env.NEWSDATA_API_KEY),
    thenewsapi_api_key: hasValue(process.env.THENEWSAPI_API_KEY),
    gnews_api_key: hasValue(process.env.GNEWS_API_KEY),
    news_intel_url: hasValue(process.env.QUANTORACLE_NEWS_INTEL_URL)
  }
  const snapshotUrl = buildNewsIntelUrl()
  return {
    keys,
    providers: {
      published_intel: Boolean(snapshotUrl),
      newsdata: keys.newsdata_api_key,
      thenewsapi: keys.thenewsapi_api_key,
      gnews: keys.gnews_api_key,
      rss: true
    },
    snapshot: {
      url: snapshotUrl
    }
  }
}

function clean(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
}

async function fromNewsData(query: string): Promise<NewsItem[]> {
  const key = (process.env.NEWSDATA_API_KEY ?? "").trim()
  if (!key) {
    return []
  }
  try {
    const q = query || "market OR stocks OR nifty OR crypto"
    const r = await fetchWithTimeout(
      `https://newsdata.io/api/1/news?apikey=${encodeURIComponent(key)}&language=en&q=${encodeURIComponent(q)}`,
      6500
    )
    if (!r.ok) {
      return []
    }
    const data = (await r.json()) as { results?: Array<Record<string, unknown>> }
    return (data.results ?? []).slice(0, 16).map((n) => ({
      headline: String(n.title ?? "Untitled"),
      summary: clean(String(n.description ?? "")),
      url: String(n.link ?? "#"),
      source: String(n.source_id ?? "NewsData"),
      datetime: String(n.pubDate ?? "Recent")
    }))
  } catch {
    return []
  }
}

async function fromTheNewsApi(query: string): Promise<NewsItem[]> {
  const key = (process.env.THENEWSAPI_API_KEY ?? "").trim()
  if (!key) {
    return []
  }
  try {
    const q = query || "stock market"
    const r = await fetchWithTimeout(
      `https://api.thenewsapi.com/v1/news/all?api_token=${encodeURIComponent(key)}&language=en&search=${encodeURIComponent(q)}&limit=20`,
      6500
    )
    if (!r.ok) {
      return []
    }
    const data = (await r.json()) as { data?: Array<Record<string, unknown>> }
    return (data.data ?? []).slice(0, 16).map((n) => ({
      headline: String(n.title ?? "Untitled"),
      summary: clean(String(n.description ?? "")),
      url: String(n.url ?? "#"),
      source: String(n.source ?? "TheNewsAPI"),
      datetime: String(n.published_at ?? "Recent")
    }))
  } catch {
    return []
  }
}

async function fromGNews(query: string): Promise<NewsItem[]> {
  const key = (process.env.GNEWS_API_KEY ?? "").trim()
  if (!key) {
    return []
  }
  try {
    const q = query || "stock market"
    const r = await fetchWithTimeout(
      `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=en&max=20&apikey=${encodeURIComponent(key)}`,
      6500
    )
    if (!r.ok) {
      return []
    }
    const data = (await r.json()) as { articles?: Array<Record<string, unknown>> }
    return (data.articles ?? []).slice(0, 16).map((n) => {
      const source = (n.source as Record<string, unknown> | undefined)?.name
      return {
        headline: String(n.title ?? "Untitled"),
        summary: clean(String(n.description ?? "")),
        url: String(n.url ?? "#"),
        source: String(source ?? "GNews"),
        datetime: String(n.publishedAt ?? "Recent")
      }
    })
  } catch {
    return []
  }
}

function extractTag(content: string, tag: string): string {
  const m = content.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"))
  if (!m?.[1]) {
    return ""
  }
  return m[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
}

async function fromRss(query: string): Promise<NewsItem[]> {
  const q = query || "stock market"
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`
  try {
    const r = await fetchWithTimeout(url, 6000)
    if (!r.ok) {
      return []
    }
    const xml = await r.text()
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
    return items.slice(0, 16).map((m) => {
      const chunk = m[1]
      return {
        headline: clean(extractTag(chunk, "title")) || "Untitled",
        summary: clean(extractTag(chunk, "description")),
        url: clean(extractTag(chunk, "link")) || "#",
        source: clean(extractTag(chunk, "source")) || "Google News RSS",
        datetime: clean(extractTag(chunk, "pubDate")) || "Recent"
      }
    })
  } catch {
    return []
  }
}

export async function getNews(query: string): Promise<NewsItem[]> {
  const normalizedQuery = query.trim().toLowerCase()
  const cached = newsQueryCache.get(normalizedQuery)
  if (cached && cached.expiresAt > nowMs()) {
    return cached.items
  }

  const chain = [fromPublishedIntel, fromNewsData, fromTheNewsApi, fromGNews, fromRss]
  for (const source of chain) {
    const items = await source(query)
    if (items.length > 0) {
      newsQueryCache.set(normalizedQuery, {
        expiresAt: nowMs() + NEWS_QUERY_CACHE_TTL_MS,
        items
      })
      return items
    }
  }

  newsQueryCache.set(normalizedQuery, {
    expiresAt: nowMs() + NEWS_QUERY_CACHE_TTL_MS,
    items: []
  })
  return []
}
