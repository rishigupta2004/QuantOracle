import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

pytestmark = pytest.mark.unit


def _fake_download(symbols, period="5y", group_by="ticker", auto_adjust=True, threads=True, progress=True):
    idx = pd.date_range("2024-01-01", periods=260, freq="D")
    base = np.linspace(100, 130, len(idx))
    ohlcv = pd.DataFrame(
        {
            "Open": base,
            "High": base + 1,
            "Low": base - 1,
            "Close": base,
            "Volume": np.arange(len(idx)) + 1000,
        },
        index=idx,
    )

    if isinstance(symbols, str):
        symbols = [symbols]
    if len(symbols) == 1:
        return ohlcv

    # MultiIndex columns for multiple tickers.
    cols = pd.MultiIndex.from_product([symbols, ohlcv.columns])
    out = pd.DataFrame(index=ohlcv.index, columns=cols, dtype=float)
    for s in symbols:
        out[s] = ohlcv.values
    return out


def test_ingest_build_train_end_to_end(tmp_path, monkeypatch):
    monkeypatch.setenv("QUANTORACLE_DATA_DIR", str(tmp_path))
    monkeypatch.chdir(Path(__file__).resolve().parents[2])

    import yfinance as yf

    monkeypatch.setattr(yf, "download", _fake_download, raising=True)

    # Ingest
    import scripts.ingest_eod as ingest

    argv = sys.argv
    try:
        sys.argv = ["ingest_eod.py", "--symbols", "RELIANCE.NS,TCS.NS", "--period", "5y"]
        ingest.main()
    finally:
        sys.argv = argv

    ohlcv_dir = tmp_path / "ohlcv"
    assert (ohlcv_dir / "RELIANCE.NS.parquet").exists()
    assert (ohlcv_dir / "TCS.NS.parquet").exists()

    # Build features
    import scripts.build_features as bf

    argv = sys.argv
    try:
        sys.argv = ["build_features.py", "--horizon", "5"]
        bf.main()
    finally:
        sys.argv = argv

    feat_path = tmp_path / "features.parquet"
    assert feat_path.exists()
    df = pd.read_parquet(feat_path)
    assert {"Date", "symbol", "target"} <= set(df.columns)
    assert len(df) > 0

    # Train ridge
    import scripts.train_ridge as tr

    argv = sys.argv
    try:
        sys.argv = ["train_ridge.py", "--data", str(feat_path), "--alpha", "10", "--horizon", "5"]
        tr.main()
    finally:
        sys.argv = argv

    model_root = tmp_path / "models" / "ridge_h5"
    latest = (model_root / "LATEST").read_text(encoding="utf-8").strip()
    assert latest
    ver = model_root / latest
    assert (ver / "model.npz").exists()
    assert (ver / "meta.json").exists()
