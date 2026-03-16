"use client"

import { Universe } from "./types"

type Props = {
  universe: Universe
  customSymbols: string[]
  onUniverseChange: (u: Universe) => void
  onCustomSymbolsChange: (s: string[]) => void
}

export function UniverseSelector({
  universe,
  customSymbols,
  onUniverseChange,
  onCustomSymbolsChange,
}: Props) {
  return (
    <div className="lab-section">
      <h2 className="lab-section-title">1. Universe</h2>
      <div className="lab-universe-options">
        <label className="lab-radio">
          <input
            type="radio"
            name="universe"
            checked={universe === "nifty50"}
            onChange={() => onUniverseChange("nifty50")}
          />
          <span className="lab-radio-label">Nifty 50</span>
          <span className="lab-radio-hint">50 large-cap symbols</span>
        </label>
        <label className="lab-radio">
          <input
            type="radio"
            name="universe"
            checked={universe === "nifty100"}
            onChange={() => onUniverseChange("nifty100")}
          />
          <span className="lab-radio-label">Nifty 100</span>
          <span className="lab-radio-hint">100 large + mid-cap symbols</span>
        </label>
        <label className="lab-radio">
          <input
            type="radio"
            name="universe"
            checked={universe === "custom"}
            onChange={() => onUniverseChange("custom")}
          />
          <span className="lab-radio-label">Custom</span>
        </label>
      </div>
      {universe === "custom" && (
        <div className="lab-custom-input">
          <label className="lab-input-label">Symbols (comma-separated)</label>
          <input
            type="text"
            className="lab-text-input"
            placeholder="RELIANCE.NS, TCS.NS, HDFCBANK.NS"
            value={customSymbols.join(", ")}
            onChange={(e) =>
              onCustomSymbolsChange(
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
              )
            }
          />
        </div>
      )}
    </div>
  )
}
