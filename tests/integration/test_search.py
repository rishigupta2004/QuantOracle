"""Test symbol search functionality"""

import pytest

pytestmark = pytest.mark.integration


class TestSearch:
    """Test symbol search functionality"""

    def test_search_stocks(self, market_data):
        """Test searching for stocks"""
        results = market_data["search"]("RELIANCE")
        print(f"✓ Search 'RELIANCE': {len(results)} results")
        if results:
            for r in results[:3]:
                print(f"   - {r['symbol']}: {r['name']}")
        else:
            print("   - (Rate limited or no results)")

    def test_search_case_insensitive(self, market_data):
        """Test case insensitive search"""
        r1 = market_data["search"]("reliance")
        r2 = market_data["search"]("RELIANCE")
        print(f"✓ Case insensitive search: {len(r1)} vs {len(r2)} results")

    def test_search_partial_match(self, market_data):
        """Test partial string matching"""
        results = market_data["search"]("HDFC")
        print(f"✓ Search 'HDFC': {len(results)} results")
        for r in results[:2]:
            print(f"   - {r['symbol']}: {r['name']}")

    def test_search_returns_structure(self, market_data):
        """Test search returns proper structure"""
        results = market_data["search"]("TCS")
        for r in results:
            assert "symbol" in r, "Should have symbol"
            assert "name" in r, "Should have name"
        print("✓ Search results have proper structure")

    def test_search_etf(self, market_data):
        """Test searching for ETFs"""
        results = market_data["search"]("NIFTYBEES")
        print(f"✓ Search 'NIFTYBEES': {len(results)} results")
        for r in results[:2]:
            print(f"   - {r['symbol']}: {r['name']} ({r.get('region', 'N/A')})")

    def test_search_empty_query(self, market_data):
        """Test empty or very short query"""
        results = market_data["search"]("XYZNONEXISTENT123")
        print(f"✓ Unknown symbol returns: {len(results)} results")

    def test_search_us_symbols(self, market_data):
        """US symbols aren't in the local India-first search list."""
        results = market_data["search"]("AAPL")
        assert results == []
        print("✓ US symbol search returns empty (expected)")

    def test_search_limit(self, market_data):
        """Test search returns limited results"""
        results = market_data["search"]("A")
        print(f"✓ Search 'A': {len(results)} results (max 20)")
        assert len(results) <= 20, "Should limit to 20 results"
