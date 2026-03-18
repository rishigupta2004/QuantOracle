"use client"

import { useEffect, useMemo, useState } from "react"

type Props = {
  isOpen: boolean
  onClose: () => void
  onSymbolSelect?: (symbol: string) => void
  onLayoutChange?: (layout: "research" | "screener" | "portfolio" | "lab" | "pulse") => void
}

const NIFTY50_SYMBOLS = [
  "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS", "HINDUNILVR.NS",
  "ITC.NS", "SBIN.NS", "BHARTIARTL.NS", "KOTAKBANK.NS", "LT.NS", "AXISBANK.NS",
  "ASIANPAINT.NS", "MARUTI.NS", "TITAN.NS", "SUNPHARMA.NS", "NESTLEIND.NS", "BAJFINANCE.NS",
  "HCLTECH.NS", "WIPRO.NS", "TECHM.NS", "ADANIPORTS.NS", "POWERGRID.NS", "NTPC.NS",
  "ONGC.NS", "COALINDIA.NS", "GRASIM.NS", "TATASTEEL.NS", "JSWSTEEL.NS", "INDUSINDBK.NS",
  "CIPLA.NS", "DRREDDY.NS", "DIVISLAB.NS", "APOLLOHOSP.NS", "ADANIENT.NS", "TATAMOTORS.NS",
  "BPCL.NS", "EICHERMOT.NS", "HAVELLS.NS", "VEDL.NS", "SHREECEM.NS", "PASSIONWAVE.NS",
  "M&M.NS", "ULTRACEMCO.NS", "SBILIFE.NS", "ICICIPRULI.NS", "SIEMENS.NS", "HEROMOTOCO.NS",
  // Additional symbols for better search
  "YESBANK.NS", "TATAINVEST.NS", "COFORGE.NS", "PERSISTENT.NS", "LTI.NS", "MINDTREE.NS",
  "MPHASIS.NS", "JUSTDIAL.NS", "SUZLON.NS", "RPOWER.NS", "JUNIORBEES.NS", "GOLDBEES.NS",
]

const COMMANDS = [
  { id: "layout-screener", label: "Switch to Screener", keywords: ["screener", "filter", "scan"], action: () => {} },
  { id: "layout-portfolio", label: "Switch to Portfolio", keywords: ["portfolio", "track", "positions"], action: () => {} },
  { id: "layout-pulse", label: "Switch to Pulse View", keywords: ["pulse", "market", "dashboard", "bloomberg"], action: () => {} },
  { id: "add-watchlist", label: "Add Symbol to Watchlist", keywords: ["add", "watchlist", "favorite"], action: () => {} },
]

const KEYBOARD_SHORTCUTS = [
  { keys: ["/"], action: "Open command palette" },
  { keys: ["Esc"], action: "Close dialogs" },
  { keys: ["↑", "↓"], action: "Navigate results" },
  { keys: ["Enter"], action: "Select result" },
]

export function CommandPalette({ isOpen, onClose, onSymbolSelect, onLayoutChange }: Props) {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const [searchResults, setSearchResults] = useState<string[]>([])

  const filteredSymbols = useMemo(() => {
    const q = query.trim().toUpperCase()
    if (!q) return NIFTY50_SYMBOLS.slice(0, 10)
    return NIFTY50_SYMBOLS.filter(s => s.includes(q)).slice(0, 10)
  }, [query])

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter(cmd => {
      if (cmd.label.toLowerCase().includes(q)) return true
      return cmd.keywords.some(k => k.includes(q))
    })
  }, [query])

  const allResults = useMemo(() => {
    const results: { type: "symbol" | "command" | "search"; id: string; label: string; data?: unknown }[] = []
    
    filteredSymbols.forEach(symbol => {
      results.push({ type: "symbol", id: symbol, label: symbol })
    })
    
    filteredCommands.forEach(cmd => {
      results.push({ type: "command", id: cmd.id, label: cmd.label, data: cmd.action })
    })
    
    if (query.trim().length > 0) {
      const exactMatch = filteredSymbols.find(s => s === query.trim().toUpperCase())
      if (!exactMatch && query.length >= 2) {
        results.push({ 
          type: "search", 
          id: "search-nse", 
          label: `Search NSE: ${query.trim()}`,
          data: query.trim().toUpperCase()
        })
      }
    }
    
    return results
  }, [filteredSymbols, filteredCommands, query])

  useEffect(() => {
    if (!isOpen) {
      setQuery("")
      setSelected(0)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelected(prev => Math.min(prev + 1, Math.max(0, allResults.length - 1)))
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelected(prev => Math.max(0, prev - 1))
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        const item = allResults[selected]
        if (item) {
          handleSelect(item)
        }
      }
      if (e.key === "?") {
        e.preventDefault()
        setShowHelp(prev => !prev)
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, allResults, selected, onClose])

  const handleSelect = async (item: { type: "symbol" | "command" | "search"; id: string; label: string; data?: unknown }) => {
    if (item.type === "symbol") {
      onSymbolSelect?.(item.id)
    } else if (item.type === "command") {
      if (item.id === "layout-screener") onLayoutChange?.("screener")
      else if (item.id === "layout-portfolio") onLayoutChange?.("portfolio")
      else if (item.id === "layout-pulse") onLayoutChange?.("pulse")
    } else if (item.type === "search") {
      const symbol = item.data as string
      const fullSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`
      
      // Verify the symbol exists before loading
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(fullSymbol)}`)
        const data = await res.json()
        const quote = data.quotes?.[fullSymbol]
        
        if (quote?.price) {
          onSymbolSelect?.(fullSymbol)
        } else {
          // Try without .NS suffix (for US stocks)
          onSymbolSelect?.(symbol)
        }
      } catch {
        // Just try to load it anyway
        onSymbolSelect?.(fullSymbol)
      }
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="wm-command-overlay" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="wm-command-card">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          placeholder="Type symbol or command... (? for shortcuts)"
          className="wm-command-input"
        />
        {showHelp ? (
          <div className="wm-command-help">
            <div className="wm-command-help-title">Keyboard Shortcuts</div>
            {KEYBOARD_SHORTCUTS.map((shortcut, idx) => (
              <div key={idx} className="wm-command-help-row">
                <span className="wm-command-help-keys">
                  {shortcut.keys.map((k, i) => (
                    <kbd key={i}>{k}</kbd>
                  ))}
                </span>
                <span className="wm-command-help-action">{shortcut.action}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="wm-command-list">
            {allResults.length > 0 ? (
              allResults.slice(0, 12).map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  className={`wm-command-item ${idx === selected ? "active" : ""}`}
                  onMouseEnter={() => setSelected(idx)}
                  onClick={() => handleSelect(item)}
                >
                  <span>
                    {item.type === "symbol" && "📈 "}
                    {item.type === "command" && "⌘ "}
                    {item.type === "search" && "🔍 "}
                    {item.label}
                  </span>
                  {item.type === "symbol" && <span className="wm-command-hint">NSE</span>}
                </button>
              ))
            ) : (
              <div className="wm-command-empty">No results found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
