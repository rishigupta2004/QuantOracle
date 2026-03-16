# QuantOracle

> The open-source quantitative research terminal for Indian equities.

![Demo](docs/images/demo.gif)

**[Live Terminal →](https://quant-oracle.vercel.app)**  |  
**[Quant Lab →](https://quant-oracle.vercel.app/lab)**  |  
**[Pipeline Status](https://github.com/rishigupta2004/QuantOracle/actions)**

---

## What it is

QuantOracle is a Bloomberg-style research terminal built for 
NSE-listed stocks — free, open source, and self-hostable.

It combines:
- **IC-weighted signal engine** — four non-correlated signal 
  categories with ADX filtering and walk-forward validation
- **Factor model screener** — cross-sectional ranking across 
  Nifty50 using momentum, quality, low-vol, and size factors
- **Quant Model Lab** — build and backtest your own factor 
  models against historical NSE data
- **Contextual AI analysis** — inline signal explanations 
  grounded in live indicator values, not generic commentary
- **Automated EOD pipeline** — validates, trains, and publishes 
  model artifacts daily via GitHub Actions

Zero paid dependencies. Every data source is free tier.

---

## Why this exists

Bloomberg covers Indian equities poorly for individual researchers.
Quant tools for NSE are either expensive or closed source.
QuantOracle is neither.

---

## Live metrics (walk-forward validated)

| Metric | Value |
|---|---|
| Universe | Nifty50 — 49 symbols validated |
| Signal IC (mean, walk-forward) | 0.174 |
| IC threshold to publish | 0.03 (model held back if below) |
| Pipeline cadence | Daily at 15:35 IST via GitHub Actions |
| Primary data source | Yahoo Finance (free, no key required) |
| Deployment | Vercel (web) + Supabase (artifacts) |

*IC = Information Coefficient. Measures signal predictive power.
0.174 on NSE walk-forward validation. Indian markets show stronger
factor signals than US markets due to lower institutional efficiency.*

---

## Signal engine design

Four non-overlapping signal categories. Never two signals 
from the same category — that's double-counting, not confirmation.

| Category | Indicator | Key design decision |
|---|---|---|
| Trend | EMA(21/55) + ADX | ADX < 20 → signal suppressed. No trend signals in sideways markets. |
| Momentum | MACD histogram | ATR-normalized. Comparable across ₹100 and ₹5,000 stocks. |
| Mean Reversion | RSI(14) | Dynamic thresholds. Each stock's own 252-day RSI distribution. |
| Volume | VWAP + OBV | Confirmation modifier, not a primary signal. |

Composite score is IC-weighted per symbol — signals that have 
historically predicted returns for *that specific stock* get 
more weight than signals that haven't.

---

## Quant Model Lab

Build and walk-forward validate your own factor models.

Available factors: 12-1M Momentum, Low Volatility, Quality (ROE), 
Low Leverage, Size. Custom formula syntax supported.

[→ Open the Lab](https://quant-oracle.vercel.app/lab)

**Lab roadmap:**
- v0.1 ✓ — Factor model construction + walk-forward backtest
- v0.2 — Custom factor formula builder with live IC preview
- v0.3 — LSTM sequence model on OHLCV
- v0.4 — NSE options OI + FII/DII alternative data
- v0.5 — Paper trading with live P&L tracking
- v1.0 — Multi-model ensemble with live signal generation

---

## Quick start
```bash
# Clone
git clone https://github.com/rishigupta2004/QuantOracle
cd QuantOracle

# Web terminal
cd web
cp .env.example .env.local   # Add Supabase URL + anon key
npm install && npm run dev
# Open http://localhost:3000 — press / to search

# Quant pipeline (Python)
cd ..
pip install -r requirements.txt
cp .env.example .env         # Add Supabase service role key
python -m quant.pipeline --universe nifty50 --dry-run
```

**Required env vars** (see `.env.example`):
- `SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — free Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` — pipeline uploads only
- `ANTHROPIC_API_KEY` — optional, AI explanations gracefully disabled without it
- `NEWSDATA_API_KEY` — optional, free tier at newsdata.io

---

## Architecture 
[Architecture diagram →](docs/images/architecture.svg)

---

## Contributing

We want contributions. Here's exactly where to start:

**Good first issues** (labeled `good-first-issue`):
- Add a technical indicator to `quant/core.py`
- Add NSE sector mappings for Nifty100 symbols  
- Add RBI MPC meeting dates to the macro calendar
- Write unit tests for CVaR in `quant/risk.py`

**Research issues** (labeled `research`):
- Implement Fama-French 3-factor model
- Add NSE options open interest as a factor
- Research 52-week high momentum factor for NSE

**Code standards in 4 lines:**
Python functions max 40 lines. No paid APIs. Tests required 
for all `quant/` functions. CSS variables only — no hardcoded hex.

See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup guide.

---

## Disclaimer

Research tool only. Not financial advice. Signal IC and backtest 
results are historical — past performance does not guarantee 
future returns. Validate all signals independently before acting.

---

## License

[MIT](LICENSE) — Use it, fork it, build on it.
