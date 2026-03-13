import path from "node:path"

export type Quote = {
  symbol: string
  price: number
  change_pct: number
  volume: number
  source: string
  available: boolean
  stale: boolean
  quality: number
  confidence: "high" | "medium" | "low" | "weak"
  as_of_utc?: string
  message?: string
}

export type QuotesPayload = {
  as_of_utc: string
  provider_order: string[]
  provider_breakdown: Record<string, number>
  count: number
  stale: boolean
  snapshot_as_of_utc: string | null
  diagnostics: {
    runtime_ms: number
    cache_hit: boolean
    keys: {
      upstox_access_token: boolean
      upstox_symbol_map: boolean
      finnhub_api_key: boolean
      eodhd_api_key: boolean
      supabase_url: boolean
      supabase_bucket: boolean
      supabase_direct_url: boolean
    }
    snapshot: {
      url: string | null
      ok: boolean
      fetched: number
      stale: boolean
      as_of_utc: string | null
      error: string | null
    }
  }
  quotes: Record<string, Quote>
}

export type ProviderConfigStatus = {
  keys: QuotesPayload["diagnostics"]["keys"]
  providers: {
    supabase_snapshot: boolean
    upstox: boolean
    finnhub: boolean
    eodhd: boolean
    coingecko: boolean
    yahoo: boolean
  }
  snapshot_url: string | null
}

type SnapshotResult = {
  url: string | null
  ok: boolean
  fetched: number
  stale: boolean
  asOfUtc: string | null
  error: string | null
  quotes: Record<string, Quote>
}

type QuotesCacheEntry = {
  expiresAt: number
  payload: QuotesPayload
}

const QUOTES_CACHE_TTL_MS = (() => {
  const raw = Number(process.env.QUANTORACLE_QUOTES_CACHE_TTL_MS ?? "8000")
  if (!Number.isFinite(raw)) {
    return 8000
  }
  return Math.max(2000, Math.min(60_000, Math.round(raw)))
})()

const quotesCache = new Map<string, QuotesCacheEntry>()

function nowIso(): string {
  return new Date().toISOString()
}

function toNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function hasValue(v: string | undefined): boolean {
  return Boolean((v ?? "").trim())
}

function sourceBaseQuality(source: string): number {
  if (source === "upstox") {
    return 95
  }
  if (source === "finnhub") {
    return 89
  }
  if (source === "eodhd") {
    return 85
  }
  if (source === "coingecko") {
    return 84
  }
  if (source === "yahoo") {
    return 78
  }
  if (source === "supabase_snapshot") {
    return 72
  }
  return 45
}

function confidenceFromQuality(score: number): Quote["confidence"] {
  if (score >= 88) {
    return "high"
  }
  if (score >= 74) {
    return "medium"
  }
  if (score >= 58) {
    return "low"
  }
  return "weak"
}

function normalizeQuality(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

function quoteMoveLimit(symbol: string): number {
  if (isCryptoSymbol(symbol)) {
    return 90
  }
  if (isIndiaSymbol(symbol)) {
    return 45
  }
  return 60
}

function quoteLooksPlausible(symbol: string, changePct: number): boolean {
  if (!Number.isFinite(changePct)) {
    return false
  }
  return Math.abs(changePct) <= quoteMoveLimit(symbol)
}

function quoteQuality(symbol: string, source: string, changePct: number, stale: boolean): number {
  let score = sourceBaseQuality(source)
  if (stale) {
    score -= 18
  }
  const absMove = Math.abs(Number.isFinite(changePct) ? changePct : 0)
  if (absMove > 10) {
    const movementPenalty = Math.min(26, (absMove - 10) * (26 / (quoteMoveLimit(symbol) - 10)))
    score -= movementPenalty
  }
  return normalizeQuality(score)
}

function cacheKeyForSymbols(symbols: string[]): string {
  return symbols.join(",")
}

function fromQuotesCache(cacheKey: string): QuotesPayload | null {
  const hit = quotesCache.get(cacheKey)
  if (!hit) {
    return null
  }
  if (hit.expiresAt <= Date.now()) {
    quotesCache.delete(cacheKey)
    return null
  }
  return {
    ...hit.payload,
    diagnostics: {
      ...hit.payload.diagnostics,
      cache_hit: true,
      runtime_ms: 0
    }
  }
}

function saveQuotesCache(cacheKey: string, payload: QuotesPayload): void {
  quotesCache.set(cacheKey, {
    expiresAt: Date.now() + QUOTES_CACHE_TTL_MS,
    payload
  })
}

function emptyQuote(symbol: string, message = "No provider returned a valid price"): Quote {
  return {
    symbol,
    price: 0,
    change_pct: 0,
    volume: 0,
    source: "unavailable",
    available: false,
    stale: true,
    quality: 0,
    confidence: "weak",
    message
  }
}

function availableQuote(symbol: string, source: string, price: number, changePct: number, volume: number, asOfUtc?: string, stale = false): Quote {
  const quality = quoteQuality(symbol, source, changePct, stale)
  return {
    symbol,
    price,
    change_pct: changePct,
    volume,
    source,
    available: price > 0,
    stale,
    quality,
    confidence: confidenceFromQuality(quality),
    as_of_utc: asOfUtc
  }
}

function isValid(q: Quote): boolean {
  return q.available && q.price > 0
}

function isIndiaSymbol(symbol: string): boolean {
  return symbol.endsWith(".NS") || symbol.endsWith(".BO")
}

function isCryptoSymbol(symbol: string): boolean {
  return symbol.endsWith("-USD")
}

function parseUpstoxMap(): Record<string, string> {
  const raw = (process.env.UPSTOX_SYMBOL_MAP ?? "").trim()
  if (!raw) {
    return {}
  }
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      return {}
    }
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) {
        out[k.toUpperCase()] = v
      }
    }
    return out
  } catch {
    return {}
  }
}

function asIsoIfValid(raw: unknown): string | null {
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
  const staleMinutes = toNumber(process.env.QUANTORACLE_SNAPSHOT_STALE_MINUTES ?? "180") || 180
  const asOf = new Date(asOfUtc).valueOf()
  if (!Number.isFinite(asOf)) {
    return true
  }
  const ageMs = Date.now() - asOf
  return ageMs > staleMinutes * 60 * 1000
}

function buildSupabaseSnapshotUrl(): string | null {
  const direct = (process.env.QUANTORACLE_SUPABASE_QUOTES_URL ?? "").trim()
  if (direct) {
    return direct
  }

  const supabaseUrl = (process.env.SUPABASE_URL ?? "").trim().replace(/\/$/, "")
  const bucket = (process.env.SUPABASE_BUCKET ?? "").trim()
  const prefix = (process.env.QUANTORACLE_EOD_PREFIX ?? "eod/nifty50").trim().replace(/^\//, "").replace(/\/$/, "")

  if (!supabaseUrl || !bucket || !prefix) {
    return null
  }

  const safePath = path.posix.join(prefix, "quotes.json")
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${safePath}`
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchSupabaseSnapshot(symbols: string[]): Promise<SnapshotResult> {
  const url = buildSupabaseSnapshotUrl()
  if (!url) {
    return {
      url: null,
      ok: false,
      fetched: 0,
      stale: true,
      asOfUtc: null,
      error: "SUPABASE_URL/SUPABASE_BUCKET (or QUANTORACLE_SUPABASE_QUOTES_URL) not configured",
      quotes: {}
    }
  }

  try {
    const r = await fetchWithTimeout(url, { cache: "no-store" }, 8000)
    if (!r.ok) {
      return {
        url,
        ok: false,
        fetched: 0,
        stale: true,
        asOfUtc: null,
        error: `snapshot HTTP ${r.status}`,
        quotes: {}
      }
    }

    const payload = (await r.json()) as {
      as_of_utc?: string
      as_of_ist?: string
      quotes?: Record<string, Record<string, unknown>>
    }

    const asOfUtc = asIsoIfValid(payload.as_of_utc) ?? asIsoIfValid(payload.as_of_ist)
    const stale = staleFromAsOf(asOfUtc)
    const all = payload.quotes ?? {}

    const out: Record<string, Quote> = {}
    for (const symbol of symbols) {
      const q = all[symbol]
      if (!q || typeof q !== "object") {
        continue
      }
      const price = toNumber(q.price)
      if (price <= 0) {
        continue
      }
      out[symbol] = availableQuote(
        symbol,
        "supabase_snapshot",
        price,
        toNumber(q.change_pct),
        Math.round(toNumber(q.volume)),
        asOfUtc ?? undefined,
        stale
      )
    }

    return {
      url,
      ok: true,
      fetched: Object.keys(out).length,
      stale,
      asOfUtc,
      error: null,
      quotes: out
    }
  } catch (error) {
    return {
      url,
      ok: false,
      fetched: 0,
      stale: true,
      asOfUtc: null,
      error: error instanceof Error ? error.message : "snapshot fetch failed",
      quotes: {}
    }
  }
}

async function coingeckoQuote(symbol: string): Promise<Quote> {
  const map: Record<string, string> = {
    "BTC-USD": "bitcoin",
    "ETH-USD": "ethereum",
    "SOL-USD": "solana",
    "DOGE-USD": "dogecoin",
    "XRP-USD": "ripple"
  }
  const id = map[symbol.toUpperCase()]
  if (!id) {
    return emptyQuote(symbol, "CoinGecko does not map this crypto symbol")
  }
  try {
    const r = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`,
      { cache: "no-store" },
      6000
    )
    if (!r.ok) {
      return emptyQuote(symbol, `CoinGecko HTTP ${r.status}`)
    }
    const data = (await r.json()) as Record<string, { usd?: number; usd_24h_change?: number }>
    const price = toNumber(data?.[id]?.usd)
    if (price <= 0) {
      return emptyQuote(symbol, "CoinGecko returned non-positive price")
    }
    return availableQuote(symbol, "coingecko", price, toNumber(data?.[id]?.usd_24h_change), 0)
  } catch {
    return emptyQuote(symbol, "CoinGecko request failed")
  }
}

async function upstoxQuote(symbol: string, token: string, symbolMap: Record<string, string>): Promise<Quote> {
  const instrumentKey = symbolMap[symbol.toUpperCase()]
  if (!token || !instrumentKey) {
    return emptyQuote(symbol, "Upstox token/map missing for symbol")
  }
  try {
    const url = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKey)}`
    const r = await fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        },
        cache: "no-store"
      },
      10000
    )
    if (!r.ok) {
      return emptyQuote(symbol, `Upstox HTTP ${r.status}`)
    }
    const data = (await r.json()) as { data?: Record<string, Record<string, unknown>> }
    const entries = data.data ?? {}
    let q = entries[instrumentKey]
    if (!q && Object.keys(entries).length === 1) {
      q = Object.values(entries)[0]
    }
    if (!q) {
      return emptyQuote(symbol, "Upstox returned no quote entry")
    }
    const price = toNumber(q.last_price ?? q.ltp ?? q.lp ?? q.close_price)
    if (price <= 0) {
      return emptyQuote(symbol, "Upstox returned non-positive price")
    }
    const ohlc = (q.ohlc as Record<string, unknown> | undefined) ?? {}
    const prev = toNumber(ohlc.close ?? q.prev_close_price ?? q.previous_close)
    const changePct = prev > 0 ? ((price - prev) / prev) * 100 : 0
    return availableQuote(symbol, "upstox", price, changePct, Math.round(toNumber(q.volume ?? q.vtt)))
  } catch {
    return emptyQuote(symbol, "Upstox request failed")
  }
}

function finnhubSymbol(symbol: string): string {
  if (symbol.endsWith(".NS")) {
    return `NSE:${symbol.replace(".NS", "")}`
  }
  if (symbol.endsWith(".BO")) {
    return `BSE:${symbol.replace(".BO", "")}`
  }
  return symbol
}

async function finnhubQuote(symbol: string, key: string): Promise<Quote> {
  if (!key) {
    return emptyQuote(symbol, "Finnhub key missing")
  }
  try {
    const sym = finnhubSymbol(symbol)
    const r = await fetchWithTimeout(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${encodeURIComponent(key)}`,
      { cache: "no-store" },
      7000
    )
    if (!r.ok) {
      return emptyQuote(symbol, `Finnhub HTTP ${r.status}`)
    }
    const data = (await r.json()) as { c?: number; pc?: number }
    const price = toNumber(data.c)
    if (price <= 0) {
      return emptyQuote(symbol, "Finnhub returned non-positive price")
    }
    const prev = toNumber(data.pc)
    return availableQuote(symbol, "finnhub", price, prev > 0 ? ((price - prev) / prev) * 100 : 0, 0)
  } catch {
    return emptyQuote(symbol, "Finnhub request failed")
  }
}

function eodhdTicker(symbol: string): string {
  if (symbol.endsWith(".NS")) {
    return symbol.replace(".NS", ".NSE")
  }
  if (symbol.endsWith(".BO")) {
    return symbol.replace(".BO", ".BSE")
  }
  return symbol
}

async function eodhdQuote(symbol: string, key: string): Promise<Quote> {
  if (!key) {
    return emptyQuote(symbol, "EODHD key missing")
  }
  try {
    const ticker = eodhdTicker(symbol)
    const r = await fetchWithTimeout(
      `https://eodhd.com/api/real-time/${encodeURIComponent(ticker)}?api_token=${encodeURIComponent(key)}&fmt=json`,
      { cache: "no-store" },
      7000
    )
    if (!r.ok) {
      return emptyQuote(symbol, `EODHD HTTP ${r.status}`)
    }
    const data = (await r.json()) as Record<string, unknown>
    const price = toNumber(data.close ?? data.price)
    if (price <= 0) {
      return emptyQuote(symbol, "EODHD returned non-positive price")
    }
    const pct = toNumber(data.change_p ?? data.change_percent)
    const prev = toNumber(data.previousClose ?? data.previous_close)
    const resolved = pct === 0 && prev > 0 ? ((price - prev) / prev) * 100 : pct
    return availableQuote(symbol, "eodhd", price, resolved, Math.round(toNumber(data.volume)))
  } catch {
    return emptyQuote(symbol, "EODHD request failed")
  }
}

async function yahooQuote(symbol: string): Promise<Quote> {
  try {
    const r = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`,
      { cache: "no-store" },
      7000
    )
    if (!r.ok) {
      return emptyQuote(symbol, `Yahoo HTTP ${r.status}`)
    }
    const data = (await r.json()) as {
      quoteResponse?: { result?: Array<Record<string, unknown>> }
    }
    const q = data.quoteResponse?.result?.[0]
    if (!q) {
      return emptyQuote(symbol, "Yahoo returned no quote")
    }
    const price = toNumber(q.regularMarketPrice)
    if (price <= 0) {
      return emptyQuote(symbol, "Yahoo returned non-positive price")
    }
    return availableQuote(
      symbol,
      "yahoo",
      price,
      toNumber(q.regularMarketChangePercent),
      Math.round(toNumber(q.regularMarketVolume))
    )
  } catch {
    return emptyQuote(symbol, "Yahoo request failed")
  }
}

async function liveChain(symbol: string, upstoxToken: string, upstoxMap: Record<string, string>, finnhubKey: string, eodhdKey: string): Promise<Quote> {
  const accept = (candidate: Quote): Quote => {
    if (!isValid(candidate)) {
      return candidate
    }
    if (!quoteLooksPlausible(symbol, candidate.change_pct)) {
      return emptyQuote(symbol, `${candidate.source} failed plausibility check`)
    }
    return candidate
  }

  let q = emptyQuote(symbol)
  if (isCryptoSymbol(symbol)) {
    q = accept(await coingeckoQuote(symbol))
  }
  if (!isValid(q) && isIndiaSymbol(symbol)) {
    q = accept(await upstoxQuote(symbol, upstoxToken, upstoxMap))
  }
  if (!isValid(q)) {
    q = accept(await finnhubQuote(symbol, finnhubKey))
  }
  if (!isValid(q)) {
    q = accept(await eodhdQuote(symbol, eodhdKey))
  }
  if (!isValid(q)) {
    q = accept(await yahooQuote(symbol))
  }
  return q
}

export function getProviderConfigStatus(): ProviderConfigStatus {
  const keys = {
    upstox_access_token: hasValue(process.env.UPSTOX_ACCESS_TOKEN),
    upstox_symbol_map: Object.keys(parseUpstoxMap()).length > 0,
    finnhub_api_key: hasValue(process.env.FINNHUB_API_KEY),
    eodhd_api_key: hasValue(process.env.EODHD_API_KEY),
    supabase_url: hasValue(process.env.SUPABASE_URL),
    supabase_bucket: hasValue(process.env.SUPABASE_BUCKET),
    supabase_direct_url: hasValue(process.env.QUANTORACLE_SUPABASE_QUOTES_URL)
  }

  const snapshotUrl = buildSupabaseSnapshotUrl()

  return {
    keys,
    providers: {
      supabase_snapshot: Boolean(snapshotUrl),
      upstox: keys.upstox_access_token && keys.upstox_symbol_map,
      finnhub: keys.finnhub_api_key,
      eodhd: keys.eodhd_api_key,
      coingecko: true,
      yahoo: true
    },
    snapshot_url: snapshotUrl
  }
}

export async function getQuotes(symbols: string[]): Promise<QuotesPayload> {
  const startedAt = Date.now()
  const cleaned = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  const cacheKey = cacheKeyForSymbols(cleaned)
  const cached = fromQuotesCache(cacheKey)
  if (cached) {
    return cached
  }

  const upstoxToken = (process.env.UPSTOX_ACCESS_TOKEN ?? "").trim()
  const upstoxMap = parseUpstoxMap()
  const finnhubKey = (process.env.FINNHUB_API_KEY ?? "").trim()
  const eodhdKey = (process.env.EODHD_API_KEY ?? "").trim()
  const providerOrder = ["supabase_snapshot", "coingecko", "upstox", "finnhub", "eodhd", "yahoo"]

  const snapshot = await fetchSupabaseSnapshot(cleaned)
  const quotes: Record<string, Quote> = {}
  const breakdown: Record<string, number> = {}

  const resolved = await Promise.all(
    cleaned.map(async (symbol) => {
    const snapshotQuote = snapshot.quotes[symbol]
    let q: Quote = snapshotQuote ?? emptyQuote(symbol)

    if (!isValid(q) || q.stale) {
      const live = await liveChain(symbol, upstoxToken, upstoxMap, finnhubKey, eodhdKey)
      if (isValid(live)) {
        q = live
      }
    }

      return [symbol, q] as const
    })
  )

  for (const [symbol, q] of resolved) {
    quotes[symbol] = q
    breakdown[q.source] = (breakdown[q.source] ?? 0) + 1
  }

  const stale = Object.values(quotes).some((q) => q.stale || !q.available)
  const config = getProviderConfigStatus()

  const payload: QuotesPayload = {
    as_of_utc: nowIso(),
    provider_order: providerOrder,
    provider_breakdown: breakdown,
    count: cleaned.length,
    stale,
    snapshot_as_of_utc: snapshot.asOfUtc,
    diagnostics: {
      runtime_ms: Date.now() - startedAt,
      cache_hit: false,
      keys: config.keys,
      snapshot: {
        url: snapshot.url,
        ok: snapshot.ok,
        fetched: snapshot.fetched,
        stale: snapshot.stale,
        as_of_utc: snapshot.asOfUtc,
        error: snapshot.error
      }
    },
    quotes
  }

  saveQuotesCache(cacheKey, payload)
  return payload
}
