"""Backward compatibility - re-exports from quant modules."""

from quant.core import (
    calculate_indicators,
    build_features,
    build_targets,
    indicators_timeseries,
)
from quant.data_sources import (
    get_quote,
    get_quotes,
    get_historical,
    get_trending,
    sources_status as sources,
    sync_ohlcv,
)
from quant.data.universe import (
    normalize_symbol,
    search_symbols as search,
    STOCK,
    ETF,
    NIFTY50_SYMBOLS,
    all_symbols,
    is_india_symbol,
)

get_indicators = calculate_indicators

__all__ = [
    "get_quote",
    "get_quotes",
    "get_historical",
    "get_indicators",
    "get_trending",
    "search",
    "normalize_symbol",
    "sources",
    "build_features",
    "build_targets",
    "sync_ohlcv",
    "indicators_timeseries",
    "STOCK",
    "ETF",
    "NIFTY50_SYMBOLS",
    "all_symbols",
    "is_india_symbol",
]
