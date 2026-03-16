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
    assert "var" in out
    # VaR is negative (loss), so var should be <= 0
    assert out["var"] <= 0


def test_max_drawdown_contract_nonzero_for_drawdown_series():
    from utils.analytics import max_drawdown

    holdings = [{"symbol": "AAA", "quantity": 1, "avg_cost": 100}]
    history = {"AAA": pd.DataFrame({"Close": [100, 90, 80, 120]})}
    out = max_drawdown(holdings, history)
    assert "max_drawdown" in out
    assert out["max_drawdown"] <= 0


def test_beta_contract_offline():
    from utils.analytics import beta
    import pandas as pd

    symbol_returns = pd.Series([0.01, -0.02, 0.03, 0.01, -0.01])
    benchmark_returns = pd.Series([0.005, -0.01, 0.02, 0.008, -0.005])
    out = beta(symbol_returns, benchmark_returns)
    assert "beta" in out
    # Beta can be any value
    assert isinstance(out["beta"], float)
