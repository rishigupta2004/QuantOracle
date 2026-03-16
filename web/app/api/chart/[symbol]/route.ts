import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const chartCache = new Map<string, { data: unknown; expires: number }>()

async function fetchFromYfinance(symbol: string, period: string = "1y") {
  const yfinance = await import("yfinance")
  const ticker = yfinance.default(symbol)
  const hist = await ticker.history(period)
  
  if (!hist || !hist.Date || hist.Date.values.length === 0) {
    throw new Error("No data returned from yfinance")
  }

  const data: { time: string; open: number; high: number; low: number; close: number }[] = []
  const volume: { time: string; value: number; color: string }[] = []
  
  const closes = hist.Close.values
  const ema21 = calculateEMA(closes, 21)
  const ema55 = calculateEMA(closes, 55)
  
  for (let i = 0; i < hist.Date.length; i++) {
    const date = new Date(hist.Date.values[i])
    const time = date.toISOString().split("T")[0]
    const close = Number(hist.Close.values[i])
    const open = Number(hist.Open.values[i])
    const high = Number(hist.High.values[i])
    const low = Number(hist.Low.values[i])
    const vol = Number(hist.Volume.values[i])
    
    data.push({ time, open, high, low, close })
    
    const volColor = i > 0 && close >= Number(hist.Close.values[i - 1]) ? "#26a69a" : "#ef5350"
    volume.push({ time, value: vol, color: volColor })
  }
  
  const ema21Data = data.map((d, i) => ({
    time: d.time,
    value: ema21[i] || d.close,
  }))
  
  const ema55Data = data.map((d, i) => ({
    time: d.time,
    value: ema55[i] || d.close,
  }))
  
  return { data, ema21: ema21Data, ema55: ema55Data, volume }
}

function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = []
  
  let sum = 0
  for (let i = 0; i < Math.min(period, values.length); i++) {
    sum += values[i]
  }
  ema.push(sum / period)
  
  for (let i = period; i < values.length; i++) {
    ema.push(values[i] * k + ema[ema.length - 1] * (1 - k))
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
    const chartData = await fetchFromYfinance(symbol, period)
    
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
