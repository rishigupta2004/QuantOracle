# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

"""Markets - Charts, Search, Technical Analysis"""

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from plotly.subplots import make_subplots

from services.market_data import (
    ETF,
    STOCK,
    get_historical,
    get_quote,
    get_quotes,
    get_trending,
    indicators,
    indicators_timeseries,
    normalize_symbol,
)

TF = {
    "1D": "1d",
    "5D": "5d",
    "1W": "5d",  # yfinance supports 5d, not 1wk as a period
    "1M": "1mo",
    "3M": "3mo",
    "6M": "6mo",
    "1Y": "1y",
    "5Y": "5y",
}


def _chart(sym: str, tf: str, *, key: str):
    normalized = normalize_symbol(sym)

    with st.spinner(f"Loading {normalized} data..."):
        period = TF.get(tf, tf)  # accept either UI key or already-normalized period string
        h = get_historical(normalized, period)

    if h.empty:
        st.error(f"""
❌ No data available for {sym}

This symbol may be delisted, too new, or not tracked by our data sources.

Try: RELIANCE.NS, TCS.NS, HDFCBANK.NS, NIFTYBEES.NS, GOLDBEES.NS
""")
        return

    with st.spinner("Calculating indicators..."):
        ind = indicators(h)
        ind_ts = indicators_timeseries(h)

    fig = make_subplots(
        rows=5,
        cols=1,
        shared_xaxes=True,
        subplot_titles=(
            f"{normalized} - {tf}",
            "RSI (14)",
            "MACD (12,26,9)",
            "Stochastic (14,3)",
            "ATR (14)",
        ),
        row_heights=[0.4, 0.12, 0.12, 0.12, 0.12],
        vertical_spacing=0.04,
    )

    fig.add_trace(
        go.Candlestick(
            x=h.index,
            open=h["Open"],
            high=h["High"],
            low=h["Low"],
            close=h["Close"],
            name=sym,
        ),
        row=1,
        col=1,
    )

    if "sma20" in ind_ts:
        fig.add_trace(
            go.Scatter(
                x=h.index,
                y=ind_ts["sma20"],
                name="SMA20",
                line=dict(color="yellow", width=1),
            ),
            row=1,
            col=1,
        )
    if "sma50" in ind_ts:
        fig.add_trace(
            go.Scatter(
                x=h.index,
                y=ind_ts["sma50"],
                name="SMA50",
                line=dict(color="orange", width=1),
            ),
            row=1,
            col=1,
        )

    if "rsi" in ind_ts:
        fig.add_trace(
            go.Scatter(
                x=h.index,
                y=ind_ts["rsi"],
                name="RSI",
                line=dict(color="cyan", width=1.5),
            ),
            row=2,
            col=1,
        )
        fig.add_hline(y=70, line_dash="dash", line_color="red", row=2, col=1)
        fig.add_hline(y=30, line_dash="dash", line_color="green", row=2, col=1)

    if "macd" in ind_ts:
        fig.add_trace(
            go.Scatter(
                x=h.index,
                y=ind_ts["macd"],
                name="MACD",
                line=dict(color="blue", width=1.5),
            ),
            row=3,
            col=1,
        )
        fig.add_trace(
            go.Scatter(
                x=h.index,
                y=ind_ts["macd_signal"],
                name="Signal",
                line=dict(color="orange", width=1.5),
            ),
            row=3,
            col=1,
        )
        fig.add_trace(
            go.Bar(
                x=h.index,
                y=ind_ts["macd_hist"],
                name="Histogram",
                marker_color=[
                    "green" if v >= 0 else "red" for v in ind_ts["macd_hist"].fillna(0)
                ],
            ),
            row=3,
            col=1,
        )

    if "stoch_k" in ind_ts:
        fig.add_trace(
            go.Scatter(
                x=h.index,
                y=ind_ts["stoch_k"],
                name="%K",
                line=dict(color="purple", width=1.5),
            ),
            row=4,
            col=1,
        )
        fig.add_trace(
            go.Scatter(
                x=h.index,
                y=ind_ts["stoch_d"],
                name="%D",
                line=dict(color="gray", width=1.5),
            ),
            row=4,
            col=1,
        )
        fig.add_hline(y=80, line_dash="dash", line_color="red", row=4, col=1)
        fig.add_hline(y=20, line_dash="dash", line_color="green", row=4, col=1)

    if "atr" in ind_ts:
        fig.add_trace(
            go.Scatter(
                x=h.index,
                y=ind_ts["atr"],
                name="ATR",
                line=dict(color="white", width=1.5),
                fill="tozeroy",
            ),
            row=5,
            col=1,
        )

    fig.update_layout(
        height=800,
        template="plotly_dark",
        xaxis_rangeslider_visible=False,
        showlegend=False,
        margin=dict(l=10, r=10, t=30, b=50),
        autosize=True,
    )

    st.plotly_chart(fig, use_container_width=True, key=key)

    q = get_quote(normalized)

    price_val = q.get("price", 0)
    pct_val = q.get("change_pct", 0)

    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Price", f"₹{price_val:,.2f}", f"{pct_val:+.2f}%")
    c2.metric("RSI", f"{ind.get('rsi', 0):.1f}")
    c3.metric("MACD", f"{ind.get('macd', 0):.2f}")
    c4.metric("Stoch %K", f"{ind.get('stoch_k', 0):.1f}")
    c5.metric("ATR", f"{ind.get('atr', 0):.2f}")


def main():
    st.title("📈 Markets")

    if "chart_symbol" not in st.session_state:
        st.session_state.chart_symbol = None
    if "chart_timeframe" not in st.session_state:
        st.session_state.chart_timeframe = "3M"
    if "chart_context" not in st.session_state:
        st.session_state.chart_context = ""

    tabs = st.tabs(["Overview", "Stocks", "ETFs", "F&O", "Search & Analyze"])

    with tabs[0]:  # Overview
        st.subheader("Market Overview")

        c1, c2, c3, c4 = st.columns(4)
        indices = get_quotes(["^NSEI", "^BSESN", "^NSEBANK", "NIFTY_FIN_SERVICE.NS"])

        c1.metric(
            "NIFTY 50",
            f"₹{indices.get('^NSEI', {}).get('price', 0):,.2f}",
            f"{indices.get('^NSEI', {}).get('change_pct', 0):+.2f}%",
        )
        c2.metric(
            "SENSEX",
            f"₹{indices.get('^BSESN', {}).get('price', 0):,.2f}",
            f"{indices.get('^BSESN', {}).get('change_pct', 0):+.2f}%",
        )
        c3.metric(
            "BANK NIFTY",
            f"₹{indices.get('^NSEBANK', {}).get('price', 0):,.2f}",
            f"{indices.get('^NSEBANK', {}).get('change_pct', 0):+.2f}%",
        )
        c4.metric(
            "FINNIFTY",
            f"₹{indices.get('NIFTY_FIN_SERVICE.NS', {}).get('price', 0):,.2f}",
            f"{indices.get('NIFTY_FIN_SERVICE.NS', {}).get('change_pct', 0):+.2f}%",
        )

        st.markdown("---")

        col1, col2 = st.columns(2)
        with col1:
            st.subheader("🚀 Top Gainers")
            trending = get_trending()
            if trending["gainers"]:
                for stock in trending["gainers"]:
                    stock_name = (
                        stock.get("symbol")
                        or stock.get("stock_symbol")
                        or stock.get("company_name")
                        or stock.get("nse_script_name")
                        or stock.get("ticker")
                        or stock.get("stockName")
                    )
                    pct = (
                        stock.get("percentChange")
                        or stock.get("change")
                        or stock.get("pChange")
                        or 0
                    )
                    price = (
                        stock.get("price")
                        or stock.get("currentPrice")
                        or stock.get("LTP")
                        or 0
                    )

                    if stock_name:
                        st.markdown(
                            f"""
                            <div style="background-color: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; border-radius: 5px; padding: 10px; margin-bottom: 10px;">
                                <span style="color: #22c55e; font-weight: bold;">{stock_name}</span>
                                <span style="float: right; color: #fff;">+{pct}% (₹{price})</span>
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )
            else:
                st.info("Market Closed / No Data")

        with col2:
            st.subheader("🔻 Top Losers")
            if trending["losers"]:
                for stock in trending["losers"]:
                    stock_name = (
                        stock.get("symbol")
                        or stock.get("stock_symbol")
                        or stock.get("company_name")
                        or stock.get("nse_script_name")
                        or stock.get("ticker")
                        or stock.get("stockName")
                    )
                    pct = (
                        stock.get("percentChange")
                        or stock.get("change")
                        or stock.get("pChange")
                        or 0
                    )
                    price = (
                        stock.get("price")
                        or stock.get("currentPrice")
                        or stock.get("LTP")
                        or 0
                    )

                    if stock_name:
                        st.markdown(
                            f"""
                            <div style="background-color: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; border-radius: 5px; padding: 10px; margin-bottom: 10px;">
                                <span style="color: #ef4444; font-weight: bold;">{stock_name}</span>
                                <span style="float: right; color: #fff;">{pct}% (₹{price})</span>
                            </div>
                            """,
                            unsafe_allow_html=True,
                        )
            else:
                st.info("Market Closed / No Data")

    def _render_stock_list(stocks: dict, key_prefix: str, tab_name: str):
        st.subheader(f"📊 {tab_name}")

        search_term = st.text_input("Filter", key=f"filter_{key_prefix}")
        items = []
        for sym, name in stocks.items():
            if (
                not search_term
                or search_term.lower() in sym.lower()
                or search_term.lower() in name.lower()
            ):
                items.append({"Symbol": sym, "Name": name})

        if items:
            df = pd.DataFrame(items)
            st.dataframe(df, use_container_width=True, hide_index=True)

            col_sel, col_tf, col_btn = st.columns([2, 1, 1])
            with col_sel:
                selected_row = st.selectbox(
                    "Select to Analyze",
                    df["Symbol"].tolist(),
                    key=f"select_{key_prefix}",
                )
            with col_tf:
                timeframe = st.selectbox(
                    "Period",
                    ["1D", "1W", "1M", "3M", "6M", "1Y"],
                    key=f"tf_{key_prefix}",
                )
            with col_btn:
                if st.button(
                    f"Analyze {selected_row}",
                    key=f"analyze_btn_{key_prefix}",
                    use_container_width=True,
                ):
                    st.session_state.chart_symbol = selected_row
                    st.session_state.chart_timeframe = TF.get(timeframe, "3mo")
                    st.session_state.chart_context = key_prefix
        else:
            st.info("No matches found.")

    def _render_chart_section(context: str):
        if st.session_state.get("chart_symbol") and st.session_state.get("chart_context") == context:
            with st.container():
                _, col_close = st.columns([0.96, 0.04])
                with col_close:
                    if st.button("×", key=f"close_chart_{context}", help="Close"):
                        st.session_state.chart_symbol = None
                        st.session_state.chart_context = ""
                _chart(
                    st.session_state.chart_symbol,
                    st.session_state.chart_timeframe,
                    key=f"mkts_chart_{context}_{st.session_state.chart_symbol}_{st.session_state.chart_timeframe}",
                )
                st.markdown("---")

    with tabs[1]:  # Stocks
        _render_stock_list(STOCK, "stocks", "NSE Stocks")
        _render_chart_section("stocks")

    with tabs[2]:  # ETFs
        _render_stock_list(ETF, "etfs", "ETFs")
        _render_chart_section("etfs")

    with tabs[3]:  # F&O
        fo_stocks = {
            k: v
            for k, v in STOCK.items()
            if k
            in [
                "RELIANCE.NS",
                "TCS.NS",
                "HDFCBANK.NS",
                "INFY.NS",
                "ICICIBANK.NS",
                "SBIN.NS",
                "TATAMOTORS.NS",
                "ITC.NS",
                "BHARTIARTL.NS",
                "L&T.NS",
            ]
        }
        _render_stock_list(fo_stocks, "fo", "F&O (Nifty 50)")
        _render_chart_section("fo")

    with tabs[4]:  # Search & Analyze
        st.subheader("Quick Search & Analyze")

        col_search, col_tf = st.columns([3, 1])
        with col_search:
            search_query = st.text_input(
                "Enter Symbol", placeholder="RELIANCE.NS, AAPL...", key="quick_search"
            )
        with col_tf:
            timeframe = st.selectbox(
                "Period", ["1D", "1W", "1M", "3M", "6M", "1Y"], key="search_tf"
            )

        if search_query.strip():
            try:
                _chart(
                    search_query.strip().upper(),
                    TF.get(timeframe, "3mo"),
                    key=f"mkts_search_{search_query.strip().upper()}_{timeframe}",
                )
            except Exception:
                st.error(f"No data available for {search_query}")


if __name__ == "__main__":
    main()
