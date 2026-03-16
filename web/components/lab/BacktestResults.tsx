"use client"

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
        <div className="lab-chart-placeholder">
          [Chart: Model vs Benchmark - {result.cumulativeReturns.length} data points]
        </div>
      </div>

      <div className="lab-chart-section">
        <h3 className="lab-chart-title">Walk-Forward IC</h3>
        <div className="lab-chart-placeholder">
          [Chart: IC Series - {result.icSeries.length} periods]
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
        <button className="lab-action-btn">Save Model</button>
        <button className="lab-action-btn">Deploy to Screener</button>
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
