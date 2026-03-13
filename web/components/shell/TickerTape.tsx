"use client"

import type { Quote } from "@/lib/client/types"

type Props = {
  quotes: Record<string, Quote>
}

function itemText(q: Quote): string {
  if (!q.available || q.price <= 0) {
    return `${q.symbol} N/A`
  }
  const pct = `${q.change_pct >= 0 ? "+" : ""}${q.change_pct.toFixed(2)}%`
  return `${q.symbol} ${q.price.toFixed(2)} ${pct}`
}

export function TickerTape({ quotes }: Props) {
  const entries = Object.values(quotes)
  const text = (entries.length > 0 ? entries : [{ symbol: "DATA", price: 0, change_pct: 0, volume: 0, source: "none", available: false, stale: true }])
    .map(itemText)
    .join("  |  ")

  return (
    <div className="wm-ticker" aria-label="Live ticker tape">
      <div className="wm-ticker-track">
        <span>{text}</span>
        <span>{text}</span>
      </div>
    </div>
  )
}
