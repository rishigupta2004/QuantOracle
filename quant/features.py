"""Feature engineering (EOD) - minimal but useful."""

from __future__ import annotations

import pandas as pd


def build_features(h: pd.DataFrame) -> pd.DataFrame:
    """Return per-date features. Expects OHLCV with Date index and Close column."""
    if h is None or h.empty or "Close" not in h:
        return pd.DataFrame()

    close = h["Close"].astype(float)
    ret1 = close.pct_change(1)
    ret5 = close.pct_change(5)
    ret20 = close.pct_change(20)
    vol20 = close.pct_change().rolling(20).std()

    sma20 = close.rolling(20).mean()
    sma50 = close.rolling(50).mean()
    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi14 = 100 - (100 / (1 + rs))

    out = pd.DataFrame(
        {
            "ret_1d": ret1,
            "ret_5d": ret5,
            "ret_20d": ret20,
            "vol_20d": vol20,
            "price_sma20": close / sma20 - 1,
            "price_sma50": close / sma50 - 1,
            "rsi_14": rsi14,
        },
        index=h.index,
    )
    return out.dropna()


def build_targets(close: pd.Series, horizon: int = 5) -> pd.Series:
    """Forward return over horizon."""
    close = close.astype(float)
    return close.shift(-horizon) / close - 1.0
