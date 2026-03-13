"""QuantOracle backend API (billing/workspace usage)."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException

app = FastAPI(title="QuantOracle API", version="0.1.0")

PLAN_ORDER = {"starter": 0, "pro": 1, "terminal": 2}

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


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_plan(plan: str | None) -> str:
    p = (plan or "").strip().lower()
    return p if p in PLAN_ORDER else "starter"


def plan_satisfies(current_plan: str, required_plan: str) -> bool:
    return (
        PLAN_ORDER[normalize_plan(current_plan)]
        >= PLAN_ORDER[normalize_plan(required_plan)]
    )


def entitlements_for_plan(plan: str) -> dict[str, bool]:
    p = normalize_plan(plan)
    return {
        "basic_quotes": True,
        "market_news": True,
        "risk_analytics": plan_satisfies(p, "pro"),
        "portfolio_rebalance": plan_satisfies(p, "pro"),
        "ml_models": plan_satisfies(p, "terminal"),
        "intraday_terminal": plan_satisfies(p, "terminal"),
    }


def _coerce_float(v: Any) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _load_store() -> dict[str, Any]:
    env_json = (os.getenv("QUANTORACLE_BILLING_STORE_JSON") or "").strip()
    if env_json:
        try:
            data = json.loads(env_json)
            if isinstance(data, dict):
                return data
        except Exception:
            pass

    default_path = Path("data/billing/workspaces.json")
    path = Path(
        (os.getenv("QUANTORACLE_BILLING_STORE_PATH") or "").strip() or default_path
    )
    try:
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    except Exception:
        return {}

    return {}


def _usage_record(workspace_id: str) -> dict[str, Any]:
    store = _load_store()
    raw = store.get(workspace_id)
    if not isinstance(raw, dict):
        raw = {}

    plan = normalize_plan(raw.get("plan") or os.getenv("QUANTORACLE_WORKSPACE_PLAN"))
    limits = DEFAULT_LIMITS.get(plan, DEFAULT_LIMITS["starter"])

    usage_raw = raw.get("usage") if isinstance(raw.get("usage"), dict) else {}
    usage: dict[str, dict[str, Any]] = {}

    for k, limit in limits.items():
        item = usage_raw.get(k) if isinstance(usage_raw, dict) else None
        if isinstance(item, dict):
            used = _coerce_float(item.get("used", 0))
            this_limit = _coerce_float(item.get("limit", limit)) or float(limit)
            unit = str(item.get("unit") or ("count" if k == "alerts" else "requests"))
        else:
            used = _coerce_float(item)
            this_limit = float(limit)
            unit = "count" if k == "alerts" else "requests"
        usage[k] = {"used": used, "limit": this_limit, "unit": unit}

    meters = [
        {
            "key": key,
            "label": key.replace("_", " ").title(),
            "used": value["used"],
            "limit": value["limit"],
            "unit": value["unit"],
        }
        for key, value in usage.items()
    ]

    return {
        "workspace_id": workspace_id,
        "plan": plan,
        "entitlements": entitlements_for_plan(plan),
        "usage": usage,
        "meters": meters,
        "updated_at": str(raw.get("updated_at") or _now_iso()),
    }


def _require_auth(authorization: str | None = Header(default=None)) -> None:
    expected = (os.getenv("QUANTORACLE_BILLING_TOKEN") or "").strip()
    if not expected:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    token = authorization.split(" ", 1)[1].strip()
    if token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "quantoracle-api", "time": _now_iso()}


@app.get(
    "/billing/workspaces/{workspace_id}/usage", dependencies=[Depends(_require_auth)]
)
def billing_workspace_usage(workspace_id: str) -> dict[str, Any]:
    return _usage_record(workspace_id)
