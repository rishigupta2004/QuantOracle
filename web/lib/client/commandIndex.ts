import type {
  DensityMode,
  LayoutPreset,
  LayoutSlot,
  PanelFocus
} from "@/lib/client/useShellState"

export type CommandAction = {
  id: string
  label: string
  hint?: string
  keywords: string[]
  run: () => void
}

type BuildArgs = {
  symbols: string[]
  activeSymbol: string
  setActiveSymbol: (symbol: string) => void
  leftOpen: boolean
  rightOpen: boolean
  setLeftOpen: (open: boolean) => void
  setRightOpen: (open: boolean) => void
  density: DensityMode
  setDensity: (mode: DensityMode) => void
  layoutPreset: LayoutPreset
  setLayoutPreset: (preset: LayoutPreset) => void
  slotAvailability: Record<LayoutSlot, boolean>
  saveLayoutSlot: (slot: LayoutSlot) => void
  loadLayoutSlot: (slot: LayoutSlot) => boolean
  resetLayoutSlots: () => void
  setActivePanel: (panel: PanelFocus) => void
  resetLayout: () => void
  openUpgrade: () => void
  refreshAll: () => void
}

export function buildCommandIndex(args: BuildArgs): CommandAction[] {
  const commands: CommandAction[] = [
    {
      id: "refresh",
      label: "Refresh all data",
      hint: "R",
      keywords: ["reload", "fetch", "poll"],
      run: args.refreshAll
    },
    {
      id: "left-drawer",
      label: args.leftOpen ? "Close left drawer" : "Open left drawer",
      hint: "L",
      keywords: ["left", "drawer", "watchlist"],
      run: () => args.setLeftOpen(!args.leftOpen)
    },
    {
      id: "right-drawer",
      label: args.rightOpen ? "Close right drawer" : "Open right drawer",
      hint: "R",
      keywords: ["right", "drawer", "status"],
      run: () => args.setRightOpen(!args.rightOpen)
    },
    {
      id: "density-compact",
      label: "Set compact density",
      keywords: ["compact", "dense", "layout"],
      run: () => args.setDensity("compact")
    },
    {
      id: "density-comfortable",
      label: "Set comfortable density",
      keywords: ["comfortable", "spacious", "layout"],
      run: () => args.setDensity("comfortable")
    },
    {
      id: "layout-atlas",
      label: `Set layout Atlas${args.layoutPreset === "atlas" ? " (active)" : ""}`,
      keywords: ["layout", "atlas", "balanced", "grid"],
      run: () => args.setLayoutPreset("atlas")
    },
    {
      id: "layout-focus",
      label: `Set layout Focus${args.layoutPreset === "focus" ? " (active)" : ""}`,
      keywords: ["layout", "focus", "analysis", "grid"],
      run: () => args.setLayoutPreset("focus")
    },
    {
      id: "layout-stack",
      label: `Set layout Stack${args.layoutPreset === "stack" ? " (active)" : ""}`,
      keywords: ["layout", "stack", "vertical", "grid"],
      run: () => args.setLayoutPreset("stack")
    },
    {
      id: "slot-save-1",
      label: "Save layout to slot 1",
      keywords: ["slot", "save", "layout", "1"],
      run: () => args.saveLayoutSlot("1")
    },
    {
      id: "slot-save-2",
      label: "Save layout to slot 2",
      keywords: ["slot", "save", "layout", "2"],
      run: () => args.saveLayoutSlot("2")
    },
    {
      id: "slot-save-3",
      label: "Save layout to slot 3",
      keywords: ["slot", "save", "layout", "3"],
      run: () => args.saveLayoutSlot("3")
    },
    {
      id: "slot-load-1",
      label: `Load slot 1${args.slotAvailability["1"] ? "" : " (empty)"}`,
      keywords: ["slot", "load", "layout", "1"],
      run: () => {
        if (args.slotAvailability["1"]) {
          args.loadLayoutSlot("1")
        }
      }
    },
    {
      id: "slot-load-2",
      label: `Load slot 2${args.slotAvailability["2"] ? "" : " (empty)"}`,
      keywords: ["slot", "load", "layout", "2"],
      run: () => {
        if (args.slotAvailability["2"]) {
          args.loadLayoutSlot("2")
        }
      }
    },
    {
      id: "slot-load-3",
      label: `Load slot 3${args.slotAvailability["3"] ? "" : " (empty)"}`,
      keywords: ["slot", "load", "layout", "3"],
      run: () => {
        if (args.slotAvailability["3"]) {
          args.loadLayoutSlot("3")
        }
      }
    },
    {
      id: "slot-reset",
      label: "Clear all layout slots",
      keywords: ["slot", "clear", "reset", "layout"],
      run: args.resetLayoutSlots
    },
    {
      id: "upgrade",
      label: "Open upgrade modal",
      keywords: ["plan", "billing", "pro", "terminal"],
      run: args.openUpgrade
    },
    {
      id: "layout-reset",
      label: "Reset layout (drawers + panels + slots)",
      keywords: ["layout", "width", "reset", "drawers", "panel", "order", "slot"],
      run: args.resetLayout
    },
    {
      id: "focus-map",
      label: "Focus map panel",
      hint: "1",
      keywords: ["focus", "map", "panel"],
      run: () => args.setActivePanel("map")
    },
    {
      id: "focus-quotes",
      label: "Focus quotes panel",
      hint: "2",
      keywords: ["focus", "quotes", "table", "panel"],
      run: () => args.setActivePanel("quotes")
    },
    {
      id: "focus-news",
      label: "Focus news panel",
      hint: "3",
      keywords: ["focus", "news", "panel"],
      run: () => args.setActivePanel("news")
    },
    {
      id: "focus-macro",
      label: "Focus macro panel",
      hint: "4",
      keywords: ["focus", "macro", "panel"],
      run: () => args.setActivePanel("macro")
    },
    {
      id: "focus-entitlements",
      label: "Focus entitlements panel",
      hint: "5",
      keywords: ["focus", "entitlements", "features", "panel"],
      run: () => args.setActivePanel("entitlements")
    }
  ]

  for (const symbol of args.symbols) {
    commands.push({
      id: `symbol-${symbol}`,
      label: `Focus ${symbol}`,
      hint: symbol === args.activeSymbol ? "active" : undefined,
      keywords: ["symbol", "watchlist", symbol.toLowerCase()],
      run: () => args.setActiveSymbol(symbol)
    })
  }

  return commands
}
