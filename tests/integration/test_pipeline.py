import pytest
import pandas as pd
import numpy as np
from quant.validate import validate_ohlcv, ValidationResult

pytestmark = pytest.mark.integration


def test_validate_ohlcv_passes_for_valid_data():
    """Valid OHLCV data should pass all validation rules."""
    dates = pd.date_range("2024-01-01", periods=300, freq="B")
    valid_df = pd.DataFrame(
        {
            "open": np.random.uniform(100, 200, 300),
            "high": np.random.uniform(150, 250, 300),
            "low": np.random.uniform(80, 150, 300),
            "close": np.random.uniform(100, 200, 300),
            "volume": np.random.randint(1000, 100000, 300),
        },
        index=dates,
    )
    valid_df["high"] = valid_df[["high", "close"]].max(axis=1)
    valid_df["low"] = valid_df[["low", "close"]].min(axis=1)

    result = validate_ohlcv("TEST", valid_df)

    assert result.passed is True
    assert len(result.failed_rules) == 0


def test_validate_ohlcv_fails_for_empty_dataframe():
    """Empty DataFrame must fail validation."""
    empty_df = pd.DataFrame()

    result = validate_ohlcv("TEST", empty_df)

    assert result.passed is False
    assert "empty_dataframe" in result.failed_rules


def test_validate_ohlcv_fails_for_negative_close():
    """Negative close price must fail validation."""
    dates = pd.date_range("2024-01-01", periods=100, freq="B")
    df = pd.DataFrame(
        {
            "open": np.random.uniform(100, 200, 100),
            "high": np.random.uniform(150, 250, 100),
            "low": np.random.uniform(80, 150, 100),
            "close": np.random.uniform(100, 200, 100),
            "volume": np.random.randint(1000, 100000, 100),
        },
        index=dates,
    )
    df.iloc[0, df.columns.get_loc("close")] = -1
    df["high"] = df[["high", "close"]].max(axis=1)
    df["low"] = df[["low", "close"]].min(axis=1)

    result = validate_ohlcv("TEST", df)

    assert result.passed is False
    assert "positive_close" in result.failed_rules


def test_validate_ohlcv_fails_for_high_below_close():
    """High price below close must fail validation."""
    dates = pd.date_range("2024-01-01", periods=100, freq="B")
    df = pd.DataFrame(
        {
            "open": np.random.uniform(100, 200, 100),
            "high": np.random.uniform(150, 250, 100),
            "low": np.random.uniform(80, 150, 100),
            "close": np.random.uniform(100, 200, 100),
            "volume": np.random.randint(1000, 100000, 100),
        },
        index=dates,
    )
    df.iloc[0, df.columns.get_loc("high")] = (
        df.iloc[0, df.columns.get_loc("close")] - 10
    )
    df["low"] = df[["low", "close"]].min(axis=1)

    result = validate_ohlcv("TEST", df)

    assert result.passed is False
    assert "high_gte_close" in result.failed_rules


def test_validate_ohlcv_fails_for_extreme_moves():
    """Extreme price moves (>20%) must fail validation."""
    dates = pd.date_range("2024-01-01", periods=100, freq="B")
    df = pd.DataFrame(
        {
            "open": np.random.uniform(100, 200, 100),
            "high": np.random.uniform(150, 250, 100),
            "low": np.random.uniform(80, 150, 100),
            "close": np.random.uniform(100, 200, 100),
            "volume": np.random.randint(1000, 100000, 100),
        },
        index=dates,
    )
    df.iloc[50, df.columns.get_loc("close")] = (
        df.iloc[49, df.columns.get_loc("close")] * 1.5
    )
    df["high"] = df[["high", "close"]].max(axis=1)
    df["low"] = df[["low", "close"]].min(axis=1)

    result = validate_ohlcv("TEST", df)

    assert result.passed is False
    assert "no_extreme_moves" in result.failed_rules
