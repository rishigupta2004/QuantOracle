---
title: QuantOracle
emoji: "📈"
colorFrom: "indigo"
colorTo: "pink"
sdk: docker
app_port: 7860
pinned: false
---

# QuantOracle

QuantOracle is an India-first quantitative research and portfolio intelligence platform built with Streamlit.
It combines data ingestion, feature engineering, model training, and an interactive web interface to help investors explore markets, construct portfolios, and analyze risk.

It uses a reproducible end-of-day (EOD) pipeline to automatically build feature snapshots and publish model artifacts so the UI loads quickly and deterministically.

**Live demo (Hugging Face Spaces):**
- Space page: `https://huggingface.co/spaces/thinkingEverytime/QuantOracle`
- App URL: `https://thinkingEverytime-quantoracle.hf.space/`

[![CI](https://github.com/rishigupta2004/QuantOracle/actions/workflows/ci.yml/badge.svg)](https://github.com/rishigupta2004/QuantOracle/actions/workflows/ci.yml)
[![EOD Pipeline](https://github.com/rishigupta2004/QuantOracle/actions/workflows/eod_pipeline.yml/badge.svg)](https://github.com/rishigupta2004/QuantOracle/actions/workflows/eod_pipeline.yml)
[![Intraday Quotes](https://github.com/rishigupta2004/QuantOracle/actions/workflows/intraday_quotes.yml/badge.svg)](https://github.com/rishigupta2004/QuantOracle/actions/workflows/intraday_quotes.yml)
[![Python](https://img.shields.io/badge/python-3.12-blue.svg)](#)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Table of Contents

- [Overview](#overview)
- [Why QuantOracle?](#why-quantoracle)
- [Features](#features)
- [Quantitative Models](#quantitative-models)
- [Data Sources](#data-sources)
- [Architecture](#architecture)
- [Visuals](#visuals)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Pipelines](#pipelines)
- [Repository Structure](#repository-structure)
- [Contributing & Testing](#contributing--testing)
- [License](#license)
- [Disclaimer](#disclaimer)
- [Contact](#contact)

## Overview

QuantOracle is a multi-asset research tool focused on the Indian market. Its Streamlit interface lets you:
- browse historical candlesticks,
- track holdings,
- analyze portfolio risk,
- run ML-style signal generation.

Behind the scenes, it ingests market data, engineers robust features from OHLCV time series, trains lightweight models (ridge regression + optional gradient boosting), and publishes artifacts so the UI is fast and deterministic (no training in the UI).

## Why QuantOracle?

- **India-first coverage**: focuses on NSE cash equities and ETFs.
- **End-to-end pipeline**: ingest OHLCV → features → model → publish artifacts.
- **Transparent models**: baselines + ridge regression are easy to reason about and extend.
- **Modular & open source**: clear separation of UI, analytics, and pipeline scripts.

## Features

### Markets

- Candlestick charts + technical indicators.
- Symbol search across tracked NSE universe (and best-effort global tickers).
- Live market status for NSE and US markets.

### Portfolio

- Enter holdings to view positions and profit/loss.
- Simple rebalance suggestions based on predictions + portfolio constraints.
- Caching to improve page load times.

### Risk

QuantOracle computes several risk metrics for a selected universe:

| Metric | Description |
|---|---|
| Value at Risk | Estimated daily loss at 95/99% confidence using return distribution |
| Max drawdown | Largest peak-to-trough decline over the selected lookback window |
| Beta / Correlation | Sensitivity to a market proxy (defaults to `NIFTYBEES.NS`) |

## Quantitative Models

### Single-stock baselines (on-demand)

- **Moving Average crossover**: SMA20/SMA50 crossover signals
- **Multi-factor technical score**: RSI + trend + volatility heuristics
- **Mean reversion**: Bollinger Bands + RSI oversold/overbought logic

### EOD Market Screener (published)

QuantOracle trains a ridge regression model on engineered features for cross-sectional ranking.
Default horizon is **5 trading days**. Features include:
- recent returns (1d/5d/20d),
- 20-day volatility,
- price deviations from SMA20/SMA50,
- RSI14.

Predictions yield ranked long/short candidates plus a constraint-based long/short portfolio (gross/net exposure + max per-name weight caps).

## Data Sources

- **India (NSE cash equities + ETFs)**: ingested via **Groww Trade API** in publisher workflows, uploaded as artifacts.
- **Indices**: represented using tradable ETF proxies (e.g., `NIFTYBEES.NS`, `BANKBEES.NS`, `ITBEES.NS`).
- **Global tickers / crypto**: best-effort via Yahoo Finance (UI convenience).
- **News**: NewsData.io and IndianAPI, with RSS fallbacks (including Google News RSS).

## Architecture

Because Hugging Face Spaces provide only temporary storage, QuantOracle separates data processing from the UI:

- **EOD pipeline (GitHub Actions, after close)**: fetches EOD candles (Groww), builds features, trains ridge model, uploads artifacts to Supabase Storage.
- **Intraday quotes (GitHub Actions, during market hours)**: publishes `quotes.json` for fast dashboard tiles.
- **UI (Hugging Face Spaces)**: downloads artifacts from Supabase (public bucket) and renders instantly (no training in the UI).

Diagram: `docs/images/architecture.svg`

## Visuals

Screenshots from the running app:

![Dashboard](https://raw.githubusercontent.com/rishigupta2004/QuantOracle/main/docs/images/screenshots/dashboard.png)
![Markets Overview](https://raw.githubusercontent.com/rishigupta2004/QuantOracle/main/docs/images/screenshots/markets_overview.png)
![Markets Chart](https://raw.githubusercontent.com/rishigupta2004/QuantOracle/main/docs/images/screenshots/markets_chart.png)
![Risk](https://raw.githubusercontent.com/rishigupta2004/QuantOracle/main/docs/images/screenshots/risk.png)
![ML (Single Stock)](https://raw.githubusercontent.com/rishigupta2004/QuantOracle/main/docs/images/screenshots/ml_single_stock.png)
![ML (Screener)](https://raw.githubusercontent.com/rishigupta2004/QuantOracle/main/docs/images/screenshots/ml_screener.png)
![News](https://raw.githubusercontent.com/rishigupta2004/QuantOracle/main/docs/images/screenshots/news.png)
![Updates](https://raw.githubusercontent.com/rishigupta2004/QuantOracle/main/docs/images/screenshots/updates.png)

## Installation

### Prerequisites

- Python ≥ 3.12
- pip

### Setup

```bash
git clone https://github.com/rishigupta2004/QuantOracle.git
cd QuantOracle

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
# Optional (GBDT): pip install -r requirements-ml.txt
```

### Environment variables (optional)

```bash
# Groww API (publisher only)
export GROWW_API_KEY="<your_groww_key>"
export GROWW_API_SECRET="<your_groww_secret>"

# News providers (optional)
export NEWSDATA_API_KEY="<your_newsdata_key>"
export INDIANAPI_API_KEY="<your_indianapi_key>"

# Supabase for uploading artifacts (publisher only)
export SUPABASE_URL="https://<project-ref>.supabase.co"
export SUPABASE_BUCKET="<your_bucket>"
export SUPABASE_SERVICE_ROLE_KEY="<your_service_role_key>"
```

## Running the App

```bash
streamlit run streamlit_app.py
```

To point the app at locally-produced artifacts instead of pulling from Supabase, set:
- `QUANTORACLE_DATA_DIR` to a directory containing `features.parquet`, `models/...`, and `ohlcv/...`
- `QUANTORACLE_EOD_PREFIX` (default: `eod/nifty50`)

## Pipelines

### Intraday Quotes (publisher)

Publishes `quotes.json` (used for fast dashboard prices):

```bash
python scripts/publish_quotes.py --universe-file data/universe/india_core.txt --prefix eod/nifty50 --provider groww --upload
```

### End-of-Day (EOD) Pipeline (publisher)

Builds features + trains ridge + uploads artifacts (including per-symbol OHLCV parquet):

```bash
python scripts/publish_eod.py --universe-file data/universe/nifty50.txt \
  --universe-name nifty50 --horizon 5 --alpha 10.0 --history-days 365 --provider groww --upload
```

## Repository Structure

```text
frontend/          Streamlit UI (app, views, services, theme)
quant/             Core analytics, feature engineering, model helpers
scripts/           Data ingestion, feature building, model training & publishing
tests/             pytest suite
streamlit_app.py   Hugging Face Spaces entrypoint
data/universe/     Universe lists (tracked)
docs/images/       Diagrams + screenshots
```

## Contributing & Testing

```bash
ruff check .
pytest
```

## License

This project is licensed under the MIT License. See `LICENSE`.

## Disclaimer

QuantOracle is a research and educational tool and does not constitute investment advice. Use at your own discretion.

## Contact

For questions, support, or collaboration: `rishigupta.rg007@gmail.com`
