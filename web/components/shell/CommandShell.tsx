"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent
} from "react"

import { planSatisfies, type Plan } from "@/lib/billing"
import { buildCommandIndex } from "@/lib/client/commandIndex"
import type {
  MacroResponse,
  NewsItem,
  QuotesResponse,
  StatusResponse,
  UsagePayload
} from "@/lib/client/types"
import type {
  DensityMode,
  GridPanel,
  LayoutPreset,
  LayoutSnapshot,
  LayoutSlot,
  PanelFocus
} from "@/lib/client/useShellState"
import { CommandPalette } from "@/components/command/CommandPalette"
import { HeaderStrip } from "@/components/shell/HeaderStrip"
import { MapStage } from "@/components/shell/MapStage"
import { SideDrawer } from "@/components/shell/SideDrawer"
import { TickerTape } from "@/components/shell/TickerTape"

type Props = {
  workspaceId: string
  watchlist: string[]
  usage: UsagePayload | null
  quotes: QuotesResponse | null
  macro: MacroResponse | null
  news: NewsItem[]
  status: StatusResponse | null
  errors: string[]
  isLoading: boolean
  refreshAll: () => void
  isTabVisible: boolean
  leftOpen: boolean
  rightOpen: boolean
  commandOpen: boolean
  upgradeOpen: boolean
  activeSymbol: string
  density: DensityMode
  activePanel: PanelFocus
  layoutPreset: LayoutPreset
  panelOrder: GridPanel[]
  layoutSlots: Record<LayoutSlot, LayoutSnapshot | null>
  leftWidth: number
  rightWidth: number
  setLeftOpen: (open: boolean) => void
  setRightOpen: (open: boolean) => void
  setCommandOpen: (open: boolean) => void
  setUpgradeOpen: (open: boolean) => void
  setActiveSymbol: (symbol: string) => void
  setDensity: (mode: DensityMode) => void
  setActivePanel: (panel: PanelFocus) => void
  setLayoutPreset: (preset: LayoutPreset) => void
  setPanelOrder: (items: GridPanel[]) => void
  resetPanelOrder: () => void
  saveLayoutSlot: (slot: LayoutSlot) => void
  loadLayoutSlot: (slot: LayoutSlot) => boolean
  resetLayoutSlots: () => void
  setLeftWidth: (width: number) => void
  setRightWidth: (width: number) => void
}

const PLAN_FEATURES: Array<{ id: string; required: Plan; label: string }> = [
  { id: "risk_analytics", required: "pro", label: "Risk Analytics" },
  { id: "portfolio_rebalance", required: "pro", label: "Portfolio Rebalance" },
  { id: "ml_models", required: "terminal", label: "ML Models" },
  { id: "intraday_terminal", required: "terminal", label: "Intraday Terminal" }
]

const LEFT_DEFAULT = 260
const RIGHT_DEFAULT = 310

function cycleLayoutPreset(current: LayoutPreset): LayoutPreset {
  if (current === "atlas") {
    return "focus"
  }
  if (current === "focus") {
    return "stack"
  }
  return "atlas"
}

function reorderPanels(items: GridPanel[], from: GridPanel, to: GridPanel): GridPanel[] {
  if (from === to) {
    return items
  }
  const fromIndex = items.indexOf(from)
  const toIndex = items.indexOf(to)
  if (fromIndex < 0 || toIndex < 0) {
    return items
  }
  const next = [...items]
  next.splice(fromIndex, 1)
  next.splice(toIndex, 0, from)
  return next
}

function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) {
    return "-"
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  })
}

function tierLabel(tier?: NewsItem["source_tier"]): string {
  if (tier === "official") {
    return "official"
  }
  if (tier === "wire") {
    return "wire"
  }
  if (tier === "media") {
    return "media"
  }
  return "source"
}

export function CommandShell({
  workspaceId,
  watchlist,
  usage,
  quotes,
  macro,
  news,
  status,
  errors,
  isLoading,
  refreshAll,
  isTabVisible,
  leftOpen,
  rightOpen,
  commandOpen,
  upgradeOpen,
  activeSymbol,
  density,
  activePanel,
  layoutPreset,
  panelOrder,
  layoutSlots,
  leftWidth,
  rightWidth,
  setLeftOpen,
  setRightOpen,
  setCommandOpen,
  setUpgradeOpen,
  setActiveSymbol,
  setDensity,
  setActivePanel,
  setLayoutPreset,
  setPanelOrder,
  resetPanelOrder,
  saveLayoutSlot,
  loadLayoutSlot,
  resetLayoutSlots,
  setLeftWidth,
  setRightWidth
}: Props) {
  const activePlan: Plan = usage?.plan ?? "starter"
  const quoteMap = quotes?.quotes ?? {}
  const quoteRows = Object.values(quoteMap)
  const usageMeters = (usage?.meters ?? []).slice(0, 4)
  const slotAvailability: Record<LayoutSlot, boolean> = useMemo(
    () => ({
      "1": Boolean(layoutSlots["1"]),
      "2": Boolean(layoutSlots["2"]),
      "3": Boolean(layoutSlots["3"])
    }),
    [layoutSlots]
  )
  const slotSavedAt: Record<LayoutSlot, string | null> = useMemo(
    () => ({
      "1": layoutSlots["1"]?.savedAt ?? null,
      "2": layoutSlots["2"]?.savedAt ?? null,
      "3": layoutSlots["3"]?.savedAt ?? null
    }),
    [layoutSlots]
  )
  const dragRef = useRef<{ side: "left" | "right"; startX: number; startWidth: number } | null>(
    null
  )
  const [draggingPanel, setDraggingPanel] = useState<GridPanel | null>(null)
  const [dropTargetPanel, setDropTargetPanel] = useState<GridPanel | null>(null)
  const [slotNotice, setSlotNotice] = useState("")

  const bodyStyle: CSSProperties = {
    ["--wm-left-width" as string]: `${leftOpen ? leftWidth : 0}px`,
    ["--wm-right-width" as string]: `${rightOpen ? rightWidth : 0}px`
  }

  const resetLayout = useCallback(() => {
    setLeftOpen(true)
    setRightOpen(true)
    setLeftWidth(LEFT_DEFAULT)
    setRightWidth(RIGHT_DEFAULT)
    setLayoutPreset("atlas")
    resetPanelOrder()
    resetLayoutSlots()
    setActivePanel("map")
    setSlotNotice("layout reset")
  }, [
    setLayoutPreset,
    resetPanelOrder,
    resetLayoutSlots,
    setActivePanel,
    setLeftOpen,
    setRightOpen,
    setLeftWidth,
    setRightWidth
  ])

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) {
        return
      }
      const delta = event.clientX - drag.startX
      if (drag.side === "left") {
        setLeftWidth(drag.startWidth + delta)
      } else {
        setRightWidth(drag.startWidth - delta)
      }
    },
    [setLeftWidth, setRightWidth]
  )

  const stopResize = useCallback(() => {
    dragRef.current = null
    window.removeEventListener("pointermove", onPointerMove)
    window.removeEventListener("pointerup", stopResize)
  }, [onPointerMove])

  const startResize = useCallback(
    (side: "left" | "right", event: ReactPointerEvent<HTMLDivElement>) => {
      if (window.matchMedia("(max-width: 1180px)").matches) {
        return
      }
      dragRef.current = {
        side,
        startX: event.clientX,
        startWidth: side === "left" ? leftWidth : rightWidth
      }
      window.addEventListener("pointermove", onPointerMove)
      window.addEventListener("pointerup", stopResize)
    },
    [leftWidth, rightWidth, onPointerMove, stopResize]
  )

  const onPanelDragStart = useCallback((panel: GridPanel) => {
    setDraggingPanel(panel)
    setDropTargetPanel(panel)
  }, [])

  const onPanelDragOver = useCallback((event: ReactDragEvent<HTMLElement>, target: GridPanel) => {
    event.preventDefault()
    if (dropTargetPanel !== target) {
      setDropTargetPanel(target)
    }
  }, [dropTargetPanel])

  const onPanelDrop = useCallback(
    (target: GridPanel) => {
      if (!draggingPanel) {
        return
      }
      setPanelOrder(reorderPanels(panelOrder, draggingPanel, target))
      setActivePanel(target)
      setDraggingPanel(null)
      setDropTargetPanel(null)
    },
    [draggingPanel, panelOrder, setPanelOrder, setActivePanel]
  )

  const onPanelDragEnd = useCallback(() => {
    setDraggingPanel(null)
    setDropTargetPanel(null)
  }, [])

  const handleSaveSlot = useCallback(
    (slot: LayoutSlot) => {
      saveLayoutSlot(slot)
      setSlotNotice(`saved slot ${slot}`)
    },
    [saveLayoutSlot]
  )

  const handleLoadSlot = useCallback(
    (slot: LayoutSlot) => {
      const ok = loadLayoutSlot(slot)
      setSlotNotice(ok ? `loaded slot ${slot}` : `slot ${slot} empty`)
    },
    [loadLayoutSlot]
  )

  const handleResetSlots = useCallback(() => {
    resetLayoutSlots()
    setSlotNotice("cleared slots")
  }, [resetLayoutSlots])

  const commands = useMemo(
    () =>
      buildCommandIndex({
        symbols: watchlist,
        activeSymbol,
        setActiveSymbol,
        leftOpen,
        rightOpen,
        setLeftOpen,
        setRightOpen,
        density,
        setDensity,
        layoutPreset,
        setLayoutPreset,
        slotAvailability,
        saveLayoutSlot: handleSaveSlot,
        loadLayoutSlot: (slot) => {
          handleLoadSlot(slot)
          return Boolean(layoutSlots[slot])
        },
        resetLayoutSlots: handleResetSlots,
        setActivePanel,
        resetLayout,
        openUpgrade: () => setUpgradeOpen(true),
        refreshAll
      }),
    [
      watchlist,
      activeSymbol,
      setActiveSymbol,
      leftOpen,
      rightOpen,
      setLeftOpen,
      setRightOpen,
      density,
      setDensity,
      layoutPreset,
      setLayoutPreset,
      slotAvailability,
      handleSaveSlot,
      handleLoadSlot,
      handleResetSlots,
      layoutSlots,
      setActivePanel,
      resetLayout,
      setUpgradeOpen,
      refreshAll
    ]
  )

  useEffect(() => {
    return () => {
      stopResize()
    }
  }, [stopResize])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setCommandOpen(true)
        return
      }
      if (e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault()
        setLeftOpen(!leftOpen)
        return
      }
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault()
        setRightOpen(!rightOpen)
        return
      }
      if (e.altKey && e.key === "1") {
        e.preventDefault()
        setActivePanel("map")
        return
      }
      if (e.altKey && e.key === "2") {
        e.preventDefault()
        setActivePanel("quotes")
        return
      }
      if (e.altKey && e.key === "3") {
        e.preventDefault()
        setActivePanel("news")
        return
      }
      if (e.altKey && e.key === "4") {
        e.preventDefault()
        setActivePanel("macro")
        return
      }
      if (e.altKey && e.key === "5") {
        e.preventDefault()
        setActivePanel("entitlements")
        return
      }
      if (e.altKey && e.key === "6") {
        e.preventDefault()
        setLayoutPreset("atlas")
        return
      }
      if (e.altKey && e.key === "7") {
        e.preventDefault()
        setLayoutPreset("focus")
        return
      }
      if (e.altKey && e.key === "8") {
        e.preventDefault()
        setLayoutPreset("stack")
        return
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "q") {
        e.preventDefault()
        handleSaveSlot("1")
        return
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "w") {
        e.preventDefault()
        handleSaveSlot("2")
        return
      }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault()
        handleSaveSlot("3")
        return
      }
      if (e.altKey && e.key.toLowerCase() === "q") {
        e.preventDefault()
        handleLoadSlot("1")
        return
      }
      if (e.altKey && e.key.toLowerCase() === "w") {
        e.preventDefault()
        handleLoadSlot("2")
        return
      }
      if (e.altKey && e.key.toLowerCase() === "e") {
        e.preventDefault()
        handleLoadSlot("3")
        return
      }
      if (e.altKey && e.shiftKey && e.key === "0") {
        e.preventDefault()
        handleResetSlots()
        return
      }
      if (e.altKey && e.key === "0") {
        e.preventDefault()
        resetLayout()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    leftOpen,
    rightOpen,
    setCommandOpen,
    setLeftOpen,
    setRightOpen,
    setActivePanel,
    setLayoutPreset,
    handleLoadSlot,
    handleSaveSlot,
    handleResetSlots,
    resetLayout
  ])

  useEffect(() => {
    if (!slotNotice) {
      return
    }
    const t = window.setTimeout(() => setSlotNotice(""), 1800)
    return () => window.clearTimeout(t)
  }, [slotNotice])

  const renderGridPanel = (panel: GridPanel) => {
    const isActive = activePanel === panel
    const isDragging = draggingPanel === panel
    const isDropTarget = dropTargetPanel === panel
    const className = [
      "panel",
      "wm-panel",
      isActive ? "active-pane" : "",
      isDragging ? "dragging" : "",
      isDropTarget && draggingPanel && draggingPanel !== panel ? "drop-target" : ""
    ]
      .filter(Boolean)
      .join(" ")

    const common = {
      key: panel,
      className,
      draggable: true,
      onClick: () => setActivePanel(panel),
      onDragStart: (event: ReactDragEvent<HTMLElement>) => {
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", panel)
        onPanelDragStart(panel)
      },
      onDragOver: (event: ReactDragEvent<HTMLElement>) => onPanelDragOver(event, panel),
      onDrop: () => onPanelDrop(panel),
      onDragEnd: onPanelDragEnd
    }

    if (panel === "quotes") {
      const copyQuotes = () => {
        const text = quoteRows
          .map((q) => `${q.symbol} ${q.price.toFixed(2)} ${q.change_pct >= 0 ? "+" : ""}${q.change_pct.toFixed(2)}%`)
          .join("\n")
        navigator.clipboard.writeText(text)
      }
      return (
        <article {...common}>
          <div className="wm-panel-head">
            <span>Live Quotes</span>
            <button type="button" className="wm-panel-action" onClick={copyQuotes} title="Copy to clipboard">
              📋
            </button>
            <span className="wm-drag-chip">drag</span>
          </div>
          <div className="wm-table-wrap">
            {isLoading && quoteRows.length === 0 ? (
              <div style={{ padding: "12px" }}>
                <div className="wm-skeleton wm-skeleton-row wm-skeleton-lg" />
                <div className="wm-skeleton wm-skeleton-row wm-skeleton-md" />
                <div className="wm-skeleton wm-skeleton-row wm-skeleton-sm" />
                <div className="wm-skeleton wm-skeleton-row wm-skeleton-lg" />
                <div className="wm-skeleton wm-skeleton-row wm-skeleton-md" />
              </div>
            ) : (
              <table className="wm-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Price</th>
                    <th>Change</th>
                    <th>Conf</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteRows.map((q) => (
                    <tr key={q.symbol}>
                      <td>{q.symbol}</td>
                      <td>{q.available ? fmt(q.price) : "-"}</td>
                      <td className={q.change_pct >= 0 ? "up" : "down"}>
                        {q.available ? `${q.change_pct >= 0 ? "+" : ""}${fmt(q.change_pct)}%` : "-"}
                      </td>
                      <td>{q.available ? q.confidence : "-"}</td>
                      <td>
                        {q.source}
                        {q.stale ? " (stale)" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </article>
      )
    }

    if (panel === "news") {
      return (
        <article {...common}>
          <div className="wm-panel-head">
            <span>News Wire</span>
            <span className="wm-drag-chip">drag</span>
          </div>
          <div className="wm-news-list">
            {isLoading && news.length === 0 ? (
              <>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="wm-news-item" style={{ opacity: 0.5 }}>
                    <div className="wm-skeleton wm-skeleton-row wm-skeleton-lg" style={{ marginBottom: "8px" }} />
                    <div className="wm-skeleton wm-skeleton-row wm-skeleton-sm" />
                  </div>
                ))}
              </>
            ) : (
              news.slice(0, 10).map((item) => (
                <a
                  key={`${item.url}-${item.datetime}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="wm-news-item"
                >
                  <div className="wm-news-title">{item.headline}</div>
                  <div className="wm-news-meta">
                    {item.source} | {item.datetime}
                  </div>
                  <div className="wm-news-flags">
                    <span className={`wm-news-flag wm-news-flag-tier-${item.source_tier ?? "unknown"}`}>
                      {tierLabel(item.source_tier)}
                    </span>
                    {item.impact ? (
                      <span className={`wm-news-flag wm-news-flag-risk-${item.impact.risk_level}`}>
                        {item.impact.risk_level} risk
                      </span>
                    ) : null}
                    {item.oil_refinery?.relevant ? <span className="wm-news-flag wm-news-flag-oil">oil/refinery</span> : null}
                  </div>
                  {item.impact?.summary ? <div className="wm-news-impact">{item.impact.summary}</div> : null}
                </a>
              ))
            )}
          </div>
        </article>
      )
    }

    if (panel === "macro") {
      return (
        <article {...common}>
          <div className="wm-panel-head">
            <span>Macro Pulse</span>
            <span className="wm-drag-chip">drag</span>
          </div>
          <div className="wm-kpi-grid">
            <div className="wm-kpi">
              <span>VIX</span>
              <strong>{macro?.vix?.value ? fmt(macro.vix.value) : "-"}</strong>
            </div>
            <div className="wm-kpi">
              <span>US10Y</span>
              <strong>{macro?.us10y?.value ? `${fmt(macro.us10y.value)}%` : "-"}</strong>
            </div>
            <div className="wm-kpi">
              <span>Fed</span>
              <strong>{macro?.fedfunds?.value ? `${fmt(macro.fedfunds.value)}%` : "-"}</strong>
            </div>
            <div className="wm-kpi">
              <span>USDINR</span>
              <strong>{macro?.usd_inr?.value ? fmt(macro.usd_inr.value) : "-"}</strong>
            </div>
          </div>
        </article>
      )
    }

    return (
      <article {...common}>
        <div className="wm-panel-head">
          <span>Entitlements</span>
          <span className="wm-drag-chip">drag</span>
        </div>
        <div className="wm-mini-section">
          {PLAN_FEATURES.map((feature) => {
            const unlocked = planSatisfies(activePlan, feature.required)
            return (
              <div key={feature.id} className="wm-mini-row">
                <span>{feature.label}</span>
                <span className={unlocked ? "ok" : "warn"}>
                  {unlocked ? "unlocked" : feature.required}
                </span>
              </div>
            )
          })}
        </div>
      </article>
    )
  }

  return (
    <main className={`wm-shell wm-density-${density} wm-layout-${layoutPreset}`}>
      <HeaderStrip
        workspaceId={workspaceId}
        plan={activePlan}
        status={status}
        density={density}
        layoutPreset={layoutPreset}
        slotAvailability={slotAvailability}
        slotSavedAt={slotSavedAt}
        lastSlotAction={slotNotice}
        isTabVisible={isTabVisible}
        onToggleDensity={() => setDensity(density === "compact" ? "comfortable" : "compact")}
        onCycleLayout={() => setLayoutPreset(cycleLayoutPreset(layoutPreset))}
        onLoadSlot={handleLoadSlot}
        onSaveSlot={handleSaveSlot}
        onToggleLeft={() => setLeftOpen(!leftOpen)}
        onToggleRight={() => setRightOpen(!rightOpen)}
        onOpenUpgrade={() => setUpgradeOpen(true)}
        onOpenCommand={() => setCommandOpen(true)}
        onRefresh={refreshAll}
      />

      <TickerTape quotes={quoteMap} />

      <div className="wm-body" style={bodyStyle}>
        <SideDrawer
          side="left"
          title="Watchlist / Sources"
          open={leftOpen}
          width={leftWidth}
          onResizeStart={(event) => startResize("left", event)}
        >
          <div className="wm-list">
            {watchlist.map((symbol) => {
              const q = quoteMap[symbol]
              return (
                <button
                  key={symbol}
                  type="button"
                  className={`wm-list-item ${symbol === activeSymbol ? "active" : ""}`}
                  onClick={() => setActiveSymbol(symbol)}
                >
                  <span>{symbol}</span>
                  <span className={(q?.change_pct ?? 0) >= 0 ? "up" : "down"}>
                    {q?.available ? `${q.change_pct >= 0 ? "+" : ""}${q.change_pct.toFixed(2)}%` : "N/A"}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="wm-mini-section">
            <div className="wm-mini-title">Provider Keys</div>
            {Object.entries(quotes?.diagnostics.keys ?? {}).map(([k, v]) => (
              <div key={k} className="wm-mini-row">
                <span>{k.replace(/_/g, " ")}</span>
                <span className={v ? "ok" : "warn"}>{v ? "set" : "missing"}</span>
              </div>
            ))}
          </div>

          <div className="wm-mini-section">
            <div className="wm-mini-title">System</div>
            <div className="wm-mini-row">
              <span>Loading</span>
              <span className={isLoading ? "warn" : "ok"}>{isLoading ? "yes" : "no"}</span>
            </div>
            <div className="wm-mini-row">
              <span>Errors</span>
              <span className={errors.length > 0 ? "warn" : "ok"}>{errors.length}</span>
            </div>
            <div className="wm-mini-row">
              <span>Quote Runtime</span>
              <span>{quotes?.diagnostics.runtime_ms ?? "-"} ms</span>
            </div>
            <div className="wm-mini-row">
              <span>Quote Cache</span>
              <span className={quotes?.diagnostics.cache_hit ? "ok" : "warn"}>
                {quotes?.diagnostics.cache_hit ? "hit" : "live"}
              </span>
            </div>
          </div>
        </SideDrawer>

        <section className="wm-center">
          <div className={activePanel === "map" ? "active-pane" : ""}>
            <MapStage
              quotes={quoteMap}
              activeSymbol={activeSymbol}
              onSelectSymbol={(symbol) => {
                setActiveSymbol(symbol)
                setActivePanel("map")
              }}
            />
          </div>

          <section className="wm-grid">
            {panelOrder.map((panel) => renderGridPanel(panel))}
          </section>
        </section>

        <SideDrawer
          side="right"
          title="Usage / Readiness"
          open={rightOpen}
          width={rightWidth}
          onResizeStart={(event) => startResize("right", event)}
        >
          <div className="wm-mini-section">
            <div className="wm-mini-title">Usage Meters</div>
            {usageMeters.map((m) => {
              const pct = m.limit > 0 ? Math.min(100, (m.used / m.limit) * 100) : 0
              return (
                <div key={m.key} className="wm-meter-row">
                  <div className="wm-mini-row">
                    <span>{m.label}</span>
                    <span>{fmt(m.used, 0)} / {fmt(m.limit, 0)}</span>
                  </div>
                  <div className="wm-meter">
                    <div className="wm-meter-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="wm-mini-section">
            <div className="wm-mini-title">Readiness</div>
            <div className="wm-mini-row">
              <span>India Live</span>
              <span className={status?.readiness.india_live_ready ? "ok" : "warn"}>
                {status?.readiness.india_live_ready ? "ready" : "pending"}
              </span>
            </div>
            <div className="wm-mini-row">
              <span>Global Live</span>
              <span className={status?.readiness.global_live_ready ? "ok" : "warn"}>
                {status?.readiness.global_live_ready ? "ready" : "pending"}
              </span>
            </div>
            <div className="wm-mini-row">
              <span>News Chain</span>
              <span className={status?.readiness.news_live_chain ? "ok" : "warn"}>
                {status?.readiness.news_live_chain ? "active" : "limited"}
              </span>
            </div>
            <div className="wm-mini-row">
              <span>News Fresh</span>
              <span className={status?.readiness.news_intel_fresh ? "ok" : "warn"}>
                {status?.readiness.news_intel_fresh ? "fresh" : "stale"}
              </span>
            </div>
            <div className="wm-mini-row">
              <span>Official Mix</span>
              <span className={status?.readiness.news_official_mix ? "ok" : "warn"}>
                {status?.readiness.news_official_mix ? "yes" : "low"}
              </span>
            </div>
            <div className="wm-mini-row">
              <span>Oil Coverage</span>
              <span className={status?.readiness.oil_refinery_coverage ? "ok" : "warn"}>
                {status?.readiness.oil_refinery_coverage ? "active" : "thin"}
              </span>
            </div>
          </div>
        </SideDrawer>
      </div>

      {upgradeOpen ? (
        <div className="wm-modal-overlay">
          <div className="wm-modal panel">
            <div className="wm-modal-head">
              <span>Upgrade Workspace</span>
              <button type="button" className="wm-header-btn" onClick={() => setUpgradeOpen(false)}>
                CLOSE
              </button>
            </div>
            <div className="wm-modal-grid">
              {(["starter", "pro", "terminal"] as Plan[]).map((plan) => (
                <button
                  key={plan}
                  type="button"
                  className={`wm-plan-card ${plan === activePlan ? "active" : ""}`}
                  onClick={() => setUpgradeOpen(false)}
                >
                  <div className="wm-plan-title">{plan.toUpperCase()}</div>
                  <div className="wm-plan-note">
                    {plan === "starter"
                      ? "Core monitoring"
                      : plan === "pro"
                        ? "Adds risk + rebalance"
                        : "Adds terminal + ML"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} commands={commands} />
    </main>
  )
}
