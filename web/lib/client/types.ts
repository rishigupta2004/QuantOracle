import type { UsagePayload } from "@/lib/billing"

export type { UsagePayload }

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

export type QuotesResponse = {
  as_of_utc: string
  provider_order: string[]
  provider_breakdown: Record<string, number>
  count: number
  stale: boolean
  snapshot_as_of_utc: string | null
  diagnostics: {
    runtime_ms: number
    cache_hit: boolean
    reliability: Record<string, number>
    keys: Record<string, boolean>
    snapshot: {
      ok: boolean
      fetched: number
      stale: boolean
      as_of_utc: string | null
      error: string | null
      url: string | null
    }
  }
  quotes: Record<string, Quote>
}

export type MacroPoint = { series: string; date: string; value: number }

export type MacroResponse = {
  vix: MacroPoint | null
  us10y: MacroPoint | null
  fedfunds: MacroPoint | null
  usd_inr: MacroPoint | null
  as_of_utc: string
}

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

export type StatusResponse = {
  service: string
  as_of_utc: string
  providers: {
    keys: Record<string, boolean>
    providers: Record<string, boolean>
    snapshot_url: string | null
  }
  news: {
    keys: Record<string, boolean>
    providers: Record<string, boolean>
    snapshot: {
      url: string | null
      available: boolean
      fresh: boolean
      as_of_utc: string | null
      count: number
      official_count: number
      oil_refinery_count: number
      error: string | null
    }
  }
  billing: {
    auth_required: boolean
    token_present: boolean
    workspace_plan_default: string
  }
  readiness: {
    billing_cards: boolean
    news_live_chain: boolean
    news_intel_fresh: boolean
    news_official_mix: boolean
    oil_refinery_coverage: boolean
    india_live_ready: boolean
    global_live_ready: boolean
  }
  probe_enabled: boolean
  probe?: {
    quotes: {
      as_of_utc: string
      provider_breakdown: Record<string, number>
      runtime_ms: number
      cache_hit: boolean
      stale: boolean
      india_live_observed: boolean
      global_live_observed: boolean
    }
    macro: {
      has_any_series: boolean
    }
    news: {
      count: number
      first_source: string | null
      first_risk_level: "low" | "medium" | "high" | null
      official_count: number
      oil_refinery_count: number
      fresh: boolean
    }
  }
}

export type NewsApiResponse = {
  query: string
  count: number
  items: NewsItem[]
  source_mode: "published_intel" | "live"
  snapshot: {
    url: string | null
    available: boolean
    fresh: boolean
    as_of_utc: string | null
    count: number
    official_count: number
    oil_refinery_count: number
    error: string | null
  }
  as_of_utc: string
}
