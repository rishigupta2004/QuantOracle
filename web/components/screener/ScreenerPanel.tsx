"use client"

import { useEffect, useState, useCallback, useRef } from "react"

type ScreenerRow = {
  rank: number
  symbol: string
  label?: string
  score: number
  verdict?: string
  change_pct?: number
  pe?: number | null
  sector?: string | null
  momentum?: number
  reversion?: number
  momentum_ic?: number
  price?: number
  decile?: number
  market_cap?: number
  week_52_high?: number
  week_52_low?: number
  last_updated?: string
}

type SortKey = "rank" | "score" | "change_pct" | "pe" | "momentum" | "price"
type SortDir = "asc" | "desc"
type SignalFilter = "ALL" | "BUY" | "HOLD" | "SELL"

function verdictColor(v: string | undefined): string {
  if (!v) return "var(--text-dim)"
  const u = v.toUpperCase()
  if (u.includes("STRONG_BUY") || u.includes("STRONG BUY")) return "var(--signal-buy)"
  if (u.includes("BUY")) return "var(--signal-buy)"
  if (u.includes("STRONG_SELL") || u.includes("STRONG SELL")) return "var(--signal-sell)"
  if (u.includes("SELL")) return "var(--signal-sell)"
  return "var(--signal-hold)"
}

function scoreBadgeStyle(score: number) {
  const bg = score > 60 ? "rgba(0,255,136,0.12)" : score < 40 ? "rgba(255,51,85,0.12)" : "rgba(255,204,0,0.1)"
  const color = score > 60 ? "var(--signal-buy)" : score < 40 ? "var(--signal-sell)" : "var(--signal-hold)"
  return { background: bg, color }
}

function DecileBar({ decile, score }: { decile?: number; score: number }) {
  const d = decile ?? Math.ceil(score / 10)
  return (
    <div style={{ display: "flex", gap: 1, alignItems: "center", justifyContent: "flex-end" }}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
        <div
          key={i}
          style={{
            width: 5,
            height: 14,
            borderRadius: 1,
            background: i <= d 
              ? (d >= 8 ? "var(--signal-buy)" : d >= 5 ? "var(--signal-hold)" : "var(--signal-sell)")
              : "var(--border-dim)",
            opacity: i <= d ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  )
}

function StockTooltip({ row }: { row: ScreenerRow }) {
  const formatINR = (v: number | null | undefined) => {
    if (v == null) return "—"
    if (v >= 1e12) return `₹${(v / 1e12).toFixed(2)}L Cr`
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(0)} Cr`
    return `₹${v.toLocaleString("en-IN")}`
  }
  
  const w52Pos = row.week_52_high && row.week_52_low && row.price
    ? ((row.price - row.week_52_low) / (row.week_52_high - row.week_52_low) * 100).toFixed(0)
    : null
  
  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '100%',
      transform: 'translateY(-50%)',
      zIndex: 100,
      width: 260,
      background: 'rgba(10, 10, 15, 0.98)',
      border: '1px solid var(--border-accent)',
      borderRadius: 4,
      padding: 12,
      marginLeft: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      backdropFilter: 'blur(10px)',
      pointerEvents: 'none',
    }}>
      <div style={{ 
        fontSize: 12, 
        fontFamily: 'var(--font-mono)', 
        color: 'var(--text-accent)',
        marginBottom: 10,
        fontWeight: 600,
      }}>
        {row.symbol.replace(".NS", "")}
      </div>
      
      {row.label && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>COMPANY</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{row.label}</div>
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>PRICE</div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>₹{row.price?.toFixed(2) ?? "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>P/E RATIO</div>
          <div style={{ fontSize: 12, color: row.pe && row.pe > 0 ? 'var(--text-primary)' : 'var(--text-dim)' }}>
            {row.pe?.toFixed(1) ?? "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>SECTOR</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{row.sector || "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>SCORE</div>
          <div style={{ fontSize: 12, color: scoreBadgeStyle(row.score).color }}>
            {row.score.toFixed(0)}/100
          </div>
        </div>
      </div>
      
      {row.market_cap && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>MARKET CAP</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatINR(row.market_cap)}</div>
        </div>
      )}
      
      {w52Pos && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4 }}>52W RANGE POSITION</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: 'var(--bg-raised)', borderRadius: 2, position: 'relative' }}>
              <div style={{ 
                position: 'absolute', 
                left: `${w52Pos}%`, 
                top: '50%', 
                transform: 'translate(-50%, -50%)',
                width: 8, 
                height: 8, 
                background: 'var(--text-accent)', 
                borderRadius: '50%' 
              }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-accent)' }}>{w52Pos}%</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>₹{row.week_52_low?.toFixed(0)}</span>
            <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>₹{row.week_52_high?.toFixed(0)}</span>
          </div>
        </div>
      )}
      
      <div style={{ 
        padding: '6px 8px', 
        background: 'rgba(200, 255, 0, 0.05)', 
        border: '1px solid var(--border-dim)',
        borderRadius: 3,
        marginBottom: 8
      }}>
        <div style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 2 }}>QUANT SIGNAL</div>
        <div style={{ fontSize: 11, color: verdictColor(row.verdict), fontFamily: 'var(--font-pixel)' }}>
          {row.verdict?.replace("_", " ") ?? "—"}
        </div>
      </div>
      
      <div style={{ 
        fontSize: 9, 
        color: 'var(--text-dim)',
        borderTop: '1px solid var(--border-dim)',
        paddingTop: 8,
      }}>
        Click to view detailed analysis
      </div>
    </div>
  )
}

export function ScreenerPanel({ onSymbolSelect }: { onSymbolSelect?: (s: string) => void }) {
  const [rows, setRows] = useState<ScreenerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("rank")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [filter, setFilter] = useState("")
  const [sectorFilter, setSectorFilter] = useState("")
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("ALL")
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const fetchData = useCallback(async (attempt = 0) => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/screener?t=${Date.now()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (!res.ok) {
        throw new Error(`API returned ${res.status}`)
      }
      
      const data = await res.json()
      const arr: ScreenerRow[] = data.rankings ?? data.rows ?? data ?? []
      
      if (arr.length === 0) {
        throw new Error("Empty response")
      }
      
      const enriched = arr.map(r => ({
        ...r,
        momentum_ic: r.momentum ?? r.momentum_ic ?? 0,
        decile: r.decile ?? Math.ceil((r.score ?? 50) / 10),
        price: r.price ?? 0,
        week_52_high: r.week_52_high ?? r.price ? (r.price ?? 0) * 1.2 : undefined,
        week_52_low: r.week_52_low ?? r.price ? (r.price ?? 0) * 0.8 : undefined,
      }))
      
      setRows(enriched)
    } catch (err) {
      console.error("Screener fetch error:", err)
      if (attempt < 3) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
        return fetchData(attempt + 1)
      } else {
        setError(true)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { 
    fetchData() 
  }, [fetchData])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sectors = Array.from(new Set(rows.map(r => r.sector).filter(Boolean))) as string[]

  const displayed = rows
    .filter(r => {
      if (filter) {
        const q = filter.toUpperCase()
        return r.symbol.includes(q) || (r.label ?? "").toUpperCase().includes(q)
      }
      return true
    })
    .filter(r => sectorFilter ? r.sector === sectorFilter : true)
    .filter(r => {
      if (signalFilter === "ALL") return true
      const v = r.verdict?.toUpperCase() ?? ""
      if (signalFilter === "BUY") return v.includes("BUY")
      if (signalFilter === "HOLD") return v.includes("HOLD")
      if (signalFilter === "SELL") return v.includes("SELL")
      return true
    })
    .sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1
      switch (sortKey) {
        case "rank":       return mul * ((a.rank ?? 999) - (b.rank ?? 999))
        case "score":      return mul * ((b.score ?? 0) - (a.score ?? 0))
        case "change_pct": return mul * ((a.change_pct ?? 0) - (b.change_pct ?? 0))
        case "pe":         return mul * ((a.pe ?? 9999) - (b.pe ?? 9999))
        case "momentum":   return mul * ((b.momentum_ic ?? 0) - (a.momentum_ic ?? 0))
        case "price":      return mul * ((a.price ?? 0) - (b.price ?? 0))
        default:           return 0
      }
    })

  const TH = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => toggleSort(k)}
      style={{
        cursor: "pointer", fontFamily: "var(--font-pixel)", fontSize: 9,
        color: sortKey === k ? "var(--text-accent)" : "var(--text-dim)",
        padding: "6px 8px", textAlign: "right", userSelect: "none",
        borderBottom: "1px solid var(--border-dim)",
      }}
    >
      {label} {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  )

  if (loading) {
    return (
      <div className="screener-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="panel-header"><span className="panel-title" style={{ fontSize: 12 }}>QUANT SCREENER</span></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <span className="pixel-loader" />
          <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            Loading stocks...
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="screener-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="panel-header"><span className="panel-title" style={{ fontSize: 12 }}>QUANT SCREENER</span></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--text-dim)" }}>
          <div style={{ fontSize: 14, color: "var(--signal-sell)" }}>⚠</div>
          <div style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>Failed to load screener data</div>
          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Please check your connection and try again</div>
          <button 
            onClick={() => fetchData()} 
            style={{ 
              fontSize: 11, 
              fontFamily: "var(--font-pixel)", 
              color: "var(--text-primary)", 
              background: "var(--bg-raised)", 
              border: "1px solid var(--border-dim)", 
              padding: "8px 16px", 
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            RETRY
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screener-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="panel-header" style={{ gap: 10, flexWrap: "wrap", padding: "8px 12px" }}>
        <span className="panel-title" style={{ fontSize: 12 }}>QUANT SCREENER</span>
        <div style={{ display: "flex", gap: 6, flex: 1, maxWidth: 600 }}>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search symbol..."
            style={{
              flex: 1, fontFamily: "var(--font-mono)", fontSize: 12, padding: "6px 10px",
              background: "var(--bg-raised)", border: "1px solid var(--border-dim)",
              color: "var(--text-primary)", outline: "none",
            }}
          />
          <select
            value={signalFilter}
            onChange={e => setSignalFilter(e.target.value as SignalFilter)}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 11, padding: "6px 10px",
              background: "var(--bg-raised)", border: "1px solid var(--border-dim)",
              color: "var(--text-secondary)", outline: "none", minWidth: 80,
            }}
          >
            <option value="ALL">ALL</option>
            <option value="BUY">BUY</option>
            <option value="HOLD">HOLD</option>
            <option value="SELL">SELL</option>
          </select>
          {sectors.length > 0 && (
            <select
              value={sectorFilter}
              onChange={e => setSectorFilter(e.target.value)}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11, padding: "6px 10px",
                background: "var(--bg-raised)", border: "1px solid var(--border-dim)",
                color: "var(--text-secondary)", outline: "none",
              }}
            >
              <option value="">All Sectors</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {displayed.length} stocks
        </span>
      </div>

      <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "thin" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--bg-panel)", zIndex: 10 }}>
            <tr>
              <TH k="rank" label="#" />
              <th style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "var(--text-dim)", padding: "6px 8px", borderBottom: "1px solid var(--border-dim)", textAlign: "left" }}>SYMBOL</th>
              <TH k="score" label="SCORE" />
              <TH k="price" label="PRICE" />
              <TH k="change_pct" label="CHG%" />
              <TH k="pe" label="P/E" />
              <TH k="momentum" label="MOM IC" />
              <th style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "var(--text-dim)", padding: "6px 8px", borderBottom: "1px solid var(--border-dim)", textAlign: "center" }}>DECILE</th>
              <th style={{ fontFamily: "var(--font-pixel)", fontSize: 9, color: "var(--text-dim)", padding: "6px 8px", borderBottom: "1px solid var(--border-dim)", textAlign: "right" }}>SIGNAL</th>
            </tr>
          </thead>
          <tbody>
            {displayed.slice(0, 75).map((row, i) => {
              const sym = row.symbol
              const chg = row.change_pct ?? 0
              const chgColor = chg > 0 ? "var(--signal-buy)" : chg < 0 ? "var(--signal-sell)" : "var(--text-dim)"
              const { background: scoreBg, color: scoreColor } = scoreBadgeStyle(row.score)
              const mom = row.momentum_ic ?? 0
              const momColor = mom > 0.2 ? "var(--signal-buy)" : mom < -0.2 ? "var(--signal-sell)" : "var(--text-dim)"
              const isHovered = hoveredRow === sym + i
              
              return (
                <tr
                  key={sym + i}
                  onClick={() => onSymbolSelect?.(sym)}
                  onMouseEnter={() => setHoveredRow(sym + i)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    cursor: onSymbolSelect ? "pointer" : "default",
                    borderBottom: "1px solid var(--border-dim)",
                    background: isHovered ? "var(--bg-hover)" : "transparent",
                    transition: "background 0.15s",
                    position: 'relative',
                  }}
                >
                  {isHovered && onSymbolSelect && (
                    <td colSpan={9} style={{ padding: 0, position: 'absolute', left: 0, top: 0, zIndex: 50 }}>
                      <StockTooltip row={row} />
                    </td>
                  )}
                  <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>{row.rank}</td>
                  <td style={{ padding: "8px 8px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{sym.replace(".NS", "")}</div>
                    {row.sector && <div style={{ fontSize: 9, color: "var(--text-dim)" }}>{row.sector}</div>}
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right" }}>
                    <span style={{ fontSize: 11, padding: "3px 8px", background: scoreBg, color: scoreColor, fontFamily: "var(--font-mono)", borderRadius: 3 }}>
                      {row.score.toFixed(0)}
                    </span>
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
                    ₹{row.price?.toFixed(2) ?? "—"}
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: chgColor }}>
                    {chg > 0 ? "+" : ""}{chg.toFixed(1)}%
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)" }}>
                    {row.pe != null && row.pe > 0 ? row.pe.toFixed(1) : "—"}
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: momColor }}>
                    {mom > 0 ? "+" : ""}{mom.toFixed(2)}
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "center" }}>
                    <DecileBar decile={row.decile} score={row.score} />
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right" }}>
                    <span style={{ fontFamily: "var(--font-pixel)", fontSize: 8, color: verdictColor(row.verdict), padding: "3px 6px", background: "var(--bg-raised)", borderRadius: 2 }}>
                      {row.verdict?.replace("_", " ") ?? "—"}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {displayed.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
            No stocks match your filter criteria
          </div>
        )}
        {displayed.length > 75 && (
          <div style={{ padding: 12, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 10, borderTop: "1px solid var(--border-dim)" }}>
            Showing 75 of {displayed.length} stocks. Use filters to narrow results.
          </div>
        )}
      </div>
    </div>
  )
}
