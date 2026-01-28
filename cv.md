# QuantOracle (Personal Project)

QuantOracle is a multi-asset portfolio intelligence and quant research dashboard built with Streamlit and Plotly. It combines market data retrieval, technical analysis, portfolio analytics, and news aggregation into a single UI, with an architecture roadmap for scalable, walk-forward validated quant ML.

## Resume / CV Description (Current)

Built QuantOracle, a multi-asset portfolio intelligence dashboard (India + US equities, crypto, forex) that provides technical analysis, portfolio analytics, and market news in a single Streamlit app.

- Implemented multi-source market data retrieval with fallbacks (Yahoo Finance + optional IndianAPI), plus caching to reduce repeat calls.
- Built technical analysis tooling (candlesticks + RSI, MACD, Stochastic, ATR, Bollinger Bands) with interactive Plotly visualizations.
- Added portfolio analytics and risk views including VaR, beta/correlation, drawdown, and simple rebalance suggestions.
- Implemented news aggregation using APIs and RSS fallback, including search and lightweight categorization.
- Created a pytest suite covering data-source behavior, fallbacks, and latency benchmarks, with GitHub Actions CI.
- Packaged deployment guidance for Streamlit Cloud (environment variables/secrets-based configuration).

Tech: Python, Streamlit, Plotly, pandas, numpy, requests, yfinance, pytest, GitHub Actions.

## Resume / CV Upgrade (After Phase 2–3)

If you implement the roadmap (data lake + feature store + validated ML), use this stronger version:

- Designed and deployed an EOD quant research pipeline (Parquet + DuckDB) to support fast querying across thousands of symbols.
- Built a walk-forward validated, multi-horizon alpha + risk forecasting system with versioned model artifacts and reproducible evaluation reports.
- Implemented long/short portfolio construction with user-defined constraints (gross/net exposure, max weights, sector caps) and risk-aware sizing.

