"use client"

import { useState, useEffect } from "react"
import dynamic from 'next/dynamic'
import { HeaderStrip } from "@/components/shell/HeaderStrip"
import { TickerStrip } from "@/components/shell/TickerStrip"
import { CommandPalette } from "@/components/command/CommandPalette"
import { WatchlistPanel } from "@/components/watchlist/Watchlist"

// Dynamic imports for heavy components - client-side only
const ChartPanel = dynamic(
  () => import('@/components/charts/ChartPanel').then(m => ({ default: m.ChartPanel })),
  {
    ssr: false,
    loading: () => (
      <div style={{
        background: 'var(--bg-panel)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-dim)', fontSize: '11px', height: '100%',
      }}>
        <span className="pixel-loader" />
      </div>
    )
  }
)

const SignalsPanel = dynamic(
  () => import('@/components/signals/SignalsPanel').then(m => ({ default: m.SignalsPanel })),
  { ssr: false }
)

const ScreenerPanel = dynamic(
  () => import('@/components/screener/ScreenerPanel').then(m => ({ default: m.ScreenerPanel })),
  { ssr: false }
)

const MacroCalendar = dynamic(
  () => import('@/components/macro/MacroCalendar').then(m => ({ default: m.MacroCalendar })),
  { ssr: false }
)

const GeoNewsPanel = dynamic(
  () => import('@/components/news/GeoNewsPanel').then(m => ({ default: m.GeoNewsPanel })),
  { ssr: false }
)

const PortfolioPanel = dynamic(
  () => import('@/components/portfolio/PortfolioPanel').then(m => ({ default: m.PortfolioPanel })),
  { ssr: false }
)

const PulseView = dynamic(
  () => import('@/components/pulse/PulseView').then(m => ({ default: m.PulseView })),
  { 
    ssr: false,
    loading: () => (
      <div style={{
        background: 'var(--bg-panel)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-dim)', fontSize: '11px', height: '100%',
      }}>
        <span className="pixel-loader" />
      </div>
    )
  }
)

export default function Home() {
  const [activeSymbol, setActiveSymbol] = useState("RELIANCE.NS")
  const [layout, setLayout] = useState<"research"|"screener"|"portfolio"|"lab"|"pulse">("research")
  const [commandOpen, setCommandOpen] = useState(false)

  // Select symbol and always switch to chart view
  const selectSymbol = (sym: string) => {
    setActiveSymbol(sym)
    setLayout("research")
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return

      // Open command palette
      if (e.key === "/" && !commandOpen) {
        e.preventDefault()
        setCommandOpen(true)
        return
      }
      if (commandOpen) return

      // Layout shortcuts: H=research, P=portfolio, S=screener, L=lab, U=pulse
      if (e.key === "h" || e.key === "H") setLayout("research")
      if (e.key === "p" || e.key === "P") setLayout("portfolio")
      if (e.key === "s" || e.key === "S") setLayout("screener")
      if (e.key === "l" || e.key === "L") setLayout("lab")
      if (e.key === "u" || e.key === "U") setLayout("pulse")
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [commandOpen])

  return (
    <div className="terminal-root">
      <HeaderStrip onOpenCommand={() => setCommandOpen(true)} />
      <TickerStrip />
      <CommandPalette
        isOpen={commandOpen}
        onClose={() => setCommandOpen(false)}
        onSymbolSelect={selectSymbol}
        onLayoutChange={setLayout}
      />

      {layout === "research" && (
        <div className="terminal-grid-research" style={{ flex: 1, overflow: "hidden" }}>
          <WatchlistPanel
            onSelectSymbol={setActiveSymbol}
            activeSymbol={activeSymbol}
          />
          <ChartPanel symbol={activeSymbol} />
          <SignalsPanel symbol={activeSymbol} />
          <div className="terminal-bottom-bar">
            <MacroCalendar />
            <GeoNewsPanel />
          </div>
        </div>
      )}

      {layout === "screener" && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <ScreenerPanel onSymbolSelect={selectSymbol} />
        </div>
      )}

      {layout === "portfolio" && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <PortfolioPanel onSymbolSelect={selectSymbol} />
        </div>
      )}

      {layout === "lab" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <span style={{ fontFamily: "var(--font-pixel)", fontSize: 10, color: "var(--text-accent)" }}>QUANT LAB</span>
          <a href="/lab" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", textDecoration: "underline" }}>Open Quant Lab →</a>
        </div>
      )}

      {layout === "pulse" && (
        <PulseView />
      )}
    </div>
  )
}
