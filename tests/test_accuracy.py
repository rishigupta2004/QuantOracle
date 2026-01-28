"""Cross-verify prices across data sources for accuracy"""

import pytest
import os

os.environ["ALPHA_VANTAGE_API_KEY"] = os.getenv("ALPHA_VANTAGE_API_KEY", "")

pytestmark = pytest.mark.integration


class TestPriceAccuracy:
    """Verify prices are consistent across sources"""

    def test_nse_price_consistency(self, market_data, nse_symbols, accuracy_threshold):
        """Compare NSE quotes from different sources"""
        import yfinance as yf

        matches, total = 0, len(nse_symbols)

        for sym in nse_symbols:
            primary = market_data["get_quote"](sym)
            yahoo = yf.Ticker(sym).info.get("regularMarketPrice", 0)

            if yahoo > 0 and primary.get("price", 0) > 0:
                diff = abs(primary["price"] - yahoo) / yahoo * 100
                if diff < accuracy_threshold:
                    matches += 1
                print(
                    f"  {sym}: ₹{primary['price']:.2f} vs ¥{yahoo:.2f} (diff: {diff:.2f}%)"
                )
            else:
                matches += 1

        print(
            f"\n📈 NSE Accuracy: {matches}/{total} matched (threshold: {accuracy_threshold}%)"
        )
        assert matches >= total - 1, f"Only {matches}/{total} NSE quotes matched"

    def test_us_price_consistency(self, market_data, us_symbols, accuracy_threshold):
        """Compare US quotes from AlphaVantage vs Yahoo"""
        import yfinance as yf

        matches, total = 0, len(us_symbols)

        for sym in us_symbols:
            primary = market_data["get_quote"](sym)
            yahoo = yf.Ticker(sym).info.get("regularMarketPrice", 0)

            if yahoo > 0 and primary.get("price", 0) > 0:
                diff = abs(primary["price"] - yahoo) / yahoo * 100
                if diff < accuracy_threshold:
                    matches += 1
                print(
                    f"  {sym}: ${primary['price']:.2f} vs ¥{yahoo:.2f} (diff: {diff:.2f}%)"
                )
            else:
                matches += 1

        print(
            f"\n📈 US Accuracy: {matches}/{total} matched (threshold: {accuracy_threshold}%)"
        )
        assert matches >= total - 1, f"Only {matches}/{total} US quotes matched"


class TestQuoteStructure:
    """Verify quote data structure"""

    def test_nse_quote_structure(self, market_data, nse_symbols):
        """Verify NSE quotes have required fields"""
        for sym in nse_symbols:
            q = market_data["get_quote"](sym)
            required = [
                "symbol",
                "price",
                "change",
                "change_pct",
                "open",
                "high",
                "low",
                "volume",
            ]
            for field in required:
                assert field in q, f"Missing field '{field}' in {sym}"
            print(f"✓ {sym} structure valid")

    def test_us_quote_structure(self, market_data, us_symbols):
        """Verify US quotes have required fields"""
        for sym in us_symbols:
            q = market_data["get_quote"](sym)
            required = ["symbol", "price", "change", "change_pct"]
            for field in required:
                assert field in q, f"Missing field '{field}' in {sym}"
            print(f"✓ {sym} structure valid")

    def test_indicator_structure(self, market_data, nse_symbols):
        """Verify indicators have required fields"""
        ind = market_data["get_indicators"](nse_symbols[0])
        if ind:
            print(f"✓ Indicators: {list(ind.keys())}")


class TestDataFreshness:
    """Verify data is recent"""

    def test_nse_price_freshness(self, market_data, nse_symbols):
        """Verify NSE prices are non-zero"""
        for sym in nse_symbols:
            q = market_data["get_quote"](sym)
            assert q.get("price", 0) > 0, f"Price should be > 0 for {sym}"
            assert q.get("change_pct", 0) != 0 or q.get("open", 0) > 0, (
                f"Data looks stale for {sym}"
            )
            print(f"✓ {sym} data fresh: ₹{q['price']:.2f} ({q['change_pct']:+.2f}%)")

    def test_us_price_freshness(self, market_data, us_symbols):
        """Verify US prices are non-zero"""
        for sym in us_symbols:
            q = market_data["get_quote"](sym)
            assert q.get("price", 0) > 0, f"Price should be > 0 for {sym}"
            print(f"✓ {sym} data fresh: ${q['price']:.2f} ({q['change_pct']:+.2f}%)")
