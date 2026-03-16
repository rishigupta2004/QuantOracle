"""QuantOracle - Dev Tool Entry Point.

This is a minimal Streamlit app for data exploration and pipeline developers.
The canonical UI is the Next.js app in web/.
"""

import streamlit as st
from datetime import datetime

st.set_page_config(page_title="QuantOracle Dev", layout="wide")

st.markdown(
    """
<style>
    .stApp { background-color: #0a0a0a; }
    h1, h2, h3 { color: #e8e8e8; }
</style>
""",
    unsafe_allow_html=True,
)

st.title("QuantOracle Dev Tool")
st.caption(f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

with st.sidebar:
    st.header("Data Explorer")
    st.markdown("---")

    symbols = st.multiselect(
        "Select symbols",
        ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS"],
        default=["RELIANCE.NS"],
    )

    data_type = st.selectbox("Data type", ["Quote", "Historical", "Indicators"])

if not symbols:
    st.info("Select symbols from the sidebar to explore data")
    st.stop()

if data_type == "Quote":
    from quant.data_sources import get_quote

    for sym in symbols:
        with st.expander(sym, expanded=True):
            st.json(get_quote(sym))

elif data_type == "Historical":
    from quant.data_sources import get_historical

    for sym in symbols:
        with st.expander(sym, expanded=True):
            df = get_historical(sym, "1mo")
            if not df.empty:
                st.dataframe(df.tail(10), use_container_width=True)
            else:
                st.warning("No data available")

elif data_type == "Indicators":
    from quant.data_sources import get_historical
    from quant.core import calculate_indicators

    for sym in symbols:
        with st.expander(sym, expanded=True):
            h = get_historical(sym, "6mo")
            if not h.empty:
                ind = calculate_indicators(h)
                st.json(ind)
            else:
                st.warning("No data available")
