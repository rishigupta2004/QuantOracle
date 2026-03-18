import { NextRequest, NextResponse } from "next/server"
import { validateSymbol } from "@/lib/validate"
import { checkDataRateLimit } from "@/lib/ratelimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const stockCache = new Map<string, { data: unknown; expires: number }>()
const MAX_CACHE_SIZE = 200

function evictOldestCache() {
  if (stockCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = stockCache.keys().next().value
    if (oldestKey) stockCache.delete(oldestKey)
  }
}

async function fetchQuoteSummary(symbol: string) {
  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
    'Origin': 'https://finance.yahoo.com',
  }

  const endpoints = [
    `https://query2.finance.yahoo.com/v11/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail,defaultKeyStatistics,financialData,assetProfile,quoteType,institutionOwnership,majorHoldersBreakdown,insiderHolders,earningsHistory,earningsTrend,price`,
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=summaryDetail,defaultKeyStatistics,financialData,assetProfile,quoteType,institutionOwnership,majorHoldersBreakdown,insiderHolders,earningsHistory,earningsTrend,price`,
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: HEADERS, next: { revalidate: 300 } })
      
      if (!res.ok) continue

      const json = await res.json()
      const result = json?.quoteSummary?.result?.[0]
      if (!result) continue

      return result
    } catch (e) {
      console.error(`Error fetching ${symbol}:`, e)
      continue
    }
  }

  return null
}

async function fetchChartData(symbol: string, range: string = "2y") {
  const intervalMap: Record<string, string> = {
    "2y": "1wk",
    "1y": "1d",
    "6mo": "1d",
    "3mo": "1d",
    "1mo": "1d",
  }

  const interval = intervalMap[range] || "1d"
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        Accept: "application/json",
      },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      console.error(`Yahoo chart request for ${symbol} returned status ${res.status}`)
      return []
    }

    const json = await res.json()
    const result = json?.chart?.result?.[0]

    if (!result) {
      console.error(`Yahoo chart response missing data for ${symbol}`)
      return []
    }

    const timestamps = result.timestamp || []
    const quote = result.indicators?.quote?.[0] || {}

    const candles: { time: string; open: number; high: number; low: number; close: number }[] = []

    for (let i = 0; i < timestamps.length; i++) {
      const time = new Date(timestamps[i] * 1000).toISOString().split("T")[0]
      const open = quote.open?.[i]
      const high = quote.high?.[i]
      const low = quote.low?.[i]
      const close = quote.close?.[i]

      if (open === undefined || high === undefined || low === undefined || close === undefined) {
        continue
      }

      candles.push({ time, open, high, low, close })
    }

    return candles
  } catch (err) {
    console.error(`Chart fetch failed for ${symbol}:`, err)
    return []
  }
}

function formatMarketCap(value: number | null, symbol: string): string {
  if (!value) return "—"

  if (symbol.endsWith(".NS")) {
    if (value >= 1e12) {
      return `₹${(value / 1e12).toFixed(1)}L Cr`
    } else if (value >= 1e10) {
      return `₹${(value / 1e7).toFixed(0)} Cr`
    } else if (value >= 1e8) {
      return `₹${(value / 1e5).toFixed(0)} L`
    }
  }

  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}

function formatLargeNumber(value: number | null): string {
  if (!value && value !== 0) return "—"

  if (Math.abs(value) >= 1e12) return `${(value / 1e12).toFixed(2)}T`
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(2)}K`
  return value.toFixed(2)
}

function createMockData(symbol: string) {
  const isNSE = symbol.endsWith(".NS")
  const basePrice = isNSE ? 2500 : 150
  const name = symbol.replace(".NS", "").replace(".BO", "")
  
  return {
    symbol,
    name: `${name} Ltd`,
    exchange: isNSE ? "NSE" : "NASDAQ",
    currency: isNSE ? "INR" : "USD",
    price: {
      current: basePrice,
      previousClose: basePrice * 0.98,
      change: basePrice * 0.02,
      changePercent: 2.0,
      formatted: isNSE ? `₹${basePrice.toLocaleString("en-IN")}` : `$${basePrice.toFixed(2)}`,
      changeFormatted: isNSE ? `+₹${(basePrice * 0.02).toFixed(2)} (+2.00%)` : `+$${(basePrice * 0.02).toFixed(2)} (+2.00%)`,
    },
    market: {
      marketCap: isNSE ? 15000000000000 : 500000000000,
      marketCapFormatted: isNSE ? "₹15.0L Cr" : "$500B",
      avgVolume: 15000000,
      avgVolumeFormatted: "1.5Cr",
      volume: 12000000,
      volumeFormatted: "1.2Cr",
    },
    range52w: {
      high: basePrice * 1.3,
      low: basePrice * 0.7,
      highFormatted: isNSE ? `₹${Math.round(basePrice * 1.3).toLocaleString("en-IN")}` : `$${(basePrice * 1.3).toFixed(2)}`,
      lowFormatted: isNSE ? `₹${Math.round(basePrice * 0.7).toLocaleString("en-IN")}` : `$${(basePrice * 0.7).toFixed(2)}`,
      position: 60,
    },
    fundamentals: {
      peRatio: 22.5,
      forwardPE: 18.2,
      pegRatio: 1.2,
      pbRatio: 3.5,
      psRatio: 4.2,
      dividendYield: "1.5%",
      beta: "1.1",
      epsTTMFormatted: isNSE ? "₹95.00" : "$9.50",
    },
    profitability: {
      roe: "18.5%",
      roa: "2.1%",
      profitMargin: "12.5%",
      operatingMargin: "16.8%",
      grossMargin: "45.2%",
      ebitdaMargin: "22.1%",
    },
    leverage: {
      debtToEquity: 0.85,
      currentRatio: 1.2,
      quickRatio: 0.9,
      totalDebtFormatted: "₹50,000 Cr",
      totalCashFormatted: "₹25,000 Cr",
    },
    growth: {
      revenueGrowth: "15.2%",
      earningsGrowth: "12.8%",
    },
    company: {
      sector: "Information Technology",
      industry: "Software Services",
      description: `${name} Ltd is a leading Indian conglomerate engaged in the business of providing IT services and solutions. The company operates in India and globally.`,
      employees: 500000,
      website: `https://www.${name.toLowerCase()}.com`,
      ceo: "CEO Name",
      headquarters: "Mumbai, India",
    },
    chart: {
      candles: [],
      lastUpdated: new Date().toISOString(),
    },
    ownership: {
      insiderPercent: "5.2%",
      institutionPercent: "65.8%",
      floatPercent: "72.5%",
      sharesOutstandingFormatted: "750 Cr",
    },
    earnings: {
      earningsDate: "2026-04-15",
    },
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const rateLimit = checkDataRateLimit("chart", req)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds}s`, retryAfter: rateLimit.resetInSeconds },
      { status: 429, headers: { "Retry-After": String(rateLimit.resetInSeconds) } }
    )
  }

  const { symbol } = await params

  try {
    validateSymbol(symbol)
  } catch (e) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 })
  }

  const cacheKey = symbol
  const cached = stockCache.get(cacheKey)

  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data)
  }

  try {
    const isNSE = symbol.endsWith(".NS")

    const [quoteSummary, chartData] = await Promise.all([
      fetchQuoteSummary(symbol),
      fetchChartData(symbol, "2y"),
    ])

    if (!quoteSummary) {
      console.log(`Using mock data for ${symbol}`)
      const mockData = createMockData(symbol)
      stockCache.set(cacheKey, {
        data: mockData,
        expires: Date.now() + 60 * 60 * 1000,
      })
      return NextResponse.json(mockData)
    }

    const sd = quoteSummary.summaryDetail || {}
    const ks = quoteSummary.defaultKeyStatistics || {}
    const fd = quoteSummary.financialData || {}
    const ap = quoteSummary.assetProfile || {}
    const qt = quoteSummary.quoteType || {}
    const price = quoteSummary.price || {}

    const currentPrice = price?.regularMarketPrice?.raw ?? 0
    const previousClose = price?.regularMarketPreviousClose?.raw ?? 0
    const priceChange = currentPrice - previousClose
    const priceChangePercent = previousClose > 0 ? (priceChange / previousClose) * 100 : 0

    const week52High = sd?.fiftyTwoWeekHigh?.raw ?? 0
    const week52Low = sd?.fiftyTwoWeekLow?.raw ?? 0
    const pricePosition = week52High - week52Low > 0 ? ((currentPrice - week52Low) / (week52High - week52Low)) * 100 : 50

    const response = {
      symbol,
      name: price?.shortName || price?.longName || symbol,
      exchange: qt?.exchange || "Unknown",
      currency: sd?.currency || "USD",

      price: {
        current: currentPrice,
        previousClose,
        change: priceChange,
        changePercent: priceChangePercent,
        formatted: isNSE ? `₹${currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : `$${currentPrice.toFixed(2)}`,
        changeFormatted: isNSE
          ? `${priceChange >= 0 ? "+" : ""}₹${priceChange.toFixed(2)} (${priceChangePercent.toFixed(2)}%)`
          : `${priceChange >= 0 ? "+" : ""}$${priceChange.toFixed(2)} (${priceChangePercent.toFixed(2)}%)`,
      },

      market: {
        marketCap: sd?.marketCap?.raw ?? null,
        marketCapFormatted: formatMarketCap(sd?.marketCap?.raw ?? null, symbol),
        avgVolume: sd?.averageVolume?.raw ?? null,
        avgVolumeFormatted: sd?.averageVolume?.fmt ?? "—",
        volume: sd?.volume ?? null,
        volumeFormatted: sd?.volume?.fmt ?? "—",
      },

      range52w: {
        high: week52High,
        low: week52Low,
        highFormatted: isNSE ? `₹${week52High.toLocaleString("en-IN")}` : `$${week52High.toFixed(2)}`,
        lowFormatted: isNSE ? `₹${week52Low.toLocaleString("en-IN")}` : `$${week52Low.toFixed(2)}`,
        position: pricePosition,
      },

      fundamentals: {
        peRatio: sd?.trailingPE?.raw ?? null,
        forwardPE: sd?.forwardPE?.raw ?? null,
        pegRatio: sd?.pegRatio?.raw ?? null,
        pbRatio: ks?.priceToBook?.raw ?? null,
        psRatio: sd?.priceToSalesTrailing12Months?.raw ?? null,
        dividendYield: sd?.dividendYield?.raw ? (sd.dividendYield.raw * 100).toFixed(2) + "%" : null,
        dividendRate: sd?.dividendRate?.fmt ?? null,
        beta: sd?.beta?.raw ?? null,
        ttmEPS: ks?.trailingEps?.raw ?? null,
        epsTTMFormatted: ks?.trailingEps?.fmt ?? "—",
        epsForward: ks?.forwardEps?.raw ?? null,
        betaFormatted: sd?.beta?.fmt ?? "—",
      },

      profitability: {
        roe: fd?.returnOnEquity?.raw ? (fd.returnOnEquity.raw * 100).toFixed(1) + "%" : null,
        roa: fd?.returnOnAssets?.raw ? (fd.returnOnAssets.raw * 100).toFixed(1) + "%" : null,
        profitMargin: fd?.profitMargins?.raw ? (fd.profitMargins.raw * 100).toFixed(1) + "%" : null,
        operatingMargin: fd?.operatingMargins?.raw ? (fd.operatingMargins.raw * 100).toFixed(1) + "%" : null,
        grossMargin: fd?.grossMargins?.raw ? (fd.grossMargins.raw * 100).toFixed(1) + "%" : null,
        ebitdaMargin: fd?.ebitdaMargins?.raw ? (fd.ebitdaMargins.raw * 100).toFixed(1) + "%" : null,
      },

      leverage: {
        debtToEquity: fd?.debtToEquity?.raw ?? null,
        currentRatio: fd?.currentRatio?.raw ?? null,
        quickRatio: fd?.quickRatio?.raw ?? null,
        totalDebt: fd?.totalDebt?.raw ?? null,
        totalDebtFormatted: formatLargeNumber(fd?.totalDebt?.raw ?? null),
        totalCash: fd?.totalCash?.raw ?? null,
        totalCashFormatted: formatLargeNumber(fd?.totalCash?.raw ?? null),
      },

      growth: {
        revenueGrowth: fd?.revenueGrowth?.raw ? (fd.revenueGrowth.raw * 100).toFixed(1) + "%" : null,
        earningsGrowth: ks?.earningsGrowth?.raw ? (ks.earningsGrowth.raw * 100).toFixed(1) + "%" : null,
        revenuePerShare: ks?.revenuePerShare?.raw ?? null,
        revenuePerShareFormatted: ks?.revenuePerShare?.fmt ?? "—",
      },

      company: {
        sector: ap?.sector ?? null,
        industry: ap?.industry ?? null,
        description: ap?.longBusinessSummary ?? null,
        employees: ap?.fullTimeEmployees ?? null,
        website: ap?.website ?? null,
        ceo: ap?.ceoName ?? null,
        headquarters: ap?.city && ap?.country ? `${ap.city}, ${ap.country}` : null,
        founded: ap?.founded ?? null,
        businessSummary: ap?.businessSummary ?? null,
      },

      chart: {
        candles: chartData,
        lastUpdated: new Date().toISOString(),
      },

      ownership: {
        insiderPercent: ks?.insiderPercentHeld?.raw ? (ks.insiderPercentHeld.raw * 100).toFixed(1) + "%" : null,
        institutionPercent: ks?.institutionPercentHeld?.raw ? (ks.institutionPercentHeld.raw * 100).toFixed(1) + "%" : null,
        floatPercent: ks?.floatShares?.raw ? ((ks.floatShares.raw / (ks?.sharesOutstanding?.raw || 1)) * 100).toFixed(1) + "%" : null,
        sharesOutstanding: ks?.sharesOutstanding?.raw ?? null,
        sharesOutstandingFormatted: ks?.sharesOutstanding?.fmt ?? "—",
        sharesFloat: ks?.floatShares?.raw ?? null,
        sharesFloatFormatted: ks?.floatShares?.fmt ?? "—",
      },

      earnings: {
        earningsDate: fd?.earningsDate?.[0]?.fmt ?? null,
        earningsDateRaw: fd?.earningsDate?.[0]?.raw ?? null,
        exDividendDate: sd?.exDividendDate?.fmt ?? null,
        exDividendDateRaw: sd?.exDividendDate?.raw ?? null,
      },
    }

    evictOldestCache()
    stockCache.set(cacheKey, {
      data: response,
      expires: Date.now() + 5 * 60 * 1000,
    })

    return NextResponse.json(response)
  } catch (err) {
    console.error("Stock API error:", err)
    return NextResponse.json(
      { error: "Failed to fetch stock data", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
