# QuantOracle

India-first quant research + portfolio intelligence app (Streamlit) with an EOD market screener pipeline.

[![CI](https://github.com/rishigupta2004/QuantOracle/actions/workflows/ci.yml/badge.svg)](https://github.com/rishigupta2004/QuantOracle/actions/workflows/ci.yml)
[![EOD Pipeline](https://github.com/rishigupta2004/QuantOracle/actions/workflows/eod_pipeline.yml/badge.svg)](https://github.com/rishigupta2004/QuantOracle/actions/workflows/eod_pipeline.yml)
[![Python](https://img.shields.io/badge/python-3.12-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## TL;DR

- UI: charts, portfolio, risk, and an ML page
- EOD screener: daily snapshot + model artifacts published by GitHub Actions
- Serving: Streamlit reads artifacts from Supabase Storage (fast, deterministic; no training in the UI)

## Features

Markets
- Interactive candlesticks + indicators (SMA, RSI, MACD, volatility)
- Multi-timeframe views (best effort based on data-source availability)

Portfolio
- Holdings, P/L, return metrics
- Basic rebalance suggestions

Risk
- Max drawdown
- Beta / correlation
- VaR-style summary metrics

Quant ML
- Single Stock: fast, on-demand baseline signals
- Market Screener (EOD): cross-sectional ranking across a universe (default: NIFTY 50)

## How It Works (Production-Style)

Streamlit Cloud storage is ephemeral. QuantOracle uses an artifact workflow:

1) Publisher (GitHub Actions, after market close)
- Fetches EOD candles (Groww Trade API)
- Builds a feature snapshot (Parquet; DuckDB-readable)
- Trains a baseline model (ridge)
- Uploads artifacts to Supabase Storage

2) UI (Streamlit Cloud)
- Downloads `latest.json` + `features.parquet` + model files
- Renders screener + ranks instantly

"Last-good snapshot" rule: `latest.json` is uploaded last, only after all required files succeed.

## Repository Layout

```text
frontend/          Streamlit app (pages, theme, services)
quant/             Core analytics + features + model helpers
scripts/           Publisher + diagnostics
tests/             pytest suite
streamlit_app.py   Streamlit Cloud entrypoint (repo root)
data/universe/     Universe lists (tracked)
```

## Run Locally

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

streamlit run frontend/app.py
```

## Deploy (Streamlit Cloud)

App settings:
- Main file path: `streamlit_app.py`
- Python: 3.12

Streamlit Cloud secrets (TOML):
```toml
SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
SUPABASE_BUCKET = "quantoracle-artifacts"
```

Do not put publisher secrets (Groww keys or `SUPABASE_SERVICE_ROLE_KEY`) into Streamlit Cloud.

## Enable the EOD Screener (Supabase + GitHub Actions)

1) Supabase Storage
- Create bucket: `quantoracle-artifacts`
- Set it to Public

2) GitHub Actions secrets (repo Settings -> Secrets and variables -> Actions)
- `SUPABASE_URL`
- `SUPABASE_BUCKET`
- `SUPABASE_SERVICE_ROLE_KEY` (writer-only)
- `GROWW_API_KEY`
- `GROWW_API_SECRET`

3) Run the publisher once
- GitHub -> Actions -> EOD Pipeline -> Run workflow

Artifacts will appear under:
`/storage/v1/object/public/<bucket>/eod/nifty50/latest.json`

## Manual Publish (Local)

```bash
python scripts/publish_eod.py \
  --universe-file data/universe/nifty50.txt \
  --universe-name nifty50 \
  --horizon 5 \
  --provider groww \
  --upload
```

## Quality Gates

```bash
pytest -q
ruff check frontend/ quant/ scripts/ tests/
```

## Roadmap (Next-Level Quant)

- Walk-forward evaluation reports + model registry/versioning UI
- Better models (GBDT) + broader feature set + factor diagnostics
- Long/short portfolio construction with constraints (gross/net, caps, turnover, risk sizing)
- Persistent portfolio storage (Supabase DB) + scheduled universe management
- Raise test coverage target to 90%+ (currently gated at 50% to move fast; increase once core pipeline is stable)

## Disclaimer

Not investment advice. Data source availability and licensing vary by provider.

## License

MIT - see `LICENSE`.
