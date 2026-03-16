import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const signalsCache = new Map<string, { signal: unknown; expires: number }>()

async function calculateSignal(symbol: string) {
  const yfinance = await import("yfinance")
  const ticker = yfinance.default(symbol)
  const hist = await ticker.history("3mo")
  
  if (!hist || !hist.Date || hist.Date.values.length === 0) {
    throw new Error("No data returned")
  }

  const closes = hist.Close.values as number[]
  const volumes = hist.Volume.values as number[]
  const highs = hist.High.values as number[]
  const lows = hist.Low.values as number[]
  
  const currentPrice = closes[closes.length - 1]
  const prevPrice = closes[closes.length - 2]
  const priceChange = ((currentPrice - prevPrice) / prevPrice) * 100
  
  const rsi = calculateRSI(closes)
  const { macd, signal: macdSignal, histogram: macdHist } = calculateMACD(closes)
  const atr = calculateATR(highs, lows, closes)
  const adx = calculateADX(highs, lows, closes)
  const vwap = calculateVWAP(highs, lows, closes, volumes)
  
  let trend = "SIDEWAYS"
  if (ema(closes, 21) > ema(closes, 55)) {
    trend = "TRENDING_UP"
  } else if (ema(closes, 21) < ema(closes, 55)) {
    trend = "TRENDING_DOWN"
  }
  
  let momentum = "NEUTRAL"
  if (rsi > 60 && macdHist > 0) {
    momentum = "BULLISH"
  } else if (rsi < 40 && macdHist < 0) {
    momentum = "BEARISH"
  } else if (rsi > 70) {
    momentum = "OVERBOUGHT"
  } else if (rsi < 30) {
    momentum = "OVERSOLD"
  }
  
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
  const lastVolume = volumes[volumes.length - 1]
  let volume = "NORMAL"
  if (lastVolume > avgVolume * 1.5) {
    volume = "SURGE"
  } else if (lastVolume < avgVolume * 0.5) {
    volume = "LOW"
  }
  
  let reversion = "MEAN_REVERTING"
  if (Math.abs(priceChange) > 3) {
    reversion = "TREND_ACTIVE"
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
  
  const confidence = Math.min(95, Math.max(40, 50 + Math.abs(score) * 50))
  
  const fundamentals = await getFundamentals(symbol).catch(() => null)
  
  return {
    verdict,
    score,
    confidence: Math.round(confidence),
    trend,
    momentum,
    reversion,
    volume,
    rsi: Math.round(rsi * 10) / 10,
    macd_hist: Math.round(macdHist * 100) / 100,
    atr: Math.round(atr * 100) / 100,
    adx: Math.round(adx * 10) / 10,
    vwap: Math.round(vwap * 100) / 100,
    pe: fundamentals?.pe || 0,
    pb: fundamentals?.pb || 0,
    roe: fundamentals?.roe || 0,
    mkt_cap: fundamentals?.mkt_cap || 0,
    factor_decile: Math.min(10, Math.max(1, Math.round(5 + score * 5))),
    top_factor: score > 0.3 ? "Momentum" : score < -0.3 ? "Reverse Momentum" : "Mean Reversion",
  }
}

async function getFundamentals(symbol: string) {
  try {
    const yfinance = await import("yfinance")
    const ticker = yfinance.default(symbol)
    const info = await ticker.info
    
    return {
      pe: info.trailingPE || 0,
      pb: info.priceToBook || 0,
      roe: info.returnOnEquity ? info.returnOnEquity * 100 : 0,
      mkt_cap: info.marketCap || 0,
    }
  } catch {
    return null
  }
}

function ema(values: number[], period: number): number {
  const k = 2 / (period + 1)
  let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  
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
  for (let i = values.length - signal; i < values.length; i++) {
    const f = ema(values.slice(0, i + 1), fast)
    const s = ema(values.slice(0, i + 1), slow)
    macdValues.push(f - s)
  }
  
  const signalLine = macdValues.reduce((a, b) => a + b, 0) / signal
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
  
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period
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
  
  const atr = tr.slice(-period).reduce((a, b) => a + b, 0) / period
  const plusDI = (plusDM.slice(-period).reduce((a, b) => a + b, 0) / period / atr) * 100
  const minusDI = (minusDM.slice(-period).reduce((a, b) => a + b, 0) / period / atr) * 100
  
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100
  return dx
}

function calculateVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
  const typicalPrices = highs.map((h, i) => (h + lows[i] + closes[i]) / 3)
  const typicalVolumes = typicalPrices.map((p, i) => p * volumes[i])
  
  const totalTypicalVolume = typicalVolumes.slice(-20).reduce((a, b) => a + b, 0)
  const totalVolume = volumes.slice(-20).reduce((a, b) => a + b, 0)
  
  return totalTypicalVolume / totalVolume
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  
  const cached = signalsCache.get(symbol)
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ signal: cached.signal })
  }
  
  try {
    const signal = await calculateSignal(symbol)
    
    signalsCache.set(symbol, {
      signal,
      expires: Date.now() + 60 * 1000,
    })
    
    return NextResponse.json({ signal })
  } catch (err) {
    console.error("Signal calculation error:", err)
    return NextResponse.json(
      { error: "Failed to calculate signal", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
