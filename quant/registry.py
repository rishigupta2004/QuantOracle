"""Model registry (local filesystem).

Layout:
  data/models/<model_id>/<version>/{model.*,meta.json}
  data/models/<model_id>/LATEST  (text file with version id)

`model_id` examples:
  ridge_h5
  gbdt_h5
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


def data_root() -> Path:
    return Path(os.getenv("QUANTORACLE_DATA_DIR", "data")).resolve()


def models_root() -> Path:
    return data_root() / "models"


def reports_root() -> Path:
    return data_root() / "reports"


def version_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def model_root(model_id: str) -> Path:
    return models_root() / model_id


def model_version_dir(model_id: str, version: str) -> Path:
    return model_root(model_id) / version


def write_latest(model_id: str, version: str) -> None:
    p = model_root(model_id)
    p.mkdir(parents=True, exist_ok=True)
    (p / "LATEST").write_text(version, encoding="utf-8")


def read_latest(model_id: str) -> Optional[str]:
    p = model_root(model_id) / "LATEST"
    if not p.exists():
        return None
    return p.read_text(encoding="utf-8").strip() or None


def latest_dir(model_id: str) -> Optional[Path]:
    v = read_latest(model_id)
    if not v:
        return None
    d = model_version_dir(model_id, v)
    return d if d.exists() else None


def save_meta(model_dir: Path, meta: dict[str, Any]) -> None:
    (model_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")


def load_meta(model_dir: Path) -> dict[str, Any]:
    p = model_dir / "meta.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}

