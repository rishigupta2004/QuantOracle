import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MARKET_KEYWORDS = [
  "oil", "sanctions", "Fed", "RBI", "tariff", "war", "crude", "rupee", "FII", "DII", "Nifty",
  "inflation", "rate", "hike", "cut", "GDP", "IPO", "broker", "upgrade", "downgrade",
  "quarterly", "earnings", "profit", "loss", "revenue", "market", "sensex", "trade",
  "import", "export", "dollar", "usd", "global", "geopolitical"
]

const HIGH_RISK_KEYWORDS = ["war", "sanctions", "rate hike", "crash", "default", "recession", "conflict"]
const MEDIUM_RISK_KEYWORDS = ["inflation", "tariff", "election", "policy", "Fed", "RBI", "meeting"]

const newsCache = { news: [], expires: 0 }
const CACHE_TTL_MS = 30 * 60 * 1000

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

function calculateRelevance(text: string): number {
  const lower = text.toLowerCase()
  let score = 0
  
  for (const keyword of MARKET_KEYWORDS) {
    if (lower.includes(keyword)) {
      score += 1
    }
  }
  
  return score
}

async function fetchFromNewsData(query: string) {
  const apiKey = process.env.NEWS_DATA_API_KEY
  
  if (!apiKey) {
    throw new Error("NEWS_DATA_API_KEY not configured")
  }
  
  const url = new URL("https://newsdata.io/api/1/news")
  url.searchParams.set("apikey", apiKey)
  url.searchParams.set("q", query)
  url.searchParams.set("category", "business,politics")
  url.searchParams.set("country", "in,us")
  url.searchParams.set("language", "en")
  url.searchParams.set("size", "20")
  
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
    const data = await fetchFromNewsData("India stock market OR NSE OR RBI OR oil prices OR Fed OR sanctions")
    
    const news = (data.results || [])
      .map((item: { title: string; source_id?: string; pubDate?: string; description?: string }) => {
        const text = `${item.title} ${item.description || ""}`
        const relevance = calculateRelevance(text)
        
        if (relevance === 0) return null
        
        return {
          title: item.title,
          source: item.source_id || "Unknown",
          pubDate: item.pubDate || new Date().toISOString(),
          tags: getTags(text),
          risk: getRiskLevel(text),
          relevance,
        }
      })
      .filter(Boolean)
      .sort((a: { relevance: number }, b: { relevance: number }) => b.relevance - a.relevance)
      .slice(0, 10)
    
    newsCache.news = news
    newsCache.expires = Date.now() + CACHE_TTL_MS
    
    return NextResponse.json({ news })
  } catch (err) {
    console.error("Geo news API error:", err)
    
    return NextResponse.json({ 
      news: [],
      error: err instanceof Error ? err.message : "Failed to fetch news" 
    })
  }
}
