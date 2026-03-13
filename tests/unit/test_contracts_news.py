import pytest

pytestmark = pytest.mark.unit


def test_market_news_contract_offline(monkeypatch, stub_requests):
    import utils.news_service as ns

    # Force API paths off.
    monkeypatch.setattr(ns, "INDIANAPI", "", raising=True)
    monkeypatch.setattr(ns, "NEWSDATA", "", raising=True)

    # Stub RSS parsing to return deterministic entries.
    monkeypatch.setattr(
        ns.feedparser,
        "parse",
        lambda content: type(
            "D",
            (),
            {
                "entries": [
                    {"title": "Test headline", "summary": "Test summary", "link": "x"}
                ]
            },
        )(),
        raising=True,
    )

    # Also make RSS HTTP succeed.
    class _Resp:
        status_code = 200
        content = b"rss"

    monkeypatch.setattr(ns.requests, "get", lambda *a, **k: _Resp(), raising=True)

    items = ns.market_news()
    assert isinstance(items, list)
    assert items, "Expected RSS fallback to return at least one article"
    a = items[0]
    for k in ("headline", "summary", "url", "source", "datetime"):
        assert k in a


def test_search_news_uses_gnews_fallback(monkeypatch, stub_requests):
    import utils.news_service as ns

    monkeypatch.setattr(ns, "NEWSDATA", "", raising=True)
    monkeypatch.setattr(ns, "THENEWSAPI", "", raising=True)
    monkeypatch.setattr(ns, "GNEWS", "gnews-key", raising=True)

    class _Resp:
        status_code = 200

        @staticmethod
        def json():
            return {
                "articles": [
                    {
                        "title": "BTC rallies on ETF flows",
                        "description": "Market update",
                        "url": "https://example.com/a",
                        "source": {"name": "GNews"},
                        "publishedAt": "2026-03-12T10:00:00Z",
                    }
                ]
            }

    monkeypatch.setattr(ns.requests, "get", lambda *a, **k: _Resp(), raising=True)

    items = ns.search_news("bitcoin")
    assert items
    assert items[0]["headline"] == "BTC rallies on ETF flows"
    assert items[0]["source"] == "GNews"
