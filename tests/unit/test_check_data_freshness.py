from datetime import UTC, datetime

import pytest

pytestmark = pytest.mark.unit


def test_parse_ts_supports_utc_and_offset_formats():
    import scripts.check_data_freshness as cf

    z = cf._parse_ts("2026-03-13T07:40:53Z")
    assert z is not None
    assert z.tzinfo is not None
    assert z.isoformat().endswith("+00:00")

    offset = cf._parse_ts("2026-03-13T13:10:53+0530")
    assert offset is not None
    assert offset.tzinfo is not None
    assert offset.isoformat().endswith("+00:00")


def test_quotes_check_is_optional_outside_nse_when_unconfigured(monkeypatch):
    import scripts.check_data_freshness as cf

    monkeypatch.setattr(cf, "_is_nse_runtime", lambda: False, raising=True)
    monkeypatch.setattr(cf, "_quotes_url", lambda: None, raising=True)

    out = cf._check_quotes(max_age_minutes=180)
    assert out.required is False
    assert out.ok is True
    assert "Missing quotes URL configuration" in out.reason


def test_news_check_passes_for_fresh_valid_payload(monkeypatch):
    import scripts.check_data_freshness as cf

    now_s = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    payload = {
        "as_of_utc": now_s,
        "items": [
            {
                "headline": "Test headline",
                "source": "Test source",
                "impact": {
                    "affected_assets": ["BRENT"],
                    "affected_sectors": ["Refining"],
                    "affected_regions": ["India"],
                    "risk_level": "medium",
                    "summary": "assets: BRENT",
                },
                "source_tier": "wire",
            }
        ],
    }

    monkeypatch.setattr(
        cf,
        "_news_intel_url",
        lambda: "https://example.test/news/latest.json",
        raising=True,
    )
    monkeypatch.setattr(
        cf, "_fetch_json", lambda url: (200, payload, None), raising=True
    )

    out = cf._check_news(max_age_minutes=2160)
    assert out.ok is True
    assert out.status == 200
    assert out.reason == "ok"
