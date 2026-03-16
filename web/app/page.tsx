"use client"

import { useState, useEffect } from "react"
import { HeaderStrip } from "@/components/shell/HeaderStrip"
import { CommandPalette } from "@/components/command/CommandPalette"
import { WatchlistPanel } from "@/components/watchlist/Watchlist"
import { SignalsPanel } from "@/components/signals/SignalsPanel"
import { ChartPanel } from "@/components/charts/ChartPanel"
import { ScreenerPanel } from "@/components/screener/ScreenerPanel"
import { MacroCalendar } from "@/components/macro/MacroCalendar"
import { GeoNewsPanel } from "@/components/news/GeoNewsPanel"
import { PortfolioPanel } from "@/components/portfolio/PortfolioPanel"

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
