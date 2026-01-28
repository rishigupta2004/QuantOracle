#!/usr/bin/env python3
"""EOD ingest: download OHLCV and write to local Parquet store.

Usage:
  python scripts/ingest_eod.py --symbols RELIANCE.NS,TCS.NS --period 5y
  python scripts/ingest_eod.py --symbols-file symbols.txt --period max
  python scripts/ingest_eod.py --universe data/universe/india_core.txt --period 5y
"""

# ruff: noqa: E402  (sys.path bootstrap must run before local imports)

from __future__ import annotations

import argparse
from pathlib import Path
import time

import pandas as pd
import yfinance as yf

import sys

from pathlib import Path as _Path

# Scripts are executed with `scripts/` as sys.path[0]. Add repo root + frontend for imports.
_ROOT = str(_Path(__file__).resolve().parents[1])
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
_FRONTEND = str(_Path(__file__).resolve().parents[1] / "frontend")
if _FRONTEND not in sys.path:
    sys.path.insert(0, _FRONTEND)

from services.store import write_ohlcv


def _normalize_symbol(sym: str) -> str:
    # Keep ingest independent of Streamlit/UI modules.
    return sym.strip().upper()


def _read_symbols(path: Path) -> list[str]:
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        out.append(line)
    return out


def _chunks(xs: list[str], n: int) -> list[list[str]]:
    n = max(1, int(n))
    return [xs[i : i + n] for i in range(0, len(xs), n)]


def _download(syms: list[str], period: str, auto_adjust: bool, threads: bool, progress: bool) -> pd.DataFrame:
    try:
        df = yf.download(
            syms,
            period=period,
            group_by="ticker",
            auto_adjust=auto_adjust,
            threads=threads,
            progress=progress,
        )
        return df if isinstance(df, pd.DataFrame) else pd.DataFrame()
    except Exception:
        return pd.DataFrame()


def _extract(df: pd.DataFrame, sym: str) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    if isinstance(df.columns, pd.MultiIndex):
        if sym not in df.columns.get_level_values(0):
            return pd.DataFrame()
        return df[sym].dropna(how="all")
    return df.dropna(how="all")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--symbols", default="", help="Comma-separated symbols")
    ap.add_argument("--symbols-file", default="", help="Text file with 1 symbol per line")
    ap.add_argument("--universe", default="", help="Alias for --symbols-file")
    ap.add_argument("--period", default="5y", help="yfinance period: 1y/5y/max")
    ap.add_argument("--no-adjust", action="store_true", help="Disable auto_adjust")
    ap.add_argument("--batch-size", type=int, default=10, help="Download tickers in batches (reduces yfinance flakiness)")
    ap.add_argument("--retries", type=int, default=2, help="Retries per batch/symbol on transient failures")
    ap.add_argument("--threads", action="store_true", help="Enable yfinance threads (faster, less reliable)")
    args = ap.parse_args()

    syms = []
    if args.symbols:
        syms += [s.strip() for s in args.symbols.split(",") if s.strip()]
    symbols_file = args.symbols_file or args.universe
    if symbols_file:
        syms += _read_symbols(Path(symbols_file))
    syms = [_normalize_symbol(s) for s in dict.fromkeys(syms)]  # de-dupe, keep order

    if not syms:
        raise SystemExit("No symbols provided")

    auto_adjust = not args.no_adjust
    batches = _chunks(syms, args.batch_size)

    wrote = 0
    failed_dl: list[str] = []
    failed_write: list[str] = []

    for batch in batches:
        df = pd.DataFrame()
        for attempt in range(args.retries + 1):
            df = _download(batch, args.period, auto_adjust, threads=args.threads, progress=(attempt == 0))
            if not df.empty:
                break
            time.sleep(0.75 * (attempt + 1))

        for sym in batch:
            h = _extract(df, sym)

            # Fallback: per-symbol download tends to be more reliable than multi-ticker.
            if h.empty:
                one = pd.DataFrame()
                for attempt in range(args.retries + 1):
                    one = _download([sym], args.period, auto_adjust, threads=False, progress=False)
                    h = _extract(one, sym)
                    if not h.empty:
                        break
                    time.sleep(0.75 * (attempt + 1))

            if h.empty:
                failed_dl.append(sym)
                print(f"Skip {sym}: empty (download failed)")
                continue

            out = write_ohlcv(sym, h)
            if out is None:
                failed_write.append(sym)
                print(f"Failed {sym}: could not write Parquet (is `duckdb` installed?)")
            else:
                wrote += 1
                print(f"Wrote {sym} -> {out}")

    if failed_dl:
        print(f"\nDownload failed ({len(failed_dl)}): {failed_dl}")
    if failed_write:
        print(f"\nWrite failed ({len(failed_write)}): {failed_write}")

    if wrote == 0:
        raise SystemExit("No data written. yfinance may be blocked/rate-limited; try again later or reduce universe.")
    return 2 if failed_dl or failed_write else 0


if __name__ == "__main__":
    raise SystemExit(main())
