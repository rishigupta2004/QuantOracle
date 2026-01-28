"""Pytest fixtures and configuration"""

import sys
import pytest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "frontend"))

DEFAULT_WATCHLIST = {
    "nse": ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "IEX.NS", "IRCTC.NS"],
    "us": ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "TSLA"],
    "crypto": ["BTC-USD", "ETH-USD", "SOL-USD"],
    "forex": ["USDINR=X", "EURUSD=X"],
    "indices": ["^NSEI", "^GSPC"],
}

LATENCY_THRESHOLDS = {
    "nse_quote": 2000,
    "us_quote": 2500,
    "indicators": 3000,
    "historical": 3000,
    "search": 1000,
    "news": 3000,
    "analytics": 1000,
}

BENCHMARK_RUNS = 3
ACCURACY_THRESHOLD = 1.0


@pytest.fixture(scope="session")
def watchlist():
    return DEFAULT_WATCHLIST


@pytest.fixture(scope="session")
def thresholds():
    return LATENCY_THRESHOLDS


@pytest.fixture(scope="session")
def benchmark_runs():
    return BENCHMARK_RUNS


@pytest.fixture(scope="session")
def accuracy_threshold():
    return ACCURACY_THRESHOLD


@pytest.fixture
def nse_symbols():
    return DEFAULT_WATCHLIST["nse"]


@pytest.fixture
def us_symbols():
    return DEFAULT_WATCHLIST["us"]


@pytest.fixture
def crypto_symbols():
    return DEFAULT_WATCHLIST["crypto"]


@pytest.fixture
def forex_symbols():
    return DEFAULT_WATCHLIST["forex"]


@pytest.fixture
def all_symbols():
    return (
        DEFAULT_WATCHLIST["nse"]
        + DEFAULT_WATCHLIST["us"]
        + DEFAULT_WATCHLIST["crypto"]
        + DEFAULT_WATCHLIST["forex"]
        + DEFAULT_WATCHLIST["indices"]
    )


@pytest.fixture
def market_data():
    from services.market_data import (
        get_quote,
        get_quotes,
        get_indicators,
        get_historical,
        search,
        sources,
    )

    return {
        "get_quote": get_quote,
        "get_quotes": get_quotes,
        "get_indicators": get_indicators,
        "get_historical": get_historical,
        "search": search,
        "sources": sources,
    }


@pytest.fixture
def analytics():
    from utils.analytics import portfolio_metrics, var, max_drawdown, beta

    return {
        "portfolio_metrics": portfolio_metrics,
        "var": var,
        "max_drawdown": max_drawdown,
        "beta": beta,
    }


@pytest.fixture
def news():
    from utils.news_service import market_news, company_news, status

    return {"market_news": market_news, "company_news": company_news, "status": status}


@pytest.fixture
def sample_holdings():
    return [
        {"symbol": "RELIANCE.NS", "quantity": 10, "avg_cost": 2400},
        {"symbol": "TCS.NS", "quantity": 5, "avg_cost": 3800},
        {"symbol": "AAPL", "quantity": 10, "avg_cost": 175},
    ]
