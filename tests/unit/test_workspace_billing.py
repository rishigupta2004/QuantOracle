import pytest

pytestmark = pytest.mark.unit


def test_plan_order_and_page_gates():
    from services import workspace_billing as wb

    assert wb.normalize_plan("Starter") == "starter"
    assert wb.plan_satisfies("terminal", "pro") is True
    assert wb.plan_satisfies("starter", "pro") is False
    assert wb.required_plan_for_page("Risk") == "pro"
    assert wb.required_plan_for_page("ML") == "terminal"


def test_feature_gate_resolution():
    from services import workspace_billing as wb

    assert wb.feature_enabled("basic_quotes", "starter") is True
    assert wb.feature_enabled("risk_analytics", "starter") is False
    assert wb.feature_enabled("risk_analytics", "pro") is True
    assert wb.feature_enabled("ml_models", "pro") is False
    assert wb.feature_enabled("ml_models", "terminal") is True


def test_extract_usage_from_usage_dict():
    from services import workspace_billing as wb

    payload = {
        "usage": {
            "api_calls": {"used": 120, "limit": 1000, "unit": "calls"},
            "alerts": {"used": 2, "limit": 10, "unit": "alerts"},
        }
    }
    meters = wb.extract_usage_meters(payload)
    assert len(meters) == 2
    assert meters[0]["key"] == "api_calls"
    assert meters[0]["used"] == 120
    assert meters[0]["limit"] == 1000
    assert meters[0]["pct"] == 12.0


def test_extract_usage_from_meter_list():
    from services import workspace_billing as wb

    payload = {
        "meters": [
            {
                "key": "quotes",
                "label": "Quotes",
                "current": 40,
                "quota": 100,
                "unit": "req",
            },
            {"name": "news", "used": 18, "max": 50, "unit": "req"},
        ]
    }
    meters = wb.extract_usage_meters(payload)
    assert len(meters) == 2
    assert meters[0]["key"] == "quotes"
    assert meters[0]["pct"] == 40.0
    assert meters[1]["key"] == "news"
    assert meters[1]["pct"] == 36.0


def test_fetch_workspace_usage_builds_expected_url(monkeypatch):
    from services import workspace_billing as wb

    seen = {"url": "", "auth": ""}

    class _Resp:
        status_code = 200

        @staticmethod
        def json():
            return {"plan": "pro", "usage": {"api_calls": {"used": 10, "limit": 100}}}

    def fake_get(url, headers=None, timeout=10):  # noqa: ARG001
        seen["url"] = url
        seen["auth"] = (headers or {}).get("Authorization", "")
        return _Resp()

    monkeypatch.setattr(wb.requests, "get", fake_get, raising=True)
    data = wb.fetch_workspace_usage(
        base_url="https://api.example.com",
        workspace_id="ws_123",
        auth_token="token-1",
    )

    assert seen["url"] == "https://api.example.com/billing/workspaces/ws_123/usage"
    assert seen["auth"] == "Bearer token-1"
    assert data.get("plan") == "pro"
