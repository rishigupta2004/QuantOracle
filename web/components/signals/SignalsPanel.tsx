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
  price?: number
  lastUpdated?: string
}

type SignalAccuracy = {
  hitRate: number
  avgReturnBuy: number
  avgAvoidedSell: number
  totalSignals: number
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

const CATEGORY_COLORS = {
  TREND: "#c8ff00",
  MOMENTUM: "#00ccff",
  REVERSION: "#cc00ff",
  VOLUME: "#ff8800",
}

function SignalBar({ value, label, insight }: { value: number; label: string; insight: string }) {
  const color = CATEGORY_COLORS[label as keyof typeof CATEGORY_COLORS] || "#888"
  const isPositive = value >= 0
  const position = 50 + (value * 50)

  return (
    <div style={{ marginBottom: 12, padding: "8px 10px", background: "var(--bg-dim)", borderRadius: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 9, color: color, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 10, color: isPositive ? "var(--signal-buy)" : "var(--signal-sell)", fontFamily: "var(--font-mono)" }}>
          {value > 0 ? "+" : ""}{value.toFixed(2)}
        </span>
      </div>
      <div style={{ height: 6, background: "var(--bg-panel)", borderRadius: 3, position: "relative", overflow: "hidden", marginBottom: 6 }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "100%", background: "linear-gradient(90deg, rgba(239,68,68,0.4), transparent)", borderRadius: "3px 0 0 3px" }} />
        <div style={{ position: "absolute", right: 0, top: 0, width: "50%", height: "100%", background: "linear-gradient(90deg, transparent, rgba(34,197,94,0.4))", borderRadius: "0 3px 3px 0" }} />
        <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: "var(--text-dim)", opacity: 0.5 }} />
        <div style={{
          position: "absolute",
          left: `${position}%`,
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 8px ${color}, 0 0 2px white`,
        }} />
      </div>
      <div style={{ fontSize: 9, color: "var(--text-dim)", lineHeight: 1.4 }}>{insight}</div>
    </div>
  )
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

function PriceRuler({ current, low, high, isNSE }: { current: number; low: number; high: number; isNSE: boolean }) {
  const range = high - low
  const currentPos = range > 0 ? ((current - low) / range) * 100 : 50

  const format = (v: number) => isNSE ? `₹${Math.round(v).toLocaleString("en-IN")}` : `$${v.toFixed(2)}`

  return (
    <div style={{ position: "relative", padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, color: "var(--text-dim)", marginBottom: 4 }}>
        <span>{format(low)}</span>
        <span>{format(high)}</span>
      </div>
      <div style={{ height: 8, background: "var(--bg-panel)", borderRadius: 4, position: "relative", overflow: "visible" }}>
        <div style={{
          position: "absolute",
          left: `${currentPos}%`,
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "var(--text-accent)",
          border: "3px solid var(--bg-void)",
          boxShadow: "0 0 10px var(--text-accent)",
          zIndex: 2,
        }} />
        <div style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: `${currentPos}%`,
          height: "100%",
          background: "linear-gradient(90deg, var(--signal-buy), var(--text-accent))",
          borderRadius: "4px 0 0 4px",
        }} />
        <div style={{
          position: "absolute",
          left: `${currentPos}%`,
          top: "50%",
          transform: "translateY(-50%)",
          width: `${100 - currentPos}%`,
          height: "100%",
          background: "var(--signal-sell)",
          borderRadius: "0 4px 4px 0",
          opacity: 0.6,
        }} />
      </div>
      <div style={{
        position: "absolute",
        left: `${currentPos}%`,
        top: 0,
        transform: "translateX(-50%)",
        fontSize: 8,
        fontFamily: "var(--font-mono)",
        color: "var(--text-accent)",
        fontWeight: 600,
      }}>
        {format(current)}
      </div>
    </div>
  )
}

function AccuracySection({ accuracy, onViewHistory }: { accuracy: SignalAccuracy | null; onViewHistory: () => void }) {
  return (
    <div style={{ marginBottom: 10, padding: 10, background: "var(--bg-dim)", borderRadius: 4, border: "1px solid var(--border-dim)" }}>
      <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Signal Accuracy</div>
      
      {accuracy ? (
        <>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>Hit Rate</span>
              <span style={{ fontSize: 9, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{(accuracy.hitRate * 100).toFixed(1)}%</span>
            </div>
            <div style={{ height: 6, background: "var(--bg-panel)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${accuracy.hitRate * 100}%`, height: "100%", background: "linear-gradient(90deg, #22c55e, #4ade80)", borderRadius: 3 }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div style={{ padding: 6, background: "var(--bg-panel)", borderRadius: 3 }}>
              <div style={{ fontSize: 7, color: "var(--text-dim)", marginBottom: 2 }}>Avg Return (BUY)</div>
              <div style={{ fontSize: 11, color: "var(--signal-buy)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                +{accuracy.avgReturnBuy.toFixed(1)}%
              </div>
            </div>
            <div style={{ padding: 6, background: "var(--bg-panel)", borderRadius: 3 }}>
              <div style={{ fontSize: 7, color: "var(--text-dim)", marginBottom: 2 }}>Avg Avoided (SELL)</div>
              <div style={{ fontSize: 11, color: "var(--signal-sell)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                {accuracy.avgAvoidedSell.toFixed(1)}%
              </div>
            </div>
          </div>

          <button
            onClick={onViewHistory}
            style={{
              width: "100%",
              fontSize: 9,
              fontFamily: "var(--font-pixel)",
              color: "var(--text-accent)",
              background: "transparent",
              border: "1px solid var(--text-accent)",
              padding: "6px 10px",
              borderRadius: 3,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = "var(--text-accent)"; (e.target as HTMLElement).style.color = "var(--bg-void)" }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "var(--text-accent)" }}
          >
            ◉ VIEW FULL HISTORY ON CHART
          </button>
        </>
      ) : (
        <div style={{ fontSize: 9, color: "var(--text-dim)", fontStyle: "italic" }}>No historical data available</div>
      )}
    </div>
  )
}

export function SignalsPanel({ symbol }: { symbol: string }) {
  const [signal, setSignal] = useState<SignalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState("")
  const [error, setError] = useState(false)
  const [accuracy, setAccuracy] = useState<SignalAccuracy | null>(null)

  const isFresh = signal?.lastUpdated && (Date.now() - new Date(signal.lastUpdated).getTime()) < 5 * 60 * 1000

  useEffect(() => {
    const fetchSignal = async () => {
      setLoading(true)
      setError(false)
      setExplanation("")
      try {
        const res = await fetch(`/api/signals/${encodeURIComponent(symbol)}?t=${Date.now()}`)
        const data = await res.json()
        if (data.signal) {
          setSignal(data.signal)
          if (data.signal.accuracy) {
            setAccuracy(data.signal.accuracy)
          }
        }
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
      // Make POST request with signal data as JSON body
      const res = await fetch('/api/ai/signal-explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol: symbol,
          verdict: signal.verdict,
          composite_score: signal.score,
          confidence: signal.confidence / 100,
          trend: {
            label: signal.trend,
            detail: signal.trend === "TRENDING_UP" ? "Price above key moving averages" : 
                    signal.trend === "TRENDING_DOWN" ? "Price below key moving averages" : "Sideways price action",
          },
          momentum: {
            label: signal.momentum,
          },
          reversion: {
            label: signal.reversion,
          },
          volume: {
            label: signal.volume,
          },
          explanation: `Trend: ${signal.trend}, Momentum: ${signal.momentum}, RSI: ${signal.rsi.toFixed(1)}, MACD: ${signal.macd_hist.toFixed(2)}`,
        }),
      })
      
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }
      
      const contentType = res.headers.get('content-type')
      if (contentType?.includes('text/plain')) {
        // Fallback response (no AI key)
        const text = await res.text()
        setExplanation(text)
      } else {
        // Streaming response
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        if (reader) {
          let text = ""
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            text += decoder.decode(value)
            setExplanation(text)
          }
        }
      }
    } catch (err) {
      console.error("Explain error:", err)
      setExplanation("Analysis unavailable. Check ANTHROPIC_API_KEY configuration.")
    }
    finally { setExplaining(false) }
  }

  const symBase = symbol.replace(".NS", "").replace(".BO", "").replace("^", "")
  const nseLink = `https://www.nseindia.com/get-quotes/equity?symbol=${symBase}`
  const screenerLink = `https://www.screener.in/company/${symBase}/`
  const tickertapeLink = `https://www.tickertape.in/stocks/${symBase.toLowerCase()}`
  const mcLink = `https://www.moneycontrol.com/india/stockpricequote/${symBase.toLowerCase()}/${symBase.toLowerCase()}`
  const deepDiveLink = `/stock/${symBase}`

  const verdictColor = signal?.verdict === "BUY" ? "var(--signal-buy)" : signal?.verdict === "SELL" ? "var(--signal-sell)" : "var(--signal-hold)"

  const w52High = signal?.fundamentals?.week_52_high
  const w52Low = signal?.fundamentals?.week_52_low
  const currentPrice = signal?.price || signal?.vwap
  const isNSE = symbol.endsWith(".NS") || symbol.endsWith(".BO")

  const range52w = w52High && w52Low && w52High > w52Low && currentPrice
    ? (currentPrice - w52Low) / (w52High - w52Low)
    : null

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

  const fd = signal.fundamentals
  const hasFundamentals = fd && (fd.pe_ratio || fd.pb_ratio || fd.roe || fd.market_cap || fd.debt_to_equity)

  return (
    <div className="signals-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <style>{`
        @keyframes verdict-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          50% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
        }
        @keyframes price-flash {
          0% { background-color: rgba(34, 197, 94, 0.3); }
          100% { background-color: transparent; }
        }
      `}</style>
      
      <div className="panel-header">
        <span className="panel-title">SIGNALS</span>
        {fd?.sector && <span style={{ fontSize: 8, color: "var(--text-dim)" }}>{fd.sector}</span>}
      </div>
      <div className="panel-content" style={{ flex: 1, overflow: "auto", padding: 10 }}>

        {/* ── LIVE HEADER SECTION ── */}
        <div style={{ 
          marginBottom: 12, 
          padding: 12, 
          background: "var(--bg-dim)", 
          borderRadius: 6, 
          borderLeft: `4px solid ${verdictColor}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "1px", fontFamily: "var(--font-mono)" }}>
                {symbol}
              </div>
              {fd?.sector && (
                <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>{fd.sector}</div>
              )}
            </div>
            <div
              className="verdict-badge"
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: "6px 14px",
                borderRadius: 4,
                background: verdictColor,
                color: verdictColor === "var(--signal-buy)" || verdictColor === "var(--signal-sell)" ? "#000" : "var(--text-primary)",
                animation: isFresh ? "verdict-pulse 2s ease-in-out infinite" : "none",
                boxShadow: isFresh ? `0 0 12px ${verdictColor}` : "none",
              }}
            >
              {signal.verdict}
            </div>
          </div>

          {currentPrice && (
            <div style={{
              fontSize: 18,
              fontFamily: "var(--font-mono)",
              color: "var(--text-accent)",
              marginBottom: 10,
            }}>
              {isNSE ? formatINR(currentPrice) : `$${currentPrice.toFixed(2)}`}
            </div>
          )}

          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: "var(--text-dim)" }}>Confidence</span>
              <span style={{ fontSize: 10, color: verdictColor, fontFamily: "var(--font-mono)" }}>{signal.confidence}%</span>
            </div>
            <div style={{ height: 8, background: "var(--bg-panel)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ 
                width: `${signal.confidence}%`, 
                height: "100%", 
                background: `linear-gradient(90deg, ${verdictColor}, ${verdictColor}dd)`,
                borderRadius: 4,
                transition: "width 0.5s ease-out",
              }} />
            </div>
          </div>

          <button
            onClick={handleExplain} disabled={explaining}
            style={{
              background: "transparent", 
              border: "1px solid var(--border-dim)",
              color: explaining ? "var(--text-accent)" : "var(--text-secondary)",
              fontSize: 8, 
              fontFamily: "var(--font-pixel)", 
              padding: "4px 10px", 
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            {explaining ? "◎ Analyzing..." : "◎ EXPLAIN THIS SIGNAL"}
          </button>

          {(explanation || explaining) && (
            <div style={{
              marginTop: '8px',
              padding: '10px',
              background: 'var(--bg-raised)',
              borderLeft: '2px solid var(--text-accent)',
              fontSize: '12px',
              lineHeight: '1.7',
              color: 'var(--text-secondary)',
              minHeight: explaining && !explanation ? '40px' : 'auto',
              transition: 'all 0.3s ease',
            }}>
              {explaining && !explanation && (
                <div style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '7px',
                  color: 'var(--text-accent)',
                }}>
                  ANALYZING...
                </div>
              )}
              {explanation}
              {explaining && explanation && (
                <span style={{
                  display: 'inline-block',
                  width: '8px', 
                  height: '14px',
                  background: 'var(--text-accent)',
                  marginLeft: '2px',
                  animation: 'blink 0.8s step-end infinite',
                }}/>
              )}
            </div>
          )}
        </div>

        {/* ── SIGNAL BARS ── */}
        <div style={{ marginBottom: 12 }}>
          <SignalBar value={signalValue(signal, "TREND")} label="TREND" insight={trendInsight(signal)} />
          <SignalBar value={signalValue(signal, "MOMENTUM")} label="MOMENTUM" insight={momentumInsight(signal)} />
          <SignalBar value={signalValue(signal, "REVERSION")} label="REVERSION" insight={reversionInsight(signal)} />
          <SignalBar value={signalValue(signal, "VOLUME")} label="VOLUME" insight={volumeInsight(signal)} />
        </div>

        {/* ── KEY LEVELS VISUAL ── */}
        <div style={{ marginBottom: 12, padding: 10, background: "var(--bg-dim)", borderRadius: 4 }}>
          <div style={{ fontSize: 8, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Key Levels</div>
          
          {currentPrice && w52High && w52Low && (
            <PriceRuler current={currentPrice} low={w52Low} high={w52High} isNSE={isNSE} />
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, marginBottom: 6, fontSize: 10, fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-dim)" }}>VWAP</span>
            <span style={{ color: "var(--text-primary)" }}>{isNSE ? formatINR(signal.vwap) : `$${signal.vwap.toFixed(2)}`}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 10, fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-dim)" }}>ATR(14)</span>
            <span style={{ color: "var(--text-primary)" }}>{isNSE ? formatINR(signal.atr) : `$${signal.atr.toFixed(2)}`}</span>
          </div>

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

        {/* ── SIGNAL ACCURACY MINI ── */}
        <AccuracySection 
          accuracy={accuracy} 
          onViewHistory={() => window.location.href = deepDiveLink}
        />

        {/* ── QUICK LINKS + DEEP DIVE ── */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
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

        <a
          href={deepDiveLink}
          style={{
            display: "block",
            textAlign: "center",
            fontSize: 10,
            fontFamily: "var(--font-pixel)",
            color: "var(--text-accent)",
            padding: "8px 12px",
            border: "1px solid var(--text-accent)",
            borderRadius: 4,
            textDecoration: "none",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.background = "var(--text-accent)"; (e.target as HTMLElement).style.color = "var(--bg-void)" }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = "transparent"; (e.target as HTMLElement).style.color = "var(--text-accent)" }}
        >
          ▶ DEEP DIVE →
        </a>

      </div>
    </div>
  )
}
