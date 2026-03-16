"""Quantitative models: Ridge regression, GBDT, and Factor Score Model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np
import pandas as pd


FACTORS = {
    "momentum_12_1": {
        "description": "12-minus-1 month return (avoids short-term reversal)",
        "compute": lambda data: data["close"].pct_change(252)
        - data["close"].pct_change(21),
        "direction": 1,
    },
    "low_volatility": {
        "description": "Inverse 252-day realized volatility",
        "compute": lambda data: -data["close"].pct_change().rolling(252).std(),
        "direction": 1,
    },
    "quality": {
        "description": "ROE minus Debt-to-Equity (requires fundamentals)",
        "compute": None,
        "direction": 1,
    },
    "size": {
        "description": "Log market cap (requires fundamentals)",
        "compute": None,
        "direction": -1,
    },
}


def compute_factor_scores(
    universe_data: Dict[str, pd.DataFrame],
    factors: List[str],
    weights: Optional[Dict[str, float]] = None,
) -> pd.DataFrame:
    """
    Computes cross-sectional factor scores for all symbols.

    Process:
    1. Compute raw factor value for each symbol
    2. Cross-sectionally z-score (subtract mean, divide by std across symbols)
    3. Multiply by direction (+1 or -1)
    4. Weighted combination
    5. Rank into deciles (1=worst, 10=best)

    Returns: DataFrame with columns [symbol, factor_scores..., composite, decile]
    """
    if not factors:
        return pd.DataFrame()

    # Step 1: Compute raw factor values for each symbol
    factor_values: Dict[str, Dict[str, float]] = {}

    for symbol, data in universe_data.items():
        if data.empty or len(data) < 60:
            continue

        factor_values[symbol] = {}

        for factor_name in factors:
            if factor_name not in FACTORS:
                continue

            factor_info = FACTORS[factor_name]
            compute_fn = factor_info["compute"]

            if compute_fn is None:
                # Requires fundamentals - skip for now
                factor_values[symbol][factor_name] = 0.0
                continue

            try:
                raw_value = compute_fn(data)
                if isinstance(raw_value, pd.Series):
                    raw_value = raw_value.iloc[-1]
                if pd.isna(raw_value) or np.isinf(raw_value):
                    factor_values[symbol][factor_name] = 0.0
                else:
                    factor_values[symbol][factor_name] = float(raw_value)
            except Exception:
                factor_values[symbol][factor_name] = 0.0

    if not factor_values:
        return pd.DataFrame()

    # Build DataFrame
    df = pd.DataFrame.from_dict(factor_values, orient="index")
    df.index.name = "symbol"

    # Step 2: Cross-sectional z-score
    for col in df.columns:
        mean = df[col].mean()
        std = df[col].std()
        if std > 0:
            df[f"{col}_zscore"] = (df[col] - mean) / std
        else:
            df[f"{col}_zscore"] = 0.0

    # Step 3: Apply direction
    for factor_name in factors:
        direction = FACTORS.get(factor_name, {}).get("direction", 1)
        zscore_col = f"{factor_name}_zscore"
        if zscore_col in df.columns:
            df[zscore_col] *= direction

    # Step 4: Weighted combination
    if weights is None:
        weights = {f: 1.0 / len(factors) for f in factors}

    df["composite"] = 0.0
    for factor_name in factors:
        zscore_col = f"{factor_name}_zscore"
        weight = weights.get(factor_name, 1.0 / len(factors))
        if zscore_col in df.columns:
            df["composite"] += df[zscore_col] * weight

    # Step 5: Rank into deciles
    df["decile"] = pd.qcut(
        df["composite"], q=10, labels=range(1, 11), duplicates="drop"
    )

    return df.reset_index()


@dataclass
class FactorModelConfig:
    """Configuration for factor model."""

    factors: List[str]
    weights: Optional[Dict[str, float]] = None
    rebalance_frequency: str = "monthly"
    long_only: bool = True
    min_positions: int = 5
    max_positions: int = 20


class FactorModel:
    """Factor score model for cross-sectional ranking."""

    def __init__(self, config: FactorModelConfig):
        self.config = config
        self.history: List[pd.DataFrame] = []

    def fit(self, universe_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Fit model and return rankings."""
        scores = compute_factor_scores(
            universe_data,
            self.config.factors,
            self.config.weights,
        )
        self.history.append(scores)
        return scores

    def predict(self, universe_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Get predictions for current data."""
        return self.fit(universe_data)
