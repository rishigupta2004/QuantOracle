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
  market_cap_fmt?: string
  factor_decile: number
  top_factor: string
  fundamentals?: {
    pe_ratio?: number | null
    pb_ratio?: number | null
    roe?: string | null
    debt_to_equity?: number | null
    market_cap?: number | null
    market_cap_fmt?: string | null
    revenue?: string | null
    profit_margin?: string | null
    week_52_high?: number | null
    week_52_low?: number | null
    sector?: string | null
  } | null
}

function formatINR(value: number, decimals = 2): string {
  if (!value || !isFinite(value)) return "—"
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR",
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(value)
}

function formatMarketCap(v: number | null | undefined, fmt?: string | null): string {
  if (fmt) return fmt
  if (!v) return "—"
  if (v >= 1e12) return `₹${(v / 1e12).toFixed(2)}L Cr`
  if (v >= 1e9) return `₹${(v / 1e9).toFixed(0)} Cr`
  return `₹${v.toLocaleString("en-IN")}`
}

// Human-readable signal insight per category
function trendInsight(signal: SignalData): string {
  const adx = signal.adx
  if (adx < 20) return `ADX ${adx.toFixed(0)} — sideways market. Trend signals unreliable.`
  if (signal.trend === "TRENDING_UP") return `EMA21 above EMA55. Uptrend active. ADX ${adx.toFixed(0)} (strong).`
  if (signal.trend === "TRENDING_DOWN") return `EMA21 below EMA55. Downtrend active. ADX ${adx.toFixed(0)}.`
  return `EMA crossover neutral. ADX ${adx.toFixed(0)}.`
}

function momentumInsight(signal: SignalData): string {
  const hist = signal.macd_hist
  const dir = hist > 0 ? "expanding" : "shrinking"
  const bull = hist > 0 ? "Bulls" : "Bears"
  return `MACD hist ${hist > 0 ? "+" : ""}${hist.toFixed(2)}, ${dir}. ${bull} in control. RSI ${signal.rsi.toFixed(1)}.`
}

function reversionInsight(signal: SignalData): string {
  if (signal.trend !== "SIDEWAYS" && signal.trend !== "") {
    return `Reversion suppressed — active ${signal.trend.replace("_", " ").toLowerCase()} overrides.`
  }
  const rsi = signal.rsi
  const zone = rsi < 35 ? "OVERSOLD" : rsi > 65 ? "OVERBOUGHT" : "NEUTRAL"
  return `RSI ${rsi.toFixed(1)} — ${zone}. Mean reversion probability ${rsi < 35 || rsi > 65 ? "elevated" : "low"}.`
}

function volumeInsight(signal: SignalData): string {
  if (signal.volume === "SURGE") return `Volume 1.5× avg. Strong conviction behind move.`
  if (signal.volume === "LOW") return `Volume below average. Low participation — treat cautiously.`
  return `Volume normal. No unusual activity.`
}

// Signal bar: -1 to +1 scale, center = 0
function SignalBar({ value, label, insight }: { value: number; label: string; insight: string }) {
  // value is -1 to +1, bar width from center
  const pct = Math.abs(value) * 50
  const isBull = value >= 0
  const labelColor = isBull ? "var(--signal-buy)" : value < 0 ? "var(--signal-sell)" : "var(--text-dim)"
  return (
    <div style={{ marginBottom: 8, padding: "6px 8px", background: "var(--bg-dim)", borderRadius: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
        <span style={{ fontSize: 9, color: labelColor }}>{getStatusLabel(label, value)}</span>
      </div>
      {/* Center-zero bar */}
      <div style={{ height: 4, background: "var(--bg-panel)", borderRadius: 2, position: "relative", marginBottom: 4 }}>
        <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "var(--border-bright)" }} />
        {value < 0 ? (
          <div style={{
            position: "absolute", right: "50%", top: 0, height: "100%",
            width: `${pct}%`, background: "var(--signal-sell)", borderRadius: "2px 0 0 2px",
          }} />
        ) : (
          <div style={{
            position: "absolute", left: "50%", top: 0, height: "100%",
            width: `${pct}%`, background: "var(--signal-buy)", borderRadius: "0 2px 2px 0",
          }} />
        )}
      </div>
      <div style={{ fontSize: 8, color: "var(--text-dim)", lineHeight: 1.4 }}>{insight}</div>
    </div>
  )
}

function getStatusLabel(cat: string, value: number): string {
  if (cat === "TREND") {
    if (value > 0.3) return "TRENDING UP ↑"
    if (value < -0.3) return "TRENDING DOWN ↓"
    return "SIDEWAYS →"
  }
  if (cat === "MOMENTUM") {
    if (value > 0.4) return "BULLISH"
    if (value < -0.4) return "BEARISH"
    return "NEUTRAL"
  }
  if (cat === "REVERSION") {
    if (value > 0.3) return "OVERSOLD"
    if (value < -0.3) return "OVERBOUGHT"
    return "NEUTRAL"
  }
  if (cat === "VOLUME") {
    if (value > 0.3) return "SURGE"
    if (value < -0.3) return "LOW"
    return "NORMAL"
  }
  return ""
}

function signalValue(signal: SignalData, cat: string): number {
  switch (cat) {
    case "TREND":
      if (signal.trend === "TRENDING_UP") return signal.adx > 25 ? 0.7 : 0.4
      if (signal.trend === "TRENDING_DOWN") return signal.adx > 25 ? -0.7 : -0.4
      return 0
    case "MOMENTUM":
      if (signal.momentum.includes("BULLISH")) return 0.7
      if (signal.momentum.includes("BEARISH")) return -0.7
      if (signal.momentum === "OVERBOUGHT") return -0.5
      if (signal.momentum === "OVERSOLD") return 0.5
      return 0
    case "REVERSION":
      if (signal.rsi < 35) return 0.6
      if (signal.rsi > 65) return -0.6
      return 0
    case "VOLUME":
      if (signal.volume === "SURGE") return 0.6
      if (signal.volume === "LOW") return -0.4
      return 0
    default: return 0
  }
}

export function SignalsPanel({ symbol }: { symbol: string }) {
  const [signal, setSignal] = useState<SignalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState("")
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchSignal = async () => {
      setLoading(true)
      setError(false)
      setExplanation("")
      try {
        const res = await fetch(`/api/signals/${encodeURIComponent(symbol)}?t=${Date.now()}`)
        const data = await res.json()
        if (data.signal) setSignal(data.signal)
        else setError(true)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    fetchSignal()
  }, [symbol])

  const handleExplain = async () => {
    if (!signal) return
    setExplaining(true)
    setExplanation("")
    try {
      const res = await fetch(`/api/ai/signal-explain?symbol=${encodeURIComponent(symbol)}`)
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          setExplanation(prev => prev + decoder.decode(value))
        }
      }
    } catch {}
    finally { setExplaining(false) }
  }

  const symBase = symbol.replace(".NS", "").replace(".BO", "").replace("^", "")
  const nseLink = `https://www.nseindia.com/get-quotes/equity?symbol=${symBase}`
  const screenerLink = `https://www.screener.in/company/${symBase}/`
  const tickertapeLink = `https://www.tickertape.in/stocks/${symBase.toLowerCase()}`
  const mcLink = `https://www.moneycontrol.com/india/stockpricequote/${symBase.toLowerCase()}/${symBase.toLowerCase()}`

  const verdictColor = signal?.verdict === "BUY" ? "var(--signal-buy)" : signal?.verdict === "SELL" ? "var(--signal-sell)" : "var(--signal-hold)"

  // Get 52W data from fundamentals
  const w52High = signal?.fundamentals?.week_52_high
  const w52Low = signal?.fundamentals?.week_52_low
  const currentPrice = signal?.vwap  // proxy for current price

  const range52w = w52High && w52Low && w52High > w52Low
    ? ((currentPrice ?? w52Low) - w52Low) / (w52High - w52Low)
    : null

  const isNSE = symbol.endsWith(".NS") || symbol.endsWith(".BO")

  if (loading) {
    return (
      <div className="signals-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="panel-header"><span className="panel-title">SIGNALS</span></div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="pixel-loader" />
        </div>
      </div>
    )
  }

  if (error || !signal) {
    return (
      <div className="signals-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="panel-header"><span className="panel-title">SIGNALS</span></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-dim)", fontSize: 11 }}>
          Data unavailable
          <button onClick={() => { setError(false); setLoading(true) }}
            style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", background: "transparent", border: "1px solid var(--border-dim)", padding: "4px 8px", cursor: "pointer" }}>
            ↻ Retry
          </button>
        </div>
      </div>
    )
  }

  // Fundamentals
  const fd = signal.fundamentals
  const hasFundamentals = fd && (fd.pe_ratio || fd.pb_ratio || fd.roe || fd.market_cap || fd.debt_to_equity)

  return (
    <div className="signals-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="panel-header">
        <span className="panel-title">SIGNALS</span>
        {fd?.sector && <span style={{ fontSize: 8, color: "var(--text-dim)" }}>{fd.sector}</span>}
      </div>
      <div className="panel-content" style={{ flex: 1, overflow: "auto", padding: 8 }}>

        {/* ── VERDICT BLOCK ── */}
        <div style={{ marginBottom: 10, padding: "10px", background: "var(--bg-dim)", borderRadius: 4, borderLeft: `3px solid ${verdictColor}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600 }}>{symbol}</span>
            <span className={`pixel-badge signal-${signal.verdict.toLowerCase()}`} style={{ fontSize: 9, padding: "4px 10px" }}>
              {signal.verdict} {signal.score > 0 ? "+" : ""}{signal.score.toFixed(2)}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: "var(--text-dim)" }}>Confidence</span>
            <div style={{ flex: 1, height: 5, background: "var(--bg-panel)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${signal.confidence}%`, height: "100%", background: verdictColor, transition: "width 0.5s" }} />
            </div>
            <span style={{ fontSize: 9, color: verdictColor }}>{signal.confidence}%</span>
          </div>
          <button
            onClick={handleExplain} disabled={explaining}
            style={{
              background: "transparent", border: "1px solid var(--border-dim)",
              color: explaining ? "var(--text-accent)" : "var(--text-secondary)",
              fontSize: 8, fontFamily: "var(--font-pixel)", padding: "3px 8px", cursor: "pointer",
            }}
          >
            {explaining ? "◎ Analyzing..." : "◎ EXPLAIN THIS SIGNAL"}
          </button>
          {explanation && (
            <div style={{ marginTop: 8, fontSize: 9, lineHeight: 1.5, color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              {explanation}
            </div>
          )}
        </div>

        {/* ── SIGNAL BREAKDOWN ── */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Signal Breakdown</div>
          <SignalBar value={signalValue(signal, "TREND")} label="TREND" insight={trendInsight(signal)} />
          <SignalBar value={signalValue(signal, "MOMENTUM")} label="MOMENTUM" insight={momentumInsight(signal)} />
          <SignalBar value={signalValue(signal, "REVERSION")} label="REVERSION" insight={reversionInsight(signal)} />
          <SignalBar value={signalValue(signal, "VOLUME")} label="VOLUME" insight={volumeInsight(signal)} />
        </div>

        {/* ── KEY LEVELS ── */}
        <div style={{ marginBottom: 10, padding: 8, background: "var(--bg-dim)", borderRadius: 4 }}>
          <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Key Levels</div>

          {/* VWAP comparison */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 10, fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-dim)" }}>VWAP</span>
            <span style={{ color: "var(--text-primary)" }}>{isNSE ? formatINR(signal.vwap) : `$${signal.vwap.toFixed(2)}`}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 10, fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-dim)" }}>ATR(14)</span>
            <span style={{ color: "var(--text-primary)" }}>{isNSE ? formatINR(signal.atr) : `$${signal.atr.toFixed(2)}`}</span>
          </div>

          {/* 52W Range */}
          {w52High && w52Low && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 8, color: "var(--text-dim)", marginBottom: 4 }}>52W Range</div>
              <div style={{ height: 4, background: "var(--bg-panel)", borderRadius: 2, position: "relative", overflow: "hidden", marginBottom: 4 }}>
                <div style={{ height: "100%", background: "linear-gradient(90deg, var(--signal-sell), var(--signal-hold), var(--signal-buy))", borderRadius: 2 }} />
                {range52w !== null && (
                  <div style={{
                    position: "absolute", top: -2, left: `${Math.min(98, Math.max(2, range52w * 100))}%`,
                    transform: "translateX(-50%)", width: 8, height: 8, borderRadius: "50%",
                    background: "white", border: "2px solid var(--bg-void)",
                  }} />
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "var(--text-dim)" }}>
                <span>L {isNSE ? `₹${Math.round(w52Low).toLocaleString("en-IN")}` : `$${w52Low.toFixed(0)}`}</span>
                {range52w !== null && <span style={{ color: "var(--text-secondary)" }}>{(range52w * 100).toFixed(0)}%</span>}
                <span>H {isNSE ? `₹${Math.round(w52High).toLocaleString("en-IN")}` : `$${w52High.toFixed(0)}`}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── FUNDAMENTALS ── */}
        {hasFundamentals ? (
          <div style={{ marginBottom: 10, padding: 8, background: "var(--bg-dim)", borderRadius: 4 }}>
            <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Fundamentals</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {fd?.pe_ratio != null && (
                <FundRow label="P/E Ratio" value={`${fd.pe_ratio.toFixed(1)}×`} />
              )}
              {fd?.pb_ratio != null && (
                <FundRow label="P/B Ratio" value={`${fd.pb_ratio.toFixed(1)}×`} />
              )}
              {fd?.roe && (
                <FundRow label="ROE" value={fd.roe} />
              )}
              {fd?.debt_to_equity != null && (
                <FundRow
                  label="D/E Ratio"
                  value={fd.debt_to_equity.toFixed(2)}
                  badge={fd.debt_to_equity < 0.5 ? "LOW LEVERAGE" : fd.debt_to_equity > 2 ? "HIGH LEVERAGE" : undefined}
                  badgeColor={fd.debt_to_equity < 0.5 ? "var(--signal-buy)" : "var(--signal-sell)"}
                />
              )}
              {fd?.market_cap != null && (
                <FundRow label="Mkt Cap" value={formatMarketCap(fd.market_cap, fd.market_cap_fmt)} />
              )}
              {fd?.revenue && (
                <FundRow label="Revenue TTM" value={fd.revenue} />
              )}
              {fd?.profit_margin && (
                <FundRow label="Net Margin" value={fd.profit_margin} />
              )}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 10, padding: 8, background: "var(--bg-dim)", borderRadius: 4, fontSize: 9, color: "var(--text-dim)", fontStyle: "italic" }}>
            Fundamentals unavailable
          </div>
        )}

        {/* ── QUICK LINKS ── */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            { label: "↗ NSE", href: nseLink },
            { label: "↗ SCREENER", href: screenerLink },
            { label: "↗ TICKERTAPE", href: tickertapeLink },
            { label: "↗ MC", href: mcLink },
          ].map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              style={{
                fontSize: 8, fontFamily: "var(--font-pixel)", color: "var(--text-dim)",
                padding: "3px 6px", border: "1px solid var(--border-dim)",
                textDecoration: "none", transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.color = "var(--text-accent)"; (e.target as HTMLElement).style.borderColor = "var(--text-accent)" }}
              onMouseLeave={e => { (e.target as HTMLElement).style.color = "var(--text-dim)"; (e.target as HTMLElement).style.borderColor = "var(--border-dim)" }}
            >
              {label}
            </a>
          ))}
        </div>

      </div>
    </div>
  )
}

function FundRow({ label, value, badge, badgeColor }: { label: string; value: string; badge?: string; badgeColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontFamily: "var(--font-mono)" }}>
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--text-primary)" }}>{value}</span>
        {badge && (
          <span style={{
            fontSize: 7, fontFamily: "var(--font-pixel)", color: badgeColor,
            border: `1px solid ${badgeColor}`, padding: "1px 4px",
          }}>{badge}</span>
        )}
      </div>
    </div>
  )
}
