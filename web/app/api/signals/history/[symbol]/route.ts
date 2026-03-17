import { NextRequest, NextResponse } from "next/server"
import { validateSymbol } from '@/lib/validate'
import { checkDataRateLimit } from '@/lib/ratelimit'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const historyCache = new Map<string, { data: unknown; expires: number }>()

async function fetchHistoricalData(symbol: string, range: string = "1y") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`
  
  const res = await fetch(url, {
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'Accept': 'application/json',
    },
    next: { revalidate: 3600 }
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
  
  const closes = quote.close?.filter((v: number) => v !== null && v !== undefined) || []
  const volumes = quote.volume?.filter((v: number) => v !== null && v !== undefined) || []
  const highs = quote.high?.filter((v: number) => v !== null && v !== undefined) || []
  const lows = quote.low?.filter((v: number) => v !== null && v !== undefined) || []
  
  if (closes.length === 0) {
    throw new Error("No price data available")
  }
  
  return { closes, volumes, highs, lows, timestamps }
}

function ema(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] || 0
  
  const k = 2 / (period + 1)
  let emaVal = values.slice(0, period).reduce((a: number, b: number) => a + b, 0) / period
  
  for (let i = period; i < values.length; i++) {
    emaVal = values[i] * k + emaVal * (1 - k)
  }
  
  return emaVal
}

function calculateRSI(values: number[], period: number = 14): number {
  if (values.length < period + 1) return 50
  
  let gains = 0
  let losses = 0
  
  for (let i = values.length - period; i < values.length; i++) {
    const change = values[i] - values[i - 1]
    if (change > 0) gains += change
    else losses -= change
  }
  
  const avgGain = gains / period
  const avgLoss = losses / period
  
  if (avgLoss === 0) return 100
  
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

function calculateMACD(values: number[], fast: number = 12, slow: number = 26, signal: number = 9) {
  const fastEMA = ema(values, fast)
  const slowEMA = ema(values, slow)
  const macdLine = fastEMA - slowEMA
  
  const macdValues: number[] = []
  for (let i = Math.max(0, values.length - signal); i < values.length; i++) {
    const f = ema(values.slice(0, i + 1), fast)
    const s = ema(values.slice(0, i + 1), slow)
    macdValues.push(f - s)
  }
  
  const signalLine = macdValues.length > 0 
    ? macdValues.reduce((a: number, b: number) => a + b, 0) / macdValues.length 
    : 0
  const histogram = macdLine - signalLine
  
  return { macd: macdLine, signal: signalLine, histogram }
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period + 1) return 0
  
  const trs: number[] = []
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    )
    trs.push(tr)
  }
  
  return trs.slice(-period).reduce((a: number, b: number) => a + b, 0) / period
}

function calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period + 1) return 0
  
  const plusDM: number[] = []
  const minusDM: number[] = []
  const tr: number[] = []
  
  for (let i = 1; i < highs.length; i++) {
    const upMove = highs[i] - highs[i - 1]
    const downMove = lows[i - 1] - lows[i]
    
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0)
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0)
    
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ))
  }
  
  const atr = tr.slice(-period).reduce((a: number, b: number) => a + b, 0) / period
  if (atr === 0) return 0
  
  const plusDI = (plusDM.slice(-period).reduce((a: number, b: number) => a + b, 0) / period / atr) * 100
  const minusDI = (minusDM.slice(-period).reduce((a: number, b: number) => a + b, 0) / period / atr) * 100
  
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100
  return dx
}

function calculateVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  const typicalPrices = highs.map((h, i) => (h + lows[i] + closes[i]) / 3)
  const typicalVolumes = typicalPrices.map((p, i) => p * volumes[i])
  
  const totalTypicalVolume = typicalVolumes.slice(-20).reduce((a: number, b: number) => a + b, 0)
  const totalVolume = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0)
  
  return totalVolume > 0 ? totalTypicalVolume / totalVolume : 0
}

function calculateSignalAtPoint(
  closes: number[], 
  volumes: number[], 
  highs: number[], 
  lows: number[], 
  endIndex: number
): { verdict: "BUY" | "SELL" | "HOLD"; score: number } | null {
  if (endIndex < 60) return null
  
  const lookbackCloses = closes.slice(0, endIndex + 1)
  const lookbackVolumes = volumes.slice(0, endIndex + 1)
  const lookbackHighs = highs.slice(0, endIndex + 1)
  const lookbackLows = lows.slice(0, endIndex + 1)
  
  if (lookbackCloses.length < 60) return null
  
  const currentPrice = lookbackCloses[lookbackCloses.length - 1]
  const prevPrice = lookbackCloses[lookbackCloses.length - 2]
  const priceChange = ((currentPrice - prevPrice) / prevPrice) * 100
  
  const rsi = calculateRSI(lookbackCloses)
  const { histogram: macdHist } = calculateMACD(lookbackCloses)
  const atr = calculateATR(lookbackHighs, lookbackLows, lookbackCloses)
  const adx = calculateADX(lookbackHighs, lookbackLows, lookbackCloses)
  const vwap = calculateVWAP(lookbackHighs, lookbackLows, lookbackCloses, lookbackVolumes)
  
  let trend = "SIDEWAYS"
  if (ema(lookbackCloses, 21) > ema(lookbackCloses, 55)) {
    trend = "TRENDING_UP"
  } else if (ema(lookbackCloses, 21) < ema(lookbackCloses, 55)) {
    trend = "TRENDING_DOWN"
  }
  
  const score = (
    (rsi > 50 ? 0.2 : -0.2) +
    (macdHist > 0 ? 0.2 : -0.2) +
    (currentPrice > vwap ? 0.2 : -0.2) +
    (adx > 25 ? 0.2 : 0) +
    (trend === "TRENDING_UP" ? 0.2 : trend === "TRENDING_DOWN" ? -0.2 : 0)
  )
  
  let verdict: "BUY" | "SELL" | "HOLD" = "HOLD"
  if (score > 0.3) verdict = "BUY"
  else if (score < -0.3) verdict = "SELL"
  
  return { verdict, score }
}

function timestampToDate(ts: number): string {
  const date = new Date(ts * 1000)
  return date.toISOString().split('T')[0]
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  
  const rateLimit = checkDataRateLimit('signals-history', req)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds}s`, retryAfter: rateLimit.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
    )
  }

  try {
    validateSymbol(symbol)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }
  
  const cacheKey = symbol
  const cached = historyCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ history: cached.data })
  }
  
  try {
    const { closes, volumes, highs, lows, timestamps } = await fetchHistoricalData(symbol, "1y")
    
    const signals: Array<{
      date: string
      verdict: string
      was_correct: boolean
      forward_5d_return: number
      price_at_signal: number
    }> = []
    
    for (let i = 60; i < timestamps.length - 5; i++) {
      const signalResult = calculateSignalAtPoint(closes, volumes, highs, lows, i)
      
      if (!signalResult || signalResult.verdict === "HOLD") continue
      
      const date = timestampToDate(timestamps[i])
      const priceAtSignal = closes[i]
      const forward5dClose = closes[i + 5]
      const forward5dReturn = ((forward5dClose - priceAtSignal) / priceAtSignal) * 100
      
      const wasCorrect = 
        (signalResult.verdict === "BUY" && forward5dReturn > 0) ||
        (signalResult.verdict === "SELL" && forward5dReturn < 0)
      
      signals.push({
        date,
        verdict: signalResult.verdict,
        was_correct: wasCorrect,
        forward_5d_return: Math.round(forward5dReturn * 100) / 100,
        price_at_signal: Math.round(priceAtSignal * 100) / 100,
      })
    }
    
    const stats = calculateStats(signals)
    
    const result = { signals, stats }
    
    historyCache.set(cacheKey, {
      data: result,
      expires: Date.now() + 60 * 60 * 1000,
    })
    
    return NextResponse.json(result)
  } catch (err) {
    console.error("Signal history error:", err)
    return NextResponse.json(
      { error: "Failed to calculate signal history", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}

function calculateStats(signals: Array<{
  date: string
  verdict: string
  was_correct: boolean
  forward_5d_return: number
  price_at_signal: number
}>) {
  if (signals.length === 0) {
    return {
      total: 0,
      buy_count: 0,
      sell_count: 0,
      correct: 0,
      hit_rate: 0,
      buy_accuracy: 0,
      sell_accuracy: 0,
      avg_buy_return: 0,
      avg_sell_avoided: 0,
      best_signal: null,
      worst_signal: null,
    }
  }
  
  const buySignals = signals.filter(s => s.verdict === "BUY")
  const sellSignals = signals.filter(s => s.verdict === "SELL")
  
  const correctBuy = buySignals.filter(s => s.was_correct).length
  const correctSell = sellSignals.filter(s => s.was_correct).length
  
  const totalCorrect = signals.filter(s => s.was_correct).length
  const hitRate = (totalCorrect / signals.length) * 100
  
  const buyAccuracy = buySignals.length > 0 ? (correctBuy / buySignals.length) * 100 : 0
  const sellAccuracy = sellSignals.length > 0 ? (correctSell / sellSignals.length) * 100 : 0
  
  const avgBuyReturn = buySignals.length > 0 
    ? buySignals.reduce((sum, s) => sum + s.forward_5d_return, 0) / buySignals.length 
    : 0
  
  const avgSellAvoided = sellSignals.length > 0
    ? sellSignals.filter(s => s.forward_5d_return < 0).reduce((sum, s) => sum + s.forward_5d_return, 0) / sellSignals.length
    : 0
  
  const sortedByReturn = [...signals].sort((a, b) => b.forward_5d_return - a.forward_5d_return)
  const bestSignal = sortedByReturn[0] || null
  const worstSignal = sortedByReturn[sortedByReturn.length - 1] || null
  
  return {
    total: signals.length,
    buy_count: buySignals.length,
    sell_count: sellSignals.length,
    correct: totalCorrect,
    hit_rate: Math.round(hitRate * 10) / 10,
    buy_accuracy: Math.round(buyAccuracy * 10) / 10,
    sell_accuracy: Math.round(sellAccuracy * 10) / 10,
    avg_buy_return: Math.round(avgBuyReturn * 100) / 100,
    avg_sell_avoided: Math.round(avgSellAvoided * 100) / 100,
    best_signal: bestSignal,
    worst_signal: worstSignal,
  }
}
