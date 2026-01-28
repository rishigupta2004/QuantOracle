# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

"""QuantOracle - Main App"""

from __future__ import annotations

import sys
import time
from datetime import datetime
from pathlib import Path

import pytz
import streamlit as st
import streamlit_shadcn_ui as ui
from theme import apply_theme

# Streamlit sets sys.path to the script directory (`frontend/`). Add repo root so `quant/` is importable.
_ROOT = str(Path(__file__).resolve().parents[1])
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

apply_theme()

PAGES = ["Dashboard", "Markets", "Portfolio", "Risk", "ML", "News", "Updates"]


def _init_session_state():
    if "page" not in st.session_state:
        st.session_state.page = "Dashboard"
    if "portfolio_cache" not in st.session_state:
        st.session_state.portfolio_cache = {"timestamp": None, "data": []}
    if "quotes_cache" not in st.session_state:
        st.session_state.quotes_cache = {}
    if "last_page" not in st.session_state:
        st.session_state.last_page = None
    if "page_load_time" not in st.session_state:
        st.session_state.page_load_time = {}


def _market_status():
    now = datetime.now(pytz.UTC)
    ist = now.astimezone(pytz.timezone("Asia/Kolkata"))
    nse = "OPEN" if 9.25 <= ist.hour + ist.minute / 60 < 15.5 else "CLOSED"
    est = now.astimezone(pytz.timezone("America/New_York"))
    us = "OPEN" if 9.5 <= est.hour + est.minute / 60 < 16 else "CLOSED"
    return nse, us, ist.strftime("%H:%M %Z")


def main():
    _init_session_state()

    with st.sidebar:
        st.title("📈 QuantOracle")
        st.caption("Multi-Asset Portfolio Intelligence")

        nse, us, tm = _market_status()
        c1, c2 = "🟢" if nse == "OPEN" else "🔴", "🟢" if us == "OPEN" else "🔴"
        st.markdown(
            f"**Market Status**\n\n{c1} NSE: **{nse}** | {c2} US: **{us}**\n\n{tm}"
        )

        st.markdown("---")

        # Navigation with shadcn buttons
        for page_name in PAGES:
            if ui.button(page_name, key=f"nav_{page_name}", className="w-full"):
                st.session_state.page = page_name

        st.markdown("---")

        # Portfolio summary
        holdings = len(st.session_state.get("holdings", []))
        st.markdown(f"**Portfolio**\n\n{holdings} positions")

        st.markdown("---")
        st.markdown("**QuantOracle v0.5**\n\nData: Yahoo, AlphaVantage, IndianAPI")

    start_time = time.time()

    # Use persistent session state for page navigation
    page = st.session_state.page

    if page == "Dashboard":
        from views.dashboard import main as dashboard

        dashboard()
    elif page == "Markets":
        from views.markets import main as markets

        markets()
    elif page == "Portfolio":
        from views.portfolio import main as portfolio

        portfolio()
    elif page == "Risk":
        from views.risk import main as risk

        risk()
    elif page == "ML":
        from views.ml import main as ml

        ml()
    elif page == "News":
        from views.news import main as news

        news()
    elif page == "Updates":
        from views.updates import main as updates

        updates()

    load_time = time.time() - start_time
    st.session_state.page_load_time[page] = load_time

    st.sidebar.markdown("---")
    st.caption(
        f"QuantOracle v0.5 | {nse} | {us} | {datetime.now().strftime('%H:%M:%S')}"
    )


if __name__ == "__main__":
    main()
