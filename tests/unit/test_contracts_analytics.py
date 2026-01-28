import pandas as pd
import pytest

pytestmark = pytest.mark.unit


def test_portfolio_metrics_contract():
    from utils.analytics import portfolio_metrics

    holdings = [{"symbol": "AAA", "quantity": 1, "avg_cost": 100}]
    history = {"AAA": pd.DataFrame({"Close": [100, 101, 102]})}
    out = portfolio_metrics(holdings, history)
    assert "dates" in out and "values" in out and "metrics" in out
    assert {"return", "volatility", "sharpe"} <= set(out["metrics"].keys())


def test_var_contract():
    from utils.analytics import var

    holdings = [{"symbol": "AAA", "quantity": 1, "avg_cost": 100}]
    history = {"AAA": pd.DataFrame({"Close": [100, 101, 102, 103]})}
    out = var(holdings, history)
    assert "var_95" in out and "var_99" in out
    assert out["var_95"] >= 0 and out["var_99"] >= 0


def test_max_drawdown_contract_nonzero_for_drawdown_series():
    from utils.analytics import max_drawdown

    history = {"AAA": pd.DataFrame({"Close": [100, 90, 80, 120]})}
    dd = max_drawdown(history)
    assert 0 < dd <= 100


def test_beta_contract_offline(monkeypatch):
    from utils.analytics import beta

    # Avoid network fetch inside beta(): patch market_data.get_historical.
    import services.market_data as md

    mkt = pd.DataFrame({"Close": [1000, 1010, 1005, 1020, 1030]})
    monkeypatch.setattr(md, "get_historical", lambda sym, period="1y": mkt, raising=True)

    holdings = [{"symbol": "AAA", "quantity": 1, "avg_cost": 100}]
    history = {"AAA": pd.DataFrame({"Close": [100, 101, 99, 102, 103]})}
    out = beta(holdings, history)
    assert "beta" in out and "corr" in out
    assert -1 <= out["corr"] <= 1
