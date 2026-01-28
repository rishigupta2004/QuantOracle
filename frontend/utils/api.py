"""Session-state portfolio storage (no backend)."""

from __future__ import annotations

from typing import Dict, List

import streamlit as st


def save_portfolio(name: str, holdings: List[Dict]) -> None:
    st.session_state.setdefault("portfolios", {})[name] = holdings


def load_portfolio(name: str) -> List[Dict]:
    return st.session_state.get("portfolios", {}).get(name, [])


def holdings() -> List[Dict]:
    return st.session_state.get(
        "holdings",
        [
            {"symbol": "RELIANCE.NS", "quantity": 50, "avg_cost": 2400},
            {"symbol": "TCS.NS", "quantity": 20, "avg_cost": 3800},
            {"symbol": "AAPL", "quantity": 10, "avg_cost": 175},
        ],
    )


def add_holding(symbol: str, quantity: float, avg_cost: float) -> None:
    st.session_state.setdefault("holdings", []).append(
        {"symbol": symbol, "quantity": float(quantity), "avg_cost": float(avg_cost)}
    )


def remove_holding(index: int) -> None:
    h = st.session_state.get("holdings", [])
    if 0 <= index < len(h):
        h.pop(index)

