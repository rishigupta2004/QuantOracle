"""Workspace plan entitlements + billing usage helpers."""

from __future__ import annotations

import os
from typing import Any

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


def workspace_id_from_env() -> str:
    return (os.getenv("QUANTORACLE_WORKSPACE_ID") or "default").strip() or "default"


def plan_from_env() -> str:
    return normalize_plan(os.getenv("QUANTORACLE_WORKSPACE_PLAN"))


def _coerce_float(v: Any) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _pretty_label(key: str) -> str:
    return key.replace("_", " ").replace("-", " ").strip().title() or "Usage"


def _normalize_meter(key: str, raw: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    used = _coerce_float(
        raw.get("used", raw.get("current", raw.get("consumed", raw.get("value", 0))))
    )
    limit = _coerce_float(
        raw.get("limit", raw.get("quota", raw.get("max", raw.get("allowed", 0))))
    )
    unit = str(raw.get("unit") or "").strip()
    label = str(raw.get("label") or _pretty_label(key))
    pct = float(min(100.0, used / limit * 100.0)) if limit > 0 else 0.0
    return {
        "key": str(key),
        "label": label,
        "used": used,
        "limit": limit,
        "unit": unit,
        "pct": pct,
    }


def extract_usage_meters(
    payload: dict[str, Any], *, max_items: int = 4
) -> list[dict[str, Any]]:
    if not isinstance(payload, dict):
        return []

    out: list[dict[str, Any]] = []

    meters = payload.get("meters")
    if isinstance(meters, list):
        for i, item in enumerate(meters):
            if not isinstance(item, dict):
                continue
            key = str(item.get("key") or item.get("name") or f"meter_{i}")
            m = _normalize_meter(key, item)
            if m:
                out.append(m)

    usage = payload.get("usage")
    if isinstance(usage, dict):
        for key, value in usage.items():
            m = _normalize_meter(
                str(key), value if isinstance(value, dict) else {"used": value}
            )
            if m:
                out.append(m)

    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for m in out:
        k = str(m.get("key") or "")
        if not k or k in seen:
            continue
        seen.add(k)
        deduped.append(m)

    return deduped[:max_items]


def plan_from_usage(payload: dict[str, Any]) -> str | None:
    if not isinstance(payload, dict):
        return None
    direct = payload.get("plan") or payload.get("tier")
    if isinstance(direct, str) and normalize_plan(direct) in PLAN_ORDER:
        return normalize_plan(direct)
    sub = payload.get("subscription")
    if isinstance(sub, dict):
        candidate = sub.get("plan") or sub.get("tier")
        if isinstance(candidate, str):
            return normalize_plan(candidate)
    return None


def fetch_workspace_usage(
    *,
    workspace_id: str | None = None,
    base_url: str | None = None,
    auth_token: str | None = None,
    timeout: int = 10,
) -> dict[str, Any]:
    wid = (workspace_id or workspace_id_from_env()).strip()
    base = (base_url or os.getenv("QUANTORACLE_API_BASE_URL") or "").strip().rstrip("/")
    if not base or not wid:
        return {}

    token = (auth_token or os.getenv("QUANTORACLE_BILLING_TOKEN") or "").strip()
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    url = f"{base}/billing/workspaces/{wid}/usage"
    try:
        r = requests.get(url, headers=headers, timeout=timeout)
        if r.status_code != 200:
            return {}
        data = r.json() or {}
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}
