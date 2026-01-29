"""Remote artifact sync (Supabase Storage public bucket).

Streamlit Cloud has ephemeral disk; we pull the latest published EOD snapshot into local `data/`
so the rest of the app can reuse the same registry + parquet readers.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional

import requests

from services.store import data_dir

DEFAULT_EOD_PREFIX = os.getenv("QUANTORACLE_EOD_PREFIX", "eod/nifty50").strip().strip("/")


def _supabase_public_url(bucket: str, path: str) -> Optional[str]:
    base = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    if not base or not bucket or not path:
        return None
    return f"{base}/storage/v1/object/public/{bucket}/{path.lstrip('/')}"


def fetch_latest_json(prefix: str) -> Dict[str, Any]:
    bucket = os.getenv("SUPABASE_BUCKET", "").strip()
    url = _supabase_public_url(bucket, f"{prefix.rstrip('/')}/latest.json")
    if not url:
        return {}
    try:
        r = requests.get(url, timeout=10)
        if r.status_code != 200:
            return {}
        return json.loads(r.text or "{}") or {}
    except Exception:
        return {}


def _download(url: str, out: Path) -> bool:
    try:
        out.parent.mkdir(parents=True, exist_ok=True)
        with requests.get(url, stream=True, timeout=60) as r:
            if r.status_code != 200:
                return False
            with open(out, "wb") as f:
                for chunk in r.iter_content(chunk_size=1024 * 256):
                    if chunk:
                        f.write(chunk)
        return True
    except Exception:
        return False


def sync_eod(prefix: str = "eod/nifty50") -> Dict[str, Any]:
    """Fetch latest published artifacts into local `data/`. Returns latest.json content (may be empty)."""
    prefix = (prefix or DEFAULT_EOD_PREFIX).strip().strip("/") or DEFAULT_EOD_PREFIX
    meta = fetch_latest_json(prefix)
    if not meta:
        return {}

    bucket = os.getenv("SUPABASE_BUCKET", "").strip()
    if not bucket:
        return {}

    root = data_dir()

    # Download features snapshot.
    feat_url = _supabase_public_url(bucket, f"{prefix.rstrip('/')}/features.parquet")
    if feat_url:
        _download(feat_url, root / "features.parquet")

    # Download model registry files if present in meta.
    model_id = str(meta.get("model_id") or "")
    version = str(meta.get("model_version") or "")
    if model_id and version:
        base = f"{prefix.rstrip('/')}/models/{model_id}/{version}"
        npz = _supabase_public_url(bucket, f"{base}/model.npz")
        mjs = _supabase_public_url(bucket, f"{base}/meta.json")
        if npz:
            _download(npz, root / "models" / model_id / version / "model.npz")
        if mjs:
            _download(mjs, root / "models" / model_id / version / "meta.json")

        # LATEST pointer used by registry helpers.
        latest = _supabase_public_url(bucket, f"{prefix.rstrip('/')}/models/{model_id}/LATEST")
        if latest:
            _download(latest, root / "models" / model_id / "LATEST")

    return meta


def _safe_symbol(sym: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", sym.upper())


def sync_ohlcv(sym: str, prefix: str = "eod/nifty50") -> bool:
    """Fetch a single symbol OHLCV parquet into local `data/ohlcv/`.

    Returns True if a local file exists after the call.
    """
    prefix = (prefix or DEFAULT_EOD_PREFIX).strip().strip("/") or DEFAULT_EOD_PREFIX
    bucket = os.getenv("SUPABASE_BUCKET", "").strip()
    if not bucket:
        return False

    root = data_dir()
    out = root / "ohlcv" / f"{_safe_symbol(sym)}.parquet"
    if out.exists():
        return True

    url = _supabase_public_url(bucket, f"{prefix.rstrip('/')}/ohlcv/{out.name}")
    if not url:
        return False
    return _download(url, out)
