import { NextRequest, NextResponse } from "next/server"
import { validateSymbol } from '@/lib/validate'
import { checkDataRateLimit } from '@/lib/ratelimit'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const peersCache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL = 10 * 60 * 1000
const MAX_CACHE_SIZE = 100

const NIFTY50_PEERS: Record<string, string[]> = {
  IT: ['TCS.NS', 'INFY.NS', 'HCLTECH.NS', 'WIPRO.NS', 'TechMahindra.NS', 'LTIM.NS'],
  BANKING: ['HDFCBANK.NS', 'ICICIBANK.NS', 'SBIN.NS', 'KOTAKBANK.NS', 'AXISBANK.NS', 'INDUSINDBK.NS'],
  FMCG: ['HINDUNILVR.NS', 'ITC.NS', 'NESTLEIND.NS', 'BRITANNIA.NS', 'DABUR.NS', 'COLGATE.NS'],
  PHARMA: ['SUNPHARMA.NS', 'DRREDDY.NS', 'CIPLA.NS', 'LUPIN.NS', 'ARCBUY.NS', 'ZYDUSLIFE.NS'],
  AUTO: ['MARUTI.NS', 'TATAMOTORS.NS', 'M&M.NS', 'BAJAJ-AUTO.NS', 'HEROMOTOCO.NS', 'EICHERMOT.NS'],
  ENERGY: ['RELIANCE.NS', 'ONGC.NS', 'IOC.NS', 'BPCL.NS', 'HINDPETRO.NS', 'GAIL.NS'],
  METALS: ['TATASTEEL.NS', 'JSWSTEEL.NS', 'HINDALCO.NS', 'NMDC.NS', 'SAIL.NS', 'COALINDIA.NS'],
  CONSUMER: ['ADANIPORTS.NS', 'ADANIENT.NS', 'ADANIGREEN.NS', 'NTPC.NS', 'POWERGRID.NS', 'GRASIM.NS'],
  BROAD_MARKET: ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFOSYS.NS', 'ICICIBANK.NS', 'HUL.NS', 'LT.NS', 'KOTAKBANK.NS'],
}

async function fetchPeersFromYahoo(symbol: string): Promise<{ sector: string | null; industry: string | null } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,summaryDetail,defaultKeyStatistics,financialData`
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 }
    })
    
    if (!res.ok) return null
    
    const json = await res.json()
    const result = json?.quoteSummary?.result?.[0]
    if (!result) return null
    
    const sector = result?.assetProfile?.sector || result?.summaryDetail?.find((m: any) => m?.sector)?.sector
    const industry = result?.assetProfile?.industry
    
    return { sector, industry }
  } catch {
    return null
  }
}

async function fetchPeerDataFromYahoo(symbols: string[]): Promise<any[]> {
  const results: any[] = []
  
  for (const sym of symbols.slice(0, 8)) {
    try {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=summaryDetail,defaultKeyStatistics,financialData,assetProfile`
      
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': 'application/json',
        },
        next: { revalidate: 3600 }
      })
      
      if (!res.ok) continue
      
      const json = await res.json()
      const result = json?.quoteSummary?.result?.[0]
      if (!result) continue
      
      const sd = result.summaryDetail || {}
      const ks = result.defaultKeyStatistics || {}
      const fd = result.financialData || {}
      const ap = result.assetProfile || {}
      
      results.push({
        symbol: sym,
        name: ap.shortName || ap.longName || sym.replace('.NS', ''),
        pe: sd.trailingPE?.raw ?? null,
        pb: ks.priceToBook?.raw ?? null,
        roe: fd.returnOnEquity?.raw ? (fd.returnOnEquity.raw * 100).toFixed(1) : null,
        market_cap: sd.marketCap?.raw ?? null,
        currency: sd.currency || fd.financialCurrency || (sym.endsWith(".NS") ? "INR" : "USD"),
        sector: ap.sector || null,
        industry: ap.industry || null,
        price: sd.regularMarketPrice?.raw ?? sd.previousClose?.raw ?? null,
        change: sd.regularMarketChangePercent?.raw ?? 0,
      })
    } catch {
      continue
    }
  }
  
  return results
}

async function fetchPeersFromUpstox(symbol: string, instrumentKey: string, token: string): Promise<any[] | null> {
  try {
    const quoteUrl = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKey)}`
    
    const quoteRes = await fetch(quoteUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      cache: "no-store"
    })
    
    if (!quoteRes.ok) return null
    
    const quoteData = await quoteRes.json()
    const entry = quoteData?.data?.[instrumentKey]
    
    if (!entry) return null
    
    const sector = entry.symbolInfo?.symbolInfo?.instrumentType || null
    return [{ sector }]
  } catch {
    return null
  }
}

function getSectorFromSymbol(symbol: string): string {
  const upper = symbol.toUpperCase()
  
  if (upper.includes('TCS') || upper.includes('INFY') || upper.includes('HCL') || upper.includes('WIPRO') || upper.includes('TECHM')) {
    return 'IT'
  }
  if (upper.includes('HDFC') || upper.includes('ICICI') || upper.includes('SBI') || upper.includes('KOTAK') || upper.includes('AXIS') || upper.includes('INDUSIND')) {
    return 'BANKING'
  }
  if (upper.includes('HUL') || upper.includes('ITC') || upper.includes('NESTLE') || upper.includes('BRITANNIA') || upper.includes('DABUR')) {
    return 'FMCG'
  }
  if (upper.includes('SUNPHARMA') || upper.includes('DRREDDY') || upper.includes('CIPLA') || upper.includes('LUPIN')) {
    return 'PHARMA'
  }
  if (upper.includes('MARUTI') || upper.includes('TATAMOTORS') || upper.includes('M&M') || upper.includes('BAJAJ') || upper.includes('HERO')) {
    return 'AUTO'
  }
  if (upper.includes('RELIANCE') || upper.includes('ONGC') || upper.includes('IOC') || upper.includes('BPCL')) {
    return 'ENERGY'
  }
  if (upper.includes('TATASTEEL') || upper.includes('JSWSTEEL') || upper.includes('HINDALCO') || upper.includes('COALINDIA')) {
    return 'METALS'
  }
  
  return 'BROAD_MARKET'
}

function getPeersForSector(sector: string, excludeSymbol: string): string[] {
  const peers = NIFTY50_PEERS[sector] || NIFTY50_PEERS.BROAD_MARKET
  return peers.filter(s => s !== excludeSymbol)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const rateLimit = checkDataRateLimit('screener', req)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds}s`, retryAfter: rateLimit.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
    )
  }

  const { symbol } = await params
  
  try {
    validateSymbol(symbol)
  } catch {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }
  
  const cacheKey = `peers-${symbol}`
  const cached = peersCache.get(cacheKey)
  
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ peers: cached.data, source: 'cache' })
  }
  
  try {
    const cleanSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`
    
    const sectorInfo = await fetchPeersFromYahoo(cleanSymbol)
    
    let peers: any[] = []
    let source = 'fallback'
    
    if (sectorInfo?.sector || sectorInfo?.industry) {
      const sectorKey = sectorInfo.sector || getSectorFromSymbol(cleanSymbol)
      const peerSymbols = getPeersForSector(sectorKey, cleanSymbol)
      peers = await fetchPeerDataFromYahoo(peerSymbols)
      source = 'yahoo'
    }
    
    if (peers.length === 0) {
      const sector = getSectorFromSymbol(cleanSymbol)
      const peerSymbols = getPeersForSector(sector, cleanSymbol)
      peers = await fetchPeerDataFromYahoo(peerSymbols)
      source = peers.length > 0 ? 'yahoo' : 'fallback'
    }
    
    if (peersCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = peersCache.keys().next().value
      if (oldestKey) peersCache.delete(oldestKey)
    }
    
    peersCache.set(cacheKey, {
      data: peers,
      expires: Date.now() + CACHE_TTL,
    })
    
    return NextResponse.json({ 
      peers,
      source,
      symbol,
      sector: sectorInfo?.sector || getSectorFromSymbol(cleanSymbol)
    })
  } catch (err) {
    console.error("Peers API error:", err)
    
    const sector = getSectorFromSymbol(symbol)
    const peerSymbols = getPeersForSector(sector, symbol)
    const fallbackPeers = await fetchPeerDataFromYahoo(peerSymbols)
    
    return NextResponse.json({ 
      peers: fallbackPeers,
      source: 'fallback',
      symbol,
      sector,
      error: err instanceof Error ? err.message : 'Unknown error'
    })
  }
}
