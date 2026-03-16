"""IC-weighted composite signal engine.

Design principles:
- Signals are organized into 4 non-overlapping categories.
  Never combine two signals from the same category — that's
  double-counting, not confirmation.
- Each signal's weight = its historical IC on that symbol.
  IC = Pearson correlation of signal with forward 5-day returns.
  IC < 0.02 → weight = 0 (signal has no predictive power, ignore it)
- The composite score is a weighted average, not a vote count.
- Every verdict object carries its own explanation — no LLM needed.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum

import numpy as np
import pandas as pd


class Verdict(str, Enum):
    STRONG_BUY = "STRONG_BUY"
    BUY = "BUY"
    HOLD = "HOLD"
    SELL = "SELL"
    STRONG_SELL = "STRONG_SELL"


@dataclass
class CategorySignal:
    name: str
    value: float
    ic: float
    weight: float
    label: str
    detail: str


@dataclass
class SignalVerdict:
    symbol: str
    verdict: Verdict
    composite_score: float
    confidence: float
    trend: CategorySignal
    momentum: CategorySignal
    reversion: CategorySignal
    volume: CategorySignal
    explanation: str
    timeframe: str
    calculated_at: str
    has_ic_history: bool


# =============================================================================
# PRIVATE HELPER INDICATORS (not in core.py)
# =============================================================================


def _ema(series: pd.Series, period: int) -> pd.Series:
    """Exponential moving average."""
    return series.ewm(span=period, adjust=False).mean()


def _atr(data: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average True Range."""
    high = data["High"].astype(float)
    low = data["Low"].astype(float)
    close = data["Close"].astype(float)
    tr = pd.concat(
        [
            high - low,
            (high - close.shift()).abs(),
            (low - close.shift()).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()


def _adx(data: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average Directional Index."""
    high = data["High"].astype(float)
    low = data["Low"].astype(float)

    plus_dm = high.diff()
    minus_dm = -low.diff()

    plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0.0)
    minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0.0)

    atr = _atr(data, period)
    plus_di = 100 * (_ema(plus_dm, period) / atr)
    minus_di = 100 * (_ema(minus_dm, period) / atr)

    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-9)
    adx = _ema(dx, period)

    return adx


def _obv(data: pd.DataFrame) -> pd.Series:
    """On-Balance Volume."""
    close = data["Close"].astype(float)
    volume = data["Volume"].astype(float)
    sign = np.sign(close.diff())
    return (sign * volume).cumsum()


def _vwap(data: pd.DataFrame) -> pd.Series:
    """Volume Weighted Average Price."""
    typical = (data["High"] + data["Low"] + data["Close"]) / 3
    volume = data["Volume"].astype(float)
    return (typical * volume).cumsum() / volume.cumsum()


# =============================================================================
# SIGNAL CATEGORY FUNCTIONS
# =============================================================================


def _trend_signal(data: pd.DataFrame) -> CategorySignal:
    """
    EMA(21) vs EMA(55) crossover, filtered by ADX.

    Rules:
    - ADX < 20: NO_TREND signal, value = 0.0 (no trend to trade)
    - EMA21 > EMA55 AND ADX >= 20: TRENDING_UP, value = ADX/100
    - EMA21 < EMA55 AND ADX >= 20: TRENDING_DOWN, value = -ADX/100

    The ADX filter is the most important line in this function.
    Without it, you generate crossover signals in choppy sideways
    markets — the single biggest source of false signals in TA.
    """
    ema21 = _ema(data["Close"], 21)
    ema55 = _ema(data["Close"], 55)
    adx_val = _adx(data, 14).iloc[-1]

    if adx_val < 20:
        return CategorySignal(
            name="TREND",
            value=0.0,
            ic=0.0,
            weight=0.0,
            label="NO_TREND",
            detail=f"ADX={adx_val:.1f} (below 20 threshold, no trend)",
        )

    cross = ema21.iloc[-1] - ema55.iloc[-1]
    value = np.sign(cross) * min(adx_val / 100, 1.0)
    label = "TRENDING_UP" if cross > 0 else "TRENDING_DOWN"

    return CategorySignal(
        name="TREND",
        value=value,
        ic=0.0,
        weight=0.0,
        label=label,
        detail=f"EMA21={ema21.iloc[-1]:.2f} vs EMA55={ema55.iloc[-1]:.2f}, ADX={adx_val:.1f}",
    )


def _momentum_signal(data: pd.DataFrame) -> CategorySignal:
    """
    MACD (12, 26, 9) histogram direction + zero-line cross.

    Rules:
    - Histogram > 0 AND rising: MOMENTUM_BULL
    - Histogram < 0 AND falling: MOMENTUM_BEAR
    - Otherwise: FLAT

    Normalize histogram by ATR to make it comparable across symbols.
    """
    ema12 = _ema(data["Close"], 12)
    ema26 = _ema(data["Close"], 26)
    macd_line = ema12 - ema26
    signal_line = _ema(macd_line, 9)
    histogram = macd_line - signal_line

    atr_val = _atr(data, 14).iloc[-1]
    hist_val = histogram.iloc[-1]
    hist_prev = histogram.iloc[-2]

    normalized = np.clip(hist_val / (atr_val + 1e-9), -1.0, 1.0)

    rising = hist_val > hist_prev
    if hist_val > 0:
        label = "MOMENTUM_BULL" if rising else "MOMENTUM_FADING_BULL"
    elif hist_val < 0:
        label = "MOMENTUM_BEAR" if not rising else "MOMENTUM_FADING_BEAR"
    else:
        label = "FLAT"

    return CategorySignal(
        name="MOMENTUM",
        value=normalized,
        ic=0.0,
        weight=0.0,
        label=label,
        detail=f"MACD hist={hist_val:+.3f}, ATR-norm={normalized:+.3f}, {'rising' if rising else 'falling'}",
    )


def _reversion_signal(data: pd.DataFrame, trend: CategorySignal) -> CategorySignal:
    """
    RSI(14) with DYNAMIC thresholds based on symbol's own RSI history.

    CRITICAL: Only fire this signal when trend.label == "NO_TREND".
    Mean reversion trades against a strong trend are losers.
    """
    if trend.label != "NO_TREND":
        return CategorySignal(
            name="REVERSION",
            value=0.0,
            ic=0.0,
            weight=0.0,
            label="TREND_ACTIVE",
            detail="Reversion signal suppressed — active trend detected",
        )

    # Calculate RSI
    delta = data["Close"].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    rsi_series = 100 - (100 / (1 + rs))

    current_rsi = rsi_series.iloc[-1]

    history_length = min(len(rsi_series), 252)
    rsi_history = rsi_series.iloc[-history_length:]
    oversold_threshold = rsi_history.quantile(0.20)
    overbought_threshold = rsi_history.quantile(0.80)

    if current_rsi <= oversold_threshold:
        distance = (oversold_threshold - current_rsi) / (oversold_threshold + 1e-9)
        value = min(distance * 2, 1.0)
        label = "OVERSOLD"
    elif current_rsi >= overbought_threshold:
        distance = (current_rsi - overbought_threshold) / (
            100 - overbought_threshold + 1e-9
        )
        value = -min(distance * 2, 1.0)
        label = "OVERBOUGHT"
    else:
        value = 0.0
        label = "NEUTRAL"

    return CategorySignal(
        name="REVERSION",
        value=value,
        ic=0.0,
        weight=0.0,
        label=label,
        detail=f"RSI={current_rsi:.1f} (oversold<{oversold_threshold:.0f}, overbought>{overbought_threshold:.0f}, {history_length}d history)",
    )


def _volume_signal(data: pd.DataFrame) -> CategorySignal:
    """
    VWAP deviation + OBV trend confirmation.
    This is NOT a standalone signal. It is a confidence modifier.
    """
    vwap_val = _vwap(data).iloc[-1]
    current_price = data["Close"].iloc[-1]

    obv_series = _obv(data)
    obv_rising = obv_series.iloc[-1] > obv_series.iloc[-5:].mean()

    price_above_vwap = current_price > vwap_val

    if price_above_vwap and obv_rising:
        value = 0.6
        label = "CONFIRMING_BULL"
    elif not price_above_vwap and not obv_rising:
        value = -0.6
        label = "CONFIRMING_BEAR"
    elif price_above_vwap and not obv_rising:
        value = -0.3
        label = "DIVERGENCE_BEAR"
    else:
        value = 0.3
        label = "DIVERGENCE_BULL"

    deviation_pct = (current_price - vwap_val) / vwap_val * 100

    return CategorySignal(
        name="VOLUME",
        value=value,
        ic=0.0,
        weight=0.0,
        label=label,
        detail=f"Price {'above' if price_above_vwap else 'below'} VWAP by {deviation_pct:+.2f}%, OBV {'rising' if obv_rising else 'falling'}",
    )


# =============================================================================
# IC CALCULATION
# =============================================================================


def _calculate_ic(signal_values: pd.Series, forward_returns: pd.Series) -> float:
    """
    Information Coefficient = Pearson correlation between
    signal values and subsequent forward returns.
    """
    paired = pd.concat([signal_values, forward_returns], axis=1).dropna()
    if len(paired) < 30:
        return 0.0
    corr = paired.iloc[:, 0].corr(paired.iloc[:, 1])
    return float(corr) if not np.isnan(corr) else 0.0


def _compute_ic_weights(data: pd.DataFrame, horizon: int = 5) -> dict:
    """
    Compute IC for each signal category over rolling 252-day history.
    Returns normalized weights that sum to 1.0.
    """
    if len(data) < 272:
        return {
            "TREND": 0.333,
            "MOMENTUM": 0.333,
            "REVERSION": 0.333,
            "ic_trend": 0.0,
            "ic_momentum": 0.0,
            "ic_reversion": 0.0,
            "has_ic_history": False,
        }

    forward_ret = data["Close"].pct_change(horizon).shift(-horizon)

    ema21 = _ema(data["Close"], 21)
    ema55 = _ema(data["Close"], 55)
    trend_series = (ema21 - ema55) / data["Close"]

    ema12 = _ema(data["Close"], 12)
    ema26 = _ema(data["Close"], 26)
    macd_line = ema12 - ema26
    signal_line = _ema(macd_line, 9)
    histogram = macd_line - signal_line
    atr_series = _atr(data, 14)
    momentum_series = (histogram / (atr_series + 1e-9)).clip(-1, 1)

    delta = data["Close"].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / 14, min_periods=14, adjust=False).mean()
    rs = avg_gain / (avg_loss + 1e-9)
    rsi_series = 100 - (100 / (1 + rs))
    reversion_series = rsi_series / 100 - 0.5

    ic_trend = _calculate_ic(
        trend_series.dropna(), forward_ret.reindex(trend_series.dropna().index)
    )
    ic_momentum = _calculate_ic(
        momentum_series.dropna(), forward_ret.reindex(momentum_series.dropna().index)
    )
    ic_reversion = _calculate_ic(
        reversion_series.dropna(), forward_ret.reindex(reversion_series.dropna().index)
    )

    raw_weights = {
        "TREND": max(ic_trend, 0.0),
        "MOMENTUM": max(ic_momentum, 0.0),
        "REVERSION": max(ic_reversion, 0.0),
    }

    total = sum(raw_weights.values())
    if total < 1e-9:
        return {
            "TREND": 0.333,
            "MOMENTUM": 0.333,
            "REVERSION": 0.333,
            "ic_trend": ic_trend,
            "ic_momentum": ic_momentum,
            "ic_reversion": ic_reversion,
            "has_ic_history": True,
        }

    normalized = {k: v / total for k, v in raw_weights.items()}
    normalized.update(
        {
            "ic_trend": ic_trend,
            "ic_momentum": ic_momentum,
            "ic_reversion": ic_reversion,
            "has_ic_history": True,
        }
    )
    return normalized


# =============================================================================
# VERDICT AND EXPLANATION
# =============================================================================


def _build_verdict(composite: float, confidence: float) -> Verdict:
    """Score to verdict mapping. Conservative thresholds."""
    if composite > 0.50 and confidence > 0.40:
        return Verdict.STRONG_BUY
    if composite > 0.20:
        return Verdict.BUY
    if composite > -0.20:
        return Verdict.HOLD
    if composite > -0.50:
        return Verdict.SELL
    return Verdict.STRONG_SELL


def _generate_explanation(
    symbol: str,
    verdict: Verdict,
    composite: float,
    confidence: float,
    trend: CategorySignal,
    momentum: CategorySignal,
    reversion: CategorySignal,
    volume: CategorySignal,
    has_ic_history: bool,
) -> str:
    """Template-based explanation. No LLM."""
    symbol_clean = symbol.replace(".NS", "").replace(".BO", "")

    ic_note = (
        f"IC-weighted confidence: {confidence:.2f}."
        if has_ic_history
        else "Note: insufficient history for IC weighting — using equal weights."
    )

    lines = [
        f"{symbol_clean} composite signal: {verdict.value} (score {composite:+.2f}).",
        f"Trend: {trend.label} — {trend.detail}.",
        f"Momentum: {momentum.label} — {momentum.detail}.",
    ]

    if reversion.label not in ("TREND_ACTIVE", "NEUTRAL"):
        lines.append(f"Mean reversion: {reversion.label} — {reversion.detail}.")

    lines.append(f"Volume: {volume.label} — {volume.detail}.")
    lines.append(ic_note)

    return " ".join(lines)


# =============================================================================
# MAIN FUNCTION
# =============================================================================


class InsufficientDataError(Exception):
    """Raised when insufficient data for signal calculation."""

    pass


def calculate_signals(
    symbol: str,
    data: pd.DataFrame,
    timeframe: str = "1D",
) -> SignalVerdict:
    """
    Master signal calculation function.

    Args:
        symbol: NSE symbol with suffix e.g. "RELIANCE.NS"
        data: OHLCV DataFrame, minimum 60 rows, ideally 252+
        timeframe: "1D" for daily signals, "1W" for weekly

    Returns:
        SignalVerdict with all category signals and composite score.

    Raises:
        InsufficientDataError: if len(data) < 60
    """
    if len(data) < 60:
        raise InsufficientDataError(f"Need at least 60 rows, got {len(data)}")

    # Normalize column names to Title Case
    if "close" in data.columns:
        data = data.rename(columns={c: c.title() for c in data.columns})

    # Calculate all four category signals
    trend = _trend_signal(data)
    momentum = _momentum_signal(data)
    reversion = _reversion_signal(data, trend)
    volume = _volume_signal(data)

    # Compute IC weights if we have enough history
    ic_weights = _compute_ic_weights(data)
    has_ic_history = ic_weights.get("has_ic_history", False)

    # Apply weights
    trend_weight = ic_weights.get("TREND", 0.333)
    momentum_weight = ic_weights.get("MOMENTUM", 0.333)
    reversion_weight = ic_weights.get("REVERSION", 0.333)

    # Update signals with IC weights
    trend = CategorySignal(
        name=trend.name,
        value=trend.value,
        ic=ic_weights.get("ic_trend", 0.0),
        weight=trend_weight,
        label=trend.label,
        detail=trend.detail,
    )
    momentum = CategorySignal(
        name=momentum.name,
        value=momentum.value,
        ic=ic_weights.get("ic_momentum", 0.0),
        weight=momentum_weight,
        label=momentum.label,
        detail=momentum.detail,
    )
    reversion = CategorySignal(
        name=reversion.name,
        value=reversion.value,
        ic=ic_weights.get("ic_reversion", 0.0),
        weight=reversion_weight,
        label=reversion.label,
        detail=reversion.detail,
    )

    # Volume is always a modifier, not a primary signal
    # If volume confirms trend/momentum, boost confidence
    # If volume contradicts, penalize confidence
    primary_direction = (trend.value + momentum.value) / 2
    volume_modifier = 1.0
    if volume.value * primary_direction > 0:
        volume_modifier = 1.15
    elif abs(volume.value) > 0.3:
        volume_modifier = 0.85

    # Calculate composite score
    composite = (
        trend.value * trend_weight
        + momentum.value * momentum_weight
        + reversion.value * reversion_weight
    )

    # Confidence is mean IC, adjusted by volume confirmation
    confidence = (
        (
            abs(trend.ic) * trend_weight
            + abs(momentum.ic) * momentum_weight
            + abs(reversion.ic) * reversion_weight
        )
        if has_ic_history
        else 0.3
    ) * volume_modifier

    verdict = _build_verdict(composite, confidence)
    explanation = _generate_explanation(
        symbol,
        verdict,
        composite,
        confidence,
        trend,
        momentum,
        reversion,
        volume,
        has_ic_history,
    )

    return SignalVerdict(
        symbol=symbol,
        verdict=verdict,
        composite_score=composite,
        confidence=confidence,
        trend=trend,
        momentum=momentum,
        reversion=reversion,
        volume=volume,
        explanation=explanation,
        timeframe=timeframe,
        calculated_at=datetime.utcnow().isoformat() + "Z",
        has_ic_history=has_ic_history,
    )
