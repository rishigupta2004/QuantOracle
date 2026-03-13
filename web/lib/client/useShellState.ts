"use client"

import { useEffect, useState } from "react"

export type DensityMode = "compact" | "comfortable"
export type PanelFocus = "map" | "quotes" | "news" | "macro" | "entitlements"
export type GridPanel = Exclude<PanelFocus, "map">
export type LayoutPreset = "atlas" | "focus" | "stack"
export type LayoutSlot = "1" | "2" | "3"

export type LayoutSnapshot = {
  leftOpen: boolean
  rightOpen: boolean
  leftWidth: number
  rightWidth: number
  density: DensityMode
  activePanel: PanelFocus
  layoutPreset: LayoutPreset
  panelOrder: GridPanel[]
  savedAt: string
}

type LayoutSlotsState = Record<LayoutSlot, LayoutSnapshot | null>

const LEFT_DEFAULT = 260
const RIGHT_DEFAULT = 310
const LEFT_MIN = 210
const LEFT_MAX = 420
const RIGHT_MIN = 240
const RIGHT_MAX = 480
const PANEL_DEFAULT_ORDER: GridPanel[] = ["quotes", "news", "macro", "entitlements"]
const LAYOUT_SLOTS_DEFAULT: LayoutSlotsState = {
  "1": null,
  "2": null,
  "3": null
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function isGridPanel(value: string): value is GridPanel {
  return (
    value === "quotes" ||
    value === "news" ||
    value === "macro" ||
    value === "entitlements"
  )
}

function normalizePanelOrder(raw: string[] | GridPanel[]): GridPanel[] {
  const allowed: GridPanel[] = [...PANEL_DEFAULT_ORDER]
  const valid: GridPanel[] = raw
    .map((p) => String(p))
    .filter((p): p is GridPanel => isGridPanel(p))

  const out: GridPanel[] = []
  for (const p of valid) {
    if (!out.includes(p)) {
      out.push(p)
    }
  }
  for (const p of allowed) {
    if (!out.includes(p)) {
      out.push(p)
    }
  }
  return out
}

function normalizeLayoutSlots(raw: unknown): LayoutSlotsState {
  if (!raw || typeof raw !== "object") {
    return LAYOUT_SLOTS_DEFAULT
  }

  const src = raw as Record<string, unknown>
  const out: LayoutSlotsState = { ...LAYOUT_SLOTS_DEFAULT }

  for (const slot of ["1", "2", "3"] as const) {
    const v = src[slot]
    if (!v || typeof v !== "object") {
      continue
    }
    const s = v as Record<string, unknown>
    const density = s.density === "comfortable" ? "comfortable" : "compact"
    const activePanel =
      s.activePanel === "quotes" ||
      s.activePanel === "news" ||
      s.activePanel === "macro" ||
      s.activePanel === "entitlements"
        ? s.activePanel
        : "map"
    const layoutPreset =
      s.layoutPreset === "focus" || s.layoutPreset === "stack" ? s.layoutPreset : "atlas"
    const panelOrder = Array.isArray(s.panelOrder)
      ? normalizePanelOrder(s.panelOrder.map((x) => String(x)))
      : PANEL_DEFAULT_ORDER

    const savedAt =
      typeof s.savedAt === "string" && s.savedAt.trim()
        ? s.savedAt
        : new Date().toISOString()

    out[slot] = {
      leftOpen: Boolean(s.leftOpen),
      rightOpen: Boolean(s.rightOpen),
      leftWidth: clamp(Number(s.leftWidth) || LEFT_DEFAULT, LEFT_MIN, LEFT_MAX),
      rightWidth: clamp(Number(s.rightWidth) || RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX),
      density,
      activePanel,
      layoutPreset,
      panelOrder,
      savedAt
    }
  }

  return out
}

export function useShellState(defaultSymbol: string) {
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [commandOpen, setCommandOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [activeSymbol, setActiveSymbol] = useState(defaultSymbol)
  const [density, setDensity] = useState<DensityMode>("compact")
  const [activePanel, setActivePanel] = useState<PanelFocus>("map")
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>("atlas")
  const [panelOrder, setPanelOrderRaw] = useState<GridPanel[]>(PANEL_DEFAULT_ORDER)
  const [leftWidth, setLeftWidthRaw] = useState(LEFT_DEFAULT)
  const [rightWidth, setRightWidthRaw] = useState(RIGHT_DEFAULT)
  const [layoutSlots, setLayoutSlots] = useState<LayoutSlotsState>(LAYOUT_SLOTS_DEFAULT)

  const setLeftWidth = (v: number) => setLeftWidthRaw(clamp(v, LEFT_MIN, LEFT_MAX))
  const setRightWidth = (v: number) => setRightWidthRaw(clamp(v, RIGHT_MIN, RIGHT_MAX))
  const setPanelOrder = (items: Array<GridPanel | string>) =>
    setPanelOrderRaw(normalizePanelOrder(items))
  const resetPanelOrder = () => setPanelOrderRaw(PANEL_DEFAULT_ORDER)
  const resetLayoutSlots = () => setLayoutSlots(LAYOUT_SLOTS_DEFAULT)

  const saveLayoutSlot = (slot: LayoutSlot) => {
    setLayoutSlots((prev) => ({
      ...prev,
      [slot]: {
        leftOpen,
        rightOpen,
        leftWidth,
        rightWidth,
        density,
        activePanel,
        layoutPreset,
        panelOrder,
        savedAt: new Date().toISOString()
      }
    }))
  }

  const loadLayoutSlot = (slot: LayoutSlot): boolean => {
    const snap = layoutSlots[slot]
    if (!snap) {
      return false
    }
    setLeftOpen(snap.leftOpen)
    setRightOpen(snap.rightOpen)
    setLeftWidth(snap.leftWidth)
    setRightWidth(snap.rightWidth)
    setDensity(snap.density)
    setActivePanel(snap.activePanel)
    setLayoutPreset(snap.layoutPreset)
    setPanelOrder(snap.panelOrder)
    return true
  }

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const symbol = p.get("symbol")
    const d = p.get("density")
    const l = p.get("left")
    const r = p.get("right")
    const panel = p.get("panel")
    const layout = p.get("layout")
    const panelOrderParam = p.get("po")
    const lw = p.get("lw")
    const rw = p.get("rw")

    const saved = localStorage.getItem("quantoracle.shell")
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          leftWidth?: number
          rightWidth?: number
          density?: DensityMode
          leftOpen?: boolean
          rightOpen?: boolean
          layoutPreset?: LayoutPreset
          panelOrder?: GridPanel[]
        }
        if (typeof parsed.leftWidth === "number") {
          setLeftWidth(parsed.leftWidth)
        }
        if (typeof parsed.rightWidth === "number") {
          setRightWidth(parsed.rightWidth)
        }
        if (parsed.density === "comfortable") {
          setDensity("comfortable")
        }
        if (typeof parsed.leftOpen === "boolean") {
          setLeftOpen(parsed.leftOpen)
        }
        if (typeof parsed.rightOpen === "boolean") {
          setRightOpen(parsed.rightOpen)
        }
        if (
          parsed.layoutPreset === "atlas" ||
          parsed.layoutPreset === "focus" ||
          parsed.layoutPreset === "stack"
        ) {
          setLayoutPreset(parsed.layoutPreset)
        }
        if (Array.isArray(parsed.panelOrder)) {
          setPanelOrder(parsed.panelOrder)
        }
      } catch {
        // ignore malformed local storage
      }
    }

    const slotsRaw = localStorage.getItem("quantoracle.layoutSlots")
    if (slotsRaw) {
      try {
        const parsedSlots = JSON.parse(slotsRaw)
        setLayoutSlots(normalizeLayoutSlots(parsedSlots))
      } catch {
        // ignore malformed slot storage
      }
    }

    if (symbol) {
      setActiveSymbol(symbol.toUpperCase())
    }
    if (d === "comfortable") {
      setDensity("comfortable")
    }
    if (l === "0") {
      setLeftOpen(false)
    }
    if (r === "0") {
      setRightOpen(false)
    }
    if (
      panel === "map" ||
      panel === "quotes" ||
      panel === "news" ||
      panel === "macro" ||
      panel === "entitlements"
    ) {
      setActivePanel(panel)
    }
    if (layout === "atlas" || layout === "focus" || layout === "stack") {
      setLayoutPreset(layout)
    }
    if (panelOrderParam) {
      setPanelOrder(panelOrderParam.split(",").map((x) => x.trim()))
    }
    if (lw) {
      setLeftWidth(Number(lw))
    }
    if (rw) {
      setRightWidth(Number(rw))
    }
  }, [])

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    p.set("symbol", activeSymbol)
    p.set("density", density)
    p.set("left", leftOpen ? "1" : "0")
    p.set("right", rightOpen ? "1" : "0")
    p.set("panel", activePanel)
    p.set("layout", layoutPreset)
    p.set("po", panelOrder.join(","))
    p.set("lw", String(Math.round(leftWidth)))
    p.set("rw", String(Math.round(rightWidth)))
    const q = p.toString()
    const url = `${window.location.pathname}?${q}`
    window.history.replaceState({}, "", url)

    localStorage.setItem(
      "quantoracle.shell",
      JSON.stringify({
        leftOpen,
        rightOpen,
        leftWidth,
        rightWidth,
        density,
        layoutPreset,
        panelOrder
      })
    )
  }, [
    activeSymbol,
    density,
    leftOpen,
    rightOpen,
    activePanel,
    layoutPreset,
    panelOrder,
    leftWidth,
    rightWidth
  ])

  useEffect(() => {
    localStorage.setItem("quantoracle.layoutSlots", JSON.stringify(layoutSlots))
  }, [layoutSlots])

  return {
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
  }
}
