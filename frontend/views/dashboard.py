# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

"""Dashboard - Portfolio overview"""

import streamlit as st
import plotly.graph_objects as go
import pytz
from datetime import datetime

from services.market_data import get_quotes, get_historical
from utils.news_service import market_news

# SET_PAGE_CONFIG_FIX_REMOVED

POPULAR_STOCKS = [
    # Major Indices
    "^NSEI",  # NIFTY 50
    "^BSESN",  # SENSEX
    "^NSEBANK",  # NIFTY BANK
    "^CNXIT",  # NIFTY IT
    "NIFTY_FIN_SERVICE.NS",  # FINNIFTY
    # Popular Stocks
    "RELIANCE.NS",
    "TCS.NS",
    "HDFCBANK.NS",
    "ICICIBANK.NS",
    "AAPL",
    "MSFT",
    "NVDA",
]

POPULAR_CRYPTO = ["BTC-USD", "ETH-USD", "SOL-USD", "DOGE-USD", "XRP-USD"]

INDICES = {
    "^NSEI": "NIFTY 50",
    "^BSESN": "SENSEX",
    "^NSEBANK": "NIFTY BANK",
    "^CNXIT": "NIFTY IT",
    "^GSPC": "S&P 500",
    "BTC-USD": "Bitcoin",
    "GC=F": "Gold",
}


def _status():
    now = datetime.now(pytz.UTC)
    ist = now.astimezone(pytz.timezone("Asia/Kolkata"))
    est = now.astimezone(pytz.timezone("America/New_York"))
    return (
        "OPEN" if 9.25 <= ist.hour + ist.minute / 60 < 15.5 else "CLOSED",
        "OPEN" if 9.5 <= est.hour + est.minute / 60 < 16 else "CLOSED",
        ist.strftime("%H:%M %Z"),
    )


def _create_chart(h, symbol, show_sma=True):
    """Create a beautiful candlestick chart with technical indicators"""
    fig = go.Figure()

    # Candlestick
    fig.add_trace(
        go.Candlestick(
            x=h.index,
            open=h["Open"],
            high=h["High"],
            low=h["Low"],
            close=h["Close"],
            name=symbol,
            increasing_line_color="#22C55E",
            decreasing_line_color="#EF4444",
        )
    )

    # SMA overlays
    if show_sma and len(h) >= 20:
        sma20 = h["Close"].rolling(20).mean()
        fig.add_trace(
            go.Scatter(
                x=h.index, y=sma20, name="SMA20", line=dict(color="#60A5FA", width=1.5)
            )
        )

    if show_sma and len(h) >= 50:
        sma50 = h["Close"].rolling(50).mean()
        fig.add_trace(
            go.Scatter(
                x=h.index, y=sma50, name="SMA50", line=dict(color="#A855F7", width=1.5)
            )
        )

    fig.update_layout(
        template="plotly_dark",
        height=450,
        xaxis_rangeslider_visible=False,
        hovermode="x unified",
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(l=50, r=50, t=80, b=50),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    fig.update_xaxes(
        showspikes=True, spikethickness=1, spikedash="dot", spikecolor="gray"
    )
    fig.update_yaxes(
        showspikes=True, spikethickness=1, spikedash="dot", spikecolor="gray"
    )

    return fig


def main():
    nse, us, tm = _status()
    st.title("📈 QuantOracle")

    # Market overview metrics
    c1, c2, c3, c4, c5, c6 = st.columns(6)

    with st.spinner("Loading market quotes..."):
        indices_quotes = get_quotes(
            [
                "^NSEI",
                "^BSESN",
                "^NSEBANK",
                "NIFTY_FIN_SERVICE.NS",
                "USDINR=X",
                "BTC-USD",
            ]
        )

    with c1:
        n = indices_quotes.get("^NSEI", {})
        price = n.get("price", 0)
        change = n.get("change_pct", 0)
        st.metric("NIFTY 50", f"{float(price):,.2f}", f"{float(change):+.2f}%")
    with c2:
        b = indices_quotes.get("^BSESN", {})
        price = b.get("price", 0)
        change = b.get("change_pct", 0)
        st.metric("SENSEX", f"{float(price):,.2f}", f"{float(change):+.2f}%")
    with c3:
        nb = indices_quotes.get("^NSEBANK", {})
        price = nb.get("price", 0)
        change = nb.get("change_pct", 0)
        st.metric("BANK NIFTY", f"{float(price):,.2f}", f"{float(change):+.2f}%")
    with c4:
        fn = indices_quotes.get("NIFTY_FIN_SERVICE.NS", {})
        price = fn.get("price", 0)
        change = fn.get("change_pct", 0)
        st.metric("FINNIFTY", f"{float(price):,.2f}", f"{float(change):+.2f}%")
    with c5:
        d = indices_quotes.get("USDINR=X", {})
        price = d.get("price", 0)
        change = d.get("change_pct", 0)
        st.metric("USD/INR", f"₹{float(price):,.2f}", f"{float(change):+.2f}%")
    with c6:
        bt = indices_quotes.get("BTC-USD", {})
        price = bt.get("price", 0)
        change = bt.get("change_pct", 0)
        st.metric("Bitcoin", f"${float(price):,.2f}", f"{float(change):+.2f}%")

    st.markdown("---")

    # Chart section with selectors
    col_chart, col_news = st.columns([3, 1])

    with col_chart:
        st.subheader("📊 Market Chart")

        # Symbol and timeframe selectors
        c_sym, c_tf, c_sma = st.columns([2, 1, 1])
        with c_sym:
            symbol = st.selectbox(
                "Select Symbol",
                options=POPULAR_STOCKS + POPULAR_CRYPTO,
                index=0,
                help="Choose any Indian or US stock, or cryptocurrency",
            )
        with c_tf:
            period = st.selectbox(
                "Timeframe",
                options=["1W", "2W", "1M", "3M", "6M", "1Y"],
                index=3,  # Default to 3M
                help="Select the chart period",
            )
        with c_sma:
            show_sma = st.toggle("Show SMA", value=True, help="Display SMA overlays")

        # yfinance supports periods like 5d/1mo/3mo/6mo/1y.
        # For 2W we fetch 1mo and slice to the last ~10 trading days.
        period_map = {
            "1W": ("5d", None),
            "2W": ("1mo", 10),
            "1M": ("1mo", None),
            "3M": ("3mo", None),
            "6M": ("6mo", None),
            "1Y": ("1y", None),
        }

        # Load and display chart
        with st.spinner(f"Loading {symbol} chart..."):
            yf_period, tail_n = period_map[period]
            h = get_historical(symbol, yf_period)
            if tail_n and not h.empty:
                h = h.tail(tail_n)

        if not h.empty:
            # Display price info
            latest_price = h["Close"].iloc[-1]
            prev_close = h["Close"].iloc[0] if len(h) > 0 else latest_price
            change = ((latest_price - prev_close) / prev_close) * 100

            c_price, c_change = st.columns(2)
            with c_price:
                # Handle currency for indices vs stocks
                if symbol.startswith("^"):
                    currency = "₹" if "NSE" in symbol or "BSE" in symbol else "$"
                else:
                    currency = "₹" if symbol.endswith(".NS") else "$"
                st.metric(
                    "Current Price",
                    f"{currency}{latest_price:,.2f}",
                )
            with c_change:
                st.metric("Period Change", f"{change:+.2f}%")

            # Display chart
            fig = _create_chart(h, symbol, show_sma)
            st.plotly_chart(
                fig,
                use_container_width=True,
                config={"scrollZoom": True},
                key=f"dash_chart_{symbol}_{period}_{int(show_sma)}",
            )

            with st.expander("📊 Market Pulse (Demo placeholders)", expanded=False):

                c_sector, c_vix, c_fii = st.columns(3)

                with c_sector:
                    st.markdown("**Sector Performance**")
                    st.write("• NIFTY IT: +1.2%")
                    st.write("• NIFTY PHARMA: +0.8%")
                    st.write("• NIFTY AUTO: +0.5%")
                    st.write("• NIFTY METAL: -0.3%")
                    st.write("• NIFTY ENERGY: -0.5%")

                with c_vix:
                    st.markdown("**India VIX**")
                    st.metric("VIX", "14.25", "-2.1%")
                    st.caption("Lower VIX = Less uncertainty")

                with c_fii:
                    st.markdown("**FII/DII Activity (Today)**")
                    st.write("• FII Sell: ₹2,500 Cr")
                    st.write("• DII Buy: ₹1,800 Cr")
                    st.write("• Net: -₹700 Cr")

        else:
            st.error(f"❌ No data available for {symbol}")

        with col_news:
            st.subheader("📰 Latest News")

            with st.spinner("Loading news..."):
                news = market_news()[:8]

            if news:
                for n in news:
                    with st.container():
                        st.markdown(f"**{n.get('headline', '')[:60]}...**")
                        st.caption(
                            f"{n.get('source', 'Unknown')} • {n.get('datetime', '')[:10]}"
                        )
                        st.divider()
            else:
                st.info("No news available")

    st.markdown("---")
    st.caption(f"🇮🇳 NSE: {nse} | 🇺🇸 US: {us} | {tm}")


if __name__ == "__main__":
    main()
