#!/usr/bin/env python3
"""Run QuantOracle tests in a predictable order.

This runs:
  1) Unit tests (offline, deterministic) using default pytest.ini selection
  2) Integration tests (network / external APIs), explicitly
"""

from __future__ import annotations

import subprocess
import sys


def _run(cmd: list[str]) -> int:
    print(f"\n$ {' '.join(cmd)}")
    return subprocess.call(cmd)


def main() -> int:
    rc = 0

    rc |= _run([sys.executable, "-m", "pytest", "-q"])
    rc |= _run([sys.executable, "-m", "pytest", "-q", "-m", "integration"])

    if rc == 0:
        print("\nALL TESTS PASSED")
    else:
        print("\nSOME TESTS FAILED")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())

