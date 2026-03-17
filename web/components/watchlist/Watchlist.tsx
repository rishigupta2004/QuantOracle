"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { UNIVERSE, DEFAULT_WATCHLIST } from "@/lib/universe"

type WatchlistItem = {
  symbol: string
  price?: number
  change?: number
  change_pct?: number
  signal?: "BUY" | "SELL" | "HOLD"
}

type WatchlistGroup = {
  id: string
  name: string
  symbols: string[]
  defaultCollapsed?: boolean
  isUserWatchlist?: boolean
}

type Props = {
  onSelectSymbol?: (symbol: string) => void
  activeSymbol?: string
}

const WATCHLIST_GROUPS: WatchlistGroup[] = [
  { id: 'my-watchlist', name: 'MY WATCHLIST', symbols: DEFAULT_WATCHLIST, isUserWatchlist: true },
  { id: 'indices', name: 'INDICES', symbols: UNIVERSE.indices.map(i => i.symbol), defaultCollapsed: true },
  { id: 'banking', name: 'NSE — BANKING', symbols: UNIVERSE.nifty50_banking, defaultCollapsed: true },
  { id: 'it', name: 'NSE — IT', symbols: UNIVERSE.nifty50_it, defaultCollapsed: true },
  { id: 'energy', name: 'NSE — ENERGY', symbols: UNIVERSE.nifty50_energy, defaultCollapsed: true },
  { id: 'auto', name: 'NSE — AUTO', symbols: UNIVERSE.nifty50_auto, defaultCollapsed: true },
  { id: 'fmcg', name: 'NSE — FMCG', symbols: UNIVERSE.nifty50_fmcg, defaultCollapsed: true },
  { id: 'pharma', name: 'NSE — PHARMA', symbols: UNIVERSE.nifty50_pharma, defaultCollapsed: true },
  { id: 'metals', name: 'NSE — METALS', symbols: UNIVERSE.nifty50_metals, defaultCollapsed: true },
  { id: 'global', name: 'GLOBAL', symbols: UNIVERSE.global, defaultCollapsed: true },
  { id: 'crypto', name: 'CRYPTO', symbols: UNIVERSE.crypto, defaultCollapsed: true },
]

export function WatchlistPanel({ onSelectSymbol, activeSymbol = "RELIANCE.NS" }: Props) {
  const { user, isLoaded } = useUser()
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [quoteData, setQuoteData] = useState<Record<string, WatchlistItem>>({})
  const [loading, setLoading] = useState(true)

  // Load collapse state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('watchlist-collapsed')
    if (saved) {
      setCollapsedGroups(JSON.parse(saved))
    } else {
      // Default collapsed state
      const defaults: Record<string, boolean> = {}
      WATCHLIST_GROUPS.forEach(g => {
        defaults[g.id] = g.defaultCollapsed ?? false
      })
      setCollapsedGroups(defaults)
    }
  }, [])

  // Save collapse state to localStorage
  const toggleGroup = (groupId: string) => {
    const newState = { ...collapsedGroups, [groupId]: !collapsedGroups[groupId] }
    setCollapsedGroups(newState)
    localStorage.setItem('watchlist-collapsed', JSON.stringify(newState))
  }

  // Fetch all quotes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const allSymbols = WATCHLIST_GROUPS.flatMap(g => g.symbols)
        const symbolsParam = allSymbols.join(',')
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbolsParam)}`)
        const data = await res.json()
        
        if (data.quotes) {
          // Also fetch signals for user watchlist
          const signalsRes = await Promise.allSettled(
            DEFAULT_WATCHLIST.slice(0, 10).map(async (sym) => {
              try {
                const sigRes = await fetch(`/api/signals/${encodeURIComponent(sym)}`)
                const sigData = await sigRes.json()
                return { symbol: sym, signal: sigData.signal?.verdict }
              } catch {
                return { symbol: sym, signal: undefined }
              }
            })
          )
          
          const signalsMap: Record<string, string> = {}
          signalsRes.forEach(r => {
            if (r.status === 'fulfilled') {
              signalsMap[r.value.symbol] = r.value.signal
            }
          })

          const enrichedQuotes: Record<string, WatchlistItem> = {}
          Object.entries(data.quotes).forEach(([sym, quote]: [string, any]) => {
            enrichedQuotes[sym] = {
              symbol: sym,
              price: quote?.price,
              change: quote?.change,
              change_pct: quote?.change,
              signal: signalsMap[sym] as any,
            }
          })
          setQuoteData(enrichedQuotes)
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
    if (price < 1) return `₹${price.toFixed(4)}`
    return `₹${price.toFixed(2)}`
  }

  const formatChange = (change?: number) => {
    if (change === undefined) return "—"
    const sign = change >= 0 ? "+" : ""
    return `${sign}${change.toFixed(2)}%`
  }

  const renderGroup = (group: WatchlistGroup) => {
    const isCollapsed = collapsedGroups[group.id]
    const groupQuotes = group.symbols.map(sym => quoteData[sym]).filter(Boolean)

    return (
      <div key={group.id} className="watchlist-group">
        <div 
          className="watchlist-group-header"
          onClick={() => toggleGroup(group.id)}
        >
          <span className="watchlist-collapse-icon">{isCollapsed ? '▶' : '▼'}</span>
          <span className="watchlist-group-name">{group.name}</span>
          {!isCollapsed && (
            <span className="watchlist-group-count">{group.symbols.length}</span>
          )}
        </div>
        
        {!isCollapsed && (
          <div className="watchlist-group-items">
            {groupQuotes.map((item) => (
              <div
                key={item.symbol}
                className={`watchlist-item ${item.symbol === activeSymbol ? "active" : ""}`}
                onClick={() => onSelectSymbol?.(item.symbol)}
              >
                <div>
                  <div className="watchlist-symbol">
                    {item.symbol.replace(".NS", "").replace("^", "").replace("-USD", "")}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div className="watchlist-price">{formatPrice(item.price)}</div>
                    <div className={`watchlist-delta ${(item.change_pct || 0) >= 0 ? "positive" : "negative"}`}>
                      {formatChange(item.change_pct)}
                    </div>
                  </div>
                  {group.isUserWatchlist && getVerdictBadge(item.signal)}
                </div>
              </div>
            ))}
            {groupQuotes.length === 0 && !loading && (
              <div className="watchlist-loading">Loading...</div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="watchlist-panel terminal-panel">
      <div className="panel-header">
        <span className="panel-title">WATCHLIST</span>
        {isLoaded && user && <span className="user-badge">●</span>}
      </div>
      <div className="panel-content watchlist-groups" style={{ padding: 0, maxHeight: '100%', overflowY: 'auto' }}>
        {loading && Object.keys(quoteData).length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <span className="pixel-loader" />
          </div>
        ) : (
          WATCHLIST_GROUPS.map(renderGroup)
        )}
      </div>
    </div>
  )
}
