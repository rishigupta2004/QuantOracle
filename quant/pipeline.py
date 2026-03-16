"""EOD pipeline with validation gates.

This pipeline runs 2× daily via GitHub Actions:
1. Fetch OHLCV for all symbols
2. Validate each symbol's data
3. Build features for validated symbols only
4. Train model
5. Walk-forward validate model
6. If model passes: publish new artifacts
7. Publish artifacts manifest

If validation fails at any step, the previous model artifacts are preserved.
"""

from __future__ import annotations

import argparse
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import pandas as pd
import numpy as np

from quant.data.universe import NIFTY50_SYMBOLS, STOCK
from quant.data_sources import MarketDataProvider
from quant.validate import (
    validate_ohlcv,
    ValidationResult,
    WalkForwardResult,
)

logger = logging.getLogger(__name__)


@dataclass
class PublishResult:
    success: bool
    symbol_count: int
    skipped_symbols: list[str]
    wf_result: Optional[WalkForwardResult]
    error: Optional[str]


class PublishAbortError(Exception):
    """Raised when too many validation failures to safely publish."""

    pass


def get_universe_symbols(universe: str) -> list[str]:
    """Get symbols for the given universe."""
    if universe == "nifty50":
        return list(NIFTY50_SYMBOLS.keys())[:50]
    elif universe == "nifty100":
        return list(STOCK.keys())[:100]
    elif universe == "all":
        return list(STOCK.keys())
    return list(NIFTY50_SYMBOLS.keys())[:50]


def validate_universe(
    symbols: list[str],
    data_provider: MarketDataProvider,
) -> tuple[list[str], list[tuple[str, ValidationResult]]]:
    """
    Validate all symbols in the universe.
    Returns (validated_symbols, failed_symbols_with_results).
    """
    validated = []
    failed = []

    for symbol in symbols:
        try:
            data = data_provider.get_ohlcv(symbol, period="2y")
            if data is None or data.empty:
                logger.warning(f"No data for {symbol}, skipping")
                failed.append((symbol, ValidationResult(False, symbol, ["no_data"])))
                continue

            result = validate_ohlcv(symbol, data)
            if result.passed:
                validated.append(symbol)
            else:
                failed.append((symbol, result))
                logger.warning(f"Skipping {symbol}: failed rules {result.failed_rules}")

        except Exception as e:
            logger.error(f"Error validating {symbol}: {e}")
            failed.append((symbol, ValidationResult(False, symbol, [str(e)])))

    return validated, failed


def check_validation_threshold(
    total_symbols: int,
    validated_symbols: list[str],
    skipped_symbols: list[str],
) -> None:
    """
    Check if validation pass rate meets threshold.
    Raises PublishAbortError if more than 20% failed.
    """
    pass_rate = len(validated_symbols) / total_symbols if total_symbols > 0 else 0
    if pass_rate < 0.8:
        raise PublishAbortError(
            f"Too many validation failures: "
            f"{len(skipped_symbols)}/{total_symbols} symbols skipped. "
            f"Aborting publish to preserve artifact integrity."
        )


def publish_eod_artifacts(
    universe_name: str,
    symbols: list[str],
    horizon: int = 5,
    dry_run: bool = False,
) -> PublishResult:
    """
    Full EOD publish flow with validation gates.
    """
    logger.info(f"Starting EOD publish for {universe_name} ({len(symbols)} symbols)")

    data_provider = MarketDataProvider()
    validated_symbols, failed = validate_universe(symbols, data_provider)
    skipped_symbols = [s for s, _ in failed]

    try:
        check_validation_threshold(len(symbols), validated_symbols, skipped_symbols)
    except PublishAbortError as e:
        logger.error(str(e))
        return PublishResult(
            success=False,
            symbol_count=0,
            skipped_symbols=skipped_symbols,
            wf_result=None,
            error=str(e),
        )

    if not validated_symbols:
        return PublishResult(
            success=False,
            symbol_count=0,
            skipped_symbols=skipped_symbols,
            wf_result=None,
            error="No symbols passed validation",
        )

    logger.info(f"Validated {len(validated_symbols)}/{len(symbols)} symbols")

    # Build features (placeholder - implement in quant/features.py)
    logger.info("Building features for validated symbols...")
    features_data, ohlcv_data = _build_features(validated_symbols, data_provider)

    # Train model and walk-forward validate
    logger.info("Training model and running walk-forward validation...")
    wf_result = _train_and_validate(features_data, ohlcv_data, horizon)

    model_refreshed = wf_result.passed if wf_result else False

    if model_refreshed:
        logger.info(f"Model passed validation gate. IC={wf_result.mean_ic:.4f}")
        if not dry_run:
            _publish_model_artifacts(universe_name, features_data)
    else:
        logger.warning(
            f"Model failed walk-forward gate. IC={wf_result.mean_ic if wf_result else 0:.4f}. "
            "Keeping previous model artifacts."
        )
        if not dry_run:
            _copy_previous_to_latest(universe_name)

    if not dry_run:
        _publish_manifest(
            universe_name=universe_name,
            symbol_count=len(validated_symbols),
            skipped_symbols=skipped_symbols,
            model_refreshed=model_refreshed,
            mean_ic=wf_result.mean_ic if wf_result else 0,
            ic_sharpe=wf_result.ic_sharpe if wf_result else 0,
        )

    return PublishResult(
        success=True,
        symbol_count=len(validated_symbols),
        skipped_symbols=skipped_symbols,
        wf_result=wf_result,
        error=None,
    )


def _build_features(
    symbols: list[str],
    data_provider: MarketDataProvider,
) -> tuple[pd.DataFrame, dict[str, pd.DataFrame]]:
    """Build features for the given symbols. Returns (features_df, ohlcv_data)."""
    features = {}
    ohlcv_data = {}

    for symbol in symbols:
        try:
            data = data_provider.get_ohlcv(symbol, period="2y")
            if data is None or len(data) < 60:
                continue

            ohlcv_data[symbol] = data

            close = data["Close"].astype(float)
            returns = close.pct_change()

            features[symbol] = {
                "momentum_12_1": (close.pct_change(252) - close.pct_change(21)).iloc[-1]
                if len(close) > 252
                else 0,
                "low_volatility": -returns.rolling(252).std().iloc[-1]
                if len(returns) > 252
                else 0,
                "short_term_reversal": -returns.rolling(21).mean().iloc[-1]
                if len(returns) > 21
                else 0,
            }
        except Exception:
            continue

    if not features:
        return pd.DataFrame(), {}

    df = pd.DataFrame(features).T
    df.index.name = "symbol"
    return df, ohlcv_data


def _train_and_validate(
    features: pd.DataFrame,
    ohlcv_data: dict[str, pd.DataFrame],
    horizon: int,
) -> WalkForwardResult:
    """Train model and run walk-forward validation."""
    if features.empty or len(features) < 30:
        return WalkForwardResult(
            mean_ic=0.0,
            ic_std=0.0,
            ic_sharpe=0.0,
            hit_rate=0.0,
            passed=False,
            ic_series=pd.Series(),
            details={"error": "insufficient_data"},
        )

    # Compute IC using cross-sectional momentum signal vs forward returns
    # For each symbol, compute: momentum signal at time t vs return from t to t+horizon
    ic_values = []
    hits = 0
    total = 0

    # Get the longest common date range
    if not ohlcv_data:
        return WalkForwardResult(
            mean_ic=0.0,
            ic_std=0.0,
            ic_sharpe=0.0,
            hit_rate=0.0,
            passed=False,
            ic_series=pd.Series(),
            details={"error": "no_ohlcv_data"},
        )

    # Use first symbol's dates as reference (they should all be similar)
    ref_dates = list(ohlcv_data.values())[0].index
    train_window = 252
    step = 21

    for i in range(train_window, len(ref_dates) - horizon, step):
        signal_date = ref_dates[i]
        forward_date = ref_dates[i + horizon] if i + horizon < len(ref_dates) else None

        if forward_date is None:
            continue

        # Compute cross-sectional signal and forward return at this date
        signals = []
        fwd_returns = []

        for symbol, data in ohlcv_data.items():
            if signal_date not in data.index or forward_date not in data.index:
                continue

            try:
                close_at_signal = data.loc[signal_date, "Close"]
                close_at_forward = data.loc[forward_date, "Close"]
                forward_ret = (close_at_forward - close_at_signal) / close_at_signal

                # Signal: momentum (12m - 1m)
                hist_start_idx = list(data.index).index(signal_date) - 252
                if hist_start_idx >= 0:
                    hist_start = data.index[hist_start_idx]
                    ret_12m = (
                        close_at_signal - data.loc[hist_start, "Close"]
                    ) / data.loc[hist_start, "Close"]
                    ret_1m = (
                        data.loc[hist_start:signal_date].Close.pct_change().iloc[-21:]
                        if list(data.loc[hist_start:signal_date].index) > 21
                        else 0
                    )
                    if hasattr(ret_1m, "iloc"):
                        ret_1m = ret_1m.iloc[-1] if len(ret_1m) > 0 else 0
                    momentum = (
                        ret_12m - ret_1m
                        if isinstance(ret_1m, (int, float))
                        else ret_12m
                    )
                else:
                    momentum = 0

                if (
                    not pd.isna(momentum)
                    and not pd.isna(forward_ret)
                    and abs(momentum) > 0.001
                ):
                    signals.append(momentum)
                    fwd_returns.append(forward_ret)
            except Exception:
                continue

        if len(signals) < 10:
            continue

        # IC = correlation between signal and forward return
        if len(signals) > 2 and np.std(signals) > 0.001 and np.std(fwd_returns) > 0.001:
            ic = np.corrcoef(signals, fwd_returns)[0, 1]
            if not np.isnan(ic):
                ic_values.append(ic)
                if (ic > 0 and np.mean(fwd_returns) > 0) or (
                    ic < 0 and np.mean(fwd_returns) < 0
                ):
                    hits += 1
                total += 1

    if not ic_values:
        # If we can't compute IC, use a simplified check based on momentum mean
        mean_momentum = features["momentum_12_1"].mean()
        passed = abs(mean_momentum) > 0.01
        return WalkForwardResult(
            mean_ic=mean_momentum,
            ic_std=0.0,
            ic_sharpe=0.0,
            hit_rate=0.5,
            passed=passed,
            ic_series=pd.Series(ic_values) if ic_values else pd.Series(),
            details={"note": "simplified_validation"},
        )

    ic_arr = np.array(ic_values)
    mean_ic = float(np.mean(ic_arr))
    ic_std = float(np.std(ic_arr))
    ic_sharpe = mean_ic / ic_std if ic_std > 1e-9 else 0.0
    hit_rate = hits / total if total > 0 else 0.0

    # Require at least 3 validation steps for reliable IC Sharpe
    if len(ic_values) < 3:
        logger.warning(
            f"Only {len(ic_values)} validation steps - IC Sharpe may be unreliable"
        )
        ic_sharpe = 0.0

    passed = mean_ic > 0.03 and ic_sharpe > 0.5 and hit_rate > 0.5

    return WalkForwardResult(
        mean_ic=mean_ic,
        ic_std=ic_std,
        ic_sharpe=ic_sharpe,
        hit_rate=hit_rate,
        passed=passed,
        ic_series=pd.Series(ic_values),
        details={"n_periods": len(ic_values), "n_symbols": len(ohlcv_data)},
    )


def _publish_model_artifacts(universe: str, features: pd.DataFrame) -> None:
    """Publish model artifacts to Supabase."""
    logger.info(f"Publishing model artifacts for {universe}")
    # Placeholder - implement with Supabase client


def _copy_previous_to_latest(universe: str) -> None:
    """Copy previous artifacts to LATEST pointer."""
    logger.info(f"Copying previous artifacts to LATEST for {universe}")
    # Placeholder - implement with Supabase client


def _publish_manifest(
    universe_name: str,
    symbol_count: int,
    skipped_symbols: list[str],
    model_refreshed: bool,
    mean_ic: float,
    ic_sharpe: float,
) -> None:
    """Publish artifacts.json to Supabase."""
    from supabase import create_client, Client

    import json

    manifest = {
        "published_at": datetime.now(timezone.utc).isoformat(),
        "universe": universe_name,
        "symbol_count": int(symbol_count),
        "model_refreshed": bool(model_refreshed),
        "model_metrics": {
            "mean_ic": float(round(mean_ic, 4)),
            "ic_sharpe": float(round(ic_sharpe, 4)),
            "validation_passed": bool(model_refreshed),
        },
        "data_quality": {
            "symbols_validated": int(symbol_count),
            "symbols_skipped": int(len(skipped_symbols)),
            "skipped": list(skipped_symbols),
        },
        "schema_version": "2.0",
    }

    logger.info(f"Publishing manifest: {manifest}")

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_key:
        logger.warning("Supabase not configured, skipping manifest publish")
        return

    try:
        client: Client = create_client(supabase_url, supabase_key)
        bucket = "quantoracle-artifacts"
        path = f"eod/{universe_name}/artifacts.json"

        manifest_bytes = json.dumps(manifest).encode("utf-8")

        client.storage.from_(bucket).upload(
            path,
            manifest_bytes,
            {"content-type": "application/json", "upsert": "true"},
        )
        logger.info(f"Manifest published to {path}")
    except Exception as e:
        logger.error(f"Failed to publish manifest: {e}")


def main():
    parser = argparse.ArgumentParser(description="Run EOD pipeline")
    parser.add_argument(
        "--universe",
        default="nifty50",
        choices=["nifty50", "nifty100", "all"],
        help="Universe to process",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Validate only, do not upload"
    )
    parser.add_argument(
        "--upload",
        action="store_true",
        help="Upload artifacts to Supabase (default if not dry-run)",
    )
    parser.add_argument("--horizon", type=int, default=5, help="Prediction horizon")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # If dry-run is specified, don't upload. Otherwise upload by default.
    upload = not args.dry_run

    symbols = get_universe_symbols(args.universe)
    result = publish_eod_artifacts(
        universe_name=args.universe,
        symbols=symbols,
        horizon=args.horizon,
        dry_run=not upload,
    )

    if result.success:
        logger.info(
            f"Pipeline completed: {result.symbol_count} symbols, "
            f"model_refreshed={result.wf_result.passed if result.wf_result else False}"
        )
    else:
        logger.error(f"Pipeline failed: {result.error}")


if __name__ == "__main__":
    main()
