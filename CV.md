# QuantOracle (Personal Project)

QuantOracle is an India-first quant research + portfolio intelligence app built in Python/Streamlit. It delivers interactive market analytics and an artifact-driven EOD "market screener" pipeline (fast UI, offline training).

## Resume-Ready Description (paste this)

Built QuantOracle, a quant research and portfolio analytics dashboard with a production-style EOD model publishing workflow.

- Built a Streamlit + Plotly app for market analysis (candlesticks + indicators), portfolio tracking, and risk views (drawdown, beta/correlation, VaR-style metrics).
- Designed an offline EOD pipeline that builds a feature snapshot (Parquet + DuckDB), trains a baseline ridge model, and publishes versioned artifacts for deterministic serving.
- Implemented artifact hosting + delivery via Supabase Storage (public reads) and GitHub Actions (writer-only uploads via service role key) with a "last-good snapshot" publish rule.
- Added a cross-sectional market screener that ranks a universe (e.g., NIFTY 50) from the latest published snapshot and surfaces data freshness ("as-of" date).
- Added automated tests (pytest) and CI gates (ruff + GitHub Actions) to prevent regressions during aggressive refactors.

Tech: Python, Streamlit, Plotly, pandas, numpy, DuckDB, Supabase, GitHub Actions, pytest, ruff.
