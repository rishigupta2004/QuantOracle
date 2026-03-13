# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

"""QuantOracle - Main App"""

from __future__ import annotations

import os
import sys
import time
from datetime import datetime
from pathlib import Path

import pytz
import streamlit as st
import streamlit_shadcn_ui as ui
from services import workspace_billing as wb
from theme import apply_theme

# When executed via repo-root `streamlit_app.py`, Streamlit's sys.path won't include `frontend/`.
_FRONTEND = str(Path(__file__).resolve().parent)
_ROOT = str(Path(__file__).resolve().parents[1])
for p in (_FRONTEND, _ROOT):
    if p not in sys.path:
        sys.path.insert(0, p)

apply_theme()

PAGES = ["Dashboard", "Markets", "Portfolio", "Risk", "ML", "News", "Updates"]


@st.cache_data(ttl=60, show_spinner=False)
def _cached_usage(base_url: str, workspace_id: str, auth_token: str) -> dict:
    return wb.fetch_workspace_usage(
        base_url=base_url,
        workspace_id=workspace_id,
        auth_token=auth_token,
    )


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
    if "workspace_plan" not in st.session_state:
        st.session_state.workspace_plan = wb.plan_from_env()
    if "workspace_id" not in st.session_state:
        st.session_state.workspace_id = wb.workspace_id_from_env()
    if "upgrade_modal_open" not in st.session_state:
        st.session_state.upgrade_modal_open = False
    if "upgrade_reason" not in st.session_state:
        st.session_state.upgrade_reason = ""


def _market_status():
    now = datetime.now(pytz.UTC)
    ist = now.astimezone(pytz.timezone("Asia/Kolkata"))
    nse = "OPEN" if 9.25 <= ist.hour + ist.minute / 60 < 15.5 else "CLOSED"
    est = now.astimezone(pytz.timezone("America/New_York"))
    us = "OPEN" if 9.5 <= est.hour + est.minute / 60 < 16 else "CLOSED"
    return nse, us, ist.strftime("%H:%M %Z")


def _open_upgrade_modal(reason: str) -> None:
    st.session_state.upgrade_modal_open = True
    st.session_state.upgrade_reason = reason


def _secret_or_env(key: str) -> str:
    try:
        v = st.secrets.get(key, "")
        if v:
            return str(v).strip()
    except Exception:
        pass
    return (os.getenv(key) or "").strip()


def _usage_to_text(used: float, limit: float, unit: str) -> str:
    if limit > 0:
        return f"{used:,.0f} / {limit:,.0f} {unit}".strip()
    return f"{used:,.0f} {unit}".strip()


def _plan_badge_html(plan: str) -> str:
    p = wb.normalize_plan(plan)
    colors = {
        "starter": ("#1f2937", "#93c5fd"),
        "pro": ("#052e16", "#86efac"),
        "terminal": ("#3f1d0f", "#fcd34d"),
    }
    bg, fg = colors.get(p, ("#1f2937", "#e5e7eb"))
    label = p.title()
    return (
        f"<span style='display:inline-block;padding:2px 10px;border-radius:999px;"
        f"background:{bg};color:{fg};font-weight:700;font-size:12px;letter-spacing:0.2px;'>"
        f"{label}</span>"
    )


def _render_workspace_header(plan: str, usage_payload: dict) -> None:
    wid = st.session_state.workspace_id
    c1, c2 = st.columns([4, 1])
    with c1:
        st.markdown(f"### Workspace `{wid}`")
    with c2:
        st.markdown(f"Plan {_plan_badge_html(plan)}", unsafe_allow_html=True)

    meters = wb.extract_usage_meters(usage_payload)
    if not meters:
        st.caption(
            "Usage meters unavailable (set QUANTORACLE_API_BASE_URL to enable real billing usage cards)."
        )
        return

    cols = st.columns(len(meters))
    for col, meter in zip(cols, meters):
        used = float(meter.get("used", 0.0) or 0.0)
        limit = float(meter.get("limit", 0.0) or 0.0)
        pct = float(meter.get("pct", 0.0) or 0.0)
        label = str(meter.get("label") or "Usage")
        unit = str(meter.get("unit") or "")
        with col:
            st.metric(
                label,
                _usage_to_text(used, limit, unit),
                f"{pct:.1f}%" if limit > 0 else "",
            )
            if limit > 0:
                st.progress(min(max(pct / 100.0, 0.0), 1.0))


def _render_upgrade_modal() -> None:
    if not st.session_state.upgrade_modal_open:
        return

    st.markdown("---")
    st.subheader("Upgrade Workspace")
    if st.session_state.upgrade_reason:
        st.info(st.session_state.upgrade_reason)

    cols = st.columns(3)
    plans = [
        (
            "starter",
            [
                "Core dashboard + markets",
                "Basic watchlist and portfolio",
                "Standard usage limits",
            ],
        ),
        (
            "pro",
            [
                "Everything in Starter",
                "Risk analytics and advanced portfolio tools",
                "Higher workspace usage limits",
            ],
        ),
        (
            "terminal",
            [
                "Everything in Pro",
                "ML page and terminal-grade features",
                "Highest usage limits",
            ],
        ),
    ]

    for col, (plan_name, bullets) in zip(cols, plans):
        with col:
            st.markdown(f"**{plan_name.title()}**")
            for item in bullets:
                st.caption(f"- {item}")
            if st.button(
                f"Switch to {plan_name.title()}",
                key=f"switch_plan_{plan_name}",
                use_container_width=True,
            ):
                st.session_state.workspace_plan = plan_name
                st.session_state.upgrade_modal_open = False
                st.session_state.upgrade_reason = ""
                st.rerun()

    if st.button("Close", key="close_upgrade_modal"):
        st.session_state.upgrade_modal_open = False
        st.session_state.upgrade_reason = ""
        st.rerun()
    st.markdown("---")


def main():
    _init_session_state()

    configured_plan = wb.normalize_plan(st.session_state.workspace_plan)
    env_base = _secret_or_env("QUANTORACLE_API_BASE_URL")
    auth_token = _secret_or_env("QUANTORACLE_BILLING_TOKEN")
    usage_payload = _cached_usage(env_base, st.session_state.workspace_id, auth_token)
    plan_from_usage = wb.plan_from_usage(usage_payload)
    active_plan = wb.normalize_plan(plan_from_usage or configured_plan)
    st.session_state.workspace_plan = active_plan

    with st.sidebar:
        st.title("📈 QuantOracle")
        st.caption("Multi-Asset Portfolio Intelligence")

        st.markdown(f"**Workspace:** `{st.session_state.workspace_id}`")
        st.markdown(_plan_badge_html(active_plan), unsafe_allow_html=True)
        if st.button("Upgrade", key="open_upgrade_modal", use_container_width=True):
            _open_upgrade_modal("Pick a plan to unlock more entitlements.")

        st.markdown("---")

        nse, us, tm = _market_status()
        c1, c2 = "🟢" if nse == "OPEN" else "🔴", "🟢" if us == "OPEN" else "🔴"
        st.markdown(
            f"**Market Status**\n\n{c1} NSE: **{nse}** | {c2} US: **{us}**\n\n{tm}"
        )

        st.markdown("---")

        # Navigation with shadcn buttons
        for page_name in PAGES:
            required = wb.required_plan_for_page(page_name)
            unlocked = wb.plan_satisfies(active_plan, required)
            label = page_name if unlocked else f"🔒 {page_name} ({required.title()})"
            if ui.button(label, key=f"nav_{page_name}", className="w-full"):
                if unlocked:
                    st.session_state.page = page_name
                else:
                    _open_upgrade_modal(
                        f"`{page_name}` requires `{required.title()}` plan. Current plan: `{active_plan.title()}`."
                    )

        st.markdown("---")

        # Portfolio summary
        holdings = len(st.session_state.get("holdings", []))
        st.markdown(f"**Portfolio**\n\n{holdings} positions")

        st.markdown("---")
        st.markdown("**QuantOracle v0.6**\n\nData: Yahoo, AlphaVantage, IndianAPI")

    _render_upgrade_modal()
    _render_workspace_header(active_plan, usage_payload)

    start_time = time.time()

    # Use persistent session state for page navigation
    page = st.session_state.page
    required = wb.required_plan_for_page(page)
    if not wb.plan_satisfies(active_plan, required):
        _open_upgrade_modal(f"`{page}` requires `{required.title()}` plan.")
        page = "Dashboard"
        st.session_state.page = "Dashboard"

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
        f"QuantOracle v0.6 | {nse} | {us} | {datetime.now().strftime('%H:%M:%S')}"
    )


if __name__ == "__main__":
    main()
