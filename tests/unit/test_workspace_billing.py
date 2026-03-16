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


def test_extract_usage_meters_from_meters_list():
    from services import workspace_billing as wb

    payload = {
        "meters": [
            {"key": "quotes", "current": 40, "quota": 100, "unit": "req"},
            {"key": "news", "current": 18, "quota": 50, "unit": "req"},
        ]
    }
    meters = wb.extract_usage_meters(payload)
    assert len(meters) == 2
    assert meters[0]["key"] == "quotes"
    assert meters[1]["key"] == "news"


def test_extract_usage_meters_returns_empty_for_missing():
    from services import workspace_billing as wb

    assert wb.extract_usage_meters({}) == []
    assert wb.extract_usage_meters({"usage": {}}) == []
