"""Data validation for OHLCV integrity."""

from __future__ import annotations

import pandas as pd


VALIDATION_RULES = [
    ("price_positive", lambda df: (df["close"] > 0).all()),
    ("high_low_valid", lambda df: (df["high"] >= df["low"]).all()),
    (
        "ohlc_valid",
        lambda df: (df["high"] >= df["open"]).all()
        and (df["high"] >= df["close"]).all(),
    ),
    ("volume_valid", lambda df: (df["volume"] >= 0).all()),
    ("no_extreme_moves", lambda df: (df["close"].pct_change().abs() < 0.20).all()),
    ("no_duplicate_dates", lambda df: df.index.is_unique),
    ("sufficient_history", lambda df: len(df) >= 252),
]


def validate_ohlcv(symbol: str, df: pd.DataFrame) -> dict:
    """Validate OHLCV DataFrame.

    Args:
        symbol: Symbol name for logging
        df: DataFrame with columns [open, high, low, close, volume]

    Returns:
        Dictionary with passed bool, failed_rules list, and symbol
    """
    if df.empty:
        return {"passed": False, "symbol": symbol, "failed_rules": ["empty_dataframe"]}

    df.columns = [c.lower() for c in df.columns]

    failed_rules = []
    for rule_name, rule_fn in VALIDATION_RULES:
        try:
            if not rule_fn(df):
                failed_rules.append(rule_name)
        except Exception:
            failed_rules.append(f"{rule_name}_error")

    return {
        "passed": len(failed_rules) == 0,
        "symbol": symbol,
        "failed_rules": failed_rules,
    }
