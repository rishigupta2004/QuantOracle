# QuantOracle

# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

<div align="center">

![Streamlit](https://img.shields.io/badge/Streamlit-1.28-FF4B4B?style=for-the-badge&logo=streamlit)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

**Multi-Asset Portfolio Intelligence System**

[Features](#features) • [Tech Stack](#tech-stack) • [Quick Start](#quick-start) • [Deployment](#deployment)

</div>

---

## 📊 Features

- **Portfolio Management** - Track holdings, calculate returns, rebalance suggestions
- **Technical Analysis** - RSI, MACD, Stochastic, ATR, Bollinger Bands with interactive charts
- **Quant ML** - Single-stock baselines + published EOD universe screener (artifact-driven)
- **Real-time News** - Market news aggregation from multiple sources
- **Multi-Asset Support** - Stocks (NSE, BSE, US), Crypto, Forex

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | Streamlit, Plotly |
| Data | yfinance, Alpha Vantage, IndianAPI |
| ML | Baselines + ridge (offline training, published artifacts) |
| Database | Supabase (optional) |
| Testing | pytest, pytest-cov |
| Linting | ruff |

---

## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/rishi-gupta-007/QuantOracle.git
cd QuantOracle

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# or: .\venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run locally
streamlit run frontend/app.py
```

The app will open at `http://localhost:8501`

---

## 📁 Project Structure

```
QuantOracle/
├── frontend/
│   ├── app.py              # Streamlit entry point
│   ├── theme.py            # Custom theme & utilities
│   ├── views/              # Page components
│   │   ├── dashboard.py    # Market overview dashboard
│   │   ├── markets.py      # Charts & technical analysis
│   │   ├── portfolio.py    # Holdings management
│   │   ├── risk.py         # Risk metrics (VaR, Beta)
│   │   ├── ml.py           # ML predictions
│   │   └── news.py         # Market news
│   ├── services/           # Business logic
│   │   └── market_data.py  # Market data APIs
│   └── utils/              # Utilities
│       ├── api.py          # Portfolio storage
│       ├── analytics.py    # Portfolio analytics
│       └── news_service.py # News aggregation
├── tests/                  # Test suite (1,265 lines)
│   ├── test_*.py           # Unit tests
│   ├── conftest.py         # Test fixtures
│   └── benchmark_runner.py # Performance benchmarks
├── requirements.txt        # Dependencies
├── pytest.ini              # Test configuration
├── README.md               # This file
└── STREAMLIT_DEPLOY.md     # Deployment guide
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Market Data APIs (optional - app works without them)
INDIANAPI_API_KEY=your_indianapi_key
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
NEWSDATA_API_KEY=your_newsdata_key
EODHD_API_KEY=your_eodhd_key

# Supabase (optional)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_BUCKET=quantoracle-artifacts

# Writer-only (GitHub Actions publisher). Do NOT set this in Streamlit Cloud.
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

> **Note**: The app works without any API keys using free yfinance data.

---

## 📈 Features Overview

### Dashboard
Real-time market overview with NIFTY 50, S&P 500, Bitcoin, USD/INR, and Gold metrics.

### Markets
Interactive charts with:
- Candlestick price data
- Technical indicators (RSI, MACD, Stochastic, ATR)
- Signal scores and trend analysis
- Multi-timeframe support (1D to 5Y)

### Portfolio
- Add/remove holdings
- Real-time valuation
- Return calculations
- Rebalancing suggestions

### Quant ML
- **Single Stock**: on-demand baselines (fast, always available).
- **Market Screener (EOD)**: a published daily snapshot across a universe (e.g., NIFTY 50).

### Risk Analysis
- Value at Risk (VaR)
- Maximum Drawdown
- Beta calculation
- Correlation analysis

---


---

## 🏗️ Architecture (Current vs Published EOD)

### Current (v0.x)
- Streamlit UI fetches **live data** from Yahoo Finance (`yfinance`) and optional IndianAPI/News APIs.
- Uses `st.cache_data` to reduce repeated calls within a running Streamlit session.

### Published EOD (Option B)
- A scheduled publisher runs after market close, builds features + trains a model, and uploads artifacts to **Supabase Storage** (public bucket).
- Streamlit Cloud reads the latest published snapshot and stays responsive (no training in the UI).

### Local Publisher (manual)
```bash
python scripts/publish_eod.py --universe-file data/universe/nifty50.txt --universe-name nifty50 --horizon 5
```

## 🗺️ Roadmap (Phases 0–3)

### Phase 0 — Safety + Scope
- Remove/rotate real secrets; keep only `.env.example` and Streamlit Cloud secrets.
- Split dependencies into app vs training (avoid shipping heavy training libs to Streamlit runtime).

### Phase 1 — Correctness + Trust
- Fix risk math and wiring (drawdown, portfolio totals/returns).
- Fix timeframe handling (`period` vs `interval`) to reduce empty data and wasted fetches.
- Remove/label placeholder “live-looking” metrics.

### Phase 2 — Performance
- Enforce one-fetch rule (reuse OHLCV for indicators/models; no duplicate yfinance calls).
- Batch quote/history fetching for watchlists/portfolios.
- Add minimal logging/observability for data-source failures.

### Phase 3 — Real Quant ML (India-first, long/short)
- Data lake (Parquet) + DuckDB queries + feature store.
- Multi-horizon targets (1D/5D/20D) + walk-forward / purged CV.
- Cross-sectional ranking + single-symbol deep dives from the same model outputs.
- Portfolio construction for long/short with user-chosen constraints.


## 🧪 Testing

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=frontend --cov-report=html

# Run benchmarks
python tests/benchmark_runner.py --quick
```

**Test Coverage:**
- Data source accuracy
- Fallback chain reliability
- API latency benchmarks
- Portfolio analytics
- Search functionality

---

## 🚀 Deployment

See [STREAMLIT_DEPLOY.md](STREAMLIT_DEPLOY.md) for detailed deployment instructions.

### Streamlit Cloud (Recommended)

1. Push to GitHub
2. Go to [share.streamlit.io](https://share.streamlit.io)
3. Connect your repository
4. Set main file path: `frontend/app.py`
5. Add environment variables (optional)
6. Deploy - auto-deploys on every push

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📧 Contact

Rishi Gupta - [@rishigupta](https://twitter.com/rishigupta) - rishigupta.rg007@gmail.com

Project Link: [https://github.com/rishi-gupta-007/QuantOracle](https://github.com/rishi-gupta-007/QuantOracle)


## 🧠 ML Notes (Honest)

The current `ML` page contains **research-inspired heuristics** (rule-based signals and simple statistical projections) intended for education and fast iteration.

The roadmap introduces a **real quant ML pipeline** (offline training, walk-forward validation, versioned artifacts) while keeping heuristics as baselines/fallbacks.
