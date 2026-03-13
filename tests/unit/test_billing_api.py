import json

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.unit


def test_health_endpoint():
    from api.main import app

    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body.get("status") == "ok"


def test_usage_endpoint_default(monkeypatch):
    from api.main import app

    monkeypatch.delenv("QUANTORACLE_BILLING_TOKEN", raising=False)
    monkeypatch.delenv("QUANTORACLE_BILLING_STORE_JSON", raising=False)
    monkeypatch.setenv("QUANTORACLE_WORKSPACE_PLAN", "starter")

    client = TestClient(app)
    r = client.get("/billing/workspaces/default/usage")
    assert r.status_code == 200
    body = r.json()
    assert body["workspace_id"] == "default"
    assert body["plan"] == "starter"
    assert "usage" in body
    assert "entitlements" in body


def test_usage_endpoint_requires_bearer_when_token_set(monkeypatch):
    from api.main import app

    monkeypatch.setenv("QUANTORACLE_BILLING_TOKEN", "abc123")
    client = TestClient(app)

    r = client.get("/billing/workspaces/default/usage")
    assert r.status_code == 401

    r2 = client.get(
        "/billing/workspaces/default/usage",
        headers={"Authorization": "Bearer abc123"},
    )
    assert r2.status_code == 200


def test_usage_endpoint_reads_workspace_store(monkeypatch):
    from api.main import app

    store = {
        "team-1": {
            "plan": "pro",
            "usage": {
                "api_calls": {"used": 321, "limit": 1000, "unit": "requests"},
                "alerts": {"used": 7, "limit": 100, "unit": "count"},
            },
            "updated_at": "2026-03-12T11:00:00Z",
        }
    }
    monkeypatch.setenv("QUANTORACLE_BILLING_STORE_JSON", json.dumps(store))
    monkeypatch.delenv("QUANTORACLE_BILLING_TOKEN", raising=False)

    client = TestClient(app)
    r = client.get("/billing/workspaces/team-1/usage")
    assert r.status_code == 200
    body = r.json()
    assert body["plan"] == "pro"
    assert body["usage"]["api_calls"]["used"] == 321
    assert body["usage"]["alerts"]["limit"] == 100
    assert body["updated_at"] == "2026-03-12T11:00:00Z"
