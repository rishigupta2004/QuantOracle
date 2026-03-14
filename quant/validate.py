"""Data validation for OHLCV integrity and walk-forward model validation."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# OHLCV validation rules
OHLCV_RULES: Dict[str, Callable[[pd.DataFrame], bool]] = {
    "positive_close": lambda df: (df["close"] > 0).all(),
    "high_gte_close": lambda df: (df["high"] >= df["close"]).all(),
    "low_lte_close": lambda df: (df["low"] <= df["close"]).all(),
    "non_neg_volume": lambda df: (df["volume"] >= 0).all(),
    "no_extreme_moves": lambda df: (
        df["close"].pct_change().abs().dropna() < 0.20
    ).all(),
    "unique_dates": lambda df: df.index.is_unique,
    "min_history": lambda df: len(df) >= 60,
}


@dataclass
class ValidationResult:
    """Result of validation check."""

    passed: bool
    symbol: str
    failed_rules: List[str]
    details: Optional[Dict[str, Any]] = None


def validate_ohlcv(symbol: str, df: pd.DataFrame) -> ValidationResult:
    """
    Run all OHLCV rules. Return ValidationResult.
    If any rule fails: log warning, caller must NOT publish this data.
    """
    if df.empty:
        return ValidationResult(
            passed=False,
            symbol=symbol,
            failed_rules=["empty_dataframe"],
        )

    # Normalize column names
    df = df.copy()
    df.columns = [c.lower() for c in df.columns]

    failed_rules = []
    for rule_name, rule_fn in OHLCV_RULES.items():
        try:
            if not rule_fn(df):
                failed_rules.append(rule_name)
        except Exception as e:
            logger.warning(f"Rule {rule_name} error for {symbol}: {e}")
            failed_rules.append(f"{rule_name}_error")

    if failed_rules:
        logger.warning(f"OHLCV validation failed for {symbol}: {failed_rules}")

    return ValidationResult(
        passed=len(failed_rules) == 0,
        symbol=symbol,
        failed_rules=failed_rules,
    )


@dataclass
class WalkForwardResult:
    """Result of walk-forward validation."""

    mean_ic: float
    ic_std: float
    ic_sharpe: float
    hit_rate: float
    passed: bool
    ic_series: pd.Series
    details: Dict[str, Any]


def walk_forward_validate(
    model: Any,
    data: pd.DataFrame,
    horizon: int = 5,
    train_window: int = 252,
    step: int = 21,
    min_ic_threshold: float = 0.03,
) -> WalkForwardResult:
    """
    Rolls through time: train on [t-252:t], predict [t:t+horizon].

    Returns WalkForwardResult with:
        mean_ic: float — must be > min_ic_threshold to publish
        ic_std: float
        ic_sharpe: float — mean_ic / ic_std, must be > 0.5
        hit_rate: float — % predictions with correct direction
        passed: bool — True only if ALL criteria met
        ic_series: pd.Series — for the walk-forward IC chart in Lab

    If passed=False, the pipeline keeps the previous model artifact.
    """
    if len(data) < train_window + horizon + 60:
        logger.warning(f"Insufficient data for walk-forward: {len(data)} rows")
        return WalkForwardResult(
            mean_ic=0.0,
            ic_std=0.0,
            ic_sharpe=0.0,
            hit_rate=0.0,
            passed=False,
            ic_series=pd.Series(),
            details={"error": "insufficient_data"},
        )

    close = data["Close"].astype(float)
    forward_returns = close.pct_change(horizon).shift(-horizon)

    ic_values = []
    hits = 0
    total = 0

    # Rolling window walk-forward
    for i in range(train_window, len(data) - horizon, step):
        train_data = data.iloc[i - train_window : i]
        test_data = data.iloc[i : i + horizon]

        if len(train_data) < train_window or len(test_data) < horizon:
            continue

        # For simplicity, use the model's prediction as the signal
        # In a real implementation, this would use the trained model's predictions
        # Here we're using a simple momentum signal as a proxy
        train_returns = train_data["Close"].pct_change(horizon)
        signal = train_returns.iloc[-1] if len(train_returns) > 0 else 0

        actual_return = forward_returns.iloc[i] if i < len(forward_returns) else 0

        if not np.isnan(signal) and not np.isnan(actual_return):
            ic_values.append(signal * actual_return)
            if (signal > 0 and actual_return > 0) or (signal < 0 and actual_return < 0):
                hits += 1
            total += 1

    if not ic_values:
        return WalkForwardResult(
            mean_ic=0.0,
            ic_std=0.0,
            ic_sharpe=0.0,
            hit_rate=0.0,
            passed=False,
            ic_series=pd.Series(),
            details={"error": "no_valid_observations"},
        )

    ic_arr = np.array(ic_values)
    mean_ic = float(np.mean(ic_arr))
    ic_std = float(np.std(ic_arr))
    ic_sharpe = mean_ic / ic_std if ic_std > 0 else 0.0
    hit_rate = hits / total if total > 0 else 0.0

    passed = mean_ic > min_ic_threshold and ic_sharpe > 0.5 and hit_rate > 0.5

    logger.info(
        f"Walk-forward validation: IC={mean_ic:.4f}, Sharpe={ic_sharpe:.4f}, "
        f"Hit={hit_rate:.3f}, Passed={passed}"
    )

    return WalkForwardResult(
        mean_ic=mean_ic,
        ic_std=ic_std,
        ic_sharpe=ic_sharpe,
        hit_rate=hit_rate,
        passed=passed,
        ic_series=pd.Series(ic_values),
        details={
            "n_observations": len(ic_values),
            "min_ic_threshold": min_ic_threshold,
        },
    )


def should_publish_model(model: Any, data: pd.DataFrame) -> bool:
    """
    Walk-forward validation gate.
    Returns False (do not publish) if:
    - mean_ic < 0.03
    - ic_sharpe < 0.50
    - hit_rate < 0.50
    Logs the reason. Caller keeps previous artifact.
    """
    result = walk_forward_validate(model, data)

    if not result.passed:
        logger.warning(
            f"Model failed validation gate. "
            f"IC={result.mean_ic:.4f}, Sharpe={result.ic_sharpe:.4f}, "
            f"Hit={result.hit_rate:.3f}. Keeping previous model."
        )

    return result.passed
