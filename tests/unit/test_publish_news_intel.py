import pytest

pytestmark = pytest.mark.unit


def test_source_tier_classification():
    import scripts.publish_news_intel as ni

    assert (
        ni._source_tier("https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx")
        == "official"
    )
    assert ni._source_tier("https://www.reuters.com/world/") == "wire"
    assert ni._source_tier("https://example.com/story") == "media"


def test_impact_adds_oil_refinery_context():
    import scripts.publish_news_intel as ni

    impact, tags, oil_meta = ni._impact(
        "OPEC weighs sanctions response after tanker attack",
        "Refinery margins, diesel cracks and crude shipping flows are at risk.",
    )

    assert impact["risk_level"] == "high"
    assert "BRENT" in impact["affected_assets"]
    assert "Refining" in impact["affected_sectors"]
    assert "Middle East" in impact["affected_regions"]
    assert "oil" in tags
    assert oil_meta["relevant"] is True
    assert oil_meta["score"] > 0
