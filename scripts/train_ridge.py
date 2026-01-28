#!/usr/bin/env python3
"""Train a simple cross-sectional ridge model on the feature table."""

# ruff: noqa: E402  (sys.path bootstrap must run before local imports)

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

_ROOT = str(Path(__file__).resolve().parents[1])
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from quant.registry import model_version_dir, save_meta, version_id, write_latest
from quant.ridge import fit_ridge, predict, zscore_apply, zscore_fit

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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/features.parquet")
    ap.add_argument("--alpha", type=float, default=10.0)
    ap.add_argument("--horizon", type=int, default=5)
    ap.add_argument("--cutoff", default="", help="Train cutoff date (YYYY-MM-DD). If empty, uses 80% of dates.")
    args = ap.parse_args()

    if duckdb is None:
        raise SystemExit("duckdb is required to read Parquet (install: `pip install duckdb`).")
    con = duckdb.connect(database=":memory:")
    df = con.execute("SELECT * FROM read_parquet(?)", [str(args.data)]).df()
    con.close()
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date")

    if args.cutoff:
        cutoff = pd.to_datetime(args.cutoff)
    else:
        dates = df["Date"].drop_duplicates().sort_values()
        cutoff = dates.iloc[int(len(dates) * 0.8)]

    train = df[df["Date"] <= cutoff].dropna()
    test = df[df["Date"] > cutoff].dropna()

    Xtr = train[FEATURES].to_numpy()
    ytr = train["target"].to_numpy()
    mu, sig = zscore_fit(Xtr)
    Xtrz = zscore_apply(Xtr, mu, sig)
    w = fit_ridge(Xtrz, ytr, alpha=args.alpha)

    Xtez = zscore_apply(test[FEATURES].to_numpy(), mu, sig)
    yhat = predict(Xtez, w)
    y = test["target"].to_numpy()

    # Simple metrics: correlation (IC) and directional hit rate.
    ic = float(np.corrcoef(yhat, y)[0, 1]) if len(y) > 10 else 0.0
    hit = float((np.sign(yhat) == np.sign(y)).mean()) if len(y) else 0.0

    model_id = f"ridge_h{args.horizon}"
    v = version_id()
    out_dir = model_version_dir(model_id, v)
    out_dir.mkdir(parents=True, exist_ok=True)

    np.savez(out_dir / "model.npz", w=w, mu=mu, sig=sig, features=np.array(FEATURES, dtype=object))
    meta = {
        "model": "ridge",
        "horizon": args.horizon,
        "alpha": args.alpha,
        "features": FEATURES,
        "cutoff": cutoff.strftime("%Y-%m-%d"),
        "rows_train": int(len(train)),
        "rows_test": int(len(test)),
        "ic": ic,
        "hit_rate": hit,
    }
    save_meta(out_dir, meta)
    write_latest(model_id, v)

    print(f"Wrote {model_id}@{v} -> {out_dir}")
    print(f"IC={ic:.4f} hit_rate={hit:.3f} train={len(train):,} test={len(test):,}")


if __name__ == "__main__":
    main()
