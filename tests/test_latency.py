"""Comprehensive latency benchmarking"""

import pytest
import time

pytestmark = pytest.mark.integration


class TestLatencyBenchmarks:
    """Latency benchmarks for all functions"""

    def test_nse_quote_latency(
        self, market_data, nse_symbols, thresholds, benchmark_runs
    ):
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            for sym in nse_symbols:
                market_data["get_quote"](sym)
            times.append((time.perf_counter() - start) * 1000 / len(nse_symbols))
        avg, min_t, max_t = sum(times) / len(times), min(times), max(times)
        status = "✅" if avg < thresholds["nse_quote"] else "❌"
        print(
            f"\n⏱️  NSE Quotes: min={min_t:.0f}ms avg={avg:.0f}ms max={max_t:.0f}ms {status}"
        )
        assert avg < thresholds["nse_quote"], f"NSE quote too slow: {avg:.0f}ms"

    def test_us_quote_latency(
        self, market_data, us_symbols, thresholds, benchmark_runs
    ):
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            for sym in us_symbols:
                market_data["get_quote"](sym)
            times.append((time.perf_counter() - start) * 1000 / len(us_symbols))
        avg, min_t, max_t = sum(times) / len(times), min(times), max(times)
        status = "✅" if avg < thresholds["us_quote"] else "❌"
        print(
            f"\n⏱️  US Quotes: min={min_t:.0f}ms avg={avg:.0f}ms max={max_t:.0f}ms {status}"
        )
        assert avg < thresholds["us_quote"], f"US quote too slow: {avg:.0f}ms"

    def test_indicators_latency(
        self, market_data, nse_symbols, thresholds, benchmark_runs
    ):
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            market_data["get_indicators"](nse_symbols[0])
            times.append((time.perf_counter() - start) * 1000)
        avg, min_t, max_t = sum(times) / len(times), min(times), max(times)
        status = "✅" if avg < thresholds["indicators"] else "❌"
        print(
            f"\n⏱️  Indicators: min={min_t:.0f}ms avg={avg:.0f}ms max={max_t:.0f}ms {status}"
        )
        assert avg < thresholds["indicators"], f"Indicators too slow: {avg:.0f}ms"

    def test_historical_latency(
        self, market_data, nse_symbols, thresholds, benchmark_runs
    ):
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            market_data["get_historical"](nse_symbols[0], "1mo")
            times.append((time.perf_counter() - start) * 1000)
        avg, min_t, max_t = sum(times) / len(times), min(times), max(times)
        status = "✅" if avg < thresholds["historical"] else "❌"
        print(
            f"\n⏱️  Historical: min={min_t:.0f}ms avg={avg:.0f}ms max={max_t:.0f}ms {status}"
        )
        assert avg < thresholds["historical"], f"Historical too slow: {avg:.0f}ms"

    def test_search_latency(self, market_data, thresholds, benchmark_runs):
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            market_data["search"]("RELIANCE")
            times.append((time.perf_counter() - start) * 1000)
        avg, min_t, max_t = sum(times) / len(times), min(times), max(times)
        status = "✅" if avg < thresholds["search"] else "❌"
        print(
            f"\n⏱️  Search: min={min_t:.0f}ms avg={avg:.0f}ms max={max_t:.0f}ms {status}"
        )
        assert avg < thresholds["search"], f"Search too slow: {avg:.0f}ms"

    def test_batch_quotes_latency(
        self, market_data, all_symbols, thresholds, benchmark_runs
    ):
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            market_data["get_quotes"](all_symbols[:10])
            times.append((time.perf_counter() - start) * 1000)
        avg, min_t, max_t = sum(times) / len(times), min(times), max(times)
        print(
            f"\n⏱️  Batch (10 symbols): min={min_t:.0f}ms avg={avg:.0f}ms max={max_t:.0f}ms"
        )


class TestAnalyticsLatency:
    """Latency tests for analytics functions"""

    def test_portfolio_metrics_latency(
        self, analytics, sample_holdings, thresholds, benchmark_runs
    ):
        import pandas as pd

        history = {
            "RELIANCE.NS": pd.DataFrame({"Close": [100 + i for i in range(100)]}),
            "TCS.NS": pd.DataFrame({"Close": [200 + i for i in range(100)]}),
            "AAPL": pd.DataFrame({"Close": [150 + i for i in range(100)]}),
        }
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            analytics["portfolio_metrics"](sample_holdings, history)
            times.append((time.perf_counter() - start) * 1000)
        avg = sum(times) / len(times)
        print(f"\n⏱️  Portfolio Metrics: avg={avg:.1f}ms")
        assert avg < thresholds["analytics"], f"Portfolio metrics too slow: {avg:.1f}ms"

    def test_var_latency(self, analytics, sample_holdings, thresholds, benchmark_runs):
        import pandas as pd

        history = {
            "RELIANCE.NS": pd.DataFrame({"Close": [100 + i for i in range(100)]})
        }
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            analytics["var"](sample_holdings, history)
            times.append((time.perf_counter() - start) * 1000)
        avg = sum(times) / len(times)
        print(f"\n⏱️  VaR: avg={avg:.1f}ms")
        assert avg < thresholds["analytics"], f"VaR too slow: {avg:.1f}ms"

    def test_max_drawdown_latency(self, analytics, thresholds, benchmark_runs):
        import pandas as pd

        history = {"RELIANCE.NS": pd.DataFrame({"Close": [100, 90, 110, 80, 120]})}
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            analytics["max_drawdown"](history)
            times.append((time.perf_counter() - start) * 1000)
        avg = sum(times) / len(times)
        print(f"\n⏱️  Max Drawdown: avg={avg:.1f}ms")

    def test_beta_latency(self, analytics, sample_holdings, thresholds, benchmark_runs):
        import pandas as pd

        history = {
            "RELIANCE.NS": pd.DataFrame({"Close": [100 + i for i in range(100)]}),
            "^NSEI": pd.DataFrame({"Close": [1000 + i * 2 for i in range(100)]}),
        }
        times = []
        for _ in range(benchmark_runs):
            start = time.perf_counter()
            analytics["beta"](sample_holdings, history)
            times.append((time.perf_counter() - start) * 1000)
        avg = sum(times) / len(times)
        print(f"\n⏱️  Beta: avg={avg:.1f}ms")
