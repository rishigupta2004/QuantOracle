"""Market data + indicators (India-first) with simple, consistent schemas."""

from __future__ import annotations

import os
from typing import Dict, List, Optional

import pandas as pd
import requests
import streamlit as st
import yfinance as yf
from dotenv import load_dotenv

from services.remote_artifacts import sync_ohlcv
from services.store import has_ohlcv, read_ohlcv_period

load_dotenv()

INDIANAPI_API_KEY = os.getenv("INDIANAPI_API_KEY")
INDIANAPI_BASE = os.getenv("INDIANAPI_BASE_URL", "https://stock.indianapi.in")

CACHE_QUOTE_S = 60
CACHE_HISTORY_S = 1800


def _is_india_symbol(sym: str) -> bool:
    return sym.endswith(".NS") or sym.endswith(".BO") or sym.startswith("^NSE") or sym.startswith("^BSE")


def normalize_symbol(sym: str) -> str:
    sym = sym.strip().upper()
    if sym.endswith((".NS", ".BO")):
        return sym
    if sym in ETF or sym in STOCK:
        return f"{sym}.NS"
    # Allow searching by naked ticker (RELIANCE -> RELIANCE.NS)
    for s in STOCK:
        if s.replace(".NS", "") == sym:
            return s
    for s in ETF:
        if s.replace(".NS", "") == sym:
            return s
    return sym


NIFTY50_SYMBOLS = {
    "ADANIENT.NS": "Adani Enterprises",
    "ADANIPORTS.NS": "Adani Ports",
    "APOLLOHOSP.NS": "Apollo Hospitals",
    "ASIANPAINT.NS": "Asian Paints",
    "AXISBANK.NS": "Axis Bank",
    "BAJAJ-AUTO.NS": "Bajaj Auto",
    "BAJFINANCE.NS": "Bajaj Finance",
    "BAJAJFINSV.NS": "Bajaj Finserv",
    "BPCL.NS": "Bharat Petroleum",
    "BHARTIARTL.NS": "Bharti Airtel",
    "BRITANNIA.NS": "Britannia",
    "CIPLA.NS": "Cipla",
    "COALINDIA.NS": "Coal India",
    "DIVISLAB.NS": "Divi's Labs",
    "DRREDDY.NS": "Dr. Reddy's",
    "EICHERMOT.NS": "Eicher Motors",
    "GRASIM.NS": "Grasim",
    "HCLTECH.NS": "HCL Tech",
    "HDFCBANK.NS": "HDFC Bank",
    "HDFCLIFE.NS": "HDFC Life",
    "HEROMOTOCO.NS": "Hero MotoCorp",
    "HINDALCO.NS": "Hindalco",
    "HINDUNILVR.NS": "Hindustan Unilever",
    "ICICIBANK.NS": "ICICI Bank",
    "INDUSINDBK.NS": "IndusInd Bank",
    "INFY.NS": "Infosys",
    "ITC.NS": "ITC",
    "JSWSTEEL.NS": "JSW Steel",
    "KOTAKBANK.NS": "Kotak Bank",
    "LT.NS": "Larsen & Toubro",
    "LTIM.NS": "LTIMindtree",
    "M&M.NS": "M&M",
    "MARUTI.NS": "Maruti Suzuki",
    "NESTLEIND.NS": "Nestle India",
    "NTPC.NS": "NTPC",
    "ONGC.NS": "ONGC",
    "POWERGRID.NS": "Power Grid",
    "RELIANCE.NS": "Reliance Industries",
    "SBILIFE.NS": "SBI Life",
    "SBIN.NS": "SBI",
    "SUNPHARMA.NS": "Sun Pharma",
    "TATACONSUM.NS": "Tata Consumer",
    "TATAMOTORS.NS": "Tata Motors",
    "TATASTEEL.NS": "Tata Steel",
    "TCS.NS": "TCS",
    "TECHM.NS": "Tech Mahindra",
    "TITAN.NS": "Titan",
    "ULTRACEMCO.NS": "UltraTech Cement",
    "UPL.NS": "UPL",
    "WIPRO.NS": "Wipro",
}

ETF = {
    "NIFTYBEES.NS": "Nifty 50 ETF",
    "GOLDBEES.NS": "Gold ETF",
    "SP500.NS": "S&P 500 ETF",
    "MIDCAPBEES.NS": "Midcap ETF",
    "SMLCAPBEES.NS": "Smallcap ETF",
    "LIQUIDBEES.NS": "Liquid ETF",
    "TATASILV.NS": "Tata Silver ETF",
    "SILVERBEES.NS": "Silver ETF",
    "KOTAKGOLD.NS": "Kotak Gold ETF",
    "SBIETFGOLD.NS": "SBI Gold ETF",
    "MON100.NS": "Nasdaq 100 ETF",
    "MAFANG.NS": "MAFANG ETF",
    "JUNIORBEES.NS": "Nifty Next 50 ETF",
    "BANKBEES.NS": "Bank Nifty ETF",
    "ITBEES.NS": "Nifty IT ETF",
    "PHARMABEES.NS": "Nifty Pharma ETF",
    "PSUBANKBEES.NS": "PSU Bank ETF",
}

STOCK = {
    **{
        "IEX.NS": "IEX",
        "CDSL.NS": "CDSL",
        "ZOMATO.NS": "Zomato",
        "PAYTM.NS": "Paytm",
        "JIOFIN.NS": "Jio Financial",
        "DMART.NS": "DMart",
        "HAL.NS": "HAL",
        "VBL.NS": "Varun Beverages",
        "BSE.NS": "BSE Ltd",
        "ANGELONE.NS": "Angel One",
        "IRFC.NS": "IRFC",
        "RVNL.NS": "RVNL",
        "IREDA.NS": "IREDA",
    },
    **NIFTY50_SYMBOLS,
}


def _yahoo_history(sym: str, period: str) -> pd.DataFrame:
    try:
        h = yf.Ticker(sym).history(period=period, timeout=10)
        return h if isinstance(h, pd.DataFrame) else pd.DataFrame()
    except Exception:
        return pd.DataFrame()


def _indianapi_price(sym: str) -> Optional[float]:
    if not INDIANAPI_API_KEY:
        return None
    if sym.startswith("^") or "NIFTY" in sym:
        return None
    try:
        name = sym.replace(".NS", "").replace(".BO", "")
        r = requests.get(
            f"{INDIANAPI_BASE}/stock",
            params={"name": name},
            headers={"x-api-key": INDIANAPI_API_KEY},
            timeout=5,
        )
        if r.status_code != 200:
            return None
        d = r.json() or {}
        cp = (d.get("currentPrice") or {}).get("NSE") or (d.get("currentPrice") or {}).get("BSE")
        return float(cp) if cp else None
    except Exception:
        return None


@st.cache_data(ttl=CACHE_QUOTE_S)
def get_quote(sym: str) -> Dict:
    sym = normalize_symbol(sym)
    sync_ohlcv(sym)

    h = read_ohlcv_period(sym, "5d") if has_ohlcv(sym) else pd.DataFrame()
    if h.empty:
        h = _yahoo_history(sym, "5d")
    if h.empty or "Close" not in h:
        return {"symbol": sym, "price": 0.0, "change": 0.0, "change_pct": 0.0, "open": 0.0, "high": 0.0, "low": 0.0, "volume": 0, "source": "None"}

    last_close = float(h["Close"].iloc[-1])
    prev_close = float(h["Close"].iloc[-2]) if len(h) >= 2 else last_close

    price = last_close
    source = "yahoo"

    # If IndianAPI is configured, use it only to override the current price for India symbols.
    if _is_india_symbol(sym):
        ip = _indianapi_price(sym)
        if ip:
            price = float(ip)
            source = "IndianAPI"

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


@st.cache_data(ttl=CACHE_QUOTE_S)
def get_quotes(syms: List[str]) -> Dict[str, Dict]:
    return {s: get_quote(s) for s in syms}


@st.cache_data(ttl=CACHE_HISTORY_S)
def get_historical(sym: str, period: str = "1mo") -> pd.DataFrame:
    sym = normalize_symbol(sym)
    sync_ohlcv(sym)
    h = read_ohlcv_period(sym, period) if has_ohlcv(sym) else pd.DataFrame()
    if h.empty:
        h = _yahoo_history(sym, period)
    if not h.empty:
        return h
    return pd.DataFrame()


def indicators(h: pd.DataFrame) -> Dict:
    if h is None or h.empty or len(h) < 20:
        return {}

    close = h["Close"].astype(float)
    high = h["High"].astype(float)
    low = h["Low"].astype(float)
    volume = h["Volume"].astype(float) if "Volume" in h else pd.Series(0.0, index=h.index)

    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist = macd_line - signal_line

    lowest_low = low.rolling(14).min()
    highest_high = high.rolling(14).max()
    stoch_k = 100 * (close - lowest_low) / (highest_high - lowest_low)
    stoch_d = stoch_k.rolling(3).mean()

    tr = pd.concat(
        [(high - low), (high - close.shift()).abs(), (low - close.shift()).abs()],
        axis=1,
    ).max(axis=1)
    atr = tr.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()

    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20
    sma50 = close.rolling(50).mean()
    sma200 = close.rolling(200).mean() if len(close) >= 200 else sma50

    vol_sma20 = volume.rolling(20).mean()
    vol_ratio = float(volume.iloc[-1] / vol_sma20.iloc[-1]) if vol_sma20.iloc[-1] else 0.0

    price = float(close.iloc[-1])
    prev = float(close.iloc[-2]) if len(close) >= 2 else price
    change_pct = float((price - prev) / prev * 100) if prev else 0.0

    return {
        "price": price,
        "change_pct": change_pct,
        "sma_20": float(sma20.iloc[-1]),
        "sma_50": float(sma50.iloc[-1]),
        "sma_200": float(sma200.iloc[-1]) if len(close) >= 200 else 0.0,
        "rsi": float(rsi.iloc[-1]),
        "macd": float(macd_line.iloc[-1]),
        "macd_signal": float(signal_line.iloc[-1]),
        "macd_hist": float(macd_hist.iloc[-1]),
        "stoch_k": float(stoch_k.iloc[-1]),
        "stoch_d": float(stoch_d.iloc[-1]),
        "atr": float(atr.iloc[-1]),
        "atr_pct": float(atr.iloc[-1] / price * 100) if price else 0.0,
        "bb_upper": float(bb_upper.iloc[-1]),
        "bb_middle": float(sma20.iloc[-1]),
        "bb_lower": float(bb_lower.iloc[-1]),
        "bb_position": float((price - bb_lower.iloc[-1]) / (bb_upper.iloc[-1] - bb_lower.iloc[-1]) * 100)
        if (bb_upper.iloc[-1] - bb_lower.iloc[-1])
        else 0.0,
        "volume": int(volume.iloc[-1]) if len(volume) else 0,
        "vol_ratio": float(vol_ratio),
        "vol_sma20": float(vol_sma20.iloc[-1]) if len(vol_sma20) else 0.0,
        "support_1": float(bb_lower.iloc[-1]),
        "resistance_1": float(bb_upper.iloc[-1]),
    }


@st.cache_data(ttl=120)
def get_indicators(sym: str) -> Dict:
    return indicators(get_historical(sym, "6mo"))


def indicators_timeseries(h: pd.DataFrame) -> Dict:
    if h is None or h.empty or len(h) < 20:
        return {}

    close = h["Close"].astype(float)
    high = h["High"].astype(float)
    low = h["Low"].astype(float)

    sma20 = close.rolling(20).mean()
    sma50 = close.rolling(50).mean()
    sma200 = close.rolling(200).mean() if len(close) >= 200 else sma50

    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist = macd_line - signal_line

    lowest_low = low.rolling(14).min()
    highest_high = high.rolling(14).max()
    stoch_k = 100 * (close - lowest_low) / (highest_high - lowest_low)
    stoch_d = stoch_k.rolling(3).mean()

    tr = pd.concat(
        [(high - low), (high - close.shift()).abs(), (low - close.shift()).abs()],
        axis=1,
    ).max(axis=1)
    atr = tr.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()

    std20 = close.rolling(20).std()
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20

    return {
        "close": close,
        "sma20": sma20,
        "sma50": sma50,
        "sma200": sma200,
        "rsi": rsi,
        "macd": macd_line,
        "macd_signal": signal_line,
        "macd_hist": macd_hist,
        "stoch_k": stoch_k,
        "stoch_d": stoch_d,
        "atr": atr,
        "bb_upper": bb_upper,
        "bb_lower": bb_lower,
    }


def calculate_signal_score(ind: Dict) -> Dict:
    if not ind:
        return {"trend": "NEUTRAL", "confidence": 0.0, "score": 0, "signals": [], "max_score": 4}

    score = 0
    signals = []

    if ind["price"] > ind["sma_20"]:
        score += 1
        signals.append(("MA", "+1", "Price > SMA20"))
    elif ind["price"] < ind["sma_20"]:
        score -= 1
        signals.append(("MA", "-1", "Price < SMA20"))

    rsi = ind.get("rsi", 50.0)
    if rsi < 30:
        score += 1
        signals.append(("RSI", "+1", f"Oversold ({rsi:.1f})"))
    elif rsi > 70:
        score -= 1
        signals.append(("RSI", "-1", f"Overbought ({rsi:.1f})"))

    if ind.get("macd", 0.0) > ind.get("macd_signal", 0.0):
        score += 1
        signals.append(("MACD", "+1", "MACD > Signal"))
    else:
        score -= 1
        signals.append(("MACD", "-1", "MACD < Signal"))

    stoch_k = ind.get("stoch_k", 50.0)
    if stoch_k < 20:
        score += 1
        signals.append(("STOCH", "+1", f"Oversold ({stoch_k:.1f})"))
    elif stoch_k > 80:
        score -= 1
        signals.append(("STOCH", "-1", f"Overbought ({stoch_k:.1f})"))

    trend_map = {
        4: ("STRONG BULLISH", 95),
        3: ("STRONG BULLISH", 94),
        2: ("BULLISH", 65),
        1: ("WEAK BULLISH", 55),
        0: ("NEUTRAL", 50),
        -1: ("WEAK BEARISH", 45),
        -2: ("BEARISH", 35),
        -3: ("STRONG BEARISH", 94),
        -4: ("STRONG BEARISH", 95),
    }
    trend, conf = trend_map.get(score, ("NEUTRAL", 50))
    return {"trend": trend, "confidence": float(conf), "score": int(score), "signals": signals, "max_score": 4}


def search(q: str) -> List[Dict]:
    if not q:
        return []
    q = q.lower()
    items = {**STOCK, **ETF}
    out = [
        {"symbol": s, "name": n, "exchange": "NSE", "type": "ETF" if s in ETF else "STOCK", "region": "India"}
        for s, n in items.items()
        if q in s.lower() or q in n.lower()
    ]
    return out[:20]


def get_trending() -> Dict:
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
        return {"gainers": (ts.get("top_gainers") or [])[:5], "losers": (ts.get("top_losers") or [])[:5]}
    except Exception:
        return {"gainers": [], "losers": []}


def sources() -> Dict:
    return {"indianapi": bool(INDIANAPI_API_KEY), "yahoo": True}
