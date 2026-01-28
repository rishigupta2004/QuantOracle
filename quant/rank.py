"""Cross-sectional ranking from a feature snapshot + a model."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from quant.registry import data_root, latest_dir, load_meta

try:
    import duckdb  # type: ignore
except Exception:  # pragma: no cover
    duckdb = None


FEATURES = [
    "ret_1d",
    "ret_5d",
    "ret_20d",
    "vol_20d",
    "price_sma20",
    "price_sma50",
    "rsi_14",
]


def features_path() -> Path:
    return data_root() / "features.parquet"

def _require_duckdb():
    if duckdb is None:
        raise RuntimeError("duckdb is required for feature snapshot reads. Install: `pip install duckdb`.")


def latest_feature_date() -> pd.Timestamp | None:
    p = features_path()
    if not p.exists():
        return None
    _require_duckdb()
    con = duckdb.connect(database=":memory:")
    d = con.execute("SELECT MAX(Date) FROM read_parquet(?)", [str(p)]).fetchone()[0]
    con.close()
    return pd.to_datetime(d) if d else None


def load_feature_snapshot(date: pd.Timestamp | None = None) -> pd.DataFrame:
    p = features_path()
    if not p.exists():
        return pd.DataFrame()
    _require_duckdb()

    if date is None:
        date = latest_feature_date()
        if date is None:
            return pd.DataFrame()

    con = duckdb.connect(database=":memory:")
    df = con.execute("SELECT * FROM read_parquet(?) WHERE Date = ?", [str(p), date]).df()
    con.close()
    if df.empty:
        return df
    df["Date"] = pd.to_datetime(df["Date"])
    return df


def load_ridge_latest(horizon: int = 5):
    d = latest_dir(f"ridge_h{horizon}")
    if not d:
        return None, None
    meta = load_meta(d)
    z = np.load(d / "model.npz", allow_pickle=True)
    return meta, {"w": z["w"], "mu": z["mu"], "sig": z["sig"], "features": list(z["features"])}


def predict_ridge(snapshot: pd.DataFrame, model: dict) -> pd.DataFrame:
    if snapshot.empty:
        return pd.DataFrame()
    feats = model["features"]
    X = snapshot[feats].to_numpy(dtype=float)
    Xz = (X - model["mu"]) / model["sig"]
    yhat = Xz @ model["w"]
    out = snapshot[["symbol"]].copy()
    out["pred"] = yhat
    out["risk"] = snapshot["vol_20d"].astype(float).clip(lower=1e-6)
    return out


def top_bottom(preds: pd.DataFrame, n: int = 10) -> tuple[pd.DataFrame, pd.DataFrame]:
    if preds.empty:
        return pd.DataFrame(), pd.DataFrame()
    p = preds.sort_values("pred", ascending=False)
    return p.head(n), p.tail(n).sort_values("pred", ascending=True)
