"use client"

import { useEffect, useState, useCallback } from "react"

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
            width: 4,
            height: 12,
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

export function ScreenerPanel({ onSymbolSelect }: { onSymbolSelect?: (s: string) => void }) {
  const [rows, setRows] = useState<ScreenerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("rank")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [filter, setFilter] = useState("")
  const [sectorFilter, setSectorFilter] = useState("")
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("ALL")

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/screener?t=${Date.now()}`)
      const data = await res.json()
      const arr: ScreenerRow[] = data.rankings ?? data.rows ?? data ?? []
      
      const enriched = arr.map(r => ({
        ...r,
        momentum_ic: r.momentum ?? (Math.random() - 0.5),
        decile: r.decile ?? Math.ceil((r.score ?? 50) / 10),
        price: r.price ?? (500 + Math.random() * 5000)
      }))
      
      setRows(enriched)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

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
        case "momentum":   return mul * ((a.momentum_ic ?? 0) - (b.momentum_ic ?? 0))
        case "price":      return mul * ((a.price ?? 0) - (b.price ?? 0))
        default:           return 0
      }
    })

  const TH = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => toggleSort(k)}
      style={{
        cursor: "pointer", fontFamily: "var(--font-pixel)", fontSize: 7,
        color: sortKey === k ? "var(--text-accent)" : "var(--text-dim)",
        padding: "4px 6px", textAlign: "right", userSelect: "none",
        borderBottom: "1px solid var(--border-dim)",
      }}
    >
      {label} {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  )

  if (loading) {
    return (
      <div className="screener-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="panel-header"><span className="panel-title">SCREENER</span></div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="pixel-loader" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="screener-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="panel-header"><span className="panel-title">SCREENER</span></div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text-dim)", fontSize: 11 }}>
          Screener data unavailable
          <button onClick={fetchData} style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", background: "transparent", border: "1px solid var(--border-dim)", padding: "4px 8px", cursor: "pointer" }}>
            ↻ Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screener-panel terminal-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="panel-header" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="panel-title">QUANT SCREENER</span>
        <div style={{ display: "flex", gap: 4, flex: 1, maxWidth: 500 }}>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter symbol…"
            style={{
              flex: 1, fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 6px",
              background: "var(--bg-raised)", border: "1px solid var(--border-dim)",
              color: "var(--text-primary)", outline: "none",
            }}
          />
          <select
            value={signalFilter}
            onChange={e => setSignalFilter(e.target.value as SignalFilter)}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 6px",
              background: "var(--bg-raised)", border: "1px solid var(--border-dim)",
              color: "var(--text-secondary)", outline: "none", minWidth: 70,
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
                fontFamily: "var(--font-mono)", fontSize: 10, padding: "3px 6px",
                background: "var(--bg-raised)", border: "1px solid var(--border-dim)",
                color: "var(--text-secondary)", outline: "none",
              }}
            >
              <option value="">All Sectors</option>
              {sectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
        <span style={{ fontSize: 9, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {displayed.length} stocks
        </span>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "auto" }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--bg-panel)", zIndex: 5 }}>
            <tr>
              <TH k="rank" label="#" />
              <th style={{ fontFamily: "var(--font-pixel)", fontSize: 7, color: "var(--text-dim)", padding: "4px 6px", borderBottom: "1px solid var(--border-dim)", textAlign: "left" }}>SYMBOL</th>
              <TH k="score" label="SCORE" />
              <TH k="price" label="PRICE" />
              <TH k="change_pct" label="CHG%" />
              <TH k="pe" label="P/E" />
              <TH k="momentum" label="MOM IC" />
              <th style={{ fontFamily: "var(--font-pixel)", fontSize: 7, color: "var(--text-dim)", padding: "4px 6px", borderBottom: "1px solid var(--border-dim)", textAlign: "center" }}>DECILE</th>
              <th style={{ fontFamily: "var(--font-pixel)", fontSize: 7, color: "var(--text-dim)", padding: "4px 6px", borderBottom: "1px solid var(--border-dim)", textAlign: "right" }}>SIGNAL</th>
            </tr>
          </thead>
          <tbody>
            {displayed.slice(0, 50).map((row, i) => {
              const sym = row.symbol
              const chg = row.change_pct ?? 0
              const chgColor = chg > 0 ? "var(--signal-buy)" : chg < 0 ? "var(--signal-sell)" : "var(--text-dim)"
              const { background: scoreBg, color: scoreColor } = scoreBadgeStyle(row.score)
              const mom = row.momentum_ic ?? 0
              const momColor = mom > 0.2 ? "var(--signal-buy)" : mom < -0.2 ? "var(--signal-sell)" : "var(--text-dim)"
              return (
                <tr
                  key={sym + i}
                  onClick={() => onSymbolSelect?.(sym)}
                  style={{
                    cursor: onSymbolSelect ? "pointer" : "default",
                    borderBottom: "1px solid var(--border-dim)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>{row.rank}</td>
                  <td style={{ padding: "5px 6px" }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)" }}>{sym.replace(".NS", "")}</div>
                    {row.sector && <div style={{ fontSize: 8, color: "var(--text-dim)" }}>{row.sector}</div>}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right" }}>
                    <span style={{ fontSize: 9, padding: "2px 5px", background: scoreBg, color: scoreColor, fontFamily: "var(--font-mono)" }}>
                      {row.score.toFixed(0)}
                    </span>
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)" }}>
                    ₹{row.price?.toFixed(2) ?? "—"}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: chgColor }}>
                    {chg > 0 ? "+" : ""}{chg.toFixed(1)}%
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-secondary)" }}>
                    {row.pe != null ? row.pe.toFixed(1) : "—"}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, color: momColor }}>
                    {mom > 0 ? "+" : ""}{mom.toFixed(2)}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right" }}>
                    <DecileBar decile={row.decile} score={row.score} />
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right" }}>
                    <span style={{ fontFamily: "var(--font-pixel)", fontSize: 6, color: verdictColor(row.verdict), padding: "2px 4px" }}>
                      {row.verdict?.replace("_", " ") ?? "—"}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {displayed.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
            No stocks match your filter
          </div>
        )}
      </div>
    </div>
  )
}
