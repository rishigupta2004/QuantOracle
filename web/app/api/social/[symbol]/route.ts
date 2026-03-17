import { NextRequest } from 'next/server'
import { cachedResponse } from '@/lib/cache'
import { checkDataRateLimit } from '@/lib/ratelimit'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// StockTwits doesn't require authentication for public data
async function fetchStockTwits(symbol: string) {
  try {
    // Convert NSE symbol to Yahoo format for StockTwits
    const twitsSymbol = symbol.replace('.NS', '')
    
    const res = await fetch(
      `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(twitsSymbol)}.json`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
        next: { revalidate: 300 }
      }
    )
    
    if (!res.ok) {
      // StockTwits returns 404 for many Indian stocks
      if (res.status === 404) {
        return { messages: [], fallback: 'reddit' }
      }
      throw new Error(`StockTwits API returned ${res.status}`)
    }
    
    const data = await res.json()
    
    // Filter messages with > 2 likes
    const messages = (data.messages || [])
      .filter((m: any) => m.likes?.count >= 2 || m.entities?.sentiment)
      .slice(0, 15)
      .map((m: any) => ({
        id: m.id,
        user: {
          name: m.user?.name || 'Anonymous',
          username: m.user?.symbol || 'anon',
        },
        body: m.body || '',
        sentiment: m.entities?.sentiment?.basic || undefined,
        created_at: m.created_at,
        likes: m.likes?.count || 0,
      }))
    
    return { messages, fallback: null }
  } catch (err) {
    console.error("StockTwits error:", err)
    return { messages: [], fallback: 'reddit' }
  }
}

// Fallback to Reddit
async function fetchReddit(symbol: string) {
  try {
    const cleanSymbol = symbol.replace('.NS', '').replace('-USD', '')
    const queries = ['IndiaInvestments', 'IndianStockMarket', 'WallStreetBets', 'StockMarket']
    
    const allPosts: any[] = []
    
    for (const sub of queries.slice(0, 2)) {
      const res = await fetch(
        `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(cleanSymbol)}&sort=new&limit=5`,
        {
          headers: {
            'User-Agent': 'QuantOracle/1.0',
          },
          next: { revalidate: 300 }
        }
      )
      
      if (res.ok) {
        const data = await res.json()
        const posts = (data.data?.children || []).map((p: any) => ({
          id: p.data.id,
          user: {
            name: p.data.author,
            username: p.data.author,
          },
          body: p.data.title,
          sentiment: null, // Reddit doesn't have built-in sentiment
          created_at: p.data.created_utc,
          likes: p.data.ups || 0,
          subreddit: sub,
        }))
        allPosts.push(...posts)
      }
    }
    
    // Sort by likes and return top 10
    return allPosts
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 10)
  } catch (err) {
    console.error("Reddit error:", err)
    return []
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params
  
  // Rate limit check
  const rateLimit = checkDataRateLimit('social', req)
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Rate limit exceeded. Try again in ${rateLimit.resetInSeconds}s`, retryAfter: rateLimit.resetInSeconds },
      { status: 429, headers: { 'Retry-After': String(rateLimit.resetInSeconds) } }
    )
  }

  try {
    // First try StockTwits
    const stockTwitsResult = await fetchStockTwits(symbol)
    
    if (stockTwitsResult.messages.length > 0) {
      return cachedResponse({ 
        source: 'stocktwits',
        messages: stockTwitsResult.messages 
      }, 'social')
    }
    
    // Fallback to Reddit if no StockTwits data
    if (stockTwitsResult.fallback === 'reddit') {
      const redditPosts = await fetchReddit(symbol)
      return cachedResponse({ 
        source: 'reddit',
        messages: redditPosts
      }, 'social')
    }
    
    return cachedResponse({ 
      source: 'none',
      messages: [] 
    }, 'social')
  } catch (err) {
    console.error("Social API error:", err)
    return Response.json(
      { error: 'Failed to fetch social data', details: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
