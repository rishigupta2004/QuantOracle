"use client"
import { useEffect, useState } from "react"

const DEFAULT_TICKERS = [
  { symbol: "^NSEI", label: "NIFTY 50" },
  { symbol: "^BSESN", label: "SENSEX" },
  { symbol: "^NSEBANK", label: "BANKNIFTY" },
  { symbol: "RELIANCE.NS", label: "RELIANCE" },
  { symbol: "TCS.NS", label: "TCS" },
  { symbol: "HDFCBANK.NS", label: "HDFCBANK" },
  { symbol: "INFY.NS", label: "INFY" },
  { symbol: "ICICIBANK.NS", label: "ICICI" },
  { symbol: "AAPL", label: "AAPL" },
  { symbol: "MSFT", label: "MSFT" },
  { symbol: "BTC-USD", label: "BTC" },
]

export function TickerStrip() {
  const [prices, setPrices] = useState<Record<string, {price: number, change: number}>>({})

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const syms = DEFAULT_TICKERS.map(t => t.symbol).join(',')
        const res = await fetch(`/api/quotes?symbols=${syms}`)
        const data = await res.json()
        setPrices(data.quotes ?? {})
      } catch {}
    }
    fetchPrices()
    const interval = setInterval(fetchPrices, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      height: '28px',
      background: 'var(--bg-void)',
      borderBottom: '1px solid var(--border-dim)',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
    }}>
      <div style={{
        display: 'flex',
        gap: '0',
        animation: 'ticker-scroll 60s linear infinite',
        whiteSpace: 'nowrap',
      }}>
        {[...DEFAULT_TICKERS, ...DEFAULT_TICKERS].map((t, i) => {
          const q = prices[t.symbol]
          const change = q?.change ?? 0
          const color = change > 0 ? 'var(--signal-buy)' : 
                       change < 0 ? 'var(--signal-sell)' : 
                       'var(--text-secondary)'
          return (
            <span key={i} style={{
              padding: '0 16px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              borderRight: '1px solid var(--border-dim)',
              color: 'var(--text-primary)',
            }}>
              <span style={{color: 'var(--text-secondary)', marginRight: '6px'}}>
                {t.label}
              </span>
              <span>
                {q?.price ? q.price.toFixed(2) : '—'}
              </span>
              <span style={{color, marginLeft: '4px'}}>
                {change > 0 ? '+' : ''}{change ? change.toFixed(2) : '0.00'}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
