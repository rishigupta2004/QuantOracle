"""Data sources for market data, sentiment, and macro data.

All external data fetching lives here. No direct requests calls elsewhere.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
import requests
import yfinance as yf
from dotenv import load_dotenv

load_dotenv()

INDIANAPI_API_KEY = os.getenv("INDIANAPI_API_KEY")
INDIANAPI_BASE = os.getenv("INDIANAPI_BASE_URL", "https://stock.indianapi.in")
COINGECKO_BASE = os.getenv(
    "COINGECKO_BASE_URL", "https://api.coingecko.com/api/v3"
).rstrip("/")
DISABLE_YFINANCE_INDIA = (
    os.getenv("QUANTORACLE_DISABLE_YFINANCE_INDIA", "").strip() == "1"
)
ALLOW_YFINANCE_INDIA = os.getenv("QUANTORACLE_ALLOW_YFINANCE_INDIA", "").strip() == "1"

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "").strip()
EOD_PREFIX = os.getenv("QUANTORACLE_EOD_PREFIX", "eod/nifty50").strip().strip("/")

CACHE_QUOTE_S = 60
CACHE_HISTORY_S = 1800


def _data_dir() -> Path:
    return Path(os.getenv("QUANTORACLE_DATA_DIR", "data")).resolve()


def _supabase_public_url(bucket: str, path: str) -> Optional[str]:
    base = SUPABASE_URL.rstrip("/")
    if not base or not bucket or not path:
        return None
    return f"{base}/storage/v1/object/public/{bucket}/{path.lstrip('/')}"


def _safe_symbol(sym: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", sym.upper())


def _should_use_yfinance(sym: str) -> bool:
    from quant.data.universe import is_india_symbol

    if not is_india_symbol(sym):
        return True
    if ALLOW_YFINANCE_INDIA:
        return True
    if DISABLE_YFINANCE_INDIA:
        return False
    if SUPABASE_URL and SUPABASE_BUCKET:
        return False
    return True


def _artifacts_configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_BUCKET)


def sync_ohlcv(sym: str) -> bool:
    """Fetch OHLCV parquet from Supabase into local data/."""
    if not _artifacts_configured():
        return False
    bucket = SUPABASE_BUCKET
    if not bucket:
        return False

    root = _data_dir()
    out = root / "ohlcv" / f"{_safe_symbol(sym)}.parquet"
    if out.exists():
        return True

    url = _supabase_public_url(bucket, f"{EOD_PREFIX}/ohlcv/{out.name}")
    if not url:
        return False

    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        with requests.get(url, stream=True, timeout=60) as r:
            if r.status_code != 200:
                return False
            with open(out, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 256):
                    if chunk:
                        f.write(chunk)
        return True
    except Exception:
        return False


def sync_quotes() -> bool:
    """Fetch intraday quotes snapshot into local data/quotes.json."""
    if not _artifacts_configured():
        return False
    bucket = SUPABASE_BUCKET
    if not bucket:
        return False

    root = _data_dir()
    out = root / "quotes.json"
    url = _supabase_public_url(bucket, f"{EOD_PREFIX}/quotes.json")
    if not url:
        return False

    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        with requests.get(url, stream=True, timeout=30) as r:
            if r.status_code != 200:
                return False
            with open(out, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 256):
                    if chunk:
                        f.write(chunk)
        return True
    except Exception:
        return False


def _read_ohlcv_parquet(sym: str, period: str) -> pd.DataFrame:
    """Read OHLCV from local parquet if available."""
    root = _data_dir()
    from quant.data.universe import normalize_symbol

    sym = normalize_symbol(sym)
    p = root / "ohlcv" / f"{_safe_symbol(sym)}.parquet"
    if p.exists():
        try:
            df = pd.read_parquet(p)
            if period == "5d":
                return df.tail(5)
            elif period == "1mo":
                return df.tail(30)
            elif period == "6mo":
                return df.tail(130)
            elif period == "1y":
                return df.tail(252)
            return df
        except Exception:
            pass
    return pd.DataFrame()


def _has_ohlcv(sym: str) -> bool:
    root = _data_dir()
    p = root / "ohlcv" / f"{_safe_symbol(sym)}.parquet"
    return p.exists()


def _quotes_snapshot() -> Dict[str, Dict]:
    """Load cached intraday quotes."""
    try:
        sync_quotes()
        p = _data_dir() / "quotes.json"
        if not p.exists():
            return {}
        raw = json.loads(p.read_text(encoding="utf-8")) or {}
        if isinstance(raw, dict) and isinstance(raw.get("quotes"), dict):
            return raw.get("quotes", raw)
        return raw if isinstance(raw, dict) else {}
    except Exception:
        return {}


def _yahoo_history(sym: str, period: str) -> pd.DataFrame:
    """Fetch history from yfinance."""
    try:
        h = yf.Ticker(sym).history(period=period, timeout=10)
        return h if isinstance(h, pd.DataFrame) else pd.DataFrame()
    except Exception:
        return pd.DataFrame()


def _indianapi_quote(sym: str) -> Dict[str, float]:
    """Fetch quote from IndianAPI."""
    if not INDIANAPI_API_KEY:
        return {}
    if sym.startswith("^"):
        return {}
    try:
        name = sym.replace(".NS", "").replace(".BO", "")
        r = requests.get(
            f"{INDIANAPI_BASE}/stock",
            params={"name": name},
            headers={"x-api-key": INDIANAPI_API_KEY},
            timeout=5,
        )
        if r.status_code != 200:
            return {}
        d = r.json() or {}
        cp = (d.get("currentPrice") or {}).get("NSE") or (
            d.get("currentPrice") or {}
        ).get("BSE")
        pct = d.get("percentChange") or d.get("pChange") or d.get("changePercent") or 0
        out: Dict[str, float] = {}
        if cp:
            out["price"] = float(cp)
        try:
            out["change_pct"] = float(pct)
        except Exception:
            out["change_pct"] = 0.0
        return out
    except Exception:
        return {}


def _coingecko_quote(sym: str) -> Dict[str, float]:
    """Fetch quote from CoinGecko."""
    sym = sym.upper().strip()
    if not sym.endswith("-USD"):
        return {}

    coin_map = {
        "BTC-USD": "bitcoin",
        "ETH-USD": "ethereum",
        "SOL-USD": "solana",
        "DOGE-USD": "dogecoin",
        "XRP-USD": "ripple",
    }
    coin_id = coin_map.get(sym)
    if not coin_id:
        return {}

    try:
        r = requests.get(
            f"{COINGECKO_BASE}/simple/price",
            params={
                "ids": coin_id,
                "vs_currencies": "usd",
                "include_24hr_change": "true",
            },
            timeout=6,
        )
        if r.status_code != 200:
            return {}
        data = r.json() or {}
        d = data.get(coin_id) if isinstance(data, dict) else None
        if not isinstance(d, dict):
            return {}
        price = d.get("usd")
        if price is None:
            return {}
        change_pct = d.get("usd_24h_change") or 0.0
        return {"price": float(price), "change_pct": float(change_pct)}
    except Exception:
        return {}


def get_quote(sym: str) -> Dict[str, Any]:
    """Get quote for a single symbol."""
    from quant.data.universe import normalize_symbol, is_india_symbol

    sym = normalize_symbol(sym)
    sync_ohlcv(sym)

    snap = _quotes_snapshot()
    snap_q = snap.get(sym) if isinstance(snap, dict) else None

    h = _read_ohlcv_parquet(sym, "5d") if _has_ohlcv(sym) else pd.DataFrame()
    if h.empty and _should_use_yfinance(sym):
        h = _yahoo_history(sym, "5d")

    if h.empty or "Close" not in h or h["Close"].empty:
        if is_india_symbol(sym):
            if isinstance(snap_q, dict) and float(snap_q.get("price", 0) or 0) > 0:
                price = float(snap_q.get("price"))
                change_pct = float(snap_q.get("change_pct", 0) or 0)
                change = float(price * change_pct / 100) if change_pct else 0.0
                return {
                    "symbol": sym,
                    "price": price,
                    "change": change,
                    "change_pct": change_pct,
                    "open": 0.0,
                    "high": 0.0,
                    "low": 0.0,
                    "volume": int(snap_q.get("volume", 0) or 0),
                    "source": "SupabaseQuotes",
                }

            iq = _indianapi_quote(sym)
            if iq.get("price"):
                price = float(iq["price"])
                change_pct = float(iq.get("change_pct", 0) or 0)
                change = float(price * change_pct / 100) if change_pct else 0.0
                return {
                    "symbol": sym,
                    "price": price,
                    "change": change,
                    "change_pct": change_pct,
                    "open": 0.0,
                    "high": 0.0,
                    "low": 0.0,
                    "volume": 0,
                    "source": "IndianAPI",
                }

        if sym.endswith("-USD"):
            cq = _coingecko_quote(sym)
            if cq.get("price"):
                price = float(cq["price"])
                change_pct = float(cq.get("change_pct", 0) or 0)
                change = float(price * change_pct / 100) if change_pct else 0.0
                return {
                    "symbol": sym,
                    "price": price,
                    "change": change,
                    "change_pct": change_pct,
                    "open": 0.0,
                    "high": 0.0,
                    "low": 0.0,
                    "volume": 0,
                    "source": "CoinGecko",
                }

        return {
            "symbol": sym,
            "price": 0.0,
            "change": 0.0,
            "change_pct": 0.0,
            "open": 0.0,
            "high": 0.0,
            "low": 0.0,
            "volume": 0,
            "source": "None",
        }

    close = h["Close"]
    last_close = float(close.iloc[-1])
    prev_close = float(close.iloc[-2]) if len(close) >= 2 else last_close

    price = last_close
    source = "yahoo"

    if is_india_symbol(sym):
        if isinstance(snap_q, dict) and float(snap_q.get("price", 0) or 0) > 0:
            price = float(snap_q.get("price"))
            source = "SupabaseQuotes"
        else:
            iq = _indianapi_quote(sym)
            if iq.get("price"):
                price = float(iq["price"])
                source = "IndianAPI"
    elif sym.endswith("-USD"):
        cq = _coingecko_quote(sym)
        if cq.get("price"):
            price = float(cq["price"])
            source = "CoinGecko"

    change = float(price - prev_close) if prev_close else 0.0
    change_pct = float(change / prev_close * 100) if prev_close else 0.0

    return {
        "symbol": sym,
        "price": float(price),
        "change": float(change),
        "change_pct": float(change_pct),
        "open": float(h["Open"].iloc[-1]) if "Open" in h else 0.0,
        "high": float(h["High"].iloc[-1]) if "High" in h else 0.0,
        "low": float(h["Low"].iloc[-1]) if "Low" in h else 0.0,
        "volume": int(h["Volume"].iloc[-1]) if "Volume" in h else 0,
        "source": source,
    }


def get_quotes(syms: list[str]) -> Dict[str, Dict[str, Any]]:
    """Get quotes for multiple symbols."""
    return {s: get_quote(s) for s in syms}


def get_historical(sym: str, period: str = "1mo") -> pd.DataFrame:
    """Get historical OHLCV data."""
    from quant.data.universe import normalize_symbol

    sym = normalize_symbol(sym)
    sync_ohlcv(sym)

    h = _read_ohlcv_parquet(sym, period) if _has_ohlcv(sym) else pd.DataFrame()
    if h.empty and _should_use_yfinance(sym):
        h = _yahoo_history(sym, period)
    if not h.empty:
        return h
    return pd.DataFrame()


def get_trending() -> Dict[str, list]:
    """Get trending stocks from IndianAPI."""
    if not INDIANAPI_API_KEY:
        return {"gainers": [], "losers": []}
    try:
        r = requests.get(
            f"{INDIANAPI_BASE}/trending",
            headers={"x-api-key": INDIANAPI_API_KEY},
            timeout=10,
        )
        if r.status_code != 200:
            return {"gainers": [], "losers": []}
        d = r.json() or {}
        ts = d.get("trending_stocks") or {}
        return {
            "gainers": (ts.get("top_gainers") or [])[:5],
            "losers": (ts.get("top_losers") or [])[:5],
        }
    except Exception:
        return {"gainers": [], "losers": []}


def sources_status() -> Dict[str, bool]:
    """Check available data sources."""
    return {
        "indianapi": bool(INDIANAPI_API_KEY),
        "coingecko": True,
        "yahoo": True,
        "supabase": _artifacts_configured(),
    }
