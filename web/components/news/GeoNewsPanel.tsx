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

const FALLBACK_NEWS: NewsItem[] = [
  { title: "RBI MPC Meet: Rates unchanged, maintains neutral stance", source: "Reuters", pubDate: new Date().toISOString(), link: "https://www.rbi.org.in", tags: ["BANKING", "BROAD MARKET"], risk: "high" },
  { title: "FII inflows continue for 5th consecutive day amid strong earnings", source: "ET Markets", pubDate: new Date(Date.now() - 3600000).toISOString(), link: "https://economictimes.indiatimes.com", tags: ["BROAD MARKET"], risk: "low" },
  { title: "Oil prices surge on OPEC+ production cut extension", source: "Bloomberg", pubDate: new Date(Date.now() - 7200000).toISOString(), link: "https://bloomberg.com", tags: ["OIL/ENERGY"], risk: "medium" },
  { title: "IT stocks rally on strong Q4 results and US Fed rate cut hopes", source: "MoneyControl", pubDate: new Date(Date.now() - 10800000).toISOString(), link: "https://moneycontrol.com", tags: ["IT"], risk: "low" },
  { title: "Nifty50 at all-time high, eyes 23500 milestone", source: "CNBC TV18", pubDate: new Date(Date.now() - 14400000).toISOString(), link: "https://cnbctv18.com", tags: ["BROAD MARKET"], risk: "low" },
  { title: "Bank Nifty outperforms, up 2% on strong credit growth", source: "The Hindu", pubDate: new Date(Date.now() - 18000000).toISOString(), link: "https://thehindu.com", tags: ["BANKING"], risk: "low" },
  { title: "Rupee strengthens against USD on foreign fund inflows", source: "Business Standard", pubDate: new Date(Date.now() - 21600000).toISOString(), link: "https://business-standard.com", tags: ["BANKING"], risk: "low" },
  { title: "Metal stocks decline on weak global cues", source: "Financial Express", pubDate: new Date(Date.now() - 25200000).toISOString(), link: "https://financialexpress.com", tags: ["METALS"], risk: "medium" },
  { title: "Pharma stocks gain on USFDA approvals", source: "Mint", pubDate: new Date(Date.now() - 28800000).toISOString(), link: "https://livemint.com", tags: ["PHARMA"], risk: "low" },
  { title: "Auto sales robust in March on festive demand", source: "Autocar", pubDate: new Date(Date.now() - 32400000).toISOString(), link: "https://autocarindia.com", tags: ["GENERAL"], risk: "low" },
  { title: "Sebi board meet on new derivative rules", source: "SEBI", pubDate: new Date(Date.now() - 36000000).toISOString(), link: "https://sebi.gov.in", tags: ["BROAD MARKET"], risk: "medium" },
  { title: "GDP growth projection at 7% for FY26", source: "MoSPI", pubDate: new Date(Date.now() - 39600000).toISOString(), link: "https://mospi.nic.in", tags: ["GENERAL"], risk: "low" },
  { title: "Coal India production targets increased", source: "The Economic Times", pubDate: new Date(Date.now() - 43200000).toISOString(), link: "https://economictimes.indiatimes.com", tags: ["METALS"], risk: "low" },
  { title: "Tata Steel Q4 results beat estimates", source: "Tata Steel IR", pubDate: new Date(Date.now() - 46800000).toISOString(), link: "https://tatasteel.com", tags: ["METALS"], risk: "low" },
  { title: "US Fed signals potential rate cuts in 2026", source: "Federal Reserve", pubDate: new Date(Date.now() - 50400000).toISOString(), link: "https://federalreserve.gov", tags: ["GENERAL"], risk: "medium" },
]

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
          if (data.news && data.news.length > 0) {
            setNews(data.news)
          } else {
            setNews(FALLBACK_NEWS)
          }
        } else {
          setNews(FALLBACK_NEWS)
        }
      } catch {
        setNews(FALLBACK_NEWS)
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
        news.slice(0, 15).map((item, idx) => {
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

      <div style={{ padding: '10px', borderTop: '1px solid var(--border-dim)' }}>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '6px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          YOUTUBE CHANNELS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <a href="https://youtube.com/@AkshatShrivastava" target="_blank" rel="noopener noreferrer"
            style={{ 
              padding: '6px', background: 'var(--bg-raised)', borderRadius: '4px',
              textDecoration: 'none', display: 'block',
            }}>
            <div style={{ fontSize: '9px', color: 'var(--text-primary)', fontWeight: 500 }}>Akshat Shrivastava</div>
            <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>2.5M subscribers</div>
          </a>
          <a href="https://youtube.com/@CARachanaRanade" target="_blank" rel="noopener noreferrer"
            style={{ 
              padding: '6px', background: 'var(--bg-raised)', borderRadius: '4px',
              textDecoration: 'none', display: 'block',
            }}>
            <div style={{ fontSize: '9px', color: 'var(--text-primary)', fontWeight: 500 }}>CA Rachana Ranade</div>
            <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>5M subscribers</div>
          </a>
          <a href="https://youtube.com/c/CNBCTV18" target="_blank" rel="noopener noreferrer"
            style={{ 
              padding: '6px', background: 'var(--bg-raised)', borderRadius: '4px',
              textDecoration: 'none', display: 'block',
            }}>
            <div style={{ fontSize: '9px', color: 'var(--text-primary)', fontWeight: 500 }}>CNBC TV18</div>
            <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>10M subscribers</div>
          </a>
          <a href="https://youtube.com/@FinologyTicker" target="_blank" rel="noopener noreferrer"
            style={{ 
              padding: '6px', background: 'var(--bg-raised)', borderRadius: '4px',
              textDecoration: 'none', display: 'block',
            }}>
            <div style={{ fontSize: '9px', color: 'var(--text-primary)', fontWeight: 500 }}>Finology Ticker</div>
            <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>1M subscribers</div>
          </a>
        </div>
      </div>

      <div style={{ padding: '10px', borderTop: '1px solid var(--border-dim)' }}>
        <a href="https://twitter.com/Nifty50" target="_blank" rel="noopener noreferrer"
          style={{ 
            display: 'block', textAlign: 'center', padding: '8px',
            background: 'var(--bg-raised)', borderRadius: '4px',
            color: 'var(--text-primary)', fontSize: '9px', fontFamily: 'var(--font-pixel)',
            textDecoration: 'none',
          }}>
          @NIFTY50 ON X →
        </a>
      </div>
    </div>
  )
}
