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
}

export function SignalsPanel({ symbol }: { symbol: string }) {
  const [signal, setSignal] = useState<SignalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState("")

  useEffect(() => {
    console.log('SignalsPanel: symbol changed to:', symbol)
    const fetchSignal = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/signals/${encodeURIComponent(symbol)}?t=${Date.now()}`)
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
    } catch (err) {
      console.error("Failed to get explanation:", err)
    } finally {
      setExplaining(false)
    }
  }

  const getVerdictColor = (verdict: string) => {
    switch (verdict) {
      case "BUY": return "signal-buy"
      case "SELL": return "signal-sell"
      default: return "signal-hold"
    }
  }

  const formatMktCap = (cap: number, fmt?: string) => {
    if (fmt) return fmt
    if (!cap) return "N/A"
    if (cap >= 1e12) return `₹${(cap / 1e12).toFixed(1)}L Cr`
    if (cap >= 1e10) return `₹${(cap / 1e10).toFixed(0)} Cr`
    if (cap >= 1e8) return `₹${(cap / 1e8).toFixed(0)}L`
    return `₹${cap.toLocaleString()}`
  }

  const formatPrice = (price: number, isIndian: boolean = true) => {
    if (!price) return "N/A"
    if (isIndian) {
      return `₹${price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
    }
    return `$${price.toFixed(2)}`
  }

  const getTrendExplanation = (signal: SignalData) => {
    const ema21 = signal.trend === "TRENDING_UP"
    const adx = signal.adx
    if (ema21 && adx > 25) return "EMA21 above EMA55. Strong trend (ADX=" + adx + ")."
    if (ema21 && adx <= 25) return "EMA21 above EMA55 but weak momentum (ADX=" + adx + ")."
    if (!ema21 && adx > 25) return "EMA21 below EMA55. Downtrend active (ADX=" + adx + ")."
    return "Price sideways. EMA21 near EMA55. No clear direction."
  }

  const getMomentumExplanation = (signal: SignalData) => {
    const rsi = signal.rsi
    const macd = signal.macd_hist
    if (rsi > 60 && macd > 0) return "RSI " + rsi.toFixed(1) + " and MACD hist +" + macd.toFixed(2) + ". Bullish momentum."
    if (rsi < 40 && macd < 0) return "RSI " + rsi.toFixed(1) + " and MACD hist " + macd.toFixed(2) + ". Bearish pressure."
    if (rsi > 70) return "RSI " + rsi.toFixed(1) + " — overbought territory."
    if (rsi < 30) return "RSI " + rsi.toFixed(1) + " — oversold zone."
    return "RSI " + rsi.toFixed(1) + ". Momentum neutral."
  }

  const getReversionExplanation = (signal: SignalData) => {
    const rsi = signal.rsi
    if (rsi < 35) return "RSI " + rsi.toFixed(1) + " — approaching oversold. Mean reversion likely."
    if (rsi > 65) return "RSI " + rsi.toFixed(1) + " — near overbought. Pullback possible."
    return "RSI " + rsi.toFixed(1) + " — near 50. Price fairly valued."
  }

  const getVolumeExplanation = (signal: SignalData) => {
    if (signal.volume === "SURGE") return "Volume 1.5x average. Strong conviction."
    if (signal.volume === "LOW") return "Volume below average. Lack of participation."
    return "Volume average. No unusual activity."
  }

  // External links
  const symbolWithoutNS = symbol.replace('.NS', '').replace('^', '')
  const nseLink = `https://www.nseindia.com/get-quotes/equity?symbol=${symbolWithoutNS}`
  const screenerLink = `https://www.screener.in/company/${symbolWithoutNS}/`

  if (loading) {
    return (
      <div className="signals-panel terminal-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="panel-header">
          <span className="panel-title">SIGNALS</span>
        </div>
        <div className="panel-content" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="pixel-loader" />
        </div>
      </div>
    )
  }

  if (!signal) {
    return (
      <div className="signals-panel terminal-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="panel-header">
          <span className="panel-title">SIGNALS</span>
        </div>
        <div className="panel-content" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
          No signal data
        </div>
      </div>
    )
  }

  return (
    <div className="signals-panel terminal-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      <div className="panel-header">
        <span className="panel-title">SIGNALS</span>
      </div>
      <div className="panel-content" style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        
        {/* SECTION 1: VERDICT HEADER */}
        <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-dim)', borderRadius: '4px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>
            {symbol}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className={`pixel-badge ${getVerdictColor(signal.verdict)}`} style={{ fontSize: '12px', padding: '4px 10px' }}>
              {signal.verdict} {signal.score > 0 ? "+" : ""}{signal.score.toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Confidence</span>
            <div style={{ flex: 1, height: '6px', background: 'var(--bg-panel)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${signal.confidence}%`, height: '100%', background: signal.confidence >= 60 ? 'var(--signal-buy)' : 'var(--signal-sell)' }} />
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-primary)' }}>{signal.confidence}%</span>
          </div>
          <button 
            onClick={handleExplain} 
            disabled={explaining}
            style={{ 
              marginTop: '8px', 
              background: 'transparent', 
              border: '1px solid var(--border-dim)', 
              color: 'var(--text-secondary)',
              fontSize: '9px',
              padding: '4px 8px',
              cursor: 'pointer',
              borderRadius: '2px'
            }}
          >
            {explaining ? '◎ Analyzing...' : '◎ AI Explain'}
          </button>
        </div>

        {/* SECTION 2: SIGNAL BREAKDOWN */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Signal Breakdown
          </div>
          
          {/* TREND */}
          <div style={{ marginBottom: '8px', padding: '6px', background: 'var(--bg-dim)', borderRadius: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>TREND</span>
              <span style={{ fontSize: '9px', color: signal.trend === 'TRENDING_UP' ? 'var(--signal-buy)' : signal.trend === 'TRENDING_DOWN' ? 'var(--signal-sell)' : 'var(--text-dim)' }}>
                {signal.trend.replace('_', ' ')} {signal.trend === 'TRENDING_UP' ? '↑' : signal.trend === 'TRENDING_DOWN' ? '↓' : '→'}
              </span>
            </div>
            <div style={{ height: '3px', background: 'var(--bg-panel)', borderRadius: '2px', overflow: 'hidden', marginBottom: '3px' }}>
              <div style={{ 
                width: signal.trend === 'TRENDING_UP' ? '70%' : signal.trend === 'TRENDING_DOWN' ? '30%' : '50%', 
                height: '100%', 
                background: signal.trend === 'TRENDING_UP' ? 'var(--signal-buy)' : signal.trend === 'TRENDING_DOWN' ? 'var(--signal-sell)' : 'var(--text-dim)' 
              }} />
            </div>
            <div style={{ fontSize: '8px', color: 'var(--text-dim)', lineHeight: 1.3 }}>
              {getTrendExplanation(signal)}
            </div>
          </div>

          {/* MOMENTUM */}
          <div style={{ marginBottom: '8px', padding: '6px', background: 'var(--bg-dim)', borderRadius: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>MOMENTUM</span>
              <span style={{ fontSize: '9px', color: signal.momentum.includes('BULLISH') ? 'var(--signal-buy)' : signal.momentum.includes('BEARISH') ? 'var(--signal-sell)' : 'var(--text-dim)' }}>
                {signal.momentum.replace('_', ' ')}
              </span>
            </div>
            <div style={{ height: '3px', background: 'var(--bg-panel)', borderRadius: '2px', overflow: 'hidden', marginBottom: '3px' }}>
              <div style={{ 
                width: signal.momentum.includes('BULLISH') ? '70%' : signal.momentum.includes('BEARISH') ? '30%' : '50%', 
                height: '100%', 
                background: signal.momentum.includes('BULLISH') ? 'var(--signal-buy)' : signal.momentum.includes('BEARISH') ? 'var(--signal-sell)' : 'var(--text-dim)' 
              }} />
            </div>
            <div style={{ fontSize: '8px', color: 'var(--text-dim)', lineHeight: 1.3 }}>
              {getMomentumExplanation(signal)}
            </div>
          </div>

          {/* REVERSION */}
          <div style={{ marginBottom: '8px', padding: '6px', background: 'var(--bg-dim)', borderRadius: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>REVERSION</span>
              <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
                {signal.reversion.replace('_', ' ')}
              </span>
            </div>
            <div style={{ fontSize: '8px', color: 'var(--text-dim)', lineHeight: 1.3 }}>
              {getReversionExplanation(signal)}
            </div>
          </div>

          {/* VOLUME */}
          <div style={{ marginBottom: '8px', padding: '6px', background: 'var(--bg-dim)', borderRadius: '3px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
              <span style={{ fontSize: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>VOLUME</span>
              <span style={{ fontSize: '9px', color: signal.volume === 'SURGE' ? 'var(--signal-buy)' : signal.volume === 'LOW' ? 'var(--signal-sell)' : 'var(--text-dim)' }}>
                {signal.volume === 'SURGE' ? 'SURGE' : signal.volume === 'LOW' ? 'LOW' : 'NORMAL'}
              </span>
            </div>
            <div style={{ fontSize: '8px', color: 'var(--text-dim)', lineHeight: 1.3 }}>
              {getVolumeExplanation(signal)}
            </div>
          </div>
        </div>

        {/* SECTION 3: KEY LEVELS */}
        <div style={{ marginBottom: '12px', padding: '8px', background: 'var(--bg-dim)', borderRadius: '4px' }}>
          <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Key Levels
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>VWAP</div>
              <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{formatPrice(signal.vwap)}</div>
            </div>
            <div>
              <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>ATR(14)</div>
              <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{formatPrice(signal.atr)}</div>
            </div>
          </div>

          <div style={{ fontSize: '8px', color: 'var(--text-dim)', marginBottom: '4px' }}>52W Range</div>
          <div style={{ height: '4px', background: 'var(--bg-panel)', borderRadius: '2px', overflow: 'hidden', marginBottom: '4px' }}>
            <div style={{ width: '50%', height: '100%', background: 'var(--accent-primary)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--text-dim)' }}>
            <span>52W Low</span>
            <span>52W High</span>
          </div>
        </div>

        {/* SECTION 4: FUNDAMENTALS */}
        {(signal.pe || signal.pb || signal.roe || signal.mkt_cap) && (
          <div style={{ marginBottom: '12px', padding: '8px', background: 'var(--bg-dim)', borderRadius: '4px' }}>
            <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Fundamentals
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {signal.pe ? (
                <div>
                  <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>P/E</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{signal.pe.toFixed(1)}x</div>
                </div>
              ) : null}
              {signal.pb ? (
                <div>
                  <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>P/B</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{signal.pb.toFixed(1)}x</div>
                </div>
              ) : null}
              {signal.roe ? (
                <div>
                  <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>ROE</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{signal.roe.toFixed(1)}%</div>
                </div>
              ) : null}
              {signal.mkt_cap ? (
                <div>
                  <div style={{ fontSize: '8px', color: 'var(--text-dim)' }}>Mkt Cap</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{formatMktCap(signal.mkt_cap, signal.market_cap_fmt)}</div>
                </div>
              ) : null}
            </div>
            {!signal.pe && !signal.pb && !signal.roe && !signal.mkt_cap && (
              <div style={{ fontSize: '9px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                Fundamentals unavailable
              </div>
            )}
          </div>
        )}

        {/* SECTION 5: QUICK ACTIONS */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <a 
            href={nseLink} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              fontSize: '8px', 
              color: 'var(--text-secondary)', 
              padding: '4px 8px', 
              border: '1px solid var(--border-dim)',
              borderRadius: '2px',
              textDecoration: 'none',
            }}
          >
            View on NSE
          </a>
          <a 
            href={screenerLink} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              fontSize: '8px', 
              color: 'var(--text-secondary)', 
              padding: '4px 8px', 
              border: '1px solid var(--border-dim)',
              borderRadius: '2px',
              textDecoration: 'none',
            }}
          >
            View on Screener
          </a>
        </div>

        {/* AI Explanation */}
        {explanation && (
          <div style={{ 
            marginTop: '12px', 
            padding: '8px', 
            background: 'var(--bg-dim)', 
            borderRadius: '4px',
            fontSize: '9px',
            lineHeight: 1.4,
            color: 'var(--text-primary)',
            maxHeight: '150px',
            overflow: 'auto',
          }}>
            {explanation}
          </div>
        )}

      </div>
    </div>
  )
}
