"use client"

import { useState, useEffect, useCallback } from "react"

type Holding = {
  id: string
  symbol: string
  qty: number
  avgPrice: number
  currentPrice?: number
  change?: number
  changePct?: number
}

type PortfolioStats = {
  totalInvested: number
  currentValue: number
  pnl: number
  pnlPct: number
  dayPnl: number
}

const STORAGE_KEY = "quantoracle_portfolio_v2"

function generateId() {
  return Math.random().toString(36).slice(2)
}

function formatINR(v: number, decimals = 2): string {
  if (!isFinite(v)) return "—"
  const abs = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 1e7) return sign + "₹" + (abs / 1e7).toFixed(2) + " Cr"
  if (abs >= 1e5) return sign + "₹" + (abs / 1e5).toFixed(2) + " L"
  return sign + new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(abs)
}

function StatCard({ label, value, pct, color }: { label: string; value: string; pct?: string; color?: string }) {
  return (
    <div style={{ padding: "10px 12px", background: "var(--bg-dim)", border: "1px solid var(--border-dim)", borderRadius: 4 }}>
      <div style={{ fontSize: 7, fontFamily: "var(--font-pixel)", color: "var(--text-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: "var(--font-mono)", color: color || "var(--text-primary)", fontWeight: 600 }}>{value}</div>
      {pct && <div style={{ fontSize: 10, color, fontFamily: "var(--font-mono)", marginTop: 2 }}>{pct}</div>}
    </div>
  )
}

export function PortfolioPanel({ onSymbolSelect }: { onSymbolSelect?: (s: string) => void }) {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ symbol: "", qty: "", avgPrice: "" })
  const [formError, setFormError] = useState("")
  const [sortCol, setSortCol] = useState<"pnl" | "value" | "symbol" | "change">("pnl")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // Persist to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setHoldings(JSON.parse(saved))
    } catch {}
  }, [])

  const save = useCallback((h: Holding[]) => {
    setHoldings(h)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(h)) } catch {}
  }, [])

  // Fetch live prices for all holdings
  const refreshPrices = useCallback(async (h: Holding[]) => {
    if (h.length === 0) return h
    setLoading(true)
    try {
      const syms = h.map(x => x.symbol).join(",")
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(syms)}&t=${Date.now()}`)
      const data = await res.json()
      const quotes: Record<string, { price: number; change: number }> = data.quotes ?? {}
      const updated = h.map(x => {
        const q = quotes[x.symbol]
        return q ? { ...x, currentPrice: q.price, changePct: q.change } : x
      })
      return updated
    } catch { return h }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (holdings.length > 0) {
      refreshPrices(holdings).then(updated => {
        setHoldings(updated)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Compute stats
  const stats: PortfolioStats = holdings.reduce<PortfolioStats>((acc, h) => {
    const invested = h.qty * h.avgPrice
    const current = h.qty * (h.currentPrice ?? h.avgPrice)
    const pnl = current - invested
    const dayPnl = h.currentPrice && h.changePct ? h.qty * h.currentPrice * (h.changePct / 100) : 0
    return {
      totalInvested: acc.totalInvested + invested,
      currentValue: acc.currentValue + current,
      pnl: acc.pnl + pnl,
      pnlPct: 0,
      dayPnl: acc.dayPnl + dayPnl,
    }
  }, { totalInvested: 0, currentValue: 0, pnl: 0, pnlPct: 0, dayPnl: 0 })
  stats.pnlPct = stats.totalInvested > 0 ? (stats.pnl / stats.totalInvested) * 100 : 0

  const pnlColor = stats.pnl >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"
  const dayColor = stats.dayPnl >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"

  const addHolding = async () => {
    const sym = form.symbol.trim().toUpperCase()
    const qty = parseFloat(form.qty)
    const price = parseFloat(form.avgPrice)
    if (!sym) return setFormError("Enter a symbol (e.g. RELIANCE.NS)")
    if (!qty || qty <= 0) return setFormError("Enter a valid quantity > 0")
    if (!price || price <= 0) return setFormError("Enter a valid average price > 0")
    const existing = holdings.find(h => h.symbol === sym)
    let next: Holding[]
    if (existing) {
      // Average down/up
      const totalCost = existing.qty * existing.avgPrice + qty * price
      const totalQty = existing.qty + qty
      next = holdings.map(h => h.symbol === sym ? { ...h, qty: totalQty, avgPrice: totalCost / totalQty } : h)
    } else {
      next = [...holdings, { id: generateId(), symbol: sym, qty, avgPrice: price }]
    }
    const updated = await refreshPrices(next)
    save(updated)
    setForm({ symbol: "", qty: "", avgPrice: "" })
    setShowAdd(false)
    setFormError("")
  }

  const removeHolding = (id: string) => {
    save(holdings.filter(h => h.id !== id))
  }

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortCol(col); setSortDir("desc") }
  }

  const sorted = [...holdings].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1
    switch (sortCol) {
      case "symbol": return mul * a.symbol.localeCompare(b.symbol)
      case "value":  return mul * ((a.qty * (a.currentPrice ?? a.avgPrice)) - (b.qty * (b.currentPrice ?? b.avgPrice)))
      case "pnl": {
        const pa = a.qty * ((a.currentPrice ?? a.avgPrice) - a.avgPrice)
        const pb = b.qty * ((b.currentPrice ?? b.avgPrice) - b.avgPrice)
        return mul * (pa - pb)
      }
      case "change": return mul * ((a.changePct ?? 0) - (b.changePct ?? 0))
      default: return 0
    }
  })

  // Sector exposure — approximate by symbol suffix
  const sectorMap: Record<string, string> = {
    "HDFCBANK.NS": "Finance", "ICICIBANK.NS": "Finance", "SBIN.NS": "Finance", "KOTAKBANK.NS": "Finance", "AXISBANK.NS": "Finance",
    "INFY.NS": "IT", "TCS.NS": "IT", "WIPRO.NS": "IT", "HCLTECH.NS": "IT", "TECHM.NS": "IT",
    "RELIANCE.NS": "Energy", "ONGC.NS": "Energy", "NTPC.NS": "Energy", "BPCL.NS": "Energy",
    "MARUTI.NS": "Auto", "TATAMOTORS.NS": "Auto", "BAJAJ-AUTO.NS": "Auto",
    "SUNPHARMA.NS": "Pharma", "DRREDDY.NS": "Pharma", "CIPLA.NS": "Pharma",
    "HINDUNILVR.NS": "FMCG", "ITC.NS": "FMCG", "NESTLEIND.NS": "FMCG",
  }
  const sectorExposure: Record<string, number> = {}
  holdings.forEach(h => {
    const sector = sectorMap[h.symbol] ?? "Other"
    const value = h.qty * (h.currentPrice ?? h.avgPrice)
    sectorExposure[sector] = (sectorExposure[sector] ?? 0) + value
  })
  const totalVal = Math.max(stats.currentValue, 1)
  const sectorEntries = Object.entries(sectorExposure).sort((a, b) => b[1] - a[1])
  const sectorColors: Record<string, string> = {
    Finance: "#00ccff", IT: "#c8ff00", Energy: "#ff8800", Auto: "#ff3355",
    Pharma: "#9b59b6", FMCG: "#00ff88", Other: "#4a4a4a",
  }

  // Empty state
  if (holdings.length === 0 && !showAdd) {
    return (
      <div className="portfolio-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="panel-header">
          <span className="panel-title">PORTFOLIO</span>
          <button onClick={() => setShowAdd(true)} style={{ fontFamily: "var(--font-pixel)", fontSize: 7, padding: "4px 8px", background: "var(--text-accent)", color: "var(--bg-void)", border: "none", cursor: "pointer" }}>+ ADD HOLDING</button>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--text-dim)" }}>
          <span style={{ fontSize: 20 }}>🗂</span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>No holdings yet</span>
          <span style={{ fontSize: 9, color: "var(--text-dim)" }}>Add your first position to track P&L</span>
          <button onClick={() => setShowAdd(true)} style={{ fontFamily: "var(--font-pixel)", fontSize: 7, padding: "6px 14px", background: "transparent", color: "var(--text-accent)", border: "1px solid var(--text-accent)", cursor: "pointer" }}>+ ADD HOLDING</button>
        </div>
      </div>
    )
  }

  return (
    <div className="portfolio-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="panel-header">
        <span className="panel-title">PORTFOLIO</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {loading && <span className="pixel-loader" />}
          <button
            onClick={() => refreshPrices(holdings).then(updated => save(updated))}
            style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", background: "transparent", border: "1px solid var(--border-dim)", padding: "3px 7px", cursor: "pointer" }}
          >↻</button>
          <button onClick={() => { setShowAdd(true); setFormError("") }} style={{ fontFamily: "var(--font-pixel)", fontSize: 7, padding: "4px 8px", background: "var(--text-accent)", color: "var(--bg-void)", border: "none", cursor: "pointer" }}>+ ADD</button>
        </div>
      </div>

      <div className="panel-content" style={{ flex: 1, overflow: "auto" }}>
        {/* Add form inline */}
        {showAdd && (
          <div style={{ padding: 10, background: "var(--bg-dim)", border: "1px solid var(--border-mid)", marginBottom: 10, borderRadius: 4 }}>
            <div style={{ fontSize: 8, fontFamily: "var(--font-pixel)", color: "var(--text-accent)", marginBottom: 8 }}>ADD / AVERAGE HOLDING</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input placeholder="Symbol e.g. RELIANCE.NS" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                style={{ flex: 2, minWidth: 130, fontFamily: "var(--font-mono)", fontSize: 10, background: "var(--bg-raised)", border: "1px solid var(--border-dim)", color: "var(--text-primary)", padding: "5px 8px", outline: "none" }} />
              <input placeholder="Qty" type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                style={{ flex: 1, minWidth: 60, fontFamily: "var(--font-mono)", fontSize: 10, background: "var(--bg-raised)", border: "1px solid var(--border-dim)", color: "var(--text-primary)", padding: "5px 8px", outline: "none" }} />
              <input placeholder="Avg price ₹" type="number" value={form.avgPrice} onChange={e => setForm(f => ({ ...f, avgPrice: e.target.value }))}
                style={{ flex: 1, minWidth: 80, fontFamily: "var(--font-mono)", fontSize: 10, background: "var(--bg-raised)", border: "1px solid var(--border-dim)", color: "var(--text-primary)", padding: "5px 8px", outline: "none" }} />
              <button onClick={addHolding} style={{ fontFamily: "var(--font-pixel)", fontSize: 7, padding: "5px 10px", background: "var(--text-accent)", color: "var(--bg-void)", border: "none", cursor: "pointer" }}>ADD</button>
              <button onClick={() => { setShowAdd(false); setFormError("") }} style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "5px 8px", background: "transparent", color: "var(--text-dim)", border: "1px solid var(--border-dim)", cursor: "pointer" }}>Cancel</button>
            </div>
            {formError && <div style={{ marginTop: 6, fontSize: 9, color: "var(--signal-sell)", fontFamily: "var(--font-mono)" }}>{formError}</div>}
          </div>
        )}

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 10, minWidth: 420 }}>
          <StatCard label="Invested" value={formatINR(stats.totalInvested, 0)} />
          <StatCard label="Current Value" value={formatINR(stats.currentValue, 0)} />
          <StatCard label="Total P&L" value={formatINR(stats.pnl, 0)} pct={`${stats.pnlPct >= 0 ? "+" : ""}${stats.pnlPct.toFixed(2)}%`} color={pnlColor} />
          <StatCard label="Day P&L" value={formatINR(stats.dayPnl, 0)} color={dayColor} />
        </div>

        {/* Holdings table */}
        <div style={{ overflowX: "auto", marginBottom: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
            <thead>
              <tr>
                {[
                  { col: "symbol", label: "SYMBOL" },
                  { col: "value", label: "VALUE" },
                  { col: "pnl", label: "P&L" },
                  { col: "change", label: "CHG%" },
                ].map(({ col, label }) => (
                  <th key={col} onClick={() => toggleSort(col as typeof sortCol)} style={{
                    fontSize: 7, fontFamily: "var(--font-pixel)", color: sortCol === col ? "var(--text-accent)" : "var(--text-dim)",
                    padding: "4px 6px", borderBottom: "1px solid var(--border-dim)",
                    textAlign: col === "symbol" ? "left" : "right", cursor: "pointer", userSelect: "none",
                  }}>
                    {label} {sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                ))}
                <th style={{ fontSize: 7, fontFamily: "var(--font-pixel)", color: "var(--text-dim)", padding: "4px 6px", borderBottom: "1px solid var(--border-dim)" }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(h => {
                const currPrice = h.currentPrice ?? h.avgPrice
                const value = h.qty * currPrice
                const pnl = h.qty * (currPrice - h.avgPrice)
                const pnlPct = ((currPrice - h.avgPrice) / h.avgPrice) * 100
                const chg = h.changePct ?? 0
                const pnlColor = pnl >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"
                const chgColor = chg >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"
                return (
                  <tr key={h.id}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    style={{ borderBottom: "1px solid var(--border-dim)", transition: "background 0.1s" }}
                  >
                    <td style={{ padding: "5px 6px" }}>
                      <button onClick={() => onSymbolSelect?.(h.symbol)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>{h.symbol.replace(".NS", "")}</div>
                        <div style={{ fontSize: 8, color: "var(--text-dim)" }}>{h.qty} @ {formatINR(h.avgPrice)}</div>
                      </button>
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-primary)" }}>
                      {formatINR(value, 0)}
                      {h.currentPrice && <div style={{ fontSize: 8, color: "var(--text-dim)" }}>{formatINR(h.currentPrice)}</div>}
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: pnlColor }}>
                      {pnl >= 0 ? "+" : ""}{formatINR(pnl, 0)}
                      <div style={{ fontSize: 8 }}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</div>
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: chgColor }}>
                      {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                    </td>
                    <td style={{ padding: "5px 6px", textAlign: "right" }}>
                      <button onClick={() => removeHolding(h.id)} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Sector Exposure */}
        {sectorEntries.length > 0 && (
          <div style={{ padding: 10, background: "var(--bg-dim)", borderRadius: 4 }}>
            <div style={{ fontSize: 7, fontFamily: "var(--font-pixel)", color: "var(--text-dim)", marginBottom: 10, textTransform: "uppercase" }}>Sector Exposure</div>
            {sectorEntries.map(([sector, value]) => {
              const pct = (value / totalVal) * 100
              const color = sectorColors[sector] ?? "var(--text-dim)"
              return (
                <div key={sector} style={{ marginBottom: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2, fontSize: 9, fontFamily: "var(--font-mono)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{sector}</span>
                    <span style={{ color }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 4, background: "var(--bg-panel)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.4s" }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
