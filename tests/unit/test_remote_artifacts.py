from __future__ import annotations

import json
from pathlib import Path

import frontend.services.remote_artifacts as ra


class _Resp:
    def __init__(self, *, status_code: int = 200, text: str = "", content: bytes = b""):
        self.status_code = status_code
        self.text = text
        self._content = content

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def iter_content(self, chunk_size: int = 1024):
        yield self._content


def test_fetch_latest_json_empty_without_env(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_BUCKET", raising=False)
    assert ra.fetch_latest_json("eod/nifty50") == {}


def test_fetch_latest_json_parses(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_BUCKET", "bucket")

    payload = {"as_of_date": "2026-01-28", "model_id": "ridge_h5", "model_version": "v1"}

    def fake_get(url, timeout=10, **kwargs):  # noqa: ARG001
        return _Resp(status_code=200, text=json.dumps(payload))

    monkeypatch.setattr(ra, "requests", type("R", (), {"get": staticmethod(fake_get)}))
    out = ra.fetch_latest_json("eod/nifty50")
    assert out["as_of_date"] == "2026-01-28"
    assert out["model_id"] == "ridge_h5"


def test_sync_eod_downloads_expected_files(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("QUANTORACLE_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_BUCKET", "bucket")

    meta = {
        "as_of_date": "2026-01-28",
        "model_id": "ridge_h5",
        "model_version": "v1",
    }
    monkeypatch.setattr(ra, "fetch_latest_json", lambda prefix: meta)

    # Write different content depending on URL; exercise ra._download.
    def fake_get(url, stream=False, timeout=60, **kwargs):  # noqa: ARG001
        if url.endswith("/features.parquet"):
            return _Resp(content=b"PARQUET")
        if url.endswith("/model.npz"):
            return _Resp(content=b"NPZ")
        if url.endswith("/meta.json"):
            return _Resp(content=b"{}")
        if url.endswith("/LATEST"):
            return _Resp(content=b"v1")
        if url.endswith("/latest.json"):
            return _Resp(status_code=200, text=json.dumps(meta))
        return _Resp(status_code=404, text="not found")

    monkeypatch.setattr(ra, "requests", type("R", (), {"get": staticmethod(fake_get)}))

    out = ra.sync_eod("eod/nifty50")
    assert out["as_of_date"] == "2026-01-28"

    root = tmp_path
    assert (root / "features.parquet").exists()
    assert (root / "models" / "ridge_h5" / "v1" / "model.npz").exists()
    assert (root / "models" / "ridge_h5" / "v1" / "meta.json").exists()
    assert (root / "models" / "ridge_h5" / "LATEST").exists()


def test_sync_ohlcv_downloads(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("QUANTORACLE_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_BUCKET", "bucket")

    def fake_get(url, stream=False, timeout=60, **kwargs):  # noqa: ARG001
        return _Resp(content=b"OHLCV")

    monkeypatch.setattr(ra, "requests", type("R", (), {"get": staticmethod(fake_get)}))

    ok = ra.sync_ohlcv("TCS.NS", prefix="eod/nifty50")
    assert ok is True
    assert (tmp_path / "ohlcv" / "TCS.NS.parquet").exists()
