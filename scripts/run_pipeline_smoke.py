#!/usr/bin/env python3
"""Run the local EOD -> features -> train pipeline and print full stdout/stderr.

This is a smoke runner (not a pytest test) so you can see real output easily.
"""

from __future__ import annotations

import subprocess
import sys


def _run(cmd: list[str]) -> int:
    print("\n$", " ".join(cmd))
    p = subprocess.run(cmd, text=True, capture_output=True)
    if p.stdout:
        print(p.stdout.rstrip())
    if p.stderr:
        print(p.stderr.rstrip(), file=sys.stderr)
    return int(p.returncode)


def main() -> int:
    py = sys.executable
    cmds = [[py, "scripts/publish_eod.py", "--universe-file", "data/universe/nifty50.txt", "--universe-name", "nifty50", "--horizon", "5"]]
    for cmd in cmds:
        rc = _run(cmd)
        if rc != 0:
            return rc
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
