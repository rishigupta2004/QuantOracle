"""Updates / Roadmap page."""

from __future__ import annotations

import streamlit as st


def main():
    st.title("Updates")
    st.caption("What the app does today, how data updates, and what’s next.")

    st.subheader("Live Now")
    st.write("- Single Stock: charts + indicators + baseline signals (on-demand).")
    st.write("- Market Screener (EOD): published after market close (shows last close during market hours).")
    st.write("- Portfolio + Risk: basic tracking + metrics.")

    st.subheader("How EOD Updates Work")
    st.write("- A scheduled publisher runs after market close and uploads a new snapshot.")
    st.write("- If the publisher fails, the app keeps serving the last good snapshot (no breaking changes).")

    st.subheader("Coming Next")
    st.write("- Bigger universes (NIFTY 100/200/500) once data is stable.")
    st.write("- Better models + walk-forward evaluation reports.")
    st.write("- Long/short portfolio constraints: turnover, transaction costs, exposure limits.")

