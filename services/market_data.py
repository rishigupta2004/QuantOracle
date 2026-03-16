"""Backward compatibility - market_data module re-export."""

from quant.core import calculate_indicators, indicators_timeseries
from quant.data_sources import (
    get_quote as _get_quote,
    get_quotes as _get_quotes,
    get_historical as _get_historical,
    get_trending as _get_trending,
    sources_status as _sources_status,
    sync_ohlcv as _sync_ohlcv,
    sync_quotes as _sync_quotes,
)
from quant.data.universe import (
    normalize_symbol as _normalize_symbol,
    search_symbols as _search_symbols,
    STOCK,
    ETF,
    NIFTY50_SYMBOLS,
    INDEX_PROXY,
    all_symbols,
    is_india_symbol,
)

get_quote = _get_quote
get_quotes = _get_quotes
get_historical = _get_historical
get_indicators = calculate_indicators
get_trending = _get_trending
sources = _sources_status
normalize_symbol = _normalize_symbol
sync_ohlcv = _sync_ohlcv
sync_quotes = _sync_quotes
search = _search_symbols

__all__ = [
    "get_quote",
    "get_quotes",
    "get_historical",
    "get_indicators",
    "get_trending",
    "sources",
    "normalize_symbol",
    "sync_ohlcv",
    "sync_quotes",
    "search",
    "indicators_timeseries",
    "STOCK",
    "ETF",
    "NIFTY50_SYMBOLS",
    "INDEX_PROXY",
    "all_symbols",
    "is_india_symbol",
]
