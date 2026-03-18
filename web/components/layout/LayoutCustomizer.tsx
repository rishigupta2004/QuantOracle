"use client"

export type LayoutPrefs = {
  showWatchlist: boolean
  showSignals: boolean
  showMacro: boolean
  showNews: boolean
}

type Props = {
  isOpen: boolean
  onClose: () => void
  prefs: LayoutPrefs
  onChange: (next: LayoutPrefs) => void
  onReset: () => void
}

export function LayoutCustomizer({ isOpen, onClose, prefs, onChange, onReset }: Props) {
  if (!isOpen) return null

  const toggle = (key: keyof LayoutPrefs) => {
    onChange({ ...prefs, [key]: !prefs[key] })
  }

  return (
    <div className="wm-command-overlay" role="dialog" aria-modal="true" aria-label="Layout Customizer">
      <div className="wm-command-card" style={{ width: 520 }}>
        <div style={{ padding: 16, borderBottom: "1px solid var(--border-dim)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          Customize Layout
        </div>
        <div style={{ padding: 16, display: "grid", gap: 10 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
            <input type="checkbox" checked={prefs.showWatchlist} onChange={() => toggle("showWatchlist")} />
            Watchlist panel
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
            <input type="checkbox" checked={prefs.showSignals} onChange={() => toggle("showSignals")} />
            Signals panel
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
            <input type="checkbox" checked={prefs.showMacro} onChange={() => toggle("showMacro")} />
            Macro panel
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
            <input type="checkbox" checked={prefs.showNews} onChange={() => toggle("showNews")} />
            News panel
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: 16, borderTop: "1px solid var(--border-dim)" }}>
          <button className="wm-header-btn" type="button" onClick={onReset}>
            Reset
          </button>
          <button className="wm-header-btn primary" type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
