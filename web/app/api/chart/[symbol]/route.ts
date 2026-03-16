import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const chartCache = new Map<string, { data: unknown; expires: number }>()

async function fetchFromYahoo(symbol: string, period: string = "1y") {
  const rangeMap: Record<string, string> = {
    "1mo": "1mo",
    "3mo": "3mo",
    "6mo": "6mo",
    "1y": "1y",
    "2y": "2y",
    "5y": "5y",
    "max": "max"
  }
  const range = rangeMap[period] || "1y"
  
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  
  const res = await fetch(url, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'Accept': 'application/json',
    },
    next: { revalidate: 300 }
  })
  
  if (!res.ok) {
    throw new Error(`Yahoo API returned ${res.status}`)
  }
  
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  
  if (!result) {
    throw new Error("No data returned from Yahoo")
  }
  
  const timestamps = result.timestamp || []
  const quote = result.indicators?.quote?.[0] || {}
  const indicators = result.indicators?.indicator?.[0] || {}
  
  const data: { time: string; open: number; high: number; low: number; close: number }[] = []
  const volume: { time: string; value: number; color: string }[] = []
  
  const closes = quote.close || []
  const ema21 = calculateEMA(closes.filter(Boolean) as number[], 21)
  const ema55 = calculateEMA(closes.filter(Boolean) as number[], 55)
  
  let ema21Idx = 0
  let ema55Idx = 0
  
  for (let i = 0; i < timestamps.length; i++) {
    const time = new Date(timestamps[i] * 1000).toISOString().split("T")[0]
    const open = quote.open?.[i]
    const high = quote.high?.[i]
    const low = quote.low?.[i]
    const close = quote.close?.[i]
    const vol = quote.volume?.[i]
    
    if (open === undefined || high === undefined || low === undefined || close === undefined) {
      continue
    }
    
    data.push({ time, open, high, low, close })
    
    const prevClose = i > 0 ? quote.close?.[i - 1] : close
    const volColor = i > 0 && prevClose !== undefined && close >= prevClose ? "#26a69a" : "#ef5350"
    volume.push({ time, value: vol || 0, color: volColor })
  }
  
  const closesFiltered = data.map(d => d.close)
  const ema21Data = data.map((_, i) => ({
    time: data[i].time,
    value: ema21[i] || closesFiltered[i] || 0,
  }))
  
  const ema55Data = data.map((_, i) => ({
    time: data[i].time,
    value: ema55[i] || closesFiltered[i] || 0,
  }))
  
  return { data, ema21: ema21Data, ema55: ema55Data, volume }
}

function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) {
    return values
  }
  
  const k = 2 / (period + 1)
  const ema: number[] = []
  
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += values[i]
  }
  ema.push(sum / period)
  
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[ema.length - 1] * (1 - k))
  }
  
  const padding = values.length - ema.length
  for (let i = 0; i < padding; i++) {
    ema.unshift(0)
  }
  
  return ema
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  const period = req.nextUrl.searchParams.get("period") || "1y"
  
  const cacheKey = `${symbol}-${period}`
  const cached = chartCache.get(cacheKey)
  
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data)
  }
  
  try {
    const chartData = await fetchFromYahoo(symbol, period)
    
    chartCache.set(cacheKey, {
      data: chartData,
      expires: Date.now() + 5 * 60 * 1000,
    })
    
    return NextResponse.json(chartData)
  } catch (err) {
    console.error("Chart API error:", err)
    return NextResponse.json(
      { error: "Failed to fetch chart data", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
