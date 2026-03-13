#!/usr/bin/env python3
"""Smoke test QuantOracle Vercel web/API deployment and key readiness.

Usage:
  python scripts/smoke_vercel_web.py --base-url https://quant-oracle.vercel.app
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


REQUIRED_KEYS = [
    "UPSTOX_CLIENT_ID",
    "UPSTOX_CLIENT_SECRET",
    "UPSTOX_REDIRECT_URI",
    "UPSTOX_ACCESS_TOKEN",
    "UPSTOX_SYMBOL_MAP",
    "SUPABASE_URL",
    "SUPABASE_BUCKET",
]

RECOMMENDED_KEYS = [
    "QUANTORACLE_BILLING_TOKEN",
    "FINNHUB_API_KEY",
    "EODHD_API_KEY",
    "THENEWSAPI_API_KEY",
    "GNEWS_API_KEY",
    "NEWSDATA_API_KEY",
    "INDIANAPI_API_KEY",
]


@dataclass
class Check:
    name: str
    ok: bool
    status: int | None
    details: dict[str, Any]


def _http_json(
    url: str, timeout: int = 20
) -> tuple[int, dict[str, Any] | list[Any] | str]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            body = r.read().decode("utf-8", errors="ignore")
            try:
                return int(r.status), json.loads(body)
            except Exception:
                return int(r.status), body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        try:
            return int(e.code), json.loads(body)
        except Exception:
            return int(e.code), body
    except Exception as e:
        return 0, {"error": str(e)}


def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _check_health(base: str) -> Check:
    status, data = _http_json(f"{base}/api/health")
    ok = (
        status == 200
        and isinstance(data, dict)
        and isinstance(data.get("status"), str)
        and isinstance(data.get("service"), str)
        and isinstance(data.get("time"), str)
    )
    return Check("health", ok, status, {"response": data})


def _check_billing(base: str) -> Check:
    status, data = _http_json(f"{base}/api/billing/workspaces/default/usage")
    ok = False
    if status == 200 and isinstance(data, dict):
        ok = all(
            [
                isinstance(data.get("workspace_id"), str),
                isinstance(data.get("plan"), str),
                isinstance(data.get("entitlements"), dict),
                isinstance(data.get("usage"), dict),
                isinstance(data.get("meters"), list),
                isinstance(data.get("updated_at"), str),
            ]
        )
    return Check("billing_usage", ok, status, {"response": data})


def _check_quotes(base: str) -> Check:
    url = f"{base}/api/quotes?symbols=RELIANCE.NS,TCS.NS,AAPL,MSFT,BTC-USD"
    status, data = _http_json(url)
    ok = False
    details: dict[str, Any] = {"response": data}
    if status == 200 and isinstance(data, dict):
        raw_quotes = data.get("quotes")
        quote_dict: dict[str, Any] = {}
        if isinstance(raw_quotes, dict):
            quote_dict = dict(raw_quotes)
        quote_items: list[tuple[Any, Any]] = list(quote_dict.items())
        shape_ok = all(
            [
                isinstance(data.get("as_of_utc"), str),
                isinstance(data.get("provider_order"), list),
                isinstance(data.get("provider_breakdown"), dict),
                isinstance(data.get("count"), int),
                isinstance(raw_quotes, dict),
            ]
        )

        per_quote_ok = True
        for sym, q in quote_items:
            if not isinstance(sym, str) or not isinstance(q, dict):
                per_quote_ok = False
                break
            if not all(
                [
                    isinstance(q.get("symbol"), str),
                    _is_number(q.get("price")),
                    _is_number(q.get("change_pct")),
                    _is_number(q.get("volume")),
                    isinstance(q.get("source"), str),
                ]
            ):
                per_quote_ok = False
                break

        quote_values = [v for _, v in quote_items]

        india_any_ok = any(
            isinstance(v, dict)
            and v.get("symbol") in ("RELIANCE.NS", "TCS.NS")
            and _is_number(v.get("price"))
            and float(v.get("price", 0) or 0) > 0
            for v in quote_values
        )
        india_live_ok = any(
            isinstance(v, dict)
            and v.get("symbol") in ("RELIANCE.NS", "TCS.NS")
            and _is_number(v.get("price"))
            and float(v.get("price", 0) or 0) > 0
            and str(v.get("source") or "")
            not in ("supabase_snapshot", "unavailable", "none")
            and not bool(v.get("stale"))
            for v in quote_values
        )
        crypto_ok = any(
            isinstance(v, dict)
            and v.get("symbol") == "BTC-USD"
            and _is_number(v.get("price"))
            and float(v.get("price", 0) or 0) > 0
            for v in quote_values
        )

        details["readiness"] = {
            "india_price_available": india_any_ok,
            "india_live_provider_available": india_live_ok,
            "crypto_price_available": crypto_ok,
        }

        ok = shape_ok and per_quote_ok
    return Check("quotes", ok, status, details)


def _check_news(base: str) -> Check:
    status, data = _http_json(f"{base}/api/news?limit=3")
    ok = False
    if status == 200 and isinstance(data, dict):
        raw_items = data.get("items")
        item_list: list[Any] = []
        if isinstance(raw_items, list):
            item_list = list(raw_items)
        base_ok = all(
            [
                isinstance(data.get("query"), str),
                isinstance(data.get("count"), int),
                isinstance(raw_items, list),
                isinstance(data.get("as_of_utc"), str),
            ]
        )
        items_ok = True
        for it in item_list:
            if not isinstance(it, dict):
                items_ok = False
                break
            if not all(
                [
                    isinstance(it.get("headline"), str),
                    isinstance(it.get("summary"), str),
                    isinstance(it.get("url"), str),
                    isinstance(it.get("source"), str),
                    isinstance(it.get("datetime"), str),
                ]
            ):
                items_ok = False
                break
        ok = base_ok and items_ok
    return Check("news", ok, status, {"response": data})


def _check_macro(base: str) -> Check:
    status, data = _http_json(f"{base}/api/macro")
    ok = False
    details: dict[str, Any] = {"response": data}
    if status == 200 and isinstance(data, dict):

        def _pt(v: Any) -> bool:
            return v is None or (
                isinstance(v, dict)
                and isinstance(v.get("series"), str)
                and isinstance(v.get("date"), str)
                and _is_number(v.get("value"))
            )

        ok = all(
            [
                _pt(data.get("vix")),
                _pt(data.get("us10y")),
                _pt(data.get("fedfunds")),
                _pt(data.get("usd_inr")),
                isinstance(data.get("as_of_utc"), str),
            ]
        )
        details["readiness"] = {
            "has_at_least_one_series": any(
                data.get(k) is not None for k in ("vix", "us10y", "fedfunds", "usd_inr")
            )
        }
    return Check("macro", ok, status, details)


def _check_upstox_callback(base: str) -> Check:
    status_no_code, data_no_code = _http_json(f"{base}/api/upstox/callback")
    status_dummy, data_dummy = _http_json(f"{base}/api/upstox/callback?code=dummy")

    no_code_ok = (
        status_no_code == 400
        and isinstance(data_no_code, dict)
        and isinstance(data_no_code.get("error"), str)
    )
    dummy_ok = status_dummy in (200, 400, 500) and isinstance(data_dummy, dict)

    details = {
        "no_code": {"status": status_no_code, "response": data_no_code},
        "dummy_code": {"status": status_dummy, "response": data_dummy},
        "readiness": {
            "callback_route_alive": no_code_ok,
            "credentials_present_hint": not (
                isinstance(data_dummy, dict)
                and isinstance(data_dummy.get("error"), str)
                and "Set UPSTOX_CLIENT_ID" in str(data_dummy.get("error"))
            ),
        },
    }
    return Check("upstox_callback", no_code_ok and dummy_ok, None, details)


def _check_status(base: str) -> Check:
    status, data = _http_json(f"{base}/api/status?probe=1")
    ok = False
    if status == 200 and isinstance(data, dict):
        ok = all(
            [
                isinstance(data.get("service"), str),
                isinstance(data.get("as_of_utc"), str),
                isinstance(data.get("providers"), dict),
                isinstance(data.get("news"), dict),
                isinstance(data.get("billing"), dict),
                isinstance(data.get("readiness"), dict),
            ]
        )
    return Check("status", ok, status, {"response": data})


def _vercel_key_report() -> dict[str, Any]:
    try:
        proc = subprocess.run(
            ["vercel", "env", "ls"],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        text = proc.stdout or ""
    except Exception as e:
        return {"error": str(e)}

    found: set[str] = set()
    for line in text.splitlines():
        m = re.match(r"\s*([A-Z0-9_]+)\s+Encrypted\s+", line)
        if m:
            found.add(m.group(1))

    required = {k: (k in found) for k in REQUIRED_KEYS}
    required["GLOBAL_FALLBACK_KEY"] = (
        "FINNHUB_API_KEY" in found or "EODHD_API_KEY" in found
    )
    recommended = {k: (k in found) for k in RECOMMENDED_KEYS}
    return {
        "required": required,
        "recommended": recommended,
        "missing_required": [k for k, ok in required.items() if not ok],
        "missing_recommended": [k for k, ok in recommended.items() if not ok],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="https://quant-oracle.vercel.app")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--require-india-live", action="store_true")
    ap.add_argument("--require-required-keys", action="store_true")
    args = ap.parse_args()
    base = args.base_url.rstrip("/")

    checks = [
        _check_health(base),
        _check_billing(base),
        _check_quotes(base),
        _check_news(base),
        _check_macro(base),
        _check_upstox_callback(base),
        _check_status(base),
    ]
    key_report = _vercel_key_report()

    out = {
        "base_url": base,
        "checks": {
            c.name: {"ok": c.ok, "status": c.status, **c.details} for c in checks
        },
        "vercel_keys": key_report,
        "summary": {
            "all_shape_checks_ok": all(
                c.ok for c in checks if c.name != "upstox_callback"
            ),
            "upstox_callback_route_ok": next(
                c.ok for c in checks if c.name == "upstox_callback"
            ),
            "ready_for_india_live_quotes": bool(
                checks[2]
                .details.get("readiness", {})
                .get("india_live_provider_available")
            ),
            "ready_for_news": checks[3].ok,
            "ready_for_billing_cards": checks[1].ok,
            "status_endpoint_ok": checks[6].ok,
        },
    }

    print(json.dumps(out, indent=2))

    if args.strict and (
        not out["summary"]["all_shape_checks_ok"]
        or not out["summary"]["upstox_callback_route_ok"]
        or not out["summary"]["status_endpoint_ok"]
    ):
        return 1

    if args.require_india_live and not out["summary"]["ready_for_india_live_quotes"]:
        return 1

    if args.require_required_keys and out["vercel_keys"].get("missing_required"):
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
