import pytest

pytestmark = pytest.mark.unit


def test_get_quote_contract_offline(stub_yfinance, stub_requests):
    from services.market_data import get_quote

    q = get_quote("RELIANCE.NS")
    assert isinstance(q, dict)
    assert q.get("symbol") == "RELIANCE.NS"
    # Core normalized fields (should exist via Yahoo path).
    for k in ("price", "change", "change_pct"):
        assert k in q
        assert isinstance(q[k], (int, float))


def test_get_quote_contract_normalized_even_if_indianapi_hits(monkeypatch, stub_yfinance):
    """
    Simulate IndianAPI returning a valid price and require that get_quote still returns
    the full normalized schema (open/high/low/volume as well).
    """
    import services.market_data as md

    md.INDIANAPI_API_KEY = "fake"

    class _Resp:
        status_code = 200

        def json(self):
            return {"currentPrice": {"NSE": 123.45}, "percentChange": 1.23}

    monkeypatch.setattr(md.requests, "get", lambda *a, **k: _Resp(), raising=True)

    q = md.get_quote("RELIANCE.NS")
    assert q["symbol"] == "RELIANCE.NS"
    for k in ("price", "change", "change_pct", "open", "high", "low", "volume"):
        assert k in q


def test_get_historical_contract_offline(stub_yfinance, stub_requests):
    from services.market_data import get_historical

    h = get_historical("RELIANCE.NS", "1mo")
    assert hasattr(h, "empty")
    assert not h.empty
    for col in ("Open", "High", "Low", "Close", "Volume"):
        assert col in h.columns


def test_get_indicators_contract_offline(stub_yfinance, stub_requests):
    from services.market_data import get_indicators

    ind = get_indicators("RELIANCE.NS")
    assert isinstance(ind, dict)
    # May be empty if not enough data; our stub has enough.
    assert ind
    for k in (
        "price",
        "change_pct",
        "sma_20",
        "sma_50",
        "rsi",
        "macd",
        "macd_signal",
        "stoch_k",
        "stoch_d",
        "atr",
        "bb_upper",
        "bb_lower",
        "bb_position",
    ):
        assert k in ind
