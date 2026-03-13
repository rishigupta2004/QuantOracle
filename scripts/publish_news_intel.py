#!/usr/bin/env python3
"""Build + publish daily geopolitical/news intelligence snapshot.

Output (local):
  data/news_intel_latest.json

Output (Supabase public bucket, when --upload):
  <prefix>/latest.json
  <prefix>/history/<YYYY-MM-DD>.json
"""

# ruff: noqa: E402  (sys.path bootstrap must run before local imports)

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

import feedparser
import requests

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from quant.registry import data_root
from scripts.supabase_storage import from_env

OFFICIAL_DOMAINS = {
    "rbi.org.in",
    "sebi.gov.in",
    "mca.gov.in",
    "mea.gov.in",
    "petroleum.nic.in",
    "ppac.gov.in",
    "opec.org",
    "iea.org",
    "eia.gov",
    "imf.org",
    "worldbank.org",
    "bis.org",
    "federalreserve.gov",
    "ecb.europa.eu",
}

WIRE_DOMAINS = {
    "reuters.com",
    "bloomberg.com",
    "apnews.com",
    "ft.com",
    "wsj.com",
}

RSS_QUERIES = [
    "geopolitics oil market sanctions OPEC",
    "India policy RBI SEBI market regulation",
    "oil refinery India diesel gasoline margins",
    "shipping crude tanker Hormuz Red Sea",
]

HIGH_RISK_KW = {
    "war",
    "missile",
    "attack",
    "sanction",
    "embargo",
    "blockade",
    "hormuz",
    "red sea",
    "drone strike",
}

MED_RISK_KW = {
    "election",
    "tariff",
    "export ban",
    "rate hike",
    "rate cut",
    "inflation",
    "policy",
    "quota",
    "production cut",
}

ASSET_RULES = [
    (re.compile(r"\b(brent|wti|crude|oil)\b", re.I), ["BRENT", "WTI"]),
    (re.compile(r"\b(nifty|sensex|equity|stocks?)\b", re.I), ["NIFTY50", "SENSEX"]),
    (re.compile(r"\b(rupee|usd\/inr|usd inr|dollar)\b", re.I), ["USDINR"]),
    (re.compile(r"\b(yield|treasury|bond)\b", re.I), ["US10Y"]),
    (re.compile(r"\b(lng|natural gas|gas prices?)\b", re.I), ["Natural Gas"]),
]

SECTOR_RULES = [
    (
        re.compile(r"\b(refinery|refining|gasoline|diesel|petrol|jet fuel)\b", re.I),
        ["Refining"],
    ),
    (
        re.compile(r"\b(upstream|exploration|production)\b", re.I),
        ["Upstream Oil & Gas"],
    ),
    (re.compile(r"\b(petrochemical|petchem|chemical)\b", re.I), ["Petrochemicals"]),
    (re.compile(r"\b(shipping|tanker|freight|container)\b", re.I), ["Shipping"]),
    (re.compile(r"\b(power|utilities|coal|gas-fired)\b", re.I), ["Power Utilities"]),
]

REGION_RULES = [
    (re.compile(r"\b(india|nse|rbi|sebi|delhi|mumbai)\b", re.I), ["India"]),
    (
        re.compile(r"\b(saudi|iran|iraq|uae|qatar|gulf|middle east|opec)\b", re.I),
        ["Middle East"],
    ),
    (
        re.compile(r"\b(usa|united states|federal reserve|treasury)\b", re.I),
        ["United States"],
    ),
    (re.compile(r"\b(russia|ukraine|europe|ecb)\b", re.I), ["Europe"]),
    (re.compile(r"\b(china|beijing)\b", re.I), ["China"]),
]


@dataclass(frozen=True)
class RawItem:
    headline: str
    summary: str
    url: str
    source: str
    datetime: str
    provider: str


def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", "", s or "")).strip()


def _domain(url: str) -> str:
    try:
        host = (urlparse(url).hostname or "").lower().strip()
    except Exception:
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host


def _domain_matches(host: str, allowed: set[str]) -> bool:
    return any(host == d or host.endswith(f".{d}") for d in allowed)


def _source_tier(url: str) -> str:
    host = _domain(url)
    if _domain_matches(host, OFFICIAL_DOMAINS):
        return "official"
    if _domain_matches(host, WIRE_DOMAINS):
        return "wire"
    if host:
        return "media"
    return "unknown"


def _parse_ts(raw: str) -> datetime:
    s = (raw or "").strip()
    if not s:
        return datetime.now(UTC)
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    if len(s) >= 5 and s[-5] in "+-" and s[-3] != ":":
        s = s[:-2] + ":" + s[-2:]
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            return dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    except Exception:
        return datetime.now(UTC)


def _impact(
    headline: str, summary: str
) -> tuple[dict[str, Any], list[str], dict[str, Any]]:
    text = f"{headline} {summary}".lower()

    assets: set[str] = set()
    sectors: set[str] = set()
    regions: set[str] = set()

    for pat, vals in ASSET_RULES:
        if pat.search(text):
            assets.update(vals)
    for pat, vals in SECTOR_RULES:
        if pat.search(text):
            sectors.update(vals)
    for pat, vals in REGION_RULES:
        if pat.search(text):
            regions.update(vals)

    risk = "low"
    if any(k in text for k in HIGH_RISK_KW):
        risk = "high"
    elif any(k in text for k in MED_RISK_KW):
        risk = "medium"

    oil_kw = {
        "oil",
        "crude",
        "brent",
        "wti",
        "refinery",
        "refining",
        "diesel",
        "gasoline",
        "petrochemical",
        "petchem",
        "opec",
        "tanker",
    }
    oil_score = sum(1 for k in oil_kw if k in text)
    oil_relevance = oil_score > 0

    tags: set[str] = set()
    if oil_relevance:
        tags.add("oil")
    if "refining" in sectors:
        tags.add("refinery")
    if "shipping" in text or "tanker" in text:
        tags.add("shipping")
    if "sanction" in text:
        tags.add("sanctions")
    if "opec" in text:
        tags.add("opec")

    impact = {
        "affected_assets": sorted(assets),
        "affected_sectors": sorted(sectors),
        "affected_regions": sorted(regions),
        "risk_level": risk,
        "summary": ", ".join(
            [
                f"assets: {', '.join(sorted(assets))}" if assets else "",
                f"sectors: {', '.join(sorted(sectors))}" if sectors else "",
                f"regions: {', '.join(sorted(regions))}" if regions else "",
            ]
        ).strip(", ")
        or "broad market sensitivity",
    }
    oil_meta = {"relevant": oil_relevance, "score": oil_score}
    return impact, sorted(tags), oil_meta


def _from_newsdata(limit: int) -> list[RawItem]:
    key = (os.getenv("NEWSDATA_API_KEY") or "").strip()
    if not key:
        return []
    q = "(geopolitics OR sanctions OR oil OR refinery OR OPEC OR RBI OR SEBI)"
    url = "https://newsdata.io/api/1/latest"
    try:
        r = requests.get(
            url,
            params={"apikey": key, "language": "en", "q": q},
            timeout=12,
        )
        if r.status_code != 200:
            return []
        payload = r.json() or {}
        out: list[RawItem] = []
        for n in (payload.get("results") or [])[:limit]:
            out.append(
                RawItem(
                    headline=_clean(str(n.get("title") or "Untitled")),
                    summary=_clean(str(n.get("description") or "")),
                    url=str(n.get("link") or "").strip(),
                    source=str(n.get("source_id") or "NewsData").strip(),
                    datetime=str(n.get("pubDate") or "").strip(),
                    provider="newsdata",
                )
            )
        return out
    except Exception:
        return []


def _from_gnews(limit: int) -> list[RawItem]:
    key = (os.getenv("GNEWS_API_KEY") or "").strip()
    if not key:
        return []
    q = "geopolitics OR sanctions OR oil refinery OR OPEC OR RBI"
    try:
        r = requests.get(
            "https://gnews.io/api/v4/search",
            params={"apikey": key, "q": q, "lang": "en", "max": limit},
            timeout=12,
        )
        if r.status_code != 200:
            return []
        data = r.json() or {}
        out: list[RawItem] = []
        for n in (data.get("articles") or [])[:limit]:
            source = (n.get("source") or {}).get("name") or "GNews"
            out.append(
                RawItem(
                    headline=_clean(str(n.get("title") or "Untitled")),
                    summary=_clean(str(n.get("description") or "")),
                    url=str(n.get("url") or "").strip(),
                    source=str(source).strip(),
                    datetime=str(n.get("publishedAt") or "").strip(),
                    provider="gnews",
                )
            )
        return out
    except Exception:
        return []


def _rss_google_search(query: str, limit: int) -> list[RawItem]:
    url = (
        f"https://news.google.com/rss/search?q={quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"
    )
    try:
        r = requests.get(url, timeout=10)
        if r.status_code != 200:
            return []
        feed = feedparser.parse(r.content)
        out: list[RawItem] = []
        for e in (feed.entries or [])[:limit]:
            source = (
                (getattr(e, "source", None) or {}).get("title")
                if isinstance(getattr(e, "source", None), dict)
                else "Google News RSS"
            )
            out.append(
                RawItem(
                    headline=_clean(str(e.get("title", "Untitled"))),
                    summary=_clean(str(e.get("summary", ""))),
                    url=str(e.get("link", "")).strip(),
                    source=_clean(str(source or "Google News RSS")),
                    datetime=str(e.get("published", "")).strip(),
                    provider="rss",
                )
            )
        return out
    except Exception:
        return []


def _collect(limit: int) -> tuple[list[RawItem], dict[str, int], list[str]]:
    provider_counts: dict[str, int] = {}
    order: list[str] = []

    out: list[RawItem] = []

    api_sources = [
        ("newsdata", _from_newsdata),
        ("gnews", _from_gnews),
    ]

    for name, fn in api_sources:
        items = fn(limit)
        if name not in order:
            order.append(name)
        provider_counts[name] = provider_counts.get(name, 0) + len(items)
        out.extend(items)

    if "rss" not in order:
        order.append("rss")
    for q in RSS_QUERIES:
        items = _rss_google_search(q, max(8, limit // 2))
        provider_counts["rss"] = provider_counts.get("rss", 0) + len(items)
        out.extend(items)

    return out, provider_counts, order


def _normalize(items: list[RawItem], max_items: int) -> list[dict[str, Any]]:
    deduped: dict[str, RawItem] = {}
    for it in items:
        if not it.url or not it.headline:
            continue
        key = f"{_domain(it.url)}|{it.headline.lower().strip()}"
        if key not in deduped:
            deduped[key] = it

    ranked = sorted(deduped.values(), key=lambda x: _parse_ts(x.datetime), reverse=True)

    out: list[dict[str, Any]] = []
    for it in ranked[:max_items]:
        source_tier = _source_tier(it.url)
        impact, tags, oil_meta = _impact(it.headline, it.summary)
        out.append(
            {
                "headline": it.headline,
                "summary": it.summary,
                "url": it.url,
                "source": it.source,
                "datetime": it.datetime or "Recent",
                "provider": it.provider,
                "source_tier": source_tier,
                "impact": impact,
                "tags": tags,
                "oil_refinery": oil_meta,
            }
        )
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-items", type=int, default=40)
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--prefix", default="")
    args = ap.parse_args()

    raw, provider_breakdown, provider_order = _collect(limit=max(20, args.max_items))
    items = _normalize(raw, max_items=args.max_items)
    now = datetime.now(UTC)
    now_s = now.isoformat().replace("+00:00", "Z")

    official_count = sum(1 for i in items if i.get("source_tier") == "official")
    wire_count = sum(1 for i in items if i.get("source_tier") == "wire")
    oil_refinery_count = sum(
        1 for i in items if bool((i.get("oil_refinery") or {}).get("relevant"))
    )

    payload = {
        "as_of_utc": now_s,
        "generated_at_utc": now_s,
        "count": len(items),
        "provider_order": provider_order,
        "provider_breakdown": provider_breakdown,
        "quality": {
            "official_count": official_count,
            "wire_count": wire_count,
            "oil_refinery_count": oil_refinery_count,
        },
        "items": items,
    }

    root = data_root()
    root.mkdir(parents=True, exist_ok=True)
    out_path = root / "news_intel_latest.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {out_path} ({len(items)} items)")

    if not args.upload:
        return 0

    sb = from_env(require_write=True)
    if not sb:
        raise SystemExit(
            "Missing SUPABASE_URL/SUPABASE_BUCKET/SUPABASE_SERVICE_ROLE_KEY for upload"
        )

    prefix = args.prefix.strip().strip("/") or (
        os.getenv("QUANTORACLE_NEWS_PREFIX") or "news/intel"
    ).strip("/")
    day = now.strftime("%Y-%m-%d")
    blob = out_path.read_bytes()

    sb.upload_bytes(
        f"{prefix}/history/{day}.json", blob, content_type="application/json"
    )
    sb.upload_bytes(f"{prefix}/latest.json", blob, content_type="application/json")
    print(f"Uploaded -> {sb.public_url(f'{prefix}/latest.json')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
