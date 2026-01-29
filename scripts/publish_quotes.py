#!/usr/bin/env python3
"""Publish an intraday quotes snapshot to Supabase Storage.

This workflow is meant to run frequently (e.g. every 10 minutes during market hours)
to keep dashboard tiles fresh on hosted deployments where yfinance can be flaky.

Output (local):
  data/quotes.json

Output (Supabase public bucket):
  <prefix>/quotes.json
"""

# ruff: noqa: E402  (sys.path bootstrap must run before local imports)

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from pathlib import Path

import pytz

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from quant.registry import data_root
from scripts.groww_api import GrowwAuth, get_access_token, get_candles_range
from scripts.supabase_storage import from_env


def _read_universe(path: Path) -> list[str]:
    out: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        out.append(s.upper())
    return out


def _ist_now() -> datetime:
    return datetime.now(pytz.timezone("Asia/Kolkata"))


def _should_run(now_ist: datetime) -> bool:
    if now_ist.weekday() >= 5:
        return False
    t = now_ist.time()
    # NSE hours: 09:15-15:30 IST. Include a short tail to publish one last time post-close.
    return time(9, 15) <= t <= time(15, 45)


@dataclass(frozen=True)
class Provider:
    name: str

    def quote(self, sym: str, *, now_ist: datetime) -> dict:
        raise NotImplementedError


class Groww(Provider):
    def __init__(self, api_key: str, api_secret: str):
        super().__init__(name="groww")
        self._auth = GrowwAuth(api_key=api_key, api_secret=api_secret)
        self._token: str | None = None

    def _token_get(self) -> str:
        if self._token:
            return self._token
        self._token = get_access_token(self._auth)
        return self._token

    def quote(self, sym: str, *, now_ist: datetime) -> dict:
        trading_symbol = sym.replace(".NS", "").replace(".BO", "").upper()
        token = self._token_get()

        today = now_ist.date()
        start_i = datetime.combine(today, time(9, 15), tzinfo=now_ist.tzinfo)
        end_i = now_ist

        start_i_s = start_i.strftime("%Y-%m-%d %H:%M:%S")
        end_i_s = end_i.strftime("%Y-%m-%d %H:%M:%S")

        # Intraday price: last 5-min candle close.
        price = None
        vol = 0
        try:
            candles_i = get_candles_range(
                token,
                trading_symbol=trading_symbol,
                start_time=start_i_s,
                end_time=end_i_s,
                interval_in_minutes=5,
            )
            if candles_i:
                last = candles_i[-1]
                price = float(last[4])
                vol = int(last[5]) if len(last) > 5 else 0
        except Exception:
            pass

        # Prev close: from daily candles.
        prev_close = None
        try:
            start_d = (now_ist - timedelta(days=10)).strftime("%Y-%m-%d 09:15:00")
            end_d = now_ist.strftime("%Y-%m-%d 15:30:00")
            candles_d = get_candles_range(
                token,
                trading_symbol=trading_symbol,
                start_time=start_d,
                end_time=end_d,
                interval_in_minutes=1440,
            )
            if candles_d and len(candles_d) >= 2:
                prev_close = float(candles_d[-2][4])
            if price is None and candles_d:
                price = float(candles_d[-1][4])
        except Exception:
            pass

        if price is None:
            return {"symbol": sym, "price": 0.0, "change_pct": 0.0, "volume": 0, "source": "None"}

        change_pct = float((price - prev_close) / prev_close * 100) if prev_close else 0.0
        return {
            "symbol": sym,
            "price": float(price),
            "change_pct": float(change_pct),
            "volume": int(vol),
            "source": self.name,
        }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--universe-file", default="data/universe/india_core.txt")
    ap.add_argument("--prefix", default=os.getenv("QUANTORACLE_EOD_PREFIX", "eod/nifty50"))
    ap.add_argument("--provider", choices=["groww"], default="groww")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--force", action="store_true", help="Run even outside market hours")
    args = ap.parse_args()

    now_ist = _ist_now()
    if not args.force and not _should_run(now_ist):
        print(f"Skip: outside market window (IST={now_ist.strftime('%Y-%m-%d %H:%M:%S %Z')})")
        return 0

    universe = _read_universe(Path(args.universe_file))
    if not universe:
        raise SystemExit("Empty universe")

    groww_key = (os.getenv("GROWW_API_KEY") or "").strip()
    groww_secret = (os.getenv("GROWW_API_SECRET") or "").strip()
    if args.provider == "groww" and not (groww_key and groww_secret):
        raise SystemExit("Missing GROWW_API_KEY/GROWW_API_SECRET")
    provider: Provider = Groww(groww_key, groww_secret)

    out: dict[str, dict] = {}
    for sym in universe:
        if not (sym.endswith(".NS") or sym.endswith(".BO")):
            continue
        q = provider.quote(sym, now_ist=now_ist)
        out[sym] = {k: q[k] for k in ("price", "change_pct", "volume", "source") if k in q}

    payload = {
        "as_of_ist": now_ist.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "provider": provider.name,
        "count": len(out),
        "quotes": out,
    }

    root = data_root()
    root.mkdir(parents=True, exist_ok=True)
    qpath = root / "quotes.json"
    qpath.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {qpath} ({len(out)} symbols)")

    if not args.upload:
        return 0

    sb = from_env(require_write=True)
    if not sb:
        raise SystemExit("Missing SUPABASE_URL/SUPABASE_BUCKET/SUPABASE_SERVICE_ROLE_KEY for upload")

    prefix = args.prefix.strip().strip("/") or "eod/nifty50"
    sb.upload_bytes(f"{prefix}/quotes.json", qpath.read_bytes(), content_type="application/json")
    print(f"Uploaded -> {sb.public_url(f'{prefix}/quotes.json')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

