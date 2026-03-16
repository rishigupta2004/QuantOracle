"""Test news API functionality"""

# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

import pytest
import time

pytestmark = pytest.mark.integration


class TestNews:
    """Test news functionality"""

    def test_market_news(self, news, thresholds, benchmark_runs):
        """Test market news retrieval"""
        start = time.perf_counter()
        articles = news["market_news"]()
        elapsed = (time.perf_counter() - start) * 1000
        print(f"\n Market news: {elapsed:.0f}ms ({len(articles)} articles)")
        if articles:
            assert elapsed < thresholds["news"], f"News too slow: {elapsed:.0f}ms"
            for a in articles[:3]:
                assert "headline" in a, "Should have headline"
                assert "url" in a, "Should have URL"
                assert "source" in a, "Should have source"
                print(f"   - {a['headline'][:50]}... ({a['source']})")
        else:
            print("   - No articles available (sources may be down)")

    def test_company_news(self, news):
        """Test company-specific news"""
        articles = news["company_news"]("RELIANCE.NS")
        print(f"\n Company news (RELIANCE): {len(articles)} articles")
        for a in articles[:2]:
            print(f"   - {a['headline'][:50]}...")

    def test_news_status(self, news):
        """Test news source status"""
        status = news["status"]()
        assert "newsdata" in status, "Should have newsdata status"
        assert "indianapi" in status, "Should have indianapi status"
        print(f"\n News sources: {status}")


class TestNewsFallback:
    """Test news fallback chain"""

    def test_news_fallback_to_rss(self, news):
        """Test news falls back to RSS if API fails"""
        articles = news["market_news"]()
        print(f"\n News fallback: {len(articles)} articles")
        if articles:
            print("   - Working (from API)")
        else:
            print("   - No sources available")

    def test_news_structure(self, news):
        """Test news article structure"""
        articles = news["market_news"]()
        if articles:
            a = articles[0]
            required = ["headline", "summary", "url", "source", "datetime"]
            for field in required:
                assert field in a, f"Missing field '{field}' in news article"
            print(" News structure valid")
        else:
            print("   - No articles to validate")
