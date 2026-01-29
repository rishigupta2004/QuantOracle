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
INDIANAPI_BASE = os.getenv("INDIANAPI_BASE_URL", "https://stock.indianapi.in").rstrip("/")
NEWSDATA = os.getenv("NEWSDATA_API_KEY", "")

RSS = [
    ("https://economictimes.indiatimes.com/rssfeedfeeds/-2128934735.crs", "Economic Times"),
    ("https://www.moneycontrol.com/rss/MarketIndia.xml", "MoneyControl"),
    ("https://www.livemint.com/rssTopic/LatestNews", "LiveMint"),
    # Google News RSS is often the most reliable fallback on hosted networks.
    ("https://news.google.com/rss/search?q=NSE%20stocks%20when%3A7d&hl=en-IN&gl=IN&ceid=IN:en", "Google News"),
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


def _newsdata(q: str = "", category: str = "business", country: str = "in") -> List[Dict]:
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
        items = _fetch("https://newsdata.io/api/1/latest") or _fetch("https://newsdata.io/api/1/news")
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
        r = requests.get(f"{INDIANAPI_BASE}/news", headers={"x-api-key": INDIANAPI}, timeout=8)
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


@st.cache_data(ttl=900, show_spinner="Loading news...")
def market_news() -> List[Dict]:
    # Prefer NewsData (global), then IndianAPI (India), then RSS.
    out = _newsdata()
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
    return _newsdata(q=keyword) if keyword else []


@st.cache_data(ttl=900, show_spinner="Loading company news...")
def company_news(sym: str) -> List[Dict]:
    return _newsdata(q=sym) if sym else []


def categorize_news(articles: List[Dict]) -> Dict[str, List[Dict]]:
    cats = {"Market News": [], "After Market": [], "US Finance": [], "Tech & Crypto": []}
    kw = {
        "After Market": ["after hours", "after market", "extended hours", "earnings after", "stock split", "buyback", "dividend"],
        "US Finance": ["federal reserve", "fed", "us economy", "inflation", "interest rates", "dollar", "wall street", "s&p 500", "nasdaq"],
        "Tech & Crypto": ["bitcoin", "crypto", "ethereum", "ai", "nvidia", "apple", "microsoft", "google", "meta"],
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
    return {"indianapi": bool(INDIANAPI), "newsdata": bool(NEWSDATA)}
