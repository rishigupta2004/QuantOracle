#!/usr/bin/env python3
"""Validate freshness + schema of published QuantOracle artifacts.

This checker is intended for CI and can run safely on a schedule.
It validates:
  - intraday quotes snapshot
  - EOD latest snapshot metadata
  - news intel daily snapshot
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import UTC, datetime, time
from pathlib import PurePosixPath
from typing import Any

import pytz
import requests


def _has(v: str | None) -> bool:
    return bool((v or "").strip())


def _safe_num(v: Any) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _public_url(path: str) -> str | None:
    base = (os.getenv("SUPABASE_URL") or "").strip().rstrip("/")
    bucket = (os.getenv("SUPABASE_BUCKET") or "").strip()
    if not base or not bucket:
        return None
    safe = str(PurePosixPath(path.lstrip("/")))
    return f"{base}/storage/v1/object/public/{bucket}/{safe}"


def _quotes_url() -> str | None:
    direct = (os.getenv("QUANTORACLE_SUPABASE_QUOTES_URL") or "").strip()
    if direct:
        return direct
    prefix = (os.getenv("QUANTORACLE_EOD_PREFIX") or "eod/nifty50").strip("/")
    return _public_url(f"{prefix}/quotes.json")


def _eod_latest_url() -> str | None:
    direct = (os.getenv("QUANTORACLE_SUPABASE_EOD_LATEST_URL") or "").strip()
    if direct:
        return direct
    prefix = (os.getenv("QUANTORACLE_EOD_PREFIX") or "eod/nifty50").strip("/")
    return _public_url(f"{prefix}/latest.json")


def _news_intel_url() -> str | None:
    direct = (os.getenv("QUANTORACLE_NEWS_INTEL_URL") or "").strip()
    if direct:
        return direct
    prefix = (os.getenv("QUANTORACLE_NEWS_PREFIX") or "news/intel").strip("/")
    return _public_url(f"{prefix}/latest.json")


def _parse_ts(raw: Any) -> datetime | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    s = raw.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    # Support +0530 variant.
    if len(s) >= 5 and (s[-5] in "+-") and s[-3] != ":":
        s = s[:-2] + ":" + s[-2:]
    try:
        dt = datetime.fromisoformat(s)
    except Exception:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _age_minutes(ts: datetime | None) -> float | None:
    if not ts:
        return None
    return (datetime.now(UTC) - ts).total_seconds() / 60.0


def _is_nse_runtime() -> bool:
    now_ist = datetime.now(pytz.timezone("Asia/Kolkata"))
    if now_ist.weekday() >= 5:
        return False
    t = now_ist.time()
    return time(9, 0) <= t <= time(16, 15)


@dataclass
class CheckResult:
    name: str
    url: str | None
    ok: bool
    required: bool
    reason: str
    as_of_utc: str | None
    age_minutes: float | None
    status: int | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "url": self.url,
            "ok": self.ok,
            "required": self.required,
            "reason": self.reason,
            "as_of_utc": self.as_of_utc,
            "age_minutes": None
            if self.age_minutes is None
            else round(self.age_minutes, 2),
            "status": self.status,
        }


def _fetch_json(url: str) -> tuple[int, dict[str, Any] | None, str | None]:
    try:
        r = requests.get(url, timeout=15)
        if r.status_code != 200:
            return r.status_code, None, f"HTTP {r.status_code}"
        data = r.json()
        if not isinstance(data, dict):
            return r.status_code, None, "Response is not a JSON object"
        return r.status_code, data, None
    except Exception as e:
        return None, None, str(e)


def _check_quotes(max_age_minutes: int) -> CheckResult:
    url = _quotes_url()
    required = _is_nse_runtime()
    if not url:
        return CheckResult(
            name="quotes",
            url=None,
            ok=not required,
            required=required,
            reason="Missing quotes URL configuration",
            as_of_utc=None,
            age_minutes=None,
            status=None,
        )

    status, data, error = _fetch_json(url)
    if data is None:
        return CheckResult(
            name="quotes",
            url=url,
            ok=not required,
            required=required,
            reason=error or "quotes fetch failed",
            as_of_utc=None,
            age_minutes=None,
            status=status,
        )

    as_of = _parse_ts(data.get("as_of_utc")) or _parse_ts(data.get("as_of_ist"))
    age = _age_minutes(as_of)
    quotes = data.get("quotes")
    count = int(data.get("count") or 0)
    shape_ok = isinstance(quotes, dict) and count >= 1
    age_ok = (age is not None) and (age <= max_age_minutes)

    ok = shape_ok and (age_ok or (not required))
    reason = "ok"
    if not shape_ok:
        reason = "quotes schema invalid"
    elif required and not age_ok:
        reason = f"quotes stale: age={round(age or 0, 2)}m limit={max_age_minutes}m"
    elif not required and not age_ok:
        reason = "outside NSE hours; stale tolerated"

    return CheckResult(
        name="quotes",
        url=url,
        ok=ok,
        required=required,
        reason=reason,
        as_of_utc=as_of.isoformat().replace("+00:00", "Z") if as_of else None,
        age_minutes=age,
        status=status,
    )


def _check_eod(max_age_minutes: int) -> CheckResult:
    url = _eod_latest_url()
    required = True
    if not url:
        return CheckResult(
            name="eod",
            url=None,
            ok=False,
            required=required,
            reason="Missing EOD latest URL configuration",
            as_of_utc=None,
            age_minutes=None,
            status=None,
        )

    status, data, error = _fetch_json(url)
    if data is None:
        return CheckResult(
            name="eod",
            url=url,
            ok=False,
            required=required,
            reason=error or "eod fetch failed",
            as_of_utc=None,
            age_minutes=None,
            status=status,
        )

    as_of = _parse_ts(data.get("generated_at_utc")) or _parse_ts(data.get("as_of_utc"))
    age = _age_minutes(as_of)
    shape_ok = all(
        [
            isinstance(data.get("as_of_date"), str),
            isinstance(data.get("universe"), str),
            isinstance(data.get("model_id"), str),
            isinstance(data.get("model_version"), str),
        ]
    )
    age_ok = (age is not None) and (age <= max_age_minutes)

    reason = "ok"
    if not shape_ok:
        reason = "eod schema invalid"
    elif not age_ok:
        reason = f"eod stale: age={round(age or 0, 2)}m limit={max_age_minutes}m"

    return CheckResult(
        name="eod",
        url=url,
        ok=shape_ok and age_ok,
        required=required,
        reason=reason,
        as_of_utc=as_of.isoformat().replace("+00:00", "Z") if as_of else None,
        age_minutes=age,
        status=status,
    )


def _check_news(max_age_minutes: int) -> CheckResult:
    url = _news_intel_url()
    required = True
    if not url:
        return CheckResult(
            name="news_intel",
            url=None,
            ok=False,
            required=required,
            reason="Missing news intel URL configuration",
            as_of_utc=None,
            age_minutes=None,
            status=None,
        )

    status, data, error = _fetch_json(url)
    if data is None:
        return CheckResult(
            name="news_intel",
            url=url,
            ok=False,
            required=required,
            reason=error or "news intel fetch failed",
            as_of_utc=None,
            age_minutes=None,
            status=status,
        )

    as_of = _parse_ts(data.get("as_of_utc")) or _parse_ts(data.get("generated_at_utc"))
    age = _age_minutes(as_of)

    items = data.get("items")
    shape_ok = isinstance(items, list) and len(items) > 0
    if shape_ok:
        for item in items[:10]:
            if not isinstance(item, dict):
                shape_ok = False
                break
            if not all(
                [
                    isinstance(item.get("headline"), str),
                    isinstance(item.get("source"), str),
                    isinstance(item.get("impact"), dict),
                    isinstance(item.get("source_tier"), str),
                ]
            ):
                shape_ok = False
                break

    age_ok = (age is not None) and (age <= max_age_minutes)
    reason = "ok"
    if not shape_ok:
        reason = "news intel schema invalid"
    elif not age_ok:
        reason = f"news intel stale: age={round(age or 0, 2)}m limit={max_age_minutes}m"

    return CheckResult(
        name="news_intel",
        url=url,
        ok=shape_ok and age_ok,
        required=required,
        reason=reason,
        as_of_utc=as_of.isoformat().replace("+00:00", "Z") if as_of else None,
        age_minutes=age,
        status=status,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quotes-max-age-minutes", type=int, default=180)
    ap.add_argument("--eod-max-age-minutes", type=int, default=4320)
    ap.add_argument("--news-max-age-minutes", type=int, default=2160)
    ap.add_argument("--strict", action="store_true")
    args = ap.parse_args()

    checks = [
        _check_quotes(args.quotes_max_age_minutes),
        _check_eod(args.eod_max_age_minutes),
        _check_news(args.news_max_age_minutes),
    ]

    summary = {
        "all_ok": all(c.ok for c in checks),
        "required_ok": all((c.ok or (not c.required)) for c in checks),
        "nse_runtime": _is_nse_runtime(),
        "config": {
            "supabase_url": _has(os.getenv("SUPABASE_URL")),
            "supabase_bucket": _has(os.getenv("SUPABASE_BUCKET")),
            "quotes_url": _quotes_url(),
            "eod_latest_url": _eod_latest_url(),
            "news_intel_url": _news_intel_url(),
        },
    }

    out = {
        "as_of_utc": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "checks": {c.name: c.to_dict() for c in checks},
        "summary": summary,
    }
    print(json.dumps(out, indent=2))

    if args.strict and not summary["required_ok"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
