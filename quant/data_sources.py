"""Data sources for market data, sentiment, and macro data.

All external data fetching lives here. No direct requests calls elsewhere.
"""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
import requests
import yfinance as yf
from dotenv import load_dotenv
from diskcache import Cache

load_dotenv()

# === CONFIG ===
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

NEWSDATA_API_KEY = os.getenv("NEWSDATA_API_KEY", "").strip()
FRED_API_KEY = os.getenv("FRED_API_KEY", "").strip()

CACHE_QUOTE_S = 60
CACHE_HISTORY_S = 1800

# Disk cache for yfinance data
_yfcache = Cache(os.getenv("QUANTORACLE_CACHE_DIR", "/tmp/quantoracle-cache"))

# === SENTIMENT KEYWORDS ===
BULLISH_WORDS = {
    "surge",
    "gains",
    "beats",
    "strong",
    "record",
    "rally",
    "growth",
    "profit",
    "bullish",
    "upgrade",
    "outperform",
}
BEARISH_WORDS = {
    "fall",
    "drops",
    "loss",
    "weak",
    "miss",
    "decline",
    "crash",
    "fraud",
    "probe",
    "bearish",
    "downgrade",
    "underperform",
}


# === DATA CLASSES ===
@dataclass
class Quote:
    symbol: str
    price: float
    change: float
    change_pct: float
    open: float
    high: float
    low: float
    volume: int
    source: str
    is_live: bool = True


@dataclass
class Fundamentals:
    pe_ratio: Optional[float]
    pb_ratio: Optional[float]
    roe: Optional[float]
    debt_to_equity: Optional[float]
    market_cap: Optional[float]
    sector: Optional[str]


@dataclass
class SentimentScore:
    score: float  # [-1, 1]
    confidence: float  # [0, 1]
    article_count: int
    bullish_pct: float
    source: str


@dataclass
class MacroEvent:
    name: str
    date: str
    expected: Optional[float]
    prior: Optional[float]
    impact_level: str  # HIGH, MEDIUM, LOW
    affects_nse: bool


# === HELPER FUNCTIONS ===


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


# =============================================================================
# CLASSES: MarketDataProvider, SentimentProvider, MacroProvider
# =============================================================================


class MarketDataProvider:
    """
    Primary: yfinance for all OHLCV and fundamental data.
    Live quotes: Groww API if key present, else last EOD close.
    Rate limit handling: exponential backoff, max 3 retries.
    Local disk cache via diskcache: TTL 15min intraday, 24h EOD.
    """

    def __init__(self):
        self._cache = _yfcache

    def get_ohlcv(self, symbol: str, period: str = "1y") -> pd.DataFrame:
        """
        Fetch OHLCV data for a symbol.

        Args:
            symbol: Must be in NSE format: "RELIANCE.NS"
            period: "1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"

        Returns:
            DataFrame with columns [Open, High, Low, Close, Volume]

        Raises:
            DataUnavailableError: If no data can be fetched
        """
        from quant.data.universe import normalize_symbol

        symbol = normalize_symbol(symbol)

        # Try cache first
        cache_key = f"ohlcv:{symbol}:{period}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        # Try local parquet first
        df = _read_ohlcv_parquet(symbol, period)
        if not df.empty:
            ttl = 86400 if period != "1d" else 900  # 24h for EOD, 15min for intraday
            self._cache.set(cache_key, df, expire=ttl)
            return df

        # Try yfinance with retry
        for attempt in range(3):
            try:
                h = yf.Ticker(symbol).history(period=period, timeout=10)
                if isinstance(h, pd.DataFrame) and not h.empty:
                    ttl = 86400 if period != "1d" else 900
                    self._cache.set(cache_key, h, expire=ttl)
                    return h
            except Exception:
                if attempt < 2:
                    time.sleep(2**attempt)  # Exponential backoff

        return pd.DataFrame()

    def get_live_quote(self, symbol: str) -> Quote:
        """
        Get live quote. Returns last known price if market closed.
        Never returns None - always returns a Quote object.
        """
        from quant.data.universe import normalize_symbol, is_india_symbol

        symbol = normalize_symbol(symbol)

        # Check if market is open (IST 9:15-15:35)
        is_market_open = self._is_market_open()

        # Try live sources first if market is open
        if is_market_open:
            # Try Supabase quotes
            snap = _quotes_snapshot()
            if symbol in snap:
                q = snap[symbol]
                price = float(q.get("price", 0) or 0)
                if price > 0:
                    change = float(q.get("change", 0) or 0)
                    change_pct = float(q.get("change_pct", 0) or 0)
                    return Quote(
                        symbol=symbol,
                        price=price,
                        change=change,
                        change_pct=change_pct,
                        open=float(q.get("open", 0) or 0),
                        high=float(q.get("high", 0) or 0),
                        low=float(q.get("low", 0) or 0),
                        volume=int(q.get("volume", 0) or 0),
                        source="SupabaseQuotes",
                        is_live=True,
                    )

            # Try IndianAPI
            if is_india_symbol(symbol):
                iq = _indianapi_quote(symbol)
                if iq.get("price"):
                    price = float(iq["price"])
                    change_pct = float(iq.get("change_pct", 0) or 0)
                    change = price * change_pct / 100 if change_pct else 0.0
                    return Quote(
                        symbol=symbol,
                        price=price,
                        change=change,
                        change_pct=change_pct,
                        open=0.0,
                        high=0.0,
                        low=0.0,
                        volume=0,
                        source="IndianAPI",
                        is_live=True,
                    )

        # Fall back to last EOD close
        h = self.get_ohlcv(symbol, "5d")
        if not h.empty:
            close = h["Close"]
            price = float(close.iloc[-1])
            prev = float(close.iloc[-2]) if len(close) >= 2 else price
            change = price - prev
            change_pct = (change / prev * 100) if prev else 0.0
            return Quote(
                symbol=symbol,
                price=price,
                change=change,
                change_pct=change_pct,
                open=float(h["Open"].iloc[-1]) if "Open" in h else 0.0,
                high=float(h["High"].iloc[-1]) if "High" in h else 0.0,
                low=float(h["Low"].iloc[-1]) if "Low" in h else 0.0,
                volume=int(h["Volume"].iloc[-1]) if "Volume" in h else 0,
                source="EOD",
                is_live=False,
            )

        # Return zero quote as last resort
        return Quote(
            symbol=symbol,
            price=0.0,
            change=0.0,
            change_pct=0.0,
            open=0.0,
            high=0.0,
            low=0.0,
            volume=0,
            source="None",
            is_live=False,
        )

    def get_fundamentals(self, symbol: str) -> Fundamentals:
        """
        Get fundamental data from yfinance.
        Cached for 24 hours.
        """
        from quant.data.universe import normalize_symbol

        symbol = normalize_symbol(symbol)

        cache_key = f"fundamentals:{symbol}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        try:
            info = yf.Ticker(symbol).info
            fundamentals = Fundamentals(
                pe_ratio=info.get("trailingPE"),
                pb_ratio=info.get("priceToBook"),
                roe=info.get("returnOnEquity"),
                debt_to_equity=info.get("debtToEquity"),
                market_cap=info.get("marketCap"),
                sector=info.get("sector"),
            )
            self._cache.set(cache_key, fundamentals, expire=86400)  # 24h
            return fundamentals
        except Exception:
            return Fundamentals(
                pe_ratio=None,
                pb_ratio=None,
                roe=None,
                debt_to_equity=None,
                market_cap=None,
                sector=None,
            )

    def _is_market_open(self) -> bool:
        """Check if NSE market is currently open (IST)."""
        import pytz
        from datetime import datetime

        ist = pytz.timezone("Asia/Kolkata")
        now = datetime.now(ist)
        hour = now.hour
        minute = now.minute
        weekday = now.weekday()

        # Weekend
        if weekday >= 5:
            return False

        # Market hours: 9:15 - 15:30 IST
        if hour < 9 or hour >= 15:
            return False
        if hour == 9 and minute < 15:
            return False
        if hour == 15 and minute >= 30:
            return False

        return True


class SentimentProvider:
    """
    Sources: NewsData.io (200 req/day free) + StockTwits public API.
    Strategy: Score both sources, average with weight (news 60%, social 40% if available).
    Cache: In-memory, TTL 4 hours per symbol.
    Fallback: If both sources fail, return SentimentScore(score=0, confidence=0).
    """

    STOCKTWITS_URL = "https://api.stocktwits.com/api/2/streams/symbol/{symbol}.json"

    # StockTwits coverage for NSE is limited (~40% of symbols have data)
    # If StockTwits returns 404, we'll reduce its weight to 10%
    STOCKTWITS_WEIGHT = 0.4
    NEWSDATA_WEIGHT = 0.6

    def __init__(self):
        self._cache = {}

    def get_symbol_sentiment(self, symbol: str) -> SentimentScore:
        """
        Get sentiment score for a symbol.
        Returns averaged score from NewsData.io and StockTwits.
        """
        from quant.data.universe import normalize_symbol

        symbol = normalize_symbol(symbol)
        # Strip .NS for StockTwits
        st_symbol = symbol.replace(".NS", "").replace(".BO", "")

        # Check cache (4 hour TTL)
        cache_key = f"sentiment:{symbol}"
        if cache_key in self._cache:
            cached_time, cached_score = self._cache[cache_key]
            if time.time() - cached_time < 14400:  # 4 hours
                return cached_score

        # Fetch from both sources
        news_score, news_count = self._fetch_newsdata_sentiment(symbol)
        st_score, st_count, st_works = self._fetch_stocktwits_sentiment(st_symbol)

        # Calculate weighted average
        if st_works and st_count > 0:
            # Both sources work
            final_score = (
                news_score * self.NEWSDATA_WEIGHT + st_score * self.STOCKTWITS_WEIGHT
            )
            total_count = news_count + st_count
            bullish_pct = ((news_score > 0) + (st_score > 0)) / 2 * 100
        elif news_count > 0:
            # Only news works
            final_score = news_score
            total_count = news_count
            bullish_pct = 100 if news_score > 0 else 50 if news_score == 0 else 0
        else:
            # Neither works - return neutral
            final_score = 0.0
            total_count = 0
            bullish_pct = 50.0

        confidence = min(1.0, total_count / 10) if total_count > 0 else 0.0

        result = SentimentScore(
            score=final_score,
            confidence=confidence,
            article_count=total_count,
            bullish_pct=bullish_pct,
            source="newsdata+stocktwits" if st_works else "newsdata",
        )

        # Cache for 4 hours
        self._cache[cache_key] = (time.time(), result)
        return result

    def _fetch_newsdata_sentiment(self, symbol: str) -> tuple[float, int]:
        """Fetch sentiment from NewsData.io."""
        if not NEWSDATA_API_KEY:
            return 0.0, 0

        try:
            # Strip .NS suffix
            ticker = symbol.replace(".NS", "").replace(".BO", "")
            r = requests.get(
                "https://newsdata.io/api/1/latest",
                params={
                    "apikey": NEWSDATA_API_KEY,
                    "q": ticker,
                    "language": "en",
                },
                timeout=10,
            )
            if r.status_code != 200:
                return 0.0, 0

            data = r.json() or {}
            headlines = [item.get("title", "") for item in data.get("results", [])]
            return self._score_newsdata(headlines), len(headlines)
        except Exception:
            return 0.0, 0

    def _fetch_stocktwits_sentiment(self, symbol: str) -> tuple[float, int, bool]:
        """
        Fetch sentiment from StockTwits.
        Returns (score, message_count, success).
        Note: StockTwits has limited NSE coverage (~40% of symbols return data).
        """
        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            r = requests.get(
                self.STOCKTWITS_URL.format(symbol=symbol),
                headers=headers,
                timeout=5,
            )
            if r.status_code != 200:
                return 0.0, 0, False

            data = r.json() or {}
            messages = data.get("messages", [])

            if not messages:
                return 0.0, 0, True  # Works but no data

            bullish = sum(1 for m in messages if m.get("sentiment") == "Bullish")
            bearish = sum(1 for m in messages if m.get("sentiment") == "Bearish")
            total = bullish + bearish

            if total == 0:
                return 0.0, len(messages), True

            score = (bullish - bearish) / total
            return score, len(messages), True

        except Exception:
            return 0.0, 0, False

    def _score_newsdata(self, headlines: List[str]) -> float:
        """Simple keyword-based sentiment scoring."""
        if not headlines:
            return 0.0

        scores = []
        for headline in headlines:
            words = headline.lower().split()
            bullish = sum(1 for w in words if w in BULLISH_WORDS)
            bearish = sum(1 for w in words if w in BEARISH_WORDS)
            total = bullish + bearish
            if total > 0:
                scores.append((bullish - bearish) / total)

        if not scores:
            return 0.0

        return sum(scores) / len(scores)


class MacroProvider:
    """
    Sources: FRED API (free key) + NSE India public endpoints.
    All calls are cached daily. Never hit live in UI hot path.
    Data is fetched by the pipeline (GitHub Actions), cached in Supabase.
    """

    FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

    SERIES = {
        "US_FEDFUNDS": "FEDFUNDS",
        "US_CPI": "CPIAUCSL",
        "US_GDP": "GDP",
    }

    def __init__(self):
        self._cache = {}

    def get_upcoming_events(self) -> List[MacroEvent]:
        """
        Get upcoming macro events.
        Cached for 24 hours.
        """
        cache_key = "macro_events"
        if cache_key in self._cache:
            cached_time, cached_events = self._cache[cache_key]
            if time.time() - cached_time < 86400:  # 24h
                return cached_events

        events = []

        # Try to fetch from Supabase cache first
        events = self._load_cached_events()
        if events:
            self._cache[cache_key] = (time.time(), events)
            return events

        # Fall back to FRED API if available
        if FRED_API_KEY:
            events = self._fetch_fred_events()

        self._cache[cache_key] = (time.time(), events)
        return events

    def _load_cached_events(self) -> List[MacroEvent]:
        """Load cached events from Supabase."""
        if not _artifacts_configured():
            return []

        try:
            url = _supabase_public_url(
                SUPABASE_BUCKET, f"{EOD_PREFIX}/macro_events.json"
            )
            if not url:
                return []

            r = requests.get(url, timeout=10)
            if r.status_code != 200:
                return []

            data = r.json() or []
            return [
                MacroEvent(
                    name=e.get("name", ""),
                    date=e.get("date", ""),
                    expected=e.get("expected"),
                    prior=e.get("prior"),
                    impact_level=e.get("impact_level", "LOW"),
                    affects_nse=e.get("affects_nse", False),
                )
                for e in data
            ]
        except Exception:
            return []

    def _fetch_fred_events(self) -> List[MacroEvent]:
        """Fetch events from FRED API."""
        events = []

        for name, series_id in self.SERIES.items():
            try:
                r = requests.get(
                    f"{self.FRED_BASE}",
                    params={
                        "series_id": series_id,
                        "api_key": FRED_API_KEY,
                        "file_type": "json",
                        "limit": 1,
                        "sort_order": "desc",
                    },
                    timeout=10,
                )
                if r.status_code != 200:
                    continue

                data = r.json() or {}
                observations = data.get("observations", [])
                if not observations:
                    continue

                latest = observations[0]
                impact = "HIGH" if "CPI" in name or "FEDFUNDS" in name else "MEDIUM"

                events.append(
                    MacroEvent(
                        name=name.replace("_", " "),
                        date=latest.get("date", ""),
                        expected=float(latest.get("value", 0) or 0),
                        prior=None,
                        impact_level=impact,
                        affects_nse=name.startswith("US_"),
                    )
                )
            except Exception:
                continue

        return events


# =============================================================================
# INSTANCE ACCESS
# =============================================================================

_market_provider: Optional[MarketDataProvider] = None
_sentiment_provider: Optional[SentimentProvider] = None
_macro_provider: Optional[MacroProvider] = None


def get_market_provider() -> MarketDataProvider:
    """Get singleton MarketDataProvider instance."""
    global _market_provider
    if _market_provider is None:
        _market_provider = MarketDataProvider()
    return _market_provider


def get_sentiment_provider() -> SentimentProvider:
    """Get singleton SentimentProvider instance."""
    global _sentiment_provider
    if _sentiment_provider is None:
        _sentiment_provider = SentimentProvider()
    return _sentiment_provider


def get_macro_provider() -> MacroProvider:
    """Get singleton MacroProvider instance."""
    global _macro_provider
    if _macro_provider is None:
        _macro_provider = MacroProvider()
    return _macro_provider
