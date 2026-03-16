"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { UserButton } from "@clerk/nextjs"
import { getMarketStatuses } from "@/lib/market-hours"

type Props = {
  onOpenCommand: () => void
}

function marketSessionNow() {
  const now = new Date()
  const ist = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata"
  }).format(now)
  return { ist }
}

export function HeaderStrip({ onOpenCommand }: Props) {
  const { user, isLoaded } = useUser()
  const [clock, setClock] = useState(() => marketSessionNow())

  useEffect(() => {
    const t = setInterval(() => setClock(marketSessionNow()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="wm-header-strip">
      <div className="wm-header-left">
        <span className="wm-brand">QUANTORACLE</span>
        <span className="wm-sep">|</span>
        <span className="wm-mono">IST {clock.ist}</span>
        {getMarketStatuses().map(m => (
          <span key={m.name} style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: '7px',
            padding: '2px 6px',
            marginRight: '4px',
            color: m.color,
            boxShadow: `1px 0 0 ${m.color}, -1px 0 0 ${m.color}, 0 1px 0 ${m.color}, 0 -1px 0 ${m.color}`,
          }}>
            {m.name} {m.status}
          </span>
        ))}
        <div className="search-bar" onClick={onOpenCommand}>
          <span className="search-bar-icon">⌘</span>
          <span className="search-bar-text">Search symbol or command...</span>
          <span className="search-bar-shortcut">/</span>
        </div>
      </div>

      <div className="wm-header-right">
        {isLoaded && user ? (
          <UserButton afterSignOutUrl="/sign-in" />
        ) : isLoaded ? (
          <a href="/sign-in" className="wm-header-btn">Sign In</a>
        ) : null}
      </div>
    </header>
  )
}
