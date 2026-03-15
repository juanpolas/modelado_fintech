from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from .signals import DEFAULT_X_QUERY, affected_archetypes_from_narratives, classify_narratives, company_impact_from_narratives, impact_vector_from_narratives, severity_from_counts, utc_now


class TwitterSignalClient:
    BASE_URL = "https://api.twitter.com/2/tweets/search/recent"

    def __init__(self):
        self.bearer = os.getenv("X_BEARER_TOKEN", "")
        self.max_results = int(os.getenv("X_MAX_RESULTS", "50"))

    def fetch(self, payload: dict[str, Any]) -> dict[str, Any]:
        if not self.bearer:
            return {
                "source_type": "twitter",
                "source_name": "X",
                "fetched_at": utc_now(),
                "query": payload.get("query") or DEFAULT_X_QUERY,
                "tweets": [],
                "warning": "X_BEARER_TOKEN not configured",
            }

        query = payload.get("query") or DEFAULT_X_QUERY
        max_results = int(payload.get("max_results") or self.max_results)
        max_results = max(10, min(100, max_results))

        start_time = payload.get("start_time")
        end_time = payload.get("end_time")
        if not end_time:
            end_time = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        if not start_time:
            start_time = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat().replace("+00:00", "Z")

        headers = {"Authorization": f"Bearer {self.bearer}"}
        params = {
            "query": query,
            "max_results": max_results,
            "tweet.fields": "created_at,public_metrics,lang,author_id",
            "expansions": "author_id",
            "user.fields": "name,username,verified",
            "start_time": start_time,
            "end_time": end_time,
        }

        res = requests.get(self.BASE_URL, headers=headers, params=params, timeout=25)
        if res.status_code >= 400:
            return {
                "source_type": "twitter",
                "source_name": "X",
                "fetched_at": utc_now(),
                "query": query,
                "tweets": [],
                "error": f"X API error {res.status_code}: {res.text[:500]}",
            }

        raw = res.json()
        users = {u["id"]: u for u in raw.get("includes", {}).get("users", [])}
        tweets = []
        for t in raw.get("data", []) or []:
            u = users.get(t.get("author_id", ""), {})
            tweets.append(
                {
                    "id": t.get("id"),
                    "text": t.get("text", ""),
                    "author": u.get("name") or u.get("username") or "unknown",
                    "username": u.get("username", ""),
                    "verified": bool(u.get("verified", False)),
                    "created_at": t.get("created_at"),
                    "metrics": t.get("public_metrics", {}),
                    "url": f"https://x.com/{u.get('username', 'i')}/status/{t.get('id')}",
                }
            )

        return {
            "source_type": "twitter",
            "source_name": "X",
            "fetched_at": utc_now(),
            "query": query,
            "start_time": start_time,
            "end_time": end_time,
            "tweets": tweets,
            "raw_count": len(tweets),
        }

    def analyze(self, fetched: dict[str, Any]) -> dict[str, Any]:
        tweets = fetched.get("tweets") or []
        texts = [t.get("text", "") for t in tweets]
        narratives = classify_narratives(texts)
        total = len(texts)
        severity = severity_from_counts(total, narratives.get("panic", 0), narratives.get("rumor", 0))

        country_vector = impact_vector_from_narratives(narratives)
        company_vector = company_impact_from_narratives(narratives)

        return {
            "source_type": "twitter",
            "source_name": "X",
            "fetched_at": fetched.get("fetched_at") or utc_now(),
            "query": fetched.get("query"),
            "dominant_narratives": sorted(narratives.items(), key=lambda x: x[1], reverse=True)[:6],
            "severity": severity,
            "affected_archetypes": affected_archetypes_from_narratives(narratives),
            "behavioral_impact_vector": {
                "social_panic_level": country_vector.get("social_panic_level", "medium"),
                "bank_trust_index": country_vector.get("bank_trust_index", "medium"),
                "fintech_trust_shift": company_vector.get("trust_baseline", "medium"),
                "liquidity_preference_shift": country_vector.get("liquidity_preference_shift", "medium"),
                "usd_volatility_perception": country_vector.get("usd_volatility", "medium"),
                "crypto_attractiveness": country_vector.get("crypto_volatility", "medium"),
                "promo_attention": company_vector.get("cashback_percent", "medium"),
                "consumer_confidence": country_vector.get("consumer_confidence", "medium"),
                "policy_uncertainty": country_vector.get("policy_uncertainty", "medium"),
            },
            "country_context_adjustment": country_vector,
            "company_context_adjustment": company_vector,
            "tweet_sample": tweets[:20],
            "raw_count": total,
        }
