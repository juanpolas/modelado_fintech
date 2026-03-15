from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import feedparser
import requests
from bs4 import BeautifulSoup

from .news_sources import NEWS_SOURCES, SOURCE_BY_NAME, NewsSource
from .signals import (
    affected_archetypes_from_narratives,
    classify_narratives,
    classify_news_event,
    combine_vectors,
    company_impact_from_narratives,
    dedupe_by_key,
    impact_vector_from_narratives,
    severity_from_counts,
    utc_now,
)


class NewsSignalClient:
    def __init__(self):
        enabled_raw = os.getenv("NEWS_SOURCES_ENABLED", "")
        self.enabled_sources = {x.strip() for x in enabled_raw.split(",") if x.strip()} if enabled_raw else set()
        self.fetch_limit = int(os.getenv("NEWS_FETCH_LIMIT_PER_SOURCE", "12"))

    def _is_enabled(self, source_name: str) -> bool:
        return not self.enabled_sources or source_name in self.enabled_sources

    def _fetch_rss(self, source: NewsSource) -> list[dict[str, Any]]:
        if not source.rss_url:
            return []
        feed = feedparser.parse(source.rss_url)
        out = []
        for entry in (feed.entries or [])[: self.fetch_limit]:
            title = getattr(entry, "title", "")
            summary = getattr(entry, "summary", "")
            url = getattr(entry, "link", "")
            published = getattr(entry, "published", "")
            out.append(
                {
                    "source": source.name,
                    "title": title,
                    "summary": summary,
                    "url": url,
                    "published_at": published,
                    "category": ", ".join(source.category_tags),
                    "raw_text_excerpt": (summary or title)[:800],
                }
            )
        return out

    def _fetch_parser(self, source: NewsSource) -> list[dict[str, Any]]:
        if not source.parser_url:
            return []
        try:
            html = requests.get(source.parser_url, timeout=18).text
        except Exception:
            return []

        soup = BeautifulSoup(html, "html.parser")
        out = []
        for a in soup.select("a"):
            title = (a.get_text() or "").strip()
            href = a.get("href") or ""
            if len(title) < 35:
                continue
            if href.startswith("/"):
                href = source.parser_url.rstrip("/") + href
            if not href.startswith("http"):
                continue
            out.append(
                {
                    "source": source.name,
                    "title": title,
                    "summary": title,
                    "url": href,
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "category": ", ".join(source.category_tags),
                    "raw_text_excerpt": title[:800],
                }
            )
            if len(out) >= self.fetch_limit:
                break
        return out

    def fetch(self, payload: dict[str, Any]) -> dict[str, Any]:
        names = payload.get("sources") or []
        selected = []
        if names:
            for name in names:
                s = SOURCE_BY_NAME.get(name)
                if s:
                    selected.append(s)
        else:
            selected = list(NEWS_SOURCES)

        articles: list[dict[str, Any]] = []
        source_status = []
        for source in selected:
            if not self._is_enabled(source.name):
                continue
            try:
                if source.method == "rss":
                    batch = self._fetch_rss(source)
                else:
                    batch = self._fetch_parser(source)
                source_status.append({"source": source.name, "method": source.method, "count": len(batch)})
                articles.extend(batch)
            except Exception as exc:
                source_status.append({"source": source.name, "method": source.method, "count": 0, "error": str(exc)})

        articles = dedupe_by_key(articles, "title")

        return {
            "source_type": "news",
            "source_name": "argentina_news_feeds",
            "fetched_at": utc_now(),
            "source_status": source_status,
            "articles": articles,
            "raw_count": len(articles),
        }

    def analyze(self, fetched: dict[str, Any]) -> dict[str, Any]:
        articles = fetched.get("articles") or []
        enriched = []
        narratives_total: dict[str, int] = {}

        for article in articles:
            text = f"{article.get('title', '')} {article.get('summary', '')}"
            narratives = classify_narratives([text])
            event_type = classify_news_event(text)
            country_vec = impact_vector_from_narratives(narratives)
            company_vec = company_impact_from_narratives(narratives)
            severity = severity_from_counts(1, narratives.get("panic", 0), narratives.get("rumor", 0))

            for k, v in narratives.items():
                narratives_total[k] = narratives_total.get(k, 0) + v

            transmission_channels = []
            if event_type in ("fx", "inflation"):
                transmission_channels.extend(["fx_pressure", "imported_inflation"])
            if event_type in ("energy_shock",):
                transmission_channels.extend(["oil_prices", "energy_costs"])
            if event_type in ("banking_stress", "confidence_issue"):
                transmission_channels.extend(["safe_haven_flows", "liquidity_stress"])
            if event_type in ("political_instability", "elections"):
                transmission_channels.extend(["policy_uncertainty", "domestic_confidence_shock"])

            enriched.append(
                {
                    **article,
                    "event_type": event_type,
                    "severity": severity,
                    "transmission_channels": sorted(set(transmission_channels)),
                    "argentina_impact_vector": country_vec,
                    "company_impact_vector": company_vec,
                    "affected_archetypes": affected_archetypes_from_narratives(narratives),
                }
            )

        country_agg = combine_vectors([x["argentina_impact_vector"] for x in enriched])
        company_agg = combine_vectors([x["company_impact_vector"] for x in enriched])
        severity = severity_from_counts(len(enriched), narratives_total.get("panic", 0), narratives_total.get("rumor", 0))

        return {
            "source_type": "news",
            "source_name": "argentina_news_feeds",
            "fetched_at": fetched.get("fetched_at") or utc_now(),
            "recognized_sources": [s.name for s in NEWS_SOURCES],
            "severity": severity,
            "dominant_narratives": sorted(narratives_total.items(), key=lambda x: x[1], reverse=True)[:8],
            "articles": enriched[:120],
            "country_context_adjustment": country_agg,
            "company_context_adjustment": company_agg,
            "affected_archetypes": affected_archetypes_from_narratives(narratives_total),
            "raw_count": len(enriched),
        }
