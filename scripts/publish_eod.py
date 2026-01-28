#!/usr/bin/env python3
"""Build + publish EOD screener artifacts (features + model) for a universe.

Goal: produce a stable, daily "as-of close" snapshot for Streamlit Cloud.

Outputs (local):
  data/features.parquet
  data/models/ridge_h{horizon}/<version>/{model.npz,meta.json}
  data/models/ridge_h{horizon}/LATEST
  data/eod_latest.json

If --upload is set, uploads to Supabase Storage public bucket under:
  eod/<universe>/features.parquet
  eod/<universe>/models/...
  eod/<universe>/latest.json
"""

# ruff: noqa: E402  (sys.path bootstrap must run before local imports)

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

import duckdb
import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv()

from quant.features import build_features, build_targets
from quant.registry import data_root, model_version_dir, save_meta, version_id, write_latest
from quant.ridge import fit_ridge, predict, zscore_apply, zscore_fit
from scripts.groww_api import GrowwAuth, get_access_token, get_candles_range
from scripts.supabase_storage import from_env


@dataclass(frozen=True)
class Provider:
    name: str

    def history(self, sym: str, *, days: int) -> pd.DataFrame:
        raise NotImplementedError


class YFinance(Provider):
    def __init__(self):
        super().__init__(name="yfinance")

    def history(self, sym: str, *, days: int) -> pd.DataFrame:
        import yfinance as yf

        # yfinance periods are coarse; pick nearest.
        period = "1y" if days <= 365 else "2y" if days <= 730 else "5y"
        try:
            df = yf.download(sym, period=period, auto_adjust=True, threads=False, progress=False)
        except Exception:
            return pd.DataFrame()
        if not isinstance(df, pd.DataFrame) or df.empty:
            return pd.DataFrame()
        df = df.dropna(how="all")
        if df.empty or "Close" not in df:
            return pd.DataFrame()
        df.index = pd.to_datetime(df.index)
        return df


class EODHD(Provider):
    def __init__(self, api_token: str):
        super().__init__(name="eodhd")
        self.api_token = api_token
        self._warned = 0

    def history(self, sym: str, *, days: int) -> pd.DataFrame:
        # EODHD uses EXCHANGE suffix, e.g. RELIANCE.NSE.
        ticker = sym.replace(".NS", ".NSE")
        to_dt = datetime.now(timezone.utc).date()
        from_dt = to_dt - timedelta(days=int(days) + 7)  # pad for weekends/holidays
        url = f"https://eodhd.com/api/eod/{ticker}"
        params = {
            "api_token": self.api_token,
            "fmt": "json",
            "period": "d",
            "from": from_dt.strftime("%Y-%m-%d"),
            "to": to_dt.strftime("%Y-%m-%d"),
        }
        try:
            r = requests.get(url, params=params, timeout=30)
            if r.status_code != 200:
                if self._warned < 3:
                    self._warned += 1
                    print(f"EODHD {ticker} -> {r.status_code}: {(r.text or '')[:200]}")
                return pd.DataFrame()
            data = r.json() or []
        except Exception:
            return pd.DataFrame()
        if not isinstance(data, list) or not data:
            if self._warned < 3:
                self._warned += 1
                s = data if isinstance(data, dict) else {"response": str(type(data))}
                print(f"EODHD {ticker} -> empty/non-list: {str(s)[:200]}")
            return pd.DataFrame()
        df = pd.DataFrame(data)
        if "date" not in df or "close" not in df:
            return pd.DataFrame()
        df["Date"] = pd.to_datetime(df["date"])
        df = df.set_index("Date").sort_index()
        out = pd.DataFrame({"Close": pd.to_numeric(df["close"], errors="coerce")})
        if "volume" in df:
            out["Volume"] = pd.to_numeric(df["volume"], errors="coerce")
        return out.dropna()


class Groww(Provider):
    def __init__(self, api_key: str, api_secret: str):
        super().__init__(name="groww")
        self._auth = GrowwAuth(api_key=api_key, api_secret=api_secret)
        self._token: str | None = None
        self._warned = 0

    def _token_get(self) -> str:
        if self._token:
            return self._token
        self._token = get_access_token(self._auth)
        return self._token

    def history(self, sym: str, *, days: int) -> pd.DataFrame:
        trading_symbol = sym.replace(".NS", "").upper()
        end = datetime.now()
        start = end - timedelta(days=int(days) + 7)  # pad for weekends/holidays
        start_s = start.strftime("%Y-%m-%d 09:15:00")
        end_s = end.strftime("%Y-%m-%d 15:30:00")

        try:
            candles = get_candles_range(
                self._token_get(),
                trading_symbol=trading_symbol,
                start_time=start_s,
                end_time=end_s,
                interval_in_minutes=1440,
            )
        except Exception as e:
            if self._warned < 3:
                self._warned += 1
                print(f"Groww {trading_symbol} -> {str(e)[:200]}")
            return pd.DataFrame()

        if not candles:
            return pd.DataFrame()

        df = pd.DataFrame(candles, columns=["ts", "Open", "High", "Low", "Close", "Volume"])
        df["ts"] = pd.to_datetime(df["ts"], unit="s", utc=True).dt.tz_convert("Asia/Kolkata").dt.tz_localize(None)
        df = df.set_index("ts").sort_index()
        df.index = pd.to_datetime(df.index.date)  # normalize to date
        df = df.apply(pd.to_numeric, errors="coerce").dropna(subset=["Close"])
        return df


def _read_universe(path: Path) -> list[str]:
    out: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        out.append(s.upper())
    return out


def _parquet_write(df: pd.DataFrame, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(database=":memory:")
    con.register("df", df)
    path = str(out_path).replace("'", "''")
    con.execute(f"COPY df TO '{path}' (FORMAT PARQUET)")
    con.close()


def _safe_symbol(sym: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", sym.upper())


def _ohlcv_path(sym: str) -> Path:
    return data_root() / "ohlcv" / f"{_safe_symbol(sym)}.parquet"


def _write_ohlcv(sym: str, h: pd.DataFrame) -> None:
    if h is None or h.empty:
        return
    if "Close" not in h:
        return
    out = _ohlcv_path(sym)
    out.parent.mkdir(parents=True, exist_ok=True)

    df = h.copy()
    df.index = pd.to_datetime(df.index)
    df = df.reset_index().rename(columns={"index": "Date"})
    if "Date" not in df.columns:
        return
    for c in ["Open", "High", "Low", "Close"]:
        if c not in df.columns:
            return
    if "Volume" not in df.columns:
        df["Volume"] = 0
    df = df[["Date", "Open", "High", "Low", "Close", "Volume"]]

    con = duckdb.connect(database=":memory:")
    con.register("df", df)
    path = str(out).replace("'", "''")
    con.execute(f"COPY df TO '{path}' (FORMAT PARQUET)")
    con.close()


def _build_feature_table(universe: Iterable[str], provider: Provider, *, horizon: int, days: int) -> pd.DataFrame:
    rows: list[pd.DataFrame] = []
    for sym in universe:
        h = provider.history(sym, days=days)
        if h.empty:
            continue
        _write_ohlcv(sym, h)
        f = build_features(h)
        if f.empty:
            continue
        y = build_targets(h["Close"], horizon=horizon).reindex(f.index)
        # Keep the latest feature rows even though their forward target is NaN.
        f = f.assign(symbol=sym, target=y)
        rows.append(f.reset_index().rename(columns={"index": "Date"}))
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()


def _train_ridge(df: pd.DataFrame, *, horizon: int, alpha: float) -> tuple[dict, dict]:
    df = df.copy()
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date").dropna()

    features = [c for c in df.columns if c not in {"Date", "symbol", "target"}]

    dates = df["Date"].drop_duplicates().sort_values()
    if len(dates) < 50:
        raise SystemExit("Not enough dates to train (need at least ~50).")
    cutoff = dates.iloc[int(len(dates) * 0.8)]
    train = df[df["Date"] <= cutoff]
    test = df[df["Date"] > cutoff]

    Xtr = train[features].to_numpy(dtype=float)
    ytr = train["target"].to_numpy(dtype=float)
    mu, sig = zscore_fit(Xtr)
    w = fit_ridge(zscore_apply(Xtr, mu, sig), ytr, alpha=alpha)

    Xte = test[features].to_numpy(dtype=float)
    yte = test["target"].to_numpy(dtype=float)
    yhat = predict(zscore_apply(Xte, mu, sig), w)

    ic = float(np.corrcoef(yhat, yte)[0, 1]) if len(yte) > 10 else 0.0
    hit = float((np.sign(yhat) == np.sign(yte)).mean()) if len(yte) else 0.0

    meta = {
        "model": "ridge",
        "horizon": horizon,
        "alpha": alpha,
        "features": features,
        "cutoff": cutoff.strftime("%Y-%m-%d"),
        "rows_train": int(len(train)),
        "rows_test": int(len(test)),
        "ic": ic,
        "hit_rate": hit,
    }
    model = {"w": w, "mu": mu, "sig": sig, "features": features}
    return meta, model


def _write_model(meta: dict, model: dict, *, model_id: str) -> tuple[str, Path]:
    v = version_id()
    out_dir = model_version_dir(model_id, v)
    out_dir.mkdir(parents=True, exist_ok=True)
    np.savez(out_dir / "model.npz", w=model["w"], mu=model["mu"], sig=model["sig"], features=np.array(model["features"], dtype=object))
    save_meta(out_dir, meta)
    write_latest(model_id, v)
    return v, out_dir


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--universe-file", default="data/universe/nifty50.txt")
    ap.add_argument("--universe-name", default="nifty50")
    ap.add_argument("--horizon", type=int, default=5)
    ap.add_argument("--alpha", type=float, default=10.0)
    ap.add_argument("--history-days", type=int, default=365, help="History window to fetch per symbol")
    ap.add_argument("--provider", choices=["auto", "groww", "eodhd", "yfinance"], default="auto")
    ap.add_argument("--upload", action="store_true", help="Upload artifacts to Supabase Storage")
    ap.add_argument("--prefix", default="", help="Remote prefix (default: eod/<universe-name>)")
    args = ap.parse_args()

    universe = _read_universe(Path(args.universe_file))
    if not universe:
        raise SystemExit("Empty universe file")

    eodhd_key = (os.getenv("EODHD_API_KEY") or "").strip()
    groww_key = (os.getenv("GROWW_API_KEY") or "").strip()
    groww_secret = (os.getenv("GROWW_API_SECRET") or "").strip()
    providers: list[Provider] = []
    if args.provider in ("auto", "groww") and groww_key and groww_secret:
        providers.append(Groww(groww_key, groww_secret))
    if args.provider in ("auto", "eodhd") and eodhd_key:
        providers.append(EODHD(eodhd_key))
    if args.provider in ("auto", "yfinance") or not providers:
        providers.append(YFinance())

    if args.provider in ("auto", "groww") and not (groww_key and groww_secret):
        print("Note: GROWW_API_KEY/GROWW_API_SECRET not set; skipping Groww.")
    if args.provider in ("auto", "eodhd") and not eodhd_key:
        print("Note: EODHD_API_KEY not set; skipping EODHD.")

    df = pd.DataFrame()
    used = None
    for p in providers:
        df = _build_feature_table(universe, p, horizon=args.horizon, days=args.history_days)
        if not df.empty:
            used = p.name
            break

    if df.empty:
        raise SystemExit("No features produced (data source unavailable).")

    root = data_root()
    df["Date"] = pd.to_datetime(df["Date"])
    as_of = pd.to_datetime(df["Date"].max()).strftime("%Y-%m-%d")

    feat_path = root / "features.parquet"
    _parquet_write(df, feat_path)

    model_id = f"ridge_h{args.horizon}"
    meta, model = _train_ridge(df, horizon=args.horizon, alpha=args.alpha)
    meta.update({"universe": args.universe_name, "universe_size": len(universe), "provider": used or ""})
    v, model_dir = _write_model(meta, model, model_id=model_id)

    latest = {
        "as_of_date": as_of,
        "universe": args.universe_name,
        "universe_size": len(universe),
        "horizon": args.horizon,
        "model_id": model_id,
        "model_version": v,
        "provider": used or "",
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    (root / "eod_latest.json").write_text(json.dumps(latest, indent=2), encoding="utf-8")

    print(f"Wrote features -> {feat_path}")
    print(f"Wrote model -> {model_dir}")
    print(f"As-of {as_of} universe={args.universe_name} n={len(universe)} provider={used} model={model_id}@{v}")

    if not args.upload:
        return 0

    sb = from_env(require_write=True)
    if not sb:
        raise SystemExit("Missing SUPABASE_URL/SUPABASE_BUCKET/SUPABASE_SERVICE_ROLE_KEY for upload")

    prefix = args.prefix.strip().strip("/") or f"eod/{args.universe_name}"

    # Upload features + model files first.
    sb.upload_bytes(f"{prefix}/features.parquet", feat_path.read_bytes(), content_type="application/octet-stream")
    sb.upload_bytes(f"{prefix}/models/{model_id}/{v}/model.npz", (model_dir / "model.npz").read_bytes(), content_type="application/octet-stream")
    sb.upload_bytes(f"{prefix}/models/{model_id}/{v}/meta.json", (model_dir / "meta.json").read_bytes(), content_type="application/json")
    sb.upload_bytes(f"{prefix}/models/{model_id}/LATEST", (root / "models" / model_id / "LATEST").read_bytes(), content_type="text/plain")

    # Upload per-symbol OHLCV snapshots (used by Streamlit Cloud to avoid yfinance at runtime).
    for sym in universe:
        p = _ohlcv_path(sym)
        if p.exists():
            sb.upload_bytes(f"{prefix}/ohlcv/{p.name}", p.read_bytes(), content_type="application/octet-stream")

    # Publish latest.json last (\"last good snapshot\" rule).
    sb.upload_bytes(f"{prefix}/latest.json", json.dumps(latest, indent=2).encode("utf-8"), content_type="application/json")

    print(f"Uploaded -> {sb.public_url(f'{prefix}/latest.json')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
