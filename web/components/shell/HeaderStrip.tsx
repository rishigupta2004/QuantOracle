"use client"

import { useEffect, useState } from "react"

import { planBadgeColor, type Plan } from "@/lib/billing"
import type { StatusResponse } from "@/lib/client/types"
import type { LayoutPreset, LayoutSlot } from "@/lib/client/useShellState"

type Props = {
  workspaceId: string
  plan: Plan
  status: StatusResponse | null
  density: "compact" | "comfortable"
  layoutPreset: LayoutPreset
  slotAvailability: Record<LayoutSlot, boolean>
  slotSavedAt: Record<LayoutSlot, string | null>
  lastSlotAction: string
  isTabVisible: boolean
  onToggleDensity: () => void
  onCycleLayout: () => void
  onLoadSlot: (slot: LayoutSlot) => void
  onSaveSlot: (slot: LayoutSlot) => void
  onToggleLeft: () => void
  onToggleRight: () => void
  onOpenUpgrade: () => void
  onOpenCommand: () => void
  onRefresh: () => void
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
  const utc = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(now)
  return { ist, utc }
}

function ageLabel(iso: string | null | undefined): string {
  if (!iso) {
    return "n/a"
  }
  const ts = new Date(iso).valueOf()
  if (!Number.isFinite(ts)) {
    return "n/a"
  }
  const mins = Math.max(0, Math.floor((Date.now() - ts) / 60_000))
  if (mins < 1) {
    return "<1m"
  }
  if (mins < 60) {
    return `${mins}m`
  }
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return `${hrs}h ${rem}m`
}

export function HeaderStrip({
  workspaceId,
  plan,
  status,
  density,
  layoutPreset,
  slotAvailability,
  slotSavedAt,
  lastSlotAction,
  isTabVisible,
  onToggleDensity,
  onCycleLayout,
  onLoadSlot,
  onSaveSlot,
  onToggleLeft,
  onToggleRight,
  onOpenUpgrade,
  onOpenCommand,
  onRefresh
}: Props) {
  const [clock, setClock] = useState(() => marketSessionNow())

  useEffect(() => {
    const t = setInterval(() => setClock(marketSessionNow()), 1000)
    return () => clearInterval(t)
  }, [])

  const readiness = status?.readiness
  const quoteAge = ageLabel(status?.probe?.quotes.as_of_utc)
  const quoteRuntime = status?.probe?.quotes.runtime_ms
  const quoteCache = status?.probe?.quotes.cache_hit

  return (
    <header className="wm-header-strip">
      <div className="wm-header-left">
        <span className="wm-brand" style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px' }}>QUANTORACLE</span>
        <span className="wm-sep">|</span>
        <span className="wm-mono">WS: {workspaceId}</span>
        <span className={`wm-plan-pill ${planBadgeColor(plan)}`}>{plan.toUpperCase()}</span>
        <span className={`wm-indicator ${readiness?.india_live_ready ? "ok" : "warn"}`}>
          <span className={readiness?.india_live_ready ? "status-live" : "status-closed"} style={{ display: 'inline-block', width: '6px', height: '6px', marginRight: '4px' }} />
          INDIA {readiness?.india_live_ready ? "LIVE" : "PENDING"}
        </span>
        <span className={`wm-indicator ${readiness?.global_live_ready ? "ok" : "warn"}`}>
          <span className={readiness?.global_live_ready ? "status-live" : "status-closed"} style={{ display: 'inline-block', width: '6px', height: '6px', marginRight: '4px' }} />
          GLOBAL {readiness?.global_live_ready ? "LIVE" : "LIMITED"}
        </span>
        <span className={`wm-indicator ${readiness?.news_intel_fresh ? "ok" : "warn"}`}>
          NEWS {readiness?.news_intel_fresh ? "FRESH" : "STALE"}
        </span>
      </div>

      <div className="wm-header-right">
        <button type="button" className="wm-header-btn wm-header-btn-primary" onClick={onRefresh} title="Refresh all data">
          ↻
        </button>
        <span className={`wm-indicator ${isTabVisible ? "ok" : "dim"}`}>
          {isTabVisible ? "ACTIVE" : "BG"}
        </span>
        <span className="wm-mono">Q AGE {quoteAge}</span>
        <span className="wm-mono">Q RT {quoteRuntime ?? "-"}ms</span>
        <span className={`wm-indicator ${quoteCache ? "ok" : "warn"}`}>Q {quoteCache ? "CACHE" : "LIVE"}</span>
        <span className="wm-mono">IST {clock.ist}</span>
        <span className="wm-mono">UTC {clock.utc}</span>
        <button type="button" className="wm-header-btn" onClick={onToggleLeft}>
          LEFT
        </button>
        <button type="button" className="wm-header-btn" onClick={onToggleRight}>
          RIGHT
        </button>
        <button type="button" className="wm-header-btn" onClick={onToggleDensity}>
          {density === "compact" ? "DENSE" : "COMFY"}
        </button>
        <button type="button" className="wm-header-btn" onClick={onCycleLayout}>
          LAYOUT {layoutPreset.toUpperCase()}
        </button>
        {(["1", "2", "3"] as LayoutSlot[]).map((slot) => (
          <button
            key={`load-${slot}`}
            type="button"
            className={`wm-header-btn ${slotAvailability[slot] ? "" : "disabled"}`}
            onClick={() => onLoadSlot(slot)}
            title={
              slotAvailability[slot]
                ? `Load layout slot ${slot} (saved ${slotSavedAt[slot] ?? "unknown"})`
                : `Slot ${slot} is empty`
            }
          >
            L{slot}{slotAvailability[slot] ? "*" : ""}
          </button>
        ))}
        {(["1", "2", "3"] as LayoutSlot[]).map((slot) => (
          <button
            key={`save-${slot}`}
            type="button"
            className="wm-header-btn"
            onClick={() => onSaveSlot(slot)}
            title={`Save current layout to slot ${slot}`}
          >
            S{slot}
          </button>
        ))}
        <button type="button" className="wm-header-btn" onClick={onRefresh}>
          REFRESH
        </button>
        <button type="button" className="wm-header-btn" onClick={onOpenUpgrade}>
          UPGRADE
        </button>
        <button type="button" className="wm-header-btn strong" onClick={onOpenCommand}>
          /
        </button>
        {lastSlotAction ? <span className="wm-mono">{lastSlotAction}</span> : null}
      </div>
    </header>
  )
}
