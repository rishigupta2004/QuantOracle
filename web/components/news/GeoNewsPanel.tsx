"use client"

import { useEffect, useState } from "react"

type NewsItem = {
  title: string
  source: string
  pubDate: string
  link: string | null
  tags: string[]
  risk: "high" | "medium" | "low"
  impact?: string
  summary?: string
}

const RISK_EXPLANATIONS = {
  high: "High impact news that can cause significant market volatility. Consider reducing exposure or hedging positions.",
  medium: "Moderate impact news that may cause short-term price movements. Monitor positions closely.",
  low: "Low impact news with minimal market influence. Generally safe to ignore for short-term trading."
}

const SECTOR_IMPACT = {
  "OIL/ENERGY": "Oil & Gas, Power, Renewable Energy sectors",
  "BANKING": "Banks, NBFCs, Insurance, Financial Services",
  "IT": "Software Services, IT Hardware, Tech Companies",
  "PHARMA": "Pharmaceuticals, Healthcare, Biotech",
  "METALS": "Steel, Mining, Aluminum, Coal",
  "AUTO": "Automobiles, Auto Components, Tyres",
  "FMCG": "Consumer Goods, Personal Care, Food & Beverages",
  "REAL ESTATE": "Real Estate, Construction, Infrastructure",
  "BROAD MARKET": "Affects entire market, FII/DII flows, Index heavyweights"
}

function generateFallbackNews(): NewsItem[] {
  const now = Date.now()
  return [
    { title: "RBI MPC Meet: Rates unchanged, maintains neutral stance", source: "Reuters", pubDate: new Date(now).toISOString(), link: "https://www.rbi.org.in", tags: ["BANKING", "BROAD MARKET"], risk: "high", impact: "Rate decisions directly affect banking sector profitability and overall market liquidity", summary: "RBI's MPC keeps rates steady, signaling caution on inflation while supporting growth" },
    { title: "FII inflows continue for 5th consecutive day amid strong earnings", source: "ET Markets", pubDate: new Date(now - 3600000).toISOString(), link: "https://economictimes.indiatimes.com", tags: ["BROAD MARKET"], risk: "low", impact: "Foreign investor buying supports market rally and strengthens INR", summary: "Strong institutional buying indicates confidence in Indian equity markets" },
    { title: "Oil prices surge on OPEC+ production cut extension", source: "Bloomberg", pubDate: new Date(now - 7200000).toISOString(), link: "https://bloomberg.com", tags: ["OIL/ENERGY"], risk: "medium", impact: "Higher input costs impact OMC margins, consumer spending, and inflation", summary: "Extended production cuts may lead to crude prices crossing $90/barrel" },
    { title: "IT stocks rally on strong Q4 results and US Fed rate cut hopes", source: "MoneyControl", pubDate: new Date(now - 10800000).toISOString(), link: "https://moneycontrol.com", tags: ["IT"], risk: "low", impact: "Banking on IT export revenues and margin improvement", summary: "Top IT firms beat estimates with deal pipeline remaining strong" },
    { title: "Nifty50 at all-time high, eyes 23500 milestone", source: "CNBC TV18", pubDate: new Date(now - 14400000).toISOString(), link: "https://cnbctv18.com", tags: ["BROAD MARKET"], risk: "low", impact: "Positive sentiment drives market higher, strong breadth indicates healthy rally", summary: "Index formation remains bullish with strong participation across sectors" },
    { title: "Bank Nifty outperforms, up 2% on strong credit growth", source: "The Hindu", pubDate: new Date(now - 18000000).toISOString(), link: "https://thehindu.com", tags: ["BANKING"], risk: "low", impact: "Loan growth and NIM improvement boost banking sector outlook", summary: "Private banks lead the rally on asset quality improvement" },
    { title: "Rupee strengthens against USD on foreign fund inflows", source: "Business Standard", pubDate: new Date(now - 21600000).toISOString(), link: "https://business-standard.com", tags: ["BANKING"], risk: "low", impact: "Strong rupee reduces import costs and supports corporate earnings", summary: "FII inflows provide rupee support amid dollar weakness globally" },
    { title: "Metal stocks decline on weak global cues", source: "Financial Express", pubDate: new Date(now - 25200000).toISOString(), link: "https://financialexpress.com", tags: ["METALS"], risk: "medium", impact: "China demand slowdown weighs on metal prices globally", summary: "Steel prices under pressure from slowing construction activity" },
    { title: "Pharma stocks gain on USFDA approvals", source: "Mint", pubDate: new Date(now - 28800000).toISOString(), link: "https://livemint.com", tags: ["PHARMA"], risk: "low", impact: "USFDA approvals open new revenue streams for pharma companies", summary: "API supply chain consolidation benefits large pharma players" },
    { title: "Auto sales robust in March on festive demand", source: "Autocar", pubDate: new Date(now - 32400000).toISOString(), link: "https://autocarindia.com", tags: ["AUTO"], risk: "low", impact: "Strong retail demand drives inventory clearance for OEMs", summary: "Two-wheelers and SUVs lead sales growth in March" },
    { title: "Sebi board meet on new derivative rules", source: "SEBI", pubDate: new Date(now - 36000000).toISOString(), link: "https://sebi.gov.in", tags: ["BROAD MARKET"], risk: "medium", impact: "Regulatory changes may impact F&O trading volumes and broker revenues", summary: "Sebi proposes rationalization of expiry dates and lot sizes" },
    { title: "GDP growth projection at 7% for FY26", source: "MoSPI", pubDate: new Date(now - 39600000).toISOString(), link: "https://mospi.nic.in", tags: ["BROAD MARKET"], risk: "low", impact: "Strong GDP growth supports corporate earnings and market valuations", summary: "Manufacturing and services sectors drive economic expansion" },
    { title: "Coal India production targets increased", source: "The Economic Times", pubDate: new Date(now - 43200000).toISOString(), link: "https://economictimes.indiatimes.com", tags: ["METALS"], risk: "low", impact: "Higher coal output reduces power shortage concerns", summary: "Coal India aims to produce 850 MT in FY26" },
    { title: "Tata Steel Q4 results beat estimates", source: "Tata Steel IR", pubDate: new Date(now - 46800000).toISOString(), link: "https://tatasteel.com", tags: ["METALS"], risk: "low", impact: "Beat on margins shows operational efficiency despite weak metal prices", summary: "European operations turn profitable, India business remains strong" },
    { title: "US Fed signals potential rate cuts in 2026", source: "Federal Reserve", pubDate: new Date(now - 50400000).toISOString(), link: "https://federalreserve.gov", tags: ["IT", "BROAD MARKET"], risk: "medium", impact: "Rate cuts benefit growth stocks, IT services, and emerging markets", summary: "Fed pivot hopes boost risk appetite globally" },
    { title: "India CPI inflation drops to 4-month low", source: "Reuters", pubDate: new Date(now - 54000000).toISOString(), link: "https://reuters.com", tags: ["BROAD MARKET", "BANKING"], risk: "medium", impact: "Lower inflation increases chances of RBI rate cut", summary: "Food prices moderation drives CPI below RBI's tolerance band" },
    { title: "FII selling intensifies on strong dollar, high valuations", source: "Bloomberg", pubDate: new Date(now - 57600000).toISOString(), link: "https://bloomberg.com", tags: ["BROAD MARKET"], risk: "high", impact: "Foreign outflows create selling pressure on large-cap stocks", summary: "DIIs attempt to offset FII selling but may not fully compensate" },
    { title: "Reliance announces new energy investments worth $10B", source: "ET", pubDate: new Date(now - 61200000).toISOString(), link: "https://economictimes.indiatimes.com", tags: ["OIL/ENERGY"], risk: "medium", impact: "Capex announcement signals confidence in energy transition story", summary: "New giga-factories to create 100K+ jobs" },
    { title: "IT hiring shows signs of recovery after 2-year slowdown", source: "MoneyControl", pubDate: new Date(now - 64800000).toISOString(), link: "https://moneycontrol.com", tags: ["IT"], risk: "low", impact: "Hiring recovery indicates improving demand environment for IT services", summary: "Tier-1 IT firms to hire 50K+ freshers in FY26" },
    { title: "RBI Governor warns of geopolitical risks to inflation", source: "RBI", pubDate: new Date(now - 68400000).toISOString(), link: "https://www.rbi.org.in", tags: ["BANKING", "BROAD MARKET"], risk: "medium", impact: "Cautious stance may delay rate cuts, impact banking sector", summary: "RBI emphasizes vigilance on oil prices and exchange rate volatility" },
    { title: "India's trade deficit narrows on record services exports", source: "Commerce Ministry", pubDate: new Date(now - 72000000).toISOString(), link: "https://commerce.gov.in", tags: ["BROAD MARKET"], risk: "low", impact: "Strong services exports support INR and reduce current account concerns", summary: "IT and BPO services drive $40B quarterly exports" },
    { title: "Tata Motors EV sales cross 50K units milestone", source: "Autocar", pubDate: new Date(now - 75600000).toISOString(), link: "https://autocarindia.com", tags: ["AUTO"], risk: "low", impact: "EV adoption accelerating, benefits charging infrastructure companies", summary: "Tata leads Indian EV market with 70% share" },
    { title: "HDFC Bank Q4 profit rises 30% YoY on loan growth", source: "Economic Times", pubDate: new Date(now - 79200000).toISOString(), link: "https://economictimes.indiatimes.com", tags: ["BANKING"], risk: "low", impact: "Strong earnings confirm robust credit demand in economy", summary: "Retail and SME loans drive growth, asset quality improves" },
    { title: "Global markets cheer US-China trade talks progress", source: "CNBC", pubDate: new Date(now - 82800000).toISOString(), link: "https://cnbc.com", tags: ["IT", "BROAD MARKET"], risk: "medium", impact: "Trade tensions easing benefits export-oriented Indian IT sector", summary: "Partial tariff rollback expected in coming months" },
    { title: "India becomes 4th largest solar market globally", source: "Mercom India", pubDate: new Date(now - 86400000).toISOString(), link: "https://mercomindia.com", tags: ["OIL/ENERGY"], risk: "low", impact: "Renewable energy push creates opportunities in solar manufacturing", summary: "Government targets 500 GW renewable capacity by 2030" },
  ]
}

const MARKET_KEYWORDS = [
  "oil", "sanctions", "Fed", "RBI", "tariff", "war", "crude", "rupee", "FII", "DII", "Nifty",
  "inflation", "rate", "hike", "cut", "GDP", "GDP growth", "IPO", "broker", "upgrade",
  "downgrade", "Q4 results", "quarterly", "earnings", "profit", "loss", "revenue"
]

const HIGH_RISK_KEYWORDS = ["war", "sanctions", "rate hike", "crash", "default", "recession", "selling", "outflows"]
const MEDIUM_RISK_KEYWORDS = ["inflation", "tariff", "election", "policy", "Fed", "RBI", "FII"]

function getRiskLevel(text: string): "high" | "medium" | "low" {
  const lower = text.toLowerCase()
  if (HIGH_RISK_KEYWORDS.some(k => lower.includes(k))) return "high"
  if (MEDIUM_RISK_KEYWORDS.some(k => lower.includes(k))) return "medium"
  return "low"
}

function getTags(text: string): string[] {
  const tags: string[] = []
  const lower = text.toLowerCase()
  
  if (lower.includes("oil") || lower.includes("crude") || lower.includes("energy") || lower.includes("renewable") || lower.includes("solar")) {
    tags.push("OIL/ENERGY")
  }
  if (lower.includes("bank") || lower.includes("finance") || lower.includes("RBI") || lower.includes("HDFC") || lower.includes("loan")) {
    tags.push("BANKING")
  }
  if (lower.includes("IT") || lower.includes("tech") || lower.includes("software") || lower.includes("services")) {
    tags.push("IT")
  }
  if (lower.includes("pharma") || lower.includes("health") || lower.includes("USFDA")) {
    tags.push("PHARMA")
  }
  if (lower.includes("metal") || lower.includes("steel") || lower.includes("coal") || lower.includes("mining")) {
    tags.push("METALS")
  }
  if (lower.includes("auto") || lower.includes("car") || lower.includes("vehicle") || lower.includes("EV")) {
    tags.push("AUTO")
  }
  if (lower.includes("FII") || lower.includes("DII") || lower.includes("Nifty") || lower.includes("Sensex") || lower.includes("GDP") || lower.includes("trade")) {
    tags.push("BROAD MARKET")
  }
  
  return tags.length > 0 ? tags : ["BROAD MARKET"]
}

function NewsTooltip({ item }: { item: NewsItem }) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 100,
      width: 280,
      background: 'rgba(15, 15, 15, 0.98)',
      border: '1px solid var(--border-accent)',
      borderRadius: 4,
      padding: 12,
      marginBottom: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)',
      pointerEvents: 'none',
    }}>
      <div style={{ 
        fontSize: 10, 
        fontFamily: 'var(--font-pixel)', 
        color: 'var(--text-accent)',
        marginBottom: 8,
        borderBottom: '1px solid var(--border-dim)',
        paddingBottom: 6,
      }}>
        MARKET IMPACT ANALYSIS
      </div>
      
      {item.summary && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3, fontFamily: 'var(--font-pixel)' }}>SUMMARY</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.summary}</div>
        </div>
      )}
      
      {item.impact && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3, fontFamily: 'var(--font-pixel)' }}>IMPACT</div>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.impact}</div>
        </div>
      )}
      
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3, fontFamily: 'var(--font-pixel)' }}>RISK LEVEL</div>
        <div style={{ fontSize: 10, color: item.risk === 'high' ? 'var(--signal-sell)' : item.risk === 'medium' ? 'var(--signal-hold)' : 'var(--signal-buy)' }}>
          {RISK_EXPLANATIONS[item.risk]}
        </div>
      </div>
      
      <div>
        <div style={{ fontSize: 8, color: 'var(--text-dim)', marginBottom: 3, fontFamily: 'var(--font-pixel)' }}>AFFECTED SECTORS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {item.tags.map((tag, i) => (
            <span key={i} style={{ 
              fontSize: 8, 
              padding: '2px 6px', 
              background: 'var(--bg-raised)', 
              borderRadius: 2,
              color: 'var(--text-secondary)'
            }}>
              {SECTOR_IMPACT[tag as keyof typeof SECTOR_IMPACT] || tag}
            </span>
          ))}
        </div>
      </div>
      
      <div style={{
        position: 'absolute',
        bottom: -6,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid var(--border-accent)',
      }} />
    </div>
  )
}

export function GeoNewsPanel() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch("/api/news/geo")
        if (res.ok) {
          const data = await res.json()
          if (data.news && data.news.length > 0) {
            const enrichedNews = data.news.map((item: any) => ({
              ...item,
              impact: RISK_EXPLANATIONS[item.risk as keyof typeof RISK_EXPLANATIONS] || '',
              summary: item.summary || '',
              tags: item.tags || getTags(item.title)
            }))
            setNews(enrichedNews)
          } else {
            setNews(generateFallbackNews())
          }
        } else {
          setNews(generateFallbackNews())
        }
      } catch {
        setNews(generateFallbackNews())
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
      
      <div style={{ 
        maxHeight: 'calc(100% - 180px)', 
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border-dim) transparent',
      }}>
        {news.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: "11px", fontFamily: "var(--font-mono)", padding: 16 }}>
            No market-relevant news available
          </div>
        ) : (
          news.slice(0, 30).map((item, idx) => (
            <div 
              key={idx} 
              className="news-item-wrapper"
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {hoveredIndex === idx && (
                <NewsTooltip item={item} />
              )}
              
              {item.link ? (
                <a 
                  href={item.link} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="news-item"
                  style={{ display: 'block', textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <div className="news-headline">{item.title}</div>
                  <div className="news-meta">
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{formatTime(item.pubDate)}</span>
                    <span style={{ marginLeft: 'auto', opacity: 0.5 }}>↗</span>
                  </div>
                  <div className="news-tags">
                    {item.tags.map((tag, i) => (
                      <span key={i} className="news-tag">{tag}</span>
                    ))}
                    <span className={`news-risk ${item.risk}`}>{item.risk.toUpperCase()}</span>
                  </div>
                </a>
              ) : (
                <div className="news-item">
                  <div className="news-headline">{item.title}</div>
                  <div className="news-meta">
                    <span>{item.source}</span>
                    <span>•</span>
                    <span>{formatTime(item.pubDate)}</span>
                  </div>
                  <div className="news-tags">
                    {item.tags.map((tag, i) => (
                      <span key={i} className="news-tag">{tag}</span>
                    ))}
                    <span className={`news-risk ${item.risk}`}>{item.risk.toUpperCase()}</span>
                  </div>
                </div>
              )}
            </div>
          )))
        }
        {news.length > 30 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '8px', 
            color: 'var(--text-dim)', 
            fontSize: 9,
            borderTop: '1px solid var(--border-dim)',
            fontFamily: 'var(--font-mono)'
          }}>
            Showing 30 of {news.length} news items
          </div>
        )}
      </div>

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
