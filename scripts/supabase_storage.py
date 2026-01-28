#!/usr/bin/env python3
"""Minimal Supabase Storage client (no extra deps).

Supports public bucket reads (via URL builder) and authenticated uploads (service role key).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import requests


@dataclass(frozen=True)
class Supabase:
    url: str
    bucket: str
    service_role_key: str = ""

    def public_url(self, path: str) -> str:
        base = self.url.rstrip("/")
        return f"{base}/storage/v1/object/public/{self.bucket}/{path.lstrip('/')}"

    def upload_bytes(self, path: str, data: bytes, *, content_type: str) -> None:
        if not self.service_role_key:
            raise RuntimeError("Missing service role key for upload")
        base = self.url.rstrip("/")
        url = f"{base}/storage/v1/object/{self.bucket}/{path.lstrip('/')}"
        headers = {
            "Authorization": f"Bearer {self.service_role_key}",
            "apikey": self.service_role_key,
            "Content-Type": content_type,
            "x-upsert": "true",
        }
        r = requests.post(url, headers=headers, data=data, timeout=60)
        if r.status_code not in (200, 201):
            raise RuntimeError(f"Supabase upload failed: {r.status_code} {r.text[:200]}")


def from_env(*, require_write: bool = False) -> Optional[Supabase]:
    import os

    url = (os.getenv("SUPABASE_URL") or "").strip()
    bucket = (os.getenv("SUPABASE_BUCKET") or "").strip()
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not bucket:
        return None
    if require_write and not key:
        return None
    return Supabase(url=url, bucket=bucket, service_role_key=key)

