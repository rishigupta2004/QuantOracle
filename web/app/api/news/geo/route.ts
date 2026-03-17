import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MARKET_KEYWORDS = [
  'nifty', 'sensex', 'nse', 'bse', 'rbi', 'sebi',
  'rupee', 'fii', 'dii', 'oil', 'crude', 'fed',
  'rate', 'inflation', 'gdp', 'sanctions', 'tariff',
  'war', 'market', 'stock', 'equity', 'bond',
  'reliance', 'tcs', 'hdfc', 'infosys', 'ipo',
  'bank', 'finance', 'it', 'tech', 'pharma', 'metal'
]

const HIGH_RISK_KEYWORDS = ["war", "sanctions", "rate hike", "crash", "default", "recession", "conflict"]
const MEDIUM_RISK_KEYWORDS = ["inflation", "tariff", "election", "policy", "Fed", "RBI", "meeting"]

const newsCache = { news: [], expires: 0 }
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

function getRiskLevel(text: string): "high" | "medium" | "low" {
  const lower = text.toLowerCase()
  if (HIGH_RISK_KEYWORDS.some(k => lower.includes(k))) return "high"
  if (MEDIUM_RISK_KEYWORDS.some(k => lower.includes(k))) return "medium"
  return "low"
}

function getTags(text: string): string[] {
  const tags: string[] = []
  const lower = text.toLowerCase()
  
  if (lower.includes("oil") || lower.includes("crude") || lower.includes("energy")) {
    tags.push("OIL/ENERGY")
  }
  if (lower.includes("bank") || lower.includes("finance") || lower.includes("RBI")) {
    tags.push("BANKING")
  }
  if (lower.includes("IT") || lower.includes("tech") || lower.includes("software")) {
    tags.push("IT")
  }
  if (lower.includes("pharma") || lower.includes("health")) {
    tags.push("PHARMA")
  }
  if (lower.includes("metal") || lower.includes("steel") || lower.includes("coal")) {
    tags.push("METALS")
  }
  if (lower.includes("FII") || lower.includes("DII") || lower.includes("Nifty") || lower.includes("Sensex")) {
    tags.push("BROAD MARKET")
  }
  
  return tags.length > 0 ? tags : ["GENERAL"]
}

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase()
  return MARKET_KEYWORDS.some(kw => lower.includes(kw))
}

async function fetchFromNewsData() {
  // Try both env var names
  const apiKey = process.env.NEWSDATA_API_KEY || process.env.NEWS_DATA_API_KEY
  
  if (!apiKey) {
    throw new Error("NEWSDATA_API_KEY not configured")
  }
  
  const url = new URL("https://newsdata.io/api/1/news")
  url.searchParams.set("apikey", apiKey)
  url.searchParams.set("language", "en")
  url.searchParams.set("category", "business,politics")
  url.searchParams.set("q", "NSE OR Nifty OR RBI OR oil OR sanctions OR trade OR rupee")
  url.searchParams.set("size", "10")
  
  const res = await fetch(url.toString())
  
  if (!res.ok) {
    throw new Error(`NewsData API error: ${res.status}`)
  }
  
  return res.json()
}

export async function GET() {
  if (newsCache.expires > Date.now()) {
    return NextResponse.json({ news: newsCache.news })
  }
  
  try {
    const data = await fetchFromNewsData()
    
    let articles = data.results || []
    
    // First pass: filter for relevant articles
    const relevantArticles = articles.filter((item: any) => {
      const text = `${item.title} ${item.description || ""}`
      return isRelevant(text)
    })
    
    // If no relevant articles, use all articles
    if (relevantArticles.length === 0) {
      relevantArticles.push(...articles.slice(0, 5))
    }
    
    const news = relevantArticles
      .slice(0, 10)
      .map((item: any) => {
        const text = `${item.title} ${item.description || ""}`
        
        return {
          title: item.title,
          source: item.source_id || "Unknown",
          pubDate: item.pubDate || new Date().toISOString(),
          link: item.link || null,
          tags: getTags(text),
          risk: getRiskLevel(text),
        }
      })
    
    newsCache.news = news
    newsCache.expires = Date.now() + CACHE_TTL_MS
    
    return NextResponse.json({ news })
  } catch (err) {
    console.error("Geo news API error:", err)
    
    // Return empty news with error message for debugging
    return NextResponse.json({ 
      news: [],
      error: process.env.NEWSDATA_API_KEY || process.env.NEWS_DATA_API_KEY 
        ? (err instanceof Error ? err.message : "Failed to fetch news")
        : "NEWSDATA_API_KEY not configured - add to Vercel env vars"
    })
  }
}
