
import pandas as pd
import pytest

pytestmark = pytest.mark.unit


def test_store_write_read_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("QUANTORACLE_DATA_DIR", str(tmp_path))

    from services.store import read_ohlcv_period, write_ohlcv

    idx = pd.date_range("2024-01-01", periods=10, freq="D")
    h = pd.DataFrame(
        {
            "Open": range(10),
            "High": range(10),
            "Low": range(10),
            "Close": range(10),
            "Volume": range(10),
        },
        index=idx,
    )

    out = write_ohlcv("RELIANCE.NS", h)
    assert out and out.exists()

    r = read_ohlcv_period("RELIANCE.NS", "1mo")
    assert not r.empty
    assert "Close" in r.columns
    assert r.index.is_monotonic_increasing

