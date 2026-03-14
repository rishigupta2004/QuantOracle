"""Test individual data sources"""

import pytest
import time

pytestmark = pytest.mark.integration


class TestNSEQuotes:
    """Test NSE quote functionality"""

    def test_get_quote_nse(self, market_data, nse_symbols):
        for sym in nse_symbols:
            result = market_data["get_quote"](sym)
            assert result["symbol"] == sym, f"Symbol mismatch for {sym}"
            assert "price" in result, f"Price missing for {sym}"
            assert result["price"] > 0, f"Price should be > 0 for {sym}"
            print(f"✓ {sym}: ₹{result.get('price', 0):,.2f}")

    def test_get_quote_nse_response_time(
        self, market_data, nse_symbols, thresholds, benchmark_runs
    ):
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            market_data["get_quote"](nse_symbols[0])
            times.append((time.perf_counter() - start) * 1000)
        avg = sum(times) / len(times)
        print(f"\n⏱️  NSE Quote (avg of {benchmark_runs} runs): {avg:.0f}ms")
        assert avg < thresholds["nse_quote"], (
            f"NSE quote too slow: {avg:.0f}ms > {thresholds['nse_quote']}ms"
        )


class TestUSQuotes:
    """Test US quote functionality"""

    def test_get_quote_us(self, market_data, us_symbols):
        for sym in us_symbols:
            result = market_data["get_quote"](sym)
            assert result["symbol"] == sym, f"Symbol mismatch for {sym}"
            assert "price" in result, f"Price missing for {sym}"
            assert result["price"] > 0, f"Price should be > 0 for {sym}"
            print(f"✓ {sym}: ${result.get('price', 0):,.2f}")

    def test_get_quote_us_response_time(
        self, market_data, us_symbols, thresholds, benchmark_runs
    ):
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            market_data["get_quote"](us_symbols[0])
            times.append((time.perf_counter() - start) * 1000)
        avg = sum(times) / len(times)
        print(f"\n⏱️  US Quote (avg of {benchmark_runs} runs): {avg:.0f}ms")
        assert avg < thresholds["us_quote"], (
            f"US quote too slow: {avg:.0f}ms > {thresholds['us_quote']}ms"
        )


class TestCryptoForex:
    """Test crypto and forex quotes"""

    def test_get_quote_crypto(self, market_data, crypto_symbols):
        for sym in crypto_symbols:
            result = market_data["get_quote"](sym)
            assert result["symbol"] == sym, f"Symbol mismatch for {sym}"
            assert result["price"] > 0, f"Price should be > 0 for {sym}"
            print(f"✓ {sym}: ${result.get('price', 0):,.2f}")

    def test_get_quote_forex(self, market_data, forex_symbols):
        for sym in forex_symbols:
            result = market_data["get_quote"](sym)
            assert result["symbol"] == sym, f"Symbol mismatch for {sym}"
            assert result["price"] > 0, f"Price should be > 0 for {sym}"
            print(f"✓ {sym}: {result.get('price', 0):,.4f}")


class TestHistoricalData:
    """Test historical data retrieval"""

    def test_get_historical(self, market_data, nse_symbols, thresholds, benchmark_runs):
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            market_data["get_historical"](nse_symbols[0], "1mo")
            times.append((time.perf_counter() - start) * 1000)
        avg = sum(times) / len(times)
        print(f"\n⏱️  Historical Data (avg of {benchmark_runs} runs): {avg:.0f}ms")
        assert avg < thresholds["historical"], (
            f"Historical too slow: {avg:.0f}ms > {thresholds['historical']}ms"
        )

    def test_historical_not_empty(self, market_data, nse_symbols):
        result = market_data["get_historical"](nse_symbols[0], "1mo")
        assert not result.empty, "Historical data should not be empty"
        assert "Close" in result.columns, "Should have Close column"


class TestIndicators:
    """Test technical indicators"""

    def test_get_indicators(self, market_data, nse_symbols, thresholds, benchmark_runs):
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            market_data["get_indicators"](nse_symbols[0])
            times.append((time.perf_counter() - start) * 1000)
        avg = sum(times) / len(times)
        print(f"\n⏱️  Indicators (avg of {benchmark_runs} runs): {avg:.0f}ms")
        assert avg < thresholds["indicators"], (
            f"Indicators too slow: {avg:.0f}ms > {thresholds['indicators']}ms"
        )

    def test_indicators_structure(self, market_data, nse_symbols):
        result = market_data["get_indicators"](nse_symbols[0])
        assert isinstance(result, dict), "Indicators should return dict"
        assert "rsi" in result or len(result) > 0, "Should have at least one indicator"


class TestSources:
    """Test source availability"""

    def test_sources_status(self, market_data):
        status = market_data["sources"]()
        assert "indianapi" in status, "Should have indianapi status"
        assert "yahoo" in status, "Should have yahoo status"
        print(f"\n📡 Source Status: {status}")
