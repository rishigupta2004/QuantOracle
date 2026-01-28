import pytest

from quant.portfolio import Constraints, build_long_short

pytestmark = pytest.mark.unit


def test_portfolio_basic_constraints():
    preds = {f"S{i}": float(i) for i in range(20)}  # S19 best
    risks = {f"S{i}": 0.2 + i * 0.01 for i in range(20)}

    c = Constraints(long_n=5, short_n=5, gross=1.0, net=0.0, max_abs_weight=0.2)
    w = build_long_short(preds, risks, c)

    assert w
    gross = sum(abs(x) for x in w.values())
    assert abs(gross - 1.0) < 1e-6
    assert all(abs(x) <= 0.2 + 1e-9 for x in w.values())

