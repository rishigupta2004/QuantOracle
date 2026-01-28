# QuantOracle (Personal Project)

QuantOracle is an India-first quant research + portfolio intelligence app built in Python/Streamlit. It delivers interactive market analytics and an artifact-driven EOD "market screener" pipeline (fast UI, offline training).

## Resume-Ready Description (paste this)

Built QuantOracle, a quant research and portfolio analytics dashboard with a production-style EOD model publishing workflow.

- Shipped a Streamlit + Plotly app for market analysis (candlesticks + indicators), portfolio tracking, and risk views (drawdown, beta/correlation, VaR-style metrics).
- Designed an offline EOD pipeline that builds a feature snapshot (Parquet + DuckDB) and trains a baseline ridge model, then publishes "last-good" artifacts for deterministic serving.
- Implemented artifact hosting + delivery using Supabase Storage (public reads) and GitHub Actions (writer-only uploads via service role key).
- Added a cross-sectional market screener that ranks a universe (e.g., NIFTY 50) from the latest published snapshot and clearly surfaces "as-of" freshness.
- Built a test suite (pytest) and CI checks (ruff + GitHub Actions) to keep refactors safe and prevent regressions.

Tech: Python, Streamlit, Plotly, pandas, numpy, DuckDB, Supabase, GitHub Actions, pytest, ruff.

