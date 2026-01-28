#!/usr/bin/env python3
"""Tiny Groww Trade API helpers (token + historical candles).

This is intentionally small and only supports what QuantOracle needs:
  - exchange: NSE
  - segment: CASH
  - candles: daily (interval_in_minutes=1440)

Docs reference: https://groww.in/trade-api/docs
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Any

import requests

_TOKEN_URL = "https://api.groww.in/v1/token/api/access"
_CANDLE_RANGE_URL = "https://api.groww.in/v1/historical/candle/range"


@dataclass(frozen=True)
class GrowwAuth:
    api_key: str
    api_secret: str


def get_access_token(auth: GrowwAuth, *, key_type: str = "approval", timeout: int = 30) -> str:
    ts = str(int(time.time()))
    checksum = hashlib.sha256((auth.api_secret + ts).encode("utf-8")).hexdigest()
    r = requests.post(
        _TOKEN_URL,
        headers={"Authorization": f"Bearer {auth.api_key}"},
        json={"key_type": key_type, "checksum": checksum, "timestamp": ts},
        timeout=timeout,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Groww token HTTP {r.status_code}: {(r.text or '')[:200]}")
    data = r.json() or {}
    token = data.get("token")
    if not token:
        raise RuntimeError(f"Groww token response missing 'token': {str(data)[:200]}")
    return str(token)


def get_candles_range(
    access_token: str,
    *,
    trading_symbol: str,
    start_time: str,
    end_time: str,
    interval_in_minutes: int = 1440,
    exchange: str = "NSE",
    segment: str = "CASH",
    timeout: int = 30,
) -> list[list[Any]]:
    r = requests.get(
        _CANDLE_RANGE_URL,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "X-API-VERSION": "1.0",
        },
        params={
            "exchange": exchange,
            "segment": segment,
            "trading_symbol": trading_symbol,
            "start_time": start_time,
            "end_time": end_time,
            "interval_in_minutes": int(interval_in_minutes),
        },
        timeout=timeout,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Groww candles HTTP {r.status_code}: {(r.text or '')[:200]}")
    data = r.json() or {}
    # The API returns a top-level payload in some responses; be tolerant.
    payload = data.get("payload") if isinstance(data, dict) else None
    if isinstance(payload, dict) and "candles" in payload:
        candles = payload.get("candles") or []
    else:
        candles = data.get("candles") or []
    if not isinstance(candles, list):
        raise RuntimeError(f"Groww candles unexpected shape: {str(data)[:200]}")
    return candles

