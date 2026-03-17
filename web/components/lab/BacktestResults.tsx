"use client"

import { useCallback } from "react"
import { BacktestResult } from "./types"

type Props = {
  result: BacktestResult
  onReset: () => void
}

function formatPct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function formatRatio(v: number) {
  return v.toFixed(2)
}

// Tiny SVG line chart — model vs benchmark
function ReturnChart({ data }: { data: { date: string; model: number; benchmark: number }[] }) {
  if (data.length < 2) return <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 9 }}>No data</div>
  const w = 400, h = 80
  const allVals = data.flatMap(d => [d.model, d.benchmark])
  const minV = Math.min(...allVals), maxV = Math.max(...allVals)
  const range = maxV - minV || 1
  const toX = (i: number) => (i / (data.length - 1)) * w
  const toY = (v: number) => h - ((v - minV) / range) * (h - 8) - 4
  const pathFor = (key: "model" | "benchmark") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(d[key]).toFixed(1)}`).join(" ")
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <path d={pathFor("benchmark")} stroke="#4a4a4a" strokeWidth="1" fill="none" />
      <path d={pathFor("model")} stroke="#c8ff00" strokeWidth="1.5" fill="none" />
    </svg>
  )
}

// IC bar chart — green/red bars
function IcChart({ data }: { data: { date: string; ic: number }[] }) {
  if (data.length < 2) return <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 9 }}>No data</div>
  const w = 400, h = 60
  const maxAbs = Math.max(...data.map(d => Math.abs(d.ic)), 0.01)
  const barW = Math.max(2, (w / data.length) - 1)
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="#2a2a2a" strokeWidth="1" />
      {data.map((d, i) => {
        const barH = (Math.abs(d.ic) / maxAbs) * (h / 2 - 4)
        const x = i * (w / data.length)
        const y = d.ic >= 0 ? h / 2 - barH : h / 2
        return <rect key={i} x={x} y={y} width={barW} height={barH} fill={d.ic >= 0 ? "rgba(0,255,136,0.7)" : "rgba(255,51,85,0.7)"} />
      })}
    </svg>
  )
}

export function BacktestResults({ result, onReset }: Props) {
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `backtest-${new Date().toISOString().split("T")[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const benchmarkReturn = result.cumulativeReturns.length > 0
    ? result.cumulativeReturns[result.cumulativeReturns.length - 1].benchmark
    : 0
  const modelReturn = result.cumulativeReturns.length > 0
    ? result.cumulativeReturns[result.cumulativeReturns.length - 1].model
    : 0

  return (
    <div className="lab-section lab-results">
      <h2 className="lab-section-title">4. Results</h2>

      <div className="lab-results-grid">
        <div className="lab-metrics-table">
          <div className="lab-metric-header">
            <span></span>
            <span>Your Model</span>
            <span>Nifty50</span>
            <span>Delta</span>
          </div>
          <div className="lab-metric-row">
            <span className="lab-metric-name">Ann. Return</span>
            <span className="lab-metric-value">{formatPct(result.annualizedReturn)}</span>
            <span className="lab-metric-bench">{formatPct(benchmarkReturn)}</span>
            <span className={`lab-metric-delta ${result.annualizedReturn > benchmarkReturn ? "positive" : "negative"}`}>
              {formatPct(result.annualizedReturn - benchmarkReturn)}
            </span>
          </div>
          <div className="lab-metric-row">
            <span className="lab-metric-name">Sharpe</span>
            <span className="lab-metric-value">{formatRatio(result.sharpeRatio)}</span>
            <span className="lab-metric-bench">-</span>
            <span className="lab-metric-delta">-</span>
          </div>
          <div className="lab-metric-row">
            <span className="lab-metric-name">Max Drawdown</span>
            <span className="lab-metric-value">{formatPct(result.maxDrawdown)}</span>
            <span className="lab-metric-bench">-</span>
            <span className="lab-metric-delta">-</span>
          </div>
          <div className="lab-metric-row">
            <span className="lab-metric-name">Calmar</span>
            <span className="lab-metric-value">{formatRatio(result.calmarRatio)}</span>
            <span className="lab-metric-bench">-</span>
            <span className="lab-metric-delta">-</span>
          </div>
          <div className="lab-metric-row">
            <span className="lab-metric-name">Hit Rate</span>
            <span className="lab-metric-value">{formatPct(result.hitRate)}</span>
            <span className="lab-metric-bench">-</span>
            <span className="lab-metric-delta">-</span>
          </div>
          <div className="lab-metric-row">
            <span className="lab-metric-name">Turnover</span>
            <span className="lab-metric-value">{formatPct(result.annualTurnover)}</span>
            <span className="lab-metric-bench">-</span>
            <span className="lab-metric-delta">-</span>
          </div>
          <div className="lab-metric-row">
            <span className="lab-metric-name">Mean IC</span>
            <span className="lab-metric-value">{formatRatio(result.meanIc)}</span>
            <span className="lab-metric-bench">-</span>
            <span className={`lab-metric-delta ${result.meanIc > 0 ? "positive" : "negative"}`}>
              {result.validationPassed ? "PASS" : "FAIL"}
            </span>
          </div>
        </div>
      </div>

      <div className="lab-chart-section">
        <h3 className="lab-chart-title">Cumulative Returns</h3>
        <div style={{ background: "var(--bg-base)", padding: 8, border: "1px solid var(--border-dim)" }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 6, fontSize: 9, fontFamily: "var(--font-mono)" }}>
            <span><span style={{ color: "#c8ff00" }}>━</span> Model</span>
            <span><span style={{ color: "#4a4a4a" }}>━</span> Nifty50</span>
          </div>
          <ReturnChart data={result.cumulativeReturns} />
        </div>
      </div>

      <div className="lab-chart-section">
        <h3 className="lab-chart-title">Walk-Forward IC</h3>
        <div style={{ background: "var(--bg-base)", padding: 8, border: "1px solid var(--border-dim)" }}>
          <IcChart data={result.icSeries} />
        </div>
      </div>

      <div className="lab-factor-table">
        <h3 className="lab-chart-title">Factor Contributions</h3>
        <table className="lab-factor-contributions">
          <thead>
            <tr>
              <th>Factor</th>
              <th>IC</th>
              <th>Weight</th>
              <th>Contribution</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            {result.factorContributions.map((fc) => (
              <tr key={fc.factor}>
                <td>{fc.factor}</td>
                <td>{formatRatio(fc.ic)}</td>
                <td>{formatPct(fc.weight)}</td>
                <td>{formatRatio(fc.contribution)}</td>
                <td>
                  <span className={`verdict-${fc.verdict.toLowerCase()}`}>
                    {fc.verdict}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="lab-action-buttons">
        <button className="lab-action-btn" onClick={() => {
          const saved = { factors: result.factorContributions, savedAt: new Date().toISOString() }
          localStorage.setItem("quantoracle_lab_model", JSON.stringify(saved))
          alert("Model saved to local storage.")
        }}>Save Model</button>
        <button className="lab-action-btn" onClick={() => {
          const weights = result.factorContributions.reduce((acc: Record<string,number>, fc) => {
            acc[fc.factor] = fc.weight; return acc
          }, {})
          localStorage.setItem("quantoracle_screener_weights", JSON.stringify(weights))
          alert("Model deployed. Screener will use these weights on next load.")
        }}>Deploy to Screener</button>
        <button className="lab-action-btn" onClick={exportJson}>
          Export JSON
        </button>
        <button className="lab-action-btn secondary" onClick={onReset}>
          Run Again
        </button>
      </div>

      <div className="lab-limitations">
        Backtests show what would have happened, not what will happen. This
        model has not been live-tested. Past IC does not guarantee future IC.
        Transaction costs are approximate. Use for research only.
      </div>
    </div>
  )
}
