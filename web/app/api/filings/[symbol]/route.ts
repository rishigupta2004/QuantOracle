import { NextRequest, NextResponse } from "next/server"
import { validateSymbol } from "@/lib/validate"
import { checkDataRateLimit } from "@/lib/ratelimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type FilingItem = {
  id: string
  title: string
  date: string
  source: string
  type: string
  url?: string
}

async function fetchNSEFilings(symbol: string): Promise<FilingItem[]> {
  const clean = symbol.replace(".NS", "").replace(".BO", "")
  const url = `https://www.nseindia.com/api/corporate-announcements?index=equities&symbol=${encodeURIComponent(clean)}`
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      Referer: "https://www.nseindia.com/",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 900 },
  })
  if (!res.ok) return []
  const json = await res.json()
  if (!Array.isArray(json)) return []
  return json.slice(0, 20).map((item: any, idx: number) => ({
    id: `nse-${idx}-${item?.an_dt || ""}`,
    title: item?.desc || item?.sm_name || "Corporate announcement",
    date: item?.an_dt || item?.broadcastdate || "",
    source: "NSE",
    type: item?.attchmntText || "Announcement",
    url: item?.attchmntFile || undefined,
  }))
}

async function fetchYahooFallback(symbol: string): Promise<FilingItem[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}`
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    next: { revalidate: 1800 },
  })
  if (!res.ok) return []
  const json = await res.json()
  const news = Array.isArray(json?.news) ? json.news : []
  return news.slice(0, 20).map((n: any, idx: number) => ({
    id: `yahoo-${idx}-${n?.uuid || ""}`,
    title: n?.title || "Market update",
    date: n?.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : "",
    source: n?.publisher || "Yahoo",
    type: "News / Filing Related",
    url: n?.link || undefined,
  }))
}

async function fetchCorporateActions(symbol: string) {
  const url = `https://query2.finance.yahoo.com/v11/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents,summaryDetail`
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    next: { revalidate: 3600 },
  })
  if (!res.ok) return {}
  const json = await res.json()
  const result = json?.quoteSummary?.result?.[0]
  const ce = result?.calendarEvents || {}
  const sd = result?.summaryDetail || {}
  return {
    earningsDate: ce?.earnings?.earningsDate?.[0]?.fmt || null,
    exDividendDate: sd?.exDividendDate?.fmt || null,
    dividendRate: sd?.dividendRate?.fmt || null,
    dividendYield: sd?.dividendYield?.raw ? `${(sd.dividendYield.raw * 100).toFixed(2)}%` : null,
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const rateLimit = checkDataRateLimit("screener", req)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds}s`, retryAfter: rateLimit.resetInSeconds },
      { status: 429, headers: { "Retry-After": String(rateLimit.resetInSeconds) } }
    )
  }

  const { symbol } = await params
  try {
    validateSymbol(symbol)
  } catch {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 })
  }

  const isIndian = symbol.endsWith(".NS") || symbol.endsWith(".BO")
  let items: FilingItem[] = []
  let source = "fallback"

  try {
    if (isIndian) {
      items = await fetchNSEFilings(symbol)
      if (items.length > 0) source = "nse"
    }
  } catch {
    // ignore and fallback
  }

  if (items.length === 0) {
    items = await fetchYahooFallback(symbol)
    if (items.length > 0) source = "yahoo"
  }

  const actions = await fetchCorporateActions(symbol).catch(() => ({}))
  return NextResponse.json({
    symbol,
    source,
    items,
    actions,
  })
}

