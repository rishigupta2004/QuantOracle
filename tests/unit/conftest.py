import pandas as pd
import pytest


@pytest.fixture
def fake_ohlcv_df():
    # Minimal OHLCV frame used by yfinance stubs.
    # Use enough rows to satisfy indicator lookbacks (>= 200 for SMA200).
    idx = pd.date_range("2024-01-01", periods=260, freq="D")
    base = 100.0
    close = [base + i * 0.1 for i in range(len(idx))]
    return pd.DataFrame(
        {
            "Open": close,
            "High": [v + 1 for v in close],
            "Low": [v - 1 for v in close],
            "Close": close,
            "Volume": [1000 + i for i in range(len(idx))],
        },
        index=idx,
    )


@pytest.fixture
def stub_yfinance(monkeypatch, fake_ohlcv_df):
    """
    Deterministic yfinance stub:
    - `.history()` returns fixed OHLCV
    - `.info` contains prices and deltas
    """

    class _FakeTicker:
        def __init__(self, symbol: str):
            self.symbol = symbol
            self.info = {
                "previousClose": float(fake_ohlcv_df["Close"].iloc[-2]),
                "regularMarketPrice": float(fake_ohlcv_df["Close"].iloc[-1]),
                "regularMarketChange": float(
                    fake_ohlcv_df["Close"].iloc[-1] - fake_ohlcv_df["Close"].iloc[-2]
                ),
                "regularMarketChangePercent": float(
                    (fake_ohlcv_df["Close"].iloc[-1] - fake_ohlcv_df["Close"].iloc[-2])
                    / fake_ohlcv_df["Close"].iloc[-2]
                ),
            }

        def history(self, period="1mo", timeout=10):
            return fake_ohlcv_df.copy()

    import services.market_data as md

    monkeypatch.setattr(md.yf, "Ticker", _FakeTicker, raising=True)
    return _FakeTicker


@pytest.fixture
def stub_requests(monkeypatch):
    """Stub requests.get/post for modules that do network calls."""

    class _Resp:
        def __init__(self, status_code=200, payload=None, text=""):
            self.status_code = status_code
            self._payload = payload if payload is not None else {}
            self.text = text
            self.content = b""

        def json(self):
            return self._payload

    def _fake_get(url, params=None, headers=None, timeout=None):
        return _Resp(status_code=404, payload={}, text="stubbed")

    def _fake_post(url, json=None, timeout=None):
        return _Resp(status_code=404, payload={}, text="stubbed")

    import services.market_data as md
    import utils.news_service as ns

    monkeypatch.setattr(md.requests, "get", _fake_get, raising=True)
    monkeypatch.setattr(ns.requests, "get", _fake_get, raising=True)
    # utils.api is session-state only; no network stubs needed there.

    return {"get": _fake_get, "post": _fake_post, "Resp": _Resp}
