import { NextRequest, NextResponse } from "next/server"
import { validateSymbol } from '@/lib/validate'
import { checkDataRateLimit } from '@/lib/ratelimit'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const chartCache = new Map<string, { data: unknown; expires: number }>()

async function fetchFromUpstox(symbol: string, period: string, rangeMap: Record<string, { days: number; interval: string }>) {
  const upstoxToken = process.env.UPSTOX_ACCESS_TOKEN
  if (!upstoxToken) return null

  const config = rangeMap[period] || { days: 365, interval: "1day" }
  
  const toDate = new Date()
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - config.days)

  const symbolMap: Record<string, string> = {}
  const fs = await import('fs')
  try {
    const mapContent = fs.readFileSync('/tmp/upstox_symbol_map.json', 'utf-8')
    Object.assign(symbolMap, JSON.parse(mapContent))
  } catch {}

  const instrumentKey = symbolMap[symbol.toUpperCase()] || symbolMap[symbol.replace('.NS', '')]
  if (!instrumentKey) return null

  try {
    const intervalMap: Record<string, string> = {
      "1day": "day",
      "1week": "week", 
      "1month": "month"
    }
    
    const url = `https://api.upstox.com/v2/historical/${instrumentKey}/${intervalMap[config.interval] || 'day'}?start_date=${fromDate.toISOString().split('T')[0]}&end_date=${toDate.toISOString().split('T')[0]}`
    
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${upstoxToken}`,
        Accept: "application/json"
      },
      next: { revalidate: 300 }
    })

    if (!res.ok) return null

    const json = await res.json()
    const candles = json?.data?.candles || []
    
    if (!candles || candles.length === 0) return null

    const data: { time: string; open: number; high: number; low: number; close: number }[] = []
    const volume: { time: string; value: number; color: string }[] = []

    for (const candle of candles) {
      const [date, open, high, low, close, vol] = candle
      const time = new Date(date).toISOString().split('T')[0]
      data.push({ time, open, high, low, close })
      const prevClose = data.length > 1 ? data[data.length - 2].close : close
      const volColor = close >= prevClose ? "#26a69a" : "#ef5350"
      volume.push({ time, value: vol || 0, color: volColor })
    }

    return { candles: data, volume }
  } catch {
    return null
  }
}

async function fetchFromYahoo(symbol: string, period: string = "1y") {
  const intervalMap: Record<string, string> = {
    "1wk": "1d",
    "1mo": "1d",
    "3mo": "1d",
    "6mo": "1d",
    "1y": "1d",
    "2y": "1wk",
    "5y": "1wk",
    "max": "1mo"
  }

  const rangeMap: Record<string, { range: string; days: number }> = {
    "1wk": { range: "5d", days: 7 },
    "1mo": { range: "1mo", days: 30 },
    "3mo": { range: "3mo", days: 90 },
    "6mo": { range: "6mo", days: 180 },
    "1y": { range: "1y", days: 365 },
    "2y": { range: "2y", days: 730 },
    "5y": { range: "5y", days: 1825 },
    "max": { range: "max", days: 3650 }
  }

  const range = rangeMap[period]?.range || "1y"
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
  
  if (!result || !result.timestamp || result.timestamp.length === 0) {
    return null
  }
  
  const timestamps = result.timestamp || []
  const quote = result.indicators?.quote?.[0] || {}
  
  const data: { time: string; open: number; high: number; low: number; close: number }[] = []
  const volume: { time: string; value: number; color: string }[] = []
  
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
  
  if (data.length === 0) return null
  
  return { candles: data, volume }
}

function processChartData(
  data: { time: string; open: number; high: number; low: number; close: number }[],
  volume: { time: string; value: number; color: string }[]
) {
  const closesFromData = data.map(d => d.close)
  const rsiValues = calculateRSI(closesFromData)
  const { macd, signal: macdSignal, histogram } = calculateMACDArrays(closesFromData)
  const { oversold: rsiOversold, overbought: rsiOverbought } = calculateDynamicThresholds(rsiValues)
  
  const volumes = data.map((_, i) => volume[i]?.value || 0)
  const avgVolume20d = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20
  
  const ema21 = calculateEMA(closesFromData, 21)
  const ema55 = calculateEMA(closesFromData, 55)
  
  const ema21Data = data.map((_, i) => ({
    time: data[i].time,
    value: ema21[i] || closesFromData[i] || 0,
  }))
  
  const ema55Data = data.map((_, i) => ({
    time: data[i].time,
    value: ema55[i] || closesFromData[i] || 0,
  }))
  
  return { 
    candles: data, 
    ema21: ema21Data, 
    ema55: ema55Data,
    rsi: rsiValues.map((v, i) => ({ time: data[i].time, value: v })),
    rsi_oversold: rsiOversold,
    rsi_overbought: rsiOverbought,
    macd: macd.map((v, i) => ({ time: data[i].time, value: v })),
    macd_signal: macdSignal.map((v, i) => ({ time: data[i].time, value: v })),
    macd_histogram: histogram.map((v, i) => ({ time: data[i].time, value: v })),
    volume: volume,
    avg_volume_20d: avgVolume20d
  }
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

function calculateRSI(values: number[], period: number = 14): number[] {
  if (values.length < period + 1) return []
  
  const rsiValues: number[] = []
  
  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      rsiValues.push(50)
      continue
    }
    
    let gains = 0
    let losses = 0
    
    for (let j = i - period + 1; j <= i; j++) {
      const change = values[j] - values[j - 1]
      if (change > 0) gains += change
      else losses -= change
    }
    
    const avgGain = gains / period
    const avgLoss = losses / period
    
    if (avgLoss === 0) {
      rsiValues.push(100)
    } else {
      const rs = avgGain / avgLoss
      rsiValues.push(100 - (100 / (1 + rs)))
    }
  }
  
  return rsiValues
}

function calculateMACDArrays(values: number[]) {
  const ema12 = calculateEMA(values, 12)
  const ema26 = calculateEMA(values, 26)
  const macdLine: number[] = []
  const signalLine: number[] = []
  const histogram: number[] = []
  
  for (let i = 0; i < values.length; i++) {
    const macd = (ema12[i] || 0) - (ema26[i] || 0)
    macdLine.push(macd)
  }
  
  const signalEma = calculateEMA(macdLine.filter((_, i) => i >= macdLine.length - 9), 9)
  for (let i = 0; i < macdLine.length; i++) {
    if (i < macdLine.length - 9) {
      signalLine.push(0)
    } else {
      signalLine.push(signalEma[i - (macdLine.length - 9)] || 0)
    }
    histogram.push(macdLine[i] - signalLine[i])
  }
  
  return { macd: macdLine, signal: signalLine, histogram }
}

function calculateDynamicThresholds(rsiValues: number[]): { oversold: number; overbought: number } {
  const sorted = [...rsiValues].sort((a, b) => a - b)
  const p10 = sorted[Math.floor(sorted.length * 0.1)] || 30
  const p90 = sorted[Math.floor(sorted.length * 0.9)] || 70
  return { oversold: Math.round(p10 * 10) / 10, overbought: Math.round(p90 * 10) / 10 }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const rateLimit = checkDataRateLimit('chart', req)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds}s`, retryAfter: rateLimit.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
    )
  }

  const { symbol } = await params
  try {
    validateSymbol(symbol)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }
  const period = req.nextUrl.searchParams.get("period") || "1y"
  
  const cacheKey = `${symbol}-${period}`
  const cached = chartCache.get(cacheKey)
  
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data)
  }
  
  try {
    let chartData = await fetchFromYahoo(symbol, period)
    
    if (!chartData) {
      const upstoxRangeMap: Record<string, { days: number; interval: string }> = {
        "1wk": { days: 7, interval: "1week" },
        "1mo": { days: 30, interval: "1month" },
        "3mo": { days: 90, interval: "1month" },
        "6mo": { days: 180, interval: "1month" },
        "1y": { days: 365, interval: "1day" },
        "2y": { days: 730, interval: "1day" },
        "5y": { days: 1825, interval: "1month" },
        "max": { days: 3650, interval: "1month" }
      }
      chartData = await fetchFromUpstox(symbol, period, upstoxRangeMap)
    }
    
    if (!chartData) {
      chartCache.set(cacheKey, {
        data: { candles: [], ema21: [], ema55: [], rsi: [], macd_histogram: [], volume: [] },
        expires: Date.now() + 5 * 60 * 1000,
      })
      return NextResponse.json({ candles: [], ema21: [], ema55: [], rsi: [], macd_histogram: [], volume: [] })
    }
    
    const processedData = processChartData(chartData.candles, chartData.volume)
    
    chartCache.set(cacheKey, {
      data: processedData,
      expires: Date.now() + 5 * 60 * 1000,
    })
    
    return NextResponse.json(processedData)
  } catch (err) {
    console.error("Chart API error:", err)
    try {
      const upstoxRangeMap: Record<string, { days: number; interval: string }> = {
        "1wk": { days: 7, interval: "1week" },
        "1mo": { days: 30, interval: "1month" },
        "3mo": { days: 90, interval: "1month" },
        "6mo": { days: 180, interval: "1month" },
        "1y": { days: 365, interval: "1day" },
        "2y": { days: 730, interval: "1day" },
        "5y": { days: 1825, interval: "1month" },
        "max": { days: 3650, interval: "1month" }
      }
      const upstoxData = await fetchFromUpstox(symbol, period, upstoxRangeMap)
      if (upstoxData) {
        const processedData = processChartData(upstoxData.candles, upstoxData.volume)
        return NextResponse.json(processedData)
      }
    } catch {}
    return NextResponse.json(
      { error: "Failed to fetch chart data", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
