"""Streamlit Cloud entrypoint.

Streamlit Cloud defaults to `streamlit_app.py` at repo root. Keep this file tiny and
delegate to the real app in `frontend/app.py`.
"""

from __future__ import annotations

import runpy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
for p in (ROOT, FRONTEND):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)

runpy.run_path(str(ROOT / "frontend" / "app.py"), run_name="__main__")
