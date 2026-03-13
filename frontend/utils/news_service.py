"""News aggregation with API + RSS fallback (no parallelism, no surprises)."""

from __future__ import annotations

import os
import re
from typing import Dict, List

import feedparser
import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

INDIANAPI = os.getenv("INDIANAPI_API_KEY", "")
INDIANAPI_BASE = os.getenv("INDIANAPI_BASE_URL", "https://stock.indianapi.in").rstrip(
    "/"
)
NEWSDATA = os.getenv("NEWSDATA_API_KEY", "")
GNEWS = os.getenv("GNEWS_API_KEY", "")
THENEWSAPI = os.getenv("THENEWSAPI_API_KEY", "")

RSS = [
    (
        "https://economictimes.indiatimes.com/rssfeedfeeds/-2128934735.crs",
        "Economic Times",
    ),
    ("https://www.moneycontrol.com/rss/MarketIndia.xml", "MoneyControl"),
    ("https://www.livemint.com/rssTopic/LatestNews", "LiveMint"),
    # Google News RSS is often the most reliable fallback on hosted networks.
    (
        "https://news.google.com/rss/search?q=NSE%20stocks%20when%3A7d&hl=en-IN&gl=IN&ceid=IN:en",
        "Google News",
    ),
]


def _clean_html(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<.*?>", "", s)
    return " ".join(s.split())


def _rss(url: str, source: str) -> List[Dict]:
    try:
        r = requests.get(url, timeout=5)
        if r.status_code != 200:
            return []
        d = feedparser.parse(r.content)
        out = []
        for e in (getattr(d, "entries", []) or [])[:10]:
            out.append(
                {
                    "headline": e.get("title", "No Title"),
                    "summary": _clean_html(str(e.get("summary", "")))[:300],
                    "url": e.get("link", "#"),
                    "source": source,
                    "datetime": "Recent",
                }
            )
        return out
    except Exception:
        return []


def _newsdata(
    q: str = "", category: str = "business", country: str = "in"
) -> List[Dict]:
    if not NEWSDATA:
        return []
    try:
        params = {"apikey": NEWSDATA, "language": "en"}
        if q:
            params["q"] = q
        else:
            params.update({"category": category, "country": country})

        def _fetch(endpoint: str) -> List[Dict]:
            r = requests.get(endpoint, params=params, timeout=8)
            if r.status_code != 200:
                # Keep logs minimal; helps debug HF networking without leaking secrets.
                print(f"NewsData -> {r.status_code}: {(r.text or '')[:120]}")
                return []
            return (r.json() or {}).get("results", [])[:20]

        # NewsData has multiple endpoints; /latest tends to be more stable for headline feeds.
        items = _fetch("https://newsdata.io/api/1/latest") or _fetch(
            "https://newsdata.io/api/1/news"
        )
        out: List[Dict] = []
        for n in items:
            out.append(
                {
                    "headline": n.get("title", "No Title"),
                    "summary": _clean_html(n.get("description", ""))[:300],
                    "url": n.get("link", "#"),
                    "source": n.get("source_id", "NewsData"),
                    "datetime": (n.get("pubDate", "Recent") or "Recent")[:16],
                }
            )
        return out
    except Exception:
        return []


def _indianapi_news() -> List[Dict]:
    if not INDIANAPI:
        return []
    try:
        r = requests.get(
            f"{INDIANAPI_BASE}/news", headers={"x-api-key": INDIANAPI}, timeout=8
        )
        if r.status_code != 200:
            return []
        data = r.json()
        if not isinstance(data, list):
            return []
        return [
            {
                "headline": n.get("title", "No Title"),
                "summary": _clean_html(n.get("description", ""))[:300],
                "url": n.get("url", "#"),
                "source": n.get("source", "IndianAPI"),
                "datetime": "Recent",
            }
            for n in data[:20]
        ]
    except Exception:
        return []


def _gnews(q: str = "", *, country: str = "in") -> List[Dict]:
    if not GNEWS:
        return []
    try:
        params = {
            "apikey": GNEWS,
            "lang": "en",
            "max": 20,
        }
        if q:
            params["q"] = q
            url = "https://gnews.io/api/v4/search"
        else:
            params["topic"] = "business"
            params["country"] = country
            url = "https://gnews.io/api/v4/top-headlines"
        r = requests.get(url, params=params, timeout=8)
        if r.status_code != 200:
            return []
        items = (r.json() or {}).get("articles", [])[:20]
        out: List[Dict] = []
        for n in items:
            out.append(
                {
                    "headline": n.get("title", "No Title"),
                    "summary": _clean_html(n.get("description", ""))[:300],
                    "url": n.get("url", "#"),
                    "source": ((n.get("source") or {}).get("name") or "GNews"),
                    "datetime": (n.get("publishedAt", "Recent") or "Recent")[:16],
                }
            )
        return out
    except Exception:
        return []


def _thenewsapi(q: str = "") -> List[Dict]:
    if not THENEWSAPI:
        return []
    try:
        params = {
            "api_token": THENEWSAPI,
            "language": "en",
            "limit": 20,
            "categories": "business,finance,tech",
        }
        if q:
            params["search"] = q
        r = requests.get(
            "https://api.thenewsapi.com/v1/news/all", params=params, timeout=8
        )
        if r.status_code != 200:
            return []
        items = (r.json() or {}).get("data", [])[:20]
        out: List[Dict] = []
        for n in items:
            out.append(
                {
                    "headline": n.get("title", "No Title"),
                    "summary": _clean_html(n.get("description", ""))[:300],
                    "url": n.get("url", "#"),
                    "source": n.get("source", "TheNewsAPI"),
                    "datetime": (n.get("published_at", "Recent") or "Recent")[:16],
                }
            )
        return out
    except Exception:
        return []


@st.cache_data(ttl=900, show_spinner="Loading news...")
def market_news() -> List[Dict]:
    # Prefer NewsData (global), then TheNewsAPI/GNews, then IndianAPI, then RSS.
    out = _newsdata()
    if out:
        return out
    out = _thenewsapi()
    if out:
        return out
    out = _gnews()
    if out:
        return out
    out = _indianapi_news()
    if out:
        return out
    for url, src in RSS:
        out = _rss(url, src)
        if out:
            return out
    return []


@st.cache_data(ttl=600, show_spinner="Searching news...")
def search_news(keyword: str) -> List[Dict]:
    if not keyword:
        return []
    return _newsdata(q=keyword) or _thenewsapi(q=keyword) or _gnews(q=keyword)


@st.cache_data(ttl=900, show_spinner="Loading company news...")
def company_news(sym: str) -> List[Dict]:
    if not sym:
        return []
    return _newsdata(q=sym) or _thenewsapi(q=sym) or _gnews(q=sym)


def categorize_news(articles: List[Dict]) -> Dict[str, List[Dict]]:
    cats = {
        "Market News": [],
        "After Market": [],
        "US Finance": [],
        "Tech & Crypto": [],
    }
    kw = {
        "After Market": [
            "after hours",
            "after market",
            "extended hours",
            "earnings after",
            "stock split",
            "buyback",
            "dividend",
        ],
        "US Finance": [
            "federal reserve",
            "fed",
            "us economy",
            "inflation",
            "interest rates",
            "dollar",
            "wall street",
            "s&p 500",
            "nasdaq",
        ],
        "Tech & Crypto": [
            "bitcoin",
            "crypto",
            "ethereum",
            "ai",
            "nvidia",
            "apple",
            "microsoft",
            "google",
            "meta",
        ],
    }

    for a in articles or []:
        text = (a.get("headline", "") + " " + a.get("summary", "")).lower()
        placed = False
        for cat, words in kw.items():
            if any(w in text for w in words):
                cats[cat].append(a)
                placed = True
                break
        if not placed:
            cats["Market News"].append(a)
    return cats


def status() -> Dict:
    return {
        "indianapi": bool(INDIANAPI),
        "newsdata": bool(NEWSDATA),
        "gnews": bool(GNEWS),
        "thenewsapi": bool(THENEWSAPI),
    }
