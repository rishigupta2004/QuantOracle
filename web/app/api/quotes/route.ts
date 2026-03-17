import { NextRequest } from 'next/server'
import { checkDataRateLimit } from '@/lib/ratelimit'

const SYMBOL_MAP: Record<string, string> = {
  'RELIANCE': 'RELIANCE.NS',
  'TCS': 'TCS.NS', 
  'HDFCBANK': 'HDFCBANK.NS',
  'INFY': 'INFY.NS',
  'ICICIBANK': 'ICICIBANK.NS',
  'SBIN': 'SBIN.NS',
  'NIFTY50': '^NSEI',
  'SENSEX': '^BSESN',
  'BANKNIFTY': '^NSEBANK',
}

async function fetchYahooQuote(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`
    const res = await fetch(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json',
      },
      next: { revalidate: 300 }
    })
    if (!res.ok) return null
    const json = await res.json()
    const meta = json?.chart?.result?.[0]?.meta
    if (!meta) return null
    const price = meta.regularMarketPrice ?? meta.previousClose
    const prevClose = meta.previousClose ?? meta.chartPreviousClose
    const change = prevClose ? ((price - prevClose) / prevClose * 100) : 0
    return { 
      price: parseFloat(price?.toFixed(2)),
      change: parseFloat(change?.toFixed(2)),
      currency: meta.currency,
      is_live: meta.marketState === 'REGULAR',
    }
  } catch { return null }
}

export async function GET(request: NextRequest) {
  // Rate limit check
  const rateLimit = checkDataRateLimit('quotes', request)
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds}s`, retryAfter: rateLimit.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
    )
  }
  
  const { searchParams } = new URL(request.url)
  const symbolsParam = searchParams.get('symbols') ?? 
    'RELIANCE.NS,TCS.NS,HDFCBANK.NS,INFY.NS,ICICIBANK.NS,SBIN.NS,^NSEI,^BSESN'
  
  const symbols = symbolsParam.split(',').map(s => s.trim())
  
  const results = await Promise.allSettled(
    symbols.map(async sym => {
      const quote = await fetchYahooQuote(sym)
      return [sym, quote]
    })
  )
  
  const quotes: Record<string, any> = {}
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value[1]) {
      quotes[r.value[0] as string] = r.value[1]
    }
  })
  
  return Response.json({ 
    quotes,
    as_of: new Date().toISOString(),
    count: Object.keys(quotes).length
  })
}
