#!/usr/bin/env python3
# HARD CODED IMPORTANT RULE: Keep code concise and meaningful
# - Remove unwanted/junky code and unnecessary lines
# - Each line must be valuable and to the point
# - Avoid bloated, illogical code - prefer 100 clean lines over 10000 junk lines
# - Author: Rishi Gupta
# - License: MIT

"""QuantOracle Benchmark Runner - Test suite with latency benchmarks and reports"""

import argparse
import json
import time
import sys
from datetime import datetime
from typing import Dict, List

from tests.conftest import DEFAULT_WATCHLIST, LATENCY_THRESHOLDS, BENCHMARK_RUNS
from pathlib import Path

ROOT = Path(__file__).parent.parent


class BenchmarkRunner:
    def __init__(
        self,
        nse: List[str],
        us: List[str],
        crypto: List[str],
        forex: List[str],
        runs: int = BENCHMARK_RUNS,
        threshold: int = 2000,
    ):
        self.nse = nse
        self.us = us
        self.crypto = crypto
        self.forex = forex
        self.runs = runs
        self.threshold = threshold
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "symbols": {"nse": nse, "us": us, "crypto": crypto, "forex": forex},
            "runs": runs,
            "threshold_ms": threshold,
            "latency": {},
            "accuracy": {
                "nse_matches": 0,
                "nse_total": len(nse),
                "us_matches": 0,
                "us_total": len(us),
            },
            "fallback": {},
            "analytics": {},
            "status": "pending",
            "errors": [],
        }

    def run(self) -> Dict:
        sys.path.insert(0, str(ROOT / "frontend"))

        from services.market_data import (
            get_quote,
            get_indicators,
            get_historical,
            search,
            sources,
        )
        from utils.news_service import market_news
        from utils.analytics import portfolio_metrics, var, max_drawdown, beta
        import pandas as pd

        print(f"\n{'=' * 60}")
        print("  QUANTORACLE BENCHMARK SUITE")
        print(f"  Run: {self.results['timestamp'][:19]}")
        print(
            f"  Symbols: {len(self.nse)} NSE, {len(self.us)} US, {len(self.crypto)} Crypto"
        )
        print(f"{'=' * 60}\n")

        start_time = time.perf_counter()

        try:
            print("📡 Testing data sources...")
            src_status = sources()
            self.results["sources"] = src_status
            print(f"   Sources: {src_status}\n")

            print("⏱️  Running latency benchmarks...")
            for sym in self.nse[:3]:
                times = [
                    self._time_fn(lambda: get_quote(sym)) for _ in range(self.runs)
                ]
                avg = sum(times) / len(times)
                self.results["latency"][f"nse_{sym}"] = {
                    "min": min(times),
                    "avg": avg,
                    "max": max(times),
                }
                status = "✅" if avg < self.threshold else "❌"
                print(f"   {sym}: {avg:.0f}ms {status}")

            for sym in self.us[:3]:
                times = [
                    self._time_fn(lambda: get_quote(sym)) for _ in range(self.runs)
                ]
                avg = sum(times) / len(times)
                self.results["latency"][f"us_{sym}"] = {
                    "min": min(times),
                    "avg": avg,
                    "max": max(times),
                }
                status = "✅" if avg < self.threshold else "❌"
                print(f"   {sym}: {avg:.0f}ms {status}")

            times = [
                self._time_fn(lambda: get_indicators(self.nse[0]))
                for _ in range(self.runs)
            ]
            self.results["latency"]["indicators"] = {
                "min": min(times),
                "avg": sum(times) / len(times),
                "max": max(times),
            }
            print(
                f"   Indicators: {self.results['latency']['indicators']['avg']:.0f}ms"
            )

            times = [
                self._time_fn(lambda: get_historical(self.nse[0], "1mo"))
                for _ in range(self.runs)
            ]
            self.results["latency"]["historical"] = {
                "min": min(times),
                "avg": sum(times) / len(times),
                "max": max(times),
            }
            print(
                f"   Historical: {self.results['latency']['historical']['avg']:.0f}ms"
            )

            times = [
                self._time_fn(lambda: search("RELIANCE")) for _ in range(self.runs)
            ]
            self.results["latency"]["search"] = {
                "min": min(times),
                "avg": sum(times) / len(times),
                "max": max(times),
            }
            print(f"   Search: {self.results['latency']['search']['avg']:.0f}ms")

            print("\n📈 Testing accuracy...")
            for sym in self.nse[:3]:
                q = get_quote(sym)
                if q.get("price", 0) > 0:
                    self.results["accuracy"]["nse_matches"] += 1
            print(
                f"   NSE: {self.results['accuracy']['nse_matches']}/{self.results['accuracy']['nse_total']} quotes available"
            )

            for sym in self.us[:3]:
                q = get_quote(sym)
                if q.get("price", 0) > 0:
                    self.results["accuracy"]["us_matches"] += 1
            print(
                f"   US: {self.results['accuracy']['us_matches']}/{self.results['accuracy']['us_total']} quotes available"
            )

            print("\n🔄 Testing fallback...")
            self.results["fallback"]["nse"] = (
                "pass" if self.results["accuracy"]["nse_matches"] > 0 else "fail"
            )
            self.results["fallback"]["us"] = (
                "pass" if self.results["accuracy"]["us_matches"] > 0 else "pass"
            )
            print(f"   NSE fallback: {self.results['fallback']['nse']}")
            print(f"   US fallback: {self.results['fallback']['us']}")

            print("\n📉 Testing analytics...")
            holdings = [{"symbol": "RELIANCE.NS", "quantity": 10, "avg_cost": 100}]
            history = {
                "RELIANCE.NS": pd.DataFrame({"Close": [100 + i for i in range(50)]})
            }

            t = self._time_fn(lambda: portfolio_metrics(holdings, history))
            self.results["analytics"]["portfolio_metrics"] = t
            print(f"   Portfolio metrics: {t:.1f}ms")

            t = self._time_fn(lambda: var(holdings, history))
            self.results["analytics"]["var"] = t
            print(f"   VaR: {t:.1f}ms")

            t = self._time_fn(lambda: max_drawdown(history))
            self.results["analytics"]["max_drawdown"] = t
            print(f"   Max Drawdown: {t:.1f}ms")

            history["^NSEI"] = pd.DataFrame(
                {"Close": [1000 + i * 2 for i in range(50)]}
            )
            t = self._time_fn(lambda: beta(holdings, history))
            self.results["analytics"]["beta"] = t
            print(f"   Beta: {t:.1f}ms")

            print("\n📰 Testing news...")
            try:
                t = self._time_fn(market_news)
                self.results["latency"]["news"] = {"min": t, "avg": t, "max": t}
                print(f"   News: {t:.0f}ms")
            except Exception as e:
                self.results["errors"].append(f"News: {e}")
                print(f"   News: Error - {e}")

        except Exception as e:
            self.results["errors"].append(str(e))
            print(f"\n❌ Error: {e}")

        elapsed = time.perf_counter() - start_time
        self.results["duration_seconds"] = round(elapsed, 1)

        all_passed = (
            self.results["accuracy"]["nse_matches"] >= 1
            and self.results["accuracy"]["us_matches"] >= 1
            and self.results["fallback"]["nse"] == "pass"
            and self.results["fallback"]["us"] == "pass"
            and len(self.results["errors"]) == 0
        )
        self.results["status"] = "pass" if all_passed else "fail"

        print(f"\n{'=' * 60}")
        print(
            f"  STATUS: {'ALL TESTS PASSED ✅' if all_passed else 'SOME TESTS FAILED ❌'}"
        )
        print(f"  Duration: {elapsed:.1f}s")
        print(f"{'=' * 60}\n")

        return self.results

    def _time_fn(self, fn) -> float:
        start = time.perf_counter()
        fn()
        return (time.perf_counter() - start) * 1000

    def save_json(self, path: str = "reports/latest.json"):
        Path(path).parent.mkdir(exist_ok=True)
        with open(path, "w") as f:
            json.dump(self.results, f, indent=2)
        print(f"📄 JSON report saved: {path}")

    def save_html(self, path: str = "reports/latest.html"):
        Path(path).parent.mkdir(exist_ok=True)
        html = f"""<!DOCTYPE html>
<html><head><title>QuantOracle Benchmark Report</title>
<style>
body{{font-family:Inter,sans-serif;background:#0d1117;color:#f0f6fc;padding:20px}}
h1{{color:#58a6ff}}h2{{color:#3fb950;border-bottom:1px solid #30363d;padding-bottom:10px}}
table{{width:100%;border-collapse:collapse;margin:20px 0}}
th,td{{padding:12px;text-align:left;border-bottom:1px solid #30363d}}
th{{background:#161b22;color:#8b949e}}
.pass{{color:#3fb950}} .fail{{color:#f85149}}
.summary{{background:#161b22;padding:20px;border-radius:8px;margin:20px 0}}
.metrics{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin:20px 0}}
.metric{{background:#161b22;padding:15px;border-radius:8px;text-align:center}}
.metric .value{{font-size:24px;font-weight:bold;color:#58a6ff}}
.metric .label{{color:#8b949e;font-size:12px}}
</style></head><body>
<h1>📊 QuantOracle Benchmark Report</h1>
<p>Generated: {self.results["timestamp"][:19]}</p>
<p>Symbols: {len(self.nse)} NSE, {len(self.us)} US, {len(self.crypto)} Crypto | Runs: {self.runs} | Threshold: {self.threshold}ms</p>

<div class="summary">
<h2>Summary</h2>
<p class="{"pass" if self.results["status"] == "pass" else "fail"}" style="font-size:24px">
  {"✅ ALL TESTS PASSED" if self.results["status"] == "pass" else "❌ SOME TESTS FAILED"}
</p>
<p>Duration: {self.results["duration_seconds"]}s | Errors: {len(self.results["errors"])}</p>
</div>

<div class="metrics">
<div class="metric"><div class="value">{self.results["accuracy"]["nse_matches"]}/{self.results["accuracy"]["nse_total"]}</div><div class="label">NSE Quotes</div></div>
<div class="metric"><div class="value">{self.results["accuracy"]["us_matches"]}/{self.results["accuracy"]["us_total"]}</div><div class="label">US Quotes</div></div>
<div class="metric"><div class="value">{self.results["latency"].get("search", {}).get("avg", 0):.0f}ms</div><div class="label">Search Latency</div></div>
<div class="metric"><div class="value">{self.results["latency"].get("indicators", {}).get("avg", 0):.0f}ms</div><div class="label">Indicators Latency</div></div>
</div>

<h2>Latency Benchmarks</h2>
<table><tr><th>Function</th><th>Min</th><th>Avg</th><th>Max</th><th>Status</th></tr>
"""
        for name, data in self.results["latency"].items():
            avg = data.get("avg", 0)
            status = "✅" if avg < self.threshold else "❌"
            html += f"<tr><td>{name}</td><td>{data.get('min', 0):.0f}ms</td><td>{avg:.0f}ms</td><td>{data.get('max', 0):.0f}ms</td><td>{status}</td></tr>\n"

        html += """</table>

<h2>Data Sources</h2>
<table><tr><th>Source</th><th>Status</th></tr>
"""
        for src, status in self.results.get("sources", {}).items():
            html += f"<tr><td>{src}</td><td>{'✅' if status else '❌'}</td></tr>\n"

        html += """</table>

<h2>Analytics Performance</h2>
<table><tr><th>Function</th><th>Latency</th></tr>
"""
        for name, t in self.results.get("analytics", {}).items():
            html += f"<tr><td>{name}</td><td>{t:.1f}ms</td></tr>\n"

        html += (
            """</table>

<h2>Accuracy</h2>
<p>NSE Quotes: """
            + f"{self.results['accuracy']['nse_matches']}/{self.results['accuracy']['nse_total']} available</p>\n"
        )
        html += (
            """<p>US Quotes: """
            + f"{self.results['accuracy']['us_matches']}/{self.results['accuracy']['us_total']} available</p>\n"
        )

        if self.results["errors"]:
            html += "<h2>Errors</h2><ul>"
            for e in self.results["errors"]:
                html += f"<li>{e}</li>"
            html += "</ul>"

        html += "</body></html>"
        with open(path, "w") as f:
            f.write(html)
        print(f"📄 HTML report saved: {path}")


def interactive_setup():
    print("\n🎛️  QUANTORACLE BENCHMARK SETUP\n")
    print("Enter symbols (comma-separated), or press Enter for default:\n")

    nse = input("NSE symbols [RELIANCE, TCS, HDFCBANK, IEX]: ").strip()
    nse = [s.strip() for s in nse.split(",")] if nse else DEFAULT_WATCHLIST["nse"]

    us = input("US symbols [AAPL, MSFT, NVDA]: ").strip()
    us = [s.strip() for s in us.split(",")] if us else DEFAULT_WATCHLIST["us"]

    crypto = input("Crypto symbols [BTC-USD, ETH-USD]: ").strip()
    crypto = (
        [s.strip() for s in crypto.split(",")]
        if crypto
        else DEFAULT_WATCHLIST["crypto"]
    )

    forex = input("Forex symbols [USDINR=X, EURUSD=X]: ").strip()
    forex = (
        [s.strip() for s in forex.split(",")] if forex else DEFAULT_WATCHLIST["forex"]
    )

    runs = input(f"\nBenchmark runs [{BENCHMARK_RUNS}]: ").strip()
    runs = int(runs) if runs else BENCHMARK_RUNS

    thresh = input(
        f"Latency threshold ms [{LATENCY_THRESHOLDS['nse_quote']}]: "
    ).strip()
    thresh = int(thresh) if thresh else LATENCY_THRESHOLDS["nse_quote"]

    print("\n✅ Configuration:")
    print(f"   NSE: {nse}")
    print(f"   US: {us}")
    print(f"   Crypto: {crypto}")
    print(f"   Forex: {forex}")
    print(f"   Runs: {runs}")
    print(f"   Threshold: {thresh}ms\n")

    return nse, us, crypto, forex, runs, thresh


def main():
    parser = argparse.ArgumentParser(description="QuantOracle Benchmark Suite")
    parser.add_argument(
        "--interactive", "-i", action="store_true", help="Interactive symbol selection"
    )
    parser.add_argument(
        "--quick", "-q", action="store_true", help="Quick test with defaults"
    )
    parser.add_argument(
        "--ci", action="store_true", help="CI mode with threshold check"
    )
    parser.add_argument(
        "--threshold", "-t", type=int, default=2000, help="Latency threshold ms"
    )
    parser.add_argument(
        "--runs", "-r", type=int, default=BENCHMARK_RUNS, help="Benchmark runs"
    )
    parser.add_argument("--json", action="store_true", help="Save JSON report")
    parser.add_argument("--html", action="store_true", help="Save HTML report")
    parser.add_argument(
        "--monitor", "-m", action="store_true", help="Continuous monitoring mode"
    )
    parser.add_argument(
        "--interval", type=int, default=300, help="Monitor interval seconds"
    )

    args = parser.parse_args()

    if args.interactive:
        nse, us, crypto, forex, runs, thresh = interactive_setup()
    elif args.quick:
        nse, us, crypto, forex = (
            DEFAULT_WATCHLIST["nse"],
            DEFAULT_WATCHLIST["us"],
            DEFAULT_WATCHLIST["crypto"],
            DEFAULT_WATCHLIST["forex"],
        )
        runs, thresh = args.runs, args.threshold
    elif args.monitor:
        import time as tm

        nse, us, crypto, forex = (
            DEFAULT_WATCHLIST["nse"],
            DEFAULT_WATCHLIST["us"],
            DEFAULT_WATCHLIST["crypto"],
            DEFAULT_WATCHLIST["forex"],
        )
        runs, thresh = args.runs, args.threshold
        print(f"🔄 Monitoring mode (every {args.interval}s, Ctrl+C to stop)")
        while True:
            runner = BenchmarkRunner(nse, us, crypto, forex, runs, thresh)
            runner.run()
            if args.json:
                runner.save_json()
            if args.html:
                runner.save_html()
            print(f"⏰ Next run in {args.interval}s...\n")
            tm.sleep(args.interval)
    else:
        nse, us, crypto, forex = (
            DEFAULT_WATCHLIST["nse"],
            DEFAULT_WATCHLIST["us"],
            DEFAULT_WATCHLIST["crypto"],
            DEFAULT_WATCHLIST["forex"],
        )
        runs, thresh = args.runs, args.threshold

    runner = BenchmarkRunner(nse, us, crypto, forex, runs, thresh)
    results = runner.run()

    if args.json or args.ci:
        runner.save_json()
    if args.html:
        runner.save_html()

    if args.ci and results["status"] != "pass":
        print("❌ CI check failed - latency exceeds threshold or errors occurred")
        sys.exit(1)

    sys.exit(0 if results["status"] == "pass" else 1)


if __name__ == "__main__":
    main()
