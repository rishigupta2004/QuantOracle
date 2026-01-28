#!/usr/bin/env python3
"""Quick sanity test for Groww EOD candles (NSE CASH).

Usage:
  GROWW_API_KEY=... GROWW_API_SECRET=... python scripts/test_groww_source.py --symbol TCS --days 30
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.groww_api import GrowwAuth, get_access_token, get_candles_range


def _candles_to_df(candles: list[list[object]]) -> pd.DataFrame:
    if not candles:
        return pd.DataFrame()
    # candle: [epoch_seconds, open, high, low, close, volume]
    df = pd.DataFrame(candles, columns=["ts", "Open", "High", "Low", "Close", "Volume"])
    df["ts"] = pd.to_datetime(df["ts"], unit="s", utc=True).dt.tz_convert("Asia/Kolkata").dt.tz_localize(None)
    df = df.set_index("ts").sort_index()
    # normalize to date index (EOD)
    df.index = pd.to_datetime(df.index.date)
    return df.apply(pd.to_numeric, errors="coerce").dropna(how="all")


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--symbol", default=os.getenv("GROWW_TEST_SYMBOL", "TCS"))
    ap.add_argument("--days", type=int, default=30)
    args = ap.parse_args()

    api_key = (os.getenv("GROWW_API_KEY") or "").strip()
    api_secret = (os.getenv("GROWW_API_SECRET") or "").strip()
    if not api_key or not api_secret:
        raise SystemExit("Missing GROWW_API_KEY / GROWW_API_SECRET in env.")

    auth = GrowwAuth(api_key=api_key, api_secret=api_secret)
    token = get_access_token(auth)

    end = datetime.now()
    start = end - timedelta(days=int(args.days))
    start_s = start.strftime("%Y-%m-%d 09:15:00")
    end_s = end.strftime("%Y-%m-%d 15:30:00")

    trading_symbol = args.symbol.replace(".NS", "").upper()
    candles = get_candles_range(token, trading_symbol=trading_symbol, start_time=start_s, end_time=end_s, interval_in_minutes=1440)
    df = _candles_to_df(candles)
    if df.empty:
        print("FAIL: empty candles")
        return 1
    print(df.tail(5))
    print("PASS: Groww returned candles")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
