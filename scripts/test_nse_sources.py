#!/usr/bin/env python3
"""Quick sanity tests for India NSE data sources (unofficial).

This script is NOT used by the app at runtime. It's a diagnostic runner to answer:
  - Does the NSE charting endpoint approach (FabTrader-style) work right now?
  - Does nsepy work right now?

These sources can break any time due to NSE site changes or blocking.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import requests


def _hr(title: str):
    print("\n" + "=" * 20, title, "=" * 20)


@dataclass
class NSEChartingClient:
    """Minimal NSE charting client (based on the code you pasted from FabTrader article)."""

    session: requests.Session
    nse_url: str = "https://charting.nseindia.com/Charts/GetEQMasters"
    nfo_url: str = "https://charting.nseindia.com/Charts/GetFOMasters"
    historical_url: str = "https://charting.nseindia.com/Charts/symbolhistoricaldata/"
    nse_data: Optional[pd.DataFrame] = None
    nfo_data: Optional[pd.DataFrame] = None

    @staticmethod
    def new() -> "NSEChartingClient":
        s = requests.Session()
        s.headers.update(
            {
                "Connection": "keep-alive",
                "Cache-Control": "max-age=0",
                "DNT": "1",
                "Upgrade-Insecure-Requests": "1",
                "User-Agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
                "Accept-Encoding": "gzip, deflate, br",
                "Content-Type": "application/json",
            }
        )
        return NSEChartingClient(session=s)

    def _get_master(self, url: str) -> pd.DataFrame:
        try:
            r = self.session.get(url, timeout=15)
            r.raise_for_status()
            lines = (r.text or "").splitlines()
            if not lines:
                return pd.DataFrame()
            cols = ["ScripCode", "Symbol", "Name", "Type"]
            return pd.DataFrame([ln.split("|") for ln in lines], columns=cols)
        except Exception as e:
            print(f"master fetch failed: {url} ({e})")
            return pd.DataFrame()

    def download_symbol_master(self) -> None:
        self.nse_data = self._get_master(self.nse_url)
        self.nfo_data = self._get_master(self.nfo_url)

    def _search_first(self, symbol: str, exchange: str) -> Optional[pd.Series]:
        df = self.nse_data if exchange.upper() == "NSE" else self.nfo_data
        if df is None or df.empty:
            return None
        # NSE masters include both company names and symbols; match either.
        m = df[df["Symbol"].str.contains(symbol, case=False, na=False)]
        if m.empty:
            m = df[df["Name"].str.contains(symbol, case=False, na=False)]
        return None if m.empty else m.iloc[0]

    def get_history(self, symbol: str, exchange: str, start: datetime, end: datetime, interval: str) -> pd.DataFrame:
        si = self._search_first(symbol, exchange)
        if si is None:
            print(f"symbol not found in {exchange} master: {symbol}")
            return pd.DataFrame()

        interval_xref = {
            "1m": ("1", "I"),
            "3m": ("3", "I"),
            "5m": ("5", "I"),
            "10m": ("5", "I"),
            "15m": ("15", "I"),
            "30m": ("15", "I"),
            "1h": ("15", "I"),
            "1d": ("1", "D"),
            "1w": ("1", "W"),
            "1M": ("1", "M"),
        }
        time_interval, chart_period = interval_xref.get(interval, ("1", "D"))

        scrip = int(si["ScripCode"])
        payload = {
            "exch": "N" if exchange.upper() == "NSE" else "D",
            "instrType": "C" if exchange.upper() == "NSE" else "D",
            "ScripCode": scrip,
            "ulScripCode": scrip,
            "fromDate": int(start.timestamp()),
            "toDate": int(end.timestamp()),
            "timeInterval": time_interval,
            "chartPeriod": chart_period,
            "chartStart": 0,
        }

        try:
            # Attempt to set cookies (often required).
            self.session.get("https://www.nseindia.com", timeout=10)
        except Exception:
            pass

        try:
            r = self.session.post(self.historical_url, data=json.dumps(payload), timeout=20)
            if r.status_code != 200:
                print(f"history HTTP {r.status_code}: {r.text[:200]}")
                return pd.DataFrame()
            data = r.json()
        except Exception as e:
            print(f"history fetch failed: {e}")
            return pd.DataFrame()

        if not data:
            return pd.DataFrame()
        df = pd.DataFrame(data)
        if df.empty or df.shape[1] < 7:
            return pd.DataFrame()
        df.columns = ["Status", "TS", "Open", "High", "Low", "Close", "Volume"]
        df["TS"] = pd.to_datetime(df["TS"], unit="s", utc=True).dt.tz_localize(None)
        df = df[["TS", "Open", "High", "Low", "Close", "Volume"]]
        df = df.rename(columns={"TS": "Date"}).set_index("Date")
        return df.sort_index()


def test_fabtrader(symbol: str, days: int) -> bool:
    _hr("FabTrader-Style NSE Charting")
    c = NSEChartingClient.new()
    t0 = time.time()
    c.download_symbol_master()
    print(f"masters: NSE={0 if c.nse_data is None else len(c.nse_data)} NFO={0 if c.nfo_data is None else len(c.nfo_data)} ({time.time()-t0:.2f}s)")
    if c.nse_data is None or c.nse_data.empty:
        print("FAIL: no NSE master data")
        return False

    end = datetime.now()
    start = end - timedelta(days=int(days))
    df = c.get_history(symbol=symbol, exchange="NSE", start=start, end=end, interval="1d")
    if df.empty:
        print("FAIL: empty history")
        return False
    print(df.tail(3))
    print("PASS: non-empty history")
    return True


def test_nsepy(symbol: str, days: int) -> bool:
    _hr("nsepy")
    try:
        from nsepy import get_history  # type: ignore
    except Exception as e:
        print(f"SKIP: nsepy import failed ({e}). Install: `pip install nsepy`")
        return False

    try:
        # nsepy expects symbol without .NS
        sym = re.sub(r"\\.NS$", "", symbol.upper())
        end = datetime.now().date()
        start = end - timedelta(days=int(days))
        df = get_history(symbol=sym, start=start, end=end)
        if df is None or getattr(df, "empty", True):
            print("FAIL: empty history")
            return False
        print(df.tail(3))
        print("PASS: non-empty history")
        return True
    except Exception as e:
        print(f"FAIL: exception ({e})")
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--symbol", default=os.getenv("NSE_TEST_SYMBOL", "TCS"), help="Example: TCS / RELIANCE / NIFTY 50")
    ap.add_argument("--days", type=int, default=7)
    args = ap.parse_args()

    ok1 = test_fabtrader(args.symbol, args.days)
    ok2 = test_nsepy(args.symbol, args.days)

    _hr("Summary")
    print(f"FabTrader-style: {'OK' if ok1 else 'NO'}")
    print(f"nsepy: {'OK' if ok2 else 'NO'}")
    return 0 if (ok1 or ok2) else 1


if __name__ == "__main__":
    raise SystemExit(main())

