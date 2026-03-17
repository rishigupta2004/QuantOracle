"use client"

import { useEffect, useState } from "react"

type NewsItem = {
  title: string
  source: string
  pubDate: string
  link: string | null
  tags: string[]
  risk: "high" | "medium" | "low"
}

const MARKET_KEYWORDS = [
  "oil", "sanctions", "Fed", "RBI", "tariff", "war", "crude", "rupee", "FII", "DII", "Nifty",
  "inflation", "rate", "hike", "cut", "GDP", "GDP growth", "IPO", "IPO", "broker", "upgrade",
  "downgrade", "Q4 results", "quarterly", "earnings", "profit", "loss", "revenue"
]

const HIGH_RISK_KEYWORDS = ["war", "sanctions", "rate hike", "crash", "default", "recession"]
const MEDIUM_RISK_KEYWORDS = ["inflation", "tariff", "election", "policy", "Fed", "RBI"]

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

export function GeoNewsPanel() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch("/api/news/geo")
        if (res.ok) {
          const data = await res.json()
          setNews(data.news || [])
        } else {
          setNews([])
        }
      } catch {
        setNews([])
      } finally {
        setLoading(false)
      }
    }

    fetchNews()
  }, [])

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))
    
    if (hours > 24) return `${Math.floor(hours / 24)}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return "Just now"
  }

  if (loading) {
    return (
      <div className="geo-news-panel terminal-panel">
        <div className="news-title">GEOPOLITICAL NEWS</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100px" }}>
          <span className="pixel-loader" />
        </div>
      </div>
    )
  }

  return (
    <div className="geo-news-panel terminal-panel">
      <div className="news-title">GEOPOLITICAL NEWS</div>
      {news.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
          No market-relevant news available
        </div>
      ) : (
        news.slice(0, 6).map((item, idx) => {
          const inner = (
            <>
              <div className="news-headline">{item.title}</div>
              <div className="news-meta">
                <span>{item.source}</span>
                <span>•</span>
                <span>{formatTime(item.pubDate)}</span>
                {item.link && <span style={{ marginLeft: 'auto', opacity: 0.5 }}>↗</span>}
              </div>
              <div className="news-tags">
                {item.tags.map((tag, i) => (
                  <span key={i} className="news-tag">{tag}</span>
                ))}
                <span className={`news-risk ${item.risk}`}>{item.risk.toUpperCase()} RISK</span>
              </div>
            </>
          )
          return item.link ? (
            <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="news-item" style={{ display: 'block', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
              {inner}
            </a>
          ) : (
            <div key={idx} className="news-item">
              {inner}
            </div>
          )
        })
      )}
    </div>
  )
}
