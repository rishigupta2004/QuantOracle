"use client"

import { useState } from "react"
import { BacktestParams, Universe } from "./types"

type Props = {
  params: BacktestParams
  onParamsChange: (params: Partial<BacktestParams>) => void
  universe: Universe
  factorCount: number
}

export function BacktestConfig({
  params,
  onParamsChange,
  universe,
  factorCount,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const symbolCount = universe === "nifty50" ? 50 : universe === "nifty100" ? 100 : 10
  const days = params.lookbackYears * 252
  const periods = Math.floor(days / params.stepSize)
  const estimatedSeconds = Math.max(
    1,
    Math.round((symbolCount * days * factorCount) / 50000)
  )

  return (
    <div className="lab-section">
      <h2 className="lab-section-title">3. Configuration</h2>

      <div className="lab-config-grid">
        <div className="lab-config-row">
          <label className="lab-config-label">Lookback period</label>
          <div className="lab-config-buttons">
            {[1, 3, 5, 10].map((y) => (
              <button
                key={y}
                className={`lab-config-btn ${params.lookbackYears === y ? "active" : ""}`}
                onClick={() => onParamsChange({ lookbackYears: y })}
              >
                {y}Y
              </button>
            ))}
          </div>
        </div>

        <div className="lab-config-row">
          <label className="lab-config-label">Rebalance</label>
          <div className="lab-config-buttons">
            <button
              className={`lab-config-btn ${params.rebalanceDays === 21 ? "active" : ""}`}
              onClick={() => onParamsChange({ rebalanceDays: 21 })}
            >
              Monthly
            </button>
            <button
              className={`lab-config-btn ${params.rebalanceDays === 63 ? "active" : ""}`}
              onClick={() => onParamsChange({ rebalanceDays: 63 })}
            >
              Quarterly
            </button>
          </div>
        </div>

        <div className="lab-config-row">
          <label className="lab-config-label">Transaction cost</label>
          <div className="lab-config-buttons">
            {[0.001, 0.002, 0.005].map((c) => (
              <button
                key={c}
                className={`lab-config-btn ${params.costRate === c ? "active" : ""}`}
                onClick={() => onParamsChange({ costRate: c })}
              >
                {(c * 100).toFixed(1)}%
              </button>
            ))}
          </div>
        </div>

        <div className="lab-config-row">
          <label className="lab-config-label">Portfolio type</label>
          <div className="lab-config-buttons">
            <button
              className={`lab-config-btn ${!params.longShort ? "active" : ""}`}
              onClick={() => onParamsChange({ longShort: false })}
            >
              Long only
            </button>
            <button
              className={`lab-config-btn ${params.longShort ? "active" : ""}`}
              onClick={() => onParamsChange({ longShort: true })}
            >
              Long/Short
            </button>
          </div>
        </div>

        <div className="lab-config-row">
          <label className="lab-config-label">Position sizing</label>
          <div className="lab-config-buttons">
            <button
              className={`lab-config-btn ${params.equalWeight ? "active" : ""}`}
              onClick={() => onParamsChange({ equalWeight: true })}
            >
              Equal weight
            </button>
            <button
              className={`lab-config-btn ${!params.equalWeight ? "active" : ""}`}
              onClick={() => onParamsChange({ equalWeight: false })}
            >
              Factor weight
            </button>
          </div>
        </div>
      </div>

      <button
        className="lab-advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? "- Hide" : "+ Show"} Advanced
      </button>

      {showAdvanced && (
        <div className="lab-config-grid lab-advanced">
          <div className="lab-config-row">
            <label className="lab-config-label">Training window</label>
            <div className="lab-config-buttons">
              <button
                className={`lab-config-btn ${params.trainingWindow === 252 ? "active" : ""}`}
                onClick={() => onParamsChange({ trainingWindow: 252 })}
              >
                252d
              </button>
              <button
                className={`lab-config-btn ${params.trainingWindow === 504 ? "active" : ""}`}
                onClick={() => onParamsChange({ trainingWindow: 504 })}
              >
                504d
              </button>
            </div>
          </div>

          <div className="lab-config-row">
            <label className="lab-config-label">Step size</label>
            <div className="lab-config-buttons">
              <button
                className={`lab-config-btn ${params.stepSize === 21 ? "active" : ""}`}
                onClick={() => onParamsChange({ stepSize: 21 })}
              >
                21d
              </button>
              <button
                className={`lab-config-btn ${params.stepSize === 63 ? "active" : ""}`}
                onClick={() => onParamsChange({ stepSize: 63 })}
              >
                63d
              </button>
            </div>
          </div>

          <div className="lab-config-row">
            <label className="lab-config-label">Min IC gate</label>
            <div className="lab-config-buttons">
              {[0.02, 0.03, 0.05].map((ic) => (
                <button
                  key={ic}
                  className={`lab-config-btn ${params.minIcGate === ic ? "active" : ""}`}
                  onClick={() => onParamsChange({ minIcGate: ic })}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="lab-estimated-time">
        Estimated: ~{estimatedSeconds} seconds
      </div>
    </div>
  )
}
