"""Local OHLCV store (Parquet) for fast, repeatable reads."""

from __future__ import annotations

import os
import re
from pathlib import Path

import pandas as pd

try:
    import duckdb
except Exception:
    duckdb = None


def data_dir() -> Path:
    env = (os.getenv("QUANTORACLE_DATA_DIR") or "").strip()
    if env:
        p = Path(env).expanduser().resolve()
        p.mkdir(parents=True, exist_ok=True)
        return p

    candidates = []
    candidates.append(Path("data").resolve())
    if Path("/data").exists():
        candidates.append(Path("/data") / "quantoracle")
    candidates.append(Path("/tmp") / "quantoracle")

    for p in candidates:
        try:
            p.mkdir(parents=True, exist_ok=True)
            t = p / ".write_test"
            t.write_text("ok", encoding="utf-8")
            t.unlink(missing_ok=True)
            return p
        except Exception:
            continue

    return Path("data").resolve()


def _safe_symbol(sym: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", sym.upper())


def ohlcv_path(sym: str) -> Path:
    return data_dir() / "ohlcv" / f"{_safe_symbol(sym)}.parquet"


def has_ohlcv(sym: str) -> bool:
    return ohlcv_path(sym).exists()


def read_ohlcv(sym: str) -> pd.DataFrame:
    p = ohlcv_path(sym)
    if not p.exists():
        return pd.DataFrame()
    try:
        return pd.read_parquet(p)
    except Exception:
        return pd.DataFrame()


def read_ohlcv_period(sym: str, period: str) -> pd.DataFrame:
    df = read_ohlcv(sym)
    if df.empty:
        return df
    if period == "5d":
        return df.tail(5)
    elif period == "1mo":
        return df.tail(30)
    elif period == "6mo":
        return df.tail(130)
    elif period == "1y":
        return df.tail(252)
    return df


def write_ohlcv(sym: str, df: pd.DataFrame) -> bool:
    if df.empty or "Close" not in df.columns:
        return False
    p = ohlcv_path(sym)
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        df.to_parquet(p, index=True)
        return True
    except Exception:
        return False
