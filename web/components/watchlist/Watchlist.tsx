"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { UserButton } from "@clerk/nextjs"

type WatchlistItem = {
  symbol: string
  price?: number
  change?: number
  signal?: "BUY" | "SELL" | "HOLD"
}

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { symbol: "RELIANCE.NS" },
  { symbol: "TCS.NS" },
  { symbol: "HDFCBANK.NS" },
  { symbol: "INFY.NS" },
  { symbol: "ICICIBANK.NS" },
  { symbol: "SBIN.NS" },
  { symbol: "AAPL" },
  { symbol: "MSFT" },
]

type Props = {
  onSelectSymbol?: (symbol: string) => void
  activeSymbol?: string
}

export function WatchlistPanel({ onSelectSymbol, activeSymbol = "RELIANCE.NS" }: Props) {
  const { user, isLoaded } = useUser()
  const [items, setItems] = useState<WatchlistItem[]>(DEFAULT_WATCHLIST)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const symbols = items.map(i => i.symbol).join(",")
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols)}`)
        const data = await res.json()
        
        if (data.quotes) {
          const signalsRes = await Promise.all(
            items.map(async (item) => {
              try {
                const signalRes = await fetch(`/api/signals/${encodeURIComponent(item.symbol)}`)
                const signalData = await signalRes.json()
                return { symbol: item.symbol, signal: signalData.signal?.verdict }
              } catch {
                return { symbol: item.symbol, signal: undefined }
              }
            })
          )
          
          setItems(prev => prev.map(item => {
            const quote = data.quotes[item.symbol]
            const signalResult = signalsRes.find(s => s.symbol === item.symbol)
            return {
              symbol: item.symbol,
              price: quote?.price,
              change: quote?.change_pct,
              signal: signalResult?.signal,
            }
          }))
        }
      } catch (err) {
        console.error("Failed to fetch watchlist data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const getVerdictBadge = (verdict?: string) => {
    if (!verdict) return null
    const colorClass = verdict === "BUY" ? "signal-buy" : verdict === "SELL" ? "signal-sell" : "signal-hold"
    return <span className={`pixel-badge ${colorClass}`}>{verdict}</span>
  }

  const formatPrice = (price?: number) => {
    if (!price) return "—"
    if (price >= 1000) return `₹${price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
    return `₹${price.toFixed(2)}`
  }

  const formatChange = (change?: number) => {
    if (change === undefined) return "—"
    const sign = change >= 0 ? "+" : ""
    return `${sign}${change.toFixed(2)}%`
  }

  return (
    <div className="watchlist-panel terminal-panel">
      <div className="panel-header">
        <span className="panel-title">WATCHLIST</span>
        {isLoaded && user && <UserButton afterSignOutUrl="/sign-in" />}
      </div>
      <div className="panel-content" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <span className="pixel-loader" />
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.symbol}
              className={`watchlist-item ${item.symbol === activeSymbol ? "active" : ""}`}
              onClick={() => onSelectSymbol?.(item.symbol)}
            >
              <div>
                <div className="watchlist-symbol">{item.symbol.replace(".NS", "")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ textAlign: "right" }}>
                  <div className="watchlist-price">{formatPrice(item.price)}</div>
                  <div className={`watchlist-delta ${(item.change || 0) >= 0 ? "positive" : "negative"}`}>
                    {formatChange(item.change)}
                  </div>
                </div>
                {getVerdictBadge(item.signal)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
