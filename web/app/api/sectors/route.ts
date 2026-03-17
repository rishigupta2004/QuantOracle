import { NextRequest } from 'next/server'
import { UNIVERSE } from '@/lib/universe'
import { cachedResponse } from '@/lib/cache'
import { checkDataRateLimit } from '@/lib/ratelimit'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Sector groupings
const SECTOR_GROUPS: Record<string, string[]> = {
  'Banking': UNIVERSE.nifty50_banking,
  'IT': UNIVERSE.nifty50_it,
  'Energy': UNIVERSE.nifty50_energy,
  'Auto': UNIVERSE.nifty50_auto,
  'FMCG': UNIVERSE.nifty50_fmcg,
  'Pharma': UNIVERSE.nifty50_pharma,
  'Metals': UNIVERSE.nifty50_metals,
}

async function fetchQuote(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 }
    })
    if (!res.ok) return null
    const json = await res.json()
    const meta = json?.chart?.result?.[0]?.meta
    if (!meta) return null
    const price = meta.regularMarketPrice ?? meta.previousClose
    const prevClose = meta.previousClose ?? meta.chartPreviousClose
    const change = prevClose ? ((price - prevClose) / prevClose * 100) : 0
    return { price, change }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  // Rate limit check
  const rateLimit = checkDataRateLimit('sectors', request)
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds}s`, retryAfter: rateLimit.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
    )
  }

  try {
    // Fetch quotes for all sector symbols
    const allSymbols = Object.values(SECTOR_GROUPS).flat()
    const quotes = await Promise.all(
      allSymbols.map(async (sym) => {
        const quote = await fetchQuote(sym)
        return [sym, quote] as [string, { price: number; change: number } | null]
      })
    )

    const quoteMap = new Map(quotes)
    
    // Calculate sector returns
    const sectors = Object.entries(SECTOR_GROUPS).map(([sectorName, symbols]) => {
      const changes = symbols
        .map(sym => quoteMap.get(sym)?.change)
        .filter((c): c is number => c !== null && c !== undefined)
      
      const return_pct = changes.length > 0
        ? changes.reduce((a, b) => a + b, 0) / changes.length
        : 0

      // Find top gainer and loser
      const symbolChanges = symbols
        .map(sym => ({ symbol: sym, change: quoteMap.get(sym)?.change ?? 0 }))
        .filter(s => s.change !== 0)
        .sort((a, b) => b.change - a.change)

      const top_gainer = symbolChanges[0]?.change > 0 ? symbolChanges[0] : undefined
      const top_loser = symbolChanges[symbolChanges.length - 1]?.change < 0 
        ? symbolChanges[symbolChanges.length - 1] 
        : undefined

      return {
        sector: sectorName,
        return_pct: Math.round(return_pct * 100) / 100,
        top_gainer: top_gainer ? {
          symbol: top_gainer.symbol,
          change: Math.round(top_gainer.change * 100) / 100
        } : undefined,
        top_loser: top_loser ? {
          symbol: top_loser.symbol,
          change: Math.round(top_loser.change * 100) / 100
        } : undefined,
        members: symbols,
      }
    })

    return cachedResponse({ sectors }, 'sectors')
  } catch (err) {
    console.error("Sectors API error:", err)
    return Response.json(
      { error: 'Failed to fetch sector data', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
