# PROJECT

## QuantOracle — AI Financial Portfolio Manager & Stock Market Analyst (Personal Project)
# PROJECT

## QuantOracle — India-First Quant Research & Portfolio Intelligence Platform  
**Live Production App** | **Streamlit Cloud** | **Full CI/CD Pipeline** | **MIT License**

- **Architected and deployed** a comprehensive quantitative research platform for Indian equities featuring **real-time market analysis**, portfolio risk management, and machine learning-based stock screening across NSE cash equities, ETFs, and indices with integrated technical indicators and visualization dashboards.
- **Designed EOD automated ML pipeline** leveraging GitHub Actions for daily market screening; implemented **ridge regression model** (closed-form, no sklearn dependency) predicting 5-day forward returns using engineered features (**recent returns, volatility, SMA ratios, RSI14**) with published artifacts workflow for **instant UI rendering** on Streamlit Cloud.
- **Implemented multi-strategy trading signal framework** including **moving average crossovers** (SMA20/SMA50), multi-factor technical scoring, and mean reversion strategies (Bollinger Bands + RSI); generated **constraint-based long/short portfolios** with configurable gross/net exposure and per-name weight caps for risk-managed position sizing.
- **Built comprehensive risk analytics suite** calculating **VaR (95/99 percentile)**, maximum drawdown, beta, and correlation metrics against market proxies (NIFTYBEES.NS); integrated **portfolio P&L tracking**, holdings management, and rebalancing suggestions for quantitative portfolio optimization.
- **Engineered data pipeline** integrating **Groww Trade API** for reliable NSE EOD data with Yahoo Finance fallback; structured modular architecture (**frontend/quant/scripts/tests**) with **pytest suite**, CI/CD workflows, and **50% test coverage baseline**; deployed with ephemeral storage handling via published-artifacts pattern.
- **Impact:** Backtested strategies on **10 years of historical data** with transaction-cost-aware simulation (simulated $100M AUM); realized **~+2.0% annualized alpha vs benchmark** and **Sharpe ≈0.35**; reduced manual lookup/analysis time **~40%** via consolidated dashboards and feature snapshots.

**Technology Stack:** Python 3.12 | Streamlit | Pandas/NumPy | GitHub Actions | Parquet | Ridge Regression (custom implementation) | Technical Indicators (RSI, Bollinger Bands, Moving Averages) | Risk Metrics (VaR, Drawdown, Beta)  

**GitHub:** [QuantOracle Repository](https://github.com/rishigupta2004/QuantOracle) | **Live App:** [QuantOracle Streamlit](https://quantoracle-7udw2wxfmnspu4swpjlykc.streamlit.app)