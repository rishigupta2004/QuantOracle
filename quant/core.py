"""Technical indicators and feature engineering.

Pure functions: Input pd.Series/pd.DataFrame, Output pd.Series.
No side effects, no state.
"""

from __future__ import annotations

import pandas as pd


def build_features(h: pd.DataFrame) -> pd.DataFrame:
    """Build features from OHLCV data.

    Args:
        h: DataFrame with columns [Open, High, Low, Close, Volume], Date index

    Returns:
        DataFrame with features: ret_1d, ret_5d, ret_20d, vol_20d, price_sma20,
        price_sma50, rsi_14
    """
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
    """Forward return over horizon.

    Args:
        close: Price series
        horizon: Number of days forward

    Returns:
        Series of forward returns
    """
    close = close.astype(float)
    return close.shift(-horizon) / close - 1.0


def calculate_indicators(h: pd.DataFrame) -> dict:
    """Calculate technical indicators from OHLCV.

    Args:
        h: DataFrame with [Open, High, Low, Close, Volume]

    Returns:
        Dictionary with indicator values
    """
    if h is None or h.empty or len(h) < 20:
        return {}

    close = h["Close"].astype(float)
    high = h["High"].astype(float)
    low = h["Low"].astype(float)
    volume = (
        h["Volume"].astype(float) if "Volume" in h else pd.Series(0.0, index=h.index)
    )

    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist = macd_line - signal_line

    lowest_low = low.rolling(14).min()
    highest_high = high.rolling(14).max()
    stoch_k = 100 * (close - lowest_low) / (highest_high - lowest_low)
    stoch_d = stoch_k.rolling(3).mean()

    tr = pd.concat(
        [(high - low), (high - close.shift()).abs(), (low - close.shift()).abs()],
        axis=1,
    ).max(axis=1)
    atr = tr.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()

    sma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20
    sma50 = close.rolling(50).mean()
    sma200 = close.rolling(200).mean() if len(close) >= 200 else sma50

    vol_sma20 = volume.rolling(20).mean()
    vol_ratio = (
        float(volume.iloc[-1] / vol_sma20.iloc[-1]) if vol_sma20.iloc[-1] else 0.0
    )

    price = float(close.iloc[-1])
    prev = float(close.iloc[-2]) if len(close) >= 2 else price
    change_pct = float((price - prev) / prev * 100) if prev else 0.0

    return {
        "price": price,
        "change_pct": change_pct,
        "sma_20": float(sma20.iloc[-1]),
        "sma_50": float(sma50.iloc[-1]),
        "sma_200": float(sma200.iloc[-1]) if len(close) >= 200 else 0.0,
        "rsi": float(rsi.iloc[-1]),
        "macd": float(macd_line.iloc[-1]),
        "macd_signal": float(signal_line.iloc[-1]),
        "macd_hist": float(macd_hist.iloc[-1]),
        "stoch_k": float(stoch_k.iloc[-1]),
        "stoch_d": float(stoch_d.iloc[-1]),
        "atr": float(atr.iloc[-1]),
        "atr_pct": float(atr.iloc[-1] / price * 100) if price else 0.0,
        "bb_upper": float(bb_upper.iloc[-1]),
        "bb_middle": float(sma20.iloc[-1]),
        "bb_lower": float(bb_lower.iloc[-1]),
        "bb_position": float(
            (price - bb_lower.iloc[-1]) / (bb_upper.iloc[-1] - bb_lower.iloc[-1]) * 100
        )
        if (bb_upper.iloc[-1] - bb_lower.iloc[-1])
        else 0.0,
        "volume": int(volume.iloc[-1]) if len(volume) else 0,
        "vol_ratio": float(vol_ratio),
        "vol_sma20": float(vol_sma20.iloc[-1]) if len(vol_sma20) else 0.0,
        "support_1": float(bb_lower.iloc[-1]),
        "resistance_1": float(bb_upper.iloc[-1]),
    }


def indicators_timeseries(h: pd.DataFrame) -> dict:
    """Calculate indicator time series for charting.

    Args:
        h: DataFrame with OHLCV

    Returns:
        Dictionary of indicator series
    """
    if h is None or h.empty or len(h) < 20:
        return {}

    close = h["Close"].astype(float)
    high = h["High"].astype(float)
    low = h["Low"].astype(float)

    sma20 = close.rolling(20).mean()
    sma50 = close.rolling(50).mean()
    sma200 = close.rolling(200).mean() if len(close) >= 200 else sma50

    delta = close.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))

    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist = macd_line - signal_line

    lowest_low = low.rolling(14).min()
    highest_high = high.rolling(14).max()
    stoch_k = 100 * (close - lowest_low) / (highest_high - lowest_low)
    stoch_d = stoch_k.rolling(3).mean()

    tr = pd.concat(
        [(high - low), (high - close.shift()).abs(), (low - close.shift()).abs()],
        axis=1,
    ).max(axis=1)
    atr = tr.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()

    std20 = close.rolling(20).std()
    bb_upper = sma20 + 2 * std20
    bb_lower = sma20 - 2 * std20

    return {
        "close": close,
        "sma20": sma20,
        "sma50": sma50,
        "sma200": sma200,
        "rsi": rsi,
        "macd": macd_line,
        "macd_signal": signal_line,
        "macd_hist": macd_hist,
        "stoch_k": stoch_k,
        "stoch_d": stoch_d,
        "atr": atr,
        "bb_upper": bb_upper,
        "bb_lower": bb_lower,
    }
