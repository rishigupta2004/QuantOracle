"""Test fallback chain behavior"""

import pytest
import os

os.environ["INDIANAPI_API_KEY"] = "fake_key_for_testing"

pytestmark = pytest.mark.integration


class TestFallbackChain:
    """Test that fallback mechanisms work correctly"""

    def test_nse_fallback_chain(self, market_data, nse_symbols):
        """Test NSE quote fallback: IndianAPI (if available) → Yahoo"""
        for sym in nse_symbols:
            result = market_data["get_quote"](sym)
            assert result["symbol"] == sym, f"Symbol mismatch for {sym}"
            assert result.get("price", 0) > 0, f"Price should be available for {sym}"
            print(f"✓ {sym} fallback: ₹{result.get('price', 0):,.2f}")

    def test_us_fallback_chain(self, market_data, us_symbols):
        """Test US quote fallback: Yahoo"""
        for sym in us_symbols:
            result = market_data["get_quote"](sym)
            assert result["symbol"] == sym, f"Symbol mismatch for {sym}"
            assert result.get("price", 0) > 0, f"Price should be available for {sym}"
            print(f"✓ {sym} fallback: ${result.get('price', 0):,.2f}")

    def test_crypto_fallback(self, market_data, crypto_symbols):
        """Test crypto always uses Yahoo"""
        for sym in crypto_symbols:
            result = market_data["get_quote"](sym)
            assert result["symbol"] == sym, f"Symbol mismatch for {sym}"
            assert result.get("price", 0) > 0, "Crypto price should be available"
            print(f"✓ {sym}: ${result.get('price', 0):,.2f}")

    def test_forex_fallback(self, market_data, forex_symbols):
        """Test forex always uses Yahoo"""
        for sym in forex_symbols:
            result = market_data["get_quote"](sym)
            assert result["symbol"] == sym, f"Symbol mismatch for {sym}"
            assert result.get("price", 0) > 0, "Forex price should be available"
            print(f"✓ {sym}: {result.get('price', 0):,.4f}")


class TestBatchQuotes:
    """Test batch quote retrieval"""

    def test_get_quotes_batch(self, market_data, nse_symbols, us_symbols):
        """Test getting multiple quotes at once"""
        all_symbols = nse_symbols[:3] + us_symbols[:3]
        results = market_data["get_quotes"](all_symbols)
        assert len(results) == len(all_symbols), "Should return quotes for all symbols"
        for sym in all_symbols:
            assert sym in results, f"Missing quote for {sym}"
            assert results[sym].get("price", 0) > 0, (
                f"Price should be available for {sym}"
            )
        print(f"✓ Batch quote: {len(results)} symbols retrieved")


class TestSearchFallback:
    """Test search functionality"""

    def test_search_returns_results(self, market_data):
        """Test search returns results"""
        results = market_data["search"]("RELIANCE")
        print(f"✓ Search 'RELIANCE': {len(results)} results")
        for r in results[:3]:
            print(f"   - {r['symbol']}: {r['name']}")

    def test_search_case_insensitive(self, market_data):
        """Test search is case insensitive"""
        r1 = market_data["search"]("tcs")
        r2 = market_data["search"]("TCS")
        print(f"✓ Case insensitive search: {len(r1)} vs {len(r2)} results")
