"""ML: single-stock baselines + published EOD screener."""

from __future__ import annotations

import os
from datetime import datetime

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st
import pytz

from services.market_data import (
    calculate_signal_score,
    get_historical,
    get_quote,
    indicators,
)
from services.remote_artifacts import sync_eod
from quant.portfolio import Constraints, build_long_short
from quant.rank import load_feature_snapshot, load_ridge_latest, predict_ridge, top_bottom
from quant.registry import latest_dir, load_meta


def _plot_price_with_lines(h: pd.DataFrame, lines: dict[str, pd.Series], title: str) -> go.Figure:
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=h.index, y=h["Close"], name="Price", line=dict(color="white", width=2)))
    for name, series in lines.items():
        fig.add_trace(go.Scatter(x=h.index, y=series, name=name, line=dict(width=1.5)))
    fig.update_layout(template="plotly_dark", height=480, title=title, margin=dict(l=20, r=20, t=60, b=20))
    return fig


def _baseline_ma(h: pd.DataFrame):
    close = h["Close"].astype(float)
    sma20 = close.rolling(20).mean()
    sma50 = close.rolling(50).mean()
    if pd.isna(sma50.iloc[-1]):
        return None
    bullish = sma20.iloc[-1] > sma50.iloc[-1]
    ratio = float(sma20.iloc[-1] / sma50.iloc[-1] - 1)
    conf = float(np.clip(50 + abs(ratio) * 8000, 50, 90))
    trend = "BULLISH" if bullish else "BEARISH"
    fig = _plot_price_with_lines(h, {"SMA20": sma20, "SMA50": sma50}, "Baseline: Moving Average")
    return trend, conf, fig, [f"SMA20 {'>' if bullish else '<='} SMA50"]


def _baseline_multifactor(ind: dict, h: pd.DataFrame):
    ss = calculate_signal_score(ind)
    fig = _plot_price_with_lines(h, {}, "Baseline: Multi-factor Technical Score")
    reasons = [s[2] for s in ss.get("signals", [])]
    return ss["trend"], float(ss["confidence"]), fig, reasons


def _baseline_mean_reversion(ind: dict, h: pd.DataFrame):
    if not ind:
        return None
    price = ind["price"]
    bb_u, bb_l = ind["bb_upper"], ind["bb_lower"]
    rsi = ind.get("rsi", 50.0)

    score = 0
    reasons = []
    if price <= bb_l * 1.02:
        score += 2
        reasons.append("Near lower Bollinger band")
    if rsi < 30:
        score += 1
        reasons.append(f"RSI oversold ({rsi:.1f})")
    if price >= bb_u * 0.98:
        score -= 2
        reasons.append("Near upper Bollinger band")
    if rsi > 70:
        score -= 1
        reasons.append(f"RSI overbought ({rsi:.1f})")

    if score >= 2:
        trend, conf = "BUY", 80
    elif score >= 1:
        trend, conf = "WEAK BUY", 65
    elif score <= -2:
        trend, conf = "SELL", 80
    elif score <= -1:
        trend, conf = "WEAK SELL", 65
    else:
        trend, conf = "NEUTRAL", 50

    close = h["Close"].astype(float)
    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20

    fig = _plot_price_with_lines(h, {"BB Upper": bb_upper, "BB Lower": bb_lower}, "Baseline: Mean Reversion")
    return trend, float(conf), fig, reasons[:4] or ["No strong mean-reversion signal"]


def main():
    st.title("Quant ML")
    st.caption("Single Stock is on-demand. Market Screener is EOD (published after close).")

    tab_signal, tab_rank = st.tabs(["Single Stock", "Market Screener (EOD)"])

    with tab_signal:
        model = st.selectbox(
            "Method",
            [
                "Baseline: Moving Average",
                "Baseline: Multi-factor Technical Score",
                "Baseline: Mean Reversion",
                "Quant ML: Ridge (if trained)",
            ],
        )

        popular = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "AAPL", "MSFT", "NVDA", "BTC-USD"]
        c1, c2 = st.columns([2, 1])
        custom = c1.text_input("Symbol", placeholder="RELIANCE.NS / AAPL / BTC-USD")
        pick = c2.selectbox("Quick Picks", [""] + popular)
        sym = (custom or pick).strip().upper()
        if not sym:
            st.stop()

        h = get_historical(sym, "1y")
        if h.empty:
            artifacts = bool((os.getenv("SUPABASE_URL") or "").strip() and (os.getenv("SUPABASE_BUCKET") or "").strip())
            if artifacts and sym.endswith((".NS", ".BO")):
                st.error(f"❌ No published historical data for {sym} yet.")
                st.info(
                    "India OHLCV is served from the EOD publisher (GitHub Actions → EOD Pipeline). "
                    "Run it once via workflow_dispatch to seed Supabase, then it refreshes after market close."
                )
            else:
                st.error(f"No historical data for {sym}")
            return

        ind = indicators(h)
        if not ind:
            st.error(f"Not enough data to compute indicators for {sym}")
            return

        q = get_quote(sym)
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Price", f"{q.get('price', 0):,.2f}", f"{q.get('change_pct', 0):+.2f}%")
        c2.metric("RSI", f"{ind.get('rsi', 0):.1f}")
        c3.metric("ATR%", f"{ind.get('atr_pct', 0):.2f}%")
        c4.metric("Vol Ratio", f"{ind.get('vol_ratio', 0):.2f}")

        if model == "Baseline: Moving Average":
            out = _baseline_ma(h)
        elif model == "Baseline: Multi-factor Technical Score":
            out = _baseline_multifactor(ind, h)
        elif model == "Baseline: Mean Reversion":
            out = _baseline_mean_reversion(ind, h)
        else:
            model_dir = latest_dir("ridge_h5")
            if not model_dir:
                st.info("No trained model found. Run: `python scripts/build_features.py` then `python scripts/train_ridge.py`.")
                return
            m = load_meta(model_dir)
            z = np.load(model_dir / "model.npz", allow_pickle=True)
            feats = list(z["features"])
            mu, sig, w = z["mu"], z["sig"], z["w"]

            close = h["Close"].astype(float)
            feat_row = {
                "ret_1d": float(close.pct_change(1).iloc[-1]),
                "ret_5d": float(close.pct_change(5).iloc[-1]),
                "ret_20d": float(close.pct_change(20).iloc[-1]),
                "vol_20d": float(close.pct_change().rolling(20).std().iloc[-1]),
                "price_sma20": float(close.iloc[-1] / close.rolling(20).mean().iloc[-1] - 1),
                "price_sma50": float(close.iloc[-1] / close.rolling(50).mean().iloc[-1] - 1),
                "rsi_14": float(ind.get("rsi", 50.0)),
            }
            x = np.array([feat_row[f] for f in feats], dtype=float)
            xz = (x - mu) / sig
            pred = float(xz @ w)
            trend = "BULLISH" if pred > 0 else "BEARISH"
            conf = float(np.clip(50 + min(40, abs(pred) * 2000), 50, 90))
            out = (trend, conf, _plot_price_with_lines(h, {}, "Quant ML: Ridge (EOD)"), [f"Predicted {m['horizon']}-day return: {pred:+.2%}", f"IC (offline): {m.get('ic', 0):.4f}"])

        if not out:
            st.info("Model unavailable for this symbol/timeframe.")
            return

        trend, conf, fig, reasons = out
        st.subheader("Signal")
        st.write(f"{trend} ({conf:.0f}%)")
        for r in reasons:
            st.write(f"- {r}")

        st.plotly_chart(
            fig,
            use_container_width=True,
            config={"scrollZoom": True},
            key=f"ml_chart_{sym}_{model}",
        )

    with tab_rank:
        # Pull latest published snapshot from Supabase (public bucket) if configured.
        latest = sync_eod(os.getenv("QUANTORACLE_EOD_PREFIX", "eod/nifty50"))
        if latest:
            as_of = latest.get("as_of_date") or ""
            st.caption(f"As of: {as_of} IST | Universe: NIFTY 50 ({latest.get('universe_size', 50)})")
            try:
                ist_today = datetime.now(pytz.timezone("Asia/Kolkata")).date()
                if as_of and pd.to_datetime(as_of).date() < ist_today:
                    st.info("Today’s EOD snapshot publishes after market close (15:30 IST). Showing last close.")
            except Exception:
                pass

        try:
            meta, model = load_ridge_latest(5)
            snap = load_feature_snapshot()
        except RuntimeError as e:
            st.error(str(e))
            st.info("Install deps: `pip install -r requirements.txt`.")
            return
        if meta is None or model is None or snap.empty:
            st.info("No EOD snapshot published yet. Run `python scripts/publish_eod.py` or wait for the scheduled publisher.")
            return

        preds = predict_ridge(snap, model)
        top, bottom = top_bottom(preds, n=10)
        st.subheader("Top / Bottom (Predicted)")
        c1, c2 = st.columns(2)
        c1.dataframe(top, use_container_width=True, hide_index=True)
        c2.dataframe(bottom, use_container_width=True, hide_index=True)

        st.subheader("Long/Short Portfolio (Heuristic)")
        long_n = st.slider("Longs", 5, 50, 10)
        short_n = st.slider("Shorts", 5, 50, 10)
        gross = st.slider("Gross Exposure", 0.5, 3.0, 1.0, 0.1)
        net = st.slider("Net Exposure", -0.5, 0.5, 0.0, 0.05)
        max_w = st.slider("Max |Weight|", 0.01, 0.25, 0.10, 0.01)

        c = Constraints(long_n=long_n, short_n=short_n, gross=gross, net=net, max_abs_weight=max_w)
        pred_map = dict(zip(preds["symbol"], preds["pred"]))
        risk_map = dict(zip(preds["symbol"], preds["risk"]))
        w = build_long_short(pred_map, risk_map, c)
        if not w:
            st.info("No portfolio produced (insufficient data).")
            return

        out = pd.DataFrame({"symbol": list(w.keys()), "weight": list(w.values())}).sort_values("weight", ascending=False)
        st.dataframe(out, use_container_width=True, hide_index=True)


if __name__ == "__main__":
    main()
