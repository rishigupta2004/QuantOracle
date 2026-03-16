"use client"

import { useState, useEffect } from "react"
import { FactorConfig, Universe, BUILTIN_FACTORS } from "./types"

type Props = {
  selectedFactors: FactorConfig[]
  universe: Universe
  onFactorsChange: (factors: FactorConfig[]) => void
}

type WeightMode = "equal" | "ic" | "manual"

function getIcBadge(ic: number | null) {
  if (ic === null) return null
  const color =
    ic > 0.05
      ? "var(--signal-buy)"
      : ic >= 0.02
      ? "var(--signal-hold)"
      : "var(--signal-sell)"
  const label = ic > 0.05 ? `IC: ${ic.toFixed(3)}` : ic >= 0.02 ? `IC: ${ic.toFixed(3)}` : `IC: ${ic.toFixed(3)} (weak)`
  return (
    <span className="ic-badge" style={{ color, borderColor: color }}>
      {label}
    </span>
  )
}

export function FactorBuilder({
  selectedFactors,
  universe,
  onFactorsChange,
}: Props) {
  const [weightMode, setWeightMode] = useState<WeightMode>("equal")
  const [icData, setIcData] = useState<Record<string, number>>({})

  useEffect(() => {
    if (universe === "custom") return
    const enabledFactors = selectedFactors.filter((f) => f.enabled)
    if (enabledFactors.length === 0) return

    const fetchIc = async () => {
      const results: Record<string, number> = {}
      for (const factor of enabledFactors) {
        try {
          const res = await fetch(
            `/api/lab/factor-ic?factor=${factor.id}&universe=${universe}`
          )
          if (res.ok) {
            const data = await res.json()
            results[factor.id] = data.ic
          }
        } catch {
          // Ignore fetch errors
        }
      }
      setIcData(results)
    }
    fetchIc()
  }, [selectedFactors, universe])

  const toggleFactor = (id: string) => {
    const existing = selectedFactors.find((f) => f.id === id)
    if (existing) {
      onFactorsChange(
        selectedFactors.map((f) =>
          f.id === id ? { ...f, enabled: !f.enabled } : f
        )
      )
    } else {
      onFactorsChange([
        ...selectedFactors,
        { id, enabled: true, weight: 100 / (selectedFactors.filter((f) => f.enabled).length + 1) },
      ])
    }
  }

  const updateWeight = (id: string, weight: number) => {
    onFactorsChange(
      selectedFactors.map((f) => (f.id === id ? { ...f, weight } : f))
    )
  }

  const enabledCount = selectedFactors.filter((f) => f.enabled).length
  const totalWeight = selectedFactors
    .filter((f) => f.enabled)
    .reduce((sum, f) => sum + f.weight, 0)

  return (
    <div className="lab-section">
      <h2 className="lab-section-title">2. Factors</h2>

      <div className="lab-weight-mode">
        <span className="lab-weight-mode-label">Weight mode:</span>
        <button
          className={`lab-weight-btn ${weightMode === "equal" ? "active" : ""}`}
          onClick={() => setWeightMode("equal")}
        >
          Equal
        </button>
        <button
          className={`lab-weight-btn ${weightMode === "ic" ? "active" : ""}`}
          onClick={() => setWeightMode("ic")}
        >
          IC-weighted
        </button>
        <button
          className={`lab-weight-btn ${weightMode === "manual" ? "active" : ""}`}
          onClick={() => setWeightMode("manual")}
        >
          Manual
        </button>
      </div>

      {weightMode === "manual" && (
        <div className="lab-weight-total">
          Total: {totalWeight.toFixed(0)}% {totalWeight !== 100 && <span className="lab-weight-error">(must be 100%)</span>}
        </div>
      )}

      <div className="lab-factors-list">
        {BUILTIN_FACTORS.map((factor) => {
          const selected = selectedFactors.find((f) => f.id === factor.id)
          const isEnabled = selected?.enabled ?? false

          return (
            <div
              key={factor.id}
              className={`lab-factor-row ${isEnabled ? "enabled" : ""}`}
            >
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={() => toggleFactor(factor.id)}
                className="lab-factor-checkbox"
              />
              <span className="lab-factor-name">{factor.name}</span>
              <span className="lab-factor-desc">{factor.description}</span>
              {getIcBadge(icData[factor.id] ?? null)}
              {factor.warning && isEnabled && (
                <span className="lab-factor-warning">{factor.warning}</span>
              )}
              {weightMode === "manual" && isEnabled && (
                <input
                  type="number"
                  className="lab-weight-input"
                  value={selected?.weight ?? 0}
                  onChange={(e) =>
                    updateWeight(factor.id, parseFloat(e.target.value) || 0)
                  }
                  min={0}
                  max={100}
                  step={1}
                />
              )}
            </div>
          )
        })}
      </div>

      <button className="lab-add-factor-btn">+ Add custom factor</button>
    </div>
  )
}
