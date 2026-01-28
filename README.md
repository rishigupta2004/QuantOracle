# QuantOracle

QuantOracle is a Streamlit-based quant research + portfolio intelligence app focused on **India equities** (with optional multi-asset extras). It combines:
- interactive market charts + technical indicators
- portfolio + risk analytics
- an **EOD market screener** powered by a published feature snapshot + model artifacts (fast, deterministic UI)

The key design choice: **no training inside Streamlit**. A scheduled job publishes "last-good" artifacts to Supabase; Streamlit only reads them.

## What You Get

### App (Streamlit)
- Markets: candlesticks + indicators (RSI, MACD, SMAs, volatility)
- Portfolio: holdings, P/L, rebalance suggestions
- Risk: drawdown, beta/correlation, simple VaR-style metrics
- Quant ML:
  - Single Stock: fast on-demand baseline signals
  - Market Screener (EOD): cross-sectional ranking from the published daily snapshot

### EOD Screener Pipeline (recommended)
- Data source: **Groww Trade API** (EOD candles for NSE cash)
- Features: Parquet snapshot (DuckDB-readable)
- Model: ridge regression baseline
- Storage: **Supabase Storage** (public bucket for reads)
- Scheduler: **GitHub Actions** (writer-only secret uploads)

## Tech Stack

- Python 3.12
- Streamlit + Plotly
- pandas / numpy / requests
- DuckDB (Parquet reads/writes)
- Supabase Storage (artifact hosting)
- pytest + ruff
- GitHub Actions (daily publisher)

## Local Quick Start

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

streamlit run frontend/app.py
```

## Configuration

Create `.env` (optional for local dev):

```env
# Optional runtime keys (UI can run without these, but some live sources may be rate-limited)
INDIANAPI_API_KEY=
ALPHA_VANTAGE_API_KEY=
NEWSDATA_API_KEY=

# EOD screener reads (Streamlit Cloud uses these)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_BUCKET=quantoracle-artifacts

# Publisher-only (NEVER set in Streamlit Cloud)
SUPABASE_SERVICE_ROLE_KEY=
GROWW_API_KEY=
GROWW_API_SECRET=
```

## Deploy (Streamlit Cloud)

Streamlit Cloud deploys from your GitHub repo (not your local machine). You must **commit + push**.

1) Streamlit Cloud settings:
- Main file path: `streamlit_app.py`
- Python: 3.12

2) Streamlit Cloud secrets (TOML):
- `SUPABASE_URL`
- `SUPABASE_BUCKET`

Do **not** put Groww keys or `SUPABASE_SERVICE_ROLE_KEY` into Streamlit Cloud.

## Publish the Daily EOD Screener (GitHub Actions)

1) Create a Supabase Storage bucket (public):
- Bucket: `quantoracle-artifacts`
- Public: enabled

2) Add GitHub repo secrets (Settings -> Secrets and variables -> Actions):
- `SUPABASE_URL`
- `SUPABASE_BUCKET`
- `SUPABASE_SERVICE_ROLE_KEY` (writer-only)
- `GROWW_API_KEY`
- `GROWW_API_SECRET`

3) Run the workflow once:
- GitHub -> Actions -> **EOD Pipeline** -> **Run workflow**

On success, Supabase will contain:
- `eod/nifty50/latest.json`
- `eod/nifty50/features.parquet`
- `eod/nifty50/models/...`

Streamlit will automatically pick it up on refresh.

## Manual Publisher (local)

```bash
python scripts/publish_eod.py \
  --universe-file data/universe/nifty50.txt \
  --universe-name nifty50 \
  --horizon 5 \
  --provider groww
```

## Tests

```bash
pytest -q
```

## Roadmap (Real Quant ML)

- Model registry + walk-forward evaluation reports
- Stronger models (GBDT), better features, cross-sectional factor diagnostics
- Long/short portfolio construction with constraints (gross/net, caps, turnover, risk sizing)
- Persistent portfolio storage (Supabase DB) and scheduled universe updates

## Notes / Disclaimer

- Not investment advice.
- Data source availability and licensing vary by provider. NSE endpoints frequently block scraping; this repo avoids "scrape at runtime" for production reliability.

## License

MIT (see `LICENSE`).
