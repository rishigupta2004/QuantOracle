"""Macro market pulse from open FRED CSV endpoints."""

from __future__ import annotations

from typing import Dict

import requests


def _fred_last(series_id: str) -> Dict:
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    try:
        r = requests.get(url, timeout=8)
        if r.status_code != 200:
            return {}
        lines = (r.text or "").splitlines()
    except Exception:
        return {}

    if len(lines) <= 1:
        return {}

    for line in reversed(lines[1:]):
        parts = line.split(",", 1)
        if len(parts) != 2:
            continue
        dt, val = parts[0].strip(), parts[1].strip()
        if not dt or not val or val == ".":
            continue
        try:
            return {"series": series_id, "date": dt, "value": float(val)}
        except Exception:
            continue
    return {}


def macro_snapshot() -> Dict:
    return {
        "vix": _fred_last("VIXCLS"),
        "us10y": _fred_last("DGS10"),
        "fedfunds": _fred_last("FEDFUNDS"),
        "usd_inr": _fred_last("DEXINUS"),
    }
