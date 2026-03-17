"use client"

import { useState, useEffect } from "react"
import dynamic from 'next/dynamic'
import { HeaderStrip } from "@/components/shell/HeaderStrip"
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
        border: '1px solid var(--border-dim)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        fontSize: '11px',
        minHeight: '400px'
      }}>
        Loading chart...
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

export default function Home() {
  const [activeSymbol, setActiveSymbol] = useState("RELIANCE.NS")
  const [layout, setLayout] = useState<"research"|"screener"|"portfolio"|"lab">("research")
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !commandOpen) {
        const target = e.target as HTMLElement
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault()
          setCommandOpen(true)
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [commandOpen])

  return (
    <div className="terminal-root">
      <HeaderStrip onOpenCommand={() => setCommandOpen(true)} />
      <CommandPalette 
        isOpen={commandOpen} 
        onClose={() => setCommandOpen(false)}
        onSymbolSelect={setActiveSymbol}
        onLayoutChange={setLayout}
      />
      
      {layout === "research" && (
        <div className="terminal-grid-research">
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

      {layout === "screener" && <ScreenerPanel />}
      {layout === "portfolio" && <PortfolioPanel />}
    </div>
  )
}
