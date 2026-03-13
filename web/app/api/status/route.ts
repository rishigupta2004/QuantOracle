import { NextRequest, NextResponse } from "next/server"

import { getMacroSnapshot } from "@/lib/macro"
import { getNews, getNewsConfigStatus, getNewsSnapshotInfo } from "@/lib/news"
import { getProviderConfigStatus, getQuotes } from "@/lib/providers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function hasValue(v: string | undefined): boolean {
  return Boolean((v ?? "").trim())
}

export async function GET(req: NextRequest) {
  const probe = req.nextUrl.searchParams.get("probe") === "1"

  const providers = getProviderConfigStatus()
  const news = getNewsConfigStatus()
  const newsSnapshot = await getNewsSnapshotInfo()

  const billing = {
    auth_required: (process.env.QUANTORACLE_BILLING_REQUIRE_AUTH ?? "0") === "1",
    token_present: hasValue(process.env.QUANTORACLE_BILLING_TOKEN),
    workspace_plan_default: (process.env.QUANTORACLE_WORKSPACE_PLAN ?? "starter").trim() || "starter"
  }

  const readiness = {
    billing_cards: true,
    news_live_chain:
      news.providers.published_intel ||
      news.providers.newsdata ||
      news.providers.thenewsapi ||
      news.providers.gnews ||
      news.providers.rss,
    news_intel_fresh: newsSnapshot.available && newsSnapshot.fresh,
    news_official_mix: newsSnapshot.official_count > 0,
    oil_refinery_coverage: newsSnapshot.oil_refinery_count > 0,
    india_live_ready: providers.providers.upstox,
    global_live_ready: providers.providers.finnhub || providers.providers.eodhd
  }

  const out: Record<string, unknown> = {
    service: "quantoracle-web",
    as_of_utc: new Date().toISOString(),
    providers,
    news: {
      ...news,
      snapshot: newsSnapshot
    },
    billing,
    readiness,
    probe_enabled: probe
  }

  if (probe) {
    const [quotesProbe, macroProbe, newsProbe] = await Promise.all([
      getQuotes(["RELIANCE.NS", "AAPL", "BTC-USD"]),
      getMacroSnapshot(),
      getNews("")
    ])

    const indiaLive = Object.values(quotesProbe.quotes).some(
      (q) => q.symbol.endsWith(".NS") && q.available && q.source !== "supabase_snapshot"
    )
    const globalLive = Object.values(quotesProbe.quotes).some(
      (q) => !q.symbol.endsWith(".NS") && !q.symbol.endsWith(".BO") && q.available
    )

    out.probe = {
      quotes: {
        as_of_utc: quotesProbe.as_of_utc,
        provider_breakdown: quotesProbe.provider_breakdown,
        stale: quotesProbe.stale,
        india_live_observed: indiaLive,
        global_live_observed: globalLive
      },
      macro: {
        has_any_series: Boolean(macroProbe.vix || macroProbe.us10y || macroProbe.fedfunds || macroProbe.usd_inr)
      },
      news: {
        count: newsProbe.length,
        first_source: newsProbe[0]?.source ?? null,
        first_risk_level: newsProbe[0]?.impact?.risk_level ?? null,
        official_count: newsSnapshot.official_count,
        oil_refinery_count: newsSnapshot.oil_refinery_count,
        fresh: newsSnapshot.fresh
      }
    }
  }

  return NextResponse.json(out)
}
