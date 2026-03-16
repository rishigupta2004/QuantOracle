import pytest
import pandas as pd
import numpy as np
from quant.signals import (
    calculate_signals,
    InsufficientDataError,
    _ema,
    _atr,
    _adx,
    _obv,
    _vwap,
    _trend_signal,
    _momentum_signal,
    _reversion_signal,
    _volume_signal,
    _calculate_ic,
    _compute_ic_weights,
    _build_verdict,
    Verdict,
    CategorySignal,
)

pytestmark = pytest.mark.unit


def make_ohlcv(n: int = 100, seed: int = 42) -> pd.DataFrame:
    """Create synthetic OHLCV data for testing."""
    np.random.seed(seed)
    dates = pd.date_range(end="2024-01-01", periods=n, freq="D")
    close = 100 + np.cumsum(np.random.randn(n) * 2)
    data = pd.DataFrame(
        {
            "Open": close - np.random.rand(n) * 2,
            "High": close + np.random.rand(n) * 5,
            "Low": close - np.random.rand(n) * 5,
            "Close": close,
            "Volume": np.random.randint(1_000_000, 10_000_000, n),
        },
        index=dates,
    )
    return data


class TestIndicators:
    """Test helper indicator functions."""

    def test_ema_basic(self):
        s = pd.Series([1, 2, 3, 4, 5])
        result = _ema(s, 3)
        assert len(result) == len(s)
        assert not result.isna().all()

    def test_ema_smoothing(self):
        s = pd.Series([10.0] * 20)
        result = _ema(s, 5)
        assert result.iloc[-1] == 10.0

    def test_atr_positive(self):
        data = make_ohlcv(50)
        atr = _atr(data, 14).dropna()
        assert (atr > 0).all()
        assert len(atr) > 0

    def test_adx_range(self):
        data = make_ohlcv(100)
        adx = _adx(data, 14).dropna()
        assert (adx >= 0).all()
        assert (adx <= 100).all()

    def test_obv_cumulative(self):
        data = make_ohlcv(50)
        obv = _obv(data)
        assert len(obv) == len(data)
        assert obv.iloc[-1] == obv.iloc[-1]

    def test_vwap_reasonable(self):
        data = make_ohlcv(50)
        vwap = _vwap(data)
        assert (vwap > 0).all()
        assert len(vwap) == len(data)


class TestSignalCategories:
    """Test individual signal category functions."""

    def test_trend_no_trend_low_adx(self):
        data = make_ohlcv(100)
        signal = _trend_signal(data)
        assert signal.name == "TREND"
        assert signal.label in ("NO_TREND", "TRENDING_UP", "TRENDING_DOWN")

    def test_momentum_returns_valid(self):
        data = make_ohlcv(100)
        signal = _momentum_signal(data)
        assert signal.name == "MOMENTUM"
        assert -1.0 <= signal.value <= 1.0
        assert signal.label in (
            "MOMENTUM_BULL",
            "MOMENTUM_FADING_BULL",
            "MOMENTUM_BEAR",
            "MOMENTUM_FADING_BEAR",
            "FLAT",
        )

    def test_reversion_suppressed_with_trend(self):
        data = make_ohlcv(100)
        trend = _trend_signal(data)
        reversion = _reversion_signal(data, trend)
        assert reversion.name == "REVERSION"

    def test_reversion_active_with_no_trend(self):
        data = make_ohlcv(100)
        no_trend_signal = CategorySignal(
            name="TREND",
            value=0.0,
            ic=0.0,
            weight=0.0,
            label="NO_TREND",
            detail="ADX=15",
        )
        reversion = _reversion_signal(data, no_trend_signal)
        assert reversion.name == "REVERSION"
        assert reversion.label in ("OVERSOLD", "OVERBOUGHT", "NEUTRAL")

    def test_volume_returns_valid(self):
        data = make_ohlcv(100)
        signal = _volume_signal(data)
        assert signal.name == "VOLUME"
        assert -1.0 <= signal.value <= 1.0


class TestICCalculation:
    """Test Information Coefficient calculations."""

    def test_ic_with_sufficient_data(self):
        np.random.seed(42)
        signal = pd.Series(np.random.randn(100))
        forward_ret = pd.Series(np.random.randn(100))
        ic = _calculate_ic(signal, forward_ret)
        assert isinstance(ic, float)
        assert -1.0 <= ic <= 1.0

    def test_ic_insufficient_data(self):
        signal = pd.Series([1, 2, 3])
        forward_ret = pd.Series([0.1, 0.2, 0.3])
        ic = _calculate_ic(signal, forward_ret)
        assert ic == 0.0

    def test_compute_ic_weights_insufficient(self):
        data = make_ohlcv(50)
        weights = _compute_ic_weights(data)
        assert weights["has_ic_history"] is False
        assert abs(weights["TREND"] - 0.333) < 0.01

    def test_compute_ic_weights_sufficient(self):
        data = make_ohlcv(300)
        weights = _compute_ic_weights(data)
        assert "has_ic_history" in weights
        assert "ic_trend" in weights
        assert "ic_momentum" in weights
        assert "ic_reversion" in weights


class TestVerdict:
    """Test verdict generation."""

    def test_strong_buy_threshold(self):
        v = _build_verdict(0.6, 0.5)
        assert v == Verdict.STRONG_BUY

    def test_buy_threshold(self):
        v = _build_verdict(0.3, 0.3)
        assert v == Verdict.BUY

    def test_hold_threshold(self):
        v = _build_verdict(0.0, 0.2)
        assert v == Verdict.HOLD

    def test_sell_threshold(self):
        v = _build_verdict(-0.3, 0.3)
        assert v == Verdict.SELL

    def test_strong_sell_threshold(self):
        v = _build_verdict(-0.6, 0.3)
        assert v == Verdict.STRONG_SELL


class TestCalculateSignals:
    """Test main calculate_signals function."""

    def test_insufficient_data_raises(self):
        data = make_ohlcv(30)
        with pytest.raises(InsufficientDataError):
            calculate_signals("TEST.NS", data)

    def test_sufficient_data_works(self):
        data = make_ohlcv(100)
        result = calculate_signals("TEST.NS", data)
        assert result.symbol == "TEST.NS"
        assert result.verdict in list(Verdict)
        assert result.timeframe == "1D"

    def test_lowercase_columns_work(self):
        data = make_ohlcv(100)
        data.columns = [c.lower() for c in data.columns]
        result = calculate_signals("TEST.NS", data)
        assert result.verdict in list(Verdict)

    def test_all_categories_present(self):
        data = make_ohlcv(100)
        result = calculate_signals("TEST.NS", data)
        assert result.trend.name == "TREND"
        assert result.momentum.name == "MOMENTUM"
        assert result.reversion.name == "REVERSION"
        assert result.volume.name == "VOLUME"

    def test_composite_in_valid_range(self):
        data = make_ohlcv(100)
        result = calculate_signals("TEST.NS", data)
        assert -1.0 <= result.composite_score <= 1.0
        assert 0.0 <= result.confidence <= 1.0

    def test_explanation_generated(self):
        data = make_ohlcv(100)
        result = calculate_signals("TEST.NS", data)
        assert len(result.explanation) > 0
        assert "TEST" in result.explanation
