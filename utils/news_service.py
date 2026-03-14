"""News aggregation service - backward compatibility."""

from typing import Dict, List, Any
import os


def market_news() -> List[Dict[str, Any]]:
    """Get market news."""
    return []


def company_news(symbol: str) -> List[Dict[str, Any]]:
    """Get news for a specific company."""
    return []


def status() -> Dict[str, bool]:
    """Check news source status."""
    return {
        "indianapi": bool(os.getenv("INDIANAPI_API_KEY")),
        "newsdata": bool(os.getenv("NEWSDATA_API_KEY")),
    }
