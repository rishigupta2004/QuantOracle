#!/usr/bin/env python3
"""Generate an India-first universe file from built-in symbol maps."""

# ruff: noqa: E402  (sys.path bootstrap must run before local imports)

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, "frontend")

from services.market_data import ETF, STOCK


def main():
    out = Path("data/universe/india_full.txt")
    out.parent.mkdir(parents=True, exist_ok=True)

    index_proxies = [
        "NIFTYBEES.NS",
        "BANKBEES.NS",
        "ITBEES.NS",
        "GOLDBEES.NS",
    ]
    lines = []
    lines += ["# Auto-generated. Edit if you want.", ""]
    lines += ["# Index proxies (tradable ETFs)"] + index_proxies + [""]
    lines += ["# ETFs"] + sorted(ETF.keys()) + [""]
    lines += ["# Stocks"] + sorted(STOCK.keys()) + [""]

    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out} ({len(index_proxies) + len(ETF) + len(STOCK)} symbols)")


if __name__ == "__main__":
    main()
