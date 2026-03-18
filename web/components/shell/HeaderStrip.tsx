"use client"

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { UserButton } from "@clerk/nextjs"
import { getMarketStatuses, MarketStatus } from "@/lib/market-hours"
import { AI_SETTINGS_UPDATED_EVENT, loadAISettings } from "@/lib/client/aiSettings"

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
  const [markets, setMarkets] = useState<MarketStatus[]>([])
  const [aiStatus, setAiStatus] = useState("AI AUTO")
  const [aiStatusClass, setAiStatusClass] = useState<"ok" | "warn" | "dim">("dim")

  useEffect(() => {
    const t = setInterval(() => setClock(marketSessionNow()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    setMarkets(getMarketStatuses())
    const interval = setInterval(() => setMarkets(getMarketStatuses()), 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let active = true

    const syncAIStatus = async () => {
      const settings = await loadAISettings()
      if (!active) return

      const model = settings.model || "default"
      const provider = settings.provider.toUpperCase()
      const hasCloudKey = Boolean(settings.encryptedApiKey && settings.apiKeyIv)
      const fallbackTag = settings.fallbackToOllama ? " +OL" : ""

      setAiStatus(`AI ${provider}:${model}${fallbackTag}`)
      if (hasCloudKey) {
        setAiStatusClass("ok")
      } else if (settings.fallbackToOllama) {
        setAiStatusClass("warn")
      } else {
        setAiStatusClass("dim")
      }
    }

    void syncAIStatus()

    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== "quantoracle.ai.settings.v1") return
      void syncAIStatus()
    }

    const onLocalUpdate = () => {
      void syncAIStatus()
    }

    window.addEventListener("storage", onStorage)
    window.addEventListener(AI_SETTINGS_UPDATED_EVENT, onLocalUpdate)
    return () => {
      active = false
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(AI_SETTINGS_UPDATED_EVENT, onLocalUpdate)
    }
  }, [])

  return (
    <header className="wm-header-strip">
      <div className="wm-header-left">
        <span className="wm-brand">QUANTORACLE</span>
        <span className="wm-sep">|</span>
        <span className="wm-mono">IST {clock.ist}</span>
        {markets.map(m => (
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
        <span className={`wm-indicator ${aiStatusClass}`}>{aiStatus}</span>
        {isLoaded && user ? (
          <UserButton afterSignOutUrl="/sign-in" />
        ) : isLoaded ? (
          <a href="/sign-in" className="wm-header-btn">Sign In</a>
        ) : null}
      </div>
    </header>
  )
}
