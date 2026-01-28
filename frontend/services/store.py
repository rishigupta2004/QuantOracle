"""Local OHLCV store (Parquet) for fast, repeatable reads.

Design goal: zero magic. If files exist, use them; otherwise fall back to live fetch.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Optional

import pandas as pd

try:
    import duckdb  # type: ignore
except Exception:  # pragma: no cover
    duckdb = None


def data_dir() -> Path:
    return Path(os.getenv("QUANTORACLE_DATA_DIR", "data")).resolve()


def _safe_symbol(sym: str) -> str:
    # Keep filenames portable across OSes.
    return re.sub(r"[^A-Za-z0-9._-]+", "_", sym.upper())


def ohlcv_path(sym: str) -> Path:
    return data_dir() / "ohlcv" / f"{_safe_symbol(sym)}.parquet"


def has_ohlcv(sym: str) -> bool:
    return ohlcv_path(sym).exists()


def read_ohlcv(sym: str) -> pd.DataFrame:
    p = ohlcv_path(sym)
    if not p.exists() or duckdb is None:
        return pd.DataFrame()
    try:
        con = duckdb.connect(database=":memory:")
        df = con.execute("SELECT * FROM read_parquet(?) ORDER BY Date", [str(p)]).df()
        con.close()
        if df.empty:
            return df
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.set_index("Date")
        return df
    except Exception:
        return pd.DataFrame()


_PERIOD_ROWS = {
    "1d": 2,
    "5d": 6,
    "1mo": 40,
    "3mo": 120,
    "6mo": 250,
    "1y": 400,
    "5y": 2000,
    "max": None,
}


def read_ohlcv_period(sym: str, period: str) -> pd.DataFrame:
    p = ohlcv_path(sym)
    if not p.exists() or duckdb is None:
        return pd.DataFrame()
    n = _PERIOD_ROWS.get(period)
    try:
        con = duckdb.connect(database=":memory:")
        if n is None:
            q = "SELECT * FROM read_parquet(?) ORDER BY Date"
            df = con.execute(q, [str(p)]).df()
        else:
            q = "SELECT * FROM (SELECT * FROM read_parquet(?) ORDER BY Date DESC LIMIT ?) ORDER BY Date"
            df = con.execute(q, [str(p), int(n)]).df()
        con.close()
        if df.empty:
            return df
        df["Date"] = pd.to_datetime(df["Date"])
        return df.set_index("Date")
    except Exception:
        return pd.DataFrame()


def write_ohlcv(sym: str, h: pd.DataFrame) -> Optional[Path]:
    """Write OHLCV (expects Date index). Uses DuckDB parquet writer (no pyarrow)."""
    if duckdb is None or h is None or h.empty:
        return None
    out = ohlcv_path(sym)
    out.parent.mkdir(parents=True, exist_ok=True)
    df = h.reset_index().rename(columns={"index": "Date"}).copy()
    if "Date" not in df.columns:
        df.insert(0, "Date", pd.to_datetime(df.index))
    df["Date"] = pd.to_datetime(df["Date"])
    try:
        con = duckdb.connect(database=":memory:")
        con.register("df", df)
        # COPY doesn't consistently support parameter placeholders across DuckDB versions.
        path = str(out).replace("'", "''")
        con.execute(f"COPY df TO '{path}' (FORMAT PARQUET)")
        con.close()
        return out
    except Exception:
        return None
