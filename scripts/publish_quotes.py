#!/usr/bin/env python3
"""Publish an intraday quotes snapshot to Supabase Storage.

This workflow is meant to run frequently (e.g. every 15 minutes during market hours)
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
from typing import Any

import pytz
import requests

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


def _safe_float(v: Any) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _valid_quote(q: dict | None) -> bool:
    if not isinstance(q, dict):
        return False
    return _safe_float(q.get("price")) > 0


def _load_upstox_symbol_map() -> dict[str, str]:
    raw = (os.getenv("UPSTOX_SYMBOL_MAP") or "").strip()
    if raw:
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                return {
                    str(k).upper(): str(v) for k, v in data.items() if str(v).strip()
                }
        except Exception:
            return {}

    path = (os.getenv("UPSTOX_SYMBOL_MAP_FILE") or "").strip()
    if path:
        try:
            p = Path(path)
            data = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return {
                    str(k).upper(): str(v) for k, v in data.items() if str(v).strip()
                }
        except Exception:
            return {}
    return {}


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
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }

        change_pct = (
            float((price - prev_close) / prev_close * 100) if prev_close else 0.0
        )
        return {
            "symbol": sym,
            "price": float(price),
            "change_pct": float(change_pct),
            "volume": int(vol),
            "source": self.name,
        }


class Upstox(Provider):
    def __init__(self, access_token: str, symbol_map: dict[str, str]):
        super().__init__(name="upstox")
        self._token = access_token
        self._symbol_map = {k.upper(): v for k, v in symbol_map.items()}

    def quote(self, sym: str, *, now_ist: datetime) -> dict:  # noqa: ARG002
        instrument_key = self._symbol_map.get(sym.upper())
        if not instrument_key:
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }

        try:
            r = requests.get(
                "https://api.upstox.com/v2/market-quote/quotes",
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Bearer {self._token}",
                },
                params={"instrument_key": instrument_key},
                timeout=12,
            )
            if r.status_code != 200:
                return {
                    "symbol": sym,
                    "price": 0.0,
                    "change_pct": 0.0,
                    "volume": 0,
                    "source": "None",
                }
            data = r.json() or {}
        except Exception:
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }

        quotes = data.get("data") if isinstance(data, dict) else None
        if not isinstance(quotes, dict) or not quotes:
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }

        q = quotes.get(instrument_key)
        if not isinstance(q, dict) and len(quotes) == 1:
            q = next(iter(quotes.values()))
        if not isinstance(q, dict):
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }

        price = _safe_float(
            q.get("last_price") or q.get("ltp") or q.get("lp") or q.get("close_price")
        )
        raw_ohlc = q.get("ohlc")
        ohlc: dict[str, Any] = raw_ohlc if isinstance(raw_ohlc, dict) else {}
        prev_close = _safe_float(
            ohlc.get("close") or q.get("prev_close_price") or q.get("previous_close")
        )
        vol = int(_safe_float(q.get("volume") or q.get("vtt") or 0))

        if price <= 0:
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }

        change_pct = (
            float((price - prev_close) / prev_close * 100) if prev_close else 0.0
        )
        return {
            "symbol": sym,
            "price": float(price),
            "change_pct": float(change_pct),
            "volume": int(vol),
            "source": self.name,
        }


class Finnhub(Provider):
    def __init__(self, api_key: str):
        super().__init__(name="finnhub")
        self._api_key = api_key

    @staticmethod
    def _normalize(sym: str) -> str:
        if sym.endswith(".NS"):
            return f"NSE:{sym.replace('.NS', '')}"
        if sym.endswith(".BO"):
            return f"BSE:{sym.replace('.BO', '')}"
        return sym

    def quote(self, sym: str, *, now_ist: datetime) -> dict:  # noqa: ARG002
        try:
            r = requests.get(
                "https://finnhub.io/api/v1/quote",
                params={"symbol": self._normalize(sym), "token": self._api_key},
                timeout=10,
            )
            if r.status_code != 200:
                return {
                    "symbol": sym,
                    "price": 0.0,
                    "change_pct": 0.0,
                    "volume": 0,
                    "source": "None",
                }
            data = r.json() or {}
        except Exception:
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }

        price = _safe_float(data.get("c"))
        prev_close = _safe_float(data.get("pc"))
        if price <= 0:
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }
        change_pct = (
            float((price - prev_close) / prev_close * 100) if prev_close else 0.0
        )
        return {
            "symbol": sym,
            "price": float(price),
            "change_pct": float(change_pct),
            "volume": 0,
            "source": self.name,
        }


class EODHD(Provider):
    def __init__(self, api_key: str):
        super().__init__(name="eodhd")
        self._api_key = api_key

    @staticmethod
    def _ticker(sym: str) -> str:
        if sym.endswith(".NS"):
            return sym.replace(".NS", ".NSE")
        if sym.endswith(".BO"):
            return sym.replace(".BO", ".BSE")
        return sym

    def quote(self, sym: str, *, now_ist: datetime) -> dict:  # noqa: ARG002
        try:
            r = requests.get(
                f"https://eodhd.com/api/real-time/{self._ticker(sym)}",
                params={"api_token": self._api_key, "fmt": "json"},
                timeout=10,
            )
            if r.status_code != 200:
                return {
                    "symbol": sym,
                    "price": 0.0,
                    "change_pct": 0.0,
                    "volume": 0,
                    "source": "None",
                }
            data = r.json() or {}
        except Exception:
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }

        price = _safe_float(data.get("close") or data.get("price"))
        prev_close = _safe_float(
            data.get("previousClose") or data.get("previous_close")
        )
        change_pct = _safe_float(data.get("change_p") or data.get("change_percent"))
        vol = int(_safe_float(data.get("volume") or 0))

        if price <= 0:
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }
        if abs(change_pct) < 1e-9 and prev_close:
            change_pct = float((price - prev_close) / prev_close * 100)
        return {
            "symbol": sym,
            "price": float(price),
            "change_pct": float(change_pct),
            "volume": int(vol),
            "source": self.name,
        }


class YFinance(Provider):
    def __init__(self):
        super().__init__(name="yfinance")

    def quote(self, sym: str, *, now_ist: datetime) -> dict:  # noqa: ARG002
        try:
            import yfinance as yf

            h = yf.Ticker(sym).history(period="5d", timeout=10)
        except Exception:
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }
        if h is None or h.empty or "Close" not in h:
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }
        price = _safe_float(h["Close"].iloc[-1])
        prev_close = _safe_float(h["Close"].iloc[-2]) if len(h) >= 2 else price
        vol = int(_safe_float(h["Volume"].iloc[-1])) if "Volume" in h else 0
        if price <= 0:
            return {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }
        change_pct = (
            float((price - prev_close) / prev_close * 100) if prev_close else 0.0
        )
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
    ap.add_argument(
        "--prefix", default=os.getenv("QUANTORACLE_EOD_PREFIX", "eod/nifty50")
    )
    ap.add_argument(
        "--provider",
        choices=["auto", "upstox", "groww", "finnhub", "eodhd", "yfinance"],
        default="auto",
    )
    ap.add_argument("--upload", action="store_true")
    ap.add_argument(
        "--force", action="store_true", help="Run even outside market hours"
    )
    args = ap.parse_args()

    now_ist = _ist_now()
    if not args.force and not _should_run(now_ist):
        print(
            f"Skip: outside market window (IST={now_ist.strftime('%Y-%m-%d %H:%M:%S %Z')})"
        )
        return 0

    universe = _read_universe(Path(args.universe_file))
    if not universe:
        raise SystemExit("Empty universe")

    upstox_token = (os.getenv("UPSTOX_ACCESS_TOKEN") or "").strip()
    upstox_map = _load_upstox_symbol_map()
    groww_key = (os.getenv("GROWW_API_KEY") or "").strip()
    groww_secret = (os.getenv("GROWW_API_SECRET") or "").strip()
    finnhub_key = (os.getenv("FINNHUB_API_KEY") or "").strip()
    eodhd_key = (os.getenv("EODHD_API_KEY") or "").strip()

    providers: list[Provider] = []
    if args.provider in ("auto", "upstox") and upstox_token and upstox_map:
        providers.append(Upstox(upstox_token, upstox_map))
    if args.provider in ("auto", "groww") and groww_key and groww_secret:
        providers.append(Groww(groww_key, groww_secret))
    if args.provider in ("auto", "finnhub") and finnhub_key:
        providers.append(Finnhub(finnhub_key))
    if args.provider in ("auto", "eodhd") and eodhd_key:
        providers.append(EODHD(eodhd_key))
    if args.provider in ("auto", "yfinance") or not providers:
        providers.append(YFinance())

    if args.provider == "upstox" and (not upstox_token or not upstox_map):
        raise SystemExit("Missing UPSTOX_ACCESS_TOKEN and/or UPSTOX_SYMBOL_MAP")
    if args.provider == "groww" and not (groww_key and groww_secret):
        raise SystemExit("Missing GROWW_API_KEY/GROWW_API_SECRET")
    if args.provider == "finnhub" and not finnhub_key:
        raise SystemExit("Missing FINNHUB_API_KEY")
    if args.provider == "eodhd" and not eodhd_key:
        raise SystemExit("Missing EODHD_API_KEY")

    if args.provider in ("auto", "upstox") and not (upstox_token and upstox_map):
        print("Note: UPSTOX_ACCESS_TOKEN/UPSTOX_SYMBOL_MAP not set; skipping Upstox.")
    if args.provider in ("auto", "groww") and not (groww_key and groww_secret):
        print("Note: GROWW_API_KEY/GROWW_API_SECRET not set; skipping Groww.")
    if args.provider in ("auto", "finnhub") and not finnhub_key:
        print("Note: FINNHUB_API_KEY not set; skipping Finnhub.")
    if args.provider in ("auto", "eodhd") and not eodhd_key:
        print("Note: EODHD_API_KEY not set; skipping EODHD.")

    provider_order = [p.name for p in providers]

    out: dict[str, dict] = {}
    provider_breakdown: dict[str, int] = {}
    for sym in universe:
        if not (sym.endswith(".NS") or sym.endswith(".BO")):
            continue
        q: dict | None = None
        for provider in providers:
            try:
                cand = provider.quote(sym, now_ist=now_ist)
            except Exception:
                cand = None
            if _valid_quote(cand):
                q = cand
                break
        if not q:
            q = {
                "symbol": sym,
                "price": 0.0,
                "change_pct": 0.0,
                "volume": 0,
                "source": "None",
            }
        out[sym] = {
            k: q[k] for k in ("price", "change_pct", "volume", "source") if k in q
        }
        src = str(q.get("source") or "None")
        provider_breakdown[src] = int(provider_breakdown.get(src, 0)) + 1

    payload = {
        "as_of_ist": now_ist.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "provider": args.provider,
        "provider_order": provider_order,
        "provider_breakdown": provider_breakdown,
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
        raise SystemExit(
            "Missing SUPABASE_URL/SUPABASE_BUCKET/SUPABASE_SERVICE_ROLE_KEY for upload"
        )

    prefix = args.prefix.strip().strip("/") or "eod/nifty50"
    sb.upload_bytes(
        f"{prefix}/quotes.json", qpath.read_bytes(), content_type="application/json"
    )
    print(f"Uploaded -> {sb.public_url(f'{prefix}/quotes.json')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
