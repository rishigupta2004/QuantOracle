# QuantOracle

The open-source quantitative research terminal for Indian equities.

---

## What it is

QuantOracle is a Bloomberg-style research terminal for NSE-listed stocks. It combines a real EOD quant pipeline, IC-weighted signal generation, a factor model screener, and an AI-powered analysis layer — all free, all open source, all self-hostable.

---

## Why it exists

Bloomberg covers Indian equities poorly for individual researchers. Quant tools for NSE are either expensive or closed source. QuantOracle is neither.

---

## Live stats (walk-forward validated, not backtested)

| Metric | Value |
|---|---|
| Universe | Nifty50 (49 symbols validated) |
| Signal IC (mean, walk-forward) | 0.174 |
| IC Sharpe | null (1 validation step) |
| Pipeline last run | 2026-03-16 |
| Data source | Yahoo Finance (free) |
| Deployment | Vercel (web) + GitHub Actions (pipeline) |

---

## Quick start

```bash
git clone https://github.com/rishigupta2004/QuantOracle
cd QuantOracle/web
cp .env.example .env.local    # Add your keys (only Supabase required)
npm install && npm run dev
```

Open http://localhost:3000. Press / to search for a symbol.

Live at https://quant-oracle.vercel.app

For the quant pipeline:
```bash
pip install -r requirements.txt
python -m quant.pipeline --universe nifty50 --dry-run
```

---

## Architecture

The pipeline (GitHub Actions) fetches EOD data, builds features, trains a ridge model, validates it with walk-forward IC, and publishes Parquet artifacts to Supabase. The Next.js UI reads those artifacts. No training happens in the UI. No stale model ships without a manifest warning.

---

## Signal engine

Signals are IC-weighted across four non-overlapping categories: Trend (EMA crossover + ADX filter), Momentum (MACD), Mean Reversion (RSI with dynamic thresholds), and Volume (VWAP + OBV).

The ADX filter suppresses trend signals in sideways markets — the single most common source of false signals in retail TA tools.

IC is calculated per-symbol from 252 days of history. A signal with IC < 0.02 gets zero weight. We do not show signals we cannot validate.

---

## Quant Lab

The Lab lets you build and backtest your own factor models using free historical data. Start with the built-in factors (momentum, quality, low volatility, size) or define custom formulas. Walk-forward validation runs automatically before showing results.

---

## Roadmap

- **v0.1** — Factor model construction + walk-forward backtest ✓
- **v0.2** — Custom factor formula builder with live IC preview
- **v0.3** — LSTM sequence model on OHLCV (optional GPU endpoint)
- **v0.4** — Alternative data: NSE options OI, FII/DII bulk deals
- **v0.5** — Paper trading: deploy model to live data, track P&L
- **v0.6** — Genetic algorithm factor discovery
- **v1.0** — Multi-model ensemble with live signal generation

---

## Contributing

We want contributions. Specifically these:

**Good first issues** (labeled `good-first-issue`):
- Add a new NSE sector mapping for a missing symbol
- Add a technical indicator to `quant/core.py`
- Add a macro event to the calendar
- Write a test for an untested function

**Research issues** (labeled `research`):
- Implement Fama-French 3-factor model
- Add NSE options open interest as a factor
- Research 52-week high momentum factor for Indian equities

See CONTRIBUTING.md for setup instructions and code standards.

---

## Disclaimer

QuantOracle is a research tool. Nothing here is financial advice. The signal IC and backtest results are historical — they do not guarantee future performance. Use your own judgment.

---

## License

MIT. See LICENSE.
