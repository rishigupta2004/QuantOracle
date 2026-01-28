#!/usr/bin/env python3
"""Train a GBDT regressor (sklearn) on the feature table (training-only)."""

from __future__ import annotations

import argparse

import numpy as np
import pandas as pd

from quant.registry import model_version_dir, save_meta, version_id, write_latest


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
    ap.add_argument("--horizon", type=int, default=5)
    ap.add_argument("--max-leaf-nodes", type=int, default=31)
    ap.add_argument("--learning-rate", type=float, default=0.05)
    args = ap.parse_args()

    try:
        from sklearn.ensemble import HistGradientBoostingRegressor
        import joblib
    except Exception as e:  # pragma: no cover
        raise SystemExit(f"Install training deps: pip install -r requirements-ml.txt ({e})")

    df = pd.read_parquet(args.data)
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values("Date").dropna()

    dates = df["Date"].drop_duplicates().sort_values()
    cutoff = dates.iloc[int(len(dates) * 0.8)]
    train = df[df["Date"] <= cutoff]
    test = df[df["Date"] > cutoff]

    Xtr = train[FEATURES].to_numpy(dtype=float)
    ytr = train["target"].to_numpy(dtype=float)
    Xte = test[FEATURES].to_numpy(dtype=float)
    yte = test["target"].to_numpy(dtype=float)

    model = HistGradientBoostingRegressor(
        max_leaf_nodes=args.max_leaf_nodes,
        learning_rate=args.learning_rate,
        random_state=7,
    )
    model.fit(Xtr, ytr)

    yhat = model.predict(Xte)
    ic = float(np.corrcoef(yhat, yte)[0, 1]) if len(yte) > 10 else 0.0
    hit = float((np.sign(yhat) == np.sign(yte)).mean()) if len(yte) else 0.0

    model_id = f"gbdt_h{args.horizon}"
    v = version_id()
    out_dir = model_version_dir(model_id, v)
    out_dir.mkdir(parents=True, exist_ok=True)

    joblib.dump(model, out_dir / "model.joblib")
    meta = {
        "model": "gbdt",
        "horizon": args.horizon,
        "features": FEATURES,
        "cutoff": cutoff.strftime("%Y-%m-%d"),
        "rows_train": int(len(train)),
        "rows_test": int(len(test)),
        "ic": ic,
        "hit_rate": hit,
        "params": {"max_leaf_nodes": args.max_leaf_nodes, "learning_rate": args.learning_rate},
    }
    save_meta(out_dir, meta)
    write_latest(model_id, v)
    print(f"Wrote {model_id}@{v} IC={ic:.4f} hit={hit:.3f}")


if __name__ == "__main__":
    main()
