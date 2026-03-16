"use client"

import { useEffect, useState } from "react"

type SignalData = {
  verdict: "BUY" | "SELL" | "HOLD"
  score: number
  confidence: number
  trend: string
  momentum: string
  reversion: string
  volume: string
  rsi: number
  macd_hist: number
  atr: number
  adx: number
  vwap: number
  pe: number
  pb: number
  roe: number
  mkt_cap: number
  factor_decile: number
  top_factor: string
}

export function SignalsPanel({ symbol }: { symbol: string }) {
  const [signal, setSignal] = useState<SignalData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSignal = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/signals/${encodeURIComponent(symbol)}`)
        const data = await res.json()
        if (data.signal) {
          setSignal(data.signal)
        }
      } catch (err) {
        console.error("Failed to fetch signal:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchSignal()
  }, [symbol])

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "BUY": return "signal-buy"
      case "SELL": return "signal-sell"
      default: return "signal-hold"
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "TRENDING_UP": return "↑"
      case "TRENDING_DOWN": return "↓"
      default: return "→"
    }
  }

  const getTrendStatus = (trend: string) => {
    switch (trend) {
      case "TRENDING_UP": return "up"
      case "TRENDING_DOWN": return "down"
      default: return "neutral"
    }
  }

  const formatMktCap = (cap: number) => {
    if (!cap) return "N/A"
    if (cap >= 1e12) return `₹${(cap / 1e12).toFixed(1)}L Cr`
    if (cap >= 1e10) return `₹${(cap / 1e10).toFixed(1)}K Cr`
    return `₹${(cap / 1e8).toFixed(1)} Cr`
  }

  if (loading) {
    return (
      <div className="signals-panel terminal-panel">
        <div className="panel-header">
          <span className="panel-title">SIGNALS</span>
        </div>
        <div className="panel-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="pixel-loader" />
        </div>
      </div>
    )
  }

  if (!signal) {
    return (
      <div className="signals-panel terminal-panel">
        <div className="panel-header">
          <span className="panel-title">SIGNALS</span>
        </div>
        <div className="panel-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
          No signal data
        </div>
      </div>
    )
  }

  return (
    <div className="signals-panel terminal-panel">
      <div className="panel-header">
        <span className="panel-title">SIGNALS</span>
      </div>
      <div className="panel-content">
        <div className="signals-section">
          <div className="signals-section-title">Signal Verdict</div>
          <div className="signal-verdict">
            <span className="signal-verdict-symbol">{symbol}</span>
            <span className={`signal-verdict-value pixel-badge ${getVerdictColor(signal.verdict)}`}>
              {signal.verdict} {signal.score > 0 ? "+" : ""}{signal.score.toFixed(2)}
            </span>
          </div>
          <div className="signal-confidence">
            Confidence: {signal.confidence}%
          </div>
        </div>

        <div className="signals-section">
          <div className="signals-section-title">Signal Breakdown</div>
          <div className="signal-row">
            <span className="signal-row-label">TREND</span>
            <span className={`signal-row-status ${getTrendStatus(signal.trend)}`}>
              {signal.trend.replace("_", " ")} {getTrendIcon(signal.trend)}
            </span>
          </div>
          <div className="signal-row">
            <span className="signal-row-label">MOMENTUM</span>
            <span className={`signal-row-status ${signal.momentum.includes("BULL") ? "up" : signal.momentum.includes("BEAR") ? "down" : "neutral"}`}>
              {signal.momentum.replace("_", " ")} {signal.momentum.includes("BULL") ? "↑" : signal.momentum.includes("BEAR") ? "↓" : "~"}
            </span>
          </div>
          <div className="signal-row">
            <span className="signal-row-label">REVERSION</span>
            <span className="signal-row-status neutral">
              {signal.reversion.replace("_", " ")} -
            </span>
          </div>
          <div className="signal-row">
            <span className="signal-row-label">VOLUME</span>
            <span className={`signal-row-status ${signal.volume === "SURGE" ? "up" : signal.volume === "LOW" ? "down" : "neutral"}`}>
              {signal.volume === "SURGE" ? "CONFIRMING ✓" : signal.volume === "LOW" ? "WEAK" : "NORMAL"}
            </span>
          </div>
        </div>

        <div className="signals-section">
          <div className="signals-section-title">Key Indicators</div>
          <div className="indicator-row">
            <span className="indicator-name">RSI(14)</span>
            <span className={`indicator-value ${signal.rsi > 70 ? "negative" : signal.rsi < 30 ? "positive" : ""}`}>
              {signal.rsi}
            </span>
          </div>
          <div className="indicator-row">
            <span className="indicator-name">MACD hist</span>
            <span className={`indicator-value ${signal.macd_hist > 0 ? "positive" : "negative"}`}>
              {signal.macd_hist > 0 ? "+" : ""}{signal.macd_hist}
            </span>
          </div>
          <div className="indicator-row">
            <span className="indicator-name">ATR(14)</span>
            <span className="indicator-value">{signal.atr}</span>
          </div>
          <div className="indicator-row">
            <span className="indicator-name">ADX</span>
            <span className={`indicator-value ${signal.adx > 25 ? "positive" : ""}`}>
              {signal.adx} {signal.adx > 25 ? "(trending)" : ""}
            </span>
          </div>
          <div className="indicator-row">
            <span className="indicator-name">VWAP</span>
            <span className={`indicator-value ${signal.vwap ? "positive" : ""}`}>
              ₹{signal.vwap}
            </span>
          </div>
        </div>

        <div className="signals-section">
          <div className="signals-section-title">Fundamentals</div>
          <div className="indicator-row">
            <span className="indicator-name">P/E</span>
            <span className="indicator-value">{signal.pe ? `${signal.pe.toFixed(1)}x` : "N/A"}</span>
          </div>
          <div className="indicator-row">
            <span className="indicator-name">P/B</span>
            <span className="indicator-value">{signal.pb ? `${signal.pb.toFixed(1)}x` : "N/A"}</span>
          </div>
          <div className="indicator-row">
            <span className="indicator-name">ROE</span>
            <span className="indicator-value">{signal.roe ? `${signal.roe.toFixed(1)}%` : "N/A"}</span>
          </div>
          <div className="indicator-row">
            <span className="indicator-name">Mkt Cap</span>
            <span className="indicator-value">{formatMktCap(signal.mkt_cap)}</span>
          </div>
        </div>

        <div className="signals-section">
          <div className="signals-section-title">Factor Decile</div>
          <div className="factor-bar">
            <div className="factor-bar-fill" style={{ width: `${signal.factor_decile * 10}%` }} />
            <div className="factor-bar-empty" style={{ flex: 1 }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
            <span className="factor-bar-label">Decile {signal.factor_decile}/10</span>
            <span className="factor-bar-label">Top factor: {signal.top_factor}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
