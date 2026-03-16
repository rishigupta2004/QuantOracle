#!/usr/bin/env python3
"""Build a feature table from local OHLCV store.

Writes: data/features.parquet
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

_ROOT = str(Path(__file__).resolve().parents[1])
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

# ruff: noqa: E402  # Import must be after sys.path modification
from quant.core import build_features, build_targets
from services.store import data_dir, read_ohlcv

try:
    import duckdb  # type: ignore
except Exception:  # pragma: no cover
    duckdb = None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--horizon", type=int, default=5)
    ap.add_argument(
        "--out", default="", help="Output parquet path (default: data/features.parquet)"
    )
    args = ap.parse_args()

    root = data_dir()
    ohlcv_dir = root / "ohlcv"
    if not ohlcv_dir.exists():
        raise SystemExit(f"Missing {ohlcv_dir} (run scripts/ingest_eod.py first)")

    rows = []
    for p in sorted(ohlcv_dir.glob("*.parquet")):
        sym = p.stem
        h = read_ohlcv(sym)
        if h.empty or "Close" not in h:
            continue
        feats = build_features(h)
        if feats.empty:
            continue
        y = build_targets(h["Close"], horizon=args.horizon).reindex(feats.index)
        feats = feats.assign(symbol=sym, target=y)
        rows.append(feats.reset_index().rename(columns={"index": "Date"}))

    if not rows:
        raise SystemExit("No features produced")

    out = pd.concat(rows, ignore_index=True).dropna()
    out["Date"] = pd.to_datetime(out["Date"])
    out_path = Path(args.out) if args.out else (root / "features.parquet")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if duckdb is None:
        raise SystemExit(
            "duckdb is required to write Parquet (install: `pip install duckdb`)."
        )
    con = duckdb.connect(database=":memory:")
    con.register("df", out)
    path = str(out_path).replace("'", "''")
    con.execute(f"COPY df TO '{path}' (FORMAT PARQUET)")
    con.close()
    print(f"Wrote {len(out):,} rows -> {out_path}")


if __name__ == "__main__":
    main()
