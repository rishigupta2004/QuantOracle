"use client"

const ROADMAP = [
  { version: "v0.1", status: "done", item: "Factor model construction + walk-forward backtest" },
  { version: "v0.2", status: "planned", item: "Custom factor formula builder with live IC preview" },
  { version: "v0.3", status: "planned", item: "LSTM sequence model on OHLCV (optional GPU endpoint)" },
  { version: "v0.4", status: "planned", item: "Alternative data: NSE options OI, FII/DII bulk deals" },
  { version: "v0.5", status: "planned", item: "Paper trading: deploy model to live data, track P&L" },
  { version: "v0.6", status: "planned", item: "Genetic algorithm factor discovery" },
  { version: "v1.0", status: "planned", item: "Multi-model ensemble with live signal generation" },
]

export function LabRoadmap() {
  return (
    <div className="lab-section lab-roadmap">
      <h2 className="lab-section-title">Roadmap</h2>
      <ul className="lab-roadmap-list">
        {ROADMAP.map((item) => (
          <li key={item.version} className={`lab-roadmap-item ${item.status}`}>
            <span className="lab-roadmap-status">
              {item.status === "done" ? "✓" : "○"}
            </span>
            <span className="lab-roadmap-version">{item.version}</span>
            <span className="lab-roadmap-item-text">{item.item}</span>
          </li>
        ))}
      </ul>
      <div className="lab-roadmap-cta">
        <a href="/CONTRIBUTING.md">Build with us →</a>
      </div>
    </div>
  )
}
