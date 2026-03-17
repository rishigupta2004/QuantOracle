"use client"

import { useEffect, useState, useMemo } from "react"

type Quote = {
  price: number
  change: number
  currency: string
  is_live: boolean
}

type QuotesResponse = {
  quotes: Record<string, Quote>
  as_of: string
}

type MacroData = {
  vix: { series: string; date: string; value: number } | null
  us10y: { series: string; date: string; value: number } | null
  fedfunds: { series: string; date: string; value: number } | null
  usd_inr: { series: string; date: string; value: number } | null
  as_of_utc: string
}

const MARKET_STATUS = [
  { name: "NSE", timezone: "Asia/Kolkata", open: "09:15", close: "15:30" },
  { name: "BSE", timezone: "Asia/Kolkata", open: "09:15", close: "15:30" },
  { name: "NYSE", timezone: "America/New_York", open: "09:30", close: "16:00" },
  { name: "LSE", timezone: "Europe/London", open: "08:00", close: "16:30" },
]

const INDEX_SYMBOLS = [
  { symbol: "^NSEI", name: "Nifty 50", key: "nifty50" },
  { symbol: "^BSESN", name: "Sensex", key: "sensex" },
  { symbol: "^NSEBANK", name: "Bank Nifty", key: "banknifty" },
  { symbol: "^NSEI", name: "Fin Nifty", key: "Finnifty" },
]

const TOP_STOCKS = [
  "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
  "HINDUNILVR.NS", "ITC.NS", "SBIN.NS", "BHARTIARTL.NS", "KOTAKBANK.NS",
  "LT.NS", "AXISBANK.NS", "ASIANPAINT.NS", "MARUTI.NS", "TITAN.NS",
]

const COMMODITY_SYMBOLS = [
  "GC=F",   // Gold
  "SI=F",   // Silver
  "CL=F",   // Crude Oil
]

function getMarketStatus(market: { name: string; timezone: string; open: string; close: string }): { status: string; isLive: boolean } {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: market.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    const timeStr = formatter.format(now)
    const [hours, minutes] = timeStr.split(":").map(Number)
    const currentMins = hours * 60 + minutes

    const [openH, openM] = market.open.split(":").map(Number)
    const [closeH, closeM] = market.close.split(":").map(Number)
    const openMins = openH * 60 + openM
    const closeMins = closeH * 60 + closeM

    if (currentMins >= openMins && currentMins < closeMins) {
      return { status: "LIVE", isLive: true }
    } else if (currentMins >= closeMins && currentMins < closeMins + 60) {
      return { status: "POST", isLive: false }
    } else if (currentMins >= 0 && currentMins < openMins) {
      const preMarketStart = openMins - 15
      if (currentMins >= preMarketStart) {
        return { status: "PRE", isLive: false }
      }
      return { status: "CLOSED", isLive: false }
    } else {
      return { status: "CLOSED", isLive: false }
    }
  } catch {
    return { status: "CLOSED", isLive: false }
  }
}

function MetricTile({ label, value, change, prefix = "", suffix = "" }: { label: string; value: number | string; change?: number; prefix?: string; suffix?: string }) {
  const isPositive = change !== undefined && change >= 0
  const changeColor = change === undefined ? undefined : isPositive ? "var(--signal-buy)" : "var(--signal-sell)"

  return (
    <div className="pulse-tile">
      <div className="pulse-tile-label">{label}</div>
      <div className="pulse-tile-value">
        {prefix}{typeof value === "number" ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : value}{suffix}
      </div>
      {change !== undefined && (
        <div className="pulse-tile-change" style={{ color: changeColor }}>
          {isPositive ? "+" : ""}{change.toFixed(2)}%
        </div>
      )}
    </div>
  )
}

function MarketStatusBar() {
  const [statuses, setStatuses] = useState<{ name: string; status: string; isLive: boolean }[]>([])

  useEffect(() => {
    const updateStatus = () => {
      const s = MARKET_STATUS.map(m => {
        const { status, isLive } = getMarketStatus(m)
        return { name: m.name, status, isLive }
      })
      setStatuses(s)
    }
    updateStatus()
    const interval = setInterval(updateStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="pulse-status-bar">
      {statuses.map(s => (
        <div key={s.name} className="pulse-status-item">
          <span className="pulse-status-name">{s.name}</span>
          <span className={`pulse-status-badge ${s.isLive ? "live" : "closed"}`}>
            {s.isLive && <span className="status-live" />}
            {s.status}
          </span>
        </div>
      ))}
      <div className="pulse-status-time">
        <span style={{ color: "var(--text-dim)" }}>MARKET PULSE</span>
        <span style={{ color: "var(--text-accent)", fontFamily: "var(--font-pixel)", fontSize: "8px" }}>LIVE</span>
      </div>
    </div>
  )
}

function IndicesSection({ quotes }: { quotes: Record<string, Quote> }) {
  const indices = useMemo(() => {
    return INDEX_SYMBOLS.map(idx => ({
      ...idx,
      data: quotes[idx.symbol] || null
    }))
  }, [quotes])

  return (
    <div className="pulse-section">
      <div className="pulse-section-title">KEY INDICES</div>
      <div className="pulse-indices-grid">
        {indices.map(idx => (
          <div key={idx.key} className="pulse-index-card">
            <div className="pulse-index-name">{idx.name}</div>
            <div className="pulse-index-price">
              {idx.data?.price?.toLocaleString("en-IN", { maximumFractionDigits: 2 }) || "---"}
            </div>
            <div className={`pulse-index-change ${(idx.data?.change ?? 0) >= 0 ? "positive" : "negative"}`}>
              {idx.data ? (idx.data.change >= 0 ? "+" : "") + idx.data.change.toFixed(2) + "%" : "---"}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopMoversSection({ quotes }: { quotes: Record<string, Quote> }) {
  const [topGainers, topLosers] = useMemo(() => {
    const stocks = TOP_STOCKS
      .map(sym => ({ symbol: sym, data: quotes[sym] }))
      .filter(s => s.data)
      .sort((a, b) => (b.data?.change ?? 0) - (a.data?.change ?? 0))

    return [stocks.slice(0, 5), stocks.slice(-5).reverse()]
  }, [quotes])

  const getSymbolName = (symbol: string) => symbol.replace(".NS", "").replace(".NS", "")

  return (
    <div className="pulse-movers-grid">
      <div className="pulse-section">
        <div className="pulse-section-title" style={{ color: "var(--signal-buy)" }}>▲ TOP GAINERS</div>
        <div className="pulse-movers-list">
          {topGainers.map(s => (
            <div key={s.symbol} className="pulse-mover-row">
              <span className="pulse-mover-symbol">{getSymbolName(s.symbol)}</span>
              <span className="pulse-mover-price">{s.data?.price?.toFixed(2)}</span>
              <span className="pulse-mover-change positive">
                +{s.data?.change?.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="pulse-section">
        <div className="pulse-section-title" style={{ color: "var(--signal-sell)" }}>▼ TOP LOSERS</div>
        <div className="pulse-movers-list">
          {topLosers.map(s => (
            <div key={s.symbol} className="pulse-mover-row">
              <span className="pulse-mover-symbol">{getSymbolName(s.symbol)}</span>
              <span className="pulse-mover-price">{s.data?.price?.toFixed(2)}</span>
              <span className="pulse-mover-change negative">
                {s.data?.change?.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MarketBreadthSection({ quotes }: { quotes: Record<string, Quote> }) {
  const breadth = useMemo(() => {
    const stocks = TOP_STOCKS.map(s => quotes[s]).filter(Boolean)
    const advances = stocks.filter(s => s.change > 0).length
    const declines = stocks.filter(s => s.change < 0).length
    const unchanged = stocks.length - advances - declines
    return { advances, declines, unchanged, total: stocks.length }
  }, [quotes])

  const advanceRatio = breadth.total > 0 ? (breadth.advances / breadth.total) * 100 : 50

  return (
    <div className="pulse-section">
      <div className="pulse-section-title">MARKET BREADTH</div>
      <div className="pulse-breadth-grid">
        <div className="pulse-breadth-item">
          <span className="pulse-breadth-label">Advances</span>
          <span className="pulse-breadth-value positive">{breadth.advances}</span>
        </div>
        <div className="pulse-breadth-item">
          <span className="pulse-breadth-label">Declines</span>
          <span className="pulse-breadth-value negative">{breadth.declines}</span>
        </div>
        <div className="pulse-breadth-item">
          <span className="pulse-breadth-label">Unchanged</span>
          <span className="pulse-breadth-value">{breadth.unchanged}</span>
        </div>
      </div>
      <div className="pulse-breadth-bar">
        <div 
          className="pulse-breadth-fill positive" 
          style={{ width: `${advanceRatio}%` }}
        />
        <div 
          className="pulse-breadth-fill negative" 
          style={{ width: `${100 - advanceRatio}%` }}
        />
      </div>
    </div>
  )
}

function MacroSection({ macro }: { macro: MacroData | null }) {
  return (
    <div className="pulse-section">
      <div className="pulse-section-title">MACRO & COMMODITIES</div>
      <div className="pulse-metrics-grid">
        <MetricTile 
          label="USD/INR" 
          value={macro?.usd_inr?.value ?? 0} 
          prefix="₹"
          suffix=""
        />
        <MetricTile 
          label="India VIX" 
          value={macro?.vix?.value ?? 0} 
          suffix=""
        />
        <MetricTile 
          label="US 10Y" 
          value={macro?.us10y?.value ?? 0} 
          suffix="%"
        />
        <MetricTile 
          label="Fed Funds" 
          value={macro?.fedfunds?.value ?? 0} 
          suffix="%"
        />
      </div>
    </div>
  )
}

export function PulseView() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [macro, setMacro] = useState<MacroData | null>(null)
  const [loading, setLoading] = useState(true)

  const allSymbols = useMemo(() => {
    return [
      ...INDEX_SYMBOLS.map(i => i.symbol),
      ...TOP_STOCKS,
      ...COMMODITY_SYMBOLS
    ].filter((v, i, a) => a.indexOf(v) === i)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [quotesRes, macroRes] = await Promise.all([
          fetch(`/api/quotes?symbols=${encodeURIComponent(allSymbols.join(","))}&t=${Date.now()}`),
          fetch("/api/macro")
        ])

        const quotesData: QuotesResponse = await quotesRes.json()
        const macroData: MacroData = await macroRes.json()

        setQuotes(quotesData.quotes || {})
        setMacro(macroData)
      } catch (err) {
        console.error("Failed to fetch pulse data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [allSymbols])

  if (loading) {
    return (
      <div className="pulse-loading">
        <div className="pixel-loader" />
        <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "11px", marginTop: "8px" }}>
          LOADING MARKET DATA...
        </span>
      </div>
    )
  }

  return (
    <div className="pulse-view">
      <style jsx>{`
        .pulse-view {
          flex: 1;
          overflow: auto;
          background: var(--bg-base);
          padding: 16px;
        }
        
        .pulse-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
        }

        .pulse-status-bar {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 12px 16px;
          background: var(--bg-panel);
          border: 1px solid var(--border-dim);
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .pulse-status-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pulse-status-name {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-secondary);
        }

        .pulse-status-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: var(--font-pixel);
          font-size: 7px;
          padding: 2px 6px;
          border: 1px solid;
        }

        .pulse-status-badge.live {
          border-color: var(--signal-buy);
          color: var(--signal-buy);
          background: rgba(0, 255, 136, 0.1);
        }

        .pulse-status-badge.closed {
          border-color: var(--text-dim);
          color: var(--text-dim);
        }

        .pulse-status-time {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: var(--font-mono);
          font-size: 11px;
        }

        .pulse-section {
          background: var(--bg-panel);
          border: 1px solid var(--border-dim);
          padding: 16px;
          margin-bottom: 16px;
        }

        .pulse-section-title {
          font-family: var(--font-pixel);
          font-size: 8px;
          color: var(--text-accent);
          margin-bottom: 12px;
          letter-spacing: 1px;
        }

        .pulse-indices-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
        }

        .pulse-index-card {
          background: var(--bg-raised);
          border: 1px solid var(--border-dim);
          padding: 12px;
        }

        .pulse-index-name {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }

        .pulse-index-price {
          font-family: var(--font-mono);
          font-size: 20px;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        .pulse-index-change {
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .pulse-index-change.positive {
          color: var(--signal-buy);
        }

        .pulse-index-change.negative {
          color: var(--signal-sell);
        }

        .pulse-movers-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 768px) {
          .pulse-movers-grid {
            grid-template-columns: 1fr;
          }
        }

        .pulse-movers-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .pulse-mover-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: var(--bg-raised);
          border: 1px solid var(--border-dim);
        }

        .pulse-mover-symbol {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-primary);
        }

        .pulse-mover-price {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-secondary);
        }

        .pulse-mover-change {
          font-family: var(--font-mono);
          font-size: 12px;
          min-width: 60px;
          text-align: right;
        }

        .pulse-mover-change.positive {
          color: var(--signal-buy);
        }

        .pulse-mover-change.negative {
          color: var(--signal-sell);
        }

        .pulse-metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
        }

        .pulse-tile {
          background: var(--bg-raised);
          border: 1px solid var(--border-dim);
          padding: 12px;
        }

        .pulse-tile-label {
          font-family: var(--font-pixel);
          font-size: 7px;
          color: var(--text-dim);
          margin-bottom: 8px;
        }

        .pulse-tile-value {
          font-family: var(--font-mono);
          font-size: 18px;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .pulse-tile-change {
          font-family: var(--font-mono);
          font-size: 11px;
        }

        .pulse-breadth-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 12px;
        }

        .pulse-breadth-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px;
          background: var(--bg-raised);
          border: 1px solid var(--border-dim);
        }

        .pulse-breadth-label {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-dim);
          margin-bottom: 4px;
        }

        .pulse-breadth-value {
          font-family: var(--font-mono);
          font-size: 18px;
          color: var(--text-primary);
        }

        .pulse-breadth-value.positive {
          color: var(--signal-buy);
        }

        .pulse-breadth-value.negative {
          color: var(--signal-sell);
        }

        .pulse-breadth-bar {
          display: flex;
          height: 8px;
          background: var(--bg-dim);
          overflow: hidden;
        }

        .pulse-breadth-fill.positive {
          background: var(--signal-buy);
        }

        .pulse-breadth-fill.negative {
          background: var(--signal-sell);
        }
      `}</style>

      <MarketStatusBar />

      <IndicesSection quotes={quotes} />

      <TopMoversSection quotes={quotes} />

      <MarketBreadthSection quotes={quotes} />

      <MacroSection macro={macro} />
    </div>
  )
}
