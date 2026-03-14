"""Workspace plan entitlements + billing usage helpers."""

from __future__ import annotations

import os
import requests

PLAN_ORDER = {"starter": 0, "pro": 1, "terminal": 2}

PAGE_MIN_PLAN = {
    "Dashboard": "starter",
    "Markets": "starter",
    "Portfolio": "starter",
    "News": "starter",
    "Updates": "starter",
    "Risk": "pro",
    "ML": "terminal",
}

FEATURE_MIN_PLAN = {
    "basic_quotes": "starter",
    "market_news": "starter",
    "risk_analytics": "pro",
    "portfolio_rebalance": "pro",
    "ml_models": "terminal",
    "intraday_terminal": "terminal",
}


def normalize_plan(plan: str | None) -> str:
    p = (plan or "").strip().lower()
    return p if p in PLAN_ORDER else "starter"


def plan_satisfies(current_plan: str, required_plan: str) -> bool:
    return (
        PLAN_ORDER[normalize_plan(current_plan)]
        >= PLAN_ORDER[normalize_plan(required_plan)]
    )


def required_plan_for_page(page_name: str) -> str:
    return normalize_plan(PAGE_MIN_PLAN.get(page_name, "starter"))


def feature_enabled(feature: str, plan: str) -> bool:
    required = normalize_plan(FEATURE_MIN_PLAN.get(feature, "starter"))
    return plan_satisfies(plan, required)


def plan_from_env() -> str:
    return normalize_plan(os.getenv("QUANTORACLE_WORKSPACE_PLAN"))


def workspace_id_from_env() -> str:
    return (os.getenv("QUANTORACLE_WORKSPACE_ID") or "default").strip()


DEFAULT_LIMITS = {
    "starter": {
        "api_calls": 5000,
        "quote_requests": 4000,
        "news_requests": 1000,
        "alerts": 10,
    },
    "pro": {
        "api_calls": 50000,
        "quote_requests": 30000,
        "news_requests": 8000,
        "alerts": 100,
    },
    "terminal": {
        "api_calls": 300000,
        "quote_requests": 200000,
        "news_requests": 50000,
        "alerts": 500,
    },
}


def fetch_workspace_usage(base_url: str, workspace_id: str, auth_token: str) -> dict:
    """Fetch workspace usage from API."""
    if not base_url:
        return {}
    url = f"{base_url}/billing/workspaces/{workspace_id}/usage"
    headers = {}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    try:
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            return r.json() or {}
    except Exception:
        pass
    return {}


def plan_from_usage(usage_payload: dict) -> str | None:
    """Extract plan from usage payload."""
    return usage_payload.get("plan")


def extract_usage_meters(usage_payload: dict) -> list:
    """Extract usage meters from payload."""
    return usage_payload.get("meters", [])
